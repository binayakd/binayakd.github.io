import Layout, { githubLink, linkedInLink, cvLink } from '../components/layout'
import utilStyles from '../styles/utils.module.css'
import { getSortedPostsData } from '../lib/posts'
import Link from 'next/link'

export default function Home({ allPostsData }) {
  return (
    <Layout home='true'>
      <section className={`${utilStyles.headingMd} ${utilStyles.center}`}>
        <p>
          Hi, I'm Binayak. <br/>
          I'm a developer and devops engineer. <br/>
          This is where I show off and ramble. 
        </p>
      </section>
      <section className={`${utilStyles.headingLg} ${utilStyles.center}`}>
        <Link href="/blog">Blog</Link> <br/>
        <a href={cvLink} target="_blank" rel='noopener noreferrer'>CV</a><br/>
        <a href={githubLink} target="_blank">Github</a><br/>
        <a href={linkedInLink} target="_blank">Linkedin</a> 
        <br/>
        <br/>
      </section>
    </Layout>
  );
}

export async function getStaticProps() {
  const allPostsData = getSortedPostsData()
  return {
    props: {
      allPostsData
    }
  }
}