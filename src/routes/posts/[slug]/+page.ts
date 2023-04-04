import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { getPostDataBySlug } from '$lib/posts';

 
export async function load({ params }){
  const postData = await getPostDataBySlug(params.slug)

  return {
    title: postData.title,
    date: postData.date,
    content: postData.content
  };

}