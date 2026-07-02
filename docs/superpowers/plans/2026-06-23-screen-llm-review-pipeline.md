# Screen LLM Review Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a manual pipeline that captures the screen, sends it to the configured vision LLM for activity analysis, then sends that analysis to the configured review LLM for a short Focus Pet review.

**Architecture:** Reuse `src/screen-monitor.js` for screenshot analysis and `src/review-llm.js` for review generation. Wire the pipeline from `src/main.js` so manual UI sampling can attach the review result to the existing screen monitor response, while automatic interval sampling remains screen-analysis-only.

**Tech Stack:** Electron `desktopCapturer`, Node `fetch`, OpenAI-compatible chat completions payloads, Node test runner.

---

### Task 1: Add Screen Analysis Context To Review LLM Prompt

**Files:**
- Modify: `src/review-llm.js`
- Test: `test/core.test.js`

- [x] **Step 1: Write the failing test**

Add a test that calls `summarizeDailyReview()` with `screenAnalysis` and asserts the review prompt includes the screen activity, status, reason, confidence, suggestion, source, and time.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern "screen analysis"`

Expected: FAIL because `screenAnalysis` is currently ignored by `buildReviewPrompt()`.

- [x] **Step 3: Write minimal implementation**

Add a helper in `src/review-llm.js` that converts the normalized screen analysis into short prompt lines, then pass `screenAnalysis` through `buildReviewPrompt()` and `summarizeDailyReview()`.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern "screen analysis"`

Expected: PASS and the generated review prompt contains the LLM screen-analysis context.

### Task 2: Wire Manual Pipeline Through Main And Renderer

**Files:**
- Modify: `src/main.js`
- Modify: `src/renderer.js`
- Test: `test/core.test.js`

- [x] **Step 1: Write the failing wiring assertions**

Extend the existing screen-monitor wiring test to assert:
- `src/main.js` checks `options?.review`
- `src/main.js` calls `focus.getDailyReview({ screenAnalysis: result, fetchImpl: fetch })`
- `src/renderer.js` calls `sampleScreenMonitor({ manual: true, review: true })`
- UI handles `result.pipelineReview?.llm?.ok`

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern "screen monitor is wired"`

Expected: FAIL because the manual button currently requests only screen analysis.

- [x] **Step 3: Write minimal implementation**

In `src/main.js`, after successful manual screen analysis, call `focus.getDailyReview()` with `screenAnalysis` and attach the returned review to `result.pipelineReview`.

In `src/renderer.js`, make the test button call `sampleScreenMonitor({ manual: true, review: true })` and show the review LLM message when present.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern "screen monitor is wired"`

Expected: PASS.

### Task 3: Verify End-To-End Safety

**Files:**
- Modify: `docs/errorThing.md` only if an error occurs.

- [x] **Step 1: Run full automated tests**

Run: `npm test`

Expected: PASS.

- [x] **Step 2: Run syntax checks**

Run: `npm run check`

Expected: PASS.

- [x] **Step 3: Record encountered errors**

If any command fails during implementation, append a structured entry to `docs/errorThing.md` with the required AGENTS.md fields.
