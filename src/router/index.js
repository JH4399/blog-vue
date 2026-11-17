import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import { session } from '../services/api'
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, saved) { return saved || { top: 0 } },
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { title: '文章' } },
    { path: '/posts/:id', name: 'post', component: () => import('../views/PostView.vue'), meta: { title: '阅读' } },
    { path: '/write/:id?', name: 'write', component: () => import('../views/EditorView.vue'), meta: { title: '写文章', auth: true } },
    { path: '/archive', name: 'archive', component: () => import('../views/ArchiveView.vue'), meta: { title: '归档' } },
    { path: '/links', name: 'links', component: () => import('../views/LinksView.vue'), meta: { title: '友链' } },
    { path: '/about', name: 'about', component: () => import('../views/AboutView.vue'), meta: { title: '关于' } },
    { path: '/login', name: 'login', component: () => import('../views/AuthView.vue'), meta: { title: '登录' } },
    { path: '/register', name: 'register', component: () => import('../views/AuthView.vue'), meta: { title: '注册' } },
    { path: '/manage', name: 'manage', component: () => import('../views/ManageView.vue'), meta: { title: '站点管理', auth: true } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/NotFoundView.vue'), meta: { title: '页面未找到' } },
  ],
})
router.beforeEach((to) => {
  document.title = `${to.meta.title || '记录生活'} · 拾光 Field Notes`
  if (to.meta.auth && !session.token) return { name: 'login', query: { redirect: to.fullPath } }
})
export default router
