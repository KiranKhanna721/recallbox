import { afterEach, describe, expect, it, vi } from 'vitest'
import { HF_CHAT_URL, HF_DEFAULT_MODEL, hfChatCompletion } from './huggingface'
import { extractModelText } from '../rag/answer'

afterEach(() => vi.unstubAllGlobals())

describe('hfChatCompletion', () => {
  it('refuses to call out without a token', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    expect(await hfChatCompletion({}, { system: 's', user: 'u' })).toEqual({ ok: false, code: 'not_configured' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sends an OpenAI-style request with the bearer token and default model', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'hi' } }] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const res = await hfChatCompletion({ HF_TOKEN: 'hf_test' }, { system: 'sys', user: 'q' })
    expect(res).toMatchObject({ ok: true, model: HF_DEFAULT_MODEL })
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(HF_CHAT_URL)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer hf_test')
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe(HF_DEFAULT_MODEL)
    expect(body.messages).toEqual([{ role: 'system', content: 'sys' }, { role: 'user', content: 'q' }])
    if (res.ok) expect(extractModelText(res.data)).toBe('hi')
  })

  it('honours an HF_MODEL override', async () => {
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    await hfChatCompletion({ HF_TOKEN: 't', HF_MODEL: 'meta-llama/Llama-3.1-8B-Instruct' }, { system: 's', user: 'u' })
    const init = (fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(JSON.parse(String(init.body)).model).toBe('meta-llama/Llama-3.1-8B-Instruct')
  })

  it.each([
    [401, 'unauthorized'],
    [402, 'no_credits'],
    [429, 'rate_limited'],
    [500, 'upstream'],
  ])('maps HTTP %i to %s', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status })))
    expect(await hfChatCompletion({ HF_TOKEN: 't' }, { system: 's', user: 'u' })).toMatchObject({ ok: false, code })
  })
})
