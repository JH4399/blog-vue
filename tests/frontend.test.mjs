import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { markdown, headings } from '../src/utils/markdown.js'
import { safeUrl, hostname } from '../src/utils/format.js'
import { imageUrl, imageMarkdown, MAX_IMAGE_BYTES } from '../src/utils/images.js'

const storage = new Map()
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) }
globalThis.window = new EventTarget()
const originalFetch = globalThis.fetch
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
after(async () => { globalThis.fetch = originalFetch; await server.close() })
const { api, session, request } = await server.ssrLoadModule('/src/services/api.js')
const { reportError, errorEntries, dismissErrors, dismissError, NOTICE_DURATION, installErrorHandlers } = await server.ssrLoadModule('/src/services/errors.js')
beforeEach(() => { dismissErrors(); globalThis.window = new EventTarget() })
const { useBlogStore } = await server.ssrLoadModule('/src/stores/blog.js')
const pageData = (records, total = records.length, page = 1) => ({ records, total, page, size: 10, pages: Math.ceil(total / 10) })
const response = (data, status = 200) => new Response(JSON.stringify({ code: status, message: '操作成功', data }), { status, headers: { 'Content-Type': 'application/json' } })

test('API uses the backend envelope, paths, Bearer authentication and complete JSON bodies', async () => {
  const calls = []
  session.token = 'test-token'
  globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return response(options.method === 'GET' ? pageData([]) : { id: 7 }) }
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

test('image uploads send an authenticated multipart file, validate limits and preserve API errors', async () => {
  const calls = [], file = new File(['image-bytes'], '示例.png', { type: 'image/png' })
  const image = { url: '/api/images/2026/11/sample.png', originalName: file.name, size: file.size, width: 1, height: 1 }
  session.token = 'upload-token'
  globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return response(image, 201) }
  assert.deepEqual(await api.uploadImage(file), image)
  assert.equal(calls[0].url, '/api/uploads/images')
  assert.equal(calls[0].method, 'POST')
  assert.equal(calls[0].headers.Authorization, 'Bearer upload-token')
  assert.equal(calls[0].headers['Content-Type'], undefined, 'the browser must supply the multipart boundary')
  assert.ok(calls[0].body instanceof FormData)
  assert.deepEqual([...calls[0].body.keys()], ['file'])
  assert.equal(await calls[0].body.get('file').text(), 'image-bytes')
  for (const invalid of [new File(['gif'], 'a.gif', { type: 'image/gif' }), new File([], 'empty.png', { type: 'image/png' }), new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'large.png', { type: 'image/png' })]) {
    dismissErrors()
    await assert.rejects(api.uploadImage(invalid))
    assert.equal(calls.length, 1, 'invalid files never reach the backend')
    assert.equal(errorEntries.value.length, 1)
  }
  dismissErrors()
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 415, message: '实际文件格式不支持', data: null }), { status: 415 })
  await assert.rejects(api.uploadImage(file), /实际文件格式不支持/)
  assert.equal(errorEntries.value.length, 1)
  dismissErrors()
  globalThis.fetch = async () => response({ url: 'javascript:alert(1)' }, 201)
  await assert.rejects(api.uploadImage(file), /有效的访问地址/)
  assert.equal(errorEntries.value.length, 1)
  dismissErrors()
  globalThis.fetch = async () => response(null, 401)
  await assert.rejects(api.uploadImage(file))
  assert.equal(session.token, '')
  assert.equal(errorEntries.value.length, 1)
})

test('uploaded images resolve against the configured API and render safe Markdown in preview and reading', () => {
  const path = '/api/images/2026/11/sample.png'
  assert.equal(imageUrl(path), path)
  assert.equal(imageUrl(path, 'https://backend.example/api/'), 'https://backend.example/api/images/2026/11/sample.png')
  assert.equal(imageUrl(path, '/backend/api'), '/backend/api/images/2026/11/sample.png')
  assert.equal(imageUrl('https://cdn.example/image.png'), 'https://cdn.example/image.png')
  for (const unsafe of ['javascript:alert(1)', 'data:image/svg+xml,bad', '//evil.example/a.png', '/api/images/../a.png', '/other.png', '/\\evil.example/a.png']) assert.equal(imageUrl(unsafe), '')
  const html = markdown(`![封面](${path})\n\n![远程](https://cdn.example/a.png?x=1&y=2)\n\n![\" onerror=\"alert(1)](${path})\n\n![危险](javascript:alert(1))\n\n![危险](data:image/svg+xml,bad)\n\n\u0060![代码](${path})\u0060\n\n\u0060\u0060\u0060\n![代码块](${path})\n\u0060\u0060\u0060`)
  assert.match(html, /<img src="\/api\/images\/2026\/11\/sample.png" alt="封面"/)
  assert.match(html, /src="https:\/\/cdn.example\/a.png\?x=1&amp;y=2"/)
  assert.match(html, /alt="&quot; onerror=&quot;alert\(1\)"/)
  assert.equal((html.match(/<img /g) || []).length, 3, 'code and unsafe sources do not produce images')
  assert.doesNotMatch(html, /<img[^>]+src="(?:javascript:|data:)|" onerror="/)
  assert.match(html, /<code>!\[代码\]/)
  const inserted = imageMarkdown({ url: 'https://cdn.example/a (1).png', originalName: '名字[1]<>.png' })
  assert.equal(inserted, '![名字1.png](https://cdn.example/a%20%281%29.png)')
  assert.match(markdown(inserted), /<img /)
})

test('article cards render uploaded relative cover paths and reject unsafe image addresses', async () => {
  const component = (await server.ssrLoadModule('/src/components/PostCard.vue')).default
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:all(.*)', component: { render: () => null } }] })
  await router.push('/'); await router.isReady()
  for (const [coverImage, visible] of [['/api/images/2026/11/cover.png', true], ['https://cdn.example/cover.png', true], ['', false], ['javascript:alert(1)', false]]) {
    const app = createSSRApp(component, { post: { id: 7, title: '封面路径验证', status: 1, coverImage } })
    app.use(router)
    const html = await renderToString(app)
    assert.equal(html.includes('card-cover-link'), visible)
    assert.equal(html.includes('<img '), visible)
    if (visible) assert.ok(html.includes(`src="${coverImage}"`))
  }
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
  globalThis.fetch = async () => response(pageData([]))
  await blog.initialize()
  assert.equal(blog.demo, false)
  assert.equal(blog.user, null)
  assert.deepEqual(blog.posts, [])
  await blog.setDemo(true)
  assert.equal(blog.demo, true)
  assert.equal(blog.posts.length, 5)
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options })
    if (url.endsWith('/login')) return response({ accessToken: 'real-token', user: { id: 8, username: 'writer', role: 1 } })
    if (url.startsWith('/api/posts?')) return response(pageData([{ id: 20, title: '真实文章', status: 0, userId: 8 }]))
    return response(pageData([]))
  }
  await blog.login({ username: 'writer', password: 'password' })
  assert.equal(blog.demo, false)
  assert.equal(blog.posts.length, 0, 'login clears sample articles and leaves list loading to the destination page')
  assert.equal(calls.filter(call => call.url.startsWith('/api/posts?')).length, 0)
  await blog.loadPosts()
  assert.equal(blog.posts.length, 1)
  assert.equal(blog.posts[0].title, '真实文章')
  assert.equal(blog.user.id, 8)
  assert.equal(await blog.logout(), true)
  assert.equal(calls.find(call => call.url === '/api/user/logout').headers.Authorization, 'Bearer real-token')
  assert.equal(blog.user, null)
  assert.equal(blog.posts.length, 0)
  assert.equal(session.token, '')
})

test('guest and authenticated article lists share posts with optional auth and reject late private responses after logout', async () => {
  setActivePinia(createPinia());
  const blog = useBlogStore(), calls = [];
  const published = { id: 7, title: '游客可读文章', status: 1 };
  session.token = '';
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options });
    const page = Number(new URL(url, 'http://blog').searchParams.get('page')) || 1;
    return response(pageData([published], 21, page));
  };
  await blog.loadPosts({ page: 2, q: '公开', categoryId: 3, tagId: 4, status: 0 });
  const guestCall = calls[0], query = new URL(guestCall.url, 'http://blog');
  assert.equal(query.pathname, '/api/posts');
  assert.equal(query.searchParams.get('status'), '1');
  assert.equal(query.searchParams.get('tagId'), '4');
  assert.equal(query.searchParams.get('q'), '公开');
  assert.equal(guestCall.headers.Authorization, undefined, 'guest lists do not send an Authorization header');
  assert.equal(blog.postPagination.page, 2);
  assert.equal(blog.postPagination.total, 21);
  let resolvePrivate;
  session.token = 'stored-token';
  blog.user = { id: 8, role: 1 };
  globalThis.fetch = (url, options) => {
    calls.push({ url, ...options });
    if (url.startsWith('/api/posts?') && options.headers.Authorization) return new Promise(resolve => { resolvePrivate = resolve; });
    return Promise.resolve(response(url.endsWith('/logout') ? null : pageData([published])));
  };
  const privateRequest = blog.loadPosts({ page: 1, status: 0 });
  assert.equal(calls.at(-1).headers.Authorization, 'Bearer stored-token');
  assert.equal(await blog.logout(), true);
  assert.deepEqual(blog.posts, []);
  await blog.loadPosts();
  resolvePrivate(response(pageData([{ id: 9, title: '私密文章', status: 2 }])));
  await privateRequest;
  assert.deepEqual(blog.posts, [published]);
  assert.equal(blog.loading, false);
  assert.equal(calls.at(-1).url.startsWith('/api/posts?'), true);
  assert.equal(calls.at(-1).headers.Authorization, undefined);
  assert.equal(calls.some(call => call.url.startsWith('/api/public/posts?')), false);
  assert.equal(errorEntries.value.length, 0);
});

