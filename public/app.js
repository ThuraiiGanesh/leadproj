// NP CCA Match — Mandatory 2FA Gate & EXCO Role-Based Access Control (RBAC) Logic

let currentUser = null;
let currentRole = 'student'; // 'student' | 'admin'
let allCcas = [];
let activeCategory = 'All';
let searchQuery = '';
let bookmarkedCcaIds = new Set();
let signedUpEventIds = new Set();
let selectedAdminCcaId = null;

const ALL_INTEREST_TAGS = [
  'tech', 'ai', 'coding', 'law', 'sports', 'fitness', 
  'arts', 'dance', 'photography', 'community', 'volunteering', 
  'business', 'startup', 'robotics', 'hardware'
];

document.addEventListener('DOMContentLoaded', () => {
  fetchCcas();
  renderSurveyTags();
  // Mandatory 2FA Gate: Open Login Modal on initial load
  openLoginModal(true);
});

// ----------------------------------------------------
// ROLE SWITCHING
// ----------------------------------------------------
function switchRole(role) {
  if (role === 'admin' && (!currentUser || !currentUser.is_exco)) {
    showToast("Forbidden: Access restricted to CCA EXCO Members only.", "error");
    return;
  }

  currentRole = role;
  document.getElementById('roleStudentBtn').classList.toggle('active', role === 'student');
  document.getElementById('roleAdminBtn').classList.toggle('active', role === 'admin');

  document.getElementById('studentView').style.display = role === 'student' ? 'block' : 'none';
  document.getElementById('adminView').style.display = role === 'admin' ? 'block' : 'none';

  if (role === 'admin') {
    renderAdminDashboard();
  }
}

// ----------------------------------------------------
// AUTH & MANDATORY 2FA GATE FLOW
// ----------------------------------------------------
function openLoginModal(isMandatory = false) {
  document.getElementById('loginStep1').style.display = 'block';
  document.getElementById('loginStep2').style.display = 'none';
  const modal = document.getElementById('loginModal');
  modal.classList.add('active');
}

async function submitLogin() {
  const studentId = document.getElementById('loginStudentId').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  if (!studentId) {
    showToast("Please enter your Student ID or Email address.", "error");
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, password })
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById('outlookEmailSpan').textContent = data.outlook_email;
      document.getElementById('loginStep1').style.display = 'none';
      document.getElementById('loginStep2').style.display = 'block';
      showToast(`🔑 2FA code sent to ${data.outlook_email}`, "success");
    } else {
      showToast(data.message, "error");
    }
  } catch (err) {
    showToast("Login connection error.", "error");
  }
}

async function submit2FA() {
  const studentId = document.getElementById('loginStudentId').value.trim();
  const otpCode = document.getElementById('otpInput').value.trim();

  if (!otpCode) {
    showToast("Please enter the 6-digit 2FA security code.", "error");
    return;
  }

  try {
    const res = await fetch('/api/auth/verify-2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, otp_code: otpCode })
    });
    const data = await res.json();

    if (data.success) {
      currentUser = data.user;
      closeModal('loginModal');
      updateUserUI();

      if (currentUser.is_exco) {
        showToast(`🎉 Welcome EXCO Lead, ${currentUser.name}! Admin Portal unlocked for ${currentUser.managed_ccas.map(c => c.name).join(', ')}.`, "success");
      } else {
        showToast(`Welcome back, ${currentUser.name}! Logged in as Student.`, "success");
      }

      // Open survey modal after mandatory 2FA login
      openSurveyModal();
    } else {
      showToast(data.message, "error");
    }
  } catch (err) {
    showToast("2FA verification failed.", "error");
  }
}

function updateUserUI() {
  if (currentUser) {
    // User avatar pill
    document.getElementById('userAvatarPill').style.display = 'flex';
    document.getElementById('userStatusText').textContent = currentUser.name;
    const initials = currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    document.getElementById('avatarInitials').textContent = initials;
    
    document.getElementById('loginNavBtn').style.display = 'none';
    document.getElementById('myCcasBtn').style.display = 'inline-flex';

    // Role Switcher visibility based on EXCO status (RBAC)
    const roleSwitcher = document.getElementById('roleSwitcher');
    if (currentUser.is_exco && currentUser.managed_ccas.length > 0) {
      roleSwitcher.style.display = 'flex';
      setupAdminCcaSelector();
    } else {
      roleSwitcher.style.display = 'none';
      switchRole('student');
    }
  }
}

