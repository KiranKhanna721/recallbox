/**
 * Hugging Face Inference Providers client (OpenAI-compatible chat completions).
 *
 * Hugging Face is not in the DeepSpace integration catalog, so the worker
 * calls it directly with the app's own token. The token lives only in the
 * DeepSpace secrets store (`npx deepspace secrets set HF_TOKEN=hf_...`) and
 * reaches this code as `env.HF_TOKEN`; it is never sent to the browser or logged.
 *
 * Docs: https://huggingface.co/docs/inference-providers/tasks/chat-completion
 */

export const HF_CHAT_URL = 'https://router.huggingface.co/v1/chat/completions'
/** Default open-weights model; override with the HF_MODEL secret. `:fastest` lets HF pick the fastest provider. */
export const HF_DEFAULT_MODEL = 'openai/gpt-oss-120b:fastest'
const TIMEOUT_MS = 45_000

export interface HfEnv {
  HF_TOKEN?: string
  HF_MODEL?: string
}

export type HfResult =
  | { ok: true; data: unknown; model: string }
  | { ok: false; code: 'not_configured' | 'unauthorized' | 'no_credits' | 'rate_limited' | 'timeout' | 'upstream'; status?: number }

export async function hfChatCompletion(
  env: HfEnv,
  { system, user, maxTokens = 1024, temperature = 0.2 }: { system: string; user: string; maxTokens?: number; temperature?: number },
): Promise<HfResult> {
  const token = env.HF_TOKEN?.trim()
  if (!token) return { ok: false, code: 'not_configured' }
  const model = env.HF_MODEL?.trim() || HF_DEFAULT_MODEL

  let res: Response
  try {
    res = await fetch(HF_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        stream: false,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    return { ok: false, code: (e as Error).name === 'TimeoutError' ? 'timeout' : 'upstream' }
  }

  if (!res.ok) {
    const code = res.status === 401 || res.status === 403 ? 'unauthorized' : res.status === 402 ? 'no_credits' : res.status === 429 ? 'rate_limited' : 'upstream'
    return { ok: false, code, status: res.status }
  }
  try {
    return { ok: true, data: await res.json(), model }
  } catch {
    return { ok: false, code: 'upstream', status: res.status }
  }
}
