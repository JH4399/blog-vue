export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export function validateImage(file) {
  if (!file || !IMAGE_ACCEPT.split(',').includes(file.type)) throw new Error('仅支持 JPEG、PNG、WebP 图片。')
  if (!file.size) throw new Error('不能上传空图片。')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('单张图片不能超过 5 MB。')
}

// Uploaded paths belong to the API, which may live on a different origin.
export function imageUrl(value, apiBase = import.meta.env?.VITE_API_BASE_URL || '/api') {
  if (typeof value !== 'string') return ''
  const path = value.trim()
  if (/^\/api\/images\/[\w/-]+\.(?:jpe?g|png|webp)$/i.test(path) && !path.split('/').includes('..')) {
    return apiBase.replace(/\/$/, '') + path.slice(4)
  }
  if (!/^https?:\/\//i.test(path)) return ''
  try { const url = new URL(path); return ['http:', 'https:'].includes(url.protocol) ? url.href : '' } catch { return '' }
}

export function imageMarkdown(image) {
  const name = (image.originalName || '图片').replace(/[\\\[\]<>`*\r\n]/g, '') || '图片'
  // Parentheses and whitespace must not terminate the Markdown destination.
  const path = image.url.replace(/[\s()<>]/g, character => character === '(' ? '%28' : character === ')' ? '%29' : encodeURIComponent(character))
  return `![${name}](${path})`
}