test('guest home and archive show published article links and pagination without a login gate', async () => {
  const pinia = createPinia(); setActivePinia(pinia);
  const blog = useBlogStore(); session.token = '';
  globalThis.fetch = async url => response(url.startsWith('/api/posts?')
    ? pageData([{ id: 7, title: '游客公开文章', status: 1, createdAt: '2026-11-17T12:00:00' }], 21)
    : pageData([]));
  await blog.initialize(); await blog.loadPosts();
  for (const [file, path] of [['HomeView', '/'], ['ArchiveView', '/archive']]) {
    const component = (await server.ssrLoadModule(`/src/views/${file}.vue`)).default;
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path, component }, { path: '/:all(.*)', component: { render: () => null } }] });
    await router.push(path); await router.isReady();
    const app = createSSRApp(component); app.use(pinia); app.use(router);
    const html = await renderToString(app);
    assert.match(html, /游客公开文章/);
    assert.match(html, /href="\/posts\/7"/);
    assert.match(html, /21/);
    assert.match(html, /下一页/);
    assert.doesNotMatch(html, /去登录|login-prompt|文章状态/);
  }
});

test('public Vue pages render sample content with working template helpers', async () => {
  const pinia = createPinia(); setActivePinia(pinia)
  const blog = useBlogStore()
  globalThis.fetch = async () => response(pageData([]))
  await blog.initialize(); await blog.setDemo(true)
  for (const [file, path, name, expected] of [
    ['HomeView', '/', 'home', '在快节奏的世界里'],
    ['LinksView', '/links', 'links', 'developer.mozilla.org'],
    ['ArchiveView', '/archive', 'archive', '在快节奏的世界里'],
    ['AboutView', '/about', 'about', '返回文章'],
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

test('user status endpoint sends only status and preserves paging and Bearer auth', async () => {
  const calls = []
  session.token = 'admin-token'
  const user = { id: 3, username: 'writer', nickname: '作者', email: 'writer@example.com', avatar: null, bio: null, role: 1, status: 1, createdAt: '2026-11-18T12:00:00', updatedAt: '2026-11-18T12:00:00' }
  globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return response(options.method === 'GET' ? pageData([{ ...user, postCount: 12 }], 21, url.includes('?') ? 2 : 1) : user) }
  const firstPage = await api.adminUsers()
  assert.equal(firstPage.records[0].username, 'writer')
  assert.equal(firstPage.records[0].postCount, 12)
  assert.equal(calls[0].url, '/api/user')
  assert.equal(calls[0].headers.Authorization, 'Bearer admin-token')
  assert.deepEqual(await api.updateUserStatus(3, { status: 0, nickname: 'cannot-change', role: 2, password: 'never-send' }), user)
  assert.equal(calls[1].url, '/api/user/3/status')
  assert.equal(calls[1].method, 'PUT')
  assert.equal(calls[1].headers.Authorization, 'Bearer admin-token')
  assert.deepEqual(JSON.parse(calls[1].body), { status: 0 })
  const nextPage = await api.list('users', { page: 2, q: '作者', role: 1, status: 1 })
  const nextUrl = new URL(calls[2].url, 'http://blog')
  assert.equal(nextUrl.pathname, '/api/user')
  assert.deepEqual(Object.fromEntries(nextUrl.searchParams), { page: '2', size: '10', q: '作者', role: '1', status: '1' })
  assert.equal(calls[2].headers.Authorization, 'Bearer admin-token')
  assert.equal(nextPage.total, 21)
  assert.equal(nextPage.page, 2)
  session.token = ''
})

test('profile updates include only the four editable fields and clear empty fields', async () => {
  const calls = [], user = { id: 8, username: 'reader', nickname: '新昵称', role: 1, status: 1 }
  session.token = 'reader-token'
  globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return response(user) }
  try {
    assert.deepEqual(await api.updateProfile(8, { nickname: '新昵称', email: '', avatar: '/api/images/2026/11/avatar.png', bio: '', role: 2, status: 0, username: 'cannot-change', password: 'never-send' }), user)
    assert.equal(calls[0].url, '/api/user/8')
    assert.equal(calls[0].method, 'PUT')
    assert.equal(calls[0].headers.Authorization, 'Bearer reader-token')
    assert.deepEqual(JSON.parse(calls[0].body), { nickname: '新昵称', email: null, avatar: '/api/images/2026/11/avatar.png', bio: null })
  } finally { session.token = '' }
})

test('personal profile works for readers and admins, preserves edits on errors and ignores expired saves', async () => {
  const { createRenderer, nextTick, ssrContextKey } = await import('vue')
  const loaded = (await server.ssrLoadModule('/src/views/ProfileView.vue')).default
  const renderer = createRenderer({ createComment: text => ({ text }), insert() {}, remove() {}, setComment() {}, parentNode: () => null, nextSibling: () => null })
  for (const role of [1, 2]) {
    const pinia = createPinia(); setActivePinia(pinia)
    const blog = useBlogStore(), calls = []
    const user = { id: 8, username: 'reader', nickname: '旧昵称', email: 'reader@example.com', avatar: null, bio: '原简介', role, status: 1 }
    let failure = 0, finishSave, hold = false
    session.token = 'profile-token'
    globalThis.fetch = async (url, options) => {
      calls.push({ url, ...options })
      if (options.method === 'PUT') {
        if (hold) return new Promise(resolve => { finishSave = () => resolve(response({ ...user, ...JSON.parse(options.body) })) })
        if (failure) return response(null, failure)
        return response({ ...user, ...JSON.parse(options.body) })
      }
      if (url === '/api/user/me') return response(user)
      throw new Error(`Unexpected profile request: ${url}`)
    }
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/profile', component: loaded }, { path: '/login', name: 'login', component: { render: () => null } }] })
    await router.push('/profile'); await router.isReady()
    const app = renderer.createApp({ ...loaded, render: () => null }); app.use(pinia); app.use(router); app.provide(ssrContextKey, {})
    app.mount({})
    try {
      await new Promise(resolve => setTimeout(resolve, 0)); await nextTick()
      const state = app._instance.setupState
      assert.equal(state.ready, true)
      assert.equal(state.form.bio, '原简介', 'load all editable fields before a replacing PUT')
      state.form.nickname = '新昵称'; state.form.email = ''; state.form.bio = ''
      await state.save()
      assert.equal(blog.user.nickname, '新昵称')
      assert.equal(blog.user.email, null)
      assert.equal(blog.user.bio, null)
      assert.equal(blog.user.role, role)
      assert.deepEqual(calls.filter(call => call.method === 'PUT').map(call => JSON.parse(call.body)), [{ nickname: '新昵称', email: null, avatar: null, bio: null }])
      const display = createSSRApp({ ...loaded, setup: () => state }); display.use(pinia); display.use(router)
      const html = await renderToString(display)
      assert.match(html, /个人资料|保存资料/)
      assert.doesNotMatch(html, /<select|role="combobox"|type="password"/)
      failure = 403; state.form.nickname = '保留未保存内容'
      await state.save()
      assert.equal(state.form.nickname, '保留未保存内容')
      assert.equal(blog.user.nickname, '新昵称')
      assert.equal(state.busy, false)
      assert.ok(state.error)
      dismissErrors(); hold = true; failure = 0
      const saving = state.save()
      assert.equal(state.busy, true)
      const writes = calls.filter(call => call.method === 'PUT').length
      await state.save()
      assert.equal(calls.filter(call => call.method === 'PUT').length, writes, 'prevent double submission')
      session.token = ''; window.dispatchEvent(new Event('session-expired'))
      finishSave(); await saving; await nextTick()
      assert.equal(blog.user, null, 'late save must not restore an expired session')
      assert.equal(state.ready, false)
      assert.equal(state.form.nickname, '')
      await state.save()
      assert.equal(calls.filter(call => call.method === 'PUT').length, writes)
    } finally { app.unmount(); session.token = ''; dismissErrors() }
  }
})

test('profile avatar uploads preview before saving, block early saves and preserve the current avatar on failure', async () => {
  const { createRenderer, nextTick, ssrContextKey } = await import('vue')
  const loaded = (await server.ssrLoadModule('/src/views/ProfileView.vue')).default
  const renderer = createRenderer({ createComment: text => ({ text }), insert() {}, remove() {}, setComment() {}, parentNode: () => null, nextSibling: () => null })
  const pinia = createPinia(); setActivePinia(pinia)
  const blog = useBlogStore(), calls = []
  let user = { id: 8, username: 'reader', nickname: '读者', avatar: '/api/images/2026/11/old.png', role: 1, status: 1 }, finishUpload
  const image = { url: '/api/images/2026/11/avatar.webp' }
  session.token = 'avatar-token'
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options })
    if (url === '/api/uploads/images') return new Promise(resolve => { finishUpload = status => resolve(response(status === 201 ? image : null, status)) })
    if (options.method === 'PUT') { user = { ...user, ...JSON.parse(options.body) }; return response(user) }
    return response(user)
  }
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/profile', component: loaded }, { path: '/login', name: 'login', component: { render: () => null } }] })
  await router.push('/profile'); await router.isReady()
  const app = renderer.createApp({ ...loaded, render: () => null }); app.use(pinia); app.use(router); app.provide(ssrContextKey, {}); app.mount({})
  const event = file => ({ target: { files: file ? [file] : [], value: file?.name || '' } })
  const avatarFile = () => new File(['avatar'], '头像.webp', { type: 'image/webp' })
  try {
    await new Promise(resolve => setTimeout(resolve, 0)); await nextTick()
    const state = app._instance.setupState
    const selected = event(avatarFile()), uploading = state.uploadAvatar(selected)
    assert.equal(selected.target.value, '', 'allow picking the same file again')
    assert.equal(state.uploading, true)
    await state.save(); await state.uploadAvatar(event(avatarFile()))
    assert.equal(calls.filter(call => call.method === 'PUT').length, 0, 'do not save an old avatar while uploading')
    assert.equal(calls.filter(call => call.url === '/api/uploads/images').length, 1, 'ignore duplicate uploads')
    const upload = calls.at(-1)
    assert.equal(upload.method, 'POST')
    assert.equal(upload.headers.Authorization, 'Bearer avatar-token')
    assert.equal(upload.body.get('file').name, '头像.webp')
    finishUpload(201); await uploading
    assert.equal(state.form.avatar, image.url)
    assert.equal(blog.user.avatar, '/api/images/2026/11/old.png', 'upload alone does not modify profile')
    const display = createSSRApp({ ...loaded, setup: () => state }); display.use(pinia); display.use(router)
    const html = await renderToString(display)
    assert.match(html, /type="file"[^>]*accept="image\/jpeg,image\/png,image\/webp"/)
    assert.ok(html.includes(image.url), 'preview uses uploaded image URL')
    assert.match(html, /更换头像|移除头像/)
    await state.save()
    assert.equal(blog.user.avatar, image.url)
    assert.equal(JSON.parse(calls.at(-1).body).avatar, image.url)
    state.form.avatar = ''; state.reset(); assert.equal(state.form.avatar, image.url)
    const failedUpload = state.uploadAvatar(event(avatarFile())); finishUpload(500); await failedUpload
    assert.equal(state.form.avatar, image.url, 'failed upload retains current avatar')
    assert.equal(state.busy, false); assert.ok(state.error)
    dismissErrors()
    const beforeInvalid = calls.length
    await state.uploadAvatar(event(new File(['gif'], 'bad.gif', { type: 'image/gif' })))
    assert.equal(calls.length, beforeInvalid)
    assert.match(state.error, /JPEG、PNG、WebP/)
    state.form.avatar = ''; await state.save()
    assert.equal(blog.user.avatar, null, 'remove avatar persists a null field')
    const late = state.uploadAvatar(event(avatarFile()))
    session.token = ''; window.dispatchEvent(new Event('session-expired'))
    finishUpload(201); await late
    assert.equal(blog.user, null)
    assert.equal(state.form.avatar, '', 'expired upload must not fill a cleared form')
    assert.equal(state.busy, false)
  } finally { app.unmount(); session.token = ''; dismissErrors() }
})

