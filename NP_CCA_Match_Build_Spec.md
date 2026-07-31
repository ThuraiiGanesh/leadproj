# NP CCA Match — Build Spec

**Project:** LEAD LaunchPad — Campus Life theme (CCA Discovery)
**Platforms:** Web app (primary), Telegram bot (secondary, mirrors core flow)
**Purpose of this doc:** Hand this directly to Antigravity/Claude Code as the implementation spec.

---

## 1. User Types

### A. Student (primary user — this is the main demo flow)
Logs in, optionally takes a matching survey, browses CCAs sorted by match score, bookmarks/signs up for events, receives reminders.

### B. CCA Lead / Admin (secondary user — supporting flow only)
Logs in, posts events/updates for their CCA, views list of students who bookmarked/signed up.

> Note: Student flow must be fully polished. Admin flow only needs to be functional enough to close the loop (post event → student sees it).

---

## 2. Data Model

```
Student {
  id: string
  name: string
  np_student_id: string
  school: string
  survey_completed: boolean
  survey_answers: {
    interest_tags: string[]        // e.g. ["sports", "arts", "tech"]
    commitment_level: enum         // "low" | "medium" | "high"
    style: enum                    // "team" | "solo" | "mixed"
  }
  bookmarked_cca_ids: string[]
  signed_up_event_ids: string[]
}

CCA {
  id: string
  name: string
  category: string                 // sports | arts | uniformed | academic | etc.
  tags: string[]                   // for matching against student interest_tags
  commitment_level: enum           // "low" | "medium" | "high"
  style: enum                      // "team" | "solo" | "mixed"
  contact_info: string
  exco_list: string[]
  description: string
}

Event {
  id: string
  cca_id: string
  title: string
  datetime: datetime
  location: string
  capacity: number
  signup_count: number
}
```

---

## 3. Matching Algorithm (Analytics pillar)

Weighted score per CCA, computed only if `survey_completed = true`. If survey skipped, show unsorted/all CCAs with no score badges.

```
score(CCA) = (0.5 × interest_overlap) + (0.3 × commitment_fit) + (0.2 × style_fit)

interest_overlap = (number of matching tags between student.interest_tags and CCA.tags) 
                    / (total unique tags in student.interest_tags)

commitment_fit:
  - exact match (student.commitment_level == CCA.commitment_level) → 1.0
  - adjacent tier (e.g. medium vs high/low) → 0.5
  - opposite ends (low vs high) → 0.0

style_fit:
  - exact match → 1.0
  - one side is "mixed" → 0.5
  - mismatch → 0.0

Final score = normalize to 0–100
Sort CCA feed descending by score.
Show "Recommended" badge if score > 70.
```

---

## 4. Screens — Web App (Student Flow)

1. **Login** — NP student ID + password input → triggers mock 2FA
2. **2FA** — "A code has been sent to your Outlook" → code input field → verify → success
3. **Survey (optional)** — visible "Skip" button at all times. Questions: interest tags (multi-select), commitment level (single-select), style (single-select)
4. **CCA Feed** — card list, search bar, category filter, match score badge, bookmark icon per card
5. **CCA Detail** — full info (contact, exco, description), list of upcoming events, bookmark toggle
6. **Event Detail** — date/time/location/capacity, "Sign Up" button, "Remind Me" toggle
7. **Signup Confirmation** — success message + reminder confirmation
8. **My CCAs** — bookmarked CCAs + signed-up events + reminders list

## 5. Screens — Admin/CCA Lead Flow (lighter weight)

1. **Login** (can reuse same login/2FA pattern)
2. **My CCA Dashboard** — list of this CCA's events
3. **Create/Edit Event** — title, datetime, location, capacity
4. **Signed-up Students List** — simple table, name + student ID

## 6. Telegram Bot (mirrors student flow)

- `/start` → link/login flow (mock 2FA via a code sent as a message for demo purposes)
- `/browse` → shows top matched CCAs as inline-keyboard cards
- Inline buttons: Bookmark, View Events, Sign Up
- Bot pushes a reminder message X time before an event the student signed up for

---

## 7. LEAD Pillar Hooks (build these in deliberately, don't bolt on after)

- **Defence:** 2FA on login (control for unauthorized account access — asset: student account, threat: credential theft, CIA: Confidentiality). Also: admin/CCA leads should only see name + student ID of signups, not survey answers or password (control for data over-exposure).
- **Software Engineering (TDD RED):** Use **event signup** as the scenario.
  - Conditions: event not full (signup_count < capacity), student not already signed up, signup attempted before event datetime
  - PASS/FAIL rule: PASS only if all three conditions true
  - Test cases: valid signup (PASS), event full (FAIL), duplicate signup (FAIL), signup exactly at capacity-1 (PASS, boundary), event already passed (FAIL)
- **LegalTech:** Data collected — NP student ID, password (mocked), survey answers. Justify: needed only for identity verification and matching; not shared with CCA leads beyond name/ID. Note in journal: passwords not stored in plaintext even in prototype; survey data used only for scoring, not exposed to admin view.
- **Analytics:** Two discovery questions (e.g. "What info do students want most about a CCA?", "Does interest-tag matching feel more relevant than commitment-level matching?"), two evidence sources (e.g. quick poll among classmates, comparison of a few CCA info pages), one visual (bar chart of survey responses or a comparison table).

---

## 8. Build Priority (for your remaining time before Week 16 submission)

| Priority | Item |
|---|---|
| 1 — Must be flawless | Login/2FA (mock), survey (skippable), matched CCA feed, CCA detail, event signup |
| 2 — Should work | Bookmark, search/filter, reminders (can be simulated, doesn't need real push infra) |
| 3 — Functional is enough | Admin dashboard (post event + view signups) |

---

## 9. Notes for Antigravity / Claude Code

- Login 2FA can be fully mocked (no real email sending needed) — show a static/generated code on-screen for demo purposes.
- Reminders can be simulated with an in-app notification banner or a scheduled Telegram message — no real push notification service (e.g. FCM) required.
- Keep student and admin views in the same codebase but clearly separated by role, so the demo can show both without needing two separate builds.
- Use the matching formula in Section 3 exactly — this ties directly to the Analytics pillar writeup in the journal, so it needs to match what's demoed.
