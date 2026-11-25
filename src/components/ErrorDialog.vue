<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import Icon from './AppIcon.vue'
import { errorEntries, dismissError } from '../services/errors'

const host = ref(null)
async function sync() {
  await nextTick()
  // Use the top layer so feedback also appears above open editor dialogs.
  if (!host.value?.showPopover) return
  if (errorEntries.value.length) host.value.showPopover()
  else host.value.hidePopover()
}
watch(errorEntries, sync)
onMounted(sync)
</script>

<template>
  <div ref="host" class="error-notifications" popover="manual" aria-label="操作提示">
    <TransitionGroup name="toast">
      <div v-for="entry in errorEntries" :key="entry.id" class="error-notification" role="alert" aria-atomic="true">
        <Icon name="alert" :size="18" />
        <p>{{ entry.message }}</p>
        <button class="icon-button" type="button" aria-label="关闭提示" @click="dismissError(entry.id)"><Icon name="close" :size="16" /></button>
      </div>
    </TransitionGroup>
  </div>
</template>
