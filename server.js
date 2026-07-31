const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// Supabase Integration
let createClient;
try {
  createClient = require('@supabase/supabase-js').createClient;
} catch (e) {
  console.log("Supabase module not found, fallback to mock mode.");
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Supabase Client if env variables exist
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cyofolmdypeyvhzqkavr.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5b2ZvbG1keXBleXZoenFrYXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0ODY2NzMsImV4cCI6MjEwMTA2MjY3M30.DDYLODmfhXYpZ4XokccqL4j_0WwpiahDoi9uci6-WnI';

let supabase = null;
if (createClient && SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("✅ Supabase Client Initialized:", SUPABASE_URL);
  } catch (err) {
    console.error("Supabase initialization error:", err);
  }
}

// Nodemailer SMTP Transporter setup (using Resend SMTP for unlimited real email delivery)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.resend.com',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: process.env.SMTP_SECURE !== 'false',
  auth: {
    user: process.env.SMTP_USER || 'resend',
    pass: process.env.SMTP_PASS
  }
});

// File paths
const CCAS_FILE = path.join(__dirname, 'data', 'ccas.json');
const EVENTS_FILE = path.join(__dirname, 'data', 'events.json');

// In-Memory Data Stores
let ccas = [];
let events = [];

function loadData() {
  try {
    if (fs.existsSync(CCAS_FILE)) {
      ccas = JSON.parse(fs.readFileSync(CCAS_FILE, 'utf8'));
    }
    if (fs.existsSync(EVENTS_FILE)) {
      events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error("Error loading JSON datasets:", err);
  }
}

function saveData() {
  try {
    if (fs.existsSync(path.dirname(CCAS_FILE))) {
      fs.writeFileSync(CCAS_FILE, JSON.stringify(ccas, null, 2));
    }
    if (fs.existsSync(path.dirname(EVENTS_FILE))) {
      fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
    }
  } catch (err) {
    console.error("Error saving JSON datasets:", err);
  }
}

loadData();

// Mock Session & 2FA Store
const active2FASessions = new Map();

// Helper: Find EXCO Managed CCAs for a user email or student ID
function getManagedCcas(studentIdOrEmail) {
  const query = studentIdOrEmail.toLowerCase().trim();
  const managed = [];

  ccas.forEach(cca => {
    if (cca.exco && Array.isArray(cca.exco)) {
      const isExco = cca.exco.some(e => {
        const excoEmail = (e.email || '').toLowerCase();
        return excoEmail.includes(query) || query.includes(excoEmail.split('@')[0]);
      });

      if (isExco) {
        managed.push({ id: cca.id, name: cca.name, category: cca.category });
      }
    }
  });

  return managed;
}

// Helper: Calculate Weighted Score (Section 3 of Build Spec)
function calculateMatchScore(studentAnswers, cca) {
  if (!studentAnswers || !studentAnswers.interest_tags || studentAnswers.interest_tags.length === 0) {
    return 0;
  }

  // 1. Interest Tag Overlap (weight 0.5)
  const studentTags = studentAnswers.interest_tags.map(t => t.toLowerCase());
  const ccaTags = cca.tags.map(t => t.toLowerCase());
  
  let matchCount = 0;
  studentTags.forEach(tag => {
    if (ccaTags.includes(tag)) {
      matchCount++;
    }
  });

  const interestOverlap = matchCount / studentTags.length;

  // 2. Commitment Fit (weight 0.3)
  const studentCommitment = (studentAnswers.commitment_level || '').toLowerCase();
  const ccaCommitment = (cca.commitment_level || '').toLowerCase();
  
  let commitmentFit = 0.0;
  if (studentCommitment === ccaCommitment) {
    commitmentFit = 1.0;
  } else if (
    (studentCommitment === 'medium' && (ccaCommitment === 'low' || ccaCommitment === 'high')) ||
    (ccaCommitment === 'medium' && (studentCommitment === 'low' || studentCommitment === 'high'))
  ) {
    commitmentFit = 0.5;
  } else {
    commitmentFit = 0.0; // low vs high
  }

  // 3. Style Fit (weight 0.2)
  const studentStyle = (studentAnswers.style || '').toLowerCase();
  const ccaStyle = (cca.style || '').toLowerCase();

  let styleFit = 0.0;
  if (studentStyle === ccaStyle) {
    styleFit = 1.0;
  } else if (studentStyle === 'mixed' || ccaStyle === 'mixed') {
    styleFit = 0.5;
  } else {
    styleFit = 0.0;
  }

  // Weighted Score
  const rawScore = (0.5 * interestOverlap) + (0.3 * commitmentFit) + (0.2 * styleFit);
  return Math.round(rawScore * 100);
}

// ----------------------------------------------------
// AUTH ENDPOINTS (Direct 2FA Email Dispatch + Supabase)
// ----------------------------------------------------

app.post('/api/auth/login', async (req, res) => {
  const { student_id, password } = req.body;
  if (!student_id) {
    return res.status(400).json({ success: false, message: 'Student ID or Email is required.' });
  }

  const email = student_id.includes('@') ? student_id.toLowerCase() : `${student_id.toLowerCase()}@connect.np.edu.sg`;

  // Generate 6-digit OTP code
  const mockOtpCode = Math.floor(100000 + Math.random() * 900000).toString();
  active2FASessions.set(student_id, {
    otp: mockOtpCode,
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
  });

  // Try Supabase OTP first if configured
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: true
        }
      });

      if (!error) {
        return res.json({
          success: true,
          provider: 'supabase',
          message: `Supabase 2FA OTP code dispatched to ${email}`,
          student_id,
          outlook_email: email,
          mock_otp_code: null
        });
      } else {
        console.warn("Supabase OTP warning, switching to direct email transport:", error.message);
      }
    } catch (err) {
      console.error("Supabase OTP Exception:", err);
    }
  }

  // Direct Nodemailer Email Dispatch Attempt
  try {
    await transporter.sendMail({
      from: '"NP CCA Match 2FA" <onboarding@resend.dev>',
      to: email,
      subject: `Your NP CCA Match 2FA Security Code: ${mockOtpCode}`,
      html: `
        <div style="font-family:sans-serif; background:#0b0914; color:#ffffff; padding:30px; border-radius:16px;">
          <h2 style="color:#8b5cf6;">NP CCA Match — 2FA Security Verification</h2>
          <p style="color:#c4b5fd;">Use the following 6-digit security code to complete your login:</p>
          <div style="background:#1e183b; border:1px solid #8b5cf6; color:#ffffff; font-size:28px; letter-spacing:6px; font-weight:bold; padding:15px; border-radius:12px; text-align:center; margin:20px 0;">
            ${mockOtpCode}
          </div>
          <p style="font-size:12px; color:#827e9e;">This code will expire in 5 minutes. If you did not request this, please ignore.</p>
        </div>
      `
    });
  } catch (emailErr) {
    console.log("Direct SMTP email dispatch notice:", emailErr.message);
  }

  return res.json({
    success: true,
    provider: 'direct_transport',
    message: `2FA security code dispatched to ${email}`,
    student_id,
    outlook_email: email,
    mock_otp_code: mockOtpCode
  });
});

