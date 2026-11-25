<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, useId, watch } from 'vue'
import Icon from './AppIcon.vue'

defineOptions({ inheritAttrs: false })
const props = defineProps({
  modelValue: { type: [String, Number], default: null },
  options: { type: Array, default: () => [] },
  label: String,
  placeholder: { type: String, default: '请选择' },
  disabled: Boolean,
  required: Boolean,
  name: String,
})
const emit = defineEmits(['update:modelValue', 'change'])
const id = useId()
const root = ref(null), trigger = ref(null), panel = ref(null)
const open = ref(false), active = ref(-1), topLayer = ref(false)
const position = ref({})
const selected = computed(() => props.options.findIndex(option => Object.is(option.value, props.modelValue)))
const caption = computed(() => props.options[selected.value]?.label ?? props.placeholder)
let observer, searchTimer, search = ''

function place() {
  if (!open.value || !trigger.value || !panel.value) return
  const rect = trigger.value.getBoundingClientRect()
  const viewport = window.visualViewport
  const edgeTop = viewport?.offsetTop || 0, edgeLeft = viewport?.offsetLeft || 0
  const width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight
  const below = edgeTop + height - rect.bottom - 12, above = rect.top - edgeTop - 12
  const upwards = below < Math.min(panel.value.scrollHeight, 200) && above > below
  const maxHeight = Math.max(48, Math.min(280, upwards ? above : below))
  const menuWidth = Math.min(Math.max(rect.width, 144), width - 16)
  position.value = {
    left: `${Math.max(edgeLeft + 8, Math.min(rect.left, edgeLeft + width - menuWidth - 8))}px`,
    top: `${upwards ? Math.max(edgeTop + 8, rect.top - Math.min(panel.value.scrollHeight, maxHeight) - 6) : rect.bottom + 6}px`,
    width: `${menuWidth}px`, maxHeight: `${maxHeight}px`,
    transformOrigin: upwards ? 'bottom center' : 'top center',
  }
}

function close() {
  open.value = false
  if (topLayer.value && panel.value?.matches(':popover-open')) panel.value.hidePopover()
}

async function show(last = false) {
  if (props.disabled || !props.options.some(option => !option.disabled)) return
  active.value = selected.value >= 0 && !props.options[selected.value].disabled ? selected.value
    : (last ? props.options.findLastIndex(option => !option.disabled) : props.options.findIndex(option => !option.disabled))
  open.value = true
  await nextTick()
  if (!open.value) return
  if (topLayer.value && !panel.value.matches(':popover-open')) panel.value.showPopover()
  place()
  await nextTick()
  reveal()
}

function reveal() {
  nextTick(() => {
    const option = panel.value?.children[active.value]
    if (!option) return
    const start = option.offsetTop, end = start + option.offsetHeight
    if (start < panel.value.scrollTop) panel.value.scrollTop = start
    else if (end > panel.value.scrollTop + panel.value.clientHeight) panel.value.scrollTop = end - panel.value.clientHeight
  })
}

function choose(index) {
  const option = props.options[index]
  if (props.disabled || !option || option.disabled) return
  emit('update:modelValue', option.value)
  emit('change', option.value)
  close()
  trigger.value?.focus({ preventScroll: true })
}

function move(step) {
  let index = active.value
  for (let i = 0; i < props.options.length; i++) {
    index = (index + step + props.options.length) % props.options.length
    if (!props.options[index].disabled) { active.value = index; reveal(); return }
  }
}

async function keydown(event) {
  if (props.disabled) return
  if (event.key === 'Tab') { close(); return }
  if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
    event.preventDefault()
    if (!open.value) {
      await show(event.key === 'ArrowUp' || event.key === 'End')
      if (event.key === 'Home' || event.key === 'End') {
        active.value = event.key === 'Home' ? props.options.findIndex(option => !option.disabled) : props.options.findLastIndex(option => !option.disabled)
        reveal()
      }
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') move(event.key === 'ArrowDown' ? 1 : -1)
    else if (event.key === 'Home' || event.key === 'End') {
      active.value = event.key === 'Home' ? props.options.findIndex(option => !option.disabled) : props.options.findLastIndex(option => !option.disabled)
      reveal()
    } else choose(active.value)
  } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault()
    clearTimeout(searchTimer)
    search += event.key.toLocaleLowerCase()
    searchTimer = setTimeout(() => search = '', 600)
    const index = props.options.findIndex(option => !option.disabled && String(option.label).toLocaleLowerCase().startsWith(search))
    if (index >= 0) {
      if (open.value) { active.value = index; reveal() }
      else { emit('update:modelValue', props.options[index].value); emit('change', props.options[index].value) }
    }
  }
}

function outside(event) { if (open.value && !root.value?.contains(event.target)) close() }
function escape(event) {
  if (open.value && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
}
function invalid() { trigger.value?.focus({ preventScroll: true }) }
watch(() => props.disabled, value => { if (value) close() })
watch(() => props.options, () => { if (open.value) close() })
onMounted(() => {
  topLayer.value = typeof panel.value?.showPopover === 'function'
  document.addEventListener('pointerdown', outside, true)
  document.addEventListener('focusin', outside)
  document.addEventListener('keydown', escape, true)
  window.addEventListener('resize', place)
  window.addEventListener('scroll', place, true)
  window.visualViewport?.addEventListener('resize', place)
  if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(place); observer.observe(trigger.value) }
})
onUnmounted(() => {
  clearTimeout(searchTimer)
  observer?.disconnect()
  document.removeEventListener('pointerdown', outside, true)
  document.removeEventListener('focusin', outside)
  document.removeEventListener('keydown', escape, true)
  window.removeEventListener('resize', place)
  window.removeEventListener('scroll', place, true)
  window.visualViewport?.removeEventListener('resize', place)
})
</script>

