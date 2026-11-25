<script setup>
import { RouterLink } from 'vue-router'
import { useBlogStore } from '../stores/blog'
import { safeUrl } from '../utils/format'
const blog = useBlogStore()
</script>
<template>
  <div class="about-page">
    <h1>关于</h1>
    <section v-if="blog.user" class="about-profile">
      <img v-if="safeUrl(blog.user.avatar)" :src="safeUrl(blog.user.avatar)" alt="头像" @error="$event.target.style.display = 'none'">
      <h2>{{ blog.user.nickname || blog.user.username }}</h2>
      <p v-if="blog.user.bio">{{ blog.user.bio }}</p>
    </section>
    <RouterLink to="/" class="button secondary">返回文章</RouterLink>
  </div>
</template>
