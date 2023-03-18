---
title: I Used Chatgpt to Create This Blog
date: 2023-03-01
---

# I Used Chatgpt to Create This Blog

## Or How I Learnt to Stop Worrying and Milk The AI Hype

I have wanted to create a proper tech blog for a long time. I have also wanted to learn some Javascript/Typescript and some type of frontend framework for a long time. After a few false starts with ReactJs and NextJs, I heard about the shiny new thing called Svelt and Sveltkit. And then this Chatgpt stuff got hot, so I though why not take advantage of it.

So I asked Chatgpt, "How do I create a blog with Sveltkit with Typescript?"

The reply was pretty helpful up to a point. It was in the standard point form, telling me how to install Sveltkit with NPM, and how to setup the folder structure, and how to set up the api call to a database (it was thinking the posts come from a data base).

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

>Should it be `src/routes/[slug].svelte.ts` or `src/routes/[slug].svelte`, or are they 2 >different files?

Chatgpt's reply:
>Both `src/routes/[slug].svelte.ts `and `src/routes/[slug].svelte` refer to the same file.
>
>The `.ts` extension indicates that the file contains TypeScript code, while the file without an extension indicates that it contains Svelte code with JavaScript syntax.
>
>In SvelteKit, you can use either file extension for your Svelte components. If you prefer to use TypeScript, you can use the `.ts` extension and write your code in TypeScript. If you prefer to use JavaScript, you can use the file without an extension and write your code in JavaScript.
>
>However, if you want to use TypeScript in your Svelte components, you need to use the `.ts` extension and make sure that your SvelteKit project is set up to support TypeScript.

The last sentence kind of threw me off. So I went to the [official SveltKit docs](https://kit.svelte.dev/docs/introduction), specifically the one about [routing](https://kit.svelte.dev/docs/routing), found the JavaScript/TypeScript toggle at the bottom, and noticed that none of the Svelt file change extensions. 

Another thing that I noticed while reading the docs, that the "main" page is [`+page.svelte`](https://kit.svelte.dev/docs/routing#page), while ChatGPT was telling me that it should be `index.svelte.ts`? 

I then asked about how to do layouts in Sveltkit. ChatGPT gave a pretty good rundown on how to create a `_layout.svelte` file to define the main layout with the `<slot></slot>` setup, add a nav bar to it, and then import this to all the other files and using it together with `<svelte:component this={Layout}>` blocks. I did copy it over, and it all worked too. But then having read the docs, I saw that the in there it talked about the [`+layout.svelte`](https://kit.svelte.dev/docs/routing#layout) file, which then gets automatically setup as layout for all pages, without needing to import it.

With all this conflicting information, I googled the difference between `+page.svelte` and `index.svelte.ts`, and found a [reddit post](https://www.reddit.com/r/sveltejs/comments/wytxl2/why_did_sveltekit_adopt_the_pagesvelte_routing/) and huge [github issue](https://github.com/sveltejs/kit/discussions/5748), that seem to suggest there was a bit update for Sveltkit v1.0.

Bottom line, ChatGPT seems to have outdated data. Which makes sense its side to only been trained on data until 2021, and does not have access to Internet.