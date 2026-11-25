import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { session } from '../services/api'
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, saved) {
    if (to.path === from.path) return false
    // Restore scroll after the destination is mounted, including browser Back.
    return new Promise(resolve => {
      let timeout
      const ready = () => {
        clearTimeout(timeout)
        document.removeEventListener('page-ready', ready)
        resolve({ ...(saved || { top: 0 }), behavior: 'instant' })
      }
      document.addEventListener('page-ready', ready)
      // Also settle if a navigation is interrupted or no route view is mounted.
      timeout = setTimeout(ready, 450)
    })
  },
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { title: '文章' } },
    { path: '/posts/:id', name: 'post', component: () => import('../views/PostView.vue'), meta: { title: '阅读' } },
    { path: '/write/:id?', name: 'write', component: () => import('../views/EditorView.vue'), meta: { title: '写文章', auth: true } },
    { path: '/archive', name: 'archive', component: () => import('../views/ArchiveView.vue'), meta: { title: '归档' } },
    { path: '/links', name: 'links', component: () => import('../views/LinksView.vue'), meta: { title: '友链' } },
    { path: '/about', name: 'about', component: () => import('../views/AboutView.vue'), meta: { title: '关于' } },
    { path: '/login', name: 'login', component: () => import('../views/AuthView.vue'), meta: { title: '登录' } },
    { path: '/register', name: 'register', component: () => import('../views/AuthView.vue'), meta: { title: '注册' } },
    { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue'), meta: { title: '个人资料', auth: true } },
    {
      path: '/manage', component: () => import('../views/admin/AdminLayout.vue'), meta: { auth: true, admin: true },
      children: [
        { path: '', name: 'manage', component: () => import('../views/admin/OverviewView.vue'), meta: { title: '数据概览' } },
        { path: 'posts', name: 'manage-posts', component: () => import('../views/admin/PostsView.vue'), meta: { title: '文章管理' } },
        { path: 'posts/new', name: 'manage-write', component: () => import('../views/EditorView.vue'), meta: { title: '新建文章' } },
        { path: 'posts/:id/edit', name: 'manage-edit', component: () => import('../views/EditorView.vue'), meta: { title: '编辑文章' } },
        { path: 'users', name: 'manage-users', component: () => import('../views/admin/UsersView.vue'), meta: { title: '用户管理' } },
        ...['categories', 'tags', 'links', 'settings'].map(resource => ({
          path: resource, name: `manage-${resource}`, component: () => import('../components/admin/ResourceManager.vue'), props: { resource },
          meta: { title: { categories: '分类管理', tags: '标签管理', links: '友情链接', settings: '系统配置' }[resource] },
        })),
      ],
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/NotFoundView.vue'), meta: { title: '页面未找到' } },
  ],
})
router.beforeEach((to) => {
  document.title = `${to.meta.title || '记录生活'} · 拾光 Field Notes`
  if (to.meta.auth && !session.token) return { name: 'login', query: { redirect: to.fullPath } }
})
export default router