test('avatars display uploaded paths across user views and recover after a broken image is replaced', async () => {
  const { createRenderer, reactive, h, nextTick, ssrContextKey } = await import('vue')
  const loaded = (await server.ssrLoadModule('/src/components/UserAvatar.vue')).default
  const renderer = createRenderer({ createComment: text => ({ text }), insert() {}, remove() {}, setComment() {}, parentNode: () => null, nextSibling: () => null })
  const props = reactive({ src: '/api/images/2026/11/avatar.png', name: '读者' })
  const component = { ...loaded, render: () => null }
  const app = renderer.createApp({ render: () => h(component, props) }); app.provide(ssrContextKey, {}); app.mount({})
  try {
    const state = app._instance.subTree.component.setupState
    const renderAvatar = () => renderToString(createSSRApp({ ...loaded, setup: () => state }, props))
    assert.match(await renderAvatar(), /src="\/api\/images\/2026\/11\/avatar.png"/)
    state.failed = true
    assert.doesNotMatch(await renderAvatar(), /<img/)
    props.src = '/api/images/2026/11/replaced.png'; await nextTick()
    assert.equal(state.failed, false)
    assert.match(await renderAvatar(), /replaced.png/)
    props.src = 'javascript:alert(1)'; await nextTick()
    assert.doesNotMatch(await renderAvatar(), /<img|javascript:/)
  } finally { app.unmount() }

  const pinia = createPinia(); setActivePinia(pinia)
  const blog = useBlogStore()
  blog.user = { id: 8, username: 'reader', nickname: '读者', avatar: '/api/images/2026/11/avatar.png', role: 2, status: 1 }
  blog.initialized = true
  const { useAdminStore } = await server.ssrLoadModule('/src/stores/admin.js')
  useAdminStore().users = [blog.user]
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:all(.*)', component: { render: () => null } }] }); await router.push('/')
  for (const path of ['/src/components/AccountMenu.vue', '/src/views/HomeView.vue', '/src/views/admin/UsersView.vue']) {
    const component = (await server.ssrLoadModule(path)).default
    const display = createSSRApp(component, path.includes('AccountMenu') ? { user: blog.user } : {}); display.use(pinia); display.use(router)
    assert.match(await renderToString(display), /src="\/api\/images\/2026\/11\/avatar.png"/, path)
  }
})

test('admin user actions only change status and protect the current account', async () => {
  const { createRenderer, nextTick, ssrContextKey } = await import('vue')
  const { useAdminStore } = await server.ssrLoadModule('/src/stores/admin.js')
  const loaded = (await server.ssrLoadModule('/src/views/admin/UsersView.vue')).default
  const renderer = createRenderer({ createComment: text => ({ text }), insert() {}, remove() {}, setComment() {}, parentNode: () => null, nextSibling: () => null })
  const pinia = createPinia(); setActivePinia(pinia)
  const blog = useBlogStore(), admin = useAdminStore(), calls = []
  const currentUser = { id: 1, username: 'admin', role: 2, status: 1 }
  let user = { id: 8, username: 'reader', nickname: '保留昵称', email: 'keep@example.com', role: 1, status: 1 }, fail = false
  blog.user = currentUser; session.token = 'admin-token'
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options })
    if (options.method === 'PUT') {
      if (fail) return response(null, 403)
      user = { ...user, status: JSON.parse(options.body).status }; return response(user)
    }
    return response(pageData([currentUser, user]))
  }
  const app = renderer.createApp({ ...loaded, render: () => null }); app.use(pinia); app.provide(ssrContextKey, {}); app.mount({})
  try {
    await new Promise(resolve => setTimeout(resolve, 0)); await nextTick()
    const state = app._instance.setupState
    state.askToggle(currentUser)
    assert.equal(state.confirmation, null)
    state.confirmation = currentUser; await state.toggleStatus()
    assert.equal(calls.filter(call => call.method === 'PUT').length, 0)
    for (const expected of [0, 1]) {
      state.askToggle(user); await state.toggleStatus()
      const write = calls.filter(call => call.method === 'PUT').at(-1)
      assert.equal(write.url, '/api/user/8/status')
      assert.deepEqual(JSON.parse(write.body), { status: expected })
      assert.equal(admin.users.find(row => row.id === 8).status, expected)
      assert.equal(user.nickname, '保留昵称')
    }
    fail = true; state.askToggle(user); await state.toggleStatus()
    assert.ok(state.confirmation, 'failed status changes can be retried')
    assert.ok(state.error)
    assert.equal(state.busy, false)
    blog.user = { ...currentUser, role: 1 }; await nextTick()
    const count = calls.length; await state.toggleStatus(); assert.equal(calls.length, count, 'non-admin cannot submit')
  } finally { app.unmount(); session.token = ''; dismissErrors() }
})

test('user module still unwraps registration, login, current user and null logout responses', async () => {
  session.token = ''
  const calls = [], user = { id: 8, username: 'writer', nickname: '作者', email: null, avatar: null, bio: null, role: 1, status: 1, createdAt: '2026-11-18T12:00:00', updatedAt: '2026-11-18T12:00:00' }
  const loginResult = { accessToken: 'new-user-token', tokenType: 'Bearer', expiresIn: 7200, user }
  globalThis.fetch = async (url, options) => {
    calls.push({ url, ...options })
    if (url.endsWith('/register')) return response(user, 201)
    if (url.endsWith('/login')) return response(loginResult)
    if (url.endsWith('/logout')) return response(null)
    return response(user)
  }
  try {
    assert.deepEqual(await api.register({ username: 'writer', password: 'password123' }), user)
    setActivePinia(createPinia())
    const blog = useBlogStore()
    await blog.login({ username: 'writer', password: 'password123' }, { admin: true })
    assert.equal(session.token, loginResult.accessToken)
    assert.deepEqual(blog.user, user)
    assert.deepEqual(await api.me(), user)
    assert.equal(await blog.logout(), true)
    assert.equal(blog.user, null)
    assert.equal(session.token, '')
    assert.deepEqual(calls.map(call => call.url), ['/api/user/register', '/api/user/login', '/api/user/me', '/api/user/logout'])
    assert.equal(calls[0].headers.Authorization, undefined)
    assert.equal(calls[1].headers.Authorization, undefined)
    assert.equal(calls[2].headers.Authorization, 'Bearer new-user-token')
    assert.equal(calls[3].headers.Authorization, 'Bearer new-user-token')
    assert.equal(errorEntries.value.length, 0)
  } finally { session.token = '' }
})

test('admin article filters resolve authors and sort real interaction statistics', async () => {
  const { filterPosts, summarizePosts } = await import('../src/utils/admin.js')
  const posts = [
    { id: 1, title: 'Vue', slug: 'vue', userId: 8, categoryId: 1, status: 1, viewCount: 12, likeCount: 3, commentCount: 1, createdAt: '2026-11-01' },
    { id: 2, title: '草稿', slug: 'draft', userId: 9, categoryId: 2, status: 0, viewCount: 20, likeCount: 1, commentCount: 0, createdAt: '2026-11-02' },
    { id: 3, title: '私密', slug: 'private', userId: 8, categoryId: 1, status: 2, viewCount: 2, likeCount: 8, commentCount: 2, createdAt: '2026-11-03' },
  ]
  const authorName = id => id === 8 ? '作者小陈' : '作者小林'
  assert.deepEqual(filterPosts(posts, { query: '小陈', category: '1' }, authorName).map(p => p.id), [3, 1])
  assert.deepEqual(filterPosts(posts, { status: '0' }, authorName).map(p => p.id), [2])
  assert.deepEqual(filterPosts(posts, { author: '8', sort: 'views' }, authorName).map(p => p.id), [1, 3])
  assert.deepEqual(filterPosts(posts, { sort: 'likes' }, authorName).map(p => p.id), [3, 1, 2])
  assert.deepEqual(summarizePosts(posts), { posts: 3, published: 1, views: 34, likes: 12, comments: 3 })
  assert.deepEqual(posts.map(p => p.id), [1, 2, 3])
})

test('admin store isolates protected data and does not accept responses after logout', async () => {
  const { nextTick } = await import('vue')
  const { useAdminStore } = await server.ssrLoadModule('/src/stores/admin.js')
  const pinia = createPinia(); setActivePinia(pinia)
  const blog = useBlogStore(), admin = useAdminStore()
  blog.user = { id: 1, username: 'admin', nickname: '管理员', role: 2, status: 1 }
  await nextTick()
  let requests = 0
  globalThis.fetch = async url => { requests++; return response(pageData(url.includes('/user?') ? [{ id: 2, username: 'writer', nickname: '小陈' }] : [{ id: 3, userId: 2 }])) }
  await Promise.all([admin.load('users'), admin.load('posts')])
  assert.equal(admin.authorName(2), '小陈')
  assert.equal(admin.authorName(99), '用户 #99')
  assert.equal(admin.posts.length, 1)
  blog.user = { ...blog.user, role: 1 }
  await nextTick()
  assert.equal(admin.posts.length, 0)
  assert.equal(admin.users.length, 0)
  const before = requests
  await admin.load('users')
  assert.equal(requests, before)
  blog.user = { ...blog.user, role: 2 }
  await nextTick()
  let finish
  globalThis.fetch = () => new Promise(resolve => finish = resolve)
  const load = admin.load('users')
  blog.user = null
  await nextTick()
  finish(response(pageData([{ id: 20, username: 'private-data' }])))
  await load
  assert.equal(admin.users.length, 0)
  assert.equal(admin.loading.users, false)
})

