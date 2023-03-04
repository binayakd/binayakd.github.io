<script lang="ts">
  import type { PageData } from './$types';
  import Layout from '../../__layout.svelte';

  export let data: PageData;
</script>

<svelte:component this={Layout}>
  <h1>{data.title}</h1>
  <div>{@html data.content}</div>
</svelte:component>
