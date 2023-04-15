import { getPostDataBySlug, type PostData} from '$lib/posts';


export async function load({ params }){
  const postData: PostData = await getPostDataBySlug(params.slug, true)
  return postData
}
