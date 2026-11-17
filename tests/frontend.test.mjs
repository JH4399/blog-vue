import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { markdown, headings } from '../src/utils/markdown.js'
import { safeUrl, hostname } from '../src/utils/format.js'

const storage = new Map()
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) }
globalThis.window = new EventTarget()
const originalFetch = globalThis.fetch
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
after(async () => { globalThis.fetch = originalFetch; await server.close() })
const { api, session, request } = await server.ssrLoadModule('/src/services/api.js')
const { useBlogStore } = await server.ssrLoadModule('/src/stores/blog.js')
const response = (data, status = 200) => new Response(JSON.stringify({ code: status, message: '操作成功', data }), { status, headers: { 'Content-Type': 'application/json' } })

test('API uses the backend envelope, paths, Bearer authentication and complete JSON bodies', async () => {
  const calls = []
  session.token = 'test-token'
  globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return response({ id: 7 }) }
  const body = { title: '文章', slug: 'story', content: '# 正文', summary: null, categoryId: null, coverImage: null, status: 2, isTop: 0 }
  assert.deepEqual(await api.update('posts', 7, body), { id: 7 })
  assert.equal(calls[0].url, '/api/posts/7')
  assert.equal(calls[0].method, 'PUT')
  assert.equal(calls[0].headers.Authorization, 'Bearer test-token')
  assert.deepEqual(JSON.parse(calls[0].body), body)
  await api.list('links', '?status=1')
  assert.equal(calls[1].url, '/api/links?status=1')
  assert.equal(calls[1].headers.Authorization, undefined)
  await api.login({ username: 'alice', password: 'secret' })
  assert.equal(calls[2].url, '/api/user/login')
  assert.equal(calls[2].headers.Authorization, undefined)
  await api.remove('post-tags', '7/2')
  assert.equal(calls[3].url, '/api/post-tags/7/2')
  assert.equal(calls[3].method, 'DELETE')
  session.token = ''
})

test('expired sessions clear tokens; failed login does not revoke an existing session', async () => {
  let expired = 0
  const onExpired = () => expired++
  window.addEventListener('session-expired', onExpired)
  session.token = 'old-token'
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 401, message: '登录已过期', data: null }), { status: 401 })
  await assert.rejects(api.login({ username: 'alice', password: 'wrong' }), /登录已过期/)
  assert.equal(session.token, 'old-token')
  assert.equal(expired, 0)
  await assert.rejects(api.me(), /登录已过期/)
  assert.equal(session.token, '')
  assert.equal(expired, 1)
  window.removeEventListener('session-expired', onExpired)
})

test('validation, non-JSON service errors and network failures are readable', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 400, message: '参数错误', data: { slug: '别名不能为空' } }), { status: 400 })
  await assert.rejects(api.create('posts', {}), /别名不能为空/)
  globalThis.fetch = async () => new Response('Bad gateway', { status: 502 })
  await assert.rejects(request('/posts'), /502/)
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
  await assert.rejects(request('/posts'), /无法连接博客服务/)
})

test('Markdown renders headings, code, lists and safe links without executing supplied HTML', () => {
  const source = '# 文章\n\n<script>alert(1)</script>\n\n- 第一点\n- 第二点\n\n```js\n# not a heading\nconst x = "<img onerror=alert(1)>"\n```\n\n## 尾声\n\n[阅读](https://example.com/?a=1&b=2)\n\n[危险](javascript:alert(1))'
  const html = markdown(source)
  assert.match(html, /<h1 id="heading-0">文章<\/h1>/)
  assert.match(html, /<ul>/)
  assert.match(html, /<pre><code/)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /href="https:\/\/example.com\/\?a=1&amp;b=2"/)
  assert.doesNotMatch(html, /<script|<img|href="javascript:/i)
  assert.deepEqual(headings(source).map(h => h.id), ['heading-0', 'heading-1'])
  assert.match(html, /id="heading-1"/)
  assert.equal(safeUrl('javascript:alert(1)'), '')
  assert.equal(safeUrl('https://'), '')
  assert.equal(hostname('https://example.com/path'), 'example.com')
})

test('demo is explicit, real login replaces sample data, and logout revokes server token', async () => {
  const pinia = createPinia(); setActivePinia(pinia)
  const blog = useBlogStore()
  session.token = ''
  globalThis.fetch = async () => response([])
  await blog.initialize()
  assert.equal(blog.demo, false)
  assert.equal(blog.canRead, false)
  assert.deepEqual(blog.posts, [])
  await blog.setDemo(true)
  assert.equal(blog.demo, true)
  assert.equal(blog.posts.length, 5)
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options })
    if (url.endsWith('/login')) return response({ accessToken: 'real-token', user: { id: 8, username: 'writer', role: 1 } })
    if (url === '/api/posts') return response([{ id: 20, title: '真实文章', status: 0, userId: 8 }])
    return response([])
  }
  await blog.login({ username: 'writer', password: 'password' })
  assert.equal(blog.demo, false)
  assert.equal(blog.posts.length, 1)
  assert.equal(blog.posts[0].title, '真实文章')
  assert.equal(blog.user.id, 8)
  assert.equal(await blog.logout(), true)
  assert.equal(calls.find(call => call.url === '/api/user/logout').headers.Authorization, 'Bearer real-token')
  assert.equal(blog.user, null)
  assert.equal(blog.posts.length, 0)
  assert.equal(session.token, '')
})

test('public Vue pages render sample content with working template helpers', async () => {
  const pinia = createPinia(); setActivePinia(pinia)
  const blog = useBlogStore()
  globalThis.fetch = async () => response([])
  await blog.initialize(); await blog.setDemo(true)
  for (const [file, path, name, expected] of [
    ['HomeView', '/', 'home', '记录生活的切片'],
    ['LinksView', '/links', 'links', 'developer.mozilla.org'],
    ['ArchiveView', '/archive', 'archive', '在快节奏的世界里'],
    ['AboutView', '/about', 'about', '你好，这里是'],
    ['AuthView', '/register', 'register', '创建账户'],
  ]) {
    const component = (await server.ssrLoadModule(`/src/views/${file}.vue`)).default
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path, name, component }, ...[['/login', 'login'], ['/register', 'register']].filter(([, routeName]) => routeName !== name).map(([routePath, routeName]) => ({ path: routePath, name: routeName, component: { render: () => null } })), { path: '/:all(.*)', component: { render: () => null } }] })
    await router.push(path); await router.isReady()
    const app = createSSRApp(component); app.use(pinia); app.use(router)
    const warnings = []; app.config.warnHandler = warning => warnings.push(warning)
    const html = await renderToString(app)
    assert.ok(html.includes(expected), `${file} should contain ${expected}`)
    assert.deepEqual(warnings, [], `${file} should render without Vue warnings`)
  }
})
