import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  crawlUrl, saveArticle, listArticles, updateArticle, deleteArticle,
  listFolders, createFolder, deleteFolder,
} from './api'

const stripMarkdown = (text) =>
  text?.replace(/[*_#>`~\[\]!]/g, '').replace(/\n+/g, ' ').trim() ?? ''

function buildTree(folders, parentId = null) {
  return folders
    .filter((f) => f.parent_id === parentId)
    .map((f) => ({ ...f, children: buildTree(folders, f.id) }))
}

function flattenForSelect(folders) {
  const tree = buildTree(folders)
  const result = []
  function walk(nodes, depth) {
    for (const node of nodes) {
      result.push({ id: node.id, name: node.name, depth })
      if (node.children?.length) walk(node.children, depth + 1)
    }
  }
  walk(tree, 0)
  return result
}

function FolderNode({ folder, depth, selectedFolder, onSelect, onDelete, onCreateFolder }) {
  const [expanded, setExpanded] = useState(true)
  const [showAddChild, setShowAddChild] = useState(false)
  const [childName, setChildName] = useState('')
  const hasChildren = folder.children?.length > 0

  const handleAddChild = async () => {
    if (!childName.trim()) return
    await onCreateFolder(childName.trim(), folder.id)
    setChildName('')
    setShowAddChild(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAddChild()
    if (e.key === 'Escape') { setShowAddChild(false); setChildName('') }
  }

  return (
    <>
      <div
        className={`sidebar-item ${selectedFolder === folder.id ? 'active' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => onSelect(folder.id)}
      >
        <span
          className="folder-toggle"
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
        >
          {expanded ? '▾' : '▸'}
        </span>
        <span className="sidebar-name">{folder.name}</span>
        <span className="sidebar-count">{folder.article_count}</span>
        <div className="folder-actions">
          <button
            className="folder-action-btn"
            onClick={(e) => { e.stopPropagation(); setShowAddChild((v) => !v); setChildName('') }}
            title="하위 폴더 추가"
          >+</button>
          <button
            className="folder-action-btn folder-action-delete"
            onClick={(e) => { e.stopPropagation(); onDelete(folder.id, folder.name) }}
            title="삭제"
          >✕</button>
        </div>
      </div>

      {showAddChild && (
        <div className="inline-folder-input" style={{ paddingLeft: 8 + (depth + 1) * 14 }}>
          <input
            className="new-folder-input"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="하위 폴더 이름"
            autoFocus
          />
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1, padding: '5px 0', fontSize: 11 }}
              onClick={handleAddChild}
              disabled={!childName.trim()}
            >추가</button>
            <button
              className="btn btn-outline"
              style={{ flex: 1, padding: '5px 0', fontSize: 11 }}
              onClick={() => { setShowAddChild(false); setChildName('') }}
            >취소</button>
          </div>
        </div>
      )}

      {expanded && hasChildren && folder.children.map((child) => (
        <FolderNode
          key={child.id}
          folder={child}
          depth={depth + 1}
          selectedFolder={selectedFolder}
          onSelect={onSelect}
          onDelete={onDelete}
          onCreateFolder={onCreateFolder}
        />
      ))}
    </>
  )
}

function FolderSidebar({ folders, selectedFolder, onSelect, onDelete, onCreateFolder }) {
  const [showInput, setShowInput] = useState(false)
  const [name, setName] = useState('')
  const tree = buildTree(folders)

  const handleCreate = async () => {
    if (!name.trim()) return
    await onCreateFolder(name.trim(), null)
    setName('')
    setShowInput(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleCreate()
    if (e.key === 'Escape') { setShowInput(false); setName('') }
  }

  return (
    <div className="sidebar">
      <p className="sidebar-header">컬렉션</p>

      <div
        className={`sidebar-item ${selectedFolder === null ? 'active' : ''}`}
        onClick={() => onSelect(null)}
      >
        <span className="sidebar-icon">◈</span>
        <span>전체</span>
      </div>

      <div
        className={`sidebar-item ${selectedFolder === -1 ? 'active' : ''}`}
        onClick={() => onSelect(-1)}
      >
        <span className="sidebar-icon">○</span>
        <span>미분류</span>
      </div>

      {folders.length > 0 && <div className="sidebar-divider" />}

      {tree.map((f) => (
        <FolderNode
          key={f.id}
          folder={f}
          depth={0}
          selectedFolder={selectedFolder}
          onSelect={onSelect}
          onDelete={onDelete}
          onCreateFolder={onCreateFolder}
        />
      ))}

      <div className="sidebar-divider" />

      {showInput ? (
        <div className="new-folder-form">
          <input
            className="new-folder-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="폴더 이름"
            autoFocus
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1, padding: '6px 0', fontSize: 12 }}
              onClick={handleCreate}
              disabled={!name.trim()}
            >추가</button>
            <button
              className="btn btn-outline"
              style={{ flex: 1, padding: '6px 0', fontSize: 12 }}
              onClick={() => { setShowInput(false); setName('') }}
            >취소</button>
          </div>
        </div>
      ) : (
        <button className="add-folder-btn" onClick={() => setShowInput(true)}>
          + 새 폴더
        </button>
      )}
    </div>
  )
}

function App() {
  const [view, setView] = useState('articles')
  const [url, setUrl] = useState('')
  const [crawling, setCrawling] = useState(false)
  const [crawlResult, setCrawlResult] = useState(null)
  const [form, setForm] = useState({
    title: '', content: '', author: '', published_date: '', folder_id: null,
  })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  const [folders, setFolders] = useState([])
  const [selectedFolder, setSelectedFolder] = useState(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [articles, setArticles] = useState([])
  const [loadingArticles, setLoadingArticles] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', content: '', author: '', published_date: '' })

  const loadFolders = useCallback(async () => {
    try { setFolders(await listFolders()) } catch (e) { console.error(e) }
  }, [])

  const loadArticles = useCallback(async (folderId, filters = {}) => {
    setLoadingArticles(true)
    try { setArticles(await listArticles(folderId, filters)) }
    catch (e) { console.error(e) }
    finally { setLoadingArticles(false) }
  }, [])

  useEffect(() => { loadFolders() }, [loadFolders])

  useEffect(() => {
    if (view === 'articles') loadArticles(selectedFolder, { q: searchQuery, dateFrom, dateTo })
  }, [view, selectedFolder, searchQuery, dateFrom, dateTo, loadArticles])

  useEffect(() => { setIsEditing(false) }, [selectedArticle?.id])

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
        folder_id: null,
      })
    } catch {
      setCrawlResult({ success: false, method: 'error', source_url: url.trim() })
      setForm({ title: '', content: '', author: '', published_date: '', folder_id: null })
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
        folder_id: form.folder_id || null,
      })
      setSaveMsg({ type: 'success', text: '보관함에 저장되었습니다!' })
      setTimeout(() => setSaveMsg(null), 3000)
      await loadFolders()
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
      await loadFolders()
    } catch (err) {
      console.error(err)
    }
  }

  const startEdit = () => {
    setEditForm({
      title: selectedArticle.title,
      content: selectedArticle.content || '',
      author: selectedArticle.author || '',
      published_date: selectedArticle.published_date || '',
    })
    setIsEditing(true)
  }

  const cancelEdit = () => setIsEditing(false)

  const handleEditSave = async () => {
    if (!editForm.title.trim()) return
    try {
      const updated = await updateArticle(selectedArticle.id, {
        title: editForm.title,
        content: editForm.content || null,
        author: editForm.author || null,
        published_date: editForm.published_date || null,
      })
      setSelectedArticle(updated)
      setArticles((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
      setIsEditing(false)
    } catch (err) {
      console.error(err)
    }
  }

  const handleMoveArticle = async (articleId, folderId) => {
    try {
      const updated = await updateArticle(articleId, { folder_id: folderId })
      setSelectedArticle(updated)
      // Remove from list if it no longer matches the current folder filter
      if (selectedFolder !== null && updated.folder_id !== selectedFolder) {
        setArticles((prev) => prev.filter((a) => a.id !== articleId))
        setSelectedArticle(null)
      } else {
        setArticles((prev) => prev.map((a) => (a.id === articleId ? updated : a)))
      }
      await loadFolders()
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateFolder = async (name, parentId = null) => {
    const folder = await createFolder(name, parentId)
    setFolders((prev) => [...prev, folder])
  }

  const handleDeleteFolder = async (id, name) => {
    if (!confirm(`"${name}" 폴더를 삭제하시겠습니까?\n폴더 안의 아티클은 미분류로 이동합니다.`)) return
    try {
      await deleteFolder(id)
      setFolders((prev) => prev.filter((f) => f.id !== id))
      if (selectedFolder === id) setSelectedFolder(null)
      else await loadArticles(selectedFolder)
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

  const folderLabel = (folderId) => {
    if (!folderId) return null
    return folders.find((f) => f.id === folderId)?.name ?? null
  }

  const badgeClass = crawlResult?.success
    ? 'badge-success'
    : crawlResult?.method === 'manual_required'
      ? 'badge-warning'
      : 'badge-danger'

  const badgeText = crawlResult?.success
    ? `✓ ${crawlResult.method}`
    : crawlResult?.method === 'manual_required'
      ? '⚠ 수동 입력 필요'
      : '✗ 크롤링 실패'

  const selectedFolderLabel =
    selectedFolder === null ? '전체' :
    selectedFolder === -1 ? '미분류' :
    (folders.find((f) => f.id === selectedFolder)?.name ?? '')

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

      {/* ── CRAWL VIEW ── */}
      {view === 'crawl' && (
        <main className="main-content">
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
                {crawling ? <><span className="spinner" /> 크롤링 중...</> : '가져오기'}
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
                <label className="form-label">폴더</label>
                <select
                  className="form-input"
                  value={form.folder_id ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      folder_id: e.target.value ? parseInt(e.target.value) : null,
                    }))
                  }
                >
                  <option value="">폴더 없음</option>
                  {flattenForSelect(folders).map(({ id, name: n, depth }) => (
                    <option key={id} value={id}>
                      {'\xa0\xa0'.repeat(depth)}{depth > 0 ? '└ ' : ''}{n}
                    </option>
                  ))}
                </select>
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
        </main>
      )}

      {/* ── ARTICLES VIEW ── */}
      {view === 'articles' && (
        <div className="app-layout">
          <FolderSidebar
            folders={folders}
            selectedFolder={selectedFolder}
            onSelect={(id) => { setSelectedFolder(id); setSelectedArticle(null) }}
            onDelete={handleDeleteFolder}
            onCreateFolder={handleCreateFolder}
          />

          <div className="layout-content">
            {/* List */}
            {!selectedArticle && (
              <div className="card">
                <p className="section-title">
                  {selectedFolderLabel}
                  {!loadingArticles && (
                    <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 8 }}>
                      ({articles.length})
                    </span>
                  )}
                </p>

                <div className="search-filter-bar">
                  <div className="search-input-wrap">
                    <span className="search-icon">&#x1F50D;</span>
                    <input
                      type="text"
                      className="search-input"
                      placeholder="제목 / 본문 검색"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>
                    )}
                  </div>
                  <div className="date-filter">
                    <input
                      type="date"
                      className="form-input date-input"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      title="발행일 시작"
                    />
                    <span className="date-sep">~</span>
                    <input
                      type="date"
                      className="form-input date-input"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      title="발행일 종료"
                    />
                  </div>
                  {(searchQuery || dateFrom || dateTo) && (
                    <button
                      className="btn btn-outline"
                      style={{ fontSize: 12, padding: '6px 12px' }}
                      onClick={() => { setSearchQuery(''); setDateFrom(''); setDateTo('') }}
                    >
                      초기화
                    </button>
                  )}
                </div>

                {loadingArticles && <div className="empty-state">불러오는 중...</div>}

                {!loadingArticles && articles.length === 0 && (
                  <div className="empty-state">
                    저장된 아티클이 없습니다.<br />
                    URL을 입력해서 첫 아티클을 추가해보세요!
                  </div>
                )}

                {!loadingArticles && articles.map((article) => (
                  <div
                    key={article.id}
                    className="article-list-item"
                    onClick={() => setSelectedArticle(article)}
                  >
                    <div className="article-item-top">
                      <h3>{article.title}</h3>
                      {article.folder_id && (
                        <span className="folder-badge">
                          {folderLabel(article.folder_id)}
                        </span>
                      )}
                    </div>
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
                      <p className="preview">{stripMarkdown(article.content)}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Detail */}
            {selectedArticle && (
              <div className="card">
                <div className="result-header">
                  <button
                    className="btn btn-outline"
                    style={{ fontSize: 12, padding: '5px 12px' }}
                    onClick={() => setSelectedArticle(null)}
                  >
                    ← 목록
                  </button>
                  {!isEditing && (
                    <div className="result-actions">
                      <select
                        className="form-input folder-move-select"
                        value={selectedArticle.folder_id ?? ''}
                        onChange={(e) =>
                          handleMoveArticle(
                            selectedArticle.id,
                            e.target.value ? parseInt(e.target.value) : null,
                          )
                        }
                        title="폴더 이동"
                      >
                        <option value="">폴더 없음</option>
                        {flattenForSelect(folders).map(({ id, name: n, depth }) => (
                          <option key={id} value={id}>
                            {'\xa0\xa0'.repeat(depth)}{depth > 0 ? '└ ' : ''}{n}
                          </option>
                        ))}
                      </select>
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
                        className="btn btn-outline"
                        style={{ fontSize: 12, padding: '5px 12px' }}
                        onClick={startEdit}
                      >
                        수정
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ fontSize: 12, padding: '5px 12px' }}
                        onClick={(e) => handleDelete(selectedArticle.id, e)}
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">제목</label>
                      <input
                        className="form-input"
                        value={editForm.title}
                        onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                        placeholder="제목을 입력하세요"
                      />
                    </div>
                    <div className="row">
                      <div className="form-group">
                        <label className="form-label">작성자</label>
                        <input
                          className="form-input"
                          value={editForm.author}
                          onChange={(e) => setEditForm((p) => ({ ...p, author: e.target.value }))}
                          placeholder="작성자"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">발행일</label>
                        <input
                          className="form-input"
                          value={editForm.published_date}
                          onChange={(e) => setEditForm((p) => ({ ...p, published_date: e.target.value }))}
                          placeholder="YYYY-MM-DD"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">본문 (Markdown)</label>
                      <textarea
                        className="form-textarea"
                        value={editForm.content}
                        onChange={(e) => setEditForm((p) => ({ ...p, content: e.target.value }))}
                        placeholder="본문을 입력하세요..."
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button className="btn btn-outline" onClick={cancelEdit}>취소</button>
                      <button
                        className="btn btn-success"
                        onClick={handleEditSave}
                        disabled={!editForm.title.trim()}
                      >
                        저장
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h1 className="article-title">{selectedArticle.title}</h1>
                    <div className="article-meta">
                      {selectedArticle.author && <span>{selectedArticle.author} · </span>}
                      {selectedArticle.published_date && (
                        <span>{selectedArticle.published_date} · </span>
                      )}
                      <span>
                        저장: {new Date(selectedArticle.created_at).toLocaleDateString('ko-KR')}
                      </span>
                      {selectedArticle.folder_id && (
                        <span> · 📁 {folderLabel(selectedArticle.folder_id)}</span>
                      )}
                    </div>
                    {selectedArticle.content ? (
                      <div className="article-content">
                        <ReactMarkdown>{selectedArticle.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="empty-state" style={{ padding: 24 }}>본문이 없습니다.</div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App