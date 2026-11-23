"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useNuanceConversation } from "@nuancelabs/js-sdk/react";
import { ApiError } from "@nuancelabs/js-sdk";
import LessonBrowser from "@/components/lesson-browser";
import type { Lesson } from "@/lib/roadmap";

type TranscriptLine = {
  speaker: "persona" | "user";
  text: string;
};

const END_USER_ID = "demo-user";

export default function CallPage() {
  const [mounted, setMounted] = useState(false);
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [personaDelta, setPersonaDelta] = useState("");
  const [greeted, setGreeted] = useState(false);
  const [endMessage, setEndMessage] = useState<string | null>(null);
  const [openLesson, setOpenLesson] = useState<Lesson | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [queueInfo, setQueueInfo] = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const { state, error, conversation, videoRef, audioRef, start, end } =
    useNuanceConversation({
      token: async () => {
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ end_user_id: END_USER_ID }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Token request failed (${res.status})`);
        }
        const data = await res.json();
        return data.token;
      },
    });

  // --- Context awareness: notify persona of lesson navigation ---
  const handleLessonOpen = useCallback(
    (lesson: Lesson) => {
      setOpenLesson(lesson);
      if (conversation && state === "connected") {
        // Tell persona what the user is looking at (quiet context)
        conversation.append(
          "thinking",
          `User opened Week ${lesson.week} lesson: "${lesson.title}". The lesson is about: ${lesson.summary.substring(0, 200)}`
        );
        // Hold the floor while the user reads
        conversation.sendInterfaceEvent({ type: "session.floor.hold" });
      }
    },
    [conversation, state]
  );

  const handleLessonClose = useCallback(() => {
    const wasOpen = openLesson;
    setOpenLesson(null);
    if (conversation && state === "connected" && wasOpen) {
      // Interrupt if persona was explaining something about the lesson
      conversation.sendInterfaceEvent({
        type: "session.output_audio.interrupt",
      });
      // Let persona know user navigated away
      conversation.append(
        "thinking",
        `User closed the lesson "${wasOpen.title}" and returned to the lesson list.`
      );
    }
  }, [conversation, state, openLesson]);

  // Handle tool calls from the persona
  useEffect(() => {
    if (!conversation) return;

    const removeToolHandler = conversation.onToolCall(async (call) => {
      let result: string;

      switch (call.name) {
        case "get_current_lesson": {
          const res = await fetch(
            `/api/user-notes?end_user_id=${encodeURIComponent(END_USER_ID)}`
          );
          result = await res.text();
          break;
        }

        case "mark_lesson_done": {
          const lessonId = call.arguments?.lesson_id ?? "unknown";
          const res = await fetch("/api/user-notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              end_user_id: END_USER_ID,
              lesson_id: lessonId,
            }),
          });
          result = await res.text();
          await conversation.sendToolResult(call.callId, result, {
            reply: false,
          });
          return;
        }

        case "search_web": {
          const query = String(call.arguments?.query ?? "");
          const stripPhones = (text: string) =>
            text.replace(/(\+?\d[\d\s\-().]{7,}\d)/g, "[phone removed]");
          // TODO: call a real search API in production
          result = stripPhones(
            JSON.stringify({
              snippets: [
                `AI (Artificial Intelligence) refers to computer systems that can perform tasks typically requiring human intelligence. Search query: "${query}"`,
                "Machine learning is a subset of AI where systems learn from data rather than being explicitly programmed.",
                "Common AI applications include virtual assistants, recommendation systems, and image recognition.",
              ],
            })
          );
          break;
        }

        default:
          result = JSON.stringify({ error: `Unknown tool: ${call.name}` });
      }

      await conversation.sendToolResult(call.callId, result);
    });

    return removeToolHandler;
  }, [conversation]);

  // Listen for interface events (transcript)
  useEffect(() => {
    if (!conversation) return;

    const removeInterface = conversation.onInterfaceEvent((event) => {
      const type = event.type as string;

      if (type === "session.output_transcript.delta") {
        setIsSpeaking(true);
        setPersonaDelta((prev) => prev + String(event.delta ?? ""));
      }

      if (
        type === "session.output_transcript.done" ||
        type === "session.output_audio.done"
      ) {
        setIsSpeaking(false);
        setPersonaDelta((prev) => {
          if (prev.trim()) {
            setTranscriptLines((lines) => [
              ...lines,
              { speaker: "persona", text: prev.trim() },
            ]);
          }
          return "";
        });
      }

      if (type === "session.input_transcript.done") {
        const text = String(event.transcript ?? "");
        if (text.trim()) {
          setTranscriptLines((lines) => [
            ...lines,
            { speaker: "user", text: text.trim() },
          ]);
        }
      }
    });

    return removeInterface;
  }, [conversation]);

  // Send greeting on avatar-presented, track unexpected disconnection
  useEffect(() => {
    if (!conversation) return;

    const removeChange = conversation.onChange((event) => {
      if (event.type === "queue-changed") {
        const pos = event.position;
        const wait = event.estimatedWaitSeconds;
        if (pos > 0 && wait != null) {
          setQueueInfo(`Position ${pos} · ~${Math.ceil(wait)}s`);
        } else if (pos > 0) {
          setQueueInfo(`Position ${pos}`);
        } else {
          setQueueInfo(null);
        }
      }

      if (event.type === "avatar-presented" && !greeted) {
        setGreeted(true);
        conversation.sendInterfaceEvent({
          type: "response.create",
          response: {
            instructions:
              "Greet the user warmly. Introduce yourself as Mira and ask what they'd like to learn about today.",
          },
        });
      }

      if (event.type === "session-ended") {
        const reason = event.reason;
        if (reason === "connection-lost") {
          setEndMessage("Connection lost. You can reconnect.");
        } else if (reason === "policy-violation") {
          setEndMessage("Session ended due to a policy violation.");
        } else if (reason === "age-check") {
          setEndMessage("Session ended: age verification required.");
        } else if (reason === "time-limit") {
          setEndMessage("Session time limit reached.");
        }

        // Post-call: save transcript notes for memory
        const convId = conversation.id;
        if (convId) {
          fetch("/api/transcript", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversation_id: convId,
              end_user_id: END_USER_ID,
            }),
          }).catch(() => {});
        }
      }
    });

    return removeChange;
  }, [conversation, greeted]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptLines, personaDelta]);

  // Reset state for new call
  const handleStart = useCallback(() => {
    setTranscriptLines([]);
    setPersonaDelta("");
    setGreeted(false);
    setEndMessage(null);
    setOpenLesson(null);
    setIsSpeaking(false);
    setQueueInfo(null);
    start();
  }, [start]);

  const isIdle =
    state === "idle" || state === "disconnected" || state === "failed";
  const isConnecting = state === "connecting" || state === "queued";
  const isConnected = state === "connected";

  const errorMessage = error
    ? error instanceof ApiError && error.status === 429
      ? `Daily credits exhausted.${error.renewsAt ? ` Renews at ${new Date(error.renewsAt).toLocaleTimeString()}.` : ""}`
      : error instanceof ApiError && error.status === 503
        ? "Nuance is busy right now. Please try again in a moment."
        : error.message
    : null;

  if (!mounted) {
    return (
      <main className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-6xl mx-auto p-6">
          <h1 className="text-2xl font-bold mb-6">
            Ola Explains — AI Fluency Coach
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">
          Ola Explains — AI Fluency Coach
        </h1>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Lesson browser */}
          <aside className="lg:w-80 shrink-0">
            <div className="bg-gray-900 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-400 mb-3">
                AI Fluency Roadmap
              </h2>
              <LessonBrowser
                onLessonOpen={handleLessonOpen}
                onLessonClose={handleLessonClose}
              />
            </div>
          </aside>

          {/* Right: Call area */}
          <div className="flex-1 flex flex-col items-center">
            {/* Persona video */}
            <div className="relative w-full max-w-lg aspect-video bg-gray-900 rounded-xl overflow-hidden mb-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <audio ref={audioRef} autoPlay />

              {/* Idle placeholder */}
              {state === "idle" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
                  <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-3">
                    <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
                    </svg>
                  </div>
                  <span className="text-gray-500 text-sm">Click Start Call to talk with Mira</span>
                </div>
              )}

              {/* Connecting / queued */}
              {isConnecting && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-4 h-4 rounded-full bg-yellow-400 animate-pulse" />
                    <span className="text-lg">
                      {state === "queued" ? "Waiting for a slot..." : "Connecting to Mira..."}
                    </span>
                  </div>
                  {queueInfo && (
                    <span className="text-sm text-gray-400">{queueInfo}</span>
                  )}
                </div>
              )}

              {/* Disconnected */}
              {state === "disconnected" && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                  <span className="text-lg text-gray-400">
                    {endMessage ?? "Call ended"}
                  </span>
                </div>
              )}
            </div>

            {/* Connection status */}
            {isConnected && (
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm text-green-400">Live</span>
                </div>
                <div className="h-4 w-px bg-gray-700" />
                <div className="flex items-center gap-1.5">
                  {isSpeaking ? (
                    <>
                      <div className="flex items-end gap-0.5 h-3">
                        <div className="w-0.5 bg-blue-400 rounded-full animate-[pulse_0.5s_ease-in-out_infinite]" style={{ height: "60%" }} />
                        <div className="w-0.5 bg-blue-400 rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.15s]" style={{ height: "100%" }} />
                        <div className="w-0.5 bg-blue-400 rounded-full animate-[pulse_0.5s_ease-in-out_infinite_0.3s]" style={{ height: "40%" }} />
                      </div>
                      <span className="text-xs text-blue-400">Mira speaking</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-gray-600" />
                      <span className="text-xs text-gray-500">Listening</span>
                    </>
                  )}
                </div>
                {openLesson && (
                  <>
                    <div className="h-4 w-px bg-gray-700" />
                    <span className="text-xs text-gray-500 truncate max-w-48">
                      Viewing: {openLesson.title}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Error display */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm max-w-lg text-center">
                {errorMessage}
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-4 mb-6">
              {isIdle && (
                <button
                  onClick={handleStart}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  {state === "disconnected" || state === "failed"
                    ? "Start New Call"
                    : "Start Call"}
                </button>
              )}
              {(isConnecting || isConnected) && (
                <button
                  onClick={() => end()}
                  className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  End Call
                </button>
              )}
            </div>

            {/* Transcript */}
            {(transcriptLines.length > 0 || personaDelta) && (
              <div className="w-full max-w-lg bg-gray-900 rounded-xl p-4 max-h-64 overflow-y-auto">
                <h2 className="text-sm font-semibold text-gray-400 mb-3">
                  Transcript
                </h2>
                <div className="space-y-2">
                  {transcriptLines.map((line, i) => (
                    <div key={i} className="text-sm">
                      <span
                        className={
                          line.speaker === "persona"
                            ? "text-blue-400 font-medium"
                            : "text-green-400 font-medium"
                        }
                      >
                        {line.speaker === "persona" ? "Mira" : "You"}:
                      </span>{" "}
                      <span className="text-gray-200">{line.text}</span>
                    </div>
                  ))}
                  {personaDelta && (
                    <div className="text-sm">
                      <span className="text-blue-400 font-medium">Mira:</span>{" "}
                      <span className="text-gray-300">{personaDelta}</span>
                      <span className="animate-pulse">|</span>
                    </div>
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
