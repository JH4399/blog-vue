<script setup>
import AppSelect from '../AppSelect.vue'
import { reportError } from '../../services/errors'
import { computed, reactive, ref, watch } from 'vue'
import Icon from '../AppIcon.vue'
import ConfirmDialog from '../ConfirmDialog.vue'
import { useBlogStore } from '../../stores/blog'
import { api } from '../../services/api'
import { useAdminPage } from '../../composables/useAdminPage'
import PageNavigation from './PageNavigation.vue'
const blog = useBlogStore()
const props = defineProps({ resource: { type: String, required: true } })
const resource = computed(() => props.resource)
const filters = reactive({ q: '' })
const { rows, pagination, loading, pending, error: listError, load } = useAdminPage(resource, filters)
const busy = ref(false), error = ref(''), editing = ref(null), deleteTarget = ref(null), showForm = ref(false)
const form = reactive({})
const definitions = {
  categories: { label: '文章分类', fields: [{ key: 'name', label: '分类名称', required: true, max: 50 }, { key: 'slug', label: '分类别名', required: true, max: 50 }, { key: 'description', label: '描述', max: 255, type: 'textarea' }, { key: 'sort', label: '排序值', type: 'number', default: 0 }] },
  tags: { label: '灵感标签', fields: [{ key: 'name', label: '标签名称', required: true, max: 50 }, { key: 'slug', label: '标签别名', required: true, max: 50 }] },
  links: { label: '友情链接', fields: [{ key: 'name', label: '站点名称', required: true, max: 50 }, { key: 'url', label: '站点地址', type: 'url', required: true, max: 255 }, { key: 'logo', label: 'Logo 地址', type: 'url', max: 255 }, { key: 'description', label: '描述', type: 'textarea', max: 255 }, { key: 'sort', label: '排序值', type: 'number', default: 0 }, { key: 'status', label: '状态', type: 'select', default: 1 }] },
  settings: { label: '系统配置', fields: [{ key: 'configKey', label: '配置键', required: true, max: 100 }, { key: 'configValue', label: '配置值', type: 'textarea' }, { key: 'remark', label: '备注', max: 255 }] },
}
const definition = computed(() => definitions[resource.value])
watch(resource, () => { showForm.value = false; error.value = ''; filters.q = '' })
watch(() => blog.user?.id, () => { showForm.value = false })
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
    showForm.value = false; await load(); blog.invalidateContent(); blog.notify('内容已保存')
  } catch (e) { reportError(e); error.value = e.message }
  finally { busy.value = false }
}
async function remove() {
  if (!deleteTarget.value || blog.user?.role !== 2 || blog.demo) return
  busy.value = true
  try { await api.remove(resource.value, deleteTarget.value.id); deleteTarget.value = null; await load(); blog.invalidateContent(); blog.notify('已删除') }
  catch (e) { reportError(e) }
  finally { busy.value = false }
}
</script>
<template><div class="admin-resource-page"><div class="admin-page-heading"><div><h1>{{ definition.label }}</h1></div><button class="button secondary small" :disabled="busy || loading" @click="load()"><Icon name="refresh" :size="15" />刷新</button></div><div v-if="!blog.initialized" class="empty-state"><span class="spinner"></span></div><div v-else-if="blog.user?.role !== 2 || blog.demo" class="empty-state panel"><Icon name="alert" :size="34" /><h2>这里需要管理员权限</h2><p>请使用管理员账户登录后访问。</p></div><template v-else><div class="manage-heading"><h2>{{ definition.label }}</h2><button class="button primary small" :disabled="busy" @click="edit()"><Icon name="edit" :size="16" />新增</button></div><div class="admin-filter-bar panel"><label class="search-field"><Icon name="search" :size="17" /><input v-model="filters.q" maxlength="200" placeholder="搜索名称、别名或配置键…" aria-label="搜索管理内容"></label></div><div v-if="listError" class="retry-action"><button class="button secondary small" @click="load()">重试</button></div><div v-if="showForm" class="panel manage-form"><h3>{{ editing ? '编辑' : '新增' }}{{ definition.label }}</h3><form @submit.prevent="save"><label v-for="field in definition.fields" :key="field.key">{{ field.label }}<span v-if="!field.required" class="muted">（选填）</span><textarea v-if="field.type === 'textarea'" v-model="form[field.key]" :maxlength="field.max" rows="3" :disabled="busy"></textarea><AppSelect v-else-if="field.type === 'select'" v-model="form[field.key]" :label="field.label" :disabled="busy" :options="[{ value: 1, label: '显示' }, { value: 0, label: '隐藏' }]" /><input v-else v-model="form[field.key]" :type="field.type || 'text'" :required="field.required" :maxlength="field.max" :disabled="busy" :step="field.type === 'number' ? '1' : undefined"></label><div class="button-row"><button class="button primary" :disabled="busy">{{ busy ? '保存中…' : '保存' }}</button><button type="button" class="button secondary" :disabled="busy" @click="showForm = false">取消</button></div></form></div><div v-if="loading || pending" class="empty-state"><span class="spinner"></span></div><div v-else-if="!rows.length && !error && !listError" class="empty-state panel"><h3>还没有内容，添加第一项吧。</h3></div><div v-else class="manage-table-wrap panel"><table class="manage-table"><thead><tr><th>名称 / 配置键</th><th>别名 / 说明</th><th v-if="resource === 'categories' || resource === 'links'">排序值</th><th>操作</th></tr></thead><tbody><tr v-for="row in rows" :key="row.id"><td>{{ row.name || row.configKey }}<span v-if="row.status === 0" class="status-badge">隐藏</span></td><td>{{ row.slug || row.description || row.remark || row.configValue || '—' }}<small v-if="row.slug && row.description" class="admin-resource-description">{{ row.description }}</small></td><td v-if="resource === 'categories' || resource === 'links'">{{ row.sort || 0 }}</td><td><button :disabled="busy" @click="edit(row)">编辑</button><button :disabled="busy" class="danger-text" @click="deleteTarget = row">删除</button></td></tr></tbody></table><PageNavigation :pagination="pagination" :busy="loading || pending || busy" @change="load" /></div></template><ConfirmDialog :open="!!deleteTarget" :busy="busy" title="确认删除这一项？" message="已被文章使用的分类或标签可能无法删除，后端会保留这些关联数据。" @close="deleteTarget = null" @confirm="remove" /></div></template>
