<script setup>
import { computed, reactive, ref, watch } from 'vue'
import Icon from '../components/AppIcon.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { useBlogStore } from '../stores/blog'
import { api } from '../services/api'
const blog = useBlogStore()
const resource = ref('categories'), rows = ref([]), loading = ref(true), busy = ref(false), error = ref(''), editing = ref(null), deleteTarget = ref(null), showForm = ref(false)
const form = reactive({})
const definitions = {
  categories: { label: '文章分类', fields: [{ key: 'name', label: '分类名称', required: true, max: 50 }, { key: 'slug', label: '分类别名', required: true, max: 50 }, { key: 'description', label: '描述', max: 255, type: 'textarea' }, { key: 'sort', label: '排序值', type: 'number', default: 0 }] },
  tags: { label: '灵感标签', fields: [{ key: 'name', label: '标签名称', required: true, max: 50 }, { key: 'slug', label: '标签别名', required: true, max: 50 }] },
  links: { label: '友情链接', fields: [{ key: 'name', label: '站点名称', required: true, max: 50 }, { key: 'url', label: '站点地址', type: 'url', required: true, max: 255 }, { key: 'logo', label: 'Logo 地址', type: 'url', max: 255 }, { key: 'description', label: '描述', type: 'textarea', max: 255 }, { key: 'sort', label: '排序值', type: 'number', default: 0 }, { key: 'status', label: '状态', type: 'select', default: 1 }] },
  settings: { label: '系统配置', fields: [{ key: 'configKey', label: '配置键', required: true, max: 100 }, { key: 'configValue', label: '配置值', type: 'textarea' }, { key: 'remark', label: '备注', max: 255 }] },
}
const definition = computed(() => definitions[resource.value])
let version = 0
async function load() {
  const current = ++version
  loading.value = true; error.value = ''; rows.value = []
  await blog.initialize()
  if (!blog.user || blog.user.role !== 2 || blog.demo) { loading.value = false; return }
  try { const result = await api.list(resource.value); if (current === version) rows.value = result || [] }
  catch (e) { if (current === version) error.value = e.message }
  finally { if (current === version) loading.value = false }
}
watch(resource, () => { showForm.value = false; load() })
watch(() => blog.user?.id, () => { if (!blog.user) { version++; rows.value = []; showForm.value = false } })
load()
function edit(row = null) {
  editing.value = row?.id || null; error.value = ''
  Object.keys(form).forEach(key => delete form[key])
  definition.value.fields.forEach(field => form[field.key] = row?.[field.key] ?? field.default ?? '')
  showForm.value = true
}
async function save() {
  if (busy.value || blog.demo || blog.user?.role !== 2) return
  busy.value = true; error.value = ''
  try {
    const body = Object.fromEntries(definition.value.fields.map(field => [field.key, field.type === 'number' ? Number(form[field.key]) : form[field.key]]))
    if (body.url && !/^https?:\/\//i.test(body.url)) throw new Error('站点地址必须以 http:// 或 https:// 开头')
    if (editing.value) await api.update(resource.value, editing.value, body)
    else await api.create(resource.value, body)
    showForm.value = false; await load(); await blog.loadPublic(); blog.notify('内容已保存')
  } catch (e) { error.value = e.message }
  finally { busy.value = false }
}
async function remove() {
  if (!deleteTarget.value || blog.user?.role !== 2 || blog.demo) return
  busy.value = true
  try { await api.remove(resource.value, deleteTarget.value.id); deleteTarget.value = null; await load(); await blog.loadPublic(); blog.notify('已删除') }
  catch (e) { blog.notify(e.message, 'error') }
  finally { busy.value = false }
}
</script>
<template><div class="standard-page manage-page"><div class="page-heading"><div class="eyebrow">MAKE THIS SPACE YOURS</div><h1>打理你的小站。</h1><p>为内容整理一个舒服的家。</p></div><div v-if="!blog.initialized" class="empty-state"><span class="spinner"></span></div><div v-else-if="blog.user?.role !== 2 || blog.demo" class="empty-state panel"><Icon name="alert" :size="34" /><h2>这里需要管理员权限</h2><p>请使用管理员账户登录后访问。</p></div><template v-else><div class="manage-tabs category-tabs"><button v-for="(item, key) in definitions" :key="key" :class="{ selected: key === resource }" :disabled="busy" @click="resource = key">{{ item.label }}</button></div><div class="manage-heading"><h2>{{ definition.label }}</h2><button class="button primary small" :disabled="busy" @click="edit()"><Icon name="edit" :size="16" />新增</button></div><p v-if="resource === 'settings'" class="inline-note">管理后端存储的配置项。页面名称和样式目前在前端维护。</p><p v-if="error" class="form-error" role="alert">{{ error }}<button v-if="!showForm" @click="load">重试</button></p><div v-if="showForm" class="panel manage-form"><h3>{{ editing ? '编辑' : '新增' }}{{ definition.label }}</h3><form @submit.prevent="save"><label v-for="field in definition.fields" :key="field.key">{{ field.label }}<span v-if="!field.required" class="muted">（选填）</span><textarea v-if="field.type === 'textarea'" v-model="form[field.key]" :maxlength="field.max" rows="3" :disabled="busy"></textarea><select v-else-if="field.type === 'select'" v-model="form[field.key]" :disabled="busy"><option :value="1">显示</option><option :value="0">隐藏</option></select><input v-else v-model="form[field.key]" :type="field.type || 'text'" :required="field.required" :maxlength="field.max" :disabled="busy" :step="field.type === 'number' ? '1' : undefined"></label><div class="button-row"><button class="button primary" :disabled="busy">{{ busy ? '保存中…' : '保存' }}</button><button type="button" class="button secondary" :disabled="busy" @click="showForm = false">取消</button></div></form></div><div v-if="loading" class="empty-state"><span class="spinner"></span></div><div v-else-if="!rows.length && !error" class="empty-state panel"><h3>还没有内容，添加第一项吧。</h3></div><div v-else class="manage-table-wrap panel"><table class="manage-table"><thead><tr><th>名称 / 配置键</th><th>别名 / 说明</th><th>操作</th></tr></thead><tbody><tr v-for="row in rows" :key="row.id"><td>{{ row.name || row.configKey }}<span v-if="row.status === 0" class="status-badge">隐藏</span></td><td>{{ row.slug || row.description || row.remark || row.configValue || '—' }}</td><td><button :disabled="busy" @click="edit(row)">编辑</button><button :disabled="busy" class="danger-text" @click="deleteTarget = row">删除</button></td></tr></tbody></table></div></template><ConfirmDialog :open="!!deleteTarget" :busy="busy" title="确认删除这一项？" message="已被文章使用的分类或标签可能无法删除，后端会保留这些关联数据。" @close="deleteTarget = null" @confirm="remove" /></div></template>
