import Layout from '../components/layout'
import { getAllPostIds, getPostData } from '../lib/posts'
import Date from '../components/date'
import utilStyles from '../styles/utils.module.css'

import ReactMarkdown from 'react-markdown'
import CodeBlock from '../components/codeblock'


export default function Post({ postData }) {
  return (
    <Layout page="Blog" backLink="/">
      <article>
        <h1 className={utilStyles.headingXl}>{postData.title}</h1>
        <div className={utilStyles.lightText}>
          <Date dateString={postData.date} />
        </div>
        <ReactMarkdown components={CodeBlock} >
          {postData.contentHtml}
        </ReactMarkdown>
      </article>
      
    </Layout>
  )
}

export async function getStaticPaths() {
  const paths = getAllPostIds()
  return {
    paths,
    fallback: false
  }
}

export async function getStaticProps({ params }) {
  const postData = await getPostData(params.id)
  return {
    props: {
      postData
    }
  }
}