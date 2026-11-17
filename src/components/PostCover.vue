<script setup>
import { safeUrl } from '../utils/format'
import { ref, watch } from 'vue'
const props = defineProps({ post: Object, variant: { type: Number, default: 0 } })
const failed = ref(false)
watch(() => props.post?.coverImage, () => failed.value = false)
</script>
<template><div class="post-cover" :class="`cover-${variant % 4}`"><img v-if="safeUrl(post?.coverImage) && !failed" :src="safeUrl(post.coverImage)" :alt="post.title" loading="lazy" @error="failed = true" /><template v-else><div class="art-grain"></div><div class="art-orbit"></div><div class="art-sun"></div><div class="art-hill hill-back"></div><div class="art-hill hill-front"></div><div class="art-branch"><i></i><i></i><i></i><i></i><i></i><i></i></div><span class="art-caption">{{ ['SLOW LIVING / 01', 'IDEAS INTO CODE / 02', 'WORDS & WORLDS / 03', 'LESS, BUT BETTER / 04'][variant % 4] }}</span><span class="art-corner">拾光.</span></template></div></template>
