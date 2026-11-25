<script setup>
import AppSelect from '../../components/AppSelect.vue'
import { reportError } from '../../services/errors'
import { reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import Icon from '../../components/AppIcon.vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'
import { useAdminStore } from '../../stores/admin'
import { useBlogStore } from '../../stores/blog'
import { api } from '../../services/api'
import { dateLabel } from '../../utils/format'
import { numberLabel, postStatusLabel } from '../../utils/admin'
import { useAdminPage } from '../../composables/useAdminPage'
import PageNavigation from '../../components/admin/PageNavigation.vue'
import PagedLookup from '../../components/admin/PagedLookup.vue'
const admin = useAdminStore(), blog = useBlogStore()
const filters = reactive({ q: '', status: '', categoryId: '', authorId: '', sort: 'newest' })
const deleteTarget = ref(null), busy = ref(false)
const { rows: visible, pagination, loading, pending, error, load } = useAdminPage('posts', filters)
async function remove() {
  if (!deleteTarget.value || busy.value || !admin.allowed) return
  busy.value = true
  try {
    const id = deleteTarget.value.id
    await api.remove('posts', id)
    blog.posts = blog.posts.filter(post => post.id !== id)
    deleteTarget.value = null; blog.invalidateContent(); await load(); blog.notify('文章已删除')
  } catch (e) { reportError(e) }
  finally { busy.value = false }
}
</script>
<template><section><div class="admin-page-heading"><div><h1>文章管理 <span class="count-pill">{{ pagination.total }}</span></h1></div><div class="button-row"><button class="button secondary small" :disabled="loading || pending || busy" @click="load()"><Icon name="refresh" :size="15" />刷新</button><RouterLink to="/manage/posts/new" class="button primary small"><Icon name="edit" :size="15" />新建文章</RouterLink></div></div><div class="admin-filter-bar panel"><label class="search-field"><Icon name="search" :size="17" /><input v-model="filters.q" maxlength="200" placeholder="搜索标题、别名或作者…" aria-label="搜索全部文章"></label><AppSelect v-model="filters.status" aria-label="筛选发布状态" :options="[{ value: '', label: '全部状态' }, { value: '1', label: '已发布' }, { value: '0', label: '草稿' }, { value: '2', label: '私密' }]" /><PagedLookup v-model="filters.categoryId" resource="categories" placeholder="全部分类" /><PagedLookup v-model="filters.authorId" resource="users" placeholder="全部作者" /><AppSelect v-model="filters.sort" aria-label="排序文章" :options="[{ value: 'newest', label: '最新创建' }, { value: 'views', label: '浏览数最多' }, { value: 'likes', label: '点赞数最多' }]" /></div><div v-if="error" class="inline-error" role="alert"><button class="button secondary small" @click="load()">重试</button></div><div v-else-if="loading || pending" class="empty-state panel" aria-busy="true"><span class="spinner"></span><p>正在加载当前页文章…</p></div><div v-else class="panel admin-table-panel"><div class="admin-table-scroll"><table class="admin-data-table posts-table"><thead><tr><th>文章</th><th>作者</th><th>分类 / 状态</th><th><Icon name="eye" :size="14" /> 浏览</th><th><Icon name="heart" :size="14" /> 点赞</th><th><Icon name="comment" :size="14" /> 评论</th><th>创建日期</th><th>操作</th></tr></thead><tbody><tr v-for="post in visible" :key="post.id"><td><RouterLink :to="`/posts/${post.id}`" class="admin-post-title">{{ post.title }}</RouterLink><small>#{{ post.id }} · {{ post.slug }} <span v-if="post.isTop" class="admin-top-label">置顶</span></small></td><td><span class="admin-author-name">{{ post.authorName || admin.authorName(post.userId) }}</span><small>用户 #{{ post.userId }}</small></td><td><span class="admin-category-text">{{ post.categoryName || '未分类' }}</span><span class="admin-badge" :class="`post-state-${post.status}`">{{ postStatusLabel(post.status) }}</span></td><td class="numeric-cell">{{ numberLabel(post.viewCount) }}</td><td class="numeric-cell">{{ numberLabel(post.likeCount) }}</td><td class="numeric-cell">{{ numberLabel(post.commentCount) }}</td><td class="admin-date-cell">{{ dateLabel(post.createdAt) }}</td><td><div class="admin-row-actions"><RouterLink :to="`/manage/posts/${post.id}/edit`">编辑</RouterLink><button class="danger-text" :disabled="busy" @click="deleteTarget = post">删除</button></div></td></tr></tbody></table></div><div v-if="!visible.length" class="empty-state"><Icon name="book" :size="30" /><h3>{{ filters.q || filters.status || filters.categoryId || filters.authorId ? '没有匹配的文章' : '还没有文章' }}</h3></div><PageNavigation :pagination="pagination" :busy="loading || pending || busy" @change="load" /></div><ConfirmDialog :open="!!deleteTarget" :busy="busy" title="删除这篇文章？" :message="`“${deleteTarget?.title || ''}”删除后将不再展示，文章内容及关联数据由后端保留。`" @close="deleteTarget = null" @confirm="remove" /></section></template>
