<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import Icon from '../AppIcon.vue'
import { loadPage } from '../../services/loadPage'
import { reportError } from '../../services/errors'
import { useBlogStore } from '../../stores/blog'
import PageNavigation from './PageNavigation.vue'
const props = defineProps({ modelValue: [String, Number], resource: String, placeholder: String, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
const blog = useBlogStore(), panel = ref(null), query = ref(''), selected = ref(''), rows = ref([]), loading = ref(false), failed = ref(false)
const pagination = ref({ page: 1, size: 10, total: 0, pages: 0 })
let version = 0, timer
const name = row => props.resource === 'users' ? row.nickname || row.username : row.name
async function load(page = 1) {
  const current = ++version, userId = blog.user?.id
  loading.value = true; failed.value = false
  try {
    const result = await loadPage(props.resource, { page, size: 10, q: query.value }, () => current === version && blog.user?.id === userId && (props.resource !== 'users' || blog.user?.role === 2))
    if (current === version && blog.user?.id === userId && (props.resource !== 'users' || blog.user?.role === 2)) { rows.value = result.records; pagination.value = result }
  } catch (e) { if (current === version) { rows.value = []; failed.value = true }; reportError(e) }
  finally { if (current === version) loading.value = false }
}
function choose(row) { emit('update:modelValue', row ? String(row.id) : ''); selected.value = row ? name(row) : ''; panel.value.open = false }
function toggle() { if (panel.value.open) load(1); else { version++; clearTimeout(timer); loading.value = false } }
watch(query, () => { version++; clearTimeout(timer); timer = setTimeout(() => { if (panel.value?.open) load(1) }, 300) })
watch(() => props.modelValue, value => { if (!value) selected.value = '' })
watch(() => blog.user, () => { version++; rows.value = []; if (panel.value) panel.value.open = false })
function outside(event) { if (panel.value?.open && !panel.value.contains(event.target)) panel.value.open = false }
onMounted(() => document.addEventListener('pointerdown', outside))
onUnmounted(() => { version++; clearTimeout(timer); document.removeEventListener('pointerdown', outside) })
</script>
<template><details ref="panel" class="admin-lookup" @toggle="toggle" @keydown.esc.stop.prevent="panel.open = false"><summary :aria-disabled="disabled" @click="disabled && $event.preventDefault()"><span>{{ selected || placeholder }}</span><Icon name="chevron" :size="14" class="lookup-chevron" /></summary><div class="admin-lookup-panel"><input v-model="query" :disabled="disabled" :placeholder="resource === 'users' ? '搜索昵称或用户名…' : '搜索分类…'" :aria-label="placeholder" maxlength="200"><button type="button" class="admin-lookup-option" :class="{ selected: !modelValue }" :disabled="disabled" @click="choose(null)">{{ placeholder }}</button><p v-if="loading" class="muted">正在查找…</p><template v-else><button v-for="row in rows" :key="row.id" type="button" class="admin-lookup-option" :class="{ selected: String(modelValue) === String(row.id) }" :disabled="disabled" @click="choose(row)">{{ name(row) }} <small>#{{ row.id }}</small></button><p v-if="!rows.length" class="muted">{{ failed ? '加载失败，请重试' : '没有匹配的结果' }}</p><button v-if="failed" type="button" class="admin-inline-link" @click="load()">重试</button></template><PageNavigation :pagination="pagination" :busy="loading" @change="load" /></div></details></template>
<style>
.admin-lookup{position:relative;min-width:140px;font-size:12px}
.admin-lookup>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:40px;cursor:pointer;padding:9px 12px;border:1px solid var(--border);border-radius:7px;list-style:none;background:#fff;color:var(--secondary);transition:border-color .16s,box-shadow .16s}
.admin-lookup>summary::-webkit-details-marker{display:none}
.admin-lookup>summary>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lookup-chevron{color:var(--muted);transform:rotate(90deg);transition:transform .22s var(--motion-ease,ease)}
.admin-lookup[open]>summary .lookup-chevron{transform:rotate(-90deg)}
.admin-lookup[open]>summary,.admin-lookup>summary:focus-visible{outline:0;border-color:var(--green);box-shadow:0 0 0 3px #536b5812}
.admin-lookup>summary[aria-disabled=true]{opacity:.45;cursor:not-allowed;background:var(--surface-soft)}
.admin-lookup-panel{position:absolute;top:calc(100% + 6px);left:0;z-index:40;width:300px;max-width:calc(100vw - 60px);padding:10px;background:#fff;border:1px solid var(--border);border-radius:9px;box-shadow:0 8px 30px #1c302315,0 2px 6px #1c302308}
.admin-lookup[open]>.admin-lookup-panel{animation:lookup-in .2s var(--motion-ease,ease)}
.admin-lookup-panel input{width:100%;box-sizing:border-box;margin-bottom:6px;border-radius:6px}
.admin-lookup-option{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:8px 10px;text-align:left;border:0;border-radius:5px;background:transparent;color:inherit;cursor:pointer;line-height:1.6;overflow-wrap:anywhere}
.admin-lookup-option:hover{background:var(--surface-soft)}
.admin-lookup-option.selected{background:var(--green-light);color:var(--green-dark)}
.admin-lookup-option small{opacity:.6;flex-shrink:0}
.admin-lookup-panel .admin-pagination{padding:12px 0 0;gap:8px;flex-wrap:wrap}
.admin-filter-bar>.admin-lookup{font-size:11px}
.admin-filter-bar>.admin-lookup>summary{min-height:38px}
.admin-editor-category>.admin-lookup{width:100%}
@keyframes lookup-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@media(prefers-reduced-motion:reduce){.admin-lookup[open]>.admin-lookup-panel{animation:none}.lookup-chevron,.admin-lookup>summary{transition:none}}
</style>
