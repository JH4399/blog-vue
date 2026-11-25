import { computed, onMounted, onUnmounted, ref, unref, watch } from 'vue'
import { useAdminStore } from '../stores/admin'

export function useAdminPage(resource, filters = {}) {
  const admin = useAdminStore(), pending = ref(false)
  const key = computed(() => unref(resource))
  const rows = computed(() => admin.lists[key.value])
  const pagination = computed(() => admin.pagination[key.value])
  const loading = computed(() => admin.loading[key.value])
  const error = computed(() => admin.errors[key.value])
  let timer
  function load(page = pagination.value.page) {
    clearTimeout(timer); pending.value = false
    return admin.load(key.value, { ...filters, page })
  }
  watch(() => ({ ...filters }), () => {
    clearTimeout(timer); pending.value = true
    // Invalidate the previous filter request immediately, before the debounce.
    admin.invalidate(key.value)
    timer = setTimeout(() => load(1), 300)
  }, { deep: true, flush: 'sync' })
  watch(key, (value, old) => { admin.invalidate(old); load(1) })
  onMounted(() => load(1))
  onUnmounted(() => { clearTimeout(timer); admin.invalidate(key.value) })
  return { rows, pagination, loading, error, pending, load }
}
