<script>
    import { readdirSync, readFileSync } from 'fs';
    import matter from 'gray-matter';
    import markdownIt from 'markdown-it';
    import { slugify } from '../lib/utils.js';
  
    const md = markdownIt();
  
    // Read the list of blog post filenames
    const yearFolders = readdirSync('src/posts', { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  
    const postFilenames = yearFolders.flatMap((yearFolder) => {
      return readdirSync(`src/posts/${yearFolder}`, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
        .map((entry) => `${yearFolder}/${entry.name}`);
    });
  
    // Find the filename that matches the slug in the URL
    const postFilename = postFilenames.find((filename) => {
      const slug = slugify(filename.replace(/\.md$/, ''));
      return slug === $params.slug;
    });
  
    // Read the contents of the blog post file
    const postContent = readFileSync(`src/posts/${postFilename}`, 'utf-8');
    const { data, content } = matter(postContent);
  
    // Render the Markdown content as HTML
    const htmlContent = md.render(content);
  </script>