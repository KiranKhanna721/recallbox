/** Ask AI — grounded Q&A over the caller's notes with clickable citations. */

import { Fragment, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, BookOpen, FileSearch, RotateCcw, Sparkles } from 'lucide-react'
import { askNotes } from '../../../lib/actions-client'
import type { AskResult } from '../../../actions'
import { useNotes } from '../../../lib/notes'
import { AskInput } from '../../../components/AskInput'
import { DemoNotesButton } from '../../../components/DemoNotesButton'
import { PageContainer } from '../../../components/PageContainer'

const SUGGESTIONS = [
  'What is retrieval-augmented generation?',
  'How do vector databases work?',
  'What are the best practices for API authentication?',
  'How are Cloudflare Workers different from traditional servers?',
]

type Exchange =
  | { id: number; question: string; status: 'loading' }
  | { id: number; question: string; status: 'done'; result: AskResult }
  | { id: number; question: string; status: 'error'; error: string }

export default function AskPage() {
  const [params, setParams] = useSearchParams()
  const { records, status: notesStatus } = useNotes()
  const [question, setQuestion] = useState('')
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const nextId = useRef(1)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const handledQ = useRef(false)
  const busy = exchanges.some((e) => e.status === 'loading')

  const ask = async (q: string, replaceId?: number) => {
    if (busy) return
    const id = replaceId ?? nextId.current++
    setExchanges((xs) =>
      replaceId ? xs.map((x) => (x.id === id ? { id, question: q, status: 'loading' } : x)) : [...xs, { id, question: q, status: 'loading' }],
    )
    setQuestion('')
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const result = await askNotes(q, ctrl.signal)
      setExchanges((xs) => xs.map((x) => (x.id === id ? { id, question: q, status: 'done', result } : x)))
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setExchanges((xs) => xs.map((x) => (x.id === id ? { id, question: q, status: 'error', error: (e as Error).message } : x)))
    }
  }

  // Questions handed over from the dashboard via ?q=
  useEffect(() => {
    const q = params.get('q')
    if (q && !handledQ.current) {
      handledQ.current = true
      setParams({}, { replace: true })
      void ask(q.slice(0, 500))
    }
  }, [])

  useEffect(() => () => {
    abortRef.current?.abort()
  }, [])
  useEffect(() => {
    if (exchanges.length) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [exchanges])

  const noNotes = notesStatus === 'ready' && records.length === 0

  return (
    <PageContainer className="max-w-3xl">
      <title>Ask AI · RecallBox</title>
      <header className="mb-6">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
          <Sparkles className="h-3 w-3" aria-hidden /> Grounded in your notes
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Ask your knowledge</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          RecallBox finds the most relevant passages in your notes and answers with citations you can open.
        </p>
      </header>

      {noNotes && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">You have no notes yet, so there's nothing to answer from.</p>
          <DemoNotesButton />
        </div>
      )}

      {exchanges.length === 0 && (
        <section aria-label="Suggested questions" className="mb-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Try asking</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => void ask(s)}
                disabled={busy}
                className="rounded-xl border border-border bg-card/60 px-4 py-3 text-left text-sm text-foreground/90 transition hover:border-primary/40 hover:bg-accent/50 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-6">
        {exchanges.map((x) => (
          <article key={x.id} className="space-y-3">
            <div className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary/20 px-4 py-2.5 text-sm text-foreground">{x.question}</p>
            </div>
            {x.status === 'loading' ? (
              <LoadingAnswer />
            ) : x.status === 'error' ? (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm" role="alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                <div className="flex-1">
                  <p className="text-foreground">{x.error}</p>
                  <button
                    onClick={() => void ask(x.question, x.id)}
                    disabled={busy}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden /> Retry
                  </button>
                </div>
              </div>
            ) : (
              <AnswerCard result={x.result} />
            )}
          </article>
        ))}
      </div>

      <div ref={bottomRef} className="sticky bottom-0 mt-8 bg-gradient-to-t from-background via-background/95 to-transparent pb-2 pt-6">
        <AskInput value={question} onChange={setQuestion} onSubmit={(q) => void ask(q)} loading={busy} size="lg" autoFocus />
      </div>
    </PageContainer>
  )
}

function LoadingAnswer() {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5" aria-busy="true" aria-live="polite">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <FileSearch className="h-4 w-4 animate-pulse text-primary" aria-hidden /> Searching your notes and writing an answer…
      </div>
      <div className="space-y-2">
        <div className="h-3 w-11/12 animate-pulse rounded bg-muted" />
        <div className="h-3 w-10/12 animate-pulse rounded bg-muted" />
        <div className="h-3 w-7/12 animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}

function AnswerCard({ result }: { result: AskResult }) {
  if (!result.sufficient) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5">
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
        <div>
          <p className="text-sm text-foreground">{result.answer}</p>
          <p className="mt-1 text-xs text-muted-foreground">Try rephrasing with terms from your notes, or add a note that covers this topic.</p>
        </div>
      </div>
    )
  }
  const byLabel = new Map(result.citations.map((c) => [c.label, c]))
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden /> Answer
      </div>
      <div className="space-y-2 text-[15px] leading-7 text-foreground/95">
        {result.answer.split(/\n+/).map((line, i) => (
          <p key={i} className={line.trim().startsWith('- ') ? 'pl-4 -indent-3' : undefined}>
            {renderWithCitations(line.trim().startsWith('- ') ? `• ${line.trim().slice(2)}` : line, byLabel)}
          </p>
        ))}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Sources</p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {result.citations.map((c) => (
            <li key={c.label}>
              <Link
                to={`/notes?id=${encodeURIComponent(c.noteId)}`}
                data-testid="citation-card"
                className="group block h-full rounded-xl border border-border bg-background/40 p-3 transition hover:border-primary/50 hover:bg-accent/40"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-primary/20 px-1.5 py-0.5 text-[11px] font-semibold text-primary">{c.label}</span>
                  <span className="line-clamp-1 text-sm font-medium text-foreground group-hover:text-primary">{c.title}</span>
                </div>
                <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{c.excerpt}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Replace inline [S#] markers with links to the cited note. Unknown labels were already stripped server-side. */
function renderWithCitations(text: string, byLabel: Map<string, AskResult['citations'][number]>) {
  const parts = text.split(/(\[S\d+\])/g)
  return parts.map((part, i) => {
    const m = /^\[(S\d+)\]$/.exec(part)
    const c = m ? byLabel.get(m[1]) : undefined
    if (!c) return <Fragment key={i}>{part}</Fragment>
    return (
      <Link
        key={i}
        to={`/notes?id=${encodeURIComponent(c.noteId)}`}
        title={c.title}
        className="mx-0.5 inline-flex -translate-y-px items-center rounded-md bg-primary/20 px-1.5 text-[11px] font-semibold leading-5 text-primary no-underline transition hover:bg-primary hover:text-white"
      >
        {c.label}
      </Link>
    )
  })
}
