<script setup>
import Icon from './AppIcon.vue'
defineProps({ pagination: { type: Object, required: true }, busy: Boolean, label: { type: String, default: '条' } })
defineEmits(['change'])
</script>
<template><div class="pagination collection-pagination"><span>共 {{ pagination.total }} {{ label }}<template v-if="pagination.total"> · 第 {{ pagination.page }} / {{ pagination.pages }} 页</template></span><div><button type="button" class="icon-button" :disabled="busy || !pagination.total || pagination.page <= 1" aria-label="上一页" @click="$emit('change', pagination.page - 1)"><Icon name="back" :size="16" /></button><button type="button" class="icon-button" :disabled="busy || !pagination.total || pagination.page >= pagination.pages" aria-label="下一页" @click="$emit('change', pagination.page + 1)"><Icon name="arrow" :size="16" /></button></div></div></template>
<style scoped>.collection-pagination{gap:12px;flex-wrap:wrap}.collection-pagination>span{overflow-wrap:anywhere}.collection-pagination button:disabled{opacity:.4;cursor:default}.collection-pagination>div{display:flex;gap:6px}</style>
