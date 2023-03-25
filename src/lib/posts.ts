import fs from 'fs';
import { marked } from 'marked';

const POSTS_PER_PAGE = 10;

export interface PostData {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
}

export async function getPosts() {
  const posts = [];

  // Get a list of year subfolders
 fs.readdir('../../posts', { withFileTypes: true }, (err, yearFolder) => {
  if (err)
    console.log(err);
  else {
    fs.
  }
 }
 
 
 );
  for (const year of years) {
    if (year.isDirectory()) {
      // Get a list of post files in the year subfolder
      const postFiles = await fs.readdir(`src/routes/blog/${year.name}`, {
        withFileTypes: true,
      });
      for (const file of postFiles) {
        if (file.isFile() && file.name.endsWith('.md')) {
          // Get the post data
          const post = await getPostData(year.name, file.name);
          posts.push(post);
        }
      }
    }
  }

  // Sort posts by date in descending order
  posts.sort((a, b) => b.date - a.date);

  return posts;
}

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