import { getAllPostSlugs, getPostDataBySlug, getAllPostData, type PostData } from '$lib/posts';
import { json } from '@sveltejs/kit';

export const GET = async () => {
  // const allSlugs = getAllPostSlugs();

  // const postDataList: PostData[] = []
  // allSlugs.forEach(async slug => {
  //   const postData = await getPostDataBySlug(slug, false)
  //   console.log(`postData_title: ${postData.title}`)
  //   postDataList.push(postData)
  // });

  // console.log(`postDataList: ${postDataList}`)

  const allPostData = await getAllPostData()

  const sortedPosts = allPostData.sort((a, b) => {
    return new Date(b.date) - new Date(a.date)
  })

  return json(sortedPosts)
}