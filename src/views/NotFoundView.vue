<script setup>
import { RouterLink } from 'vue-router'
import Icon from '../components/AppIcon.vue'
</script>
<template><div class="empty-state not-found"><span class="eyebrow">A LITTLE DETOUR</span><h1>404<span>.</span></h1><h2>这页时光，暂时走丢了。</h2><p>换条小路，回到熟悉的地方吧。</p><RouterLink to="/" class="button primary">返回首页 <Icon name="arrow" :size="17" /></RouterLink></div></template>
