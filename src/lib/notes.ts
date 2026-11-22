/** Data access for the notes collection (reactive, RBAC-scoped by the DO). */
import { useQuery, useMutations } from 'deepspace'
import { NOTES_COLLECTION, type NoteData } from '../schemas/notes-schema'

export type { NoteData }

/** The caller's notes, most recently updated first. The server only ever sends the caller's own rows. */
export function useNotes() {
  return useQuery<NoteData>(NOTES_COLLECTION, { orderBy: 'updatedAt', orderDir: 'desc' })
}

export function useNoteMutations() {
  return useMutations<NoteData>(NOTES_COLLECTION)
}
