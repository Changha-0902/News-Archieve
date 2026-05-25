const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    ...options,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `HTTP ${res.status}`)
  }
  return res.json()
}

export const crawlUrl = (url) =>
  request('/crawl', { method: 'POST', body: JSON.stringify({ url }) })

export const saveArticle = (article) =>
  request('/articles', { method: 'POST', body: JSON.stringify(article) })

export const listArticles = (folderId, filters = {}) => {
  const params = new URLSearchParams()
  if (folderId !== undefined && folderId !== null) params.set('folder_id', folderId)
  if (filters.q) params.set('q', filters.q)
  if (filters.dateFrom) params.set('date_from', filters.dateFrom)
  if (filters.dateTo) params.set('date_to', filters.dateTo)
  if (filters.isFavorite != null) params.set('is_favorite', filters.isFavorite)
  if (filters.tagId != null) params.set('tag_id', filters.tagId)
  const qs = params.toString()
  return request(`/articles${qs ? `?${qs}` : ''}`)
}

export const listTags = () => request('/tags')

export const createTag = (name) =>
  request('/tags', { method: 'POST', body: JSON.stringify({ name }) })

export const deleteTag = (id) =>
  request(`/tags/${id}`, { method: 'DELETE' })

export const listHighlights = (articleId) =>
  request(`/articles/${articleId}/highlights`)

export const createHighlight = (articleId, data) =>
  request(`/articles/${articleId}/highlights`, { method: 'POST', body: JSON.stringify(data) })

export const updateHighlight = (id, data) =>
  request(`/highlights/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteHighlight = (id) =>
  request(`/highlights/${id}`, { method: 'DELETE' })

export const getArticle = (id) => request(`/articles/${id}`)

export const updateArticle = (id, data) =>
  request(`/articles/${id}`, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteArticle = (id) =>
  request(`/articles/${id}`, { method: 'DELETE' })

export const listFolders = () => request('/folders')

export const createFolder = (name, parentId = null) =>
  request('/folders', { method: 'POST', body: JSON.stringify({ name, parent_id: parentId }) })

export const deleteFolder = (id) =>
  request(`/folders/${id}`, { method: 'DELETE' })