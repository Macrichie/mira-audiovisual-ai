# Phase 1: Minimal Viable Call — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js app where a user clicks Start, gets a live voice+video conversation with the Mira persona via Nuance Live, sees a live transcript, and can end the call.

**Architecture:** Next.js App Router with one API route (`/api/session`) that exchanges the server-side API key for a one-time session ticket, and one client page that uses the `@nuancelabs/js-sdk` hook to connect and manage the call. The API key never leaves the server.

**Tech Stack:** Next.js 15 (App Router), TypeScript, React 19, `@nuancelabs/js-sdk`

**Spec:** `docs/plan.md` (Phase 1) and `CLAUDE.md`

## Global Constraints

- API key (`nk_...`) stays server-side only — never sent to the client
- Session ticket (`st_...`) is valid for 60 seconds, one use only
- Ticket creation happens on user click, never on page load
- Persona does not speak first — `response.create` must be sent after connect
- `end_user_id` must always be sent (abuse isolation)
- English-only prompts
- Preview service — handle capacity rejections gracefully

## Review Focus

1. **API key leakage** — the `nk_...` key must not appear in any client bundle, response body, or log visible to the browser. Expect: key only in server-side `process.env` and the outbound fetch to Nuance.
2. **Ticket requested on page load** — if the token endpoint is called before the user clicks Start, credits are wasted. Expect: fetch to `/api/session` only fires inside the click handler.
3. **Missing `end_user_id`** — omitting it means one abusive user can get the whole account paused. Expect: the API route requires it and rejects requests without it.
4. **No greeting sent after connect** — persona stays silent if `response.create` is never sent. Expect: greeting fires once on successful connection.
5. **Audio blocked by browser** — `conversation.connect()` must be called from a user-initiated click event, not programmatically. Expect: connect is in the button's onClick handler chain.

---

### Task 1: Scaffold Next.js Project and Install SDK

**Files:**
- Create: `nuance-live-app/` (via `create-next-app`)
- Create: `nuance-live-app/.env.local`
- Create: `nuance-live-app/.env.example`

**Interfaces:**
- Consumes: nothing
- Produces: a runnable Next.js app with `@nuancelabs/js-sdk` installed, env var `NUANCE_API_KEY` available server-side

- [ ] **Step 1: Create Next.js app**

Run: `npx create-next-app@latest nuance-live-app --typescript --app --tailwind --eslint --src-dir --no-import-alias --use-npm`

- [ ] **Step 2: Install Nuance SDK**

Run: `cd nuance-live-app && npm install @nuancelabs/js-sdk`

- [ ] **Step 3: Create `.env.example`**

```
NUANCE_API_KEY=nk_your_key_here
```

- [ ] **Step 4: Create `.env.local`**

```
NUANCE_API_KEY=nk_your_key_here
```

- [ ] **Step 5: Add `.env.local` to `.gitignore`**

Verify `.env.local` is already in the default Next.js `.gitignore`. If not, add it.

- [ ] **Step 6: Verify the app starts**

Run: `cd nuance-live-app && npm run dev`
Expected: dev server starts on localhost:3000 without errors.

- [ ] **Step 7: Commit**

```bash
git init && git add -A && git commit -m "chore: scaffold Next.js app with Nuance SDK"
```

---

### Task 2: Session Token API Route

**Files:**
- Create: `nuance-live-app/src/app/api/session/route.ts`

**Interfaces:**
- Consumes: `process.env.NUANCE_API_KEY`
- Produces: `POST /api/session` — accepts `{ end_user_id: string }`, returns `{ token: string }` or `{ error: string }` with appropriate status codes

- [ ] **Step 1: Create `src/app/api/session/route.ts`**

The POST handler:
1. Read `NUANCE_API_KEY` from `process.env`. Return 500 if missing.
2. Parse `end_user_id` from the request JSON body. Return 400 if missing.
3. `fetch` Nuance API at `https://api.nuancelabs.ai/v1/session-tokens` with:
   - Method: `POST`
   - Headers: `Authorization: Bearer ${apiKey}`, `Content-Type: application/json`
   - Body:
     ```json
     {
       "system_prompt": "You are Mira, a friendly and encouraging AI fluency coach. You help nontechnical professionals understand AI concepts week by week. You speak clearly and use simple analogies. When greeting the user, introduce yourself as Mira and ask what they'd like to learn about today.",
       "persona_id": "mira",
       "expressiveness": 1,
       "delegation": "responses",
       "runtime_tools": ["end_call", "call_time"],
       "end_user_id": endUserId
     }
     ```
4. If the Nuance response is not ok, return its status and error body.
5. Extract the session token from the Nuance response and return `{ token }` with status 200.

- [ ] **Step 2: Test manually with curl**

Run:
```bash
curl -X POST http://localhost:3000/api/session \
  -H "Content-Type: application/json" \
  -d '{"end_user_id": "test-user-1"}'
```
Expected: 200 with `{ "token": "st_..." }` if key is valid, or a clear error if not.

- [ ] **Step 3: Verify missing `end_user_id` returns 400**

