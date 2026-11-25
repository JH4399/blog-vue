<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import Icon from '../components/AppIcon.vue'
import UserAvatar from '../components/UserAvatar.vue'
import { useBlogStore } from '../stores/blog'
import { api, session } from '../services/api'
import { reportError } from '../services/errors'
import { profilePayload } from '../utils/user'
import { IMAGE_ACCEPT, imageUrl } from '../utils/images'
import { roleLabel } from '../utils/admin'

const blog = useBlogStore()
const form = reactive({ nickname: '', email: '', avatar: '', bio: '' })
const loading = ref(true), saving = ref(false), uploading = ref(false), error = ref(''), loadedUserId = ref(null), avatarInput = ref(null)
const busy = computed(() => saving.value || uploading.value)
const ready = computed(() => !!blog.user && loadedUserId.value === blog.user.id && !blog.demo)
let version = 0
function reset() { Object.assign(form, profilePayload(blog.user || {})); error.value = '' }
watch(() => blog.user?.id, (id, previous) => {
  if (previous != null && id !== previous) {
    version++; loadedUserId.value = null; loading.value = false; saving.value = false; uploading.value = false
    Object.assign(form, { nickname: '', email: '', avatar: '', bio: '' })
  }
}, { flush: 'sync' })
onUnmounted(() => version++)
async function load() {
  const current = ++version
  loading.value = true; error.value = ''; loadedUserId.value = null
  try {
    await blog.initialize({ admin: true })
    if (current !== version || !blog.user || blog.demo) return
    const id = blog.user.id, token = session.token
    const user = await api.me()
    if (current !== version || blog.user?.id !== id || session.token !== token) return
    blog.user = user; loadedUserId.value = user.id; reset()
  } catch (e) { if (current === version) { reportError(e); error.value = e.message } }
  finally { if (current === version) loading.value = false }
}
async function save() {
  if (!ready.value || busy.value || loading.value || !session.token) return
  error.value = ''
  if (form.avatar && !imageUrl(form.avatar)) {
    error.value = '头像无效，请重新上传或移除头像。'
    reportError(error.value); return
  }
  const id = blog.user.id, token = session.token, current = version
  saving.value = true
  try {
    const user = await api.updateProfile(id, form)
    if (current !== version || blog.user?.id !== id || session.token !== token || blog.demo) return
    blog.user = user; reset(); blog.invalidateContent(); blog.notify('个人资料已保存')
  } catch (e) { if (current === version) { reportError(e); error.value = e.message } }
  finally { if (current === version) saving.value = false }
}
async function uploadAvatar(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || !ready.value || busy.value || loading.value || !session.token) return
  const id = blog.user.id, token = session.token, current = version
  uploading.value = true; error.value = ''
  try {
    const image = await api.uploadImage(file)
    if (current !== version || blog.user?.id !== id || session.token !== token || blog.demo) return
    form.avatar = image.url
  } catch (e) { if (current === version) { reportError(e); error.value = e.message } }
  finally { if (current === version) uploading.value = false }
}
onMounted(load)
</script>

<template>
  <section class="standard-page profile-page">
    <div class="page-heading"><h1>个人资料</h1><p>更新你的昵称、邮箱、头像与个人简介。</p></div>
    <div v-if="loading" class="empty-state panel" aria-busy="true"><span class="spinner"></span><p>正在加载个人资料…</p></div>
    <div v-else-if="!ready" class="empty-state panel">
      <Icon name="users" :size="30" />
      <template v-if="error"><p role="alert">{{ error }}</p><button class="button secondary" @click="load">重新加载</button></template>
      <template v-else><h2>请登录后修改个人资料</h2><RouterLink :to="{ name: 'login', query: { redirect: '/profile' } }" class="button primary">去登录</RouterLink></template>
    </div>
    <form v-else class="panel profile-form" @submit.prevent="save">
      <div class="profile-account"><UserAvatar :src="blog.user.avatar" :name="blog.user.nickname || blog.user.username" :size="42" alt="当前头像" /><div><strong>@{{ blog.user.username }}</strong><small>{{ roleLabel(blog.user.role) }} · #{{ blog.user.id }}</small></div></div>
      <fieldset :disabled="busy">
        <div class="profile-wide avatar-field">
          <UserAvatar :src="form.avatar" :name="form.nickname || blog.user.username" :size="72" alt="头像预览" />
          <div class="avatar-controls">
            <input ref="avatarInput" class="sr-only" type="file" :accept="IMAGE_ACCEPT" aria-label="选择头像图片" :disabled="busy" @change="uploadAvatar">
            <div class="avatar-buttons"><button type="button" class="button secondary small" :disabled="busy" :aria-busy="uploading" @click="avatarInput?.click()"><Icon name="image" :size="16" />{{ uploading ? '上传中…' : form.avatar ? '更换头像' : '上传头像' }}</button><button v-if="form.avatar" type="button" class="button secondary small" :disabled="busy" @click="form.avatar = ''">移除头像</button></div>
            <p>支持 JPEG、PNG、WebP，最大 5 MB。上传后点击“保存资料”生效。</p>
          </div>
        </div>
        <label>昵称<input v-model="form.nickname" maxlength="50" autocomplete="nickname" placeholder="希望大家如何称呼你"></label>
        <label>邮箱<input v-model="form.email" type="email" maxlength="100" autocomplete="email" placeholder="hello@example.com"></label>
        <label class="profile-wide">个人简介<textarea v-model="form.bio" maxlength="500" rows="5" placeholder="介绍一下自己吧"></textarea><small class="muted">{{ (form.bio || '').length }} / 500</small></label>
      </fieldset>
      <p class="profile-hint">以上信息均为选填，留空保存即可清除。用户名、角色和账户状态不可在此修改。</p>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <p v-if="uploading" class="profile-hint" role="status">正在上传头像，请稍候…</p>
      <div class="profile-actions"><button type="button" class="button secondary" :disabled="busy" @click="reset">重置</button><button class="button primary" :disabled="busy">{{ uploading ? '等待头像上传…' : saving ? '保存中…' : '保存资料' }}</button></div>
    </form>
  </section>
</template>

<style scoped>
.profile-page { max-width: 720px; margin-inline: auto; }
.profile-form { padding: 28px; }
.profile-account { display: flex; align-items: center; gap: 12px; padding-bottom: 24px; margin-bottom: 24px; border-bottom: 1px solid var(--border); }
.profile-account strong { font-size: 14px; overflow-wrap: anywhere; }
.profile-account small { display: block; margin-top: 5px; color: var(--muted); font-size: 11px; }
fieldset { border: 0; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 22px; min-width: 0; }
label { min-width: 0; font-size: 12px; }
input, textarea { font-size: 13px; }
.profile-wide { grid-column: 1 / -1; }
.avatar-field { display: flex; align-items: center; gap: 18px; }
.avatar-controls { min-width: 0; }
.avatar-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
.avatar-controls p { color: var(--muted); font-size: 11px; line-height: 1.8; margin-top: 10px; }
textarea { resize: vertical; }
.profile-hint { color: var(--muted); font-size: 11px; line-height: 1.8; margin-top: 22px; }
.profile-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
@media (max-width: 480px) { .profile-form { padding: 22px 18px; } fieldset { grid-template-columns: 1fr; gap: 18px; } }
</style>
