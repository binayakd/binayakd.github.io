<script lang='ts'>
  import type { PageData } from './$types';
  export let data: PageData;
</script>


<div>
  <h2>Posts</h2>
  {#each data.posts  as postData}
  <a href="/posts/{postData.slug}">
    <h3>{postData.title}</h3>
    <p>{postData.date}</p>
  </a>
  {/each}
</div>
