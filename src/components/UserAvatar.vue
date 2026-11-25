<script setup>
import { computed, ref, watch } from 'vue'
import { imageUrl } from '../utils/images'

const props = defineProps({ src: String, name: String, size: { type: Number, default: 28 }, alt: { type: String, default: '用户头像' } })
const source = computed(() => imageUrl(props.src)), failed = ref(false)
watch(source, () => failed.value = false)
</script>

<template>
  <span class="user-avatar" :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${size * .42}px` }" role="img" :aria-label="alt">
    <img v-if="source && !failed" :src="source" alt="" @error="failed = true">
    <span v-else aria-hidden="true">{{ (name || '我').slice(0, 1) }}</span>
  </span>
</template>

<style scoped>
.user-avatar { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; border-radius: 50%; background: var(--green-light); color: var(--green-dark); vertical-align: middle; line-height: 1; }
.user-avatar img { display: block; width: 100%; height: 100%; object-fit: cover; }
</style>
