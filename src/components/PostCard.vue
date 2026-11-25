<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import Icon from './AppIcon.vue'
import PostCover from './PostCover.vue'
import { imageUrl } from '../utils/images'
import { dateLabel, readingTime, excerpt } from '../utils/format'

const props = defineProps({ post: Object, index: { type: Number, default: 0 } })
const coverFailed = ref(false)
watch(() => props.post.coverImage, () => coverFailed.value = false)
const hasCover = computed(() => !!imageUrl(props.post.coverImage) && !coverFailed.value)
</script>

<template>
  <article class="post-card" :class="{ 'has-cover': hasCover }">
    <RouterLink v-if="hasCover" :to="`/posts/${post.id}`" class="card-cover-link" tabindex="-1" aria-hidden="true">
      <PostCover :post="post" @load-error="coverFailed = true" />
    </RouterLink>
    <div class="card-body">
      <div class="card-eyebrow">
        <span v-if="post.categoryName" class="card-category">{{ post.categoryName }}</span>
        <span v-if="post.isTop" class="card-pinned"><Icon name="pin" :size="12" />置顶</span>
        <span v-if="post.status !== 1" class="status-badge">{{ post.status === 0 ? '草稿' : '私密' }}</span>
        <time :datetime="post.publishedAt || post.createdAt">{{ dateLabel(post.publishedAt || post.createdAt) }}</time>
      </div>
      <h3><RouterLink :to="`/posts/${post.id}`">{{ post.title }}</RouterLink></h3>
      <p v-if="post.summary || post.content">{{ excerpt(post) }}</p>
      <div class="card-footer">
        <span v-if="post.authorName" class="card-author">{{ post.authorName }}</span>
        <span v-if="post.content" class="card-reading-time">{{ readingTime(post.content) }} 分钟阅读</span>
        <div class="card-metrics">
          <span :aria-label="`${post.viewCount || 0} 次浏览`"><Icon name="eye" :size="14" />{{ post.viewCount || 0 }}</span>
          <span :aria-label="`${post.commentCount || 0} 条评论`"><Icon name="comment" :size="14" />{{ post.commentCount || 0 }}</span>
        </div>
        <RouterLink :to="`/posts/${post.id}`" class="read-arrow" :aria-label="`阅读 ${post.title}`"><Icon name="arrow" :size="17" /></RouterLink>
      </div>
    </div>
  </article>
</template>

<style scoped>
.collection-frame .post-card {
  height: auto; min-height: 0; display: flex; flex-direction: column;
  border: 1px solid var(--border); border-radius: 12px; background: var(--surface);
  overflow: hidden; box-shadow: none; transform: none;
  transition: border-color 180ms ease, box-shadow 180ms ease;
}
.collection-frame .post-card .card-cover-link { flex: none; width: 100%; min-height: 0; overflow: hidden; }
.collection-frame .post-card .card-cover-link :deep(.post-cover) { height: auto; min-height: 0; aspect-ratio: 16 / 9; }
.collection-frame .post-card .card-cover-link :deep(img) { position: absolute; inset: 0; }
.collection-frame .post-card .card-body { height: auto; padding: 24px; gap: 0; }
.collection-frame .post-card .card-eyebrow {
  height: auto; min-height: 18px; flex-wrap: wrap; gap: 8px 12px;
  overflow: visible; white-space: normal; font-size: 11px; line-height: 1.6;
}
.card-category { color: var(--green); font-weight: 600; }
.card-pinned { display: inline-flex; gap: 3px; align-items: center; color: var(--green); font-size: 10px; }
.card-eyebrow time { color: var(--muted); margin-left: auto; font-size: 10px; }
.collection-frame .post-card .card-body h3 {
  height: auto; min-height: 0; max-height: none; margin: 12px 0 0;
  font-size: 21px; line-height: 1.55; font-weight: 600; letter-spacing: -.3px;
  -webkit-line-clamp: 3; overflow-wrap: anywhere;
}
.collection-frame .post-card .card-body > p {
  height: auto; min-height: 0; max-height: none; margin: 12px 0 0;
  font-size: 13px; line-height: 1.85; -webkit-line-clamp: 2; color: var(--secondary);
}
.collection-frame .post-card .card-footer {
  border: 0; margin: 22px 0 0; padding: 0; gap: 12px; flex-wrap: wrap;
  font-size: 11px; line-height: 1.5; white-space: normal;
}
.card-author { color: var(--secondary); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.collection-frame .post-card .card-metrics { display: flex; gap: 12px; margin-left: auto; color: var(--muted); }
.collection-frame .post-card .read-arrow { display: inline-flex; margin-left: 0; padding: 4px; border-radius: 50%; color: var(--green); }
.collection-frame .list-layout .post-card {
  display: flex; flex-direction: row-reverse; align-items: center; gap: 28px;
  height: auto; min-height: 0; padding: 28px 0; border: 0 solid var(--border); border-bottom-width: 1px;
  border-radius: 0; background: transparent;
}
.collection-frame .list-layout .post-card:first-child { padding-top: 8px; }
.collection-frame .list-layout .post-card .card-body { padding: 0; flex: 1; }
.collection-frame .list-layout .post-card .card-cover-link { width: 29%; max-width: 224px; flex: 0 0 29%; border-radius: 9px; }
.collection-frame .list-layout .post-card .card-cover-link :deep(.post-cover) { aspect-ratio: 4 / 3; }
.collection-frame .list-layout .card-eyebrow time { margin-left: 0; }
.collection-frame .list-layout .post-card .card-footer { margin-top: 18px; }
.collection-frame .list-layout .post-card .card-metrics { margin-left: 0; }
.collection-frame .list-layout .post-card .read-arrow { margin-left: auto; }
@media (hover: hover) and (pointer: fine) {
  .collection-frame .post-card:hover { border-color: color-mix(in srgb, var(--green) 30%, var(--border)); box-shadow: 0 8px 24px #253d2d08; }
  .collection-frame .list-layout .post-card:hover { box-shadow: none; }
  .read-arrow:hover { background: var(--green-light); }
}
@media (max-width: 600px) {
  .collection-frame .post-card .card-body { padding: 20px; }
  .collection-frame .post-card .card-body h3 { font-size: 19px; }
  .collection-frame .post-card .card-footer { gap: 9px; font-size: 10px; }
  .collection-frame .list-layout .post-card { gap: 18px; padding: 24px 0; align-items: flex-start; }
  .collection-frame .list-layout .post-card .card-cover-link { flex: 0 0 104px; width: 104px; margin-top: 4px; }
  .collection-frame .list-layout .post-card .card-cover-link :deep(.post-cover) { aspect-ratio: 1; }
  .collection-frame .list-layout .post-card .card-body h3 { font-size: 17px; line-height: 1.65; margin-top: 9px; }
  .collection-frame .list-layout .post-card .card-body > p { font-size: 12px; margin-top: 8px; }
  .collection-frame .list-layout .post-card .card-footer { margin-top: 14px; gap: 8px; }
  .collection-frame .list-layout .post-card .card-metrics { gap: 9px; }
  .collection-frame .list-layout .post-card .card-reading-time { display: none; }
  .card-author { max-width: 72px; }
}
</style>
