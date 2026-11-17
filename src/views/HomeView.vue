<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import Icon from '../components/AppIcon.vue'
import PostCard from '../components/PostCard.vue'
import PostCover from '../components/PostCover.vue'
import { useBlogStore } from '../stores/blog'
import { api } from '../services/api'
import { dateLabel, excerpt, readingTime, safeUrl } from '../utils/format'
const blog = useBlogStore()
const route = useRoute(), router = useRouter()
const search = ref(''), layout = ref('grid'), page = ref(1), order = ref('newest'), status = ref('all')
const tagIds = ref(null), tagLoading = ref(false), tagError = ref('')
const category = computed(() => Number(route.query.category) || 0)
const activeTag = computed(() => Number(route.query.tag) || 0)
const pageSize = 6
let tagVersion = 0
function selectCategory(id) { router.replace({ query: { ...route.query, category: id || undefined } }) }
function selectTag(id) { router.replace({ query: { ...route.query, tag: activeTag.value === id ? undefined : id } }) }
watch([activeTag, () => blog.posts, () => blog.demo], async () => {
  const version = ++tagVersion
  tagIds.value = null; tagError.value = ''; tagLoading.value = false
  if (!activeTag.value) return
  tagLoading.value = true
  try {
    if (blog.demo) tagIds.value = blog.posts.filter(p => p.tagIds?.includes(activeTag.value)).map(p => p.id)
    else {
      const selectedTag = activeTag.value
      const matches = []
      // The API has no tag-filter endpoint; limit concurrent association queries.
      for (let i = 0; i < blog.posts.length; i += 5) {
        const group = await Promise.all(blog.posts.slice(i, i + 5).map(async p => ({ id: p.id, tags: await api.list('post-tags', `?postId=${p.id}`) })))
        if (version !== tagVersion) return
        matches.push(...group.filter(p => p.tags.some(t => t.tagId === selectedTag)).map(p => p.id))
      }
      tagIds.value = matches
    }
  } catch (e) { if (version === tagVersion) tagError.value = e.message }
  finally { if (version === tagVersion) tagLoading.value = false }
}, { immediate: true })
const filtered = computed(() => {
  const query = search.value.toLocaleLowerCase().trim()
  const result = blog.posts.filter(p => (!category.value || p.categoryId === category.value) && (!activeTag.value || tagIds.value?.includes(p.id)) && (status.value === 'all' || p.status === Number(status.value)) && (!query || `${p.title} ${p.summary || ''} ${p.content || ''}`.toLocaleLowerCase().includes(query)))
  return [...result].sort((a, b) => Number(b.isTop || 0) - Number(a.isTop || 0) || (order.value === 'popular' ? (b.viewCount || 0) - (a.viewCount || 0) : order.value === 'oldest' ? new Date(a.createdAt) - new Date(b.createdAt) : new Date(b.createdAt) - new Date(a.createdAt)))
})
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const visible = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const featured = computed(() => blog.posts.find(p => p.isTop && p.status === 1) || blog.posts.find(p => p.status === 1))
watch([search, category, activeTag, order, status, () => blog.posts], () => page.value = 1)
const profileName = computed(() => blog.user?.nickname || blog.user?.username || '一个认真生活的人')
function browse() { document.getElementById('articles')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
</script>
<template>
  <section class="home-hero">
    <div class="hero-copy"><div class="eyebrow"><span class="tiny-line"></span>A LITTLE SPACE FOR BIG IDEAS</div><h1>记录生活的切片，<br>收藏<span class="serif-emphasis">思考的微光。</span><span class="hero-spark">✳</span></h1><p>关于技术、生活与那些值得被记住的瞬间。<br>在这里，慢一点，也没关系。</p><button class="text-link" @click="browse">开始阅读 <Icon name="arrow" :size="18" /></button></div>
    <div class="hero-art" aria-hidden="true"><span class="hero-art-label">THE ART OF<br>EVERYDAY LIVING</span><div class="hero-circle"></div><div class="hero-arch"><div class="arch-sun"></div><div class="arch-land land-one"></div><div class="arch-land land-two"></div></div><div class="hero-stem"><i></i><i></i><i></i><i></i><i></i><i></i></div><span class="hero-art-note">stay curious, keep growing.</span><span class="hero-art-star">✳</span></div>
  </section>
  <div class="home-layout">
    <div class="home-main">
      <section v-if="featured" class="featured-post"><PostCover :post="featured" :variant="0" /><div class="featured-body"><div class="eyebrow"><Icon name="pin" :size="13" />编辑精选 <span>FEATURED STORY</span></div><h2><RouterLink :to="`/posts/${featured.id}`">{{ featured.title }}</RouterLink></h2><p>{{ excerpt(featured) }}</p><div class="featured-bottom"><span>{{ dateLabel(featured.publishedAt || featured.createdAt) }}<i>·</i>{{ readingTime(featured.content) }} 分钟阅读</span><RouterLink :to="`/posts/${featured.id}`" class="round-arrow" aria-label="阅读精选文章"><Icon name="arrow" /></RouterLink></div></div></section>
      <section v-else class="welcome-card"><div><span class="eyebrow">YOUR NEXT CHAPTER</span><h2>每一个想法，都值得被记录。</h2><p>把散落的灵感写下来，让平凡的日子有迹可循。</p><RouterLink :to="blog.user ? '/write' : '/login'" class="text-link">{{ blog.user ? '写下第一篇文章' : '登录，开启你的记录' }} <Icon name="arrow" :size="17" /></RouterLink></div><Icon name="book" :size="75" /></section>
      <section id="articles" class="articles-section"><div class="section-heading"><div><h2>最新文章<span class="count-pill">{{ blog.posts.length.toString().padStart(2, '0') }}</span></h2><p>文字有迹，生活有光。</p></div><div class="layout-switch"><button :class="{ selected: layout === 'grid' }" class="icon-button" aria-label="网格视图" :aria-pressed="layout === 'grid'" @click="layout = 'grid'"><Icon name="grid" :size="17" /></button><button :class="{ selected: layout === 'list' }" class="icon-button" aria-label="列表视图" :aria-pressed="layout === 'list'" @click="layout = 'list'"><Icon name="list" :size="19" /></button></div></div>
      <div class="category-tabs"><button :class="{ selected: !category }" @click="selectCategory(0)">全部文章</button><button v-for="item in blog.categories" :key="item.id" :class="{ selected: category === item.id }" @click="selectCategory(item.id)">{{ item.name }}</button></div>
      <div class="filter-row"><label class="search-field"><Icon name="search" :size="17" /><input v-model="search" placeholder="搜索文章，发现灵感…" aria-label="搜索文章"><button v-if="search" class="icon-button" aria-label="清空搜索" @click="search = ''"><Icon name="close" :size="15" /></button></label><select v-if="blog.user" v-model="status" aria-label="文章状态"><option value="all">全部状态</option><option value="1">已发布</option><option value="0">草稿</option><option value="2">私密</option></select><select v-model="order" aria-label="文章排序"><option value="newest">最新发布</option><option value="oldest">最早发布</option><option value="popular">最多浏览</option></select></div>
      <div v-if="activeTag" class="active-filter">标签：{{ blog.tags.find(t => t.id === activeTag)?.name || activeTag }}<button class="icon-button" aria-label="取消标签筛选" @click="selectTag(activeTag)"><Icon name="close" :size="14" /></button></div>
      <div v-if="blog.loading || tagLoading || !blog.initialized" class="post-grid" aria-label="正在加载文章" aria-busy="true"><div v-for="i in 2" :key="i" class="skeleton-card"><div></div><i></i><i></i><i></i></div></div>
      <div v-else-if="blog.error || tagError" class="empty-state"><Icon name="alert" :size="32" /><h3>暂时没能读到文章</h3><p>{{ blog.error || tagError }}</p><button class="button secondary" @click="tagError ? router.replace({ query: { ...route.query, tag: undefined } }) : blog.refresh()">{{ tagError ? '清除筛选' : '重新加载' }}</button></div>
      <div v-else-if="!blog.canRead" class="empty-state login-prompt"><span class="empty-icon"><Icon name="book" :size="29" /></span><h3>你的故事，从这里开始</h3><p>登录后阅读和管理你的文章，<br>也可以先逛逛拾光的示例空间。</p><div class="button-row"><RouterLink to="/login" class="button primary">登录博客 <Icon name="arrow" :size="16" /></RouterLink><button class="button secondary" @click="blog.setDemo(true)">浏览示例</button></div><small>文章按账户权限展示，为每一份记录保留自己的空间。</small></div>
      <div v-else-if="!visible.length" class="empty-state"><Icon name="search" :size="32" /><h3>{{ blog.posts.length ? '还没有找到这篇故事' : '这里，等着你的第一篇文章' }}</h3><p>{{ blog.posts.length ? '换个关键词，或试试其他分类。' : '不必等灵感完美，先写下此刻的想法。' }}</p><RouterLink v-if="!blog.demo && !blog.posts.length" to="/write" class="button primary">开始写作</RouterLink><button v-else class="button secondary" @click="search = ''; status = 'all'; router.replace({ query: {} })">查看全部</button></div>
      <div v-else class="post-grid" :class="{ 'list-layout': layout === 'list' }"><PostCard v-for="(post, index) in visible" :key="post.id" :post="post" :index="(page - 1) * pageSize + index + 1" /></div>
      <div v-if="filtered.length" class="pagination"><span>共 {{ filtered.length }} 篇记录</span><div><button class="icon-button" :disabled="page === 1" aria-label="上一页" @click="page--; browse()"><Icon name="back" :size="16" /></button><button v-for="n in totalPages" :key="n" :class="{ selected: n === page }" :aria-label="`第 ${n} 页`" :aria-current="n === page ? 'page' : undefined" @click="page = n; browse()">{{ n }}</button><button class="icon-button" :disabled="page === totalPages" aria-label="下一页" @click="page++; browse()"><Icon name="arrow" :size="16" /></button></div></div>
      </section>
    </div>
    <aside class="sidebar">
      <section class="profile-card"><div class="profile-cover"><span>HELLO, STRANGER</span><Icon name="leaf" :size="40" /></div><div class="profile-avatar"><img v-if="safeUrl(blog.user?.avatar)" :src="safeUrl(blog.user.avatar)" alt="我的头像" @error="$event.target.style.display = 'none'"><Icon v-else name="coffee" :size="31" /></div><div class="profile-content"><h3>{{ profileName }}<span class="online-dot"></span></h3><p>{{ blog.user?.bio || '写代码，也写生活。\n保持好奇，慢慢生长。' }}</p><div class="profile-stats"><div><b>{{ blog.posts.length }}</b><span>篇文章</span></div><div><b>{{ blog.categories.length }}</b><span>个分类</span></div><div><b>{{ blog.tags.length }}</b><span>个标签</span></div></div><RouterLink to="/about" class="profile-link">关于这个小站 <Icon name="arrow" :size="16" /></RouterLink></div></section>
      <section class="sidebar-section"><h3><Icon name="folder" :size="17" />文章分类<span>CATEGORIES</span></h3><div class="sidebar-categories"><button v-for="(item, index) in blog.categories" :key="item.id" :class="{ selected: category === item.id }" @click="selectCategory(item.id)"><span><span class="category-symbol" :class="`symbol-${index % 4}`"><Icon :name="['code', 'coffee', 'book', 'leaf'][index % 4]" :size="15" /></span>{{ item.name }}</span><small>{{ blog.posts.filter(p => p.categoryId === item.id).length.toString().padStart(2, '0') }}</small></button><p v-if="!blog.categories.length" class="muted mini-empty">分类将在这里慢慢生长。</p></div></section>
      <section class="sidebar-section"><h3><Icon name="tag" :size="17" />灵感标签<span>EXPLORE</span></h3><div class="tag-cloud"><button v-for="tag in blog.tags" :key="tag.id" :class="{ selected: activeTag === tag.id }" @click="selectTag(tag.id)"><span>#</span> {{ tag.name }}</button><p v-if="!blog.tags.length" class="muted mini-empty">为灵感留下一个索引。</p></div></section>
      <section class="quote-card"><span class="quote-mark">“</span><p>生活不是我们活过的日子，<br>而是我们记住的日子。</p><span class="quote-attribution">— 加西亚·马尔克斯</span><div class="quote-bottom">A THOUGHT TO KEEP <Icon name="leaf" :size="24" /></div></section>
      <p v-if="blog.publicError" class="sidebar-error">{{ blog.publicError }}<button @click="blog.loadPublic()">重试</button></p>
      <div class="sidebar-note"><span class="online-dot"></span>一隅安静的互联网角落</div>
    </aside>
  </div>
</template>