Run:
```bash
curl -X POST http://localhost:3000/api/session \
  -H "Content-Type: application/json" \
  -d '{}'
```
Expected: 400 with `{ "error": "end_user_id is required" }`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/session/route.ts && git commit -m "feat: add session token API route"
```

---

### Task 3: Call Page — Connection and Lifecycle

**Files:**
- Create: `nuance-live-app/src/app/page.tsx`
- Create: `nuance-live-app/src/app/globals.css` (modify existing — minimal call UI styles)

**Interfaces:**
- Consumes: `POST /api/session` → `{ token: string }` (from Task 2), `useNuanceConversation` hook from `@nuancelabs/js-sdk`
- Produces: a page at `/` with Start Call, End Call, live transcript display, and connection states

- [ ] **Step 1: Create the page component in `src/app/page.tsx`**

Mark as `"use client"`. The component manages these states:
- `status`: `"idle"` | `"connecting"` | `"connected"` | `"error"` | `"ended"`
- `transcriptLines`: array of `{ speaker: "persona" | "user", text: string }`
- `error`: string | null

Use the `useNuanceConversation` hook from `@nuancelabs/js-sdk`.

**Start Call button (visible when idle or error or ended):**
1. Set status to `"connecting"`.
2. Fetch `POST /api/session` with `{ end_user_id: "demo-user" }` (hardcoded for Phase 1).
3. If fetch fails or returns error, set status to `"error"` with the message, and allow retry.
4. Call `conversation.connect(token)` with the returned ticket.
5. On successful connect, set status to `"connected"`.
6. Send `response.create` with instruction `"Greet the user warmly. Introduce yourself as Mira and ask what they'd like to learn about today."`.

**Event listeners (set up in `useEffect` or via the hook's API):**
- `session.output_transcript.delta` — append/update the current persona line in `transcriptLines`.
- `session.input_transcript.done` — append a finalized user line to `transcriptLines`.
- `session.output_audio.done` — finalize the current persona line.
- Connection error/close — set status to `"ended"` or `"error"`.

**End Call button (visible when connected):**
- Send `session.close` event.
- Set status to `"ended"`.

- [ ] **Step 2: Build the UI layout**

Simple centered layout:
- Header: "Ola Explains — AI Fluency Coach"
- Persona video area (the SDK renders this — provide a container div with a ref or id)
- Status indicator showing current `status` with appropriate messaging:
  - `idle`: "Ready to start"
  - `connecting`: "Connecting to Mira..."
  - `connected`: green dot + "Live"
  - `error`: red message + "Try Again" button
  - `ended`: "Call ended" + "Start New Call" button
- Transcript panel: scrollable div showing `transcriptLines`, auto-scrolls to bottom
- Start/End Call buttons styled distinctly

- [ ] **Step 3: Update `globals.css`**

Keep Tailwind defaults. Add only minimal custom styles if needed for the transcript scroll container.

- [ ] **Step 4: Test manually in browser**

Run: `npm run dev`, open `http://localhost:3000`
Expected:
1. Page loads showing "Ready to start" with a Start Call button.
2. Clicking Start shows "Connecting to Mira...".
3. If API key is valid: persona video appears, Mira greets the user, transcript updates live.
4. Clicking End Call disconnects and shows "Call ended".
5. If API key is invalid or Nuance is unavailable: error state shows with retry option.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/globals.css && git commit -m "feat: add call page with live transcript"
```

---

### Task 4: Error Handling and Retry

**Files:**
- Modify: `nuance-live-app/src/app/page.tsx`
- Modify: `nuance-live-app/src/app/api/session/route.ts`

**Interfaces:**
- Consumes: same as Task 3
- Produces: resilient connection flow handling preview-service failures

- [ ] **Step 1: Add retry logic to the page**

In the Start Call flow, if the token fetch or `conversation.connect()` fails:
- If the error suggests capacity limits (503, "turned away"), show "Nuance is busy — retrying..." and auto-retry after 3 seconds, up to 3 attempts.
- After max retries, show the error with a manual "Try Again" button.
- If the error is a 400 or 401, don't retry — show the error directly.

- [ ] **Step 2: Handle ticket expiry**

If more than 50 seconds pass between fetching the token and calling `connect()` (unlikely but possible on slow networks), re-fetch a fresh token before connecting.

- [ ] **Step 3: Handle unexpected disconnection**

Listen for disconnect/error events from the SDK. When the call ends unexpectedly:
- Set status to `"ended"` with message "Call ended unexpectedly".
- Show a "Reconnect" button that starts a fresh call.

- [ ] **Step 4: Add timeout to the API route**

In `route.ts`, add an `AbortController` with a 10-second timeout on the fetch to Nuance. If it times out, return 504 with `{ "error": "Nuance API timed out" }`.

- [ ] **Step 5: Test error states manually**

- Remove the API key from `.env.local` → expect 500 error shown on page.
- Set an invalid key → expect 401 error shown on page.
- Verify retry UI appears and works for connection failures.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/api/session/route.ts && git commit -m "feat: add retry handling and error states"
```
