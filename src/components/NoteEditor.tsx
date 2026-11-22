/**
 * Note editor — explicit Save (button or Ctrl/Cmd+S) with confirmed writes,
 * plus an autosave when the user stops typing. Delete asks for confirmation.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RecordData } from 'deepspace'
import { Check, Save, Trash2 } from 'lucide-react'
import { NOTE_CONTENT_MAX, NOTE_TITLE_MAX, type NoteData } from '../schemas/notes-schema'
import { useNoteMutations } from '../lib/notes'
import { fullDate, timeAgo } from '../lib/format'
import { ConfirmModal, useToast } from './ui'

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
const AUTOSAVE_MS = 1500

export function NoteEditor({ note, onDeleted }: { note: RecordData<NoteData>; onDeleted: () => void }) {
  const { ready, putConfirmed, removeConfirmed } = useNoteMutations()
  const toast = useToast()
  const [title, setTitle] = useState(note.data.title ?? '')
  const [content, setContent] = useState(note.data.content ?? '')
  const [state, setState] = useState<SaveState>('idle')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const deletedRef = useRef(false)

  const dirty = title !== (note.data.title ?? '') || content !== (note.data.content ?? '')

  // Adopt remote changes (another tab/device) when there is nothing local to lose.
  useEffect(() => {
    if (state === 'idle' || state === 'saved') {
      setTitle(note.data.title ?? '')
      setContent(note.data.content ?? '')
    }
     
  }, [note.data.title, note.data.content])

  // Focus the title of a fresh note.
  useEffect(() => {
    if (note.data.title === 'Untitled note' && !note.data.content) titleRef.current?.select()
     
  }, [])

  const save = useCallback(async () => {
    if (!dirty || !ready || deletedRef.current) return
    const cleanTitle = title.trim().slice(0, NOTE_TITLE_MAX) || 'Untitled note'
    setState('saving')
    try {
      await putConfirmed(note.recordId, { title: cleanTitle, content: content.slice(0, NOTE_CONTENT_MAX) })
      if (cleanTitle !== title) setTitle(cleanTitle)
      setState('saved')
    } catch (e) {
      setState('error')
      toast.error('Save failed', (e as Error).message)
    }
  }, [dirty, ready, title, content, note.recordId, putConfirmed, toast])

  // Autosave after a pause in typing.
  useEffect(() => {
    if (!dirty) return
    setState((s) => (s === 'saving' ? s : 'dirty'))
    const t = setTimeout(() => void save(), AUTOSAVE_MS)
    return () => clearTimeout(t)
  }, [title, content])  

  // Ctrl/Cmd+S saves; warn before leaving with unsaved changes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      }
    }
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [save, dirty])

  // Flush pending edits when switching away from this note.
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => () => void saveRef.current(), [])

  const doDelete = async () => {
    setDeleting(true)
    deletedRef.current = true
    try {
      await removeConfirmed(note.recordId)
      toast.success('Note deleted')
      setConfirmDelete(false)
      onDeleted()
    } catch (e) {
      deletedRef.current = false
      toast.error('Delete failed', (e as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  const status =
    state === 'saving' ? 'Saving…' : state === 'error' ? 'Not saved' : dirty ? 'Unsaved changes' : `Updated ${timeAgo(note.updatedAt)}`

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-4 pb-8 sm:px-8">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-background/80 py-3 backdrop-blur md:pt-6">
        <span
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          title={`Created ${fullDate(note.createdAt)} · Updated ${fullDate(note.updatedAt)}`}
          aria-live="polite"
        >
          {!dirty && state !== 'error' && <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />}
          {status}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={!ready}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground transition hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Delete</span>
          </button>
          <button
            onClick={() => void save()}
            disabled={!ready || !dirty || state === 'saving'}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" aria-hidden /> Save
            <kbd className="ml-0.5 hidden rounded bg-white/15 px-1 text-[10px] font-normal lg:inline">Ctrl S</kbd>
          </button>
        </div>
      </div>

      <label htmlFor="note-title" className="sr-only">Title</label>
      <input
        id="note-title"
        ref={titleRef}
        value={title}
        maxLength={NOTE_TITLE_MAX}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title"
        className="mt-2 w-full bg-transparent text-2xl font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/50 focus:outline-none sm:text-3xl"
      />
      <p className="mt-1 text-xs text-muted-foreground">Created {fullDate(note.createdAt)}</p>

      <label htmlFor="note-content" className="sr-only">Content</label>
      <textarea
        id="note-content"
        value={content}
        maxLength={NOTE_CONTENT_MAX}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Start writing… Paste docs, snippets, or anything you want to recall later."
        className="mt-6 min-h-[50vh] w-full flex-1 resize-none bg-transparent text-[15px] leading-7 text-foreground/90 placeholder:text-muted-foreground/50 focus:outline-none"
      />

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        loading={deleting}
        variant="destructive"
        title="Delete this note?"
        description={`“${note.data.title || 'Untitled'}” will be permanently deleted. This can't be undone.`}
        confirmText="Delete note"
      />
    </div>
  )
}
