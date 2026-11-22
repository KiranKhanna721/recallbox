import { ArrowUp } from 'lucide-react'
import { QUESTION_MAX } from '../rag/answer'
import { cn } from '../lib/utils'

interface AskInputProps {
  value: string
  onChange: (v: string) => void
  onSubmit: (q: string) => void
  disabled?: boolean
  loading?: boolean
  placeholder?: string
  size?: 'md' | 'lg'
  autoFocus?: boolean
}

/** Question box: Enter submits, Shift+Enter inserts a newline. */
export function AskInput({ value, onChange, onSubmit, disabled, loading, placeholder, size = 'md', autoFocus }: AskInputProps) {
  const q = value.trim()
  const canSubmit = !!q && !disabled && !loading && value.length <= QUESTION_MAX
  const submit = () => canSubmit && onSubmit(q)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="relative rounded-xl border border-input bg-background/60 transition focus-within:border-primary/60 focus-within:ring-[3px] focus-within:ring-primary/20"
    >
      <label htmlFor="ask-input" className="sr-only">Ask a question about your notes</label>
      <textarea
        id="ask-input"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            submit()
          }
        }}
        maxLength={QUESTION_MAX}
        rows={size === 'lg' ? 3 : 2}
        placeholder={placeholder ?? 'Ask anything about your notes…'}
        disabled={disabled}
        className={cn(
          'block w-full resize-none bg-transparent px-4 pr-14 text-foreground placeholder:text-muted-foreground/70 focus:outline-none',
          size === 'lg' ? 'py-4 text-base' : 'py-3 text-sm',
        )}
      />
      <button
        type="submit"
        disabled={!canSubmit}
        aria-label="Ask"
        className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
        ) : (
          <ArrowUp className="h-4 w-4" aria-hidden />
        )}
      </button>
    </form>
  )
}
