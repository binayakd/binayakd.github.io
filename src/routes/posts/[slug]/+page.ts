import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { getPostBySlug } from '$lib/posts';

 
// export const load = (({ params }) => {

//   const postData = getPostBySlug(params.slug)

//   return {
//     title: postData.title,
//     date: postData.date,
//     content: postData.content
//   };
//   throw error(404, 'Not found');
// }) satisfies PageLoad;


// export async function load({ params }){
//   const year = params.slug.split("-")[0]
//   const post = await import(`../../../../posts/${year}/${params.slug}.md`)
//   const { title, date } = post.metadata
//   const content = post.default

//   return {
//     content,
//     title,
//     date,
//   }
// }

export async function load({ params }){
  const postData = getPostBySlug(params.slug)

  return {
    title: postData.title,
    date: postData.date,
    content: postData.content
  };

}