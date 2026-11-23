import { NextResponse } from "next/server";
import { getUserNotes } from "@/lib/user-notes";
import { getLessonById } from "@/lib/roadmap";

const NUANCE_API_URL = "https://api.nuancelabs.ai/session-tokens";

export async function POST(request: Request) {
  const apiKey = process.env.NUANCE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server misconfigured: missing API key" },
      { status: 500 }
    );
  }

  let body: { end_user_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.end_user_id) {
    return NextResponse.json(
      { error: "end_user_id is required" },
      { status: 400 }
    );
  }

  // Load user notes and build memory section for the prompt
  const notes = await getUserNotes(body.end_user_id);
  const currentLesson = getLessonById(notes.current_lesson_id);
  const memoryLines: string[] = [];

  if (notes.last_call_at) {
    memoryLines.push(`This is a returning user. Last call: ${notes.last_call_at}.`);
  }
  if (currentLesson) {
    memoryLines.push(
      `They are on Week ${currentLesson.week}, lesson "${currentLesson.title}" (${currentLesson.lesson_id}).`
    );
  }
  if (notes.completed_lessons.length > 0) {
    memoryLines.push(
      `They have completed ${notes.completed_lessons.length} lesson(s): ${notes.completed_lessons.join(", ")}.`
    );
  }
  if (notes.facts.length > 0) {
    memoryLines.push("Notes from previous calls:");
    for (const fact of notes.facts.slice(-10)) {
      memoryLines.push(`- ${fact}`);
    }
  }

  const systemPrompt = [
    "You are Mira, a friendly and encouraging AI fluency coach.",
    "You help nontechnical professionals understand AI concepts week by week.",
    "You speak clearly and use simple analogies.",
    "",
    "Tool usage rules:",
    "- When the user asks what lesson or week they are on, use the get_current_lesson tool.",
    "- When the user says they finished a lesson or wants to mark it done, use the mark_lesson_done tool.",
    "- When the user asks you to look something up or search for information, use the search_web tool.",
    "- When you call a tool, say 'Checking now...' or 'Let me look that up...' while waiting. Do NOT say 'Done!' before the result comes back.",
    "",
    ...(memoryLines.length > 0
      ? ["What you know about this user:", ...memoryLines, ""]
      : []),
    "When greeting the user, introduce yourself as Mira. If they are a returning user, welcome them back and reference what you know about them. Otherwise, ask what they'd like to learn about today.",
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(NUANCE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personality: {
          system_prompt: systemPrompt,
          persona_id: "mira",
        },
        end_user_id: body.end_user_id,
        expressiveness: 1,
        interface_setup: {
          delegation: {
            type: "responses",
            responses: {
              model: "nuance",
              tools: [
                {
                  type: "function",
                  name: "get_current_lesson",
                  description:
                    "Returns the user's current lesson and week in the AI fluency roadmap.",
                },
                {
                  type: "function",
                  name: "mark_lesson_done",
                  description:
                    "Marks the user's current lesson as complete and advances them to the next one.",
                  parameters: {
                    type: "object",
                    properties: {
                      lesson_id: {
                        type: "string",
                        description: "The lesson identifier to mark as done.",
                      },
                    },
                    required: ["lesson_id"],
                  },
                },
                {
                  type: "function",
                  name: "search_web",
                  description:
                    "Searches the web for information. Returns up to 5 short text snippets.",
                  parameters: {
                    type: "object",
                    properties: {
                      query: {
                        type: "string",
                        description: "The search query.",
                      },
                    },
                    required: ["query"],
                  },
                },
              ],
            },
          },
          runtime_tools: {
            end_call: true,
            call_time: true,
          },
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: errorBody },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ token: data.token });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      return NextResponse.json(
        { error: "Nuance API timed out" },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "Failed to reach Nuance API" },
      { status: 502 }
    );
  }
}