test('admin pages render article metrics, author names, user controls and category settings', async () => {
  const { nextTick } = await import('vue')
  const { useAdminStore } = await server.ssrLoadModule('/src/stores/admin.js')
  const pinia = createPinia(); setActivePinia(pinia)
  const blog = useBlogStore(), admin = useAdminStore()
  blog.user = { id: 1, username: 'admin', nickname: '站长', role: 2, status: 1 }
  await nextTick()
  admin.users = [{ id: 1, username: 'admin', role: 2, status: 1 }, { id: 2, nickname: '作者小陈', username: 'writer', email: 'writer@example.com', status: 1, role: 1, createdAt: '2026-11-01' }]
  admin.posts = [{ id: 6, title: '后台文章', slug: 'admin-story', userId: 2, categoryId: 1, status: 1, viewCount: 123, likeCount: 45, commentCount: 6, createdAt: '2026-11-01' }]
  blog.categories = [{ id: 1, name: '技术手记' }]
  admin.summary = { posts: 100, published: 80, views: 123, likes: 45, users: 25, activeUsers: 20, categories: 11, tags: 12, recent: admin.posts }
  Object.assign(admin.pagination.posts, { total: 100, pages: 10 })
  Object.assign(admin.pagination.users, { total: 25, pages: 3 })
  for (const [file, path, expected] of [
    ['OverviewView', '/manage', ['站点概览', '作者小陈', '123', '45']],
    ['PostsView', '/manage/posts', ['文章管理', '作者小陈', '123', '45', '/manage/posts/6/edit']],
    ['UsersView', '/manage/users', ['用户管理', 'writer@example.com', '禁用', '个人资料由用户本人维护']],
  ]) {
    const component = (await server.ssrLoadModule(`/src/views/admin/${file}.vue`)).default
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path, component }, { path: '/:all(.*)', component: { render: () => null } }] })
    await router.push(path); await router.isReady()
    const app = createSSRApp(component); app.use(pinia); app.use(router)
    const warnings = []; app.config.warnHandler = warning => warnings.push(warning)
    const html = await renderToString(app)
    for (const value of expected) assert.ok(html.includes(value), `${file} should include ${value}`)
    if (file === 'UsersView') assert.doesNotMatch(html, /编辑用户|user-editor-title|>编辑<|name="(?:nickname|email|bio|avatar)"/)
    assert.deepEqual(warnings, [])
  }
  blog.initialized = true
  const Resource = (await server.ssrLoadModule('/src/components/admin/ResourceManager.vue')).default
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:all(.*)', component: { render: () => null } }] })
  await router.push('/manage/categories')
  const app = createSSRApp(Resource, { resource: 'categories' }); app.use(pinia); app.use(router)
  globalThis.fetch = async () => response([])
  const html = await renderToString(app)
  assert.ok(html.includes('分类'))
  assert.ok(html.includes('新增'))
})


test('caught API failures show one error notification and preserve contextual recovery information', async () => {
  globalThis.fetch = async () => response(null, 500)
  let failure
  try { await api.create('posts', {}) } catch (error) { failure = error }
  assert.ok(failure)
  assert.equal(errorEntries.value.length, 1)
  reportError(failure)
  reportError(failure, { message: '文章已保存，但标签尚未全部同步。再次保存可重试。' })
  assert.equal(errorEntries.value.length, 1)
  assert.match(errorEntries.value[0].message, /文章已保存/)
  dismissErrors()
  reportError(failure)
  assert.equal(errorEntries.value.length, 0, 'late propagation of the same failure must not reopen the notification')
  try { await api.create('posts', {}) } catch { /* Caller may handle the rejected request. */ }
  assert.equal(errorEntries.value.length, 1, 'a new retry failure must be shown')
})

test('concurrent backend failures are grouped and different messages remain visible', async () => {
  globalThis.fetch = async url => new Response(JSON.stringify({ code: 400, message: url.endsWith('tags') ? '标签读取失败' : '分类读取失败', data: null }), { status: 400 })
  await Promise.allSettled([api.list('categories'), api.list('categories'), api.list('tags')])
  assert.equal(errorEntries.value.length, 2)
  assert.deepEqual(new Set(errorEntries.value.map(entry => entry.message)), new Set(['分类读取失败', '标签读取失败']))
})

test('malformed envelopes, invalid JSON, timeouts and network failures all reach the popup', async () => {
  for (const [fetcher, expected] of [
    [async () => new Response('null'), /数据格式不正确/],
    [async () => new Response('{broken'), /有效 JSON/],
    [async () => new Response('upstream error', { status: 502 }), /502/],
    [async () => { throw new DOMException('Aborted', 'AbortError') }, /请求超时/],
    [async () => { throw new TypeError('Failed to fetch') }, /无法连接博客服务/],
  ]) {
    dismissErrors(); globalThis.fetch = fetcher
    await assert.rejects(api.list('tags'), expected)
    assert.equal(errorEntries.value.length, 1)
    assert.match(errorEntries.value[0].message, expected)
  }
})

test('session expiration clears private state and shows one popup without an error toast', async () => {
  const pinia = createPinia(); setActivePinia(pinia)
  const blog = useBlogStore()
  blog.user = { id: 1, role: 2 }; blog.posts = [{ id: 1 }]
  session.token = 'expired-token'
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 401, message: '登录已过期，请重新登录', data: null }), { status: 401 })
  await assert.rejects(api.me())
  assert.equal(session.token, '')
  assert.equal(blog.user, null)
  assert.deepEqual(blog.posts, [])
  assert.equal(blog.notice, null)
  assert.equal(errorEntries.value.length, 1)
  assert.match(errorEntries.value[0].message, /登录已过期/)
})

test('Vue, browser, rejected promises, routes and invalid forms use the shared reporter', () => {
  const app = { config: {} }, target = new EventTarget(), doc = new EventTarget()
  let routeError, removed = false
  const router = { onError: handler => { routeError = handler; return () => { removed = true } } }
  const originalConsoleError = console.error
  console.error = () => {}
  const cleanup = installErrorHandlers(app, router, target, doc)
  try {
    app.config.errorHandler(new Error('private implementation detail'))
    assert.equal(errorEntries.value.length, 1)
    assert.doesNotMatch(errorEntries.value[0].message, /private implementation detail/)
    dismissErrors()
    const event = new Event('error')
    Object.defineProperty(event, 'error', { value: new Error('render failed') })
    target.dispatchEvent(event)
    assert.equal(errorEntries.value.length, 1)
    dismissErrors()
    const known = new Error('后端参数错误'); reportError(known)
    const rejection = new Event('unhandledrejection', { cancelable: true })
    Object.defineProperty(rejection, 'reason', { value: known })
    target.dispatchEvent(rejection)
    assert.equal(rejection.defaultPrevented, true)
    assert.equal(errorEntries.value.length, 1)
    assert.equal(errorEntries.value[0].message, '后端参数错误')
    dismissErrors()
    routeError(new Error('Chunk load error'))
    assert.match(errorEntries.value[0].message, /页面加载失败/)
    dismissErrors()
    doc.labels = [{ textContent: '邮箱' }]; doc.validationMessage = '请输入有效邮箱'
    const invalid = new Event('invalid', { cancelable: true })
    doc.dispatchEvent(invalid)
    assert.equal(invalid.defaultPrevented, true)
    assert.equal(errorEntries.value[0].message, '邮箱：请输入有效邮箱')
  } finally { cleanup(); console.error = originalConsoleError }
  assert.equal(removed, true)
  dismissErrors()
  target.dispatchEvent(new Event('unhandledrejection'))
  assert.equal(errorEntries.value.length, 0)
})

test('non-modal error notifications render accessible labels and escape backend error text', async () => {
  reportError('<script>alert(1)</script>')
  const component = (await server.ssrLoadModule('/src/components/ErrorDialog.vue')).default
  const html = await renderToString(createSSRApp(component))
  assert.match(html, /role="alert"/)
  assert.match(html, /aria-label="操作提示"/)
  assert.match(html, /aria-label="关闭提示"/)
  assert.doesNotMatch(html, /<dialog|aria-modal="true"/)
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script>/)
})


test('admin pagination requests only the selected page with a fixed size of ten and server filters', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return response(pageData([])) }
  session.token = 'admin-token'
  await api.list('posts', { page: 2, size: 10, q: 'Vue & 博客', status: 0, categoryId: 9, authorId: 7, sort: 'views', role: '' })
  assert.equal(calls.length, 1)
  const url = new URL(calls[0].url, 'http://blog.local')
  assert.equal(url.pathname, '/api/posts')
  assert.equal(url.searchParams.get('page'), '2')
  assert.equal(url.searchParams.get('size'), '10')
  assert.equal(url.searchParams.get('q'), 'Vue & 博客')
  assert.equal(url.searchParams.get('status'), '0')
  assert.equal(url.searchParams.get('categoryId'), '9')
  assert.equal(url.searchParams.get('authorId'), '7')
  assert.equal(url.searchParams.get('sort'), 'views')
  assert.equal(url.searchParams.has('role'), false)
  assert.equal(calls[0].headers.Authorization, 'Bearer admin-token')
  session.token = ''
})

