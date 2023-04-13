import { getPostDataBySlug } from '$lib/posts';


export async function load({ params }){
  const postData = await getPostDataBySlug(params.slug)
  return postData
}
