/**
 * Lightweight keyword retrieval (BM25 over note passages).
 *
 * Pure functions with no DeepSpace or network dependency, so the same code is
 * unit-tested in Node and runs inside the Worker's server action.
 *
 * Why BM25 and not embeddings: a personal note collection is small (tens to
 * hundreds of notes), questions usually reuse the note's own vocabulary, and
 * BM25 needs no index build, no extra binding, no per-note embedding cost and
 * no re-embedding when a note changes. Retrieval runs fresh on every question
 * against the current notes.
 */

export interface RetrievableNote {
  id: string
  title: string
  content: string
  updatedAt?: string
}

export interface Passage {
  noteId: string
  noteTitle: string
  text: string
  score: number
}

const STOPWORDS = new Set(
  `a an and are as at be been but by can could did do does doing for from had has have how i if in into is it its
  me my of on or our so than that the their them then there these they this those to too was we were what when
  where which who whom why will with would you your about tell explain describe give list show please vs versus
  between different difference much many some any also just more most other such only same very should`
    .split(/\s+/)
    .filter(Boolean),
)

/** Light suffix stripping so "workers"/"worker" and "hooks"/"hook" match. */
function stem(token: string): string {
  if (token.length > 5 && token.endsWith('ing')) return token.slice(0, -3)
  if (token.length > 4 && token.endsWith('ies')) return token.slice(0, -3) + 'y'
  if (token.length > 4 && token.endsWith('es') && /(ch|sh|x|ss)es$/.test(token)) return token.slice(0, -2)
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1)
  if (token.length > 4 && token.endsWith('ed')) return token.slice(0, -2)
  return token
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+(?:[-_.][a-z0-9]+)*/g) ?? [])
    .flatMap((t) => (t.includes('-') ? [t, ...t.split('-')] : [t]))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem)
}

/** Split note content into passages of roughly `target` characters on paragraph boundaries. */
export function splitPassages(content: string, target = 700): string[] {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  const out: string[] = []
  let current = ''
  for (const para of paragraphs) {
    if (para.length > target * 1.6) {
      if (current) out.push(current), (current = '')
      // Hard-wrap very long paragraphs on sentence boundaries.
      const sentences = para.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [para]
      let chunk = ''
      for (const s of sentences) {
        if (chunk.length + s.length > target && chunk) out.push(chunk.trim()), (chunk = '')
        chunk += s
      }
      if (chunk.trim()) out.push(chunk.trim())
      continue
    }
    if (current && current.length + para.length > target) {
      out.push(current)
      current = para
    } else {
      current = current ? `${current}\n\n${para}` : para
    }
  }
  if (current) out.push(current)
  return out
}

export interface RetrieveOptions {
  /** Max passages returned. */
  maxPassages?: number
  /** Max passages drawn from any single note. */
  maxPerNote?: number
  /** Total character budget across returned passages. */
  charBudget?: number
}

/**
 * Rank passages from `notes` against `question` with BM25 (k1=1.2, b=0.75).
 * Title terms are added to every passage of the note (boosted), so a note
 * titled "Retrieval-Augmented Generation" matches "what is RAG generation".
 * Returns only passages with a positive score, best first.
 */
export function retrievePassages(
  question: string,
  notes: RetrievableNote[],
  { maxPassages = 6, maxPerNote = 3, charBudget = 6000 }: RetrieveOptions = {},
): Passage[] {
  const queryTerms = [...new Set(tokenize(question))]
  if (queryTerms.length === 0) return []

  type Doc = { noteId: string; noteTitle: string; text: string; tf: Map<string, number>; len: number }
  const docs: Doc[] = []
  for (const note of notes) {
    const titleTokens = tokenize(note.title)
    const passages = splitPassages(note.content)
    const chunks = passages.length ? passages : [note.title]
    for (const text of chunks) {
      const tokens = [...tokenize(text), ...titleTokens, ...titleTokens] // title weighted 2x
      const tf = new Map<string, number>()
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
      docs.push({ noteId: note.id, noteTitle: note.title, text, tf, len: tokens.length })
    }
  }
  if (docs.length === 0) return []

  const N = docs.length
  const avgLen = docs.reduce((s, d) => s + d.len, 0) / N
  const df = new Map<string, number>()
  for (const term of queryTerms) df.set(term, docs.filter((d) => d.tf.has(term)).length)

  const k1 = 1.2
  const b = 0.75
  const scored = docs
    .map((d) => {
      let score = 0
      for (const term of queryTerms) {
        const f = d.tf.get(term) ?? 0
        if (!f) continue
        const n = df.get(term) ?? 0
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5))
        score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / avgLen)))
      }
      return { noteId: d.noteId, noteTitle: d.noteTitle, text: d.text, score }
    })
    .filter((p) => p.score > 0)
    .sort((a, b2) => b2.score - a.score)

  // Drop weak tail matches: keep passages within 25% of the best score.
  const best = scored[0]?.score ?? 0
  const perNote = new Map<string, number>()
  const out: Passage[] = []
  let used = 0
  for (const p of scored) {
    if (out.length >= maxPassages) break
    if (p.score < best * 0.25) break
    const count = perNote.get(p.noteId) ?? 0
    if (count >= maxPerNote) continue
    if (used + p.text.length > charBudget && out.length > 0) continue
    perNote.set(p.noteId, count + 1)
    used += p.text.length
    out.push(p)
  }
  return out
}

/** Case-insensitive substring search used by the notes list. */
export function matchesSearch(note: { title: string; content: string }, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = `${note.title}\n${note.content}`.toLowerCase()
  return q.split(/\s+/).every((word) => hay.includes(word))
}
