import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { ROADMAP } from "./roadmap";

const DATA_DIR = join(process.cwd(), ".data");
const NOTES_FILE = join(DATA_DIR, "user-notes.json");

export type UserNotes = {
  current_lesson_id: string;
  completed_lessons: string[];
  facts: string[];
  last_call_at: string | null;
};

type NotesStore = Record<string, UserNotes>;

function defaultNotes(): UserNotes {
  return {
    current_lesson_id: ROADMAP[0].lesson_id,
    completed_lessons: [],
    facts: [],
    last_call_at: null,
  };
}

async function readStore(): Promise<NotesStore> {
  try {
    const raw = await readFile(NOTES_FILE, "utf-8");
    return JSON.parse(raw) as NotesStore;
  } catch {
    return {};
  }
}

async function writeStore(store: NotesStore): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(NOTES_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export async function getUserNotes(endUserId: string): Promise<UserNotes> {
  const store = await readStore();
  return store[endUserId] ?? defaultNotes();
}

export async function saveUserNotes(
  endUserId: string,
  notes: UserNotes
): Promise<void> {
  const store = await readStore();
  store[endUserId] = notes;
  await writeStore(store);
}
