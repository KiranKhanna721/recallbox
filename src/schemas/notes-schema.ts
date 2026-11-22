import type { CollectionSchema } from 'deepspace/schema'

/**
 * Notes — each user's private knowledge base.
 *
 * Privacy is enforced in the RecordRoom Durable Object, not the UI:
 *  - `userId` is `userBound`, so the DO stamps the caller's verified user id
 *    on every write; a client cannot create a note in someone else's name.
 *  - `ownerField: 'userId'` makes every `'own'` rule check that column.
 *  - Every role, admin included, is `'own'`: the app owner is pinned to admin,
 *    and RecallBox notes are personal, so not even the owner can read them
 *    through the client.
 *
 * `recordId`, `createdAt` and `updatedAt` live on the record envelope.
 */
export const NOTES_COLLECTION = 'notes'

export const NOTE_TITLE_MAX = 200
export const NOTE_CONTENT_MAX = 50_000

export interface NoteData {
  userId: string
  title: string
  content: string
  /** Stable key for seeded demo notes (empty for user notes); prevents duplicates. */
  demoKey?: string
}

const ownOnly = { read: 'own', create: true, update: 'own', delete: 'own' } as const

export const notesSchema: CollectionSchema = {
  name: NOTES_COLLECTION,
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'content', storage: 'text', interpretation: 'plain', default: '' },
    { name: 'demoKey', storage: 'text', interpretation: 'plain', default: '' },
  ],
  ownerField: 'userId',
  permissions: {
    member: ownOnly,
    admin: ownOnly,
  },
}
