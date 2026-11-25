<script setup>
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import Icon from '../components/AppIcon.vue'
import PostCover from '../components/PostCover.vue'
import { useBlogStore } from '../stores/blog'
import { dateLabel } from '../utils/format'
import ListPagination from '../components/ListPagination.vue'
import CollectionFrame from '../components/CollectionFrame.vue'
const blog = useBlogStore()
async function load(page = 1) { await blog.loadPosts({ page, q: '', status: '', categoryId: '', tagId: '', sort: 'newest' }) }
let disposed = false, ready = false
onMounted(async () => { await blog.initialize(); if (disposed) return; ready = true; if (!blog.demo) await load() })
watch(() => blog.user?.id, () => { if (ready && !blog.demo) load() })
onUnmounted(() => { disposed = true; blog.invalidatePosts() })
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
<template><div class="standard-page archive-page"><div class="page-heading"><h1>归档</h1><p>共 {{ blog.demo ? blog.posts.length : blog.postPagination.total }} 篇文章</p></div><CollectionFrame label="归档文章列表"><div v-if="blog.loading || !blog.initialized" class="empty-state" aria-busy="true"><span class="spinner"></span><p>加载中…</p></div><div v-else-if="blog.error" class="empty-state panel"><button class="button secondary" @click="load()">重新加载</button></div><div v-else-if="!groups.length" class="empty-state panel"><p>暂无文章</p><RouterLink v-if="blog.user" to="/write" class="button primary">写文章</RouterLink></div><template v-else><section v-for="[month, posts] in groups" :key="month" class="archive-group"><div class="archive-month"><h2>{{ month }}</h2><small>{{ posts.length }} 篇文章</small></div><RouterLink v-for="post in posts" :key="post.id" :to="`/posts/${post.id}`" class="archive-entry"><time>{{ dateLabel(post.createdAt, true) }}</time><span class="timeline-dot"></span><PostCover :post="post" /><h3>{{ post.title }}</h3><span class="category-label">{{ post.categoryName || blog.categoryName(post.categoryId) }}</span><span v-if="post.status !== 1" class="status-badge">{{ post.status === 0 ? '草稿' : '私密' }}</span><Icon name="arrow" :size="18" /></RouterLink></section></template><template #footer><ListPagination v-if="!blog.demo" :pagination="blog.postPagination" :busy="blog.loading" label="篇文章" @change="load" /></template></CollectionFrame></div></template>

<style scoped>
.archive-entry > .post-cover { flex: 0 0 72px; width: 72px; height: 48px; min-height: 0; border-radius: 5px; }
.archive-entry h3 { min-width: 0; overflow-wrap: anywhere; }
@media (max-width: 480px) {
  .archive-entry > .post-cover { flex-basis: 52px; width: 52px; height: 40px; }
}
</style>
