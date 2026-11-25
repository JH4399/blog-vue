<script setup>
import AppSelect from '../components/AppSelect.vue'
import { reportError } from '../services/errors'
import { computed, reactive, ref, watch, onUnmounted, nextTick } from 'vue'
import { RouterLink, onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import Icon from '../components/AppIcon.vue'
import { useBlogStore } from '../stores/blog'
import { useAdminStore } from '../stores/admin'
import { api, session } from '../services/api'
import { IMAGE_ACCEPT, imageUrl, imageMarkdown } from '../utils/images'
import PagedLookup from '../components/admin/PagedLookup.vue'
import PagedTags from '../components/admin/PagedTags.vue'
import { markdown } from '../utils/markdown'
const blog = useBlogStore(), route = useRoute(), router = useRouter()
const inAdmin = computed(() => !!route.meta.admin)
const backPath = computed(() => inAdmin.value ? '/manage/posts' : '/')
const form = reactive({ title: '', slug: '', summary: '', content: '', categoryId: null, coverImage: '', status: 1, isTop: 0 })
const selectedTags = ref([]), savedId = ref(route.params.id || null), loading = ref(true), saving = ref(false), error = ref(''), preview = ref(false), baseline = ref(''), recovered = ref(null), draftSaved = ref(false)
const snapshot = () => JSON.stringify({ ...form, tagIds: selectedTags.value })
const dirty = computed(() => !loading.value && snapshot() !== baseline.value)
const draftKey = computed(() => `fieldnotes-draft-${blog.user?.id}-${route.params.id || 'new'}`)
const loadFailed = ref(false)
const rendered = computed(() => markdown(form.content))
const wordCount = computed(() => form.content.replace(/\s/g, '').length)
const uploading = ref(''), imageError = ref(''), coverFailed = ref(false)
const contentInput = ref(null), bodyFileInput = ref(null), coverFileInput = ref(null)
const busy = computed(() => saving.value || !!uploading.value)
let selection = { start: 0, end: 0 }, disposed = false
watch(() => form.coverImage, () => coverFailed.value = false)
function chooseBodyImage() {
  const input = contentInput.value
  selection = { start: input?.selectionStart ?? form.content.length, end: input?.selectionEnd ?? form.content.length }
  bodyFileInput.value?.click()
}
async function uploadImage(event, target) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || busy.value || !blog.user || blog.demo) return
  const token = session.token
  uploading.value = target; imageError.value = ''
  try {
    const image = await api.uploadImage(file)
    if (disposed || session.token !== token || !blog.user) return
    if (target === 'cover') form.coverImage = image.url
    else {
      const before = form.content.slice(0, selection.start), after = form.content.slice(selection.end)
      const inserted = `${before && !before.endsWith('\n') ? '\n\n' : ''}${imageMarkdown(image)}\n\n`
      form.content = before + inserted + after
      preview.value = false
      await nextTick()
      contentInput.value?.focus()
      contentInput.value?.setSelectionRange(before.length + inserted.length, before.length + inserted.length)
    }
    blog.notify(target === 'cover' ? '封面已上传' : '图片已插入正文')
  } catch (e) { if (!disposed) { imageError.value = e.message; reportError(e) } }
  finally { uploading.value = '' }
}
let draftStorageFailed = false
function draftFailure(e) {
  draftSaved.value = false
  if (!draftStorageFailed) reportError(e, { message: '浏览器本地草稿读写失败，请及时保存文章到服务器。' })
  draftStorageFailed = true
}
function removeDraft() {
  try { localStorage.removeItem(draftKey.value); draftStorageFailed = false }
  catch (e) { draftFailure(e) }
}
async function load() {
  loading.value = true; loadFailed.value = false; error.value = ''
  await blog.initialize({ admin: inAdmin.value })
  if (!blog.user) { loading.value = false; return }
  try {
    if (savedId.value) {
      const post = await api.get('posts', savedId.value)
      Object.keys(form).forEach(key => form[key] = post[key] ?? ({ categoryId: null, status: 0, isTop: 0 }[key] ?? ''))
      selectedTags.value = (await api.list('post-tags', `?postId=${savedId.value}`)).map(t => t.tagId)
    }
    try { const draft = localStorage.getItem(draftKey.value); if (draft) recovered.value = JSON.parse(draft) } catch (e) { draftFailure(e) }
  } catch (e) { reportError(e); loadFailed.value = true; error.value = e.message }
  finally { baseline.value = snapshot(); loading.value = false }
}
load()
watch([form, selectedTags], () => {
  if (loading.value || !blog.user || blog.demo) return
  try { localStorage.setItem(draftKey.value, JSON.stringify({ ...form, tagIds: selectedTags.value, savedId: savedId.value, savedAt: Date.now() })); draftSaved.value = true; draftStorageFailed = false } catch (e) { draftFailure(e) }
}, { deep: true, flush: 'sync' })
function restore() {
  if (!recovered.value) return
  Object.keys(form).forEach(key => { if (key in recovered.value) form[key] = recovered.value[key] })
  selectedTags.value = recovered.value.tagIds || []; savedId.value = recovered.value.savedId || savedId.value; recovered.value = null
}
function discardDraft() { removeDraft(); recovered.value = null }
function makeSlug() {
  if (!form.slug) form.slug = form.title.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 185) + '-' + Date.now().toString(36)
}
async function save(status) {
  if (busy.value || blog.demo || loadFailed.value) return
  if (!blog.user) { router.push({ name: 'login', query: { redirect: route.fullPath } }); return }
  if (form.coverImage.trim() && !imageUrl(form.coverImage)) { error.value = '请上传封面图片，或填写有效的 HTTP(S) 图片地址。'; reportError(error.value); return }
  if (!form.title.trim() || !form.content.trim()) { error.value = '请填写文章标题和正文。'; reportError(error.value); return }
  makeSlug(); error.value = ''; saving.value = true
  let postSaved = false
  try {
    const body = { ...form, title: form.title.trim(), slug: form.slug.trim(), summary: form.summary || null, coverImage: form.coverImage.trim() || null, categoryId: form.categoryId || null, status }
    const result = savedId.value ? await api.update('posts', savedId.value, body) : await api.create('posts', body)
    savedId.value = result.id; form.status = result.status; postSaved = true
    // Keep the assigned ID locally even if tag synchronization fails.
    try { localStorage.setItem(draftKey.value, JSON.stringify({ ...form, tagIds: selectedTags.value, savedId: result.id, savedAt: Date.now() })); draftStorageFailed = false } catch (e) { draftFailure(e) }
    const currentTags = (await api.list('post-tags', `?postId=${result.id}`)).map(t => t.tagId)
    for (const tagId of currentTags.filter(id => !selectedTags.value.includes(id))) await api.remove('post-tags', `${result.id}/${tagId}`)
    for (const tagId of selectedTags.value.filter(id => !currentTags.includes(id))) await api.create('post-tags', { postId: result.id, tagId })
    baseline.value = snapshot(); removeDraft()
    blog.invalidateContent(); if (inAdmin.value) await useAdminStore().load('posts'); else await blog.loadPosts(); blog.notify(status === 0 ? '草稿已保存' : status === 2 ? '私密文章已保存。' : '文章已发布')
    router.replace(inAdmin.value ? '/manage/posts' : `/posts/${result.id}`)
  } catch (e) { reportError(e); error.value = postSaved ? `文章已保存，但标签尚未全部同步：${e.message}。再次保存可重试，不会重复创建文章。` : e.message; reportError(e, { message: error.value }) }
  finally { saving.value = false }
}
onBeforeRouteLeave(() => (!dirty.value && !uploading.value) || saving.value || window.confirm(uploading.value ? '图片正在上传，确定离开吗？' : '内容尚未保存到博客，确定离开吗？本地草稿会尽量保留。'))
function beforeUnload(event) { if (dirty.value || uploading.value) { event.preventDefault(); event.returnValue = '' } }
window.addEventListener('beforeunload', beforeUnload)
onUnmounted(() => { disposed = true; window.removeEventListener('beforeunload', beforeUnload) })
</script>
<template>
  <div class="editor-page">
    <div class="page-heading">
      <div><h1>{{ route.params.id ? '编辑文章' : '写文章' }}</h1></div>
      <RouterLink :to="backPath" class="back-link"><Icon name="back" :size="16" />{{ inAdmin ? '返回文章管理' : '回到首页' }}</RouterLink>
    </div>
    <div v-if="loading" class="empty-state" aria-busy="true"><span class="spinner"></span><p>加载中…</p></div>
    <div v-else-if="!blog.user || blog.demo" class="empty-state panel">
      <h2>{{ blog.demo ? '示例模式仅供阅读' : '请先登录，开始写作' }}</h2>
      <RouterLink :to="{ name: 'login', query: { redirect: route.fullPath } }" class="button primary">登录博客</RouterLink>
    </div>
    <div v-else-if="loadFailed" class="empty-state panel"><button class="button secondary" @click="load">重新加载</button></div>
    <form v-else @submit.prevent="save(form.status)">
      <div v-if="recovered" class="draft-notice">
        <span>发现一份本地草稿 · {{ new Date(recovered.savedAt).toLocaleString('zh-CN') }}</span>
        <div><button type="button" :disabled="busy" @click="restore">恢复草稿</button><button type="button" :disabled="busy" @click="discardDraft">忽略</button></div>
      </div>
      <div class="editor-layout">
        <section class="editor-paper">
          <label class="sr-only" for="post-title">文章标题</label>
          <input id="post-title" v-model="form.title" class="editor-title" required maxlength="200" placeholder="文章标题" :disabled="busy" @blur="makeSlug">
          <div class="editor-toolbar">
            <div class="editor-tabs">
              <button type="button" :class="{ selected: !preview }" @click="preview = false"><Icon name="edit" :size="15" />写作</button>
              <button type="button" :class="{ selected: preview }" @click="preview = true"><Icon name="eye" :size="16" />预览</button>
            </div>
            <div class="editor-image-tools">
              <input ref="bodyFileInput" class="sr-only" type="file" :accept="IMAGE_ACCEPT" aria-label="选择正文图片" :disabled="busy" @change="uploadImage($event, 'body')">
              <button type="button" class="button secondary small" :disabled="busy" :aria-busy="uploading === 'body'" @click="chooseBodyImage"><Icon name="image" :size="16" />{{ uploading === 'body' ? '上传中…' : '插入图片' }}</button>
              <small>Markdown · {{ wordCount }} 字</small>
            </div>
          </div>
          <p class="editor-upload-hint">图片支持 JPEG、PNG、WebP，单张不超过 5 MB。</p>
          <p v-if="imageError" class="editor-image-error" role="alert">{{ imageError }}</p>
          <p v-if="uploading" class="editor-upload-hint" role="status">{{ uploading === 'cover' ? '正在上传封面…' : '正在上传正文图片…' }}</p>
          <div v-if="preview" class="prose editor-preview" v-html="rendered || '<p>暂无内容</p>'"></div>
          <label v-else class="editor-content-label"><span class="sr-only">文章正文</span><textarea ref="contentInput" v-model="form.content" class="editor-content" placeholder="正文（Markdown）" :disabled="busy"></textarea></label>
          <div class="editor-bottom"><span class="online-dot"></span>{{ draftSaved ? '已在此浏览器保留本地草稿' : '未保存草稿' }}<span>{{ dirty ? '有未保存的修改' : '内容已同步' }}</span></div>
        </section>
        <aside class="editor-settings panel">
          <h3>文章设置</h3>
          <label>文章别名<input v-model="form.slug" required maxlength="200" placeholder="my-first-story" :disabled="busy"></label>
          <div v-if="!blog.demo" class="admin-editor-category"><span>所属分类</span><PagedLookup :disabled="busy" :model-value="form.categoryId" resource="categories" :placeholder="form.categoryId ? '分类 #' + form.categoryId : '未分类'" @update:model-value="form.categoryId = $event ? Number($event) : null" /></div>
          <label v-else>所属分类<AppSelect v-model="form.categoryId" label="所属分类" :disabled="busy" :options="[{ value: null, label: '未分类' }, ...blog.categories.map(category => ({ value: category.id, label: category.name }))]" /></label>
          <label>文章摘要<textarea v-model="form.summary" rows="4" maxlength="500" placeholder="文章摘要" :disabled="busy"></textarea><small>{{ form.summary.length }} / 500</small></label>
          <div class="editor-cover-field">
            <label for="post-cover">封面图片</label>
            <input id="post-cover" v-model="form.coverImage" type="text" inputmode="url" maxlength="255" placeholder="上传图片或填写 https://…（选填）" :disabled="busy">
            <div class="editor-cover-actions">
              <input ref="coverFileInput" class="sr-only" type="file" :accept="IMAGE_ACCEPT" aria-label="选择封面图片" :disabled="busy" @change="uploadImage($event, 'cover')">
              <button type="button" class="button secondary small" :disabled="busy" :aria-busy="uploading === 'cover'" @click="coverFileInput?.click()"><Icon name="image" :size="15" />{{ uploading === 'cover' ? '上传中…' : form.coverImage ? '更换封面' : '上传封面' }}</button>
              <button v-if="form.coverImage" type="button" class="button secondary small" :disabled="busy" @click="form.coverImage = ''">移除</button>
            </div>
            <img v-if="imageUrl(form.coverImage) && !coverFailed" :src="imageUrl(form.coverImage)" class="editor-cover-preview" alt="文章封面预览" @error="coverFailed = true">
            <small v-if="coverFailed" role="status">封面加载失败，请检查地址或重新上传。</small>
            <small>JPEG、PNG、WebP · 最大 5 MB</small>
          </div>
          <PagedTags v-if="!blog.demo" v-model="selectedTags" :disabled="busy" />
          <fieldset v-else class="tag-fieldset"><legend>标签</legend><label v-for="tag in blog.tags" :key="tag.id" class="checkbox-label"><input v-model="selectedTags" type="checkbox" :value="tag.id" :disabled="busy">{{ tag.name }}</label><small v-if="!blog.tags.length" class="muted">还没有标签，可由管理员添加。</small></fieldset>
          <label>发布状态<AppSelect v-model="form.status" label="发布状态" :disabled="busy" :options="[{ value: 1, label: '已发布' }, { value: 0, label: '草稿' }, { value: 2, label: '私密' }]" /></label>
          <label class="checkbox-label"><input v-model="form.isTop" type="checkbox" :true-value="1" :false-value="0" :disabled="busy">置顶这篇文章</label>
          <button type="submit" class="button primary full-width" :disabled="busy"><Icon name="check" :size="17" />{{ saving ? '保存中…' : form.status === 1 ? '发布文章' : '保存文章' }}</button>
          <button type="button" class="button secondary full-width" :disabled="busy" @click="save(0)"><Icon name="save" :size="17" />保存为草稿</button>
        </aside>
      </div>
    </form>
  </div>
</template>

<style scoped>
.editor-image-tools, .editor-cover-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.editor-toolbar { flex-wrap: wrap; gap: 10px; }
.editor-upload-hint, .editor-image-error { margin: 12px 25px 0; font-size: 11px; color: var(--muted); }
.editor-image-error { color: var(--danger, #b43b35); }
.editor-cover-field { display: flex; flex-direction: column; gap: 10px; margin-bottom: 22px; min-width: 0; }
.editor-cover-field > label { margin: 0; font-size: 12px; }
.editor-cover-field > input { width: 100%; min-width: 0; }
.editor-cover-field small { color: var(--muted); font-size: 10px; line-height: 1.8; }
.editor-cover-preview { display: block; width: 100%; max-height: 180px; object-fit: contain; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); }
@media (max-width: 480px) {
  .editor-toolbar { align-items: flex-start; }
  .editor-image-tools { gap: 8px; }
  .editor-upload-hint, .editor-image-error { margin-inline: 20px; }
}
</style>
