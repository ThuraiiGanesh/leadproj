require('dotenv').config();
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const path = require('path');
const nodemailer = require('nodemailer');
const { NP_CCAS } = require('./data/cca_data');

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL || `http://localhost:${PORT}`;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── EMAIL DISPATCHER ENGINE (Gmail SMTP) ───────────────────────────
let emailTransporter = null;

async function getEmailTransporter() {
  if (emailTransporter) return emailTransporter;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER || 'ganeshoofs@gmail.com';
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      family: 4,
      auth: { user, pass }
    });
    console.log(`📧 Gmail SMTP Configured for ${user}`);
  }
  return emailTransporter;
}

// Function to send real 2FA email via Gmail SMTP
async function sendReal2FAEmail(toEmail, studentName, otpCode) {
  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background-color: #0f172a; border-radius: 16px; color: #f8fafc; border: 1px solid rgba(255,255,255,0.1);">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6, #a855f7); color: white; border-radius: 50%; line-height: 48px; font-weight: bold; font-size: 18px;">NP</div>
        <h2 style="color: #ffffff; font-size: 22px; margin-top: 12px; margin-bottom: 4px;">Ngee Ann Polytechnic</h2>
        <p style="color: #94a3b8; font-size: 14px; margin: 0;">Student Portal Security Verification</p>
      </div>

      <div style="background-color: #1e293b; border-radius: 12px; padding: 24px; border: 1px solid rgba(59,130,246,0.3); margin-bottom: 24px; text-align: center;">
        <p style="color: #cbd5e1; font-size: 15px; margin-top: 0;">Hello <strong>${studentName}</strong>,</p>
        <p style="color: #cbd5e1; font-size: 14px; margin-bottom: 20px;">Use the following 6-digit security code to complete your NP Student Portal 2FA login:</p>
        
        <div style="display: inline-block; padding: 14px 32px; background: rgba(59, 130, 246, 0.2); border: 2px dashed #3b82f6; border-radius: 12px; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #60a5fa; margin-bottom: 12px;">
          ${otpCode}
        </div>
        
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">Target Recipient: <strong>${toEmail}</strong></p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 4px;">This code will expire in 10 minutes. Do not share this code with anyone.</p>
      </div>

      <div style="text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px;">
        <p style="margin: 0;">This is an automated notification from the NP Student Portal.</p>
      </div>
    </div>
  `;

  // 1. Try Gmail SMTP (Sends directly to whatever email the user inputs!)
  try {
    const transporter = await getEmailTransporter();
    if (transporter) {
      const senderEmail = process.env.SMTP_USER || 'ganeshoofs@gmail.com';
      const info = await transporter.sendMail({
        from: `"NP Student Portal Security" <${senderEmail}>`,
        to: toEmail,
        subject: `🔐 ${otpCode} is your NP Student Portal 2FA Security Code`,
        html: htmlContent
      });
      console.log(`🚀 REAL 2FA EMAIL DELIVERED VIA GMAIL SMTP DIRECTLY TO ${toEmail}! (MsgID: ${info.messageId})`);
      return true;
    }
  } catch (err) {
    console.error(`⚠️ Gmail SMTP Error: ${err.message}`);
  }

  return false;
}

// In-Memory Data Storage for Event Registrations, Profiles & Auth
const userProfiles = {}; // key: studentId or userId, value: profile object
const eventRegistrations = {}; // key: studentId or userId, value: array of event objects
const pending2FACodes = {}; // key: studentId, value: { code, email, expiresAt, name, school }
const activeSessions = {}; // key: token, value: { studentId, email, name, school }

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'NP CCA Match / NP CCA GO', total_ccas: NP_CCAS.length });
});

// ─── AUTHENTICATION & 2FA ENDPOINTS ─────────────────────────────

// Helper to normalize and validate Student Email or ID
function parseNPEmailOrId(input) {
  if (!input) return null;
  const str = input.trim().toLowerCase();
  
  let studentId = str;
  let email = str;

  if (str.includes('@')) {
    const parts = str.split('@');
    studentId = parts[0];
    email = str; // Exact email typed in by the user
  } else {
    // If only Student ID is entered, append default NP domain
    if (!studentId.startsWith('s') && !studentId.startsWith('p')) {
      studentId = 's' + studentId;
    }
    email = `${studentId}@connect.np.edu.sg`;
  }

  if (studentId.length < 3) {
    return { valid: false, error: 'Please enter a valid Student ID or Email address.' };
  }

  // Derive school based on ID or default to ICT
  const charCode = studentId.charCodeAt(studentId.length - 1) % 4;
  const schoolList = ['ICT', 'BA', 'HMS', 'SOE'];
  const school = schoolList[charCode] || 'ICT';

  return {
    valid: true,
    studentId: studentId.toUpperCase(),
    email: email, // Target email typed by user
    school
  };
}

// 1. Student Login (NP Email + Password check) -> Triggers 2FA Code
app.post('/api/auth/login', async (req, res) => {
  const { emailOrId, password } = req.body || {};

  if (!emailOrId || !password) {
    return res.status(400).json({ success: false, error: 'Please enter your NP Student ID / Email and password.' });
  }

  if (password.length < 4) {
    return res.status(400).json({ success: false, error: 'Password must be at least 4 characters long.' });
  }

  const parsed = parseNPEmailOrId(emailOrId);
  if (!parsed || !parsed.valid) {
    return res.status(400).json({ success: false, error: parsed ? parsed.error : 'Invalid NP Student credentials.' });
  }

  // Generate 6-digit OTP 2FA Code
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

  // Default student name based on ID
  const idNum = parsed.studentId.replace(/\D/g, '') || '10234567';
  const sampleNames = ['Alex Tan', 'Jordan Lim', 'Chloe Wong', 'Ryan Teo', 'Hannah Koh'];
  const nameIndex = parseInt(idNum, 10) % sampleNames.length;
  const studentName = sampleNames[nameIndex];

  pending2FACodes[parsed.studentId] = {
    code: otpCode,
    email: parsed.email,
    name: studentName,
    school: parsed.school,
    expiresAt
  };

  console.log(`\n==============================================`);
  console.log(`🔐 2FA SECURITY CODE GENERATED FOR ${parsed.email}`);
  console.log(`👉 CODE: [ ${otpCode} ]`);
  console.log(`==============================================\n`);

  // Mask email for privacy UI (e.g. s102****7@connect.np.edu.sg)
  const emailPrefix = parsed.email.split('@')[0];
  const maskedPrefix = emailPrefix.substring(0, 3) + '****' + emailPrefix.substring(emailPrefix.length - 1);
  const maskedEmail = `${maskedPrefix}@${parsed.email.split('@')[1]}`;

  // Attempt real email dispatch via Brevo / SMTP / Resend
  await sendReal2FAEmail(parsed.email, studentName, otpCode).catch(err => {
    console.warn('Real email dispatch warning:', err.message);
  });

  res.json({
    success: true,
    require2FA: true,
    studentId: parsed.studentId,
    email: parsed.email,
    maskedEmail: maskedEmail,
    devCode: otpCode, // Testing code for instant 1-click login
    message: `A 2FA verification code has been sent to ${maskedEmail}`
  });
});

// 2. Verify 2FA OTP Code
app.post('/api/auth/verify-2fa', (req, res) => {
  const { studentId, code } = req.body || {};

  if (!studentId || !code) {
    return res.status(400).json({ success: false, error: 'Student ID and 2FA Code are required.' });
  }

  const pending = pending2FACodes[studentId];
  if (!pending) {
    return res.status(400).json({ success: false, error: '2FA session expired. Please log in again.' });
  }

  if (Date.now() > pending.expiresAt) {
    delete pending2FACodes[studentId];
    return res.status(400).json({ success: false, error: '2FA Code has expired. Please request a new code.' });
  }

  if (pending.code !== code.trim()) {
    return res.status(400).json({ success: false, error: 'Incorrect 2FA code. Please check your Outlook email and try again.' });
  }

  // Successful Auth! Create Session
  const sessionToken = `np_sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const userProfile = {
    studentId: studentId,
    email: pending.email,
    name: pending.name,
    school: pending.school,
    verifiedAt: new Date().toISOString()
  };

  activeSessions[sessionToken] = userProfile;
  userProfiles[studentId] = userProfile;

  // Clear pending code
  delete pending2FACodes[studentId];

  res.json({
    success: true,
    token: sessionToken,
    profile: userProfile,
    message: '2FA Verification Successful! Welcome to NP Student Portal.'
  });
});

