# NP CCA Match (LEAD LaunchPad) — Complete Project Handoff & Chat Context

This document summarizes the full history, architecture, and current state of the **NP CCA Match** project for Claude or any AI coding assistant.

---

## 1. Project Overview & Repository
- **Project Name:** NP CCA Match — LEAD LaunchPad (Campus Life Theme)
- **GitHub Repository:** [https://github.com/ThuraiiGanesh/leadproj](https://github.com/ThuraiiGanesh/leadproj)
- **Live Vercel Deployment:** [https://leadproj.vercel.app](https://leadproj.vercel.app)
- **Tech Stack:** Node.js, Express, HTML/CSS/JS (Vanilla), Supabase Auth, Nodemailer (Gmail SMTP), Vercel Serverless.

---

## 2. Key Architecture & File Structure
```
lead/
├── .env                  # Local env vars (Supabase URL/Key, Gmail SMTP credentials)
├── .env.example          # Environment variable template
├── package.json          # Express, cors, nodemailer, dotenv, @supabase/supabase-js
├── server.js             # Main Express backend & Vercel serverless entry point
├── vercel.json           # Vercel routing rules (/api/* -> server.js, /* -> public/)
├── data/                 # Datasets & mock state
│   ├── cca_data.js       # Initial CCA dataset module
│   ├── ccas.json         # Master list of CCAs and EXCO members
│   └── events.json       # Master list of CCA events and student signups
└── public/               # Frontend assets
    ├── index.html        # Single-page web application UI
    ├── app.js            # Frontend logic, survey matching, 2FA modals, role switcher
    └── styles.css        # Modern dark-mode styling system
```

---

## 3. Major Features & Work Completed in This Session

### A. 2FA Authentication & Email Delivery (Fixed & Verified)
- **Problem Faced:** Built-in Supabase Auth free tier has a 2 email/hour rate limit, and Resend free tier restricts delivery strictly to the registered account owner.
- **Solution Implemented:**
  1. Installed `dotenv` and loaded `.env` variables cleanly in `server.js`.
  2. Implemented direct Nodemailer transport via **Gmail SMTP** (`smtp.gmail.com:465`).
  3. Real 2FA OTP codes (6 digits) are emailed directly to student addresses (e.g., `s10275803@connect.np.edu.sg`).
  4. Added a clean fallback toast notification in `app.js` displaying the security code if email delivery is delayed.
  5. Configured Vercel Environment Variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`).

### B. Role-Based Access Control (RBAC) & EXCO Scoped View
- **Students (`s10XXXXXX`):** See discovery feed, survey matching, bookmarking, and event signups.
- **EXCO Leads (`s10275803@connect.np.edu.sg` / `s10234567@connect.np.edu.sg`):** Automatically detected upon 2FA login. Unlocks a role switcher toggle between **Student View** and **Admin View**.
- **Admin Dashboard:** EXCO leads can post events and inspect student rosters **only** for their assigned CCA (e.g., NP Developers / LegalTech Club).

### C. Analytics Pillar — Weighted Match Algorithm
- Calculates match scores (0–100%) dynamically based on student survey input:
  $$\text{Score} = (0.5 \times \text{Tag Overlap}) + (0.3 \times \text{Commitment Fit}) + (0.2 \times \text{Style Fit})$$

### D. Software Engineering Pillar — TDD RED Test Runner
- `/api/tdd/run` endpoint runs an automated suite testing 5 boundary conditions for event signups:
  1. Valid signup (Capacity available, future date)
  2. Event Full Error (`signup_count == capacity`)
  3. Duplicate Signup Error (Student already signed up)
  4. Boundary Case (`signup_count == capacity - 1`)
  5. Event Passed Error (`datetime <= now`)
- **Status:** 100% PASS.

### E. LegalTech & Defence Pillars
- **PDPA & Confidentiality:** Roster endpoints hide student survey answers and personal data from third parties.
- **Telegram Bot Simulator:** Interactive bot drawer on the UI simulating `/start`, `/browse`, `/myccas`, and instant signup callbacks.

---

## 4. How to Run & Deploy

### Local Development
```bash
npm install
node server.js
# Access at http://localhost:3000
```

### Git / Deployment
```bash
git add -A
git commit -m "update"
git push origin main
# Auto-deploys to Vercel
```

---

## 5. Current Environment Variables Configuration (`.env`)
- `SUPABASE_URL`: `https://cyofolmdypeyvhzqkavr.supabase.co`
- `SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- `SMTP_HOST`: `smtp.gmail.com`
- `SMTP_PORT`: `465`
- `SMTP_SECURE`: `true`
- `SMTP_USER`: `ganeshoofs@gmail.com`
- `SMTP_PASS`: `dbrquaruuwvabsah`
- `SMTP_FROM`: `ganeshoofs@gmail.com`