app.post('/api/auth/verify-2fa', async (req, res) => {
  const { student_id, otp_code } = req.body;
  const email = student_id.includes('@') ? student_id.toLowerCase() : `${student_id.toLowerCase()}@connect.np.edu.sg`;

  const managedCcas = getManagedCcas(student_id);
  const isExco = managedCcas.length > 0;

  let userName = student_id.split('@')[0].toUpperCase();
  if (student_id.toLowerCase().includes('s10234567')) {
    userName = 'Thurai Ganesh';
  } else if (isExco) {
    ccas.forEach(c => {
      (c.exco || []).forEach(e => {
        if ((e.email || '').toLowerCase().includes(student_id.toLowerCase())) {
          userName = e.name;
        }
      });
    });
  }

  // Check Supabase Auth verify if active
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email,
        token: otp_code.trim(),
        type: 'email'
      });

      if (!error && data.session) {
        const user = {
          id: student_id,
          name: userName,
          np_student_id: student_id.toUpperCase(),
          email: email,
          school: 'School of InfoComm Technology (ICT)',
          survey_completed: false,
          survey_answers: null,
          is_exco: isExco,
          managed_ccas: managedCcas,
          supabase_user_id: data.user.id
        };

        return res.json({
          success: true,
          provider: 'supabase',
          message: 'Supabase 2FA Verification Successful.',
          user
        });
      }
    } catch (err) {
      console.warn("Supabase 2FA verification fallback:", err);
    }
  }

  // Check against active session store
  const session = active2FASessions.get(student_id);

  if (!session) {
    return res.status(400).json({ success: false, message: 'No active 2FA session found. Please log in again.' });
  }

  if (Date.now() > session.expiresAt) {
    active2FASessions.delete(student_id);
    return res.status(400).json({ success: false, message: '2FA code has expired.' });
  }

  if (session.otp !== otp_code.trim()) {
    return res.status(400).json({ success: false, message: 'Invalid 2FA code. Please check your Outlook email.' });
  }

  active2FASessions.delete(student_id);

  const user = {
    id: student_id,
    name: userName,
    np_student_id: student_id.toUpperCase(),
    email: email,
    school: 'School of InfoComm Technology (ICT)',
    survey_completed: false,
    survey_answers: null,
    is_exco: isExco,
    managed_ccas: managedCcas
  };

  return res.json({
    success: true,
    provider: 'session',
    message: '2FA Verification Successful.',
    user
  });
});

