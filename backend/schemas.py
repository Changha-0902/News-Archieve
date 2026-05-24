from pydantic import BaseModel
from typing import Optional
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


class ArticleCreate(BaseModel):
    title: str
    url: Optional[str] = None
    content: Optional[str] = None
    author: Optional[str] = None
    published_date: Optional[str] = None


class ArticleResponse(BaseModel):
    id: int
    title: str
    url: Optional[str] = None
    content: Optional[str] = None
    author: Optional[str] = None
    published_date: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
