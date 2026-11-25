export const postStatusLabel = value => ({ 0: '草稿', 1: '已发布', 2: '私密' }[value] || '未知状态')
export const roleLabel = value => value === 2 ? '管理员' : value === 1 ? '普通用户' : '未知角色'
export const numberLabel = value => Number(value || 0).toLocaleString('zh-CN')
export function summarizePosts(posts) {
  return posts.reduce((result, post) => ({
    posts: result.posts + 1,
    published: result.published + (post.status === 1 ? 1 : 0),
    views: result.views + Number(post.viewCount || 0),
    likes: result.likes + Number(post.likeCount || 0),
    comments: result.comments + Number(post.commentCount || 0),
  }), { posts: 0, published: 0, views: 0, likes: 0, comments: 0 })
}
export function filterPosts(posts, { query = '', status = '', category = '', author = '', sort = 'newest' }, authorName) {
  const keyword = query.toLowerCase().trim()
  return posts.filter(post => (!keyword || `${post.title} ${post.slug} ${post.id} ${authorName(post.userId)}`.toLowerCase().includes(keyword)) && (status === '' || post.status === Number(status)) && (category === '' || String(post.categoryId ?? '') === String(category)) && (author === '' || String(post.userId) === String(author)))
    .sort((a, b) => sort === 'views' ? Number(b.viewCount || 0) - Number(a.viewCount || 0) : sort === 'likes' ? Number(b.likeCount || 0) - Number(a.likeCount || 0) : new Date(b.createdAt) - new Date(a.createdAt))
}
