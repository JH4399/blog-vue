<script setup>
import { RouterView } from 'vue-router'

defineProps({ shell: Boolean })

function pageKey(route, shell) {
  // Keep the admin layout mounted while its child pages change.
  return shell && route.meta.admin ? 'admin-shell' : route.path
}

function pageReady() {
  document.dispatchEvent(new Event('page-ready'))
}
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <Transition name="page" mode="out-in" appear @enter="pageReady">
      <div v-if="Component" :key="pageKey(route, shell)" class="route-page">
        <component :is="Component" />
      </div>
    </Transition>
  </RouterView>
</template>
