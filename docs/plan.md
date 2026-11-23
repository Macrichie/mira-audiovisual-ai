# Nuance Live App - Implementation Plan

## Target: AI Fluency Roadmap / Ola Explains

A live AI coach that walks nontechnical professionals through each week of the AI fluency roadmap. Premium upsell for the Starter Checklist funnel.

**Nuance features used**: Memory pattern (which week they're on), `thinking.append` (which lesson is open), `mark_lesson_done` tool with `reply: false`.

---

## Phase 0: Platform Setup

- [ ] Sign up at platform.nuancelabs.ai
- [ ] Accept agreements and verify mobile number
- [ ] Create API key (`nk_...`)
- [ ] Test personas and prompts in the Playground (no code needed)
- [ ] Choose persona (`sam`, `sonia`, or `mira`) and dial in `expressiveness`

---

## Phase 1: Minimal Viable Call (Next.js skeleton)

**Goal**: One page, one button, one live conversation.

### 1.1 Project Scaffold
- [ ] `npx create-next-app@latest nuance-live-app --typescript --app`
- [ ] Install SDK: `npm install @nuancelabs/js-sdk`
- [ ] Add `NUANCE_API_KEY` to `.env.local` (never commit this)

### 1.2 Server Route -- Token Endpoint
- [ ] Create `app/api/session/route.ts`
- [ ] `POST` handler calls Nuance `POST /session-tokens` with:
  - `system_prompt` (name the persona, define its role as AI fluency coach)
  - `persona_id`
  - `expressiveness`
  - `delegation: "responses"`
  - `runtime_tools: ["end_call", "call_time"]`
  - `end_user_id` (from auth or query param)
- [ ] Return the `st_...` ticket to the client

### 1.3 Client Page -- Call UI
- [ ] Create `app/page.tsx` with a Start Call button
- [ ] Use `useNuanceConversation` hook from `@nuancelabs/js-sdk`
- [ ] On button click: fetch ticket from `/api/session`, then `conversation.connect()`
- [ ] On connect: send `response.create` to trigger persona greeting
- [ ] Show "Connecting..." state with retry handling
- [ ] Add End Call button that sends `session.close`
- [ ] Display live transcript using `session.output_transcript.delta` and `session.input_transcript.done`

---

## Phase 2: Tool Integration (`responses` delegation)

**Goal**: Persona can hand off work to your code.

### 2.1 Define Tools
- [ ] `mark_lesson_done` -- marks current lesson complete, `reply: false` (persona doesn't narrate the result)
- [ ] `get_current_lesson` -- returns which lesson/week the user is on
- [ ] `search_web` -- calls a search API, returns max 5 snippets, strips phone numbers

### 2.2 Wire Up Tool Handling
- [ ] `conversation.onToolCall(name, args)` -- route to the right handler
- [ ] `sendToolResult(result)` -- return data to persona
- [ ] Prompt the persona to say "Checking now..." rather than "Done!" (it speaks before the tool runs)

### 2.3 System Prompt Engineering
- [ ] Spell out exactly which requests the persona should hand off
- [ ] Define persona name, role, tone (friendly AI fluency coach)
- [ ] Include instructions for roadmap context awareness

---

## Phase 3: Memory Pattern

**Goal**: Persona remembers the user across calls.

### 3.1 User Notes Storage
- [ ] Create a data store (start with JSON file or simple DB) keyed by `end_user_id`
- [ ] Store: current week, completed lessons, user preferences, key facts

### 3.2 Inject Memory into Prompt
- [ ] On ticket creation, read user notes from storage
- [ ] Append notes to `system_prompt` (short, English, plain language)

### 3.3 Post-Call Transcript Processing
- [ ] After `session.close`, call `GET /conversation/{id}/transcript`
- [ ] Extract key facts and progress updates
- [ ] Update user notes in storage (summarize in your own words, keep short)

---

## Phase 4: Context Awareness

**Goal**: Persona knows what the user is looking at.

- [ ] Send `session.thinking.append` when user navigates to a lesson page (e.g., "User opened Week 3: Prompt Engineering")
- [ ] Send `session.floor.hold` when user is reading long content
- [ ] Send `session.output_audio.interrupt` if user navigates away mid-explanation

---

## Phase 5: Polish and Production Readiness

### 5.1 UX
- [ ] "Connecting..." loading state with retry on shared-capacity failures
- [ ] Graceful handling when call ends early (preview service)
- [ ] Transcript display panel (scrolling live captions)
- [ ] Visual indicator when persona is speaking vs. listening

### 5.2 Safety and Limits
- [ ] Always send `end_user_id` (abuse isolation)
- [ ] Create ticket only on Start button click, never on page load
- [ ] Strip phone numbers from all tool results
- [ ] Respect daily credit cap -- show user-friendly message when exhausted
- [ ] English-only content and prompts

### 5.3 Error Handling
- [ ] Ticket expiry (60s) -- re-fetch if user is slow to click
- [ ] Network drops -- detect and offer reconnect
- [ ] Nuance capacity limits -- queue or inform user

---

## Secondary Project Ideas (Future)

| Project | Delegation | Key Feature |
|---------|-----------|-------------|
| Kaia Lume / MadebyFaia (product guide) | `responses` | `persona_id`, `greenScreen` over branded background |
| Talk It Through (reflection partner) | `none` | `floor.hold` for contemplation pauses |
| Cloud/VMware lab study (quiz coach) | `responses` | `get_question` tool on own question bank |

### Not viable with Nuance Live
- **Leo & Gizmo** (ages 3-6) -- under-18 camera check conflict
- **NurtureRise / Tusla** -- young people + sensitive care excluded by safety rules

---

## Key Reference Links

- Platform: platform.nuancelabs.ai
- SDK: `@nuancelabs/js-sdk`
- Docs: Overview, API keys, Session setup, JS SDK, Events, Delegation, Prompting
