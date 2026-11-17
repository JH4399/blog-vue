<script setup>
import { computed, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Icon from '../components/AppIcon.vue'
import { useBlogStore } from '../stores/blog'
import { api } from '../services/api'
const blog = useBlogStore(), route = useRoute(), router = useRouter()
const register = computed(() => route.name === 'register')
const form = reactive({ username: '', password: '', nickname: '', email: '' })
const busy = ref(false), error = ref(''), showPassword = ref(false)
async function submit() {
  error.value = ''
  if (/\s/.test(form.username)) { error.value = '用户名不能包含空白字符'; return }
  if (new TextEncoder().encode(form.password).length > 72) { error.value = '密码的 UTF-8 编码不能超过 72 字节'; return }
  busy.value = true
  try {
    if (register.value) {
      await api.register({ username: form.username, password: form.password, nickname: form.nickname || null, email: form.email || null })
      blog.notify('注册成功，请使用新账户登录。')
      router.replace({ name: 'login', query: route.query })
    } else {
      await blog.login({ username: form.username, password: form.password })
      const redirect = typeof route.query.redirect === 'string' && /^\/(?!\/)/.test(route.query.redirect) ? route.query.redirect : '/'
      router.replace(redirect)
    }
  } catch (e) { error.value = e.message }
  finally { busy.value = false }
}
</script>
<template><div class="auth-layout"><div class="auth-intro"><span class="eyebrow">A PLACE FOR YOUR WORDS</span><h1>把你的故事，<br>交给<span class="serif-emphasis">时间收藏。</span></h1><p>每一段文字，都是与自己的相遇。<br>欢迎来到拾光，让记录成为日常。</p><div class="auth-illustration"><Icon name="book" :size="90" /><span>write a little, live a lot.</span></div></div><section class="auth-card"><span class="eyebrow">{{ register ? 'START YOUR JOURNEY' : 'GOOD TO SEE YOU AGAIN' }}</span><h2>{{ register ? '你好，新朋友。' : '欢迎回来。' }}</h2><p>{{ register ? '创建一个账户，开始自己的文字旅程。' : '一杯咖啡的时间，拾起新的灵感。' }}</p><form @submit.prevent="submit"><label>用户名<input v-model="form.username" required maxlength="50" autocomplete="username" placeholder="你的用户名" :disabled="busy"></label><label v-if="register">昵称 <span class="muted">（选填）</span><input v-model="form.nickname" maxlength="50" autocomplete="nickname" placeholder="希望大家如何称呼你" :disabled="busy"></label><label v-if="register">邮箱 <span class="muted">（选填）</span><input v-model="form.email" type="email" maxlength="100" autocomplete="email" placeholder="hello@example.com" :disabled="busy"></label><label>密码<div class="password-field"><input v-model="form.password" :type="showPassword ? 'text' : 'password'" required :minlength="register ? 8 : undefined" maxlength="72" :autocomplete="register ? 'new-password' : 'current-password'" :placeholder="register ? '8–72 个字符' : '输入你的密码'" :disabled="busy"><button type="button" class="icon-button" :aria-label="showPassword ? '隐藏密码' : '显示密码'" @click="showPassword = !showPassword"><Icon name="eye" :size="18" /></button></div></label><p v-if="error" class="form-error" role="alert">{{ error }}</p><button class="button primary full-width" :disabled="busy">{{ busy ? '请稍候…' : register ? '创建账户' : '登录拾光' }}<Icon name="arrow" :size="17" /></button></form><p class="auth-switch">{{ register ? '已经有账户了？' : '第一次来到这里？' }}<RouterLink :to="{ name: register ? 'login' : 'register', query: route.query }">{{ register ? '去登录' : '注册账户' }}</RouterLink></p><RouterLink to="/" class="auth-back"><Icon name="back" :size="15" />回到首页</RouterLink></section></div></template>
