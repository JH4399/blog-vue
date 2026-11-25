import { reportError } from './errors'
import { readPage } from './pagination'
import { imageUrl, validateImage } from '../utils/images'
import { profilePayload } from '../utils/user'

const TOKEN_KEY = 'fieldnotes-token'
export const session = {
  get token() { return localStorage.getItem(TOKEN_KEY) || '' },
  set token(value) { value ? localStorage.setItem(TOKEN_KEY, value) : localStorage.removeItem(TOKEN_KEY) },
}
export class ApiError extends Error {
  constructor(message, status, fields) { super(message); this.status = status; this.fields = fields }
}
const baseURL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
export async function request(path, { method = 'GET', body, auth = true, silentNotFound = false, timeoutMs = 12000 } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  let token = ''
  try {
    token = auth ? session.token : ''
    const multipart = body instanceof FormData
    const response = await fetch(`${baseURL}${path}`, {
      method, signal: controller.signal,
      headers: { Accept: 'application/json', ...(body !== undefined && !multipart ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: multipart ? body : JSON.stringify(body) } : {}),
    })
    let result
    try { result = await response.json() } catch { throw new ApiError(response.ok ? '接口未返回有效 JSON 数据' : `服务暂不可用（${response.status}），请稍后重试`, response.status) }
    if (!result || typeof result !== 'object' || Array.isArray(result) || typeof result.code !== 'number') {
      throw new ApiError('接口返回的数据格式不正确，请检查后端服务。', response.status)
    }
    if (!response.ok || result.code >= 400) {
      if (response.status === 401 && token && session.token === token) {
        session.token = ''; window.dispatchEvent(new Event('session-expired'))
      }
      const fields = result.data && typeof result.data === 'object' ? Object.values(result.data).filter(value => typeof value === 'string').join('；') : ''
      throw new ApiError(fields || result.message || '请求失败，请重试', response.status, result.data)
    }
    return result.data
  } catch (error) {
    const failure = error instanceof ApiError ? error : new ApiError(error.name === 'AbortError' ? '请求超时，请稍后重试' : error.name === 'SecurityError' || error.name === 'QuotaExceededError' ? '无法访问浏览器本地存储，请检查浏览器设置。' : '暂时无法连接博客服务，请稍后重试', 0)
    if (!(silentNotFound && failure.status === 404)) reportError(failure)
    throw failure
  } finally { clearTimeout(timeout) }
}
export const api = {
  uploadImage: async file => {
    try {
      validateImage(file)
      const body = new FormData()
      body.append('file', file)
      const image = await request('/uploads/images', { method: 'POST', body, timeoutMs: 60000 })
      if (!imageUrl(image?.url)) throw new ApiError('图片接口未返回有效的访问地址，请重试。', 502)
      return image
    } catch (error) { reportError(error); throw error }
  },
  readPost: async (id, { privatePreview = false } = {}) => {
    if (privatePreview && session.token) return api.get('posts', id)
    const authenticated = !!session.token
    try { return await request(`/public/posts/${encodeURIComponent(id)}`, { silentNotFound: authenticated }) }
    catch (error) {
      // Direct draft/private links have no list row from which to infer status.
      if (authenticated && error.status === 404 && session.token) return api.get('posts', id)
      reportError(error); throw error
    }
  },
  adminSummary: () => request('/posts/summary'),
  adminUsers: () => api.list('users'),
  updateProfile: (id, body) => request(`/user/${encodeURIComponent(id)}`, { method: 'PUT', body: profilePayload(body) }),
  updateUserStatus: (id, { status }) => request(`/user/${encodeURIComponent(id)}/status`, { method: 'PUT', body: { status } }),
  login: (body) => request('/user/login', { method: 'POST', body, auth: false }),
  register: (body) => request('/user/register', { method: 'POST', body, auth: false }),
  me: () => request('/user/me'), logout: () => request('/user/logout', { method: 'POST' }),
  list: async (resource, parameters = '') => {
    let query = parameters
    if (parameters && typeof parameters === 'object') {
      const search = new URLSearchParams()
      for (const [key, value] of Object.entries({ page: 1, size: 10, ...parameters })) {
        if (value !== '' && value !== null && value !== undefined) search.set(key, String(value))
      }
      query = '?' + search
    }
    const path = resource === 'users' ? 'user' : resource
    const data = await request('/' + path + query, { auth: !['categories', 'tags', 'links'].includes(resource) })
    try {
      if (['posts', 'users', 'categories', 'tags', 'links', 'settings'].includes(resource)) return readPage(data)
      // Comments and article-tag associations still return arrays.
      if (!Array.isArray(data)) throw new Error('列表返回格式不正确，应为数组。')
      return data
    } catch (error) { reportError(error); throw error }
  },
  get: (resource, id) => request(`/${resource}/${encodeURIComponent(id)}`),
  create: (resource, body) => request(`/${resource}`, { method: 'POST', body }),
  update: (resource, id, body) => request(`/${resource}/${encodeURIComponent(id)}`, { method: 'PUT', body }),
  remove: (resource, id) => request(`/${resource}/${id}`, { method: 'DELETE' }),
}
