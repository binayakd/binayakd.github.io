<script lang='ts'>
  import { onMount } from 'svelte'
  import { createThreeDSphere  } from '../lib/sphere';

  let canvas: HTMLCanvasElement;

  onMount(() => {
    const { animate } = createThreeDSphere(canvas);
    animate()
  });
</script>


<div class="container">
  <div class="sphere-container">
    <canvas bind:this={canvas} />
  </div>
  <div class="intro-container">           
    <h1>The Art of Failing Forward</h1>
    <p>
      I'm Binayak Dasgupta, a software/data/devops engineer. Here is where I ramble and try new things.
    </p>  
  </div>
</div>

<style>
  .container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 300px;
  }

  .sphere-container {
    width: 300px;
    display: flex;
    justify-content: center;
  }

  .intro-container {
    width: 600px;
    padding: 0 50px;
  }
</style>