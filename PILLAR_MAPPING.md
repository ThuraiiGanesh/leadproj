# LEAD Project — Viva Evaluation Reference: Pillar Architecture Mapping

> **Note for Assessors / Examiners:**  
> This internal document maps each requirement of the **LEAD Project Evaluation Rubric** to its exact code implementation and system architecture. In accordance with user-experience guidelines, pillar branding labels have been removed from the student-facing UI, but all underlying technical implementations remain fully operational.

---

## 1. 📊 Analytics Pillar — Weighted Matching Engine & Data Intelligence

### Architectural Overview
The Analytics pillar powers personalized CCA recommendations using a multi-factor weighted scoring algorithm that evaluates student interests, commitment availability, and teamwork preferences.

### Codebase Implementations:
- **Weighted Scoring Algorithm**: Defined in `server.js` (`calculateMatchScore()`, lines 120–160):
  - **Interest Tag Overlap (Weight: 50%)**: Calculates Jaccard similarity between student-selected interest tags and CCA tags.
  - **Commitment Fit (Weight: 30%)**: Matches student weekly availability (Low/Medium/High) to CCA training frequency.
  - **Teamwork / Activity Style (Weight: 20%)**: Aligns preferred work style (`team`, `solo`, `mixed`) with CCA operational structure.
- **Dynamic Sorting & Recommendation Threshold**:
  - Scores above **70%** trigger the `"TOP MATCH"` recommendation status.
  - Endpoint `GET /api/ccas` (`server.js`) dynamically computes and sorts CCAs by match score post-survey.
- **Frontend Survey Component**: `public/app.js` (`submitSurvey()`, `openSurveyModal()`).

---

## 2. 🛡️ Defense & Auth Pillar — 2FA Security Gate & PDPA Confidentiality

### Architectural Overview
The Defense pillar guarantees student identity verification via mandatory 2FA OTP security and strictly protects student privacy through PDPA data minimization controls.

### Codebase Implementations:
- **Mandatory 2FA Gate**:
  - `server.js` (`POST /api/auth/send-2fa`, `POST /api/auth/verify-2fa`): Generates 6-digit cryptographic OTP codes and dispatches them directly via Gmail SMTP (`nodemailer`) to student `@connect.np.edu.sg` Outlook inboxes.
  - Microsoft 365 SSO simulated fallback (`POST /api/auth/microsoft/simulated`).
- **PDPA Data Minimization & Privacy Shield**:
  - Survey responses, interest tags, and matching scores are **strictly isolated** to the individual student session and are **never** exposed to CCA EXCO leads or third-party administrators.
  - EXCO roster views (`GET /api/admin/events/:id/signups`) restrict visible student data exclusively to Student Name and NP Student ID for event logistics.

---

## 3. 🔑 Leadership Pillar — EXCO Lead Management & Scoped RBAC

### Architectural Overview
The Leadership pillar provides verified student leaders (EXCO members) with a scoped administrative portal to publish events, track signups, and manage CCA rosters.

### Codebase Implementations:
- **Role-Based Access Control (RBAC)**:
  - Defined in `server.js` (`getManagedCcas()`) and enforced in `public/app.js` (`switchRole()`, `setupAdminCcaSelector()`).
  - Access to the Admin Dashboard is restricted exclusively to authenticated EXCO accounts (e.g. `s10275803@connect.np.edu.sg` for NP Ambassadors, NP Student Council, and Badminton).
- **Scoped Event Publishing & Management**:
  - Endpoint `POST /api/admin/events/create` allows EXCO leads to publish new events with custom capacity limits, dates, venues, and registration deadlines.
  - Newly created events instantly broadcast to the live **Upcoming Campus Events** student feed.

---

## 4. ⚡ Software Engineering Pillar — Automated TDD Test Suite & Schedule Clash Prevention

### Architectural Overview
The Software Engineering pillar enforces software quality standards through automated Test-Driven Development (TDD) boundary validation and real-time schedule conflict prevention.

### Codebase Implementations:
- **Automated TDD Test Suite**:
  - Endpoint `GET /api/tdd/run` in `server.js` executes 5 automated boundary tests verifying:
    1. Event capacity enforcement (rejecting signups when `signup_count >= capacity`).
    2. Expiry date validation (rejecting signups for past events).
    3. Duplicate signup prevention.
    4. Registration deadline enforcement.
    5. Valid signup processing.
- **Schedule Clash Detection Engine**:
  - Implemented in `public/app.js` (`signUpForEvent()`, `quickSignupEvent()`).
  - Compares event datetime against student availability (Q4 of survey) and existing registered events/CCAs, triggering a warning prompt (`⚠️ Schedule Clash Warning`) when a conflict is detected.

---

## 📁 Summary of File Mappings
| LEAD Pillar | Primary Server File | Primary Frontend File | Key Function / Endpoint |
|---|---|---|---|
| **Analytics** | `server.js` | `public/app.js` | `calculateMatchScore()`, `GET /api/ccas` |
| **Defense & Auth** | `server.js` | `public/app.js` | `/api/auth/send-2fa`, `/api/auth/verify-2fa` |
| **Leadership** | `server.js` | `public/app.js` | `getManagedCcas()`, `/api/admin/events/create` |
| **Software Engineering**| `server.js` | `public/app.js` | `/api/tdd/run`, `signUpForEvent()` clash detection |
