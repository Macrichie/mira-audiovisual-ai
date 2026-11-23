import { NextResponse } from "next/server";
import { getUserNotes, saveUserNotes } from "@/lib/user-notes";

const NUANCE_API_URL = "https://api.nuancelabs.ai/v1";

export async function POST(request: Request) {
  const apiKey = process.env.NUANCE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  let body: { conversation_id?: string; end_user_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.conversation_id || !body.end_user_id) {
    return NextResponse.json(
      { error: "conversation_id and end_user_id are required" },
      { status: 400 }
    );
  }

  // Fetch transcript from Nuance API
  try {
    const res = await fetch(
      `${NUANCE_API_URL}/conversation/${body.conversation_id}/transcript`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );

    if (!res.ok) {
      // Transcript might not be available yet or conversation was too short
      const notes = await getUserNotes(body.end_user_id);
      notes.last_call_at = new Date().toISOString();
      await saveUserNotes(body.end_user_id, notes);
      return NextResponse.json({ updated: true, facts_added: 0 });
    }

    const transcript = await res.json();

    // Extract key facts from the transcript
    const facts = extractFacts(transcript);

    const notes = await getUserNotes(body.end_user_id);
    notes.last_call_at = new Date().toISOString();

    // Keep only the latest 20 facts to keep the prompt short
    for (const fact of facts) {
      if (!notes.facts.includes(fact)) {
        notes.facts.push(fact);
      }
    }
    if (notes.facts.length > 20) {
      notes.facts = notes.facts.slice(-20);
    }

    await saveUserNotes(body.end_user_id, notes);

    return NextResponse.json({ updated: true, facts_added: facts.length });
  } catch {
    // Even if transcript fetch fails, update the last_call_at
    const notes = await getUserNotes(body.end_user_id);
    notes.last_call_at = new Date().toISOString();
    await saveUserNotes(body.end_user_id, notes);
    return NextResponse.json({ updated: true, facts_added: 0 });
  }
}

function extractFacts(transcript: unknown): string[] {
  const facts: string[] = [];

  // The transcript API returns an array of entries with role and content
  if (!Array.isArray(transcript)) return facts;

  const userMessages: string[] = [];
  for (const entry of transcript) {
    if (
      typeof entry === "object" &&
      entry !== null &&
      "role" in entry &&
      "content" in entry
    ) {
      const role = (entry as { role: string }).role;
      const content = String((entry as { content: string }).content);
      if (role === "user" && content.length > 10) {
        userMessages.push(content);
      }
    }
  }

  // Summarize what the user talked about (keep it short and in English)
  if (userMessages.length > 0) {
    // Take the first few substantive things the user said
    for (const msg of userMessages.slice(0, 5)) {
      const shortened =
        msg.length > 100 ? msg.substring(0, 100) + "..." : msg;
      facts.push(`User said: "${shortened}"`);
    }
  }

  return facts;
}
