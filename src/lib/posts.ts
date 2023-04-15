import fs from 'fs';

const POSTS_PER_PAGE = 10;

export interface PostData {
  slug: string;
  title: string;
  date: string;
  content: string;
}

export async function getPostDataBySlug(slug: string, withContent: boolean){
  const year = slug.split("-")[0]
  const post = await import(/* @vite-ignore */`../../posts/${year}/${slug}.md`)
  const { title, date } = post.metadata
  var content =  null
  if (withContent){
    content = post.default
  }
  

  const postData: PostData = {
    slug: slug,
    title: title,
    date: date,
    content: content
  }

  return postData

}

export function getAllPostSlugs() {
  const allSlugs: string[] = []

  const yearPaths = fs.readdirSync("./posts")
  yearPaths.forEach(year => {
    const postPaths = fs.readdirSync(`./posts/${year}`)
    postPaths.forEach(postPath => {
      allSlugs.push(postPath.split(".")[0])
    })
  });
  
  return allSlugs

}