<template>
  <div ref="root" class="app-select" :class="[$attrs.class, { 'is-open': open, 'is-disabled': disabled }]" :style="$attrs.style">
    <button :id="$attrs.id || `select-${id}`" ref="trigger" type="button" class="select-trigger" role="combobox"
      :disabled="disabled" :aria-label="$attrs['aria-label'] || label" :aria-labelledby="$attrs['aria-labelledby']"
      :aria-describedby="$attrs['aria-describedby']" :aria-expanded="open" aria-haspopup="listbox"
      :aria-controls="`select-options-${id}`" :aria-activedescendant="open && active >= 0 ? `select-option-${id}-${active}` : undefined"
      :aria-required="required || undefined" @click="open ? close() : show()" @keydown="keydown">
      <span>{{ caption }}</span><Icon name="chevron" :size="14" class="select-chevron" />
    </button>
    <input v-if="required || name" class="select-validation" tabindex="-1" aria-hidden="true"
      :aria-label="label || $attrs['aria-label']" :placeholder="label || $attrs['aria-label']"
      :name="name" :required="required" :disabled="disabled" :value="modelValue == null ? '' : String(modelValue)" @invalid="invalid">
    <div :id="`select-options-${id}`" ref="panel" class="select-panel" role="listbox"
      :aria-label="$attrs['aria-label'] || label" :popover="topLayer ? 'manual' : undefined"
      :hidden="!topLayer && !open" :style="position" @pointerdown.prevent>
      <div v-for="(option, index) in options" :id="`select-option-${id}-${index}`" :key="index" role="option"
        class="select-option" :class="{ 'is-active': active === index, 'is-selected': selected === index }"
        :aria-selected="selected === index" :aria-disabled="option.disabled || undefined"
        @pointermove="!option.disabled && (active = index)" @click.stop.prevent="choose(index)">
        <span>{{ option.label }}</span><Icon v-if="selected === index" name="check" :size="15" />
      </div>
    </div>
  </div>
</template>

<style>
.app-select{position:relative;display:inline-block;min-width:0;max-width:100%;font-size:12px;vertical-align:middle}
.select-trigger{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:40px;padding:9px 12px;border:1px solid var(--border);border-radius:7px;background:#fff;color:var(--secondary);text-align:left;font:inherit;line-height:1.5;transition:border-color .16s,box-shadow .16s,background .16s}
.select-trigger>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.select-trigger:hover:not(:disabled){border-color:#c5cec7;background:#fcfdfc}
.select-trigger:focus-visible,.app-select.is-open>.select-trigger{outline:0;border-color:var(--green);box-shadow:0 0 0 3px #536b5812}
.select-chevron{color:var(--muted);transform:rotate(90deg);transition:transform .22s var(--motion-ease,ease)}
.app-select.is-open .select-chevron{transform:rotate(-90deg)}
.app-select.is-disabled .select-trigger{background:var(--surface-soft);cursor:not-allowed}
.select-panel{position:fixed;inset:auto;margin:0;padding:5px;border:1px solid var(--border);border-radius:9px;background:#fff;color:var(--text);box-shadow:0 8px 30px #1c302315,0 2px 6px #1c302308;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;z-index:1000;font-size:12px;opacity:0;transform:translateY(-4px) scale(.98);transition:opacity .16s,transform .2s var(--motion-ease,ease),display .2s allow-discrete,overlay .2s allow-discrete}
.select-panel:popover-open,.select-panel:not([popover]):not([hidden]){opacity:1;transform:translateY(0) scale(1)}
.select-panel::backdrop{background:transparent;pointer-events:none}
@starting-style{.select-panel:popover-open{opacity:0;transform:translateY(-4px) scale(.98)}}
.select-option{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:36px;padding:8px 10px;border-radius:5px;cursor:pointer;line-height:1.6;transition:color .12s,background .12s}
.select-option>span{min-width:0;overflow-wrap:anywhere}
.select-option.is-active{background:var(--surface-soft)}
.select-option.is-selected{color:var(--green-dark);background:var(--green-light);font-weight:500}
.select-option[aria-disabled=true]{opacity:.4;cursor:not-allowed}
.select-validation{position:absolute!important;inset:0 auto auto 0!important;width:1px!important;height:1px!important;opacity:0;pointer-events:none;padding:0!important;border:0!important;margin:0!important}
label>.app-select{display:block;width:100%;margin-top:7px;font-weight:400}
.filter-row>.app-select{flex:0 1 auto;min-width:105px;font-size:11px}
.filter-row .select-trigger{min-height:39px;padding:8px 10px;gap:8px}
.admin-filter-bar>.app-select{min-width:120px;max-width:160px;font-size:11px}
.admin-filter-bar .select-trigger{min-height:38px}
.editor-settings .app-select,.manage-form .app-select{font-size:12px}
.admin-form-grid .app-select{font-size:12px}
@media(max-width:480px){.filter-row>.app-select{min-width:94px;font-size:10px}.filter-row .select-trigger{padding:8px;gap:6px}.select-option{min-height:40px}}
@media(prefers-reduced-motion:reduce){.select-panel,.select-trigger,.select-chevron,.select-option{transition:none!important}}
</style>