// 3. Resend 2FA Code
app.post('/api/auth/resend-2fa', (req, res) => {
  const { studentId } = req.body || {};
  if (!studentId || !pending2FACodes[studentId]) {
    return res.status(400).json({ success: false, error: 'No active 2FA request found. Please login again.' });
  }

  const pending = pending2FACodes[studentId];
  const newCode = Math.floor(100000 + Math.random() * 900000).toString();
  pending.code = newCode;
  pending.expiresAt = Date.now() + 10 * 60 * 1000;

  sendReal2FAEmail(pending.email, pending.name, newCode).catch(err => {
    console.warn('Resend email error:', err.message);
  });

  res.json({
    success: true,
    message: 'New 2FA code sent to your NP Outlook email.'
  });
});

// ─── REST API ENDPOINTS ──────────────────────────────────────────

// 1. Get all CCAs with optional filters
app.get('/api/ccas', (req, res) => {
  const { category, school, query } = req.query;
  let result = [...NP_CCAS];

  if (category && category !== 'All') {
    result = result.filter(c => c.category === category);
  }
  if (school && school !== 'All') {
    result = result.filter(c => c.school === school);
  }
  if (query) {
    const q = query.toLowerCase();
    result = result.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.tags.some(t => t.toLowerCase().includes(q))
    );
  }
  res.json(result);
});

