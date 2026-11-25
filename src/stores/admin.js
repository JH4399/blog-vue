import { reportError } from '../services/errors'
import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import { api } from '../services/api'
import { loadPage } from '../services/loadPage'
import { useBlogStore } from './blog'

export const useAdminStore = defineStore('admin', () => {
  const blog = useBlogStore()
  const resources = ['posts', 'users', 'categories', 'tags', 'links', 'settings']
  const lists = reactive(Object.fromEntries(resources.map(key => [key, []])))
  const loading = reactive(Object.fromEntries([...resources, 'summary'].map(key => [key, false])))
  const errors = reactive(Object.fromEntries([...resources, 'summary'].map(key => [key, ''])))
  const pagination = reactive(Object.fromEntries(resources.map(key => [key, { page: 1, size: 10, total: 0, pages: 0 }])))
  const queries = Object.fromEntries(resources.map(key => [key, {}]))
  const summary = ref({ posts: 0, published: 0, views: 0, likes: 0, users: 0, activeUsers: 0, categories: 0, tags: 0, recent: [] })
  const allowed = computed(() => blog.user?.role === 2 && !blog.demo)
  const versions = Object.fromEntries([...resources, 'summary'].map(key => [key, 0]))
  const posts = computed({ get: () => lists.posts, set: value => lists.posts = value })
  const users = computed({ get: () => lists.users, set: value => lists.users = value })
  function invalidate(resource) { versions[resource]++; loading[resource] = false }
  function clear() {
    for (const key of resources) {
      invalidate(key); lists[key] = []; queries[key] = {}; errors[key] = ''
      Object.assign(pagination[key], { page: 1, size: 10, total: 0, pages: 0 })
    }
    invalidate('summary'); errors.summary = ''
    summary.value = { posts: 0, published: 0, views: 0, likes: 0, users: 0, activeUsers: 0, categories: 0, tags: 0, recent: [] }
  }
  watch([() => blog.user?.id, () => blog.user?.role, () => blog.demo], clear, { flush: 'sync' })
  async function load(resource, parameters = {}) {
    if (!allowed.value) return
    const version = ++versions[resource], userId = blog.user.id
    const query = { ...queries[resource], page: pagination[resource].page, ...parameters, size: 10 }
    queries[resource] = query
    loading[resource] = true; errors[resource] = ''; lists[resource] = []
    try {
      const result = await loadPage(resource, query, () => allowed.value && blog.user?.id === userId && versions[resource] === version)
      if (!allowed.value || blog.user.id !== userId || versions[resource] !== version) return
      lists[resource] = result.records
      Object.assign(pagination[resource], { total: result.total, page: result.page, size: result.size, pages: result.pages })
      queries[resource].page = result.page
    } catch (e) {
      if (versions[resource] === version) {
        errors[resource] = e.status === 404 ? '列表接口不存在，请检查后端版本并重新启动后端。' : e.message
        reportError(e, { message: errors[resource] })
      }
    } finally { if (versions[resource] === version) loading[resource] = false }
  }
  async function loadSummary() {
    if (!allowed.value) return
    const version = ++versions.summary, userId = blog.user.id
    loading.summary = true; errors.summary = ''
    try {
      const result = await api.adminSummary()
      if (allowed.value && blog.user.id === userId && versions.summary === version) summary.value = result
    } catch (e) {
      if (versions.summary === version) { errors.summary = e.message; reportError(e) }
    } finally { if (versions.summary === version) loading.summary = false }
  }
  const authorName = id => {
    const author = users.value.find(user => String(user.id) === String(id))
    return author?.nickname || author?.username || (String(blog.user?.id) === String(id) ? blog.user.nickname || blog.user.username : null) || '用户 #' + id
  }
  return { posts, users, lists, pagination, summary, loading, errors, allowed, load, loadSummary, refresh: loadSummary, clear, invalidate, authorName }
})
