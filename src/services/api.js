const TOKEN_KEY = 'fieldnotes-token'
export const session = {
  get token() { return localStorage.getItem(TOKEN_KEY) || '' },
  set token(value) { value ? localStorage.setItem(TOKEN_KEY, value) : localStorage.removeItem(TOKEN_KEY) },
}
export class ApiError extends Error {
  constructor(message, status, fields) { super(message); this.status = status; this.fields = fields }
}
const baseURL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
export async function request(path, { method = 'GET', body, auth = true } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  const token = auth ? session.token : ''
  try {
    const response = await fetch(`${baseURL}${path}`, {
      method, signal: controller.signal,
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    let result
    try { result = await response.json() } catch { throw new ApiError(response.ok ? '接口未返回有效 JSON 数据' : `服务暂不可用（${response.status}），请稍后重试`, response.status) }
    if (!response.ok || result.code >= 400) {
      if (response.status === 401 && token && session.token === token) {
        session.token = ''; window.dispatchEvent(new Event('session-expired'))
      }
      const fields = result.data && typeof result.data === 'object' ? Object.values(result.data).join('；') : ''
      throw new ApiError(fields || result.message || '请求失败，请重试', response.status, result.data)
    }
    return result.data
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(error.name === 'AbortError' ? '请求超时，请稍后重试' : '暂时无法连接博客服务，请稍后重试', 0)
  } finally { clearTimeout(timeout) }
}
export const api = {
  login: (body) => request('/user/login', { method: 'POST', body, auth: false }),
  register: (body) => request('/user/register', { method: 'POST', body, auth: false }),
  me: () => request('/user/me'), logout: () => request('/user/logout', { method: 'POST' }),
  list: (resource, query = '') => request(`/${resource}${query}`, { auth: !['categories', 'tags', 'links'].includes(resource) }),
  get: (resource, id) => request(`/${resource}/${encodeURIComponent(id)}`),
  create: (resource, body) => request(`/${resource}`, { method: 'POST', body }),
  update: (resource, id, body) => request(`/${resource}/${encodeURIComponent(id)}`, { method: 'PUT', body }),
  remove: (resource, id) => request(`/${resource}/${id}`, { method: 'DELETE' }),
}
