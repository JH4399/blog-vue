<script setup>
import { reportError } from '../../services/errors'
import { computed, onUnmounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import RouteOutlet from '../../components/RouteOutlet.vue'
import Icon from '../../components/AppIcon.vue'
import AccountMenu from '../../components/AccountMenu.vue'
import { useBlogStore } from '../../stores/blog'
import { useAdminStore } from '../../stores/admin'
import { api } from '../../services/api'
const blog = useBlogStore(), admin = useAdminStore(), route = useRoute(), router = useRouter()
const checking = ref(true), authError = ref(''), navOpen = ref(false)
const navigation = [
  { to: '/manage', label: '数据概览', icon: 'grid', exact: true },
  { to: '/manage/posts', label: '文章管理', icon: 'book' },
  { to: '/manage/users', label: '用户管理', icon: 'users' },
  { to: '/manage/categories', label: '分类管理', icon: 'folder' },
  { to: '/manage/tags', label: '标签管理', icon: 'tag' },
  { to: '/manage/links', label: '友情链接', icon: 'link' },
  { to: '/manage/settings', label: '系统配置', icon: 'settings' },
]
const title = computed(() => route.meta.title || '管理后台')
let disposed = false
onUnmounted(() => disposed = true)
async function checkAccess() {
  checking.value = true; authError.value = ''
  try {
    await blog.initialize({ admin: true })
    if (blog.demo) return
    const currentUser = await api.me()
    if (disposed) return
    blog.user = currentUser
  } catch (e) { reportError(e); if (!disposed) authError.value = e.message }
  finally { if (!disposed) checking.value = false }
}
checkAccess()
async function logout() { if (!blog.loggingOut && await blog.logout()) router.push('/login') }
</script>
<template>
  <div class="admin-shell">
    <aside class="admin-sidebar" :class="{ 'is-open': navOpen }">
      <RouterLink to="/manage" class="admin-brand" @click="navOpen = false"><span class="brand-mark"><Icon name="leaf" :size="25" /></span><span>拾光<span class="brand-dot">.</span></span></RouterLink>
      
      <nav aria-label="后台导航"><RouterLink v-for="item in navigation" :key="item.to" :to="item.to" :class="{ active: item.exact ? route.path === item.to : route.path.startsWith(item.to) }" @click="navOpen = false"><Icon :name="item.icon" :size="18" />{{ item.label }}<span v-if="item.to === '/manage/posts' && !admin.errors.posts && !admin.loading.posts" class="admin-nav-count">{{ admin.pagination.posts.total }}</span></RouterLink></nav>
      <div class="admin-sidebar-bottom"><RouterLink to="/"><Icon name="external" :size="16" />返回博客</RouterLink></div>
    </aside>
    <Transition name="overlay"><button v-if="navOpen" class="admin-nav-overlay" aria-label="关闭后台导航" @click="navOpen = false"></button></Transition>
    <div class="admin-workspace">
      <header class="admin-topbar"><div><button class="icon-button admin-nav-toggle" aria-label="展开后台导航" :aria-expanded="navOpen" @click="navOpen = !navOpen"><Icon name="menu" /></button><span>管理后台</span><span class="admin-breadcrumb-slash">/</span><strong>{{ title }}</strong></div><div><RouterLink to="/" class="admin-site-link"><Icon name="external" :size="15" />查看站点</RouterLink><AccountMenu v-if="blog.user" :user="blog.user" :busy="blog.loggingOut" @logout="logout" @open="navOpen = false" /></div></header>
      <main class="admin-content">
        <div v-if="checking" class="empty-state panel" aria-busy="true"><span class="spinner"></span><p>加载中…</p></div>
        <div v-else-if="authError" class="empty-state panel"><Icon name="alert" :size="32" /><div class="button-row"><button class="button secondary" @click="checkAccess">重试</button><RouterLink :to="{ name: 'login', query: { redirect: route.fullPath } }" class="button primary">重新登录</RouterLink></div></div>
        <div v-else-if="!admin.allowed" class="empty-state panel"><Icon name="alert" :size="32" /><h2>需要管理员账户</h2><p>请使用管理员账户登录后管理站点。</p><RouterLink :to="{ name: 'login', query: { redirect: route.fullPath } }" class="button primary">去登录</RouterLink></div>
        <RouteOutlet v-else />
      </main>
      
    </div>
  </div>
</template>