test('all six admin lists replace the current page without prefetching or downloading other lists', async () => {
  const { useAdminStore } = await server.ssrLoadModule('/src/stores/admin.js')
  setActivePinia(createPinia())
  const blog = useBlogStore(), admin = useAdminStore()
  blog.user = { id: 1, role: 2, status: 1 }
  const calls = []
  globalThis.fetch = async url => {
    calls.push(url)
    const page = Number(new URL(url, 'http://blog').searchParams.get('page'))
    return response(pageData(Array.from({ length: 10 }, (_, i) => ({ id: (page - 1) * 10 + i + 1 })), 23, page))
  }
  for (const resource of ['posts', 'users', 'categories', 'tags', 'links', 'settings']) {
    const before = calls.length
    await admin.load(resource, { page: 1, q: 'keyword' })
    assert.equal(calls.length, before + 1)
    assert.equal(admin.lists[resource].length, 10)
    assert.equal(admin.lists[resource][0].id, 1)
    await admin.load(resource, { page: 2 })
    assert.equal(calls.length, before + 2)
    assert.equal(admin.lists[resource][0].id, 11)
    assert.equal(admin.lists[resource].length, 10)
    assert.equal(admin.pagination[resource].page, 2)
    assert.equal(admin.pagination[resource].total, 23)
    assert.equal(admin.pagination[resource].pages, 3)
    assert.equal(new URL(calls.at(-1), 'http://blog').searchParams.get('q'), 'keyword')
  }
  assert.equal(calls.some(url => url.startsWith('/api/admin/pages/')), false)
  assert.deepEqual(new Set(calls.map(url => new URL(url, 'http://blog').pathname)), new Set(['/api/posts', '/api/user', '/api/categories', '/api/tags', '/api/links', '/api/settings']))
})

test('old pagination responses cannot replace a newer search and backend page correction is respected', async () => {
  const { useAdminStore } = await server.ssrLoadModule('/src/stores/admin.js')
  setActivePinia(createPinia())
  const blog = useBlogStore(), admin = useAdminStore()
  blog.user = { id: 1, role: 2, status: 1 }
  let finishOld
  globalThis.fetch = () => new Promise(resolve => finishOld = resolve)
  const oldRequest = admin.load('posts', { page: 3, q: 'old' })
  globalThis.fetch = async () => response(pageData([{ id: 77 }], 20, 2))
  await admin.load('posts', { page: 3, q: 'new' })
  finishOld(response(pageData([{ id: 1 }], 30, 3)))
  await oldRequest
  assert.equal(admin.posts[0].id, 77)
  assert.equal(admin.pagination.posts.page, 2)
  assert.equal(admin.pagination.posts.total, 20)
  assert.equal(admin.loading.posts, false)
})

test('initialization loads identity and public resources without preloading page-owned article lists', async () => {
  setActivePinia(createPinia())
  const blog = useBlogStore(), calls = []
  session.token = 'admin-token'
  globalThis.fetch = async url => { calls.push(url); return response(url.endsWith('/me') ? { id: 1, role: 2, status: 1 } : pageData([])) }
  await blog.initialize({ admin: true })
  assert.deepEqual(calls, ['/api/user/me'])
  assert.equal(blog.initialized, true)
  await blog.initialize({ admin: true })
  assert.equal(calls.length, 1)
  await blog.initialize()
  assert.equal(calls.length, 4)
  assert.equal(calls.some(url => url.startsWith('/api/posts?')), false)
  assert.ok(calls.some(url => url.startsWith('/api/categories?')))
  session.token = ''
})

test('admin summary uses global server totals without requesting full article or user lists', async () => {
  const { useAdminStore } = await server.ssrLoadModule('/src/stores/admin.js')
  setActivePinia(createPinia())
  const blog = useBlogStore(), admin = useAdminStore(), calls = []
  blog.user = { id: 1, role: 2, status: 1 }
  admin.posts = [{ id: 1, viewCount: 3 }]
  globalThis.fetch = async url => { calls.push(url); return response({ posts: 100, users: 80, views: 9000, likes: 999, recent: [] }) }
  await admin.loadSummary()
  assert.deepEqual(calls, ['/api/posts/summary'])
  assert.equal(admin.summary.posts, 100)
  assert.equal(admin.summary.views, 9000)
  assert.equal(admin.posts.length, 1)
})

test('paged resource views render at most the supplied ten records with server totals and navigation', async () => {
  const { useAdminStore } = await server.ssrLoadModule('/src/stores/admin.js')
  setActivePinia(createPinia())
  const pinia = createPinia(); setActivePinia(pinia)
  const blog = useBlogStore(), admin = useAdminStore()
  blog.user = { id: 1, role: 2, status: 1 }; blog.initialized = true
  const component = (await server.ssrLoadModule('/src/components/admin/ResourceManager.vue')).default
  for (const resource of ['categories', 'tags', 'links', 'settings']) {
    admin.lists[resource] = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: 'entry-' + (i + 1), configKey: 'key-' + (i + 1) }))
    Object.assign(admin.pagination[resource], { total: 23, pages: 3, page: 2 })
    const app = createSSRApp(component, { resource }); app.use(pinia)
    const warnings = []; app.config.warnHandler = value => warnings.push(value)
    const html = await renderToString(app)
    assert.match(html, /共 23 条/)
    assert.ok(html.includes('第 2 / 3 页'))
    assert.match(html, /aria-label="下一页"/)
    assert.ok(html.includes('entry-10'))
    assert.ok(!html.includes('entry-11'))
    assert.deepEqual(warnings, [])
  }
})



test('mounted pagination loads on demand, resets filters to page one and cancels requests on navigation', async () => {
  const { createRenderer, reactive, nextTick } = await import('vue')
  const { useAdminPage } = await server.ssrLoadModule('/src/composables/useAdminPage.js')
  const pinia = createPinia(); setActivePinia(pinia)
  const blog = useBlogStore(); blog.user = { id: 1, role: 2, status: 1 }
  const calls = []
  globalThis.fetch = async url => {
    calls.push(url)
    const page = Number(new URL(url, 'http://blog').searchParams.get('page'))
    return response(pageData([{ id: page }], 30, page))
  }
  const renderer = createRenderer({
    createComment: text => ({ text }), insert: () => {}, remove: () => {}, setComment: () => {},
    parentNode: () => null, nextSibling: () => null,
  })
  const filters = reactive({ q: '', status: '' })
  let view
  const app = renderer.createApp({ setup() { view = useAdminPage('posts', filters); return () => null } })
  app.use(pinia); app.mount({})
  try {
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.equal(calls.length, 1)
    await view.load(2)
    assert.equal(calls.length, 2)
    assert.equal(view.pagination.value.page, 2)
    filters.q = 'vue'; filters.status = '1'
    assert.equal(view.pending.value, true)
    await new Promise(resolve => setTimeout(resolve, 340))
    await nextTick()
    assert.equal(calls.length, 3, 'multiple filter edits should share a single request')
    const url = new URL(calls[2], 'http://blog')
    assert.equal(url.searchParams.get('page'), '1')
    assert.equal(url.searchParams.get('q'), 'vue')
    assert.equal(url.searchParams.get('status'), '1')
    assert.equal(view.rows.value[0].id, 1)
    filters.q = 'pending navigation'
  } finally { app.unmount() }
  await new Promise(resolve => setTimeout(resolve, 340))
  assert.equal(calls.length, 3, 'unmount must cancel a pending filter load')
})

test('all six list contracts use records even without parameters; comments and associations remain arrays', async () => {
  for (const resource of ['posts', 'users', 'categories', 'tags', 'links', 'settings']) {
    globalThis.fetch = async () => response(pageData([{ id: 1 }], 23));
    const result = await api.list(resource);
    assert.deepEqual(result.records, [{ id: 1 }]);
    assert.equal(result.total, 23);
    assert.equal(result.pages, 3);
  }
  for (const resource of ['comments', 'post-tags']) {
    globalThis.fetch = async () => response([{ id: 2, postId: 1 }]);
    assert.deepEqual(await api.list(resource, '?postId=1'), [{ id: 2, postId: 1 }]);
  }
  assert.equal(errorEntries.value.length, 0);
});

test('zero pages is valid for empty lists and malformed list data produces one readable popup', async () => {
  globalThis.fetch = async () => response(pageData([]));
  assert.deepEqual(await api.list('links'), pageData([]));
  assert.equal(errorEntries.value.length, 0);
  for (const invalid of [[], null, { ...pageData([]), records: [null] }, { ...pageData([]), page: '1' }]) {
    dismissErrors();
    globalThis.fetch = async () => response(invalid);
    let failure;
    try { await api.list('posts'); } catch (e) { failure = e; }
    assert.ok(failure);
    reportError(failure);
    assert.equal(errorEntries.value.length, 1);
    assert.match(errorEntries.value[0].message, /列表返回/);
  }
});

test('out-of-range pages retry once with filters preserved and skip correction after invalidation', async () => {
  const { loadPage } = await server.ssrLoadModule('/src/services/loadPage.js');
  const calls = [];
  globalThis.fetch = async url => {
    const query = new URL(url, 'http://blog').searchParams;
    calls.push(query);
    const page = Number(query.get('page'));
    return response(pageData(page === 2 ? [{ id: 20 }] : [], 20, page));
  };
  const result = await loadPage('posts', { page: 3, q: 'Vue', status: 0, categoryId: 4, sort: 'likes' });
  assert.equal(result.page, 2);
  assert.deepEqual(calls.map(query => query.get('page')), ['3', '2']);
  assert.equal(calls[1].get('q'), 'Vue');
  assert.equal(calls[1].get('status'), '0');
  assert.equal(calls[1].get('categoryId'), '4');
  assert.equal(calls[1].get('sort'), 'likes');
  calls.length = 0;
  globalThis.fetch = async url => { calls.push(new URL(url, 'http://blog').searchParams); return response(pageData([], 0, 3)); };
  await loadPage('links', { page: 3 });
  assert.deepEqual(calls.map(query => query.get('page')), ['3', '1'], 'empty lists fall back to page one without retry loops');
  calls.length = 0;
  await loadPage('links', { page: 3 }, () => false);
  assert.equal(calls.length, 1, 'invalidated responses do not trigger another request');
});

test('all empty admin resources accept pages zero, render disabled navigation and clear consistently', async () => {
  const { useAdminStore } = await server.ssrLoadModule('/src/stores/admin.js');
  const pinia = createPinia(); setActivePinia(pinia);
  const blog = useBlogStore(), admin = useAdminStore();
  blog.user = { id: 1, role: 2 };
  globalThis.fetch = async () => response(pageData([]));
  for (const resource of ['posts', 'users', 'categories', 'tags', 'links', 'settings']) {
    await admin.load(resource);
    assert.deepEqual(admin.lists[resource], []);
    assert.equal(admin.pagination[resource].pages, 0);
    assert.equal(admin.errors[resource], '');
  }
  const component = (await server.ssrLoadModule('/src/components/admin/PageNavigation.vue')).default;
  const html = await renderToString(createSSRApp(component, { pagination: admin.pagination.posts }));
  assert.match(html, /暂无数据/);
  assert.doesNotMatch(html, /1 \/ 0/);
  assert.equal((html.match(/ disabled/g) || []).length, 2);
  blog.user = null;
  assert.equal(admin.pagination.posts.pages, 0);
  assert.equal(errorEntries.value.length, 0);
});