// ----------------------------------------------------
// EXCO SCOPED ADMIN DASHBOARD
// ----------------------------------------------------
function setupAdminCcaSelector() {
  if (!currentUser || !currentUser.managed_ccas) return;
  const select = document.getElementById('adminCcaSelect');

  select.innerHTML = currentUser.managed_ccas.map(c => `
    <option value="${c.id}">${c.name} (${c.category})</option>
  `).join('');

  if (currentUser.managed_ccas.length > 0) {
    selectedAdminCcaId = currentUser.managed_ccas[0].id;
  }
}

function handleAdminCcaChange() {
  selectedAdminCcaId = document.getElementById('adminCcaSelect').value;
  renderAdminDashboard();
}

async function renderAdminDashboard() {
  if (!currentUser || !currentUser.is_exco || !selectedAdminCcaId) return;

  try {
    const eventsRes = await fetch(`/api/ccas/${selectedAdminCcaId}`);
    const eventsData = await eventsRes.json();
    const eventsList = eventsData.events || [];

    const container = document.getElementById('adminEventsList');
    if (eventsList.length === 0) {
      container.innerHTML = `<p style="font-size:0.875rem; color:var(--text-muted);">No events posted for this CCA yet.</p>`;
      return;
    }

    container.innerHTML = eventsList.map(evt => `
      <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); padding:1.1rem; border-radius:var(--radius-sm); display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h4 style="font-size:0.925rem; font-weight:700; color:#fff;">${evt.title}</h4>
          <p style="font-size:0.78rem; color:var(--text-muted);">📅 ${new Date(evt.datetime).toLocaleString()}</p>
        </div>
        <button class="btn btn-outline btn-sm" onclick="viewAdminRoster('${evt.id}')">View Roster (${evt.signup_count})</button>
      </div>
    `).join('');
  } catch (err) {
    console.error("Admin dashboard load error:", err);
  }
}

async function viewAdminRoster(eventId) {
  try {
    const res = await fetch(`/api/admin/events/${eventId}/signups`);
    const data = await res.json();

    if (!data.success) return;

    const container = document.getElementById('adminRosterContainer');
    container.innerHTML = `
      <h4 style="font-size:1rem; font-weight:700; color:#fff; margin-bottom:0.6rem;">${data.event_title} (${data.signup_count}/${data.capacity})</h4>
      ${data.signups.length === 0 ? `<p style="font-size:0.875rem; color:var(--text-muted);">No student signups yet.</p>` : `
        <table style="width:100%; font-size:0.825rem; border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--border-subtle); text-align:left; color:var(--text-muted);">
              <th style="padding:8px;">Student Name</th>
              <th style="padding:8px;">NP Student ID</th>
            </tr>
          </thead>
          <tbody>
            ${data.signups.map(s => `
              <tr style="border-bottom:1px solid var(--border-subtle);">
                <td style="padding:8px; font-weight:600; color:#fff;">${s.name}</td>
                <td style="padding:8px; color:#c4b5fd;">${s.student_id}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    `;
  } catch (err) {
    showToast("Failed to fetch student roster.", "error");
  }
}

async function openCreateEventModal() {
  if (!currentUser || !currentUser.is_exco || !selectedAdminCcaId) {
    showToast("Only EXCO members can create events.", "error");
    return;
  }

  const title = prompt("Enter Event Title:", "EXCO Workshop 2026");
  if (!title) return;

  try {
    const res = await fetch('/api/admin/events/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cca_id: selectedAdminCcaId,
        student_id: currentUser.id,
        title: title,
        datetime: '2026-08-25T16:00:00',
        location: 'Blk 31 (ICT) Room 402',
        capacity: 25,
        description: 'Published by authorized EXCO member.'
      })
    });
    const data = await res.json();

    if (data.success) {
      showToast("🎉 Event published by CCA EXCO!", "success");
      renderAdminDashboard();
      fetchCcas();
    } else {
      showToast(`Publish Error: ${data.message}`, "error");
    }
  } catch (err) {
    showToast("Failed to create event.", "error");
  }
}

