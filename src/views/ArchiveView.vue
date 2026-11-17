<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import Icon from '../components/AppIcon.vue'
import { useBlogStore } from '../stores/blog'
import { dateLabel } from '../utils/format'
const blog = useBlogStore()
const groups = computed(() => {
  const result = new Map()
  for (const post of [...blog.posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))) {
    const date = new Date(post.createdAt)
    const key = Number.isNaN(date.getTime()) ? '未记录日期' : `${date.getFullYear()} 年 ${String(date.getMonth() + 1).padStart(2, '0')} 月`
    if (!result.has(key)) result.set(key, [])
    result.get(key).push(post)
  }
  return [...result]
})
</script>
<template><div class="standard-page archive-page"><div class="page-heading"><div class="eyebrow">LITTLE MOMENTS, LONG MEMORIES</div><h1>时间的<span class="serif-emphasis">足迹。</span></h1><p>那些写下的日子，都在这里。共 {{ blog.posts.length }} 篇记录。</p></div><div v-if="blog.loading || !blog.initialized" class="empty-state" aria-busy="true"><span class="spinner"></span><p>正在整理时光…</p></div><div v-else-if="blog.error" class="empty-state panel"><p>{{ blog.error }}</p><button class="button secondary" @click="blog.refresh">重新加载</button></div><div v-else-if="!blog.canRead" class="empty-state panel"><Icon name="clock" :size="36" /><h2>登录，翻开你的时光册。</h2><p>归档展示当前账户有权限访问的文章。</p><RouterLink :to="{ name: 'login', query: { redirect: '/archive' } }" class="button primary">去登录</RouterLink></div><div v-else-if="!groups.length" class="empty-state panel"><h2>时间的故事，等你落笔。</h2><RouterLink to="/write" class="button primary">写第一篇文章</RouterLink></div><section v-for="[month, posts] in groups" :key="month" class="archive-group"><div class="archive-month"><h2>{{ month }}</h2><small>{{ posts.length }} 篇文章</small></div><RouterLink v-for="post in posts" :key="post.id" :to="`/posts/${post.id}`" class="archive-entry"><time>{{ dateLabel(post.createdAt, true) }}</time><span class="timeline-dot"></span><h3>{{ post.title }}</h3><span class="category-label">{{ blog.categoryName(post.categoryId) }}</span><span v-if="post.status !== 1" class="status-badge">{{ post.status === 0 ? '草稿' : '私密' }}</span><Icon name="arrow" :size="18" /></RouterLink></section></div></template>
