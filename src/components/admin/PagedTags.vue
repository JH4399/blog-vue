<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { loadPage } from '../../services/loadPage'
import { reportError } from '../../services/errors'
import { useBlogStore } from '../../stores/blog'
import PageNavigation from './PageNavigation.vue'
const props = defineProps({ modelValue: { type: Array, default: () => [] }, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
const blog = useBlogStore(), query = ref(''), rows = ref([]), loading = ref(false), failed = ref(false)
const pagination = ref({ page: 1, size: 10, total: 0, pages: 0 })
let version = 0, timer
async function load(page = 1) {
  const current = ++version, userId = blog.user?.id
  loading.value = true; failed.value = false
  try {
    const result = await loadPage('tags', { page, size: 10, q: query.value }, () => current === version && blog.user?.id === userId)
    if (current === version && blog.user?.id === userId) { rows.value = result.records; pagination.value = result }
  } catch (e) { if (current === version) failed.value = true; reportError(e) }
  finally { if (current === version) loading.value = false }
}
function toggle(id, checked) {
  emit('update:modelValue', checked ? [...new Set([...props.modelValue, id])] : props.modelValue.filter(value => value !== id))
}
watch(query, () => { version++; clearTimeout(timer); timer = setTimeout(() => load(1), 300) })
onMounted(() => load())
onUnmounted(() => { version++; clearTimeout(timer) })
</script>
<template><fieldset class="tag-fieldset"><legend>灵感标签 · 已选 {{ modelValue.length }} 项</legend><input v-model="query" maxlength="200" placeholder="搜索标签…" aria-label="搜索文章标签" :disabled="disabled"><p v-if="loading" class="muted">正在加载标签…</p><template v-else><label v-for="tag in rows" :key="tag.id" class="checkbox-label"><input type="checkbox" :checked="modelValue.includes(tag.id)" :disabled="disabled" @change="toggle(tag.id, $event.target.checked)">{{ tag.name }}</label><small v-if="!rows.length">{{ failed ? '标签加载失败' : '没有匹配的标签' }}</small><button v-if="failed" type="button" class="admin-inline-link" @click="load()">重试</button></template><PageNavigation :pagination="pagination" :busy="loading || disabled" @change="load" /></fieldset></template>