// ----------------------------------------------------
// SURVEY FLOW (Analytics Pillar)
// ----------------------------------------------------
function renderSurveyTags() {
  const container = document.getElementById('surveyTagsContainer');
  container.innerHTML = ALL_INTEREST_TAGS.map(tag => `
    <label style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); padding:5px 12px; border-radius:18px; font-size:0.8rem; cursor:pointer; display:flex; align-items:center; gap:6px; color:#c4b5fd;">
      <input type="checkbox" value="${tag}" ${['tech', 'ai', 'coding'].includes(tag) ? 'checked' : ''}>
      #${tag}
    </label>
  `).join('');
}

function openSurveyModal() {
  document.getElementById('surveyModal').classList.add('active');
}

function skipSurvey() {
  closeModal('surveyModal');
  if (currentUser) {
    currentUser.survey_completed = false;
  }
  document.getElementById('surveyBanner').innerHTML = `
    Showing all CCAs (Unsorted). <a href="#" onclick="openSurveyModal()" style="color:#fff; font-weight:700; text-decoration:underline;">Take Survey</a> to calculate your weighted match scores.
  `;
  fetchCcas();
  showToast("Survey skipped. Feed displayed without match scoring.", "info");
}

async function submitSurvey() {
  const selectedTags = Array.from(document.querySelectorAll('#surveyTagsContainer input:checked')).map(cb => cb.value);
  const commitment = document.getElementById('surveyCommitment').value;
  const style = document.getElementById('surveyStyle').value;

  if (selectedTags.length === 0) {
    showToast("Please select at least 1 interest tag.", "error");
    return;
  }

  if (currentUser) {
    currentUser.survey_completed = true;
    currentUser.survey_answers = {
      interest_tags: selectedTags,
      commitment_level: commitment,
      style: style
    };
  }

  closeModal('surveyModal');
  document.getElementById('surveyBanner').innerHTML = `
    ✨ <strong>Weighted Matching Active:</strong> Feed sorted by Analytics Algorithm ((0.5×Tags) + (0.3×Commitment) + (0.2×Style)).
  `;

  await fetchCcas(true, selectedTags, commitment, style);
  showToast("✨ Match scores calculated successfully!", "success");
}

// ----------------------------------------------------
// CCA FEED & API FETCHING
// ----------------------------------------------------
async function fetchCcas(isSurveyDone = false, tags = [], commitment = '', style = '') {
  try {
    let url = '/api/ccas?';
    if (isSurveyDone || (currentUser && currentUser.survey_completed)) {
      const survey = currentUser ? currentUser.survey_answers : { interest_tags: tags, commitment_level: commitment, style };
      url += `survey_completed=true&interest_tags=${survey.interest_tags.join(',')}&commitment_level=${survey.commitment_level}&style=${survey.style}&`;
    }
    if (activeCategory !== 'All') {
      url += `category=${encodeURIComponent(activeCategory)}&`;
    }
    if (searchQuery) {
      url += `search=${encodeURIComponent(searchQuery)}&`;
    }

    const res = await fetch(url);
    const data = await res.json();

    if (data.success) {
      allCcas = data.ccas;
      renderCcaFeed();
    }
  } catch (err) {
    console.error("Error fetching CCAs:", err);
  }
}

