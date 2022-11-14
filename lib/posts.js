import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

export const postsDirectory = path.join(process.cwd(), 'posts')

export function getSortedPostsData() {
  // Get file names under /posts
  //const fileNames = fs.readdirSync(postsDirectory)
  const fileNames = throughDirectory(postsDirectory)
  const allPostsData = fileNames.map(fileName => {
    // Remove ".md" from file name to get id
    const id = fileName.replace(/\.md$/, '')

    // Read markdown file as string
    const fullPath = path.join(postsDirectory, fileName)
    const fileContents = fs.readFileSync(fullPath, 'utf8')

    // Use gray-matter to parse the post metadata section
    const matterResult = matter(fileContents)
    const contentHtml = matterResult.content
    //const summary = contentHtml.split(".")[0] + " ..."
    const summary = contentHtml.substring(0,100) + "..."

    // Combine the data with the id
    return {
      id: id,
      summary: summary,
      // title: matterResult.data.title,
      // date: new Date(matterResult.data.date).toDateString()
      ...matterResult.data
    }
  })
  // Sort posts by date
  return allPostsData.sort((a, b) => {
    if (a.date < b.date) {
      return 1
    } else {
      return -1
    }
  })
}

export function getAllPostIds() {
  //const fileNames = fs.readdirSync(postsDirectory)
  const fileNames = throughDirectory(postsDirectory)

  // Returns an array that looks like this:
  // [
  //   {
  //     params: {
  //       id: 'ssg-ssr'
  //     }
  //   },
  //   {
  //     params: {
  //       id: 'pre-rendering'
  //     }
  //   }
  // ]
  return fileNames.map(fileName => {
    return {
      params: {
        id: fileName.replace(/\.md$/, '').split("/")
      }
    };
  });
}

export async function getPostData(id) {
  const fullPath = path.join(postsDirectory, `${id.join("/")}.md`)
  const fileContents = fs.readFileSync(fullPath, 'utf8')

  // use gray-matter to parse the post metadata section
  const matterResult = matter(fileContents)

  // Use remark to convert markdown into HTML string
  // const processedContent = await remark()
  //   .use(html)
  //   .process(matterResult.content)
  // const contentHtml = processedContent.toString()

  const contentHtml = matterResult.content

  // Combine the data with the id
  return {
    id,
    contentHtml,
    ...matterResult.data
  }
}

export function throughDirectory(dir, fileList = []) {
  fs.readdirSync(dir).forEach(file => {
    const absolute = path.join(dir, file);
    if (fs.statSync(absolute).isDirectory()) return throughDirectory(absolute, fileList);
    else return fileList.push(path.relative(postsDirectory, absolute));
  });
  return fileList
}