<script setup>
import { RouterLink } from 'vue-router'
import Icon from '../components/AppIcon.vue'
</script>
<template><div class="empty-state not-found"><h1>404<span>.</span></h1><h2>页面不存在</h2><RouterLink to="/" class="button primary">返回首页 <Icon name="arrow" :size="17" /></RouterLink></div></template>
