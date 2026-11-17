<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'
const props = defineProps({ open: Boolean, title: String, message: String, busy: Boolean })
const emit = defineEmits(['close', 'confirm'])
const dialog = ref(null)
async function sync() { await nextTick(); if (props.open && !dialog.value?.open) dialog.value?.showModal(); else if (!props.open) dialog.value?.close() }
watch(() => props.open, sync)
onMounted(sync)
</script>
<template><dialog ref="dialog" class="confirm-dialog" aria-labelledby="confirm-title" @cancel.prevent="!busy && emit('close')"><h2 id="confirm-title">{{ title }}</h2><p>{{ message }}</p><div class="button-row"><button class="button secondary" :disabled="busy" autofocus @click="emit('close')">再想想</button><button class="button danger" :disabled="busy" @click="emit('confirm')">{{ busy ? '处理中…' : '确认删除' }}</button></div></dialog></template>
