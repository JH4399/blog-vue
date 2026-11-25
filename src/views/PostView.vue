<script setup>
import { reportError } from '../services/errors'
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Icon from '../components/AppIcon.vue'
import PostCover from '../components/PostCover.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useBlogStore } from '../stores/blog'
import { api } from '../services/api'
import { dateLabel, readingTime } from '../utils/format'
import { markdown, headings } from '../utils/markdown'
const blog = useBlogStore(), route = useRoute(), router = useRouter()
const post = ref(null), tags = ref([]), comments = ref([]), loading = ref(true), error = ref(''), commentError = ref(''), tagError = ref('')
const categoryLabel = ref('')
const content = ref(''), reply = ref(null), sending = ref(false), deleting = ref(false), deleteTarget = ref(null)
let version = 0, ready = false, disposed = false
onUnmounted(() => { disposed = true; version++ })
const rendered = computed(() => markdown(post.value?.content)), toc = computed(() => headings(post.value?.content))
const canEdit = computed(() => !blog.demo && blog.user && (blog.user.role === 2 || blog.user.id === post.value?.userId))
async function loadComments() {
  if (blog.demo) return
  const current = version
  commentError.value = ''
  try { const result = await api.list('comments', `?postId=${route.params.id}`); if (current === version) comments.value = result || [] }
  catch (e) { reportError(e); if (current === version) commentError.value = e.message }
}
async function load() {
  const current = ++version
  loading.value = true; error.value = ''; post.value = null; comments.value = []; commentError.value = ''; tags.value = []; tagError.value = ''; reply.value = null; content.value = ''
  try {
    const cached = blog.posts.find(p => String(p.id) === String(route.params.id))
    const result = blog.demo ? cached : await api.readPost(route.params.id, { privatePreview: !!cached && cached.status !== 1 })
    if (current !== version) return
    if (!result) throw new Error('这篇文章不存在，或已经被移走了。')
    post.value = result
    if (!blog.demo && cached) cached.viewCount = result.viewCount
    categoryLabel.value = result.categoryName || ''
    if (!categoryLabel.value && result.categoryId && !blog.categories.some(category => category.id === result.categoryId)) {
      api.get('categories', result.categoryId).then(category => { if (current === version) categoryLabel.value = category.name }).catch(e => reportError(e))
    }
    document.title = `${result.title} · 拾光`
    if (blog.demo) tags.value = blog.tags.filter(t => result.tagIds?.includes(t.id))
    else {
      const associations = blog.user ? api.list('post-tags', `?postId=${result.id}`).then(async rows => {
        const resolved = await Promise.all(rows.map(row => blog.tags.find(t => t.id === row.tagId) || api.get('tags', row.tagId)))
        if (current === version) tags.value = resolved.filter(Boolean)
      }).catch(e => { reportError(e); if (current === version) tagError.value = e.message }) : Promise.resolve()
      await Promise.all([loadComments(), associations])
    }
  } catch (e) { reportError(e); if (current === version) error.value = e.message }
  finally { if (current === version) loading.value = false }
}
watch([() => blog.demo, () => route.params.id], () => { if (ready) load() })
watch(() => blog.user?.id, (id, previous) => {
  if (!ready || id === previous) return
  version++; comments.value = []; commentError.value = ''; tags.value = []; loading.value = false
  reply.value = null; content.value = ''; deleteTarget.value = null
  if (post.value?.status !== 1) post.value = null
  if (id) load()
  else if (post.value) loadComments()
})
onMounted(async () => {
  await blog.initialize()
  if (disposed) return
  ready = true; await load()
})
async function submitComment() {
  if (!content.value.trim() || !blog.user || blog.demo || sending.value) return
  sending.value = true
  try {
    const result = await api.create('comments', { postId: post.value.id, parentId: reply.value?.id || null, content: content.value.trim() })
    comments.value.push(result); content.value = ''; reply.value = null
    blog.notify('评论已发表。')
  } catch (e) { reportError(e) }
  finally { sending.value = false }
}
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await api.remove(deleteTarget.value.type, deleteTarget.value.id)
    if (deleteTarget.value.type === 'posts') { blog.posts = blog.posts.filter(p => p.id !== post.value.id); router.push('/') }
    else comments.value = comments.value.filter(c => c.id !== deleteTarget.value.id)
    deleteTarget.value = null; blog.notify('已删除')
  } catch (e) { reportError(e) }
  finally { deleting.value = false }
}
function jump(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
</script>
<template><div class="reading-page"><RouterLink to="/" class="back-link"><Icon name="back" :size="17" />返回全部文章</RouterLink><div v-if="loading" class="reading-loading empty-state" aria-busy="true"><span class="spinner"></span><p>加载中…</p></div><section v-else-if="error" class="empty-state panel"><Icon name="alert" :size="34" /><button class="button secondary" @click="load">重新加载</button></section><section v-else-if="!post && !blog.user" class="empty-state panel"><Icon name="book" :size="34" /><h2>登录后，继续阅读。</h2><RouterLink :to="{ name: 'login', query: { redirect: route.fullPath } }" class="button primary">去登录</RouterLink></section><div v-else-if="post" class="reading-layout"><article class="article-paper"><header class="article-header"><div class="eyebrow">{{ categoryLabel || blog.categoryName(post.categoryId) }}<span v-if="post.status !== 1" class="status-badge">{{ post.status === 0 ? '草稿' : '私密' }}</span><span v-if="blog.demo">示例文章</span></div><h1>{{ post.title }}</h1><p v-if="post.summary" class="article-summary">{{ post.summary }}</p><div class="article-meta"><span>{{ dateLabel(post.publishedAt || post.createdAt) }}</span><span><Icon name="clock" :size="14" />{{ readingTime(post.content) }} 分钟阅读</span><span><Icon name="eye" :size="15" />{{ post.viewCount || 0 }}</span><div v-if="canEdit" class="article-tools"><RouterLink :to="`/write/${post.id}`"><Icon name="edit" :size="15" />编辑</RouterLink><button @click="deleteTarget = { type: 'posts', id: post.id }"><Icon name="trash" :size="15" />删除</button></div></div></header><PostCover :post="post" /><div class="prose" v-html="rendered"></div><div class="tag-cloud article-tags"><RouterLink v-for="tag in tags" :key="tag.id" :to="{ path: '/', query: { tag: tag.id } }"># {{ tag.name }}</RouterLink></div><button v-if="tagError" class="button secondary small" @click="load">重试标签</button>
<section class="comments-section"><h2>评论 <span class="count-pill">{{ comments.length }}</span></h2><p v-if="blog.demo" class="inline-note">示例模式仅供阅读，登录真实博客后即可发表评论。</p><p v-else-if="!blog.user" class="inline-note"><RouterLink :to="{ name: 'login', query: { redirect: route.fullPath } }">登录后发表评论</RouterLink></p><form v-else @submit.prevent="submitComment"><div v-if="reply" class="reply-note">回复 {{ reply.nickname }}<button type="button" class="icon-button" aria-label="取消回复" @click="reply = null"><Icon name="close" :size="14" /></button></div><label class="sr-only" for="comment-content">评论内容</label><textarea id="comment-content" v-model="content" rows="4" placeholder="评论内容" required :disabled="sending"></textarea><div class="comment-submit"><small>评论发布后立即可见。</small><button class="button primary small" :disabled="sending || !content.trim()">{{ sending ? '提交中…' : '发送评论' }}<Icon name="arrow" :size="15" /></button></div></form><div v-if="commentError" class="inline-error"><button class="button secondary small" @click="loadComments">重试评论</button></div><div v-for="comment in comments" :key="comment.id" class="comment-item" :class="{ 'is-reply': comment.parentId }"><span class="mini-avatar">{{ (comment.nickname || '访客').slice(0, 1) }}</span><div><header><b>{{ comment.nickname }}</b><small>{{ dateLabel(comment.createdAt) }}</small></header><small v-if="comment.parentId" class="muted">回复 {{ comments.find(c => c.id === comment.parentId)?.nickname || '评论' }}</small><p>{{ comment.content }}</p><div v-if="blog.user && !blog.demo" class="comment-actions"><button @click="reply = comment; jump('comment-content')">回复</button><button v-if="canEdit || blog.user?.id === comment.userId" @click="deleteTarget = { type: 'comments', id: comment.id }">删除</button></div></div></div><p v-if="!comments.length && !commentError" class="no-comments">暂无评论</p></section></article><aside v-if="toc.length" class="reading-sidebar"><h3>文章目录</h3><nav aria-label="文章目录"><button v-for="heading in toc" :key="heading.id" :class="{ nested: heading.level > 2 }" @click="jump(heading.id)">{{ heading.text }}</button></nav></aside></div><ConfirmDialog :open="!!deleteTarget" :busy="deleting" :title="deleteTarget?.type === 'posts' ? '删除这篇文章？' : '删除这条评论？'" :message="deleteTarget?.type === 'posts' ? '删除后文章将不再展示，请确认你已保存需要的内容。' : '删除后无法恢复。有回复的评论需要先删除回复。'" @close="deleteTarget = null" @confirm="confirmDelete" /></div></template>