test('public resources store arrays, backend totals and only the requested next page', async () => {
  setActivePinia(createPinia());
  const blog = useBlogStore(), calls = [];
  globalThis.fetch = async url => {
    calls.push(url);
    const query = new URL(url, 'http://blog').searchParams, page = Number(query.get('page'));
    return response(url.startsWith('/api/tags') ? pageData(Array.from({ length: page === 1 ? 10 : 9 }, (_, i) => ({ id: (page - 1) * 10 + i + 1, name: '标签' })), 19, page) : pageData([]));
  };
  await blog.loadPublic();
  assert.equal(calls.length, 3);
  assert.equal(Array.isArray(blog.categories), true);
  assert.equal(blog.tags.length, 10);
  assert.equal(blog.publicPagination.tags.total, 19);
  assert.equal(blog.publicPagination.links.pages, 0);
  await blog.loadPublicResource('tags', 2);
  assert.equal(calls.length, 4);
  assert.equal(blog.tags.length, 9);
  assert.equal(blog.tags[0].id, 11);
  assert.equal(blog.publicPagination.tags.page, 2);
  assert.equal(blog.publicError, '');
  assert.equal(errorEntries.value.length, 0);
});

test('real home, archive and links render new list records without content or fake reading times', async () => {
  const pinia = createPinia(); setActivePinia(pinia);
  const blog = useBlogStore();
  blog.user = { id: 8, role: 1 }; blog.initialized = true;
  globalThis.fetch = async url => response(url.startsWith('/api/posts') ? pageData([{ id: 7, title: '分页返回的文章', userId: 8, categoryId: 20, categoryName: '第二页分类', authorName: '作者', status: 1, isTop: 1, viewCount: 12, likeCount: 2, createdAt: '2026-11-17T12:00:00' }], 21) : pageData([]));
  await blog.loadPosts(); await blog.loadPublic();
  for (const [file, path, expected] of [['HomeView', '/', '分页返回的文章'], ['ArchiveView', '/archive', '第二页分类'], ['LinksView', '/links', '暂无友链']]) {
    const component = (await server.ssrLoadModule(`/src/views/${file}.vue`)).default;
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path, component }, { path: '/:all(.*)', component: { render: () => null } }] });
    await router.push(path); await router.isReady();
    const app = createSSRApp(component); app.use(pinia); app.use(router);
    const warnings = []; app.config.warnHandler = value => warnings.push(value);
    const html = await renderToString(app);
    assert.ok(html.includes(expected));
    assert.doesNotMatch(html, /分钟阅读|1 \/ 0/);
    if (file !== 'LinksView') assert.match(html, /21/);
    assert.deepEqual(warnings, []);
  }
  assert.equal(errorEntries.value.length, 0);
});

test('home and archive display list response covers without requesting article details', async () => {
  for (const authenticated of [false, true]) {
    const pinia = createPinia(); setActivePinia(pinia)
    const blog = useBlogStore(), calls = []
    session.token = authenticated ? 'cover-reader' : ''
    blog.user = authenticated ? { id: 8, role: 1 } : null
    blog.initialized = true
    const coverImage = '/api/images/2026/11/cover.png'
    globalThis.fetch = async (url, options) => {
      calls.push({ url, ...options })
      return response(pageData([
        { id: 7, title: '有封面的文章', coverImage, status: 1, createdAt: '2026-11-24T12:00:00' },
        { id: 8, title: '无封面的文章', coverImage: null, status: 1, createdAt: '2026-11-24T12:00:00' },
      ]))
    }
    await blog.loadPosts()
    for (const [file, path] of [['HomeView', '/'], ['ArchiveView', '/archive']]) {
      const component = (await server.ssrLoadModule(`/src/views/${file}.vue`)).default
      const router = createRouter({ history: createMemoryHistory(), routes: [{ path, component }, { path: '/:all(.*)', component: { render: () => null } }] })
      await router.push(path); await router.isReady()
      const app = createSSRApp(component); app.use(pinia); app.use(router)
      const html = await renderToString(app)
      assert.ok(html.includes(`src="${coverImage}"`))
      assert.ok(html.includes('无封面的文章'))
      assert.equal((html.match(/class="post-cover"/g) || []).length, 1)
    }
    assert.equal(calls.length, 1)
    assert.ok(calls[0].url.startsWith('/api/posts?'))
    assert.equal(calls[0].headers.Authorization, authenticated ? 'Bearer cover-reader' : undefined)
    session.token = ''
  }
})

test('mounted home and archive request posts once after app initialization or login, including category links', async () => {
  const { createRenderer, h, watch, nextTick, ssrContextKey } = await import('vue');
  for (const scenario of [
    { file: 'HomeView', path: '/', category: '' },
    { file: 'HomeView', path: '/?category=7', category: '7' },
    { file: 'ArchiveView', path: '/archive', category: '' },
    { file: 'HomeView', path: '/', category: '', login: true },
    { file: 'HomeView', path: '/', category: '', anonymous: true },
    { file: 'HomeView', path: '/?category=7&tag=6', category: '7', tag: '6', anonymous: true },
    { file: 'ArchiveView', path: '/archive', category: '', anonymous: true },
  ]) {
    const pinia = createPinia(); setActivePinia(pinia);
    const blog = useBlogStore(), calls = [];
    session.token = scenario.login || scenario.anonymous ? '' : 'restored-token';
    globalThis.fetch = async url => {
      calls.push(url);
      if (url.endsWith('/me')) return response({ id: 8, username: 'writer', role: 1 });
      if (url.endsWith('/login')) return response({ accessToken: 'login-token', user: { id: 8, username: 'writer', role: 1 } });
      return response(pageData([]));
    };
    if (scenario.login) await blog.login({ username: 'writer', password: 'password123' });
    const loaded = (await server.ssrLoadModule(`/src/views/${scenario.file}.vue`)).default;
    // Run the real page setup and lifecycle; rendering is covered by the SSR tests.
    const component = { ...loaded, render: () => null };
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: scenario.file === 'ArchiveView' ? '/archive' : '/', component }] });
    await router.push(scenario.path); await router.isReady();
    const renderer = createRenderer({
      createComment: text => ({ text }), insert: () => {}, remove: () => {}, setComment: () => {},
      parentNode: () => null, nextSibling: () => null,
    });
    const app = renderer.createApp({ setup() {
      // App.vue initializes alongside the mounted route.
      watch(() => !!router.currentRoute.value.meta.admin, admin => blog.initialize({ admin }), { immediate: true });
      return () => h(component);
    } });
    app.use(pinia); app.use(router); app.provide(ssrContextKey, {});
    const warnings = []; app.config.warnHandler = warning => warnings.push(warning);
    app.mount({});
    try {
      await new Promise(resolve => setTimeout(resolve, 0)); await nextTick();
      const endpoint = '/api/posts?';
      const postCalls = calls.filter(url => url.startsWith(endpoint));
      assert.equal(postCalls.length, 1, JSON.stringify(scenario));
      const query = new URL(postCalls[0], 'http://blog').searchParams;
      assert.equal(query.get('page'), '1'); assert.equal(query.get('size'), '10');
      assert.equal(query.get('categoryId') || '', scenario.category);
      assert.equal(query.get('tagId') || '', scenario.tag || '');
      if (scenario.anonymous) {
        assert.equal(query.get('status'), '1');
        assert.equal(calls.some(url => url.startsWith('/api/public/posts?') || url.startsWith('/api/post-tags')), false);
      }
      assert.equal(blog.loading, false);
      assert.deepEqual(warnings, []);
      if (scenario.file === 'HomeView') {
        await router.replace('/?category=9');
        await new Promise(resolve => setTimeout(resolve, 340));
        assert.equal(calls.filter(url => url.startsWith(endpoint)).length, 2, 'a category change adds exactly one request');
        assert.equal(new URL(calls.at(-1), 'http://blog').searchParams.get('categoryId'), '9');
      }
      if (!scenario.anonymous) {
        const listCallsBeforeLogout = calls.filter(url => url.startsWith(endpoint)).length;
        blog.posts = [{ id: 99, title: '登录用户草稿', status: 0 }];
        await blog.logout();
        assert.deepEqual(blog.posts, [], 'logout removes protected articles immediately');
        await new Promise(resolve => setTimeout(resolve, 340)); await nextTick();
        assert.equal(calls.filter(url => url.startsWith(endpoint)).length, listCallsBeforeLogout + 1, 'the mounted page reloads posts without login after logout');
        assert.equal(calls.some(url => url.startsWith('/api/public/posts?')), false);
        assert.equal(new URL(calls.at(-1), 'http://blog').searchParams.get('status'), '1');
      }
      assert.equal(errorEntries.value.length, 0);
    } finally { app.unmount(); session.token = ''; }
  }
});

test('public reading sends optional Bearer auth and only falls back for authenticated unpublished links', async () => {
  const calls = [], post = { id: 7, title: '公开文章', status: 1, viewCount: 42 };
  globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return response(post); };
  session.token = '';
  assert.deepEqual(await api.readPost(7), post);
  assert.equal(calls[0].url, '/api/public/posts/7');
  assert.equal(calls[0].headers.Authorization, undefined);
  session.token = 'reader-token';
  await api.readPost(7);
  assert.equal(calls[1].headers.Authorization, 'Bearer reader-token');
  calls.length = 0;
  globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return url.includes('/public/') ? response(null, 404) : response({ ...post, status: 0 }); };
  assert.equal((await api.readPost(7)).status, 0);
  assert.deepEqual(calls.map(call => call.url), ['/api/public/posts/7', '/api/posts/7']);
  assert.equal(errorEntries.value.length, 0, 'a successful draft fallback should not show a false error');
  calls.length = 0;
  await api.readPost(7, { privatePreview: true });
  assert.deepEqual(calls.map(call => call.url), ['/api/posts/7']);
  for (const status of [401, 403, 503]) {
    dismissErrors(); session.token = 'reader-token'; calls.length = 0;
    globalThis.fetch = async url => { calls.push(url); return response(null, status); };
    await assert.rejects(api.readPost(7));
    assert.deepEqual(calls, ['/api/public/posts/7'], 'auth and statistics failures must not retry through another identity or endpoint');
    assert.equal(errorEntries.value.length, 1);
  }
  dismissErrors(); session.token = ''; calls.length = 0;
  globalThis.fetch = async url => { calls.push(url); return response(null, 404); };
  await assert.rejects(api.readPost(7));
  assert.equal(calls.length, 1);
  assert.equal(errorEntries.value.length, 1);
});

