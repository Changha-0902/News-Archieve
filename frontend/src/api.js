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

export const listArticles = (folderId) => {
  const qs = folderId !== undefined && folderId !== null ? `?folder_id=${folderId}` : ''
  return request(`/articles${qs}`)
}

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