function renderCcaFeed() {
  const container = document.getElementById('ccaFeed');
  if (allCcas.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; color:var(--text-muted); text-align:center; padding:3rem;">No CCAs matched your search query.</p>`;
    return;
  }

  const studentTags = (currentUser && currentUser.survey_answers) ? currentUser.survey_answers.interest_tags.map(t => t.toLowerCase()) : [];

  container.innerHTML = allCcas.map(cca => {
    const isBookmarked = bookmarkedCcaIds.has(cca.id);
    const hasScore = cca.match_score !== null && cca.match_score !== undefined;

    return `
      <div class="cca-card">
        <div>
          <div class="cca-header">
            <div>
              <span class="cca-category">${cca.category}</span>
              <h3 class="cca-name">${cca.name}</h3>
            </div>
            ${hasScore ? `
              <div class="score-badge">
                <span>${cca.match_score}%</span>
                ${cca.is_recommended ? `<span class="rec-tag">PRO MATCH</span>` : ''}
              </div>
            ` : ''}
          </div>

          <p class="cca-desc">${cca.description}</p>

          <div class="tags-list">
            ${cca.tags.map(tag => {
              const isMatched = studentTags.includes(tag.toLowerCase());
              return `<span class="tag-pill ${isMatched ? 'matched' : ''}">#${tag}</span>`;
            }).join('')}
          </div>
        </div>

        <div class="cca-footer">
          <span class="meta-info">📍 ${cca.location}</span>
          <div style="display:flex; align-items:center; gap:10px;">
            <button class="bookmark-icon-btn ${isBookmarked ? 'active' : ''}" style="background:transparent; border:none; color:${isBookmarked ? '#f59e0b' : 'var(--text-muted)'}; font-size:1.25rem; cursor:pointer;" onclick="toggleBookmark('${cca.id}')">
              ${isBookmarked ? '★' : '☆'}
            </button>
            <button class="action-arrow-btn" title="View CCA Details" onclick="openCcaDetail('${cca.id}')">↗</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function setCategoryFilter(cat, btn) {
  activeCategory = cat;
  document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  fetchCcas(currentUser && currentUser.survey_completed);
}

function handleFilterChange() {
  searchQuery = document.getElementById('searchInput').value.trim();
  fetchCcas(currentUser && currentUser.survey_completed);
}

function toggleBookmark(ccaId) {
  if (bookmarkedCcaIds.has(ccaId)) {
    bookmarkedCcaIds.delete(ccaId);
    showToast("Removed from bookmarked CCAs.", "info");
  } else {
    bookmarkedCcaIds.add(ccaId);
    showToast("⭐ CCA bookmarked to My CCAs!", "success");
  }
  renderCcaFeed();
}

// ----------------------------------------------------
// CCA DETAIL & EVENT SIGNUP FLOW
// ----------------------------------------------------
async function openCcaDetail(ccaId) {
  try {
    const res = await fetch(`/api/ccas/${ccaId}`);
    const data = await res.json();

    if (!data.success) return;

    const cca = data.cca;
    const events = data.events;
    const isBookmarked = bookmarkedCcaIds.has(cca.id);

    const container = document.getElementById('ccaDetailContent');
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.2rem;">
        <div>
          <span style="font-size:0.75rem; color:#c4b5fd; font-weight:700; text-transform:uppercase;">${cca.category} (${cca.school})</span>
          <h2 style="font-family:var(--font-heading); font-size:1.7rem; font-weight:700; color:#fff;">${cca.name}</h2>
        </div>
        <button class="btn btn-outline btn-sm" onclick="closeModal('ccaDetailModal')">✕ Close</button>
      </div>

      <p style="color:#c4b5fd; font-size:0.925rem; margin-bottom:1.4rem; line-height:1.65;">${cca.description}</p>

      <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); padding:1.1rem; border-radius:var(--radius-md); margin-bottom:1.4rem;">
        <h4 style="font-size:0.875rem; color:#fff; margin-bottom:8px;">👥 EXCO Leadership Team</h4>
        <div style="display:flex; gap:14px; font-size:0.825rem; color:#c4b5fd;">
          ${cca.exco.map(e => `<span><strong>${e.role}:</strong> ${e.name}</span>`).join(' • ')}
        </div>
      </div>

      <h3 style="font-family:var(--font-heading); font-size:1.2rem; margin-bottom:0.85rem; color:#fff;">📅 Upcoming Events</h3>
      <div style="display:flex; flex-direction:column; gap:0.85rem; margin-bottom:1.6rem;">
        ${events.length === 0 ? `<p style="font-size:0.875rem; color:var(--text-muted);">No upcoming events scheduled.</p>` : 
          events.map(evt => {
            const isSignedUp = signedUpEventIds.has(evt.id);
            const isFull = evt.signup_count >= evt.capacity;
            const isPast = new Date(evt.datetime) <= new Date();

            return `
              <div style="background:var(--bg-primary); border:1px solid var(--border-subtle); padding:1.1rem; border-radius:var(--radius-sm); display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <h4 style="font-size:0.98rem; font-weight:700; color:#fff;">${evt.title}</h4>
                  <p style="font-size:0.825rem; color:var(--text-muted); margin-top:3px;">
                    📅 ${new Date(evt.datetime).toLocaleString()} | 📍 ${evt.location}
                  </p>
                  <span style="font-size:0.78rem; color:${isFull ? '#ef4444' : '#10b981'};">
                    Capacity: ${evt.signup_count} / ${evt.capacity} signed up
                  </span>
                </div>
                <div>
                  ${isSignedUp ? `
                    <span style="color:#10b981; font-size:0.825rem; font-weight:700;">✅ Registered</span>
                  ` : `
                    <button class="btn btn-primary btn-sm" ${isFull || isPast ? 'disabled' : ''} onclick="signUpForEvent('${evt.id}')">
                      ${isFull ? 'Full' : (isPast ? 'Closed' : 'Sign Up')}
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); padding-top:1.1rem;">
        <button class="btn btn-outline btn-sm" onclick="toggleBookmark('${cca.id}')">
          ${isBookmarked ? '★ Bookmarked' : '☆ Bookmark CCA'}
        </button>
        <span style="font-size:0.825rem; color:var(--text-muted);">📩 Contact: ${cca.contact.telegram}</span>
      </div>
    `;

    document.getElementById('ccaDetailModal').classList.add('active');
  } catch (err) {
    showToast("Failed to load CCA details.", "error");
  }
}

async function signUpForEvent(eventId) {
  if (!currentUser) {
    showToast("Please complete 2FA authentication first.", "error");
    openLoginModal(true);
    return;
  }

  try {
    const res = await fetch(`/api/events/${eventId}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: currentUser.np_student_id,
        student_name: currentUser.name
      })
    });
    const data = await res.json();

    if (data.success) {
      signedUpEventIds.add(eventId);
      closeModal('ccaDetailModal');
      showToast(`🎉 ${data.message}`, "success");
      appendTgMessage('bot', `✅ **Event Registration Success!**\n\nRegistered for **${data.event.title}**.\n🔔 Automated Outlook + Telegram reminder activated!`);
    } else {
      showToast(`Signup Failed (TDD Rule): ${data.message}`, "error");
    }
  } catch (err) {
    showToast("Event signup request error.", "error");
  }
}

