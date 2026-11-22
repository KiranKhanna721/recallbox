/**
 * Landing page — STATIC (top level of src/pages/): no auth fetch, no
 * WebSocket, prerendered at build. The app itself lives under /home.
 */

import { Link } from 'react-router-dom'
import { ArrowRight, BookMarked, Quote, Search, ShieldCheck } from 'lucide-react'
import { Seo } from '../components/Seo'
import { Logo } from '../components/Logo'
import { seo } from '../seo'

const FEATURES = [
  { icon: BookMarked, title: 'Capture', body: 'Save docs, snippets and lessons as notes that sync instantly across your devices.' },
  { icon: Search, title: 'Retrieve', body: 'Search by title and content, or ask a question and let RecallBox find the right passages.' },
  { icon: Quote, title: 'Cite', body: 'Every AI answer links back to the notes it came from — no source, no answer.' },
  { icon: ShieldCheck, title: 'Private', body: 'Your notes are visible only to you, enforced on the server for every read and write.' },
]

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="app-bg min-h-screen">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <Logo />
          <Link to="/home" className="text-sm text-muted-foreground transition hover:text-foreground">
            Sign in
          </Link>
        </header>

        <main className="mx-auto max-w-6xl px-6 pb-24 pt-12 sm:pt-20">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
              Your second brain, powered by AI
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
              Remember everything you learn.{' '}
              <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                Ask it anything.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              RecallBox keeps your technical notes in one place and answers questions about them with grounded,
              cited responses — so you can trust where every answer came from.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/home"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-5 text-sm font-medium text-white shadow-[0_8px_30px_-10px_rgba(124,108,246,0.9)] transition hover:brightness-110"
              >
                Open RecallBox <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>

          <ul className="mt-20 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-2xl border border-border bg-card/60 p-5">
                <Icon className="h-5 w-5 text-primary" aria-hidden />
                <h2 className="mt-3 text-sm font-semibold text-foreground">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </main>

        <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
          Built on DeepSpace · Cloudflare Workers
        </footer>
      </div>
    </>
  )
}
