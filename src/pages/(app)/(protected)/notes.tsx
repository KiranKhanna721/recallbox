/**
 * Notes workspace — searchable list + editor.
 *
 * URL state: `?id=<recordId>` selects a note, `?new=1` creates one, `?q=`
 * keeps the search. Desktop shows list and editor side by side; mobile shows
 * one at a time with a back button.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { RecordData } from 'deepspace'
import { ArrowLeft, FileText, Plus, SearchX } from 'lucide-react'
import { useNoteMutations, useNotes, type NoteData } from '../../../lib/notes'
import { matchesSearch } from '../../../rag/retrieval'
import { preview, timeAgo } from '../../../lib/format'
import { SearchInput, useToast } from '../../../components/ui'
import { NoteEditor } from '../../../components/NoteEditor'
import { DemoNotesButton } from '../../../components/DemoNotesButton'
import { cn } from '../../../lib/utils'

type Note = RecordData<NoteData>

export default function NotesPage() {
  const [params, setParams] = useSearchParams()
  const { records, status } = useNotes()
  const { ready, createConfirmed } = useNoteMutations()
  const toast = useToast()
  const selectedId = params.get('id')
  const query = params.get('q') ?? ''
  const creating = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(
    () => records.filter((n) => matchesSearch({ title: n.data.title ?? '', content: n.data.content ?? '' }, query)),
    [records, query],
  )
  const selected = records.find((n) => n.recordId === selectedId) ?? null

  const update = (patch: Record<string, string | null>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) (v === null || v === '' ? next.delete(k) : next.set(k, v))
        return next
      },
      { replace: true },
    )
  }

  const createNote = async () => {
    if (creating.current) return
    creating.current = true
    try {
      const id = await createConfirmed({ title: 'Untitled note', content: '' } as NoteData)
      update({ id, new: null, q: null })
    } catch (e) {
      toast.error('Could not create note', (e as Error).message)
      update({ new: null })
    } finally {
      creating.current = false
    }
  }

  // `?new=1` (from the sidebar, dashboard, or Alt+N) creates once the room is writable.
  useEffect(() => {
    if (params.get('new') === '1' && ready) void createNote()
  }, [params, ready])

  // "/" focuses search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const missing = selectedId && status === 'ready' && !selected

  return (
    <div className="flex h-full min-h-0">
      <title>{selected ? `${selected.data.title || 'Untitled'} · RecallBox` : 'All Notes · RecallBox'}</title>

      {/* List pane */}
      <section
        className={cn(
          'flex min-h-0 w-full flex-col border-r border-border bg-shell-panel/40 md:w-80 lg:w-96 md:shrink-0',
          selectedId && 'hidden md:flex',
        )}
        aria-label="Notes list"
      >
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-foreground">All Notes</h1>
            <button
              onClick={createNote}
              disabled={!ready}
              aria-label="New note"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden /> New
            </button>
          </div>
          <SearchInput
            ref={searchRef}
            value={query}
            onChange={(e) => update({ q: e.target.value })}
            onClear={() => update({ q: null })}
            placeholder="Search titles and content…  ( / )"
            aria-label="Search notes"
          />
          {status === 'ready' && (
            <p className="text-xs text-muted-foreground">
              {query ? `${filtered.length} of ${records.length} notes match` : `${records.length} note${records.length === 1 ? '' : 's'}`}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {status === 'loading' ? (
            <div className="space-y-2 p-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[72px] animate-pulse rounded-lg bg-card/60" />
              ))}
            </div>
          ) : status === 'error' ? (
            <p className="p-4 text-sm text-destructive">Couldn't load notes. Refresh to try again.</p>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <FileText className="h-5 w-5" aria-hidden />
              </div>
              <p className="text-sm font-medium text-foreground">No notes yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Create one, or load the demo set.</p>
              <div className="mt-4">
                <DemoNotesButton />
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <SearchX className="mb-3 h-6 w-6 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium text-foreground">No matches for “{query}”</p>
              <button onClick={() => update({ q: null })} className="mt-2 text-xs text-primary hover:underline">
                Clear search
              </button>
            </div>
          ) : (
            <ul className="space-y-1">
              {filtered.map((n) => (
                <NoteListItem key={n.recordId} note={n} active={n.recordId === selectedId} onSelect={() => update({ id: n.recordId })} />
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Editor pane */}
      <section className={cn('min-h-0 min-w-0 flex-1', !selectedId && 'hidden md:block')} aria-label="Note editor">
        {selectedId && (
          <button
            onClick={() => update({ id: null })}
            className="flex h-11 items-center gap-2 px-4 text-sm text-muted-foreground hover:text-foreground md:hidden"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> All notes
          </button>
        )}
        {selected ? (
          <NoteEditor key={selected.recordId} note={selected} onDeleted={() => update({ id: null })} />
        ) : missing ? (
          <CenteredMessage title="Note not found" body="It may have been deleted, or it belongs to another account." />
        ) : selectedId ? (
          <div className="p-8">
            <div className="h-8 w-1/2 animate-pulse rounded bg-card/60" />
            <div className="mt-6 h-64 animate-pulse rounded bg-card/40" />
          </div>
        ) : (
          <CenteredMessage title="Select a note" body="Pick a note from the list, or create a new one with Alt+N." />
        )}
      </section>
    </div>
  )
}

function NoteListItem({ note, active, onSelect }: { note: Note; active: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'w-full rounded-lg px-3 py-2.5 text-left transition-colors',
          active ? 'bg-accent shadow-[inset_0_0_0_1px_rgba(139,124,248,0.3)]' : 'hover:bg-accent/50',
        )}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="line-clamp-1 text-sm font-medium text-foreground">{note.data.title || 'Untitled'}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(note.updatedAt)}</span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {preview(note.data.content ?? '', 120) || 'No content'}
        </p>
      </button>
    </li>
  )
}

function CenteredMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <FileText className="mb-3 h-8 w-8 text-muted-foreground/60" aria-hidden />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{body}</p>
    </div>
  )
}
