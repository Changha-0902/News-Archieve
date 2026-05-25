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


class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    author: Optional[str] = None
    published_date: Optional[str] = None
    folder_id: Optional[int] = None
    is_favorite: Optional[bool] = None


class ArticleResponse(BaseModel):
    id: int
    title: str
    url: Optional[str] = None
    content: Optional[str] = None
    author: Optional[str] = None
    published_date: Optional[str] = None
    folder_id: Optional[int] = None
    is_favorite: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}