// ----------------------------------------------------
// TDD AUTOMATED SUITE
// ----------------------------------------------------
async function runTDDSuite() {
  document.getElementById('tddModal').classList.add('active');
  const consoleElem = document.getElementById('tddConsole');
  consoleElem.innerHTML = `<span style="color:#8b949e;">[INFO] Initializing TDD RED Test Runner for Event Signup boundary conditions...</span><br>`;

  try {
    const res = await fetch('/api/tdd/run');
    const data = await res.json();

    let logs = `<span style="color:#a78bfa;">=== TDD SUITE RESULTS (${data.total} Tests) ===</span><br><br>`;
    data.suite.forEach((tc, idx) => {
      const color = tc.passed ? '#3fb950' : '#f85149';
      const statusText = tc.passed ? '✓ PASS' : '✗ FAIL';
      logs += `<span style="color:${color};">[TEST ${idx + 1}] ${statusText}: ${tc.test_name}</span><br>`;
      logs += `<span style="color:#8b949e;">  ├ Expected: ${tc.expected} | Actual: ${tc.actual}</span><br>`;
      logs += `<span style="color:#8b949e;">  └ Note: ${tc.reason}</span><br><br>`;
    });

    logs += `<span style="color:${data.allPassed ? '#3fb950' : '#f85149'};">FINAL RESULT: ${data.allPassed ? 'ALL SUITE TESTS PASSED (100%)' : 'TEST FAILURES DETECTED'}</span>`;
    consoleElem.innerHTML = logs;
  } catch (err) {
    consoleElem.innerHTML += `<span style="color:#f85149;">[ERROR] Failed to run TDD suite.</span>`;
  }
}

