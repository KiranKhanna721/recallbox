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
import { hfChatCompletion, type HfResult } from '../server/huggingface'

/** Claude Haiku via the DeepSpace integration proxy — the cheapest Claude in the catalog. */
export const AI_ENDPOINT = 'anthropic/chat-completion'
export const AI_MODEL = 'claude-haiku-5-5'
const MAX_NOTES_SCANNED = 1000

const AI_ERROR_MESSAGES: Record<Extract<HfResult, { ok: false }>['code'], string> = {
  not_configured: 'AI answers are not configured on this server yet.',
  unauthorized: 'The AI service rejected the server credentials. Please contact the app owner.',
  no_credits: 'The AI service is out of credits right now. Please try again later.',
  rate_limited: 'The AI service is busy. Please wait a moment and try again.',
  timeout: 'The AI service took too long to answer. Please try again.',
  upstream: 'The AI service could not answer right now. Please try again.',
}

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

const askNotes: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
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
  const ai = await generate(env, tools, SYSTEM_PROMPT, buildUserPrompt(question, sources))
  if (!ai.ok) return { success: false, error: ai.error }

  // 7–8. Map labels back to authorized note ids; drop anything unverifiable.
  const result = validateAnswer(extractModelText(ai.data), sources)
  return {
    success: true,
    data: { ...result, retrievedCount: sources.length, model: ai.model } satisfies AskResult,
  }
}

type GenerateResult = { ok: true; data: unknown; model: string } | { ok: false; error: string }

/**
 * Default: Claude Haiku through DeepSpace's integration proxy — no API key in
 * the app, billed to the owner's DeepSpace credits (see src/integrations.ts).
 * Opt-in: set the AI_PROVIDER=huggingface secret (plus HF_TOKEN) to use an
 * open-weights model on Hugging Face instead.
 */
async function generate(
  env: Env,
  tools: Parameters<ActionHandler<Env>>[0]['tools'],
  system: string,
  user: string,
): Promise<GenerateResult> {
  if (env.AI_PROVIDER?.trim().toLowerCase() === 'huggingface') {
    const hf = await hfChatCompletion(env, { system, user })
    if (hf.ok) return { ok: true, data: hf.data, model: hf.model }
    // Log the failure class only — never the token or the prompt.
    console.warn(`[askNotes] huggingface failed code=${hf.code} status=${hf.status ?? '-'}`)
    return { ok: false, error: AI_ERROR_MESSAGES[hf.code] }
  }

  const res = await tools.integration(AI_ENDPOINT, {
    model: AI_MODEL,
    max_tokens: 1024,
    temperature: 0.2,
    system,
    messages: [{ role: 'user', content: user }],
  })
  if (res.success) return { ok: true, data: res.data, model: AI_MODEL }
  console.warn(`[askNotes] integration failed code=${res.code ?? 'unknown'}`)
  return {
    ok: false,
    error: res.code === 'insufficient_credits' ? AI_ERROR_MESSAGES.no_credits : AI_ERROR_MESSAGES.upstream,
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