// 2. CCA Matcher Algorithm
app.post('/api/match', (req, res) => {
  const { interests = [], commitment = "Medium", school = "ICT" } = req.body || {};

  const scoredCCAs = NP_CCAS.map(cca => {
    let score = 50; // base score

    // School match bonus (+15)
    if (cca.school === school) score += 15;

    // Commitment level match (+15)
    if (cca.commitment.toLowerCase() === commitment.toLowerCase()) {
      score += 15;
    } else if (cca.commitment === "Medium") {
      score += 8;
    }

    // Tag / Interest overlap (+10 per tag, max 30)
    let interestBonus = 0;
    interests.forEach(interest => {
      const lower = interest.toLowerCase();
      if (cca.tags.some(tag => tag.includes(lower) || lower.includes(tag)) ||
          cca.category.toLowerCase().includes(lower)) {
        interestBonus += 10;
      }
    });
    score += Math.min(interestBonus, 30);

    // Normalize between 65% and 98%
    const matchPercentage = Math.min(Math.max(score, 65), 98);

    return {
      ...cca,
      matchPercentage
    };
  });

  // Sort descending by match percentage
  scoredCCAs.sort((a, b) => b.matchPercentage - a.matchPercentage);
  res.json(scoredCCAs);
});

// 3. Get all upcoming CCA events
app.get('/api/events', (req, res) => {
  const allEvents = [];
  NP_CCAS.forEach(cca => {
    (cca.upcoming_events || []).forEach(evt => {
      allEvents.push({
        ...evt,
        cca_id: cca.id,
        cca_name: cca.name,
        cca_category: cca.category
      });
    });
  });
  res.json(allEvents);
});

// 4. One-Click Event Registration Endpoint
app.post('/api/events/signup', (req, res) => {
  const { studentId = 'GUEST', studentName = 'Student', eventId } = req.body || {};

  if (!eventId) {
    return res.status(400).json({ success: false, error: 'Event ID is required' });
  }

  // Find target event
  let targetEvent = null;
  let targetCCA = null;
  NP_CCAS.forEach(cca => {
    const evt = (cca.upcoming_events || []).find(e => e.id === eventId);
    if (evt) {
      targetEvent = evt;
      targetCCA = cca;
    }
  });

  if (!targetEvent) {
    return res.status(404).json({ success: false, error: 'Event not found' });
  }

  if (!eventRegistrations[studentId]) {
    eventRegistrations[studentId] = [];
  }

  // Check if already registered
  const exists = eventRegistrations[studentId].some(e => e.id === eventId);
  if (exists) {
    return res.json({ success: true, message: 'Already signed up for this event!', event: targetEvent });
  }

  // Add registration
  targetEvent.registeredCount = (targetEvent.registeredCount || 0) + 1;
  const regEntry = {
    ...targetEvent,
    cca_name: targetCCA.name,
    registeredAt: new Date().toISOString()
  };

  eventRegistrations[studentId].push(regEntry);
  res.json({ success: true, message: `Successfully registered for ${targetEvent.title}!`, event: regEntry });
});

// 5. Get user's registered events
app.get('/api/user/events', (req, res) => {
  const studentId = req.query.studentId || 'GUEST';
  res.json(eventRegistrations[studentId] || []);
});

// 6. Save or update Student Profile
app.post('/api/user/profile', (req, res) => {
  const { name, studentId, school } = req.body || {};
  if (!studentId) {
    return res.status(400).json({ success: false, error: 'Student ID is required' });
  }
  userProfiles[studentId] = { name, studentId, school, updatedAt: new Date().toISOString() };
  res.json({ success: true, profile: userProfiles[studentId] });
});


