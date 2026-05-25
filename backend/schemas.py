from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class CrawlRequest(BaseModel):
    url: str


class CrawlResult(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    author: Optional[str] = None
    published_date: Optional[str] = None
    source_url: str
    success: bool
    method: str


class HighlightCreate(BaseModel):
    quoted_text: str
    color: str = "yellow"
    memo: Optional[str] = None


class HighlightUpdate(BaseModel):
    color: Optional[str] = None
    memo: Optional[str] = None


class HighlightResponse(BaseModel):
    id: int
    article_id: int
    quoted_text: str
    color: str
    memo: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TagCreate(BaseModel):
    name: str


class TagResponse(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None


class FolderResponse(BaseModel):
    id: int
    name: str
    parent_id: Optional[int] = None
    created_at: datetime
    article_count: int = 0

    model_config = {"from_attributes": True}


class ArticleCreate(BaseModel):
    title: str
    url: Optional[str] = None
    content: Optional[str] = None
    author: Optional[str] = None
    published_date: Optional[str] = None
    folder_id: Optional[int] = None
    is_favorite: bool = False
    tag_ids: List[int] = []


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    author: Optional[str] = None
    published_date: Optional[str] = None
    folder_id: Optional[int] = None
    is_favorite: Optional[bool] = None
    tag_ids: Optional[List[int]] = None


class TranslateRequest(BaseModel):
    target_language: str = "ko"


class ArticleResponse(BaseModel):
    id: int
    title: str
    url: Optional[str] = None
    content: Optional[str] = None
    author: Optional[str] = None
    published_date: Optional[str] = None
    folder_id: Optional[int] = None
    is_favorite: bool = False
    tags: List[TagResponse] = []
    translated_content: Optional[str] = None
    translated_language: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}