import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, session } from '../services/api'
import { demoCategories, demoLinks, demoPosts, demoTags } from '../data/demo'
export const useBlogStore = defineStore('blog', () => {
  const user = ref(null), posts = ref([]), categories = ref([]), tags = ref([]), links = ref([])
  const loading = ref(false), error = ref(''), publicError = ref(''), notice = ref(null), initialized = ref(false), loggingOut = ref(false)
  const demo = ref(import.meta.env.VITE_DEMO_MODE === 'true')
  let noticeTimer, initialization, generation = 0
  const canRead = computed(() => !!user.value || demo.value)
  function notify(message, type = 'success') { clearTimeout(noticeTimer); notice.value = { message, type }; noticeTimer = setTimeout(() => notice.value = null, 6000) }
  function resetPrivate() { user.value = null; posts.value = []; error.value = '' }
  window.addEventListener('session-expired', () => { generation++; resetPrivate(); loading.value = false; notify('登录已过期，请重新登录', 'error') })
  async function loadPublic() {
    const current = generation
    const resources = ['categories', 'tags', 'links']
    const result = await Promise.allSettled(resources.map(resource => api.list(resource, resource === 'links' ? '?status=1' : '')))
    if (current !== generation || demo.value) return
    const refs = [categories, tags, links]
    result.forEach((entry, i) => { refs[i].value = entry.status === 'fulfilled' ? entry.value || [] : [] })
    publicError.value = result.some(entry => entry.status === 'rejected') ? '部分内容暂未加载成功，请稍后重试。' : ''
  }
  async function loadPosts() {
    if (demo.value) { posts.value = [...demoPosts]; return }
    if (!user.value) { posts.value = []; return }
    const current = generation
    loading.value = true; error.value = ''
    try { const result = await api.list('posts'); if (current === generation) posts.value = result || [] }
    catch (e) { if (current === generation) error.value = e.message }
    finally { if (current === generation) loading.value = false }
  }
  async function initialize() {
    if (initialization) return initialization
    initialization = (async () => {
      if (demo.value) { applyDemo(); initialized.value = true; return }
      const publicLoad = loadPublic()
      if (session.token) {
        try { user.value = await api.me(); await loadPosts() }
        catch (e) { if (e.status === 401 || e.status === 403) { session.token = ''; resetPrivate() }; error.value = e.message }
      }
      await publicLoad; initialized.value = true
    })()
    return initialization
  }
  function applyDemo() { posts.value = [...demoPosts]; categories.value = [...demoCategories]; tags.value = [...demoTags]; links.value = [...demoLinks]; error.value = ''; publicError.value = '' }
  async function setDemo(value) {
    generation++; demo.value = value; loading.value = false
    if (value) applyDemo()
    else { posts.value = []; categories.value = []; tags.value = []; links.value = []; await refresh() }
  }
  async function refresh() {
    if (demo.value) return applyDemo()
    if (!user.value && session.token) {
      try { user.value = await api.me(); error.value = '' } catch (e) { error.value = e.message }
    }
    await Promise.all([loadPublic(), loadPosts()])
  }
  async function login(credentials) {
    const result = await api.login(credentials)
    generation++; demo.value = false; session.token = result.accessToken; user.value = result.user
    await refresh(); notify('欢迎回来，继续记录生活吧。')
  }
  async function logout() {
    loggingOut.value = true
    try { await api.logout() }
    catch (e) { if (e.status !== 401) { notify(`退出失败：${e.message}`, 'error'); return false } }
    finally { loggingOut.value = false }
    generation++; session.token = ''; resetPrivate(); notify('已退出登录'); return true
  }
  const categoryName = id => categories.value.find(item => item.id === id)?.name || '未分类'
  return { user, posts, categories, tags, links, loading, error, publicError, notice, demo, initialized, loggingOut, canRead, initialize, refresh, loadPosts, loadPublic, login, logout, setDemo, notify, categoryName }
})
