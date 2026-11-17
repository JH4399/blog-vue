export function dateLabel(value, short = false) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return '日期未记录'
  return date.toLocaleDateString('zh-CN', { ...(short ? {} : { year: 'numeric' }), month: '2-digit', day: '2-digit' }).replaceAll('/', '.')
}
export const readingTime = content => Math.max(1, Math.ceil((content || '').replace(/\s/g, '').length / 400))
export const safeUrl = value => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : '' } catch { return '' }
}
export const hostname = value => { const url = safeUrl(value); return url ? new URL(url).hostname : '链接暂不可用' }
export const excerpt = post => post.summary || (post.content || '').replace(/[#*`>\[\]]/g, '').slice(0, 120)
