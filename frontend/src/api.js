const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
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

export const listArticles = () => request('/articles')

export const getArticle = (id) => request(`/articles/${id}`)

export const deleteArticle = (id) =>
  request(`/articles/${id}`, { method: 'DELETE' })
