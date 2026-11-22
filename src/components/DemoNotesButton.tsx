import { useState } from 'react'
import { Wand2 } from 'lucide-react'
import { loadDemoNotes } from '../lib/actions-client'
import { useToast } from './ui'
import { cn } from '../lib/utils'

/** Seeds the five demo notes via a server action; repeated clicks never duplicate. */
export function DemoNotesButton({ variant = 'outline' }: { variant?: 'outline' | 'subtle' }) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const run = async () => {
    setBusy(true)
    try {
      const { created } = await loadDemoNotes()
      if (created === 0) toast.info('Demo notes already loaded', 'All five demo notes are in your workspace.')
      else toast.success(`Added ${created} demo note${created === 1 ? '' : 's'}`, 'Try asking: "What is retrieval-augmented generation?"')
    } catch (e) {
      toast.error('Could not load demo notes', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <button
      onClick={run}
      disabled={busy}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium transition disabled:opacity-60',
        variant === 'outline'
          ? 'border border-border bg-card text-foreground hover:bg-accent'
          : 'px-0 text-xs text-muted-foreground hover:text-foreground',
      )}
    >
      {busy ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      ) : (
        <Wand2 className="h-4 w-4" aria-hidden />
      )}
      Load demo notes
    </button>
  )
}
