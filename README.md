# RecallBox — your second brain, powered by AI

RecallBox is a personal knowledge base built on [DeepSpace](https://docs.deep.space). You save technical notes, search them, and ask questions about them. Answers are grounded only in your own notes, and every claim cites a source you can click to open the original note.

**Live:** https://recallbox.app.space

## The user journey

1. Sign in with DeepSpace auth (GitHub or Google).
2. Create, edit, search and delete notes. They sync live and persist across reloads.
3. Ask a question on **Ask AI**, or from the dashboard's "Ask your knowledge" box.
4. The server retrieves the most relevant passages from **your** notes and asks Claude Haiku for a cited answer.
5. Click a citation chip (`S1`) or a source card to open the exact note.

No notes yet? **Load demo notes** seeds five technical notes (vector databases, React hooks, API auth, RAG, Cloudflare Workers). Loading them again never creates duplicates.

## Architecture

```
Browser (React 19 + Vite + Tailwind, file-based routes)
 ├─ useQuery / useMutations ──WebSocket──▶ RecordRoom Durable Object (SQLite)
 │                                         • notes schema + RBAC ('own' for every role)
 │                                         • userId is userBound (stamped from the verified JWT)
 └─ POST /api/actions/askNotes ──HTTPS──▶ Worker (Hono)
        Bearer JWT                         1. verify JWT (action route)
                                           2. tools.query(notes, where userId = caller)
                                           3. BM25 keyword ranking → top passages
                                           4. tools.integration('anthropic/chat-completion')
                                           5. validate citations → return {answer, citations}
```

| Layer | Where | Notes |
|---|---|---|
| Frontend | `src/pages/(app)/(protected)/{home,notes,ask}.tsx`, `src/components/` | Sidebar shell, dashboard, notes list + editor, AI workspace. Lucide icons, custom navy/indigo theme (`src/themes.css`). |
| Data access | `src/lib/notes.ts` | Reactive `useQuery('notes', { orderBy: 'updatedAt', orderDir: 'desc' })` and confirmed mutations. |
| Schema / RBAC | `src/schemas/notes-schema.ts` | `userId` (`userBound`, `immutable`), `title`, `content`, `demoKey`. `ownerField: 'userId'`, and `read`/`update`/`delete` are `'own'` for member **and** admin. The envelope carries `recordId`, `createdAt` and `updatedAt`. |
| Retrieval | `src/rag/retrieval.ts` | Pure BM25 over paragraph-sized passages, with title terms boosted. Unit-tested. |
| Prompting + citation checks | `src/rag/answer.ts` | Opaque source labels, a prompt-injection-hardened prompt, JSON output, citation validation. |
| Server actions | `src/actions/index.ts` | `askNotes`, `loadDemoNotes`. Both scope every query to the verified caller. |
| Client → action | `src/lib/actions-client.ts` | Sends the DeepSpace JWT as a Bearer token. Identity never goes in the body. |

### The RAG pipeline (`askNotes`)

1. **Authenticate.** The scaffold's action route verifies the caller's JWT and rejects missing or forged tokens with 401.
2. **Validate.** The question must be non-empty and at most 500 characters.
3. **Load only the caller's notes.** `tools.query('notes', { where: { userId } })`. Each row is checked again with `data.userId === userId`, because server actions run with RBAC off.
4. **Rank.** BM25 (k1 = 1.2, b = 0.75) runs over ~700-character passages, with stopword removal and light stemming. Weak tail matches (< 25% of the best score) are dropped. The result is capped at 6 passages, 3 per note, and ~6,000 characters.
5. **Short-circuit.** If nothing matches, the server returns *"I couldn't find enough information in your saved notes to answer that question."* without calling the model, at no cost.
6. **Generate.** Claude Haiku (`claude-haiku-5-5`, via DeepSpace's `anthropic/chat-completion` integration, temperature 0.2) receives the passages inside `<source label="S1">` tags. The system prompt says sources are untrusted data, never instructions, and requires JSON output: `{sufficient, answer, citations}`.
7. **Validate citations.** The model never sees note ids, only `S1…Sn`. The server maps labels back to the note ids it retrieved for this caller. Unknown labels are dropped and their inline markers stripped. An answer with no valid citation becomes the "insufficient" message.
8. **Return** `{answer, citations: [{label, noteId, title, excerpt}], sufficient}`. The UI turns `[S1]` markers into links to `/notes?id=…`.

## DeepSpace integrations used

| Integration | What it does here | Why it helps |
|---|---|---|
| **Native auth** (`DeepSpaceAuthProvider`, `AuthGate`, `AuthOverlay`, `signOut`) | GitHub/Google sign-in. `(protected)` routes are gated. Action calls carry a verified JWT. | No custom auth code. Identity comes from a verified token, never from client input. |
| **Records / RecordRoom** (`useQuery`, `useMutations`, collection RBAC) | Persistent notes with live sync across tabs. | Ownership is enforced in the Durable Object before any data leaves the server, so a client cannot read or write someone else's notes even with a hand-crafted WebSocket message. |
| **Server actions** (`ActionHandler`, `tools.query/create/integration`) | `askNotes` and `loadDemoNotes`. | Retrieval and the AI call run server-side, and the AI credential never reaches the browser. |
| **Integration proxy** (`anthropic/chat-completion`) | Claude Haiku answers with no API key stored anywhere. | Billed to the owner's DeepSpace credits (`src/integrations.ts`), so reviewers need no credits of their own. Sign-in is still required. |
| **Secrets store** (optional) | Holds `AI_PROVIDER` / `HF_TOKEN` when the Hugging Face path is turned on. | Keys never appear in code, Git, or the browser. |
| **Deploy** (`npx deepspace deploy`) | Cloudflare Workers for Platforms at `recallbox.app.space`. | One command, no infrastructure to manage. |

## Model choice: Claude Haiku via DeepSpace, Hugging Face as an option

The default is **Claude Haiku through DeepSpace's integration proxy**. RecallBox does the hard work itself (retrieval, labeled sources, citation validation), so the model only has to write a short answer from a few excerpts, and Haiku is plenty for that. It's the cheapest Claude in the catalog (about $0.000004 for a tiny test call), needs no API key, and is billed to DeepSpace credits. Those are included on the free plan, so the app runs at no out-of-pocket cost.

I also built a **Hugging Face** path (`src/server/huggingface.ts`, open-weights models via HF Inference Providers). Turn it on with the secrets `AI_PROVIDER=huggingface` and `HF_TOKEN`, and optionally `HF_MODEL`. It isn't the default because HF isn't in the DeepSpace catalog: it means managing a raw token, and free HF accounts get no credits for this API (a real call returned 402). Retrieval and citation checks sit in front of either model, so the grounding guarantees don't change.

## Why keyword retrieval instead of embeddings (for this MVP)

- **Right-sized.** A personal note set is tens to hundreds of notes. BM25 over that takes milliseconds in the Worker.
- **Always fresh.** Retrieval reads the current notes on every question. There is no index to rebuild and no embedding job to keep in sync after edits.
- **Zero extra cost or infrastructure.** No embedding calls per edit, no Vectorize/AI Search binding, and the "no match" case costs nothing.
- **Precise on technical vocabulary.** Exact terms such as `useEffect`, `HNSW` or `PKCE` match reliably, which is where embeddings are often weaker.
- **Transparent and testable.** Ranking is pure code with unit tests (`src/rag/rag.test.ts`).
- **Tradeoff:** it misses pure paraphrases ("speed up rendering" vs "memoization"). The next step is hybrid search: add DeepSpace's managed knowledge base (`[[ai_search]]`, hybrid mode) or Vectorize, and keep BM25 for exact terms.

## Running locally

```bash
npm install                      # npm >= 11.6
npx deepspace auth login
npx deepspace dev start          # http://localhost:5173
npm run type-check && npm run lint
npx vitest run                   # unit tests (retrieval, citations, prompt hardening)
npx deepspace test run all       # Playwright: smoke, API auth, 2-user isolation, AI journey, mobile
npx deepspace deploy
```

The e2e suite needs two test accounts (`npx deepspace test accounts create --email <name>@deepspace.test --name "<name>" --password-stdin`). It makes one real Claude Haiku call per run, billed to the owner's DeepSpace credits (well under a cent).

## Verification (what was actually run)

- `tsc --noEmit`: passes. `eslint .`: 0 errors, 0 warnings. `vite build`: passes.
- Vitest: 23 tests pass. They cover ranking for each demo question, unrelated questions returning nothing, citation validation dropping fabricated labels, insufficient handling, and source-tag injection neutralized.
- Playwright (`deepspace test run all`): every spec passes against the real dev worker and Durable Object:
  - create a note, reload, and it persists; search hits and misses; edit, save, then delete with confirmation
  - a second user can't see the first user's note in the list or via a direct link, and their AI can't retrieve it
  - a real Claude Haiku answer cites the right note, and the citation opens it
  - demo notes don't duplicate; mobile 375px has no horizontal overflow and the nav drawer works
  - unauthenticated and forged-token action calls return 401; protected routes show sign-in

## Known limitations / next steps

- **AI spend comes from the owner's DeepSpace credits.** When they run out, questions return "out of credits". Notes, search and the "not enough information" path keep working.

- **Keyword-only retrieval.** Pure paraphrases can miss. Next: hybrid retrieval (managed knowledge base or Vectorize) with BM25 kept for exact terms.
- **No per-user rate limit on AI calls.** The UI allows one question in flight, and the server caps question length. A per-user daily quota (for example a counter collection checked in `askNotes`) should come before wider launch.
- **Plain-text notes.** There's no Markdown rendering or rich editor yet.
- **Single-turn Q&A.** Questions don't use the previous answer as context. The session history on the Ask page is per tab.
- **Retrieval scans up to 1,000 notes per question.** That's plenty for personal use. Larger collections need an index.

## AI assistance

The app was built with Claude Code (an AI coding agent). The agent read the DeepSpace docs and skill, scaffolded with `create-deepspace`, and wrote the schema, retrieval, prompting, server actions, UI, tests and this README. It verified the integration's response shape with one live call and ran the type-check, lint, unit, end-to-end and build checks listed above. Design and architecture decisions are explained inline in code comments and above.