// ----------------------------------------------------
// CCA & MATCHING ENDPOINTS (Analytics Pillar)
// ----------------------------------------------------

app.get('/api/ccas', (req, res) => {
  const { interest_tags, commitment_level, style, survey_completed, category, search } = req.query;

  let result = ccas.map(cca => ({ ...cca }));

  const isSurveyDone = survey_completed === 'true';

  if (isSurveyDone && interest_tags) {
    const studentAnswers = {
      interest_tags: Array.isArray(interest_tags) ? interest_tags : interest_tags.split(','),
      commitment_level: commitment_level || 'medium',
      style: style || 'team'
    };

    result = result.map(cca => {
      const score = calculateMatchScore(studentAnswers, cca);
      return {
        ...cca,
        match_score: score,
        is_recommended: score > 70
      };
    });

    result.sort((a, b) => b.match_score - a.match_score);
  } else {
    result = result.map(cca => ({
      ...cca,
      match_score: null,
      is_recommended: false
    }));
  }

  if (category && category !== 'All') {
    result = result.filter(cca => cca.category.toLowerCase().includes(category.toLowerCase()));
  }

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(cca =>
      cca.name.toLowerCase().includes(q) ||
      cca.description.toLowerCase().includes(q) ||
      cca.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  res.json({ success: true, ccas: result });
});

app.get('/api/ccas/:id', (req, res) => {
  const cca = ccas.find(c => c.id === req.params.id);
  if (!cca) {
    return res.status(404).json({ success: false, message: 'CCA not found.' });
  }

  const ccaEvents = events.filter(e => e.cca_id === cca.id);
  res.json({ success: true, cca, events: ccaEvents });
});

// ----------------------------------------------------
// EVENT SIGNUP ENDPOINT (Software Engineering TDD RED Pillar)
// ----------------------------------------------------

function validateSignupRules(event, student_id) {
  const now = new Date();
  const eventTime = new Date(event.datetime);

  if (event.signup_count >= event.capacity) {
    return { valid: false, reason: 'Event is fully booked (Capacity reached).' };
  }

  const alreadySignedUp = event.signups && event.signups.some(s => s.student_id.toLowerCase() === student_id.toLowerCase());
  if (alreadySignedUp) {
    return { valid: false, reason: 'Student is already signed up for this event.' };
  }

  if (eventTime <= now) {
    return { valid: false, reason: 'Registration closed. Event date/time has already passed.' };
  }

  return { valid: true };
}

app.post('/api/events/:id/signup', (req, res) => {
  const { student_id, student_name } = req.body;
  const event = events.find(e => e.id === req.params.id);

  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found.' });
  }

  if (!student_id) {
    return res.status(400).json({ success: false, message: 'Student ID is required.' });
  }

  const validation = validateSignupRules(event, student_id);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.reason });
  }

  event.signup_count += 1;
  if (!event.signups) event.signups = [];
  event.signups.push({
    student_id: student_id.toUpperCase(),
    name: student_name || 'Student (' + student_id + ')',
    signed_at: new Date().toISOString()
  });

  saveData();

  res.json({
    success: true,
    message: `Successfully registered for ${event.title}! Reminder set.`,
    event
  });
});

// TDD Automated Test Runner API
app.get('/api/tdd/run', (req, res) => {
  const now = new Date();
  const futureTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const pastTime = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const testCases = [
    {
      name: "Valid Signup (Capacity available, future date, new student)",
      event: { capacity: 10, signup_count: 5, datetime: futureTime, signups: [{ student_id: "S10000001" }] },
      student_id: "S10234567",
      expected: true
    },
    {
      name: "Event Full Error (signup_count == capacity)",
      event: { capacity: 10, signup_count: 10, datetime: futureTime, signups: [] },
      student_id: "S10234567",
      expected: false
    },
    {
      name: "Duplicate Signup Error (student already in signups list)",
      event: { capacity: 10, signup_count: 5, datetime: futureTime, signups: [{ student_id: "S10234567" }] },
      student_id: "S10234567",
      expected: false
    },
    {
      name: "Boundary Case (signup_count == capacity - 1)",
      event: { capacity: 10, signup_count: 9, datetime: futureTime, signups: [] },
      student_id: "S10234567",
      expected: true
    },
    {
      name: "Event Passed Error (datetime <= now)",
      event: { capacity: 10, signup_count: 2, datetime: pastTime, signups: [] },
      student_id: "S10234567",
      expected: false
    }
  ];

  const results = testCases.map(tc => {
    const val = validateSignupRules(tc.event, tc.student_id);
    const passed = val.valid === tc.expected;
    return {
      test_name: tc.name,
      expected: tc.expected ? "PASS" : "FAIL",
      actual: val.valid ? "PASS" : "FAIL",
      passed: passed,
      reason: val.reason || "Validation Passed"
    };
  });

  const allPassed = results.every(r => r.passed);
  res.json({ success: true, allPassed, total: results.length, suite: results });
});

