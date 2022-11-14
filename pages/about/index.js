import Layout, { githubLink, linkedInLink, cvLink } from '../../components/layout'
import utilStyles from '../../styles/utils.module.css'
// import { getSortedPostsData } from '../../lib/posts'
// import Link from 'next/link'
// import Date from '../../components/date'

export default function Home() {
  return (
    <Layout page="About" backLink="/">
      <section>
        <h1 className={utilStyles.headingXl}>Hi! I'm Binayak.</h1>
        I'm a software/data/devops engineer. <br/>
        This is where I show off and ramble. <br/>
        This site is still very much a work in progress, so stay tuned to see how it all changes.
      </section>
    </Layout>
  );
}