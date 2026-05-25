from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, inspect, text
from typing import List, Optional

import models
import schemas
from crawler import crawl_url
from database import engine, get_db


def run_migrations():
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    if "articles" in tables:
        cols = [c["name"] for c in inspector.get_columns("articles")]
        if "folder_id" not in cols:
            with engine.connect() as conn:
                conn.execute(text(
                    "ALTER TABLE articles ADD COLUMN folder_id INTEGER REFERENCES folders(id)"
                ))
                conn.commit()
    if "folders" in tables:
        cols = [c["name"] for c in inspector.get_columns("folders")]
        if "parent_id" not in cols:
            with engine.connect() as conn:
                conn.execute(text(
                    "ALTER TABLE folders ADD COLUMN parent_id INTEGER REFERENCES folders(id)"
                ))
                conn.commit()
    if "articles" in tables:
        cols = [c["name"] for c in inspector.get_columns("articles")]
        if "is_favorite" not in cols:
            with engine.connect() as conn:
                conn.execute(text(
                    "ALTER TABLE articles ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT 0"
                ))
                conn.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    models.Base.metadata.create_all(bind=engine)
    run_migrations()
    yield


app = FastAPI(title="News Archive API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/crawl", response_model=schemas.CrawlResult)
def crawl_article(req: schemas.CrawlRequest):
    return crawl_url(req.url)


# ── Folders ──────────────────────────────────────────────

@app.get("/api/folders", response_model=List[schemas.FolderResponse])
def list_folders(db: Session = Depends(get_db)):
    folders = db.query(models.Folder).order_by(models.Folder.created_at).all()
    result = []
    for f in folders:
        count = (
            db.query(func.count(models.Article.id))
            .filter(models.Article.folder_id == f.id)
            .scalar()
        )
        result.append(schemas.FolderResponse(
            id=f.id,
            name=f.name,
            parent_id=f.parent_id,
            created_at=f.created_at,
            article_count=count,
        ))
    return result


@app.post("/api/folders", response_model=schemas.FolderResponse)
def create_folder(folder: schemas.FolderCreate, db: Session = Depends(get_db)):
    name = folder.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Folder name cannot be empty")
    db_folder = models.Folder(name=name, parent_id=folder.parent_id)
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return schemas.FolderResponse(
        id=db_folder.id,
        name=db_folder.name,
        parent_id=db_folder.parent_id,
        created_at=db_folder.created_at,
        article_count=0,
    )


@app.delete("/api/folders/{folder_id}")
def delete_folder(folder_id: int, db: Session = Depends(get_db)):
    folder = db.query(models.Folder).filter(models.Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    db.query(models.Article).filter(models.Article.folder_id == folder_id).update(
        {"folder_id": None}
    )
    # Promote children to this folder's parent level
    db.query(models.Folder).filter(models.Folder.parent_id == folder_id).update(
        {"parent_id": folder.parent_id}
    )
    db.delete(folder)
    db.commit()
    return {"ok": True}


# ── Articles ─────────────────────────────────────────────

@app.post("/api/articles", response_model=schemas.ArticleResponse)
def create_article(article: schemas.ArticleCreate, db: Session = Depends(get_db)):
    db_article = models.Article(**article.model_dump())
    db.add(db_article)
    db.commit()
    db.refresh(db_article)
    return db_article


@app.get("/api/articles", response_model=List[schemas.ArticleResponse])
def list_articles(
    folder_id: Optional[int] = Query(None),
    q: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    is_favorite: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(models.Article)
    if folder_id == -1:
        query = query.filter(models.Article.folder_id == None)  # noqa: E711
    elif folder_id is not None:
        query = query.filter(models.Article.folder_id == folder_id)
    if is_favorite is not None:
        query = query.filter(models.Article.is_favorite == is_favorite)
    if q:
        pattern = f"%{q}%"
        query = query.filter(
            models.Article.title.ilike(pattern) | models.Article.content.ilike(pattern)
        )
    if date_from:
        query = query.filter(models.Article.published_date >= date_from)
    if date_to:
        query = query.filter(models.Article.published_date <= date_to)
    return query.order_by(models.Article.created_at.desc()).all()


@app.get("/api/articles/{article_id}", response_model=schemas.ArticleResponse)
def get_article(article_id: int, db: Session = Depends(get_db)):
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article


@app.patch("/api/articles/{article_id}", response_model=schemas.ArticleResponse)
def update_article(
    article_id: int,
    update: schemas.ArticleUpdate,
    db: Session = Depends(get_db),
):
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(article, field, value)
    db.commit()
    db.refresh(article)
    return article


@app.delete("/api/articles/{article_id}")
def delete_article(article_id: int, db: Session = Depends(get_db)):
    article = db.query(models.Article).filter(models.Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    db.delete(article)
    db.commit()
    return {"ok": True}