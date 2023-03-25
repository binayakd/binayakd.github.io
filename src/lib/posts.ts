import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

const POSTS_PER_PAGE = 10;

export interface PostData {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  content: string;
}

export function getPosts(dir: string): PostData[] {
  const files = fs.readdirSync(dir);
  const postsData: PostData[] = [];

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const fileStat = fs.statSync(filePath);

    if (fileStat.isDirectory()) {
      const subfolderPostsData = getPosts(filePath);
      postsData.push(...subfolderPostsData);
      return;
    }

    if (path.extname(filePath) === '.md') {
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const { data, content } = matter(fileContents);

      postsData.push({
        content,
        slug: filePath,
        title: data.title,
        date: data.date,
        excerpt: content.split('\n')[0]
      });
    }
  });

  return postsData;
}
// export const parseMarkdown = (text: string): string => {
//   marked.setOptions({
//     renderer: new marked.Renderer(),
//     highlight: function (code, lang) {
//       const language = hljs.getLanguage(lang) ? lang : 'plaintext';
//       return hljs.highlight(code, { language }).value;
//     },
//     langPrefix: 'hljs language-', // highlight.js css expects a top-level 'hljs' class.
//     pedantic: false,
//     gfm: true,
//     breaks: false,
//     sanitize: false,
//     smartypants: false,
//     xhtml: false
//   });

//   return DOMPurify.sanitize(marked.parse(text));
// };