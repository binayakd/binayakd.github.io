import fs from 'fs';
import path from 'path';
import glob from 'glob';



const POSTS_DIR_PATH = "../../posts"
const POSTS_PER_PAGE = 10;

export interface PostData {
  slug: string;
  title: string;
  date: string;
  content: string;
}

export async function getPostDataBySlug(slug: string){
  const year = slug.split("-")[0]
  const post = await import(`${POSTS_DIR_PATH}/${year}/${slug}.md`)
  const { title, date } = post.metadata
  const content = post.default

  const postData: PostData = {
    slug: slug,
    title: title,
    date: date,
    content: content
  }

  return postData

}

export async function getAllPostSlugs() {
  // const results = await glob(`${POSTS_DIR_PATH}/**/*.md`)
  const results = await glob("posts/**/*.md")
  const slugList = results.map(x => path.parse(x).base)
  return slugList
}

