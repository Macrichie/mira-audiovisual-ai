# Nuance Live - Real-Time AI Persona App

## Project Overview

A Next.js application that integrates with **Nuance Live** to provide a live AI persona (voice + video) that can converse with users in real time. The primary use case is the **AI Fluency Roadmap / Ola Explains** tutor -- a live AI coach that walks nontechnical professionals through a weekly AI fluency roadmap.

## Architecture

- **Framework**: Next.js (App Router)
- **Frontend**: React with `@nuancelabs/js-sdk` (`useNuanceConversation` hook)
- **Backend**: Next.js API routes (server-side only -- API key never touches the client)
- **Nuance Live API**: REST + real-time JSON events over `nuance_live` topic

### Call Flow (3 players: Server, Page, Nuance)

1. Server holds API key (`nk_...`), calls `POST /session-tokens` to get a one-time ticket (`st_...`, valid 60s)
2. Page receives the ticket, user clicks Start, `conversation.connect()` joins the room
3. Persona does NOT speak first -- send `response.create` to trigger greeting
4. Voice, video, and JSON events flow on the `nuance_live` topic
5. `session.close` ends the call

### Delegation Modes

| Mode | Use |
|------|-----|
| `client` (default) | Simple app actions; page handles hand-offs |
| `responses` | Backend AI picks tools; page runs them and returns results. **Use this for most real features.** |
| `none` | Pure conversation, no hand-offs |

This project uses **`responses`** delegation for tool calls (e.g., `mark_lesson_done`, `search_web`).

## Key Events

| Direction | Event | Purpose |
|-----------|-------|---------|
| Receive | `session.output_transcript.delta` | Persona's words as it speaks |
| Receive | `session.input_transcript.done` | User's settled words |
| Receive | `session.output_audio.done` | Persona finished speaking |
| Send | `session.thinking.append` | Inject silent context (e.g., which lesson is open) |
| Send | `session.output_audio.interrupt` | Stop persona mid-speech |
| Send | `session.floor.hold` | Keep persona quiet while user reads |
| Send | `session.close` | Hang up |

## Session Token Parameters

When creating a ticket via `POST /session-tokens`, set:

- `system_prompt` -- persona identity and instructions (must include a name)
- `persona_id` -- `sam`, `sonia`, or `mira`
- `expressiveness` -- 0 to 2
- `delegation` -- `client`, `responses`, or `none`
- `runtime_tools` -- e.g., `end_call`, `call_time`
- `end_user_id` -- always send this (abuse isolation)

## Patterns to Implement

### Memory Pattern
- Save notes per user keyed by `end_user_id`
- Inject notes into `system_prompt` on next ticket
- After each call: `GET /conversation/{id}/transcript`, update notes (short, English, your own words)

### Web Search Pattern
- Built-in search is OFF for API users
- Provide a custom `search_web` tool via `responses` delegation
- Return max 5 short snippets; **strip phone numbers** (policy violation risk)

## Hard Rules / Constraints

- **English only** -- non-English prompts are refused
- **No advice personas** -- no medical, mental health, legal, financial, political, crypto, or religious guidance; no "I am human" claims
- **Under-18 check** -- call ends if camera shows only minors with no adult
- **Plan limits** -- daily credits, concurrent calls, calls/hour caps
- **Create ticket on user click**, not on page load (preserves credits)
- **Preview service** -- shared capacity; build retry handling and a "connecting..." state
- **Tool results** -- never include phone numbers

## SDK

- Package: `@nuancelabs/js-sdk`
- Hook: `useNuanceConversation`
- Tool handling: `conversation.onToolCall(...)` + `sendToolResult(...)`

## Platform

- API key management: platform.nuancelabs.ai
- Playground available for testing personas/prompts without code
