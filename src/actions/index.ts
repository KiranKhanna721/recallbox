/**
 * Server actions — POST /api/actions/:name, caller JWT verified by
 * src/server/action-routes.ts before any handler runs.
 *
 * `tools.*` runs with RBAC OFF, so every query below is scoped to the
 * verified `userId` explicitly and every returned row is re-checked against
 * it before use. Nothing from `params` is trusted as an identity or record id.
 */

import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import { NOTES_COLLECTION, NOTE_CONTENT_MAX, NOTE_TITLE_MAX, type NoteData } from '../schemas/notes-schema'
import { retrievePassages, type RetrievableNote } from '../rag/retrieval'
import {
  INSUFFICIENT_ANSWER,
  QUESTION_MAX,
  SYSTEM_PROMPT,
  buildSources,
  buildUserPrompt,
  extractModelText,
  validateAnswer,
  type GroundedAnswer,
} from '../rag/answer'
import { DEMO_NOTES } from '../demo-notes'

/** Claude via the DeepSpace integration proxy (owner-billed, see src/integrations.ts). */
export const AI_ENDPOINT = 'anthropic/chat-completion'
export const AI_MODEL = 'claude-sonnet-5-5'
const MAX_NOTES_SCANNED = 1000

interface NoteEnvelope {
  recordId: string
  data: NoteData
  createdBy?: string
  updatedAt?: string
}

/** Load only the caller's notes; drop any row that is not provably theirs. */
async function loadOwnNotes(
  tools: Parameters<ActionHandler<Env>>[0]['tools'],
  userId: string,
): Promise<NoteEnvelope[] | { error: string }> {
  const res = await tools.query<NoteData & Record<string, unknown>>(NOTES_COLLECTION, {
    where: { userId },
    limit: MAX_NOTES_SCANNED,
  })
  if (!res.success) return { error: res.error }
  const records = (res.data.records ?? []) as unknown as NoteEnvelope[]
  return records.filter((r) => r.data?.userId === userId)
}

export type AskResult = GroundedAnswer & { retrievedCount: number; model: string | null }

const askNotes: ActionHandler<Env> = async ({ userId, params, tools }) => {
  // 1. Validate input (identity already verified by the action route).
  const question = typeof params.question === 'string' ? params.question.trim() : ''
  if (!question) return { success: false, error: 'Please enter a question.' }
  if (question.length > QUESTION_MAX) {
    return { success: false, error: `Questions are limited to ${QUESTION_MAX} characters.` }
  }

  // 2. Load only this user's notes.
  const notes = await loadOwnNotes(tools, userId)
  if ('error' in notes) return { success: false, error: 'Could not load your notes. Please try again.' }

  // 3–4. Keyword-rank passages and keep the top excerpts.
  const retrievable: RetrievableNote[] = notes.map((n) => ({
    id: n.recordId,
    title: n.data.title ?? '',
    content: n.data.content ?? '',
  }))
  const passages = retrievePassages(question, retrievable)
  const sources = buildSources(passages)

  const insufficient: AskResult = {
    answer: INSUFFICIENT_ANSWER,
    citations: [],
    sufficient: false,
    retrievedCount: 0,
    model: null,
  }
  // Nothing relevant: answer honestly without spending a model call.
  if (sources.length === 0) return { success: true, data: insufficient }

  // 5–6. Ask the model for a grounded, cited answer.
  const ai = await tools.integration(AI_ENDPOINT, {
    model: AI_MODEL,
    max_tokens: 1024,
    temperature: 0.2,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(question, sources) }],
  })
  if (!ai.success) {
    console.warn(`[askNotes] integration failed code=${ai.code ?? 'unknown'} error=${ai.error}`)
    const msg =
      ai.code === 'insufficient_credits'
        ? 'The AI service is out of credits right now. Please try again later.'
        : 'The AI service could not answer right now. Please try again.'
    return { success: false, error: msg }
  }

  // 7–8. Map labels back to authorized note ids; drop anything unverifiable.
  const result = validateAnswer(extractModelText(ai.data), sources)
  return {
    success: true,
    data: { ...result, retrievedCount: sources.length, model: AI_MODEL } satisfies AskResult,
  }
}

/** Seed the five demo notes for the caller, skipping any they already have. */
const loadDemoNotes: ActionHandler<Env> = async ({ userId, tools }) => {
  const notes = await loadOwnNotes(tools, userId)
  if ('error' in notes) return { success: false, error: 'Could not load your notes. Please try again.' }
  const existing = new Set(notes.map((n) => n.data.demoKey).filter(Boolean))

  let created = 0
  for (const demo of DEMO_NOTES) {
    if (existing.has(demo.key)) continue
    const res = await tools.create<NoteData & Record<string, unknown>>(NOTES_COLLECTION, {
      userId,
      title: demo.title.slice(0, NOTE_TITLE_MAX),
      content: demo.content.slice(0, NOTE_CONTENT_MAX),
      demoKey: demo.key,
    })
    if (!res.success) return { success: false, error: 'Could not create demo notes. Please try again.' }
    created++
  }
  return { success: true, data: { created, skipped: DEMO_NOTES.length - created } }
}

export const actions: Record<string, ActionHandler<Env>> = {
  askNotes,
  loadDemoNotes,
}
