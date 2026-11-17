<script setup>
import { RouterLink } from 'vue-router'
import Icon from '../components/AppIcon.vue'
</script>
<template><div class="about-page"><div class="eyebrow">A SMALL CORNER OF THE INTERNET</div><h1>你好，这里是<span class="serif-emphasis">拾光。</span><Icon name="leaf" :size="42" /></h1><p class="about-lead">生活里，总有一些细小的瞬间，<br>值得停一停，写下来。</p><div class="about-divider"></div><div class="prose"><h2>关于这个小站</h2><p>拾光，是一个收藏文字与想法的地方。这里有技术实践中的发现，有平凡日常里的感动，也有读完一本书之后，迟迟没有散去的回响。</p><p>不追赶热点，也不急于给出答案。只希望在快节奏的日子里，留下一点认真思考的痕迹。</p><blockquote>保持好奇，保持真诚。慢慢记录，慢慢生长。</blockquote><h2>在这里，你可以找到</h2><div class="about-topics"><div><Icon name="code" /><h3>技术手记</h3><p>实践、探索，以及解决问题的过程。</p></div><div><Icon name="coffee" /><h3>生活随笔</h3><p>日常的切片，平凡的微光。</p></div><div><Icon name="book" /><h3>阅读思考</h3><p>从别人的文字，走向自己的答案。</p></div></div><h2>很高兴，与你相遇。</h2><p>如果某一段文字恰好触动了你，欢迎留下你的想法。因为交流，记录有了更多意义。</p></div><RouterLink to="/" class="button primary">去读一篇文章 <Icon name="arrow" :size="17" /></RouterLink></div></template>
