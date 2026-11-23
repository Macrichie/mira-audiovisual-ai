import { NextResponse } from "next/server";

const NUANCE_API_URL = "https://api.nuancelabs.ai/v1/session-tokens";

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
          system_prompt:
            "You are Mira, a friendly and encouraging AI fluency coach. You help nontechnical professionals understand AI concepts week by week. You speak clearly and use simple analogies. When greeting the user, introduce yourself as Mira and ask what they'd like to learn about today.",
          persona_id: "mira",
        },
        end_user_id: body.end_user_id,
        expressiveness: 1,
        interface_setup: {
          delegation: {
            type: "responses",
            responses: {
              model: "nuance",
              tools: [],
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
