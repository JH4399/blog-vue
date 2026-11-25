<script setup>
import Icon from '../components/AppIcon.vue'
import { useBlogStore } from '../stores/blog'
import ListPagination from '../components/ListPagination.vue'
import CollectionFrame from '../components/CollectionFrame.vue'
import { safeUrl, hostname } from '../utils/format'
const blog = useBlogStore()
</script>
<template>
  <div class="standard-page">
    <div class="page-heading"><h1>友链</h1></div>
    <CollectionFrame label="友情链接列表">
      <div v-if="!blog.initialized || blog.publicLoading.links" class="empty-state" aria-busy="true"><span class="spinner"></span><p>正在加载友链…</p></div>
      <div v-else-if="blog.publicErrors.links" class="empty-state"><button class="button secondary" @click="blog.loadPublicResource('links', blog.publicPagination.links.page)">重新加载</button></div>
      <div v-else-if="blog.links.length" class="links-grid">
        <a v-for="link in blog.links" :key="link.id" :href="safeUrl(link.url) || undefined" :aria-disabled="!safeUrl(link.url)" target="_blank" rel="noopener noreferrer" class="friend-card">
          <span class="friend-avatar">{{ link.name?.slice(0, 1) }}<img v-if="safeUrl(link.logo)" :src="safeUrl(link.logo)" alt="" loading="lazy" @error="$event.target.style.display = 'none'"></span>
          <div><h2>{{ link.name }}<Icon name="external" :size="16" /></h2><p v-if="link.description">{{ link.description }}</p><small>{{ hostname(link.url) }}</small></div>
        </a>
      </div>
      <div v-else class="empty-state panel"><Icon name="link" :size="34" /><p>暂无友链</p></div>
      <template #footer><ListPagination v-if="!blog.demo && blog.publicPagination.links.total" :pagination="blog.publicPagination.links" :busy="blog.publicLoading.links" @change="blog.loadPublicResource('links', $event)" /></template>
    </CollectionFrame>
  </div>
</template>
