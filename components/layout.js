import Head from 'next/head'
import Image from 'next/image'
import styles from './layout.module.css'
import utilStyles from '../styles/utils.module.css'
import Link from 'next/link'
import { faGithub, faLinkedin } from "@fortawesome/free-brands-svg-icons"
import { config } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import '@fortawesome/fontawesome-svg-core/styles.css';

config.autoAddCss = false

export const githubLink = "https://github.com/binayakd"
export const linkedInLink = "https://www.linkedin.com/in/dasguptabinayak/"
export const cvLink = "https://docs.google.com/document/d/175dF-LICW2gAak0Hg1HZckOzKBtXOPUcbEbvFwvdvi4/export?format=pdf"
export const siteTitle = 'Binayak Dasgupta'

const displayHeader = '{{ .BinayakD. }}'
const d = new Date();

export default function Layout(props) {
  return (
    <div className={styles.container}>
      <Head>
        <link rel="icon" href="/favicon.ico" />
        <meta
          name="description"
          content="Binayak Dasgupta's Rambles"
        />
        <meta name="og:title" content={siteTitle} />
        <title>{siteTitle}</title>
      </Head>
      <header>
        {props.home ? (
          <>
          <header className={styles.header}>
            <Image
              priority
              src="/images/bean.png"
              className={utilStyles.borderCircle}
              height={144}
              width={144}
              alt={siteTitle}
            />
            <h1 className={utilStyles.heading2Xl}>{displayHeader}</h1>
          </header>
          </>
        ) : (
          <>
          <header className={styles.headerLeft}>
            <h2>
              <Link href="/" className={utilStyles.heading2Xl}>
                {displayHeader}
              </Link>
              <div className={styles.topnavRight}>
                <a href={githubLink} target="_blank"><FontAwesomeIcon icon={faGithub} /></a>
                <span>&nbsp;&nbsp;</span>
                <a href={linkedInLink} target="_blank"><FontAwesomeIcon icon={faLinkedin} /></a> {" "}
              </div>
              
            </h2>
          </header>
          </>
        )}
      </header>
      <hr color="#3c3c3c" />
      <main>{props.children}</main>
      {!props.home && (
        <div className={styles.backToHome}>
          <Link href={props.backLink}>
            ← Back
          </Link>
        </div>
      )}
      <hr color="#3c3c3c" />
      <section className={utilStyles.center}>
        <small className={utilStyles.lightText}>
          &copy; {d.getFullYear()}
        </small>
      </section>
    </div>
  );
}