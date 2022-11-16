import Layout from '../../components/layout'
import utilStyles from '../../styles/utils.module.css'
import { getSortedPostsData } from '../../lib/posts'
import Link from 'next/link'
import Date from '../../components/date'

export default function Home({ allPostsData }) {
  return (
    <Layout page="Blog" backLink="/">
      <section className={utilStyles.padding1px}>
        <p className={utilStyles.headingXl}>Blog Posts</p>
        <ul className={utilStyles.list}>
          {allPostsData.map(({ id, date, title, summary }) => (
            (<Link href={`/blog/${id}`} className="plain" key={id}>

              <li className={utilStyles.listItem} >
                <span className={utilStyles.headingLg}>{title}</span>
                <br />
                <small className={utilStyles.lightText}>
                  <Date dateString={date} />
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