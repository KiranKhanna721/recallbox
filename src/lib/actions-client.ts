/**
 * Typed client for RecallBox server actions. The JWT comes from the DeepSpace
 * session; identity is never sent in the body.
 */
import { getAuthToken } from 'deepspace'
import type { AskResult } from '../actions'

async function callAction<T>(name: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new Error('Please sign in to continue.')
  let res: Response
  try {
    res = await fetch(`/api/actions/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
      signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new Error('Network error. Check your connection and try again.')
  }
  if (res.status === 401) throw new Error('Your session expired. Please sign in again.')
  const body = (await res.json().catch(() => null)) as { success?: boolean; data?: T; error?: string } | null
  if (!res.ok || !body?.success) throw new Error(body?.error || `Request failed (${res.status}).`)
  return body.data as T
}

export const askNotes = (question: string, signal?: AbortSignal) =>
  callAction<AskResult>('askNotes', { question }, signal)

export const loadDemoNotes = () => callAction<{ created: number; skipped: number }>('loadDemoNotes', {})
