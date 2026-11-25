// Keep the backend's zero-page empty result; presentation decides how to label it.
export function readPage(data) {
  if (!data || !Array.isArray(data.records) || data.records.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('列表返回格式不正确，缺少有效的 records 数组。')
  const { total, page, size, pages } = data
  if (![total, page, size, pages].every(Number.isSafeInteger) || total < 0 || page < 1 || size < 1 || size > 100 || pages < 0 || (total > 0 && pages < 1) || data.records.length > size) throw new Error('列表返回的分页信息不正确，请稍后重试。')
  return { records: data.records, total, page, size, pages }
}
export const emptyPage = () => ({ page: 1, size: 10, total: 0, pages: 0 })
