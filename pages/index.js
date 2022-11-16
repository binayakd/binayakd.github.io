import Layout, { githubLink, linkedInLink, cvLink } from '../components/layout'
import utilStyles from '../styles/utils.module.css'
import { getSortedPostsData } from '../lib/posts'
import Link from 'next/link'

export default function Home({ allPostsData }) {
  return (
    <Layout home='true' page="Blog" backLink="/">
      <section className={utilStyles.padding1px}>
        {/* <p className={utilStyles.headingXl}>Blog Posts</p> */}
        <ul className={utilStyles.list}>
          {allPostsData.map(({ id, date, title, summary }) => (
            (<Link href={`/${id}`} className="plain" key={id}>

              <li className={utilStyles.listItem} >
                <span className={utilStyles.headingLg}>{title}</span>
                <br />
                <small className={utilStyles.lightText}>
                  {new Date(date).toDateString()}
                </small>
                <br />
                {summary}
              </li>

            </Link>)
          ))}
        </ul>
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