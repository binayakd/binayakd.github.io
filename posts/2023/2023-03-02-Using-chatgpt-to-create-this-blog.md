---
title: I Used Chatgpt to Create This Blog
date: 2023-03-01
---

# I Used Chatgpt to Create This Blog

## Or How I Learnt to Stop Worrying and Milk The AI Hype

I have wanted to create a proper tech blog for a long time. I have also wanted to learn some Javascript/Typescript and some type of frontend framework for a long time. After a few false starts with ReactJs and NextJs, I heard about the shiny new thing called Svelt and Sveltkit. And then this Chatgpt stuff got hot, so I though why not take advantage of it.

So I asked Chatgpt, "How do I create a blog with Sveltkit with Typescript?"

The reply was pretty helpful up to a point. It was in the standard point form, telling me how to install Sveltkit with NPM, and how to setup the folder sructure, and how to set up the api call to a database (it was tkinking the posts come from a data base).

All was well and good, until I noticed something off. Points 4 and 5 was this:

> 4. Define your blog routes: In SvelteKit, you define your routes in the src/routes folder. For a blog, you may want to create routes for the home page, individual blog posts, and an archive page. Here's an example of how to define these routes in TypeScript: 
>```typescript
>// src/routes/index.svelte.ts
><script lang="ts">
>// ...
></script>
>
>// src/routes/[slug].svelte.ts
><script lang="ts">
>// ...
></script>
>
>// src/routes/archive.svelte.ts
><script lang="ts">
>// ...
></script>
>```
>5. Implement your blog pages: Once you've defined your routes, you can implement your blog pages in Svelte components. For example, you may create a BlogPost component to render an individual blog post. Here's an example of how to implement a BlogPost component in TypeScript:
>```typescript
>// src/routes/[slug].svelte
><script lang="ts">
>import type { RouteComponent } from "@sveltejs/kit";
>import { getBlogPost } from "./_api";
>
>export let page: { params: { slug: string } };
>
>const BlogPost: RouteComponent = {
>  async load({ params }) {
>    const post = await getBlogPost(params.slug);
>    return { props: { post } };
>  },
>
>  async update({ changed, page }) {
>    if (changed.params) {
>      const post = await getBlogPost(page.params.slug);
>      return { props: { post } };
>    }
>  },
>};
></script>
>
><main>
>  <!-- render blog post content here -->
></main>
>```

For those who have not spotted the problem yet, here it is: 
- In point 4, the filename is `src/routes/[slug].svelte.ts`
- In point 5, the filename is `src/routes/[slug].svelte`

So was there suppose to be 2 diffrent files, one with `.ts` and another without? So that was my next question:

