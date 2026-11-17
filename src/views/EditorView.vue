<script setup>
import { computed, reactive, ref, watch, onUnmounted } from 'vue'
import { RouterLink, onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import Icon from '../components/AppIcon.vue'
import { useBlogStore } from '../stores/blog'
import { api } from '../services/api'
import { markdown } from '../utils/markdown'
const blog = useBlogStore(), route = useRoute(), router = useRouter()
const form = reactive({ title: '', slug: '', summary: '', content: '', categoryId: null, coverImage: '', status: 1, isTop: 0 })
const selectedTags = ref([]), savedId = ref(route.params.id || null), loading = ref(true), saving = ref(false), error = ref(''), preview = ref(false), baseline = ref(''), recovered = ref(null), draftSaved = ref(false)
const snapshot = () => JSON.stringify({ ...form, tagIds: selectedTags.value })
const dirty = computed(() => !loading.value && snapshot() !== baseline.value)
const draftKey = computed(() => `fieldnotes-draft-${blog.user?.id}-${route.params.id || 'new'}`)
const loadFailed = ref(false)
const rendered = computed(() => markdown(form.content))
const wordCount = computed(() => form.content.replace(/\s/g, '').length)
async function load() {
  loading.value = true; loadFailed.value = false; error.value = ''
  await blog.initialize()
  if (!blog.user) { loading.value = false; return }
  try {
    if (savedId.value) {
      const post = await api.get('posts', savedId.value)
      Object.keys(form).forEach(key => form[key] = post[key] ?? ({ categoryId: null, status: 0, isTop: 0 }[key] ?? ''))
      selectedTags.value = (await api.list('post-tags', `?postId=${savedId.value}`)).map(t => t.tagId)
    }
    try { const draft = localStorage.getItem(draftKey.value); if (draft) recovered.value = JSON.parse(draft) } catch { /* A damaged local draft must not prevent writing. */ }
  } catch (e) { loadFailed.value = true; error.value = e.message }
  finally { baseline.value = snapshot(); loading.value = false }
}
load()
watch([form, selectedTags], () => {
  if (loading.value || !blog.user || blog.demo) return
  try { localStorage.setItem(draftKey.value, JSON.stringify({ ...form, tagIds: selectedTags.value, savedId: savedId.value, savedAt: Date.now() })); draftSaved.value = true } catch { draftSaved.value = false }
}, { deep: true, flush: 'sync' })
function restore() {
  if (!recovered.value) return
  Object.keys(form).forEach(key => { if (key in recovered.value) form[key] = recovered.value[key] })
  selectedTags.value = recovered.value.tagIds || []; savedId.value = recovered.value.savedId || savedId.value; recovered.value = null
}
function discardDraft() { localStorage.removeItem(draftKey.value); recovered.value = null }
function makeSlug() {
  if (!form.slug) form.slug = form.title.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 185) + '-' + Date.now().toString(36)
}
async function save(status) {
  if (saving.value || blog.demo || loadFailed.value) return
  if (!blog.user) { router.push({ name: 'login', query: { redirect: route.fullPath } }); return }
  if (form.coverImage && !/^https?:\/\//i.test(form.coverImage)) { error.value = '封面地址必须以 http:// 或 https:// 开头'; return }
  if (!form.title.trim() || !form.content.trim()) { error.value = '请填写文章标题和正文。'; return }
  makeSlug(); error.value = ''; saving.value = true
  let postSaved = false
  try {
    const body = { ...form, title: form.title.trim(), slug: form.slug.trim(), summary: form.summary || null, coverImage: form.coverImage || null, categoryId: form.categoryId || null, status }
    const result = savedId.value ? await api.update('posts', savedId.value, body) : await api.create('posts', body)
    savedId.value = result.id; form.status = result.status; postSaved = true
    // Keep the assigned ID locally even if tag synchronization fails.
    try { localStorage.setItem(draftKey.value, JSON.stringify({ ...form, tagIds: selectedTags.value, savedId: result.id, savedAt: Date.now() })) } catch { /* The server save has already succeeded. */ }
    const currentTags = (await api.list('post-tags', `?postId=${result.id}`)).map(t => t.tagId)
    for (const tagId of currentTags.filter(id => !selectedTags.value.includes(id))) await api.remove('post-tags', `${result.id}/${tagId}`)
    for (const tagId of selectedTags.value.filter(id => !currentTags.includes(id))) await api.create('post-tags', { postId: result.id, tagId })
    baseline.value = snapshot(); localStorage.removeItem(draftKey.value)
    await blog.loadPosts(); blog.notify(status === 0 ? '草稿已保存，灵感不会走丢。' : status === 2 ? '私密文章已保存。' : '文章已发布，新的故事开始了。')
    router.replace(`/posts/${result.id}`)
  } catch (e) { error.value = postSaved ? `文章已保存，但标签尚未全部同步：${e.message}。再次保存可重试，不会重复创建文章。` : e.message }
  finally { saving.value = false }
}
onBeforeRouteLeave(() => !dirty.value || saving.value || window.confirm('内容尚未保存到博客，确定离开吗？本地草稿会尽量保留。'))
function beforeUnload(event) { if (dirty.value) { event.preventDefault(); event.returnValue = '' } }
window.addEventListener('beforeunload', beforeUnload)
onUnmounted(() => window.removeEventListener('beforeunload', beforeUnload))
</script>
<template><div class="editor-page"><div class="page-heading"><div><div class="eyebrow">ROOM FOR YOUR THOUGHTS</div><h1>{{ route.params.id ? '打磨一段文字。' : '今天，想写点什么？' }}</h1><p>让灵感落笔，让想法有迹可循。</p></div><RouterLink to="/" class="back-link"><Icon name="back" :size="16" />回到首页</RouterLink></div><div v-if="loading" class="empty-state" aria-busy="true"><span class="spinner"></span><p>正在准备你的书桌…</p></div><div v-else-if="!blog.user || blog.demo" class="empty-state panel"><h2>{{ blog.demo ? '示例模式仅供阅读' : '请先登录，开始写作' }}</h2><RouterLink :to="{ name: 'login', query: { redirect: route.fullPath } }" class="button primary">登录博客</RouterLink></div><div v-else-if="loadFailed" class="empty-state panel"><h2>暂时无法载入文章</h2><p>{{ error }}</p><button class="button secondary" @click="load">重新加载</button></div><form v-else @submit.prevent="save(form.status)"><div v-if="recovered" class="draft-notice"><span>发现一份本地草稿 · {{ new Date(recovered.savedAt).toLocaleString('zh-CN') }}</span><div><button type="button" @click="restore">恢复草稿</button><button type="button" @click="discardDraft">忽略</button></div></div><div class="editor-layout"><section class="editor-paper"><label class="sr-only" for="post-title">文章标题</label><input id="post-title" v-model="form.title" class="editor-title" required maxlength="200" placeholder="给这个故事起个名字…" :disabled="saving" @blur="makeSlug"><div class="editor-toolbar"><div class="editor-tabs"><button type="button" :class="{ selected: !preview }" @click="preview = false"><Icon name="edit" :size="15" />写作</button><button type="button" :class="{ selected: preview }" @click="preview = true"><Icon name="eye" :size="16" />预览</button></div><small>Markdown · {{ wordCount }} 字</small></div><div v-if="preview" class="prose editor-preview" v-html="rendered || '<p>你的文字，将在这里展开。</p>'"></div><label v-else class="editor-content-label"><span class="sr-only">文章正文</span><textarea v-model="form.content" class="editor-content" placeholder="从一个小小的想法开始…&#10;&#10;## 一个新的章节&#10;&#10;支持 Markdown 标题、列表、引用、链接和代码块。" :disabled="saving"></textarea></label><div class="editor-bottom"><span class="online-dot"></span>{{ draftSaved ? '已在此浏览器保留本地草稿' : '静下心，慢慢写。' }}<span>{{ dirty ? '有未保存的修改' : '内容已同步' }}</span></div></section><aside class="editor-settings panel"><h3>文章设置</h3><label>文章别名<input v-model="form.slug" required maxlength="200" placeholder="my-first-story" :disabled="saving"><small>唯一的文章标识，首次填写标题后自动生成。</small></label><label>所属分类<select v-model="form.categoryId" :disabled="saving"><option :value="null">未分类</option><option v-for="category in blog.categories" :key="category.id" :value="category.id">{{ category.name }}</option></select></label><label>文章摘要<textarea v-model="form.summary" rows="4" maxlength="500" placeholder="用几句话介绍这篇文章…" :disabled="saving"></textarea><small>{{ form.summary.length }} / 500</small></label><label>封面图片<input v-model="form.coverImage" type="url" maxlength="255" placeholder="https://…（选填）" :disabled="saving"><small>留空时使用拾光的抽象插画封面。</small></label><fieldset class="tag-fieldset"><legend>灵感标签</legend><label v-for="tag in blog.tags" :key="tag.id" class="checkbox-label"><input v-model="selectedTags" type="checkbox" :value="tag.id" :disabled="saving">{{ tag.name }}</label><small v-if="!blog.tags.length" class="muted">还没有标签，可由管理员添加。</small></fieldset><label>发布状态<select v-model="form.status" :disabled="saving"><option :value="1">已发布</option><option :value="0">草稿</option><option :value="2">私密</option></select></label><label class="checkbox-label"><input v-model="form.isTop" type="checkbox" :true-value="1" :false-value="0" :disabled="saving">置顶这篇文章</label><p v-if="error" class="form-error" role="alert">{{ error }}</p><button type="submit" class="button primary full-width" :disabled="saving"><Icon name="check" :size="17" />{{ saving ? '保存中…' : form.status === 1 ? '发布文章' : '保存文章' }}</button><button type="button" class="button secondary full-width" :disabled="saving" @click="save(0)"><Icon name="save" :size="17" />保存为草稿</button></aside></div></form></div></template>
