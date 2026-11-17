<script setup>
import { ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import Icon from './components/AppIcon.vue'
import AccountMenu from './components/AccountMenu.vue'
import { useBlogStore } from './stores/blog'
const blog = useBlogStore()
const route = useRoute()
const router = useRouter()
const menuOpen = ref(false)
const dark = ref(localStorage.getItem('fieldnotes-theme') === 'dark')
const year = new Date().getFullYear()
function toggleTheme() {
  dark.value = !dark.value
  document.documentElement.dataset.theme = dark.value ? 'dark' : 'light'
  localStorage.setItem('fieldnotes-theme', dark.value ? 'dark' : 'light')
}
document.documentElement.dataset.theme = dark.value ? 'dark' : 'light'
blog.initialize()
async function logout() {
  if (blog.loggingOut) return
  if (await blog.logout()) router.push('/')
}
</script>
<template>
  <div class="site-shell">
    <header class="site-header">
      <RouterLink to="/" class="brand" @click="menuOpen = false"><span class="brand-mark"><Icon name="leaf" /></span><span>拾光<span class="brand-dot">.</span><small>FIELD NOTES</small></span></RouterLink>
      <nav class="main-nav" :class="{ open: menuOpen }" aria-label="主导航" @click="menuOpen = false">
        <RouterLink to="/" :class="{ active: route.name === 'home' || route.name === 'post' }">文章</RouterLink>
        <RouterLink to="/archive" active-class="active">归档</RouterLink><RouterLink to="/links" active-class="active">友链</RouterLink><RouterLink to="/about" active-class="active">关于</RouterLink>
      </nav>
      <div class="header-actions">
        <button class="icon-button theme-toggle" :aria-label="dark ? '切换浅色模式' : '切换深色模式'" @click="toggleTheme"><Icon :name="dark ? 'sun' : 'moon'" /></button><span class="header-divider"></span>
        <template v-if="blog.user"><RouterLink v-if="blog.user.role === 2" to="/manage" class="subtle-link">管理</RouterLink><AccountMenu :user="blog.user" :busy="blog.loggingOut" @open="menuOpen = false" @logout="logout" /></template>
        <RouterLink v-else to="/login" class="subtle-link">登录</RouterLink>
        <RouterLink to="/write" class="button primary small"><Icon name="edit" />写文章</RouterLink><button class="icon-button mobile-menu" aria-label="打开导航" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen"><Icon name="menu" /></button>
      </div>
    </header>
    <div v-if="blog.demo" class="demo-banner"><span>示例预览 · 当前内容为本地示例，写入操作已关闭</span><button @click="blog.setDemo(false)">连接我的博客 <Icon name="arrow" /></button></div>
    <main><RouterView :key="route.path" /></main>
    <footer class="site-footer"><RouterLink to="/" class="footer-brand">拾光<span>.</span></RouterLink><span>把日常写成故事，让思考留下痕迹。</span><small>© {{ year }} 拾光 · 慢慢记录，慢慢生长 <Icon name="leaf" /></small></footer>
    <Transition name="toast"><div v-if="blog.notice" class="toast-message" :class="blog.notice.type" role="status"><Icon :name="blog.notice.type === 'error' ? 'alert' : 'check'" />{{ blog.notice.message }}<button class="icon-button" aria-label="关闭提示" @click="blog.notice = null"><Icon name="close" /></button></div></Transition>
  </div>
</template>