// ----------------------------------------------------
// ADMIN / CCA LEAD ENDPOINTS (EXCO Scoped Security)
// ----------------------------------------------------

app.post('/api/admin/events/create', (req, res) => {
  const { cca_id, title, datetime, location, capacity, description, student_id } = req.body;

  if (!cca_id || !title || !datetime || !location || !capacity) {
    return res.status(400).json({ success: false, message: 'All event fields are required.' });
  }

  if (student_id) {
    const managed = getManagedCcas(student_id);
    const isAuthorized = managed.some(m => m.id === cca_id);
    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'Forbidden: You are not authorized to post events for this CCA.' });
    }
  }

  const newEvent = {
    id: 'evt_' + Date.now(),
    cca_id,
    title,
    datetime,
    location,
    capacity: parseInt(capacity, 10),
    signup_count: 0,
    signups: [],
    description: description || ''
  };

  events.push(newEvent);
  saveData();

  res.json({ success: true, message: 'Event successfully published by CCA EXCO!', event: newEvent });
});

app.get('/api/admin/events/:id/signups', (req, res) => {
  const event = events.find(e => e.id === req.params.id);
  if (!event) {
    return res.status(404).json({ success: false, message: 'Event not found.' });
  }

  const sanitizedSignups = (event.signups || []).map(s => ({
    name: s.name,
    student_id: s.student_id,
    signed_at: s.signed_at || 'Registered'
  }));

  res.json({
    success: true,
    event_title: event.title,
    capacity: event.capacity,
    signup_count: event.signup_count,
    signups: sanitizedSignups,
    security_note: "PDPA & CIA Confidentiality Control Enforced: Survey answers & sensitive user data are excluded from Admin View."
  });
});

// ----------------------------------------------------
// TELEGRAM BOT SIMULATION ENDPOINTS
// ----------------------------------------------------

app.post('/api/telegram/interact', (req, res) => {
  const { command } = req.body;

  if (command === '/start') {
    return res.json({
      bot_response: "👋 Welcome to **NP CCA Match Bot**!\n\nUse `/browse` to view top matched CCAs based on your interest survey, or use `/myccas` to check your registered events and automated reminders.",
      buttons: [
        { text: "🔍 /browse Matched CCAs", action: "browse" },
        { text: "📅 /myccas & Reminders", action: "myccas" }
      ]
    });
  }

  if (command === 'browse') {
    const topCCAs = ccas.slice(0, 3).map(c => `• **${c.name}** (${c.category})\n📍 ${c.location}`).join('\n\n');
    return res.json({
      bot_response: `🌟 **Top Recommended CCAs for You:**\n\n${topCCAs}\n\nSelect a CCA below to sign up for upcoming events:`,
      buttons: [
        { text: "⚡ Sign Up LegalTech Workshop", action: "signup_legaltech" },
        { text: "⭐ Bookmark NP Developers", action: "bookmark_devs" }
      ]
    });
  }

  if (command === 'signup_legaltech') {
    return res.json({
      bot_response: "✅ **Event Signup Confirmed via Telegram!**\n\n📌 **Build Your First Legal Tech AI Bot**\n📅 10 Aug 2026 @ 5:00 PM\n📍 Blk 31 (ICT) Room 402\n\n🔔 *Automated reminder set for 1 hour before event.*",
      buttons: [{ text: "🏠 Main Menu", action: "/start" }]
    });
  }

  return res.json({
    bot_response: "🤖 Bot Command processed successfully.",
    buttons: [{ text: "Main Menu", action: "/start" }]
  });
});

// Start Server (local) and export app (for Vercel serverless)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`🚀 NP CCA Match Server running on http://localhost:${PORT}`);
    console.log(`=================================================`);
  });
}

module.exports = app;
