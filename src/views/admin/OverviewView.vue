<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import Icon from '../../components/AppIcon.vue'
import { useAdminStore } from '../../stores/admin'
import { numberLabel, postStatusLabel } from '../../utils/admin'
import { dateLabel } from '../../utils/format'
const admin = useAdminStore()
const totals = computed(() => admin.summary)
const cards = computed(() => [
  { label: '全部文章', value: totals.value.posts, icon: 'book', detail: `已发布 ${totals.value.published} 篇`, failed: admin.errors.summary },
  { label: '注册用户', value: totals.value.users, icon: 'users', detail: `正常 ${totals.value.activeUsers} 位`, failed: admin.errors.summary },
  { label: '文章浏览', value: totals.value.views, icon: 'eye', detail: '', failed: admin.errors.summary },
  { label: '获得点赞', value: totals.value.likes, icon: 'heart', detail: '', failed: admin.errors.summary },
])
const recent = computed(() => admin.summary.recent || [])
onMounted(() => admin.loadSummary())
onUnmounted(() => admin.invalidate('summary'))
</script>
<template><section><div class="admin-page-heading"><div><h1>站点概览</h1></div><button class="button secondary small" :disabled="admin.loading.summary" @click="admin.refresh()"><Icon name="refresh" :size="15" />刷新数据</button></div><div v-if="admin.errors.summary" class="inline-error" role="alert"><button class="button secondary small" @click="admin.loadSummary()">重试</button></div><div class="admin-stat-grid"><div v-for="card in cards" :key="card.label" class="admin-stat-card"><div><span>{{ card.label }}</span><Icon :name="card.icon" :size="20" /></div><strong>{{ admin.loading.summary ? '…' : card.failed ? '—' : numberLabel(card.value) }}</strong><small v-if="card.detail && !card.failed">{{ card.failed ? '数据暂不可用' : card.detail }}</small></div></div><div class="admin-overview-grid"><section class="panel admin-panel"><header><div><h2>最近的文章</h2></div><RouterLink to="/manage/posts" class="text-link">管理全部 <Icon name="arrow" :size="16" /></RouterLink></header><div v-if="!recent.length" class="empty-state"><p v-if="!admin.errors.summary">暂无文章</p></div><RouterLink v-for="post in recent" :key="post.id" :to="`/manage/posts/${post.id}/edit`" class="admin-recent-post"><div><h3>{{ post.title }}</h3><small>{{ post.authorName || admin.authorName(post.userId) }} · {{ dateLabel(post.createdAt) }}</small></div><span class="admin-badge" :class="`post-state-${post.status}`">{{ postStatusLabel(post.status) }}</span></RouterLink></section><section class="panel admin-panel admin-shortcuts"><header><div><h2>内容整理</h2></div><Icon name="leaf" :size="23" /></header><RouterLink to="/manage/categories"><span class="category-symbol"><Icon name="folder" :size="18" /></span><div><strong>文章分类</strong><small>{{ totals.categories }} 个分类</small></div><Icon name="chevron" :size="16" /></RouterLink><RouterLink to="/manage/tags"><span class="category-symbol symbol-2"><Icon name="tag" :size="18" /></span><div><strong>标签</strong><small>{{ totals.tags }} 个标签</small></div><Icon name="chevron" :size="16" /></RouterLink><RouterLink to="/manage/users"><span class="category-symbol symbol-1"><Icon name="users" :size="18" /></span><div><strong>用户与权限</strong></div><Icon name="chevron" :size="16" /></RouterLink></section></div></section></template>
