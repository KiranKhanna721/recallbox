/**
 * RecallBox end-to-end journey against the real dev worker + Durable Object.
 *
 * Covers: create → persist across reload → search → edit → AI answer with a
 * citation that opens the source note → cross-user isolation (UI + AI) →
 * delete with confirmation.
 *
 * The AI test makes ONE real anthropic/chat-completion call (owner-billed,
 * a fraction of a cent). The isolation check costs nothing: with no matching
 * notes the server answers "insufficient" without calling the model.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'

test.skip(loadAllTestAccounts().length < 2, 'Needs 2 usable test accounts (npx deepspace test accounts create ...)')
test.describe.configure({ mode: 'serial', timeout: 90_000 })

const marker = `__test-${Date.now()}__`
// A made-up term no other note contains, so retrieval can only match this note.
const secret = `zorblaxian quasar protocol ${Date.now()}`
const title = `${marker} Zorblaxian Quasar Protocol`
const body = `The zorblaxian quasar protocol is a fictional handshake used in RecallBox tests. It requires exactly seven teal acknowledgements before a session opens. Reference: ${secret}.`
let noteUrl = ''

test('notes CRUD, persistence, search, AI citation, isolation', async ({ users }) => {
  const [alice, bob] = await users(2)
  const a = alice.page

  // --- Create
  await a.goto('/notes?new=1')
  const titleInput = a.getByLabel('Title')
  await expect(titleInput).toBeVisible({ timeout: 20_000 })
  await expect(a).toHaveURL(/id=/)
  noteUrl = a.url()
  await titleInput.fill(title)
  await a.getByLabel('Content').fill(body)
  await a.getByRole('button', { name: /^Save/ }).click()
  await expect(a.getByText(/^Updated /)).toBeVisible({ timeout: 15_000 })

  // --- Persist across reload
  await a.reload()
  await expect(a.getByLabel('Title')).toHaveValue(title, { timeout: 20_000 })
  await expect(a.getByLabel('Content')).toHaveValue(body)

  // --- Search (matches content words, case-insensitive) and misses
  await a.goto('/notes')
  await a.getByLabel('Search notes').fill('SEVEN teal')
  await expect(a.getByRole('button', { name: new RegExp(marker) })).toBeVisible({ timeout: 15_000 })
  await a.getByLabel('Search notes').fill('definitely-not-in-any-note-xyz')
  await expect(a.getByText(/No matches for/)).toBeVisible()

  // --- Bob cannot see Alice's note (list or direct link)
  const b = bob.page
  await b.goto('/notes')
  await expect(b.getByRole('heading', { name: 'All Notes' })).toBeVisible({ timeout: 20_000 })
  await expect(b.getByText(/\d+ notes?$/)).toBeVisible({ timeout: 15_000 })
  await expect(b.getByText(marker)).toHaveCount(0)
  await b.goto(noteUrl.replace(/^https?:\/\/[^/]+/, ''))
  await expect(b.getByText('Note not found')).toBeVisible({ timeout: 15_000 })

  // --- Bob's AI cannot retrieve Alice's note (no model call: nothing matches)
  await b.goto('/ask')
  await b.getByLabel('Ask a question about your notes').fill(`What is the ${secret}?`)
  await b.getByRole('button', { name: 'Ask' }).click()
  await expect(b.getByText("I couldn't find enough information in your saved notes")).toBeVisible({ timeout: 30_000 })
  await expect(b.getByTestId('citation-card')).toHaveCount(0)

  // --- Alice gets a grounded answer citing her note; the citation opens it
  await a.goto('/ask')
  await a.getByLabel('Ask a question about your notes').fill('How many teal acknowledgements does the zorblaxian quasar protocol require?')
  await a.getByRole('button', { name: 'Ask' }).click()
  const card = a.getByTestId('citation-card').filter({ hasText: marker })
  await expect(card).toBeVisible({ timeout: 60_000 })
  await expect(a.getByText(/seven|7/i).first()).toBeVisible()
  await card.click()
  await expect(a).toHaveURL(new RegExp(noteUrl.split('?')[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  await expect(a.getByLabel('Title')).toHaveValue(title, { timeout: 15_000 })

  // --- Delete with confirmation
  await a.getByRole('button', { name: 'Delete' }).click()
  await a.getByRole('button', { name: 'Delete note' }).click()
  await expect(a.getByText('Select a note')).toBeVisible({ timeout: 15_000 })
  await a.reload()
  await a.getByLabel('Search notes').fill(marker)
  await expect(a.getByText(/No matches for/)).toBeVisible({ timeout: 15_000 })
})

test('protected pages ask signed-out visitors to sign in', async ({ page }) => {
  for (const path of ['/home', '/notes', '/ask']) {
    await page.goto(path)
    await expect(page.getByText('Sign in to continue')).toBeVisible({ timeout: 15_000 })
  }
})

test('demo notes load once and never duplicate', async ({ users }) => {
  const [alice] = await users(1)
  const a = alice.page
  await a.goto('/ask')
  await expect(a.getByRole('heading', { name: 'Ask your knowledge' })).toBeVisible({ timeout: 20_000 })
  for (let i = 0; i < 2; i++) {
    await a.goto('/home')
    await a.getByRole('button', { name: 'Load demo notes' }).first().click()
    await expect(a.getByText(/Added \d demo notes?|Demo notes already loaded/).first()).toBeVisible({ timeout: 20_000 })
  }
  await expect(a.getByText('Demo notes already loaded').first()).toBeVisible()
  await a.goto('/notes')
  await a.getByLabel('Search notes').fill('Introduction to Vector Databases')
  await expect(a.getByText('1 of')).toBeVisible({ timeout: 15_000 })
})

test('mobile layout: no horizontal overflow and a working nav drawer', async ({ users }) => {
  const [alice] = await users(1)
  const a = alice.page
  await a.setViewportSize({ width: 375, height: 812 })
  for (const path of ['/home', '/notes', '/ask']) {
    await a.goto(path)
    await expect(a.getByRole('button', { name: 'Open navigation' })).toBeVisible({ timeout: 20_000 })
    await a.waitForTimeout(500)
    const overflow = await a.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0)
  }
  await a.getByRole('button', { name: 'Open navigation' }).click()
  await a.getByRole('dialog', { name: 'Navigation' }).getByRole('link', { name: 'All Notes' }).click()
  await expect(a).toHaveURL(/\/notes/)
  await expect(a.getByRole('dialog', { name: 'Navigation' })).toHaveCount(0)
})
