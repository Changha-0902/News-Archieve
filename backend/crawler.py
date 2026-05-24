import logging
import re
from dataclasses import dataclass
from typing import Optional

import html2text
import requests
import trafilatura
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Linux; Android 12; SM-G991B) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Mobile Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

# Common article body selectors for Korean news sites
CONTENT_SELECTORS = [
    "[itemprop='articleBody']",
    ".article_txt",       # Inven, etc.
    ".articleArea",
    ".article-content",
    ".article_content",
    "#article_content",
    "#articleContent",
    ".news_content",
    "#newsContent",
    ".view_content",
    ".post-content",
    ".entry-content",
    ".content_article",
    ".contArea",
    ".cont_area",
    ".article_body",
    ".newsEndContents",   # Naver
    "#newsEndContents",
    ".go_trans",          # Naver
    "article",
    ".article",
    "#article",
]


@dataclass
class CrawlResult:
    title: Optional[str]
    content: Optional[str]
    author: Optional[str]
    published_date: Optional[str]
    source_url: str
    success: bool
    method: str


def _og_metadata(soup: BeautifulSoup) -> dict:
    og = {}
    for meta in soup.find_all("meta"):
        prop = meta.get("property", "") or meta.get("name", "")
        content = meta.get("content", "")
        if prop and content:
            og[prop] = content
    return og


def _extract_title(soup: BeautifulSoup, og: dict) -> Optional[str]:
    if og.get("og:title"):
        return og["og:title"]

    for sel in ["h1.title", "h2.title", ".article_title", ".news_title",
                ".view_title", "h1", "h2"]:
        el = soup.select_one(sel)
        if el:
            t = el.get_text(strip=True)
            if t and 3 < len(t) < 300:
                return t

    title_tag = soup.find("title")
    if title_tag:
        return title_tag.get_text(strip=True)
    return None


def _extract_author(soup: BeautifulSoup, og: dict) -> Optional[str]:
    if og.get("dable:author"):
        return og["dable:author"]

    for sel in ["[itemprop='author']", ".author", ".writer",
                ".article_writer", ".news_writer", ".byline",
                "meta[name='author']"]:
        el = soup.select_one(sel)
        if el:
            t = el.get("content") if el.name == "meta" else el.get_text(strip=True)
            if t and len(t) < 60:
                return t
    return None


def _extract_date(soup: BeautifulSoup, og: dict) -> Optional[str]:
    if og.get("article:published_time"):
        return og["article:published_time"][:10]

    for sel in ["time[datetime]", ".date", ".news_date",
                ".article_date", ".pub_date", ".write_time"]:
        el = soup.select_one(sel)
        if el:
            val = el.get("datetime") or el.get_text(strip=True)
            if val:
                # Extract YYYY-MM-DD pattern
                m = re.search(r"\d{4}[-./]\d{2}[-./]\d{2}", val)
                return m.group(0) if m else val[:20]
    return None


_h2md = html2text.HTML2Text()
_h2md.ignore_links = True
_h2md.ignore_images = True
_h2md.body_width = 0


def _extract_content_bs4(soup: BeautifulSoup) -> Optional[str]:
    for tag in soup(["script", "style", "nav", "header", "footer",
                     "aside", "iframe", "noscript"]):
        tag.decompose()

    for sel in CONTENT_SELECTORS:
        el = soup.select_one(sel)
        if el:
            text = _h2md.handle(str(el))
            text = re.sub(r"\n{3,}", "\n\n", text).strip()
            if len(text) > 200:
                return text
    return None


def _try_trafilatura(html: str, url: str) -> CrawlResult:
    try:
        metadata = trafilatura.extract_metadata(html, default_url=url)
        content = trafilatura.extract(
            html,
            url=url,
            include_tables=False,
            include_images=False,
            favor_precision=True,
            output_format="markdown",
        )
        if content and len(content.strip()) > 200:
            authors = None
            if metadata and metadata.author:
                authors = (
                    ", ".join(metadata.author)
                    if isinstance(metadata.author, list)
                    else metadata.author
                )
            return CrawlResult(
                title=metadata.title if metadata else None,
                content=content.strip(),
                author=authors,
                published_date=str(metadata.date) if metadata and metadata.date else None,
                source_url=url,
                success=True,
                method="trafilatura",
            )
    except Exception as e:
        logger.warning("trafilatura failed for %s: %s", url, e)

    return CrawlResult(
        title=None, content=None, author=None, published_date=None,
        source_url=url, success=False, method="trafilatura",
    )


def _try_beautifulsoup(html: str, url: str) -> CrawlResult:
    try:
        soup = BeautifulSoup(html, "lxml")
        og = _og_metadata(soup)

        title = _extract_title(soup, og)
        author = _extract_author(soup, og)
        date = _extract_date(soup, og)
        content = _extract_content_bs4(soup)

        if content:
            return CrawlResult(
                title=title, content=content, author=author, published_date=date,
                source_url=url, success=True, method="beautifulsoup",
            )

        # Partial: got metadata but not body
        return CrawlResult(
            title=title, content=None, author=author, published_date=date,
            source_url=url, success=False, method="manual_required",
        )
    except Exception as e:
        logger.error("BeautifulSoup failed for %s: %s", url, e)

    return CrawlResult(
        title=None, content=None, author=None, published_date=None,
        source_url=url, success=False, method="error",
    )


def crawl_url(url: str) -> CrawlResult:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20, allow_redirects=True)
        resp.encoding = resp.apparent_encoding
        html = resp.text
    except requests.RequestException as e:
        logger.error("Request failed for %s: %s", url, e)
        return CrawlResult(
            title=None, content=None, author=None, published_date=None,
            source_url=url, success=False, method="error",
        )

    result = _try_trafilatura(html, url)
    if result.success:
        return result

    return _try_beautifulsoup(html, url)
