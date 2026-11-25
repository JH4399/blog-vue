<script setup>
defineProps({ name: String, size: { type: [Number, String], default: 20 } })
const paths = {
  image: 'M3 3h18v18H3V3Zm0 14 6-6 4 4 3-3 5 5M8 7h.01',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M13 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  refresh: 'M20 7v5h-5M4 17v-5h5m-4.5-4a8 8 0 0 1 13.2-3L20 8M4 16l2.3 3A8 8 0 0 0 19.5 16',
  settings: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-2-6h4l1 3 3 1 3 1v4l-2 2-1 3-1 3h-4l-2-2-3-1-3-1v-4l2-2 1-3 2-4Z',
  logout: 'M9 4H4v16h5m5-13 5 5-5 5m-6-5h12',
  leaf: 'M20 4C11 2 3 6 4 13c1 7 11 8 14 1 1-3 1-6 2-10ZM5 19 15 9M8 16v-5m3 2h5',
  arrow: 'M4 12h15m-6-6 6 6-6 6', chevron: 'm9 5 7 7-7 7', back: 'M20 12H5m6-6-6 6 6 6',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z', edit: 'm16 3 5 5-12 12-6 1 1-6L16 3Zm-3 3 5 5',
  moon: 'M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13Z', sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  comment: 'M21 11a9 9 0 0 1-9 9c-2 0-3-.5-5-1l-5 2 2-5c-1-2-1-3-1-5a9 9 0 0 1 18 0Z', folder: 'M3 7V5h7l2 3h9v12H3V7Z', tag: 'M20 13 11 22 2 13V3h10l8 10ZM7 7h.01',
  pin: 'm9 3 12 12m-8-10-7 7m12-2-7 7-4-4-4-1 7-7 1-4m-1 14-6 6', close: 'm6 6 12 12M6 18 18 6', check: 'm5 12 4 4L19 6', alert: 'M12 8v5m0 4h.01M10 3 2 19h20L14 3h-4Z',
  menu: 'M4 6h16M4 12h16M4 18h16', grid: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z', list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  link: 'm10 14 4-4m-5 7-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0-1 2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0', external: 'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',
  book: 'M12 5v16M12 5C8 2 3 3 2 4v15c4-2 7-1 10 2 3-3 6-4 10-2V4c-4-2-7-1-10 1Z', coffee: 'M4 8h13v8a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Zm13 0h2a3 3 0 1 1 0 6h-2M7 2v3m4-3v3m4-3v3', code: 'm8 5-7 7 7 7m8-14 7 7-7 7m-3-17-2 20',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7', save: 'M3 3h15l3 3v15H3V3Zm4 0v7h10V3M7 21v-7h10v7',
}
</script>
<template><svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name] || paths.leaf" /></svg></template>
