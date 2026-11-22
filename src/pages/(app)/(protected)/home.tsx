/** Dashboard — welcome, ask box, stats, recent notes, demo seeding. */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthProfileReady } from 'deepspace'
import { ArrowRight, Clock, FileText, Library, Plus, Sparkles } from 'lucide-react'
import { useNotes } from '../../../lib/notes'
import { preview, timeAgo } from '../../../lib/format'
import { AskInput } from '../../../components/AskInput'
import { DemoNotesButton } from '../../../components/DemoNotesButton'
import { PageContainer } from '../../../components/PageContainer'

export default function DashboardPage() {
  const { user } = useAuthProfileReady({ requireUser: true })
  const { records, status } = useNotes()
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const firstName = (user?.name || '').split(' ')[0]
  const recent = records.slice(0, 6)
  const loading = status === 'loading'

  return (
    <PageContainer>
      <title>Dashboard · RecallBox</title>
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">Your second brain</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        </h1>
      </header>

      <section className="relative overflow-hidden rounded-2xl border border-border bg-card/70 p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="relative">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden /> Ask your knowledge
          </div>
          <AskInput
            value={question}
            onChange={setQuestion}
            onSubmit={(q) => navigate(`/ask?q=${encodeURIComponent(q)}`)}
            placeholder="e.g. What is retrieval-augmented generation?"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Answers are generated only from your saved notes, with citations.
          </p>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={<Library className="h-4 w-4" />} label="Total notes" value={loading ? '—' : String(records.length)} />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Last edited"
          value={loading ? '—' : records[0] ? timeAgo(records[0].updatedAt) : 'Never'}
        />
        <Link
          to="/notes?new=1"
          className="group flex items-center justify-between rounded-2xl border border-border bg-card/70 p-5 transition hover:border-primary/40 hover:bg-accent/40"
        >
          <div>
            <div className="text-xs text-muted-foreground">Quick create</div>
            <div className="mt-1 text-base font-medium text-foreground">New note</div>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary transition group-hover:bg-primary group-hover:text-white">
            <Plus className="h-5 w-5" aria-hidden />
          </span>
        </Link>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recently edited</h2>
          {records.length > 0 && (
            <Link to="/notes" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              View all <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-card/50" />
            ))}
          </div>
        ) : status === 'error' ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Couldn't load your notes. Refresh the page to try again.
          </div>
        ) : recent.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <FileText className="h-6 w-6" aria-hidden />
            </div>
            <h3 className="text-base font-semibold text-foreground">Your knowledge base is empty</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Write your first note, or load five technical demo notes to try Ask AI right away.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link
                to="/notes?new=1"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" aria-hidden /> Write a note
              </Link>
              <DemoNotesButton />
            </div>
          </div>
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {recent.map((n) => (
                <li key={n.recordId}>
                  <Link
                    to={`/notes?id=${encodeURIComponent(n.recordId)}`}
                    className="block h-full rounded-xl border border-border bg-card/70 p-4 transition hover:border-primary/40 hover:bg-accent/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="line-clamp-1 text-sm font-medium text-foreground">{n.data.title || 'Untitled'}</h3>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(n.updatedAt)}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {preview(n.data.content) || 'No content yet'}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <DemoNotesButton variant="subtle" />
            </div>
          </>
        )}
      </section>
    </PageContainer>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-primary">{icon}</span> {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  )
}
