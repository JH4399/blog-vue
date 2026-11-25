<script setup>
import AppSelect from '../components/AppSelect.vue'
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Icon from '../components/AppIcon.vue'
import UserAvatar from '../components/UserAvatar.vue'
import PostCard from '../components/PostCard.vue'
import ListPagination from '../components/ListPagination.vue'
import CollectionFrame from '../components/CollectionFrame.vue'
import { useBlogStore } from '../stores/blog'
const blog = useBlogStore()
const route = useRoute(), router = useRouter()
const search = ref(''), layout = ref('list'), demoPage = ref(1), order = ref('newest'), status = ref('all')
const category = computed(() => Number(route.query.category) || 0)
const activeTag = computed(() => Number(route.query.tag) || 0)
const pageSize = 10
const page = computed({ get: () => blog.demo ? demoPage.value : blog.postPagination.page, set: value => { if (blog.demo) demoPage.value = value; else blog.loadPosts({ page: value }) } })
const pending = ref(false)
let filterTimer, disposed = false, ready = false
const query = () => ({ page: 1, q: search.value.trim(), status: blog.user && status.value !== 'all' ? status.value : '', categoryId: category.value || '', tagId: activeTag.value || '', sort: order.value === 'popular' ? 'views' : 'newest' })
async function reload() { await blog.loadPosts(query()) }
onMounted(async () => { await blog.initialize(); if (disposed) return; ready = true; if (!blog.demo) await reload() })
onUnmounted(() => { disposed = true; clearTimeout(filterTimer); blog.invalidatePosts() })
watch([search, category, activeTag, order, status, () => blog.user?.id], () => {
  demoPage.value = 1
  if (blog.demo || !ready) return
  blog.invalidatePosts(); clearTimeout(filterTimer); pending.value = true
  filterTimer = setTimeout(async () => { try { await reload() } finally { if (!disposed) pending.value = false } }, 300)
})
const filtered = computed(() => {
  if (!blog.demo) return blog.posts
  const query = search.value.toLocaleLowerCase().trim()
  const result = blog.posts.filter(p => (!category.value || p.categoryId === category.value) && (!activeTag.value || p.tagIds?.includes(activeTag.value)) && (status.value === 'all' || p.status === Number(status.value)) && (!query || `${p.title} ${p.summary || ''} ${p.content || ''}`.toLocaleLowerCase().includes(query)))
  return [...result].sort((a, b) => Number(b.isTop || 0) - Number(a.isTop || 0) || (order.value === 'popular' ? (b.viewCount || 0) - (a.viewCount || 0) : order.value === 'oldest' ? new Date(a.createdAt) - new Date(b.createdAt) : new Date(b.createdAt) - new Date(a.createdAt)))
})
const totalPages = computed(() => blog.demo ? Math.max(1, Math.ceil(filtered.value.length / pageSize)) : blog.postPagination.pages)
const visible = computed(() => blog.demo ? filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize) : filtered.value)
const totalPosts = computed(() => blog.demo ? blog.posts.length : blog.postPagination.total)
watch([activeTag, () => blog.posts], () => { if (blog.demo) demoPage.value = 1 })
const profileName = computed(() => blog.user?.nickname || blog.user?.username || '')
</script>
<template>
  <div class="home-layout" :class="{ 'without-sidebar': !blog.user }">
    <div class="home-main">
      <section id="articles" class="articles-section">
      <div class="section-heading article-list-heading">
        <div><h2>文章<span class="count-pill">{{ totalPosts.toString().padStart(2, '0') }}</span></h2></div>
        <div class="article-list-actions">
          <RouterLink to="/write" class="button write-article-link"><Icon name="edit" :size="15" /><span>写文章</span></RouterLink>
        </div>
      </div>
      <div class="filter-row article-list-filters">
        <label class="search-field"><Icon name="search" :size="17" /><input v-model="search" maxlength="200" placeholder="搜索文章" aria-label="搜索文章"><button v-if="search" class="icon-button" aria-label="清空搜索" @click="search = ''"><Icon name="close" :size="15" /></button></label>
        <div class="article-filter-actions">
          <AppSelect v-if="blog.user" v-model="status" aria-label="文章状态" :options="[{ value: 'all', label: '全部状态' }, { value: '1', label: '已发布' }, { value: '0', label: '草稿' }, { value: '2', label: '私密' }]" />
          <AppSelect v-model="order" aria-label="文章排序" :options="[{ value: 'newest', label: '最新发布' }, ...(blog.demo ? [{ value: 'oldest', label: '最早发布' }] : []), { value: 'popular', label: '最多浏览' }]" />
          <div class="layout-switch"><button :class="{ selected: layout === 'grid' }" class="icon-button" aria-label="网格视图" :aria-pressed="layout === 'grid'" @click="layout = 'grid'"><Icon name="grid" :size="17" /></button><button :class="{ selected: layout === 'list' }" class="icon-button" aria-label="列表视图" :aria-pressed="layout === 'list'" @click="layout = 'list'"><Icon name="list" :size="19" /></button></div>
        </div>
      </div>
      <div v-if="category || activeTag" class="active-filter-slot"><button class="button secondary small" @click="router.replace({ query: { ...route.query, category: undefined, tag: undefined } })">清除筛选</button></div>
      <CollectionFrame class="article-collection" label="文章列表">
      <div v-if="blog.loading || pending || !blog.initialized" class="post-grid" aria-label="正在加载文章" aria-busy="true"><div v-for="i in 2" :key="i" class="skeleton-card"><div></div><i></i><i></i><i></i></div></div>
      <div v-else-if="blog.error" class="empty-state"><Icon name="alert" :size="32" /><button class="button secondary" @click="reload">重新加载</button></div>
      <div v-else-if="!visible.length" class="empty-state"><p>暂无文章</p><RouterLink v-if="!blog.demo && !blog.posts.length && blog.user" to="/write" class="button primary">写文章</RouterLink><button v-else class="button secondary" @click="search = ''; status = 'all'; router.replace({ query: {} })">查看全部</button></div>
      <div v-else class="post-grid" :class="{ 'list-layout': layout === 'list' }"><PostCard v-for="(post, index) in visible" :key="post.id" :post="post" :index="(page - 1) * pageSize + index + 1" /></div>
      <template #footer>
      <div v-if="blog.demo && filtered.length" class="pagination"><span>共 {{ filtered.length }} 篇记录</span><div><button class="icon-button" :disabled="page === 1" aria-label="上一页" @click="page--"><Icon name="back" :size="16" /></button><button v-for="n in totalPages" :key="n" :class="{ selected: n === page }" :aria-label="`第 ${n} 页`" :aria-current="n === page ? 'page' : undefined" @click="page = n">{{ n }}</button><button class="icon-button" :disabled="page === totalPages" aria-label="下一页" @click="page++"><Icon name="arrow" :size="16" /></button></div></div>
      <ListPagination v-if="!blog.demo" :pagination="blog.postPagination" :busy="blog.loading || pending" label="篇文章" @change="page = $event" />
      </template>
      </CollectionFrame>
      </section>
    </div>
    <aside v-if="blog.user" class="sidebar">
      <section v-if="blog.user" class="profile-card"><div class="profile-avatar"><UserAvatar :src="blog.user.avatar" :name="profileName" :size="54" alt="我的头像" /></div><div class="profile-content"><h3><span class="profile-name">{{ profileName }}</span><span class="online-dot"></span></h3><p v-if="blog.user.bio">{{ blog.user.bio }}</p><div class="profile-stats"><div><b>{{ totalPosts }}</b><span>篇文章</span></div></div></div></section>
    </aside>
  </div>
