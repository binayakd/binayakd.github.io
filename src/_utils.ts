import fs from 'fs';
import path from 'path';
import markdownIt from 'markdown-it';
import { loadFront } from 'yaml-front-matter';

export async function getBlogPost(slug: string) {
  const markdown = fs.readFileSync(path.join('posts', `${slug}.md`), 'utf-8');
  const { __content, ...frontmatter } = loadFront(markdown);
  const md = new markdownIt();
  const html = md.render(__content);
  return { html, frontmatter };
}