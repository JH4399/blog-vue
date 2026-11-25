import { readonly, shallowRef } from 'vue'

const entries = shallowRef([])
const reported = new WeakMap()
let sequence = 0
export const NOTICE_DURATION = 4000
const timers = new Map()

export function dismissError(id) {
  clearTimeout(timers.get(id))
  timers.delete(id)
  entries.value = entries.value.filter(entry => entry.id !== id)
}

function scheduleDismiss(id) {
  clearTimeout(timers.get(id))
  const timer = setTimeout(() => dismissError(id), NOTICE_DURATION)
  timer.unref?.()
  timers.set(id, timer)
}
export const errorEntries = readonly(entries)

// Keep the original error identity across API, page and global handlers.
export function reportError(error, { message, fallback } = {}) {
  const text = String(message || fallback || (typeof error === 'string' ? error : error?.message) || '操作出现异常，请稍后重试。')
  const isObject = error !== null && (typeof error === 'object' || typeof error === 'function')
  const previous = isObject ? reported.get(error) : undefined
  if (previous) {
    if (message && entries.value.some(entry => entry.id === previous)) {
      entries.value = entries.value.map(entry => entry.id === previous ? { ...entry, message: text } : entry)
      scheduleDismiss(previous)
    }
    return text
  }
  const existing = entries.value.find(entry => entry.message === text)
  const id = existing?.id || ++sequence
  if (isObject) reported.set(error, id)
  if (!existing) entries.value = [...entries.value, { id, message: text }]
  scheduleDismiss(id)
  return text
}

export function dismissErrors() {
  timers.forEach(timer => clearTimeout(timer))
  timers.clear()
  entries.value = []
}

export function installErrorHandlers(app, router, target = window, documentTarget = document) {
  const runtimeError = error => {
    console.error('[博客前端异常]', error)
    reportError(error, { fallback: '页面运行出现异常，请重试；如果仍然失败，请刷新页面。' })
  }
  app.config.errorHandler = runtimeError
  const removeRouterHandler = router.onError(error => {
    reportError(error, { fallback: '页面加载失败，请检查网络后重试或刷新页面。' })
  })
  const onError = event => {
    if (event.error) runtimeError(event.error)
    else if (event.target?.tagName === 'SCRIPT' || event.target?.tagName === 'LINK') {
      reportError('页面资源加载失败，请检查网络后刷新页面。')
    } else if (event.message) runtimeError(event)
  }
  const onRejection = event => {
    event.preventDefault()
    runtimeError(event.reason || event)
  }
  const onInvalid = event => {
    event.preventDefault()
    const input = event.target
    const label = input.labels?.[0]?.textContent?.trim().split('\n')[0] || input.placeholder || '表单字段'
    reportError(`${label}：${input.validationMessage || '请检查填写内容。'}`)
  }
  target.addEventListener('error', onError, true)
  target.addEventListener('unhandledrejection', onRejection)
  documentTarget.addEventListener('invalid', onInvalid, true)
  return () => {
    removeRouterHandler()
    target.removeEventListener('error', onError, true)
    target.removeEventListener('unhandledrejection', onRejection)
    documentTarget.removeEventListener('invalid', onInvalid, true)
  }
}