</template>

<style scoped>
.home-layout { padding-top: 44px; }
.article-list-heading { margin-bottom: 24px; }
.article-list-heading h2 { font-size: 29px; font-weight: 600; letter-spacing: -1px; }
.article-list-heading .count-pill { background: transparent; color: var(--muted); font-size: 12px; font-weight: 400; padding: 0; }
.article-list-filters { padding-bottom: 20px; margin-bottom: 18px; border-bottom: 1px solid var(--border); gap: 16px; }
.article-list-filters .search-field { max-width: 340px; background: var(--surface-soft); border-color: transparent; border-radius: 9px; height: 40px; }
.article-list-filters .search-field input { font-size: 12px; }
.article-filter-actions { margin-left: auto; }
.article-collection :deep(.collection-frame-body) { height: auto; min-height: 0; overflow: visible; padding: 0; scrollbar-gutter: auto; }
.article-collection :deep(.collection-frame-body > .empty-state) { min-height: 280px; }
.article-collection :deep(.collection-frame-footer) { height: auto; min-height: 80px; padding-top: 16px; }
.article-collection :deep(.post-grid) { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; align-items: start; }
.article-collection :deep(.post-grid.list-layout) { grid-template-columns: minmax(0, 1fr); gap: 0; }
.article-collection :deep(.skeleton-card) { height: 280px; }
@media (min-width: 1000px) { .without-sidebar .home-main { max-width: 960px; width: 100%; margin: 0 auto; } }
@media (max-width: 850px) {
  .home-layout { grid-template-columns: minmax(0, 1fr); }
  .sidebar { border-top: 1px solid var(--border); padding-top: 24px; }
  .sidebar > .profile-card { max-width: 400px; }
  .article-list-filters { flex-wrap: wrap; }
  .article-list-filters .search-field { max-width: none; min-width: 180px; }
}
@media (max-width: 600px) {
  .home-layout { padding-top: 30px; }
  .article-list-heading h2 { font-size: 26px; }
  .article-list-filters { gap: 12px; margin-bottom: 16px; padding-bottom: 16px; }
  .article-list-filters .search-field { flex-basis: 100%; }
  .article-collection :deep(.post-grid) { grid-template-columns: minmax(0, 1fr); gap: 20px; }
}
</style>