// ----------------------------------------------------
// LEAD PILLARS MODALS
// ----------------------------------------------------
function openAnalyticsModal() {
  document.getElementById('infoModalTitle').textContent = "📊 Analytics Pillar — Weighted Score Formula";
  document.getElementById('infoModalBody').innerHTML = `
    <p style="margin-bottom:1rem; color:#fff;"><strong>Defensible Matching Score Formula:</strong></p>
    <code style="background:#0b0914; border:1px solid rgba(167,139,250,0.3); padding:10px 14px; border-radius:10px; display:block; color:#c4b5fd; margin-bottom:1.2rem;">
      score(CCA) = (0.5 × interest_tag_overlap) + (0.3 × commitment_fit) + (0.2 × style_fit)
    </code>
    <ul style="padding-left:1.2rem; display:flex; flex-direction:column; gap:8px;">
      <li><strong>Interest Tag Overlap (0.5):</strong> Ratio of chosen student tags matched in CCA tags.</li>
      <li><strong>Commitment Fit (0.3):</strong> Exact match=1.0, adjacent tier=0.5, opposite=0.0.</li>
      <li><strong>Personality Style (0.2):</strong> Exact match=1.0, mixed=0.5, mismatch=0.0.</li>
    </ul>
  `;
  document.getElementById('infoModal').classList.add('active');
}

function openDefenceModal() {
  document.getElementById('infoModalTitle').textContent = "🛡️ Defence Pillar — Security Controls";
  document.getElementById('infoModalBody').innerHTML = `
    <p style="margin-bottom:0.85rem; color:#fff;"><strong>Security Controls Implemented:</strong></p>
    <ol style="padding-left:1.2rem; display:flex; flex-direction:column; gap:10px;">
      <li><strong>Multi-Factor Authentication (2FA):</strong> Mandatory 2FA OTP verification required on initial launch.</li>
      <li><strong>Role-Based Access Control (RBAC):</strong> Admin dashboard is restricted to verified EXCO members only. Non-EXCO students see only the student portal.</li>
      <li><strong>CIA Confidentiality Data Isolation:</strong> EXCO members can ONLY access signups for their assigned CCA and see student Name/ID only.</li>
    </ol>
  `;
  document.getElementById('infoModal').classList.add('active');
}

function openLegalTechModal() {
  document.getElementById('infoModalTitle').textContent = "⚖️ LegalTech Pillar — Compliance";
  document.getElementById('infoModalBody').innerHTML = `
    <p style="margin-bottom:0.85rem; color:#fff;"><strong>PDPA Compliance & Data Minimization:</strong></p>
    <p style="font-size:0.9rem; line-height:1.6; margin-bottom:1rem;">
      Data collected (NP Student ID, survey interests) is processed solely for matching and identity verification. Survey responses are never disclosed to third-party CCA leads.
    </p>
  `;
  document.getElementById('infoModal').classList.add('active');
}

// ----------------------------------------------------
// TELEGRAM BOT SIMULATOR
// ----------------------------------------------------
function toggleTelegramDrawer() {
  const drawer = document.getElementById('telegramDrawer');
  const icon = document.getElementById('tgToggleIcon');
  drawer.classList.toggle('collapsed');
  icon.textContent = drawer.classList.contains('collapsed') ? '▲' : '▼';
}

async function sendTgCommand(cmd) {
  appendTgMessage('user', cmd);

  try {
    const res = await fetch('/api/telegram/interact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd })
    });
    const data = await res.json();

    let buttonsHtml = '';
    if (data.buttons) {
      buttonsHtml = `<div class="inline-buttons">${data.buttons.map(b => `
        <button class="bot-btn" onclick="sendTgCommand('${b.action}')">${b.text}</button>
      `).join('')}</div>`;
    }

    appendTgMessage('bot', data.bot_response + buttonsHtml);
  } catch (err) {
    appendTgMessage('bot', '⚠️ Bot server connection error.');
  }
}

function appendTgMessage(sender, text) {
  const body = document.getElementById('telegramBody');
  const div = document.createElement('div');
  div.className = `chat-bubble ${sender}`;
  div.innerHTML = text.replace(/\n/g, '<br>');
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

// Helper Utilities
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function showToast(msg, type = "success") {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  if (type === 'error') toast.style.borderColor = '#ef4444';
  if (type === 'info') toast.style.borderColor = 'var(--accent-violet)';

  toast.innerHTML = `<span>${type === 'error' ? '❌' : '✨'}</span> ${msg}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}
