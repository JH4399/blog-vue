<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import Icon from './AppIcon.vue'
import UserAvatar from './UserAvatar.vue'

const props = defineProps({ user: { type: Object, required: true }, busy: Boolean })
const emit = defineEmits(['logout', 'open'])
const route = useRoute()
const open = ref(false)
const root = ref(null)
const trigger = ref(null)
const profileLink = ref(null)
const name = computed(() => props.user.nickname || props.user.username || '记录者')

function close(restoreFocus = false) {
  open.value = false
  if (restoreFocus) trigger.value?.focus()
}

async function openMenu(focusAction = false) {
  if (props.busy) return
  open.value = true
  emit('open')
  if (focusAction) {
    await nextTick()
    profileLink.value?.$el?.focus()
  }
}

function onOutside(event) {
  if (open.value && !root.value?.contains(event.target)) close()
}

watch(() => route.fullPath, () => close())
watch(() => props.user.id, () => close())
onMounted(() => {
  document.addEventListener('pointerdown', onOutside)
  document.addEventListener('focusin', onOutside)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', onOutside)
  document.removeEventListener('focusin', onOutside)
})
</script>

<template>
  <div ref="root" class="account-menu" @keydown.esc.stop.prevent="close(true)">
    <button
      ref="trigger"
      type="button"
      class="account-trigger"
      :class="{ expanded: open }"
      :aria-label="`${name}，账户菜单`"
      :aria-expanded="open"
      aria-controls="account-dropdown"
      :disabled="busy"
      @click="open ? close() : openMenu()"
      @keydown.down.prevent="openMenu(true)"
    >
      <UserAvatar :src="user.avatar" :name="name" />
      <span class="account-name">{{ name }}</span>
      <Icon name="chevron" :size="13" class="account-chevron" />
    </button>

    <Transition name="account-dropdown">
      <div v-if="open" id="account-dropdown" class="account-dropdown" :aria-busy="busy">
        <div class="account-summary">
          <strong>{{ name }}</strong>
          <span class="account-username">@{{ user.username }}</span>
        </div>
        <RouterLink ref="profileLink" to="/profile" class="profile-action" @click="close()"><Icon name="users" :size="14" /><span>个人资料</span></RouterLink>
        <button
          type="button"
          class="logout-action"
          :disabled="busy"
          @click="emit('logout')"
        >
          <span v-if="busy" class="logout-spinner" aria-hidden="true"></span>
          <Icon v-else name="logout" :size="14" />
          <span>{{ busy ? '正在退出…' : '退出登录' }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.account-menu { position: relative; width: 124px; flex-shrink: 0; }
.account-trigger { display: flex; align-items: center; gap: 6px; width: 100%; padding: 5px 7px 5px 5px; border: 1px solid transparent; border-radius: 8px; font-size: 12px; }
.account-trigger:hover, .account-trigger.expanded { background: var(--surface-soft); border-color: var(--border); }
.account-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
.account-chevron { flex-shrink: 0; color: var(--muted); transform: rotate(90deg); transition: transform .18s; }
.expanded .account-chevron { transform: rotate(-90deg); }
.account-dropdown { position: absolute; top: calc(100% + 6px); left: 0; z-index: 40; width: 100%; padding: 4px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); box-shadow: 0 6px 18px #17241314; transform-origin: top right; }
.account-summary { display: flex; align-items: baseline; gap: 6px; padding: 5px 7px 7px; margin-bottom: 3px; border-bottom: 1px solid var(--border); min-width: 0; }
.account-summary strong { font-size: 11px; font-weight: 600; max-width: 50%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.account-username { font-size: 10px; color: var(--muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.logout-action { width: 100%; display: flex; align-items: center; gap: 7px; padding: 6px 7px; border-radius: 4px; color: #a56650; text-align: left; font-size: 11px; line-height: 1.5; }
.logout-action:hover:not(:disabled) { background: color-mix(in srgb, #a56650 9%, var(--surface)); }
.profile-action { display: flex; align-items: center; gap: 7px; padding: 6px 7px; border-radius: 4px; font-size: 11px; line-height: 1.5; color: var(--text); }
.profile-action:hover { background: var(--surface-soft); }
.logout-spinner { width: 14px; height: 14px; border: 1.5px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .8s linear infinite; }
.account-dropdown-enter-active, .account-dropdown-leave-active { transition: opacity .15s, transform .15s; }
.account-dropdown-enter-from, .account-dropdown-leave-to { opacity: 0; transform: translateY(-5px) scale(.98); }
@media (max-width: 480px) { .profile-action, .logout-action { min-height: 36px; } }
@media (prefers-reduced-motion: reduce) { .account-dropdown-enter-active, .account-dropdown-leave-active, .account-chevron { transition: none; } }
</style>
