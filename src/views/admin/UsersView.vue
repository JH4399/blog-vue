<script setup>
import AppSelect from '../../components/AppSelect.vue'
import { reportError } from '../../services/errors'
import { reactive, ref } from 'vue'
import Icon from '../../components/AppIcon.vue'
import UserAvatar from '../../components/UserAvatar.vue'
import { useAdminStore } from '../../stores/admin'
import { useBlogStore } from '../../stores/blog'
import { api, session } from '../../services/api'
import { dateLabel } from '../../utils/format'
import { numberLabel, roleLabel } from '../../utils/admin'
import { useAdminPage } from '../../composables/useAdminPage'
import PageNavigation from '../../components/admin/PageNavigation.vue'
const admin = useAdminStore(), blog = useBlogStore()
const filters = reactive({ q: '', status: '', role: '' })
const { rows: visible, pagination, loading, pending, error: listError, load } = useAdminPage('users', filters)
const busy = ref(false), error = ref(''), confirmation = ref(null), confirmationDialog = ref(null)
function askToggle(user) { if (!busy.value && admin.allowed && user.id !== blog.user?.id) { confirmation.value = user; error.value = ''; confirmationDialog.value?.showModal() } }
function closeConfirmation() { if (!busy.value) { confirmationDialog.value?.close(); confirmation.value = null } }
async function toggleStatus() {
  if (!confirmation.value || busy.value || !admin.allowed || confirmation.value.id === blog.user?.id) return
  const userId = blog.user.id, token = session.token; busy.value = true; error.value = ''
  try {
    const result = await api.updateUserStatus(confirmation.value.id, { status: confirmation.value.status === 1 ? 0 : 1 })
    confirmationDialog.value?.close(); confirmation.value = null
    if (!admin.allowed || blog.user?.id !== userId || session.token !== token) return
    blog.invalidateContent(); await load(); blog.notify(result.status === 1 ? '账户已启用' : '账户已禁用，该用户的后续请求将被拒绝')
  } catch (e) { reportError(e); error.value = e.message }
  finally { busy.value = false }
}
</script>
<template>
  <section>
    <div class="admin-page-heading"><div><h1>用户管理 <span class="count-pill">{{ pagination.total }}</span></h1><p>管理员仅可启用或禁用账户，个人资料由用户本人维护。</p></div><button class="button secondary small" :disabled="loading || pending || busy" @click="load()"><Icon name="refresh" :size="15" />刷新用户</button></div>
    <div class="admin-filter-bar panel"><label class="search-field"><Icon name="search" :size="17" /><input v-model="filters.q" maxlength="200" placeholder="搜索昵称、用户名、邮箱或 ID…" aria-label="搜索用户"></label><AppSelect v-model="filters.role" aria-label="筛选角色" :options="[{ value: '', label: '全部角色' }, { value: '1', label: '普通用户' }, { value: '2', label: '管理员' }]" /><AppSelect v-model="filters.status" aria-label="筛选账户状态" :options="[{ value: '', label: '全部状态' }, { value: '1', label: '正常' }, { value: '0', label: '已禁用' }]" /></div>
    <div v-if="listError" class="inline-error" role="alert"><button class="button secondary small" @click="load()">重新加载</button></div>
    <div v-else-if="loading || pending" class="empty-state panel" aria-busy="true"><span class="spinner"></span><p>正在加载用户…</p></div>
    <div v-else class="panel admin-table-panel"><div class="admin-table-scroll"><table class="admin-data-table users-table"><thead><tr><th>用户</th><th>邮箱</th><th>角色</th><th>文章数</th><th>状态</th><th>注册时间</th><th>操作</th></tr></thead><tbody><tr v-for="user in visible" :key="user.id"><td><div class="admin-user-cell"><UserAvatar :src="user.avatar" :name="user.nickname || user.username" /><div><strong>{{ user.nickname || user.username }}<span v-if="user.id === blog.user?.id" class="admin-self-tag">我</span></strong><small>@{{ user.username }} · #{{ user.id }}</small></div></div></td><td>{{ user.email || '未填写' }}</td><td><span class="admin-badge" :class="user.role === 2 ? 'role-admin' : 'role-reader'">{{ roleLabel(user.role) }}</span></td><td class="numeric-cell">{{ numberLabel(user.postCount) }}</td><td><span class="admin-badge" :class="user.status === 1 ? 'post-state-1' : 'post-state-0'"><i></i>{{ user.status === 1 ? '正常' : '已禁用' }}</span></td><td class="admin-date-cell">{{ dateLabel(user.createdAt) }}</td><td><div class="admin-row-actions"><button :disabled="busy || user.id === blog.user?.id" :title="user.id === blog.user?.id ? '不能禁用当前登录账户' : undefined" :class="{ 'danger-text': user.status === 1 }" @click="askToggle(user)">{{ user.status === 1 ? '禁用' : '启用' }}</button></div></td></tr></tbody></table></div><div v-if="!visible.length" class="empty-state"><Icon name="users" :size="30" /><h3>没有匹配的用户</h3></div><PageNavigation :pagination="pagination" :busy="loading || pending || busy" @change="load" /></div>
    <dialog ref="confirmationDialog" class="confirm-dialog" aria-labelledby="user-toggle-title" @cancel.prevent="closeConfirmation"><h2 id="user-toggle-title">{{ confirmation?.status === 1 ? '禁用' : '启用' }}这个账户？</h2><p>{{ confirmation?.nickname || confirmation?.username }}{{ confirmation?.status === 1 ? '将无法登录或继续访问博客，已有文章和评论会保留。' : '将恢复正常访问权限。' }}</p><p v-if="error" class="form-error" role="alert">{{ error }}</p><div class="button-row"><button class="button secondary" :disabled="busy" autofocus @click="closeConfirmation">取消</button><button class="button" :class="confirmation?.status === 1 ? 'danger' : 'primary'" :disabled="busy" @click="toggleStatus">{{ busy ? '处理中…' : '确认' }}</button></div></dialog>
  </section>
</template>
