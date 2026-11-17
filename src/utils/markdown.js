// HTML is escaped before formatting. Only HTTP(S) links are emitted.
const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
function inline(value) {
  const tokens = []
  const token = html => { tokens.push(html); return `\u0000${tokens.length - 1}\u0000` }
  let text = escapeHtml(value.replaceAll('\u0000', ''))
  text = text.replace(/`([^`]+)`/g, (_, code) => token(`<code>${code}</code>`))
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => token(`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`))
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>')
  return text.replace(/\u0000(\d+)\u0000/g, (_, id) => tokens[Number(id)] || '')
}
export function markdown(source = '') {
  const lines = source.replace(/\r\n?/g, '\n').split('\n'), html = []
  let code = null, codeLanguage = '', paragraph = [], list = null, headingIndex = 0
  function flushParagraph() { if (paragraph.length) { html.push(`<p>${paragraph.map(inline).join('<br>')}</p>`); paragraph = [] } }
  function closeList() { if (list) { html.push(`</${list}>`); list = null } }
  for (const line of lines) {
    if (/^```/.test(line)) {
      flushParagraph(); closeList()
      if (code !== null) { html.push(`<pre><code data-language="${escapeHtml(codeLanguage)}">${escapeHtml(code.join('\n'))}</code></pre>`); code = null }
      else { code = []; codeLanguage = line.slice(3).trim() }
      continue
    }
    if (code !== null) { code.push(line); continue }
    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) { flushParagraph(); closeList(); html.push(`<h${heading[1].length} id="heading-${headingIndex++}">${inline(heading[2])}</h${heading[1].length}>`); continue }
    if (!line.trim()) { flushParagraph(); closeList(); continue }
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) { flushParagraph(); closeList(); html.push('<hr>'); continue }
    const item = line.match(/^\s*(?:([-*+])|\d+\.)\s+(.+)$/)
    if (item) { flushParagraph(); const type = item[1] ? 'ul' : 'ol'; if (list !== type) { closeList(); list = type; html.push(`<${type}>`) }; html.push(`<li>${inline(item[2])}</li>`); continue }
    if (/^>\s?/.test(line)) { flushParagraph(); closeList(); html.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); continue }
    closeList(); paragraph.push(line)
  }
  flushParagraph(); closeList()
  if (code !== null) html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
  return html.join('\n')
}
export function headings(source = '') {
  let code = false, index = 0
  return source.split(/\r?\n/).flatMap(line => {
    if (/^```/.test(line)) { code = !code; return [] }
    const match = !code && line.match(/^(#{1,6})\s+(.+)$/)
    return match ? [{ id: `heading-${index++}`, level: match[1].length, text: match[2].replace(/[*`]/g, '') }] : []
  })
}
