import { reportError } from '../services/errors'
import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { api, session } from '../services/api'
import { emptyPage } from '../services/pagination'
import { loadPage } from '../services/loadPage'
import { demoCategories, demoLinks, demoPosts, demoTags } from '../data/demo'
export const useBlogStore = defineStore('blog', () => {
  const user = ref(null), posts = ref([]), categories = ref([]), tags = ref([]), links = ref([])
  const loading = ref(false), error = ref(''), publicError = ref(''), notice = ref(null), initialized = ref(false), loggingOut = ref(false)
  const demo = ref(import.meta.env.VITE_DEMO_MODE === 'true')
  const postPagination = reactive(emptyPage())
  const postQuery = reactive({ page: 1, size: 10, q: '', categoryId: '', tagId: '', status: '', sort: 'newest' })
  const publicPagination = reactive(Object.fromEntries(['categories', 'tags', 'links'].map(key => [key, emptyPage()])))
  const publicLoading = reactive({ categories: false, tags: false, links: false })
  const publicErrors = reactive({ categories: '', tags: '', links: '' })
  const publicVersions = { categories: 0, tags: 0, links: 0 }
  let postVersion = 0
  let noticeTimer, initialization, publicInitialization, generation = 0
  function notify(message, type = 'success') { if (type === 'error') { reportError(message); return } clearTimeout(noticeTimer); notice.value = { message, type }; noticeTimer = setTimeout(() => notice.value = null, 4000) }
  function resetPrivate() { user.value = null; posts.value = []; error.value = ''; postVersion++; Object.assign(postPagination, emptyPage()) }
  window.addEventListener('session-expired', () => { generation++; resetPrivate(); publicInitialization = null; loading.value = false })
  async function loadPublicResource(resource, page = 1) {
    if (demo.value) return
    const current = generation, version = ++publicVersions[resource]
    const isCurrent = () => current === generation && !demo.value && publicVersions[resource] === version
    publicLoading[resource] = true; publicErrors[resource] = ''
    try {
      const result = await loadPage(resource, { page, size: 10, ...(resource === 'links' ? { status: 1 } : {}) }, isCurrent)
      if (!isCurrent()) return
      const target = { categories, tags, links }[resource]
      target.value = result.records
      const { records, ...pagination } = result
      Object.assign(publicPagination[resource], pagination)
    } catch (e) {
      if (isCurrent()) { publicErrors[resource] = e.message; reportError(e) }
    } finally {
      if (isCurrent()) {
        publicLoading[resource] = false
        publicError.value = Object.values(publicErrors).some(Boolean) ? '部分内容暂未加载成功，请稍后重试。' : ''
      }
    }
  }
  async function loadPublic() {
    await Promise.all(['categories', 'tags', 'links'].map(resource => loadPublicResource(resource)))
  }
  function invalidatePosts() { postVersion++; loading.value = false }
  async function loadPosts(parameters = {}) {
    if (demo.value) { posts.value = [...demoPosts]; return }
    const current = generation, version = ++postVersion
    const isCurrent = () => current === generation && version === postVersion && !demo.value
    const query = { ...postQuery, ...parameters, size: 10 }
    if (!user.value) query.status = 1
    Object.assign(postQuery, query)
    loading.value = true; error.value = ''
    try {
      const result = await loadPage('posts', query, isCurrent)
      if (isCurrent()) {
        posts.value = result.records
        const { records, ...pagination } = result
        Object.assign(postPagination, pagination)
        postQuery.page = result.page
      }
    } catch (e) { if (isCurrent()) { error.value = e.message; reportError(e) } }
    finally { if (isCurrent()) loading.value = false }
  }
  async function initialize({ admin = false } = {}) {
    if (!initialization) initialization = (async () => {
      if (demo.value) { applyDemo(); initialized.value = true; return }
      if (session.token) {
        try { user.value = await api.me() }
        catch (e) { reportError(e); if (e.status === 401 || e.status === 403) { session.token = ''; resetPrivate() }; error.value = e.message }
      }
      initialized.value = true
    })()
    await initialization
    if (!admin && !demo.value) {
      // Article lists belong to the active page, which supplies its filters.
      if (!publicInitialization) publicInitialization = loadPublic()
      await publicInitialization
    }
  }
  function invalidateContent() { publicInitialization = null }
  function applyDemo() { posts.value = [...demoPosts]; Object.assign(postPagination, { page: 1, size: 10, total: demoPosts.length, pages: 1 }); categories.value = [...demoCategories]; tags.value = [...demoTags]; links.value = [...demoLinks]; error.value = ''; publicError.value = '' }
  async function setDemo(value) {
    generation++; demo.value = value; loading.value = false; Object.keys(publicLoading).forEach(key => publicLoading[key] = false)
    if (value) applyDemo()
    else { posts.value = []; categories.value = []; tags.value = []; links.value = []; await refresh() }
  }
  async function refresh() {
    if (demo.value) return applyDemo()
    if (!user.value && session.token) {
      try { user.value = await api.me(); error.value = '' } catch (e) { reportError(e); error.value = e.message }
    }
    publicInitialization = loadPublic(); await Promise.all([publicInitialization, loadPosts()])
  }
  async function login(credentials, { admin = false } = {}) {
    const result = await api.login(credentials)
    generation++; demo.value = false; session.token = result.accessToken; user.value = result.user
    posts.value = []; Object.assign(postPagination, emptyPage())
    invalidateContent()
    if (!admin) { publicInitialization = loadPublic(); await publicInitialization }
    notify('登录成功')
  }
  async function logout() {
    loggingOut.value = true
    try { await api.logout() }
    catch (e) { reportError(e); if (e.status !== 401) { reportError(e, { message: `退出失败：${e.message}` }); return false } }
    finally { loggingOut.value = false }
    generation++; session.token = ''; resetPrivate(); invalidateContent(); notify('已退出登录'); return true
  }
  const categoryName = id => categories.value.find(item => item.id === id)?.name || '未分类'
  return { user, posts, categories, tags, links, postPagination, postQuery, publicPagination, publicLoading, publicErrors, loadPublicResource, invalidatePosts, loading, error, publicError, notice, demo, initialized, loggingOut, initialize, invalidateContent, refresh, loadPosts, loadPublic, login, logout, setDemo, notify, categoryName }
})