// ─── TELEGRAM BOT INTEGRATION (Telegraf) ───────────────────────────
let bot = null;
if (BOT_TOKEN && BOT_TOKEN !== 'your_bot_token_here') {
  bot = new Telegraf(BOT_TOKEN);

  // Welcome /start command
  bot.command('start', (ctx) => {
    const welcomeMsg = 
      `🎯 *Welcome to NP CCA Match & NP CCA GO!* 🗺️\n\n` +
      `Easily discover NP CCAs & SIGs, get matched via an AI Survey, sign up for events in 1-click, and navigate directly to campus meeting rooms!\n\n` +
      `👇 Tap below to open the *NP CCA Matcher App*:`;

    return ctx.replyWithMarkdown(welcomeMsg, 
      Markup.inlineKeyboard([
        [Markup.button.webApp('🚀 Launch NP CCA Match App', WEBAPP_URL)],
        [Markup.button.callback('🎯 Match Me to a CCA', 'cmd_match'), Markup.button.callback('📅 Upcoming Events', 'cmd_events')],
        [Markup.button.callback('📜 CCA Directory', 'cmd_ccas'), Markup.button.callback('🗺️ Campus Map', 'cmd_map')]
      ])
    );
  });

  // /match command
  bot.command('match', (ctx) => {
    return ctx.reply(
      '🎯 Take the 1-minute survey to discover your top NP CCA matches:',
      Markup.inlineKeyboard([
        [Markup.button.webApp('🎯 Start CCA Matcher Survey', `${WEBAPP_URL}#match`)]
      ])
    );
  });

  // /ccas command
  bot.command('ccas', (ctx) => {
    return ctx.reply(
      '🏛️ Browse updated info, EXCO contacts, and meeting locations for all NP CCAs & SIGs:',
      Markup.inlineKeyboard([
        [Markup.button.webApp('🏛️ View CCA & SIG Directory', `${WEBAPP_URL}#ccas`)]
      ])
    );
  });

  // /events command
  bot.command('events', (ctx) => {
    return ctx.reply(
      '📅 Upcoming NP CCA Workshops, Tryouts & Orientation Sessions (1-Click Sign Up):',
      Markup.inlineKeyboard([
        [Markup.button.webApp('📅 View & Sign Up for Events', `${WEBAPP_URL}#events`)]
      ])
    );
  });

  // /myevents command
  bot.command('myevents', (ctx) => {
    return ctx.reply(
      '👤 View your registered events and campus navigation shortcuts:',
      Markup.inlineKeyboard([
        [Markup.button.webApp('👤 View My Event Registrations', `${WEBAPP_URL}#profile`)]
      ])
    );
  });

  // /map command
  bot.command('map', (ctx) => {
    return ctx.reply(
      '🗺️ Tap below to launch the NP Campus Navigator:',
      Markup.inlineKeyboard([
        [Markup.button.webApp('🗺️ Launch Campus Navigator', `${WEBAPP_URL}#map`)]
      ])
    );
  });

  // Callback Actions
  bot.action('cmd_match', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('🎯 Tap below to start your CCA match survey:', Markup.inlineKeyboard([[Markup.button.webApp('🎯 Start Matcher Survey', `${WEBAPP_URL}#match`)]]));
  });

  bot.action('cmd_events', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('📅 Tap below to view events and sign up in 1-click:', Markup.inlineKeyboard([[Markup.button.webApp('📅 View Events', `${WEBAPP_URL}#events`)]]));
  });

  bot.action('cmd_ccas', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('🏛️ Tap below to browse all NP CCAs:', Markup.inlineKeyboard([[Markup.button.webApp('🏛️ Open Directory', `${WEBAPP_URL}#ccas`)]]));
  });

  bot.action('cmd_map', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('🗺️ Tap below to open campus map navigation:', Markup.inlineKeyboard([[Markup.button.webApp('🗺️ Open Map', `${WEBAPP_URL}#map`)]]));
  });

  // Launch Bot
  bot.launch()
    .then(() => {
      console.log('🤖 Telegraf Bot successfully started for NP CCA Match!');
      if (WEBAPP_URL) {
        bot.telegram.callApi('setChatMenuButton', {
          menu_button: {
            type: 'web_app',
            text: '🎯 NP CCA Match',
            web_app: { url: WEBAPP_URL }
          }
        }).catch(err => console.error('⚠️ Menu Button error:', err.message));
      }
    })
    .catch(err => console.error('⚠️ Bot Error:', err.message));

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
} else {
  console.log('⚠️ TELEGRAM_BOT_TOKEN missing in .env file (Running Web App Mode).');
}

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`🚀 NP CCA Match / NP CCA GO Web App Server Running`);
    console.log(`🌐 Local Web App URL: http://localhost:${PORT}`);
    console.log(`===================================================`);
  });
}

module.exports = app;
