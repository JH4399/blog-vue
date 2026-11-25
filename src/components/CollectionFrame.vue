<script setup>
defineProps({ label: { type: String, required: true } })
</script>

<template>
  <div class="collection-frame">
    <div class="collection-frame-body" role="region" :aria-label="label" tabindex="0"><slot /></div>
    <div class="collection-frame-footer"><slot name="footer" /></div>
  </div>
</template>

<style>
.collection-frame{min-width:0;--collection-height:clamp(440px,65vh,720px)}
.collection-frame-body{height:var(--collection-height);overflow:auto;scrollbar-gutter:stable;overflow-anchor:none;padding:4px;min-width:0}
.collection-frame-body>.empty-state{min-height:100%;justify-content:center}
.collection-frame-body>.post-grid,.collection-frame-body>.links-grid{align-content:start}
.collection-frame-footer{height:72px;display:flex;align-items:center;min-width:0}
.collection-frame-footer>.pagination{width:100%;margin:0;min-width:0}
@media(max-width:480px){.collection-frame{--collection-height:clamp(400px,65vh,600px)}.collection-frame-footer{height:84px}}
</style>
