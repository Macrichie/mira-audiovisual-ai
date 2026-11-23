import { NextResponse } from "next/server";
import { getUserNotes, saveUserNotes } from "@/lib/user-notes";
import { getLessonById, getNextLesson } from "@/lib/roadmap";

// GET: fetch current lesson info for a user
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const endUserId = searchParams.get("end_user_id");

  if (!endUserId) {
    return NextResponse.json(
      { error: "end_user_id is required" },
      { status: 400 }
    );
  }

  const notes = await getUserNotes(endUserId);
  const lesson = getLessonById(notes.current_lesson_id);

  return NextResponse.json({
    week: lesson?.week ?? 1,
    lesson_id: notes.current_lesson_id,
    title: lesson?.title ?? "Unknown lesson",
    completed_count: notes.completed_lessons.length,
    status: "in_progress",
  });
}

// POST: mark a lesson done
export async function POST(request: Request) {
  let body: { end_user_id?: string; lesson_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.end_user_id || !body.lesson_id) {
    return NextResponse.json(
      { error: "end_user_id and lesson_id are required" },
      { status: 400 }
    );
  }

  const notes = await getUserNotes(body.end_user_id);

  if (!notes.completed_lessons.includes(body.lesson_id)) {
    notes.completed_lessons.push(body.lesson_id);
  }

  const next = getNextLesson(body.lesson_id);
  if (next) {
    notes.current_lesson_id = next.lesson_id;
  }

  await saveUserNotes(body.end_user_id, notes);

  return NextResponse.json({
    marked: true,
    lesson_id: body.lesson_id,
    next_lesson: next
      ? { lesson_id: next.lesson_id, title: next.title }
      : null,
  });
}
