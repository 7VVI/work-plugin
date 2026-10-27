import { onBeforeUnmount, onMounted, ref } from 'vue';
import { liveQuery } from 'dexie';
import { db } from '@shared/db/schema';

export function useNoteCounts() {
  const noteBooks = ref(0);
  const notes = ref(0);
  let subscription: { unsubscribe: () => void } | null = null;

  onMounted(() => {
    subscription = liveQuery(async () => ({
      noteBooks: await db.noteBooks.count(),
      notes: await db.notes.count(),
    })).subscribe({
      next: value => {
        noteBooks.value = value.noteBooks;
        notes.value = value.notes;
      },
      error: () => {},
    });
  });

  onBeforeUnmount(() => {
    subscription?.unsubscribe();
    subscription = null;
  });

  return { noteBooks, notes };
}