test('reading page makes one public request after restoring identity, renders server counts and preserves draft previews', async () => {
  const { createRenderer, ssrContextKey, nextTick } = await import('vue');
  const originalDocument = globalThis.document;
  globalThis.document = { title: '' };
  try {
    for (const scenario of [
      { anonymous: true }, { anonymous: false }, { anonymous: false, draft: true },
      { anonymous: false, expired: true }, { anonymous: true, demo: true },
    ]) {
      dismissErrors();
      const pinia = createPinia(); setActivePinia(pinia);
      const blog = useBlogStore(), calls = [];
      session.token = scenario.anonymous ? '' : 'reader-token';
      const post = { id: 7, userId: 2, title: '接口返回的正文', content: '# 内容', status: scenario.draft ? 0 : 1, viewCount: 42 };
      const comment = { id: 1, postId: 7, userId: 2, nickname: '读者', content: '游客也能看到的评论' };
      const ownComment = { id: 2, postId: 7, userId: 8, nickname: '本人', content: '本人发表的评论' };
      blog.posts = [{ ...post, viewCount: 10 }];
      globalThis.fetch = async (url, options) => {
        calls.push({ url, ...options });
        if (url.endsWith('/me')) return response({ id: 8, username: 'reader', role: 1 });
        if (url === '/api/public/posts/7') return scenario.expired ? response(null, 401) : response(post);
        if (url === '/api/posts/7') return response(post);
        if (url.startsWith('/api/comments')) {
          if (options.method === 'POST') return response({ ...ownComment, id: 3, content: JSON.parse(options.body).content });
          return response([comment, ownComment]);
        }
        if (url.startsWith('/api/post-tags')) return response([]);
        return response(pageData([]));
      };
      if (scenario.demo) { await blog.setDemo(true); await blog.initialize(); blog.posts = [post]; }
      const loaded = (await server.ssrLoadModule('/src/views/PostView.vue')).default;
      const component = { ...loaded, render: () => null };
      const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/posts/:id', component }, { path: '/login', name: 'login', component: { render: () => null } }, { path: '/:all(.*)', component: { render: () => null } }] });
      await router.push('/posts/7'); await router.isReady();
      const renderer = createRenderer({ createComment: text => ({ text }), insert: () => {}, remove: () => {}, setComment: () => {}, parentNode: () => null, nextSibling: () => null });
      const app = renderer.createApp(component); app.use(pinia); app.use(router); app.provide(ssrContextKey, {});
      const warnings = []; app.config.warnHandler = warning => warnings.push(warning);
      app.mount({});
      try {
        await new Promise(resolve => setTimeout(resolve, 0)); await nextTick();
        const reads = calls.filter(call => call.url === '/api/public/posts/7');
        assert.equal(reads.length, scenario.demo || scenario.draft ? 0 : 1, JSON.stringify(scenario));
        assert.equal(calls.filter(call => call.url === '/api/posts/7').length, scenario.draft ? 1 : 0);
        assert.equal(calls.some(call => call.url.startsWith('/api/posts?')), false);
        const state = app._instance.setupState;
        assert.equal(state.loading, false);
        if (scenario.expired) {
          assert.equal(state.post, null);
          assert.equal(errorEntries.value.length, 1);
          assert.equal(calls.some(call => call.url.startsWith('/api/comments')), false);
        } else {
          assert.ok(state.post, JSON.stringify({ scenario, calls: calls.map(call => call.url), error: state.error }));
          assert.equal(state.post.content, '# 内容');
          assert.equal(state.post.viewCount, 42);
          if (!scenario.demo) assert.equal(blog.posts[0].viewCount, 42, 'sync server count without incrementing it locally');
          assert.equal(errorEntries.value.length, 0);
          const commentCalls = calls.filter(call => call.url.startsWith('/api/comments'));
          assert.equal(commentCalls.length, scenario.demo ? 0 : 1);
          if (!scenario.demo) assert.equal(commentCalls[0].headers.Authorization, scenario.anonymous ? undefined : 'Bearer reader-token');
          if (scenario.anonymous) assert.equal(calls.some(call => call.url.startsWith('/api/post-tags')), false);
          const display = createSSRApp({ ...loaded, setup: () => state }); display.use(pinia); display.use(router);
          const html = await renderToString(display);
          assert.match(html, /接口返回的正文/);
          assert.match(html, />42</);
          assert.doesNotMatch(html, /待审核|未通过/, 'comments without a status field must not show an invented moderation state');
          if (scenario.anonymous && !scenario.demo) {
            assert.match(html, /登录后发表评论/);
            assert.match(html, /游客也能看到的评论/);
            assert.match(html, /本人发表的评论/);
            assert.doesNotMatch(html, /<form|>回复<|>删除</);
            assert.doesNotMatch(html, /登录后，继续阅读/);
            state.content = '游客尝试发表评论';
            await state.submitComment();
            assert.equal(calls.some(call => call.method === 'POST'), false);
          } else if (!scenario.demo && !scenario.draft) {
            assert.match(html, /本人发表的评论/);
            assert.match(html, /<form/);
            state.content = '已登录评论'; state.reply = comment;
            await state.submitComment();
            const submission = calls.find(call => call.method === 'POST');
            assert.equal(submission.url, '/api/comments');
            assert.equal(submission.headers.Authorization, 'Bearer reader-token');
            assert.deepEqual(JSON.parse(submission.body), { postId: 7, parentId: 1, content: '已登录评论' });
            assert.equal(state.comments.at(-1).content, '已登录评论');
            assert.equal(state.comments.at(-1).status, undefined);
            assert.equal(blog.notice.message, '评论已发表。');
            state.content = '退出前草稿'; state.reply = comment;
            state.deleteTarget = { type: 'comments', id: ownComment.id };
            let finishLateComments;
            const fetchBeforeLogout = globalThis.fetch;
            globalThis.fetch = (url, options) => url.startsWith('/api/comments') && options.headers.Authorization
              ? new Promise(resolve => { finishLateComments = resolve; }) : fetchBeforeLogout(url, options);
            const lateRequest = state.loadComments();
            assert.equal(await blog.logout(), true);
            await new Promise(resolve => setTimeout(resolve, 0)); await nextTick();
            finishLateComments(response([comment, { ...ownComment, content: '过期响应的评论内容' }])); await lateRequest;
            assert.deepEqual(state.comments, [comment, ownComment], 'logout reloads guest comments and rejects a late authenticated response');
            assert.equal(state.reply, null); assert.equal(state.content, ''); assert.equal(state.deleteTarget, null);
            assert.equal(calls.filter(call => call.url.startsWith('/api/comments')).at(-1).headers.Authorization, undefined);
            const guestDisplay = createSSRApp({ ...loaded, setup: () => state }); guestDisplay.use(pinia); guestDisplay.use(router);
            const guestHtml = await renderToString(guestDisplay);
            assert.match(guestHtml, /游客也能看到的评论/);
            assert.match(guestHtml, /登录后发表评论/);
            assert.match(guestHtml, /本人发表的评论/);
            assert.doesNotMatch(guestHtml, /待审核|未通过|过期响应的评论内容|<form|>回复<|>删除</);
          }
        }
        assert.deepEqual(warnings, []);
      } finally { app.unmount(); session.token = ''; }
    }
  } finally { globalThis.document = originalDocument; }
});


