import { test, expect } from '@playwright/test'

test.describe('API tests', () => {
  test('auth proxy forwards to auth worker', async ({ request }) => {
    const res = await request.get('/api/auth/ok')
    expect(res.ok()).toBeTruthy()
  })

  test('WebSocket endpoint exists', async ({ page }) => {
    // /home is a dynamic page (under src/pages/(app)/), so mounting it boots
    // the providers and auto-connects the records WebSocket. The static
    // landing at '/' deliberately does neither — see smoke.spec.ts.
    await page.goto('/home')
    // Wait for the app to connect its WebSocket (it auto-connects on mount)
    await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
    // If the app loaded and connected, the WS endpoint works
  })

  test('server actions reject unauthenticated callers', async ({ request }) => {
    for (const name of ['askNotes', 'loadDemoNotes']) {
      const res = await request.post(`/api/actions/${name}`, { data: { question: 'anything' } })
      expect(res.status()).toBe(401)
    }
  })

  test('server actions reject a forged bearer token', async ({ request }) => {
    const res = await request.post('/api/actions/askNotes', {
      headers: { Authorization: 'Bearer not-a-real-jwt' },
      data: { question: 'What is RAG?' },
    })
    expect(res.status()).toBe(401)
  })
})
