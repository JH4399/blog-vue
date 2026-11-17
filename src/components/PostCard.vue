<script setup>
import { RouterLink } from 'vue-router'
import Icon from './AppIcon.vue'
import PostCover from './PostCover.vue'
import { useBlogStore } from '../stores/blog'
import { dateLabel, readingTime, excerpt } from '../utils/format'
defineProps({ post: Object, index: { type: Number, default: 0 } })
const blog = useBlogStore()
</script>
<template><article class="post-card"><RouterLink :to="`/posts/${post.id}`" class="card-cover-link" tabindex="-1" aria-hidden="true"><PostCover :post="post" :variant="index" /><span v-if="post.isTop" class="pin-badge"><Icon name="pin" :size="13" />置顶</span></RouterLink><div class="card-body"><div class="card-eyebrow"><span class="category-label">{{ blog.categoryName(post.categoryId) }}</span><span>{{ dateLabel(post.publishedAt || post.createdAt) }}</span><span v-if="post.status !== 1" class="status-badge">{{ post.status === 0 ? '草稿' : '私密' }}</span></div><h3><RouterLink :to="`/posts/${post.id}`">{{ post.title }}</RouterLink></h3><p>{{ excerpt(post) }}</p><div class="card-footer"><span><Icon name="clock" :size="14" />{{ readingTime(post.content) }} 分钟阅读</span><div><span><Icon name="eye" :size="15" />{{ post.viewCount || 0 }}</span><span><Icon name="comment" :size="14" />{{ post.commentCount || 0 }}</span></div><RouterLink :to="`/posts/${post.id}`" class="read-arrow" :aria-label="`阅读 ${post.title}`"><Icon name="arrow" :size="18" /></RouterLink></div></div></article></template>