test('article editors upload covers and body images at the cursor, block early saves and persist paths', async () => {
  const { createRenderer, computed, nextTick, ssrContextKey } = await import('vue')
  const { matchedRouteKey } = await import('vue-router')
  for (const admin of [false, true]) {
    storage.clear(); dismissErrors()
    const pinia = createPinia(); setActivePinia(pinia)
    const blog = useBlogStore(), calls = []
    session.token = 'editor-token'
    const path = admin ? '/manage/posts/new' : '/write'
    const cover = { url: '/api/images/2026/11/cover.png', originalName: '封面.png' }
    const bodyImage = { url: '/api/images/2026/11/body.webp', originalName: '正文.webp' }
    let finishUpload, uploadCount = 0, savedBody
    globalThis.fetch = async (url, options) => {
      calls.push({ url, ...options })
      if (url.endsWith('/me')) return response({ id: 8, username: 'writer', role: admin ? 2 : 1 })
      if (url === '/api/uploads/images') { uploadCount++; return new Promise(resolve => { finishUpload = () => resolve(response(uploadCount === 1 ? cover : bodyImage, 201)) }) }
      if (url === '/api/posts' && options.method === 'POST') { savedBody = JSON.parse(options.body); return response({ ...savedBody, id: 77 }, 201) }
      if (url.startsWith('/api/post-tags')) return response([])
      return response(pageData([]))
    }
    const loaded = (await server.ssrLoadModule('/src/views/EditorView.vue')).default
    const component = { ...loaded, render: () => null }
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path, component, meta: { admin } }, { path: '/:all(.*)', component: { render: () => null } }] })
    await router.push(path); await router.isReady()
    const renderer = createRenderer({ createComment: text => ({ text }), insert: () => {}, remove: () => {}, setComment: () => {}, parentNode: () => null, nextSibling: () => null })
    const app = renderer.createApp(component); app.use(pinia); app.use(router); app.provide(ssrContextKey, {})
    app.provide(matchedRouteKey, computed(() => router.currentRoute.value.matched[0]))
    const warnings = []; app.config.warnHandler = warning => warnings.push(warning)
    app.mount({})
    try {
      await new Promise(resolve => setTimeout(resolve, 0)); await nextTick()
      const state = app._instance.setupState
      assert.equal(state.loading, false)
      state.form.title = '带图片的文章'; state.form.content = '前文后文'
      const coverEvent = { target: { files: [new File(['cover'], '封面.png', { type: 'image/png' })], value: 'cover.png' } }
      const coverUpload = state.uploadImage(coverEvent, 'cover')
      assert.equal(coverEvent.target.value, '', 'the same file can be selected again after a failure')
      assert.equal(state.busy, true)
      await state.save(1)
      assert.equal(savedBody, undefined, 'publishing waits until the image path is available')
      finishUpload(); await coverUpload
      assert.equal(state.form.coverImage, cover.url)
      assert.equal(state.busy, false)
      let clicked = false, cursor, focused = false
      state.bodyFileInput = { click: () => { clicked = true } }
      state.contentInput = { selectionStart: 2, selectionEnd: 2, focus: () => { focused = true }, setSelectionRange: start => { cursor = start } }
      state.chooseBodyImage(); assert.equal(clicked, true)
      const bodyUpload = state.uploadImage({ target: { files: [new File(['body'], '正文.webp', { type: 'image/webp' })], value: 'body.webp' } }, 'body')
      finishUpload(); await bodyUpload
      assert.equal(state.form.content, `前文\n\n![正文.webp](${bodyImage.url})\n\n后文`)
      assert.equal(cursor, state.form.content.indexOf('后文'))
      assert.equal(focused, true)
      assert.match(state.rendered, /<img src="\/api\/images\/2026\/11\/body.webp"/)
      const draft = JSON.parse(storage.get('fieldnotes-draft-8-new'))
      assert.equal(draft.coverImage, cover.url); assert.equal(draft.content, state.form.content)
      const display = createSSRApp({ ...loaded, setup: () => state }); display.use(pinia); display.use(router)
      const html = await renderToString(display)
      assert.match(html, /上传图片或填写 https:/)
      assert.match(html, /src="\/api\/images\/2026\/11\/cover.png"/)
      assert.match(html, /更换封面/)
      await state.save(1)
      assert.equal(savedBody.coverImage, cover.url)
      assert.equal(savedBody.content, state.form.content)
      assert.equal(savedBody.status, 1)
      await new Promise(resolve => setTimeout(resolve, 0))
      assert.equal(router.currentRoute.value.path, admin ? '/manage/posts' : '/posts/77')
      assert.equal(storage.has('fieldnotes-draft-8-new'), false)
      assert.deepEqual(warnings, [])
      assert.equal(errorEntries.value.length, 0)
      // Failed and outdated uploads preserve the existing content and cover.
      globalThis.fetch = async () => response(null, 500)
      await state.uploadImage(coverEvent, 'cover')
      assert.equal(state.form.coverImage, cover.url)
      assert.equal(state.busy, false)
      assert.ok(state.imageError)
      dismissErrors()
      let completeLate
      globalThis.fetch = () => new Promise(resolve => { completeLate = () => resolve(response({ ...cover, url: '/api/images/2026/11/late.png' }, 201)) })
      const late = state.uploadImage(coverEvent, 'cover')
      session.token = 'other-session'
      completeLate(); await late
      assert.equal(state.form.coverImage, cover.url)
    } finally { app.unmount(); session.token = ''; storage.clear() }
  }
})

test('error notifications expire independently after four seconds and support manual dismissal', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  try {
    reportError('第一条错误')
    const first = errorEntries.value[0].id
    t.mock.timers.tick(NOTICE_DURATION / 2)
    reportError('第二条错误')
    t.mock.timers.tick(NOTICE_DURATION / 2)
    assert.deepEqual(errorEntries.value.map(entry => entry.message), ['第二条错误'])
    dismissError(first)
    assert.equal(errorEntries.value.length, 1)
    t.mock.timers.tick(NOTICE_DURATION / 2)
    assert.equal(errorEntries.value.length, 0)
    reportError('可手动关闭')
    dismissError(errorEntries.value[0].id)
    assert.equal(errorEntries.value.length, 0)
  } finally { dismissErrors(); t.mock.timers.reset() }
})


test('custom selects keep typed values, skip disabled choices and close without submitting a form', async () => {
  const Vue = await import('vue')
  const { createRenderer, h, ref, nextTick, ssrContextKey } = Vue
  const { readFile } = await import('node:fs/promises')
  const { parse, compileScript, compileTemplate } = await import('@vue/compiler-sfc')
  const { descriptor } = parse(await readFile(new URL('../src/components/AppSelect.vue', import.meta.url), 'utf8'))
  const bindings = compileScript(descriptor, { id: 'select-test' }).bindings
  const compiled = compileTemplate({ source: descriptor.template.content, filename: 'AppSelect.vue', id: 'select-test', compilerOptions: { mode: 'function', bindingMetadata: bindings } })
  assert.deepEqual(compiled.errors, [])
  const loadedSelect = (await server.ssrLoadModule('/src/components/AppSelect.vue')).default
  const Select = { ...loadedSelect, render: new Function('Vue', compiled.code)(Vue) }
  const Icon = (await server.ssrLoadModule('/src/components/AppIcon.vue')).default
  const previousIconRender = Icon.render
  Icon.render = () => h('svg')
  const previousDocument = globalThis.document
  const doc = new EventTarget()
  globalThis.document = doc
  Object.assign(window, { innerWidth: 390, innerHeight: 600 })
  let focused, popovers = 0
  const makeNode = type => ({
    type, props: {}, nodes: [], parent: null, scrollTop: 0, scrollHeight: 240, clientHeight: 180,
    get children() { return this.nodes.filter(node => !node.type.startsWith('#')) },
    get offsetTop() { return this.parent ? this.parent.children.indexOf(this) * 36 : 0 },
    offsetHeight: 36,
    getBoundingClientRect: () => ({ left: 300, right: 440, top: 530, bottom: 570, width: 140, height: 40 }),
    contains(node) { for (; node; node = node.parent) if (node === this) return true; return false },
    focus() { focused = this },
    matches() { return !!this.popoverOpen },
    showPopover() { this.popoverOpen = true; popovers++ },
    hidePopover() { this.popoverOpen = false },
  })
  const renderer = createRenderer({
    createElement: makeNode,
    createText: text => Object.assign(makeNode('#text'), { text }),
    createComment: text => Object.assign(makeNode('#comment'), { text }),
    setText: (node, text) => node.text = text,
    setComment: (node, text) => node.text = text,
    setElementText: (node, text) => { node.text = text; node.nodes = [] },
    patchProp: (node, key, oldValue, value) => node.props[key] = value,
    parentNode: node => node.parent,
    nextSibling: node => node.parent?.nodes[node.parent.nodes.indexOf(node) + 1],
    insert(node, parent, anchor = null) {
      if (node.parent) node.parent.nodes.splice(node.parent.nodes.indexOf(node), 1)
      node.parent = parent
      const index = anchor ? parent.nodes.indexOf(anchor) : -1
      parent.nodes.splice(index < 0 ? parent.nodes.length : index, 0, node)
    },
    remove(node) { node.parent?.nodes.splice(node.parent.nodes.indexOf(node), 1); node.parent = null },
  })
  const value = ref(0), disabled = ref(false)
  const options = [{ value: 0, label: '隐藏' }, { value: '0', label: '全部状态' }, { value: null, label: '未分类' }, { value: 2, label: '不可选', disabled: true }, { value: 1, label: '显示' }]
  const changes = [], warnings = []
  const app = renderer.createApp({ render: () => h(Select, {
    modelValue: value.value, options, disabled: disabled.value, required: true, label: '发布状态',
    'onUpdate:modelValue': next => value.value = next, onChange: next => changes.push(next),
  }) })
  app.config.warnHandler = warning => warnings.push(warning)
  app.provide(ssrContextKey, {})
  const host = makeNode('host')
  const descendants = node => [node, ...node.nodes.flatMap(descendants)]
  const find = role => descendants(host).find(node => node.props.role === role)
  const settle = async () => { await nextTick(); await nextTick(); await nextTick() }
  const key = async name => { const event = { key: name, preventDefault() { this.prevented = true } }; find('combobox').props.onKeydown(event); await settle(); return event }
  const escape = () => { const event = new Event('keydown', { cancelable: true }); Object.defineProperty(event, 'key', { value: 'Escape' }); doc.dispatchEvent(event); return event }
  app.mount(host)
  try {
    await settle()
    assert.equal(find('combobox').props.type, 'button')
    assert.equal(find('combobox').props['aria-expanded'], false)
    assert.equal(descendants(host).find(node => node.type === 'input').props.value, '0', 'zero satisfies the required field')
    await key('ArrowDown')
    assert.equal(popovers, 1)
    assert.equal(find('combobox').props['aria-expanded'], true)
    const menu = find('listbox')
    assert.equal(menu.popoverOpen, true)
    assert.ok(parseFloat(menu.props.style.left) + parseFloat(menu.props.style.width) <= 382, 'menu stays inside a narrow viewport')
    assert.ok(parseFloat(menu.props.style.top) < 530, 'menu opens upwards near the bottom edge')
    await key('ArrowDown'); await key('Enter')
    assert.equal(value.value, '0', 'string values remain strings')
    assert.equal(menu.popoverOpen, false)
    assert.equal(Vue.toRaw(focused), find('combobox'))
    await key('ArrowDown'); await key('ArrowDown'); await key('Enter')
    assert.equal(value.value, null, 'unclassified keeps its null value')
    assert.equal(descendants(host).find(node => node.type === 'input').props.value, '')
    await key('ArrowDown'); await key('ArrowDown'); await key('Enter')
    assert.equal(value.value, 1, 'disabled option is skipped and numeric values remain numbers')
    await key('ArrowDown')
    const cancelled = escape(); await settle()
    assert.equal(cancelled.defaultPrevented, true, 'Escape is consumed before an enclosing dialog can close')
    assert.equal(find('combobox').props['aria-expanded'], false)
    await key('ArrowDown'); await key('Tab')
    assert.equal(find('combobox').props['aria-expanded'], false)
    await key('Home'); await key('Enter')
    assert.equal(value.value, 0, 'Home opens at the first enabled option')
    await key('End'); await key('Enter')
    assert.equal(value.value, 1, 'End opens at the last enabled option')
    await key('ArrowDown')
    doc.dispatchEvent(new Event('pointerdown')); await settle()
    assert.equal(find('combobox').props['aria-expanded'], false, 'outside clicks dismiss the menu')
    disabled.value = true; await settle(); await key('ArrowDown')
    assert.equal(find('combobox').props['aria-expanded'], false)
    assert.deepEqual(changes, ['0', null, 1, 0, 1])
    assert.deepEqual(warnings, [])
  } finally { app.unmount(); Icon.render = previousIconRender; globalThis.document = previousDocument }
})
