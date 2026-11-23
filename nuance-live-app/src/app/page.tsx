"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useNuanceConversation } from "@nuancelabs/js-sdk/react";

type TranscriptLine = {
  speaker: "persona" | "user";
  text: string;
};

export default function CallPage() {
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [personaDelta, setPersonaDelta] = useState("");
  const [greeted, setGreeted] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const { state, error, conversation, videoRef, audioRef, start, end } =
    useNuanceConversation({
      token: async () => {
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ end_user_id: "demo-user" }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Token request failed (${res.status})`);
        }
        const data = await res.json();
        return data.token;
      },
    });

  // Listen for interface events (transcript)
  useEffect(() => {
    if (!conversation) return;

    const removeInterface = conversation.onInterfaceEvent((event) => {
      const type = event.type as string;

      if (type === "session.output_transcript.delta") {
        setPersonaDelta((prev) => prev + String(event.delta ?? ""));
      }

      if (
        type === "session.output_transcript.done" ||
        type === "session.output_audio.done"
      ) {
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

  // Send greeting once avatar is presented
  useEffect(() => {
    if (!conversation || greeted) return;

    const removeChange = conversation.onChange((event) => {
      if (event.type === "avatar-presented") {
        setGreeted(true);
        conversation.sendInterfaceEvent({
          type: "response.create",
          response: {
            instructions:
              "Greet the user warmly. Introduce yourself as Mira and ask what they'd like to learn about today.",
          },
        });
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
    start();
  }, [start]);

  const isIdle =
    state === "idle" || state === "disconnected" || state === "failed";
  const isConnecting = state === "connecting" || state === "queued";
  const isConnected = state === "connected";

  return (
    <main className="flex flex-col items-center min-h-screen bg-gray-950 text-white p-6">
      <h1 className="text-2xl font-bold mb-6">
        Ola Explains — AI Fluency Coach
      </h1>

      {/* Persona video */}
      <div className="relative w-full max-w-lg aspect-video bg-gray-900 rounded-xl overflow-hidden mb-4">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        <audio ref={audioRef} autoPlay />

        {/* Status overlay */}
        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-lg">Connecting to Mira...</span>
            </div>
          </div>
        )}
        {state === "disconnected" && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
            <span className="text-lg text-gray-400">Call ended</span>
          </div>
        )}
      </div>

      {/* Connection status */}
      {isConnected && (
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm text-green-400">Live</span>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm max-w-lg text-center">
          {error.message}
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
    </main>
  );
}
