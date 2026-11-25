import { api } from './api'

// A deleted last page now returns an empty records array at the requested page.
// Follow at most one correction, and never follow a request invalidated by logout or navigation.
export async function loadPage(resource, parameters = {}, isCurrent = () => true) {
  let result = await api.list(resource, parameters)
  if (isCurrent() && !result.records.length && result.page > Math.max(1, result.pages)) {
    result = await api.list(resource, { ...parameters, page: Math.max(1, result.pages) })
  }
  return result
}
