import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import hljs from "highlight.js";
import DOMPurify from 'dompurify';


const POSTS_DIR_PATH = "../../posts"
const POSTS_PER_PAGE = 10;

export interface PostData {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
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
    excerpt: content.split('\n')[0],
    content: content
  }

  return postData

}

export function getPosts(dir: string): PostData[] {
  const files = fs.readdirSync(dir);
  const postsDataList: PostData[] = [];

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const fileStat = fs.statSync(filePath);

    if (fileStat.isDirectory()) {
      const subfolderPostsData = getPosts(filePath);
      postsDataList.push(...subfolderPostsData);
    }

    if (path.extname(filePath) === '.md') {
      const slug = path.basename(filePath).split(".")[0]
      const postData = getPostBySlug(slug)
      postsDataList.push(postData)
    }
  });

  return postsDataList;
}

export const getPostBySlug = (slug: string): PostData =>{

  console.log(`Getting slug: ${slug}`)
  const year = slug.split("-")[0]
  const filePath = `posts/${year}/${slug}.md`
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(fileContents);

  const postData: PostData = {
    slug: slug,
    title: data.title,
    date: data.date,
    excerpt: content.split('\n')[0],
    content: content

  }

  return postData
};

export const parseMarkdown = (text: string): string => {
  marked.setOptions({
    renderer: new marked.Renderer(),
    highlight: function (code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
    langPrefix: 'hljs language-', // highlight.js css expects a top-level 'hljs' class.
    pedantic: false,
    gfm: true,
    breaks: false,
    sanitize: false,
    smartypants: false,
    xhtml: false
  });

  return DOMPurify.sanitize(marked.parse(text));
};
