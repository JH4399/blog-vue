<script setup>
import { imageUrl } from '../utils/images'
import { ref, watch } from 'vue'
const props = defineProps({ post: Object })
const emit = defineEmits(['load-error'])
const failed = ref(false)
function onError() { failed.value = true; emit('load-error') }
watch(() => props.post?.coverImage, () => failed.value = false)
</script>
<template><div v-if="imageUrl(post?.coverImage) && !failed" class="post-cover"><img :src="imageUrl(post.coverImage)" :alt="post.title" loading="lazy" @error="onError" /></div></template>
