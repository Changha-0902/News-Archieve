import { useState, useEffect, useCallback } from 'react'
import { crawlUrl, saveArticle, listArticles, deleteArticle } from './api'

function App() {
  const [view, setView] = useState('crawl')
  const [url, setUrl] = useState('')
  const [crawling, setCrawling] = useState(false)
  const [crawlResult, setCrawlResult] = useState(null)
  const [form, setForm] = useState({ title: '', content: '', author: '', published_date: '' })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [articles, setArticles] = useState([])
  const [loadingArticles, setLoadingArticles] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState(null)

  const loadArticles = useCallback(async () => {
    setLoadingArticles(true)
    try {
      setArticles(await listArticles())
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingArticles(false)
    }
  }, [])

  useEffect(() => {
    if (view === 'articles') loadArticles()
  }, [view, loadArticles])

  const handleCrawl = async (e) => {
    e.preventDefault()
    if (!url.trim()) return
    setCrawling(true)
    setCrawlResult(null)
    setSaveMsg(null)
    try {
      const result = await crawlUrl(url.trim())
      setCrawlResult(result)
      setForm({
        title: result.title || '',
        content: result.content || '',
        author: result.author || '',
        published_date: result.published_date || '',
      })
    } catch {
      setCrawlResult({ success: false, method: 'error', source_url: url.trim() })
      setForm({ title: '', content: '', author: '', published_date: '' })
    } finally {
      setCrawling(false)
    }
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    setSaveMsg(null)
    try {
      await saveArticle({
        title: form.title,
        content: form.content || null,
        author: form.author || null,
        published_date: form.published_date || null,
        url: crawlResult?.source_url || url || null,
      })
      setSaveMsg({ type: 'success', text: '보관함에 저장되었습니다!' })
      setTimeout(() => setSaveMsg(null), 3000)
    } catch {
      setSaveMsg({ type: 'error', text: '저장에 실패했습니다. 다시 시도해주세요.' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id, e) => {
    e?.stopPropagation()
    if (!confirm('삭제하시겠습니까?')) return
    try {
      await deleteArticle(id)
      setArticles((prev) => prev.filter((a) => a.id !== id))
      if (selectedArticle?.id === id) setSelectedArticle(null)
    } catch (err) {
      console.error(err)
    }
  }

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const switchView = (v) => {
    setView(v)
    setSelectedArticle(null)
  }

  const badgeClass =
    crawlResult?.success
      ? 'badge-success'
      : crawlResult?.method === 'manual_required'
        ? 'badge-warning'
        : 'badge-danger'

  const badgeText =
    crawlResult?.success
      ? `✓ ${crawlResult.method}`
      : crawlResult?.method === 'manual_required'
        ? '⚠ 수동 입력 필요'
        : '✗ 크롤링 실패'

  return (
    <div>
      <header className="app-header">
        <h1>News Archive</h1>
        <nav>
          <button
            className={`nav-btn ${view === 'crawl' ? 'active' : ''}`}
            onClick={() => switchView('crawl')}
          >
            + 새 아티클
          </button>
          <button
            className={`nav-btn ${view === 'articles' ? 'active' : ''}`}
            onClick={() => switchView('articles')}
          >
            보관함
          </button>
        </nav>
      </header>

      <main className="main-content">
        {/* ── CRAWL VIEW ── */}
        {view === 'crawl' && (
          <>
            <div className="card">
              <p className="section-title">URL로 아티클 가져오기</p>
              <form className="url-form" onSubmit={handleCrawl}>
                <input
                  className="url-input"
                  type="url"
                  placeholder="https://example.com/article"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={crawling}
                />
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={crawling || !url.trim()}
                >
                  {crawling ? (
                    <><span className="spinner" /> 크롤링 중...</>
                  ) : (
                    '가져오기'
                  )}
                </button>
              </form>
            </div>

            {crawlResult && (
              <div className="card">
                <div className="result-header">
                  <h2>결과</h2>
                  <span className={`badge ${badgeClass}`}>{badgeText}</span>
                </div>

                {crawlResult.method === 'error' && (
                  <div className="alert alert-error">
                    페이지를 불러오지 못했습니다. URL을 확인하거나 내용을 직접 입력해주세요.
                  </div>
                )}
                {crawlResult.method === 'manual_required' && (
                  <div className="alert alert-warning">
                    일부 메타데이터만 가져왔습니다. 본문을 직접 붙여넣어 주세요.
                  </div>
                )}
                {saveMsg && (
                  <div className={`alert alert-${saveMsg.type}`}>{saveMsg.text}</div>
                )}

                <div className="form-group">
                  <label className="form-label">제목</label>
                  <input
                    className="form-input"
                    value={form.title}
                    onChange={update('title')}
                    placeholder="제목을 입력하세요"
                  />
                </div>

                <div className="row">
                  <div className="form-group">
                    <label className="form-label">작성자</label>
                    <input
                      className="form-input"
                      value={form.author}
                      onChange={update('author')}
                      placeholder="작성자"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">발행일</label>
                    <input
                      className="form-input"
                      value={form.published_date}
                      onChange={update('published_date')}
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">본문</label>
                  <textarea
                    className="form-textarea"
                    value={form.content}
                    onChange={update('content')}
                    placeholder="본문을 입력하거나 편집하세요..."
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    className="btn btn-outline"
                    onClick={() => { setCrawlResult(null); setUrl('') }}
                  >
                    초기화
                  </button>
                  <button
                    className="btn btn-success"
                    onClick={handleSave}
                    disabled={saving || !form.title.trim()}
                  >
                    {saving ? '저장 중...' : '보관함에 저장'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── ARTICLES LIST VIEW ── */}
        {view === 'articles' && !selectedArticle && (
          <div className="card">
            <p className="section-title">
              보관함 ({loadingArticles ? '…' : articles.length})
            </p>

            {loadingArticles && <div className="empty-state">불러오는 중...</div>}

            {!loadingArticles && articles.length === 0 && (
              <div className="empty-state">
                저장된 아티클이 없습니다.<br />
                URL을 입력해서 첫 아티클을 추가해보세요!
              </div>
            )}

            {!loadingArticles &&
              articles.map((article) => (
                <div
                  key={article.id}
                  className="article-list-item"
                  onClick={() => setSelectedArticle(article)}
                >
                  <h3>{article.title}</h3>
                  <div className="meta">
                    {article.author && <span>{article.author} · </span>}
                    {article.published_date && <span>{article.published_date} · </span>}
                    <span>저장: {new Date(article.created_at).toLocaleDateString('ko-KR')}</span>
                    {article.url && (
                      <span>
                        {' · '}
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          원문
                        </a>
                      </span>
                    )}
                  </div>
                  {article.content && (
                    <p className="preview">{article.content}</p>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* ── ARTICLE DETAIL VIEW ── */}
        {view === 'articles' && selectedArticle && (
          <div className="card">
            <div className="result-header">
              <button
                className="btn btn-outline"
                style={{ fontSize: 12, padding: '5px 12px' }}
                onClick={() => setSelectedArticle(null)}
              >
                ← 목록
              </button>
              <div className="result-actions">
                {selectedArticle.url && (
                  <a
                    href={selectedArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline"
                    style={{ fontSize: 12, padding: '5px 12px', textDecoration: 'none' }}
                  >
                    원문 보기
                  </a>
                )}
                <button
                  className="btn btn-danger"
                  style={{ fontSize: 12, padding: '5px 12px' }}
                  onClick={(e) => handleDelete(selectedArticle.id, e)}
                >
                  삭제
                </button>
              </div>
            </div>

            <h1 className="article-title">{selectedArticle.title}</h1>
            <div className="article-meta">
              {selectedArticle.author && <span>{selectedArticle.author} · </span>}
              {selectedArticle.published_date && <span>{selectedArticle.published_date} · </span>}
              <span>저장: {new Date(selectedArticle.created_at).toLocaleDateString('ko-KR')}</span>
            </div>

            {selectedArticle.content ? (
              <div className="article-content">{selectedArticle.content}</div>
            ) : (
              <div className="empty-state" style={{ padding: 24 }}>본문이 없습니다.</div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
