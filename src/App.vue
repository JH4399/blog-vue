<script setup>
import { ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import RouteOutlet from './components/RouteOutlet.vue'
import Icon from './components/AppIcon.vue'
import AccountMenu from './components/AccountMenu.vue'
import { useBlogStore } from './stores/blog'
import { errorEntries } from './services/errors'
const blog = useBlogStore()
const route = useRoute()
const router = useRouter()
const menuOpen = ref(false)
const year = new Date().getFullYear()
document.documentElement.dataset.theme = 'light'
watch(() => !!route.meta.admin, admin => blog.initialize({ admin }), { immediate: true })
async function logout() {
  if (blog.loggingOut) return
  if (await blog.logout()) router.push('/')
}
</script>
<template>
  <div class="site-shell" :class="{ 'admin-mode': route.meta.admin }">
    <header v-if="!route.meta.admin" class="site-header">
      <RouterLink to="/" class="brand" @click="menuOpen = false"><span class="brand-mark"><Icon name="leaf" /></span><span>拾光<span class="brand-dot">.</span></span></RouterLink>
      <nav class="main-nav" :class="{ open: menuOpen }" aria-label="主导航" @click="menuOpen = false">
        <RouterLink to="/" :class="{ active: route.name === 'home' || route.name === 'post' }">文章</RouterLink>
        <RouterLink to="/archive" active-class="active">归档</RouterLink><RouterLink to="/links" active-class="active">友链</RouterLink><RouterLink to="/about" active-class="active">关于</RouterLink>
      </nav>
      <div class="header-actions">
        <template v-if="blog.user"><RouterLink v-if="blog.user.role === 2" to="/manage" class="subtle-link">管理</RouterLink><AccountMenu :user="blog.user" :busy="blog.loggingOut" @open="menuOpen = false" @logout="logout" /></template>
        <RouterLink v-else to="/login" class="subtle-link">登录</RouterLink>
        <button class="icon-button mobile-menu" aria-label="打开导航" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen"><Icon name="menu" /></button>
      </div>
    </header>
    <div v-if="blog.demo && !route.meta.admin" class="demo-banner"><span>示例模式 · 只读</span><button @click="blog.setDemo(false)">退出示例 <Icon name="arrow" /></button></div>
    <component :is="route.meta.admin ? 'div' : 'main'" :class="route.meta.admin ? 'admin-route' : 'site-main'"><RouteOutlet shell /></component>
    <footer v-if="!route.meta.admin" class="site-footer"><small>© {{ year }} 拾光</small></footer>
    <Transition name="toast"><div v-if="blog.notice && !errorEntries.length" class="toast-message" :class="blog.notice.type" role="status"><Icon :name="blog.notice.type === 'error' ? 'alert' : 'check'" />{{ blog.notice.message }}<button class="icon-button" aria-label="关闭提示" @click="blog.notice = null"><Icon name="close" /></button></div></Transition>
  </div>
</template>
