export const demoCategories = [
  { id: 1, name: '技术手记', slug: 'tech', description: '在代码里寻找答案' },
  { id: 2, name: '生活随笔', slug: 'life', description: '收藏生活的微小瞬间' },
  { id: 3, name: '阅读思考', slug: 'reading', description: '与文字相遇，与自己对话' },
  { id: 4, name: '设计灵感', slug: 'design', description: '发现日常里的美好设计' },
]
export const demoTags = [{ id: 1, name: 'Vue.js' }, { id: 2, name: '前端开发' }, { id: 3, name: '日常' }, { id: 4, name: '阅读' }, { id: 5, name: '设计' }, { id: 6, name: '独立思考' }]
export const demoPosts = [
  { id: 1, categoryId: 2, title: '在快节奏的世界里，找回自己的步调', summary: '关掉一些通知，留出一段空白。我们不必时时刻刻奔跑，也可以停下来，听听风穿过树叶的声音。', createdAt: '2026-11-12T10:00:00', coverImage: '', isTop: 1, viewCount: 128, commentCount: 6, tagIds: [3, 6] },
  { id: 2, categoryId: 1, title: '把复杂留给代码，把简单留给用户', summary: '一次关于 Vue 组件设计的实践：从拆分边界开始，让每一段代码都拥有恰到好处的职责。', createdAt: '2026-11-09T14:20:00', viewCount: 96, commentCount: 3, tagIds: [1, 2] },
  { id: 3, categoryId: 3, title: '读书的意义，是拥有另一双眼睛', summary: '最近读过的一些文字，像一扇半开的窗。世界没有改变，但看世界的方式，悄悄变了。', createdAt: '2026-11-06T09:00:00', viewCount: 74, commentCount: 2, tagIds: [4, 6] },
  { id: 4, categoryId: 4, title: '好的设计，往往从「少一点」开始', summary: '留白不是空白，而是给内容呼吸的空间。记录那些让我心动的界面细节，以及它们背后的选择。', createdAt: '2026-10-28T16:30:00', viewCount: 82, commentCount: 4, tagIds: [5] },
  { id: 5, categoryId: 2, title: '一个人的周末，也可以很丰盛', summary: '一杯咖啡、一本书、一段没有目的地的散步。把普通的一天，过成值得收藏的小事。', createdAt: '2026-10-19T10:00:00', viewCount: 65, commentCount: 1, tagIds: [3] },
].map(post => ({ userId: 1, status: 1, isTop: 0, likeCount: 0, ...post, slug: `example-${post.id}`, content: `# ${post.title}\n\n${post.summary}\n\n## 给生活留一点空白\n\n有时候，我们需要的并不是更多，而是更少。少一点急切，多一点耐心；少一点预设，多一点好奇。\n\n> 记录不是为了留住时间，而是为了认真地度过它。\n\n试着从一件小事开始：\n\n- 写下今天的新发现\n- 读几页喜欢的书\n- 给自己一段安静的时间\n\n## 慢慢来，也很好\n\n这是一篇用于展示阅读排版的示例文章。切换到真实博客后，这里将呈现你自己的文字。` }))
export const demoLinks = [{ id: 1, name: 'Vue.js', url: 'https://cn.vuejs.org', description: '渐进式 JavaScript 框架，创造更多可能。' }, { id: 2, name: 'MDN Web Docs', url: 'https://developer.mozilla.org/zh-CN/', description: '关于开放网络的一切，探索与学习的起点。' }, { id: 3, name: '少数派', url: 'https://sspai.com', description: '高效工作，品质生活，找到自己的生活方式。' }]
