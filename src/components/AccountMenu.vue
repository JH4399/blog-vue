<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Icon from './AppIcon.vue'

const props = defineProps({ user: { type: Object, required: true }, busy: Boolean })
const emit = defineEmits(['logout', 'open'])
const route = useRoute()
const open = ref(false)
const root = ref(null)
const trigger = ref(null)
const logoutButton = ref(null)
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
    logoutButton.value?.focus()
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
      <span class="mini-avatar">{{ name.slice(0, 1) }}</span>
      <span class="account-name">{{ name }}</span>
      <Icon name="chevron" :size="13" class="account-chevron" />
    </button>

    <Transition name="account-dropdown">
      <div v-if="open" id="account-dropdown" class="account-dropdown" :aria-busy="busy">
        <div class="account-summary">
          <span class="account-caption">当前账户</span>
          <strong>{{ name }}</strong>
          <span class="account-username">@{{ user.username }}</span>
        </div>
        <button
          ref="logoutButton"
          type="button"
          class="logout-action"
          :disabled="busy"
          @click="emit('logout')"
        >
          <span v-if="busy" class="logout-spinner" aria-hidden="true"></span>
          <Icon v-else name="logout" :size="17" />
          <span>{{ busy ? '正在退出…' : '退出登录' }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.account-menu { position: relative; }
.account-trigger { display: flex; align-items: center; gap: 8px; padding: 5px 7px 5px 5px; margin: -5px; border: 1px solid transparent; border-radius: 8px; font-size: 12px; max-width: 165px; }
.account-trigger:hover, .account-trigger.expanded { background: var(--surface-soft); border-color: var(--border); }
.account-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.account-chevron { color: var(--muted); transform: rotate(90deg); transition: transform .18s; }
.expanded .account-chevron { transform: rotate(-90deg); }
.account-dropdown { position: absolute; top: calc(100% + 14px); right: -5px; z-index: 40; width: 216px; max-width: calc(100vw - 36px); padding: 6px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface); box-shadow: 0 12px 36px #17241316, 0 2px 6px #17241308; transform-origin: top right; }
.account-summary { display: flex; flex-direction: column; padding: 10px 12px 14px; margin-bottom: 5px; border-bottom: 1px solid var(--border); overflow-wrap: anywhere; }
.account-caption { font-size: 10px; color: var(--muted); margin-bottom: 6px; }
.account-summary strong { font-size: 13px; font-weight: 600; }
.account-username { font-size: 11px; color: var(--muted); margin-top: 3px; }
.logout-action { width: 100%; display: flex; align-items: center; gap: 10px; padding: 11px 12px; border-radius: 6px; color: #a56650; text-align: left; font-size: 12px; }
.logout-action:hover:not(:disabled) { background: color-mix(in srgb, #a56650 9%, var(--surface)); }
.logout-spinner { width: 17px; height: 17px; border: 1.5px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .8s linear infinite; }
.account-dropdown-enter-active, .account-dropdown-leave-active { transition: opacity .15s, transform .15s; }
.account-dropdown-enter-from, .account-dropdown-leave-to { opacity: 0; transform: translateY(-5px) scale(.98); }
@media (max-width: 850px) { .account-name { display: none; } .account-trigger { gap: 5px; } }
@media (max-width: 480px) { .account-dropdown { width: 205px; } .logout-action { min-height: 44px; } }
@media (prefers-reduced-motion: reduce) { .account-dropdown-enter-active, .account-dropdown-leave-active, .account-chevron { transition: none; } }
</style>
