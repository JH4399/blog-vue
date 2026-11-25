<script setup>
import Icon from '../AppIcon.vue'
defineProps({ pagination: { type: Object, required: true }, busy: Boolean })
defineEmits(['change'])
</script>
<template><div class="admin-pagination"><span>共 {{ pagination.total }} 条 · 每页 {{ pagination.size }} 条 · {{ pagination.total ? '第 ' + pagination.page + ' / ' + pagination.pages + ' 页' : '暂无数据' }}</span><div><button type="button" class="button secondary small" :disabled="busy || !pagination.total || pagination.page <= 1" aria-label="上一页" @click="$emit('change', pagination.page - 1)"><Icon name="back" :size="15" /></button><button type="button" class="button secondary small" :disabled="busy || !pagination.total || pagination.page >= pagination.pages" aria-label="下一页" @click="$emit('change', pagination.page + 1)"><Icon name="arrow" :size="15" /></button></div></div></template>
