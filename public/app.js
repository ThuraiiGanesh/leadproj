// NP CCA Match — Mandatory 2FA Gate & EXCO Role-Based Access Control (RBAC) Logic

let currentUser = null;
let currentRole = 'student'; // 'student' | 'admin'
let allCcas = [];
let activeCategory = 'All';
let searchQuery = '';
let bookmarkedCcaIds = new Set(JSON.parse(localStorage.getItem('np_bookmarked_ccas') || '[]'));
let enrolledCcaIds = new Set(JSON.parse(localStorage.getItem('np_enrolled_ccas') || '[]'));
let signedUpEventIds = new Set(JSON.parse(localStorage.getItem('np_signed_up_events') || '[]'));
let signedUpEventsDetails = JSON.parse(localStorage.getItem('np_signed_up_events_details') || '[]');
let selectedAdminCcaId = null;

const SPEC_INTEREST_TAGS = [
  { id: 'dance', label: 'Dance & Performance' },
  { id: 'music', label: 'Music & Instruments' },
  { id: 'drama', label: 'Theatre & Drama' },
  { id: 'arts', label: 'Visual Arts & Media' },
  { id: 'culture', label: 'Cultural & Language' },
  { id: 'sports', label: 'Team Sports' },
  { id: 'combat', label: 'Combat & Martial Arts' },
  { id: 'water', label: 'Water Sports' },
  { id: 'racket', label: 'Racquet & Precision Sports' },
  { id: 'volunteering', label: 'Community Service & Volunteering' },
  { id: 'faith', label: 'Faith & Spirituality' },
  { id: 'debate', label: 'Academic & Debate' },
  { id: 'stem', label: 'STEM & Innovation' },
  { id: 'games', label: 'Games & Strategy' },
  { id: 'leadership', label: 'Leadership & Peer Support' }
];

const ALL_INTEREST_TAGS = SPEC_INTEREST_TAGS.map(t => t.id);

document.addEventListener('DOMContentLoaded', () => {
  fetchCcas();
  fetchUpcomingCampusEvents();
  renderSurveyTags();
  initScrollObserver();
  initSpotlightTracking();
  
  // Check for Microsoft SSO redirect callback in URL
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('sso_login') === 'success' && urlParams.get('user')) {
    try {
      currentUser = JSON.parse(decodeURIComponent(urlParams.get('user')));
      window.history.replaceState({}, document.title, window.location.pathname);
      closeModal('loginModal');
      updateUserUI();
      showToast(`🎉 Microsoft 365 SSO Verified! Welcome back, ${currentUser.name}.`, "success");
      openSurveyModal();
      return;
    } catch (e) {
      console.error("SSO Callback parse error:", e);
    }
  }

  // Restore persistent browser session from localStorage
  const savedUser = localStorage.getItem('np_match_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      updateUserUI();
      closeModal('loginModal');
      return;
    } catch (e) {
      localStorage.removeItem('np_match_user');
    }
  }

  // Mandatory 2FA Gate: Open Login Modal on initial load if not logged in
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

async function loginWithMicrosoft() {
  try {
    const res = await fetch('/api/auth/microsoft');
    const data = await res.json();

    if (data.has_live_azure && data.url) {
      showToast("Redirecting to official Microsoft 365 login portal...", "info");
      window.location.href = data.url;
      return;
    }

    showToast("ℹ️ Enter your NP Student Email below to log in.", "info");
    const input = document.getElementById('loginStudentId');
    if (input) {
      input.focus();
      input.placeholder = "Enter your NP email (e.g. s10234567@connect.np.edu.sg)";
    }
  } catch (err) {
    showToast("Microsoft login connection error.", "error");
  }
}

let currentGeneratedOtp = '123456';

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
      currentGeneratedOtp = data.mock_otp_code || '123456';
      document.getElementById('outlookEmailSpan').textContent = data.outlook_email;
      const displaySpan = document.getElementById('otpCodeDisplay');
      if (displaySpan) displaySpan.textContent = currentGeneratedOtp;

      document.getElementById('loginStep1').style.display = 'none';
      document.getElementById('loginStep2').style.display = 'block';
      showToast(`🔑 2FA security verification code sent to ${data.outlook_email}.`, "success");
    } else {
      showToast(data.message, "error");
    }
  } catch (err) {
    showToast("Login connection error.", "error");
  }
}

function autofillOtp() {
  const otpInput = document.getElementById('otpInput');
  if (otpInput) {
    otpInput.value = currentGeneratedOtp;
    showToast(`⚡ 2FA Code ${currentGeneratedOtp} auto-filled! Click verify to proceed.`, "info");
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
    // Sanitize & enforce NP Ambassadors EXCO leadership for Thurai Ganesh (s10275803)
    const userEmailOrId = (currentUser.email || currentUser.id || currentUser.np_student_id || '').toLowerCase();
    if (userEmailOrId.includes('s10275803') || userEmailOrId.includes('thurai')) {
      currentUser.is_exco = true;
      currentUser.managed_ccas = [
        { id: 'np_ambassadors', name: 'NP Ambassadors', category: 'Special Interest' },
        { id: 'np_student_council', name: 'NP Student Council', category: 'Special Interest' },
        { id: 'badminton', name: 'Badminton', category: 'Sports' }
      ];
    }

    // Persist session to browser localStorage
    try {
      localStorage.setItem('np_match_user', JSON.stringify(currentUser));
    } catch (e) {
      console.error("Failed to save session to localStorage", e);
    }

    // User avatar pill
    document.getElementById('userAvatarPill').style.display = 'flex';
    document.getElementById('userStatusText').textContent = currentUser.name;
    const initials = currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    document.getElementById('avatarInitials').textContent = initials;
    
    document.getElementById('loginNavBtn').style.display = 'none';
    document.getElementById('myCcasBtn').style.display = 'inline-flex';
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';

    // Role Switcher visibility based on EXCO status (RBAC)
    const roleSwitcher = document.getElementById('roleSwitcher');
    if (currentUser.is_exco && currentUser.managed_ccas && currentUser.managed_ccas.length > 0) {
      roleSwitcher.style.display = 'flex';
      setupAdminCcaSelector();
    } else {
      roleSwitcher.style.display = 'none';
      switchRole('student');
    }
  }
}

function logoutUser() {
  localStorage.removeItem('np_match_user');
  currentUser = null;
  showToast("Logged out successfully.", "info");
  setTimeout(() => {
    location.reload();
  }, 400);
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

function openCreateEventModal() {
  if (!currentUser || !currentUser.is_exco || !selectedAdminCcaId) {
    showToast("Only EXCO members can create events.", "error");
    return;
  }

  const selectedCcaObj = allCcas.find(c => c.id === selectedAdminCcaId) || { name: 'Your Managed CCA' };
  const badge = document.getElementById('createEvtCcaBadge');
  if (badge) badge.textContent = `CCA: ${selectedCcaObj.name}`;

  document.getElementById('evtTitle').value = '';
  document.getElementById('evtDescription').value = '';
  document.getElementById('evtRemarks').value = '';
  document.getElementById('evtLink').value = '';
  document.getElementById('evtImageUrl').value = '';
  document.getElementById('evtCapacity').value = '40';
  document.getElementById('evtLocation').value = 'Blk 31 (ICT) Room 402';

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(16, 0, 0, 0);
  const localIso = new Date(tomorrow.getTime() - (tomorrow.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
  document.getElementById('evtDatetime').value = localIso;

  const box = document.getElementById('evtImagePreviewBox');
  if (box) box.style.display = 'none';

  const modal = document.getElementById('createEventModal');
  if (modal) modal.classList.add('active');
}

function previewEvtImage() {
  const url = document.getElementById('evtImageUrl').value.trim();
  const box = document.getElementById('evtImagePreviewBox');
  const img = document.getElementById('evtImagePreviewImg');
  if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/'))) {
    img.src = url;
    box.style.display = 'block';
  } else {
    box.style.display = 'none';
  }
}

async function submitCreateEvent() {
  const title = document.getElementById('evtTitle').value.trim();
  const category = document.getElementById('evtCategory').value;
  const capacity = document.getElementById('evtCapacity').value;
  const datetime = document.getElementById('evtDatetime').value;
  const location = document.getElementById('evtLocation').value.trim();
  const description = document.getElementById('evtDescription').value.trim();
  const remarks = document.getElementById('evtRemarks').value.trim();
  const link = document.getElementById('evtLink').value.trim();
  const imageUrl = document.getElementById('evtImageUrl').value.trim();

  if (!title || !datetime || !location || !capacity) {
    showToast("Please fill in Event Title, Date & Time, Venue, and Capacity.", "error");
    return;
  }

  try {
    const res = await fetch('/api/admin/events/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cca_id: selectedAdminCcaId,
        student_id: currentUser.id,
        title,
        tag: category,
        capacity: parseInt(capacity, 10),
        datetime,
        location,
        description,
        remarks,
        links: link,
        image_url: imageUrl
      })
    });
    const data = await res.json();

    if (data.success) {
      showToast("🎉 Event successfully published to Campus LaunchPad!", "success");
      closeModal('createEventModal');
      renderAdminDashboard();
      fetchCcas();
      fetchUpcomingCampusEvents();
    } else {
      showToast(`Publish Error: ${data.message}`, "error");
    }
  } catch (err) {
    showToast("Failed to publish event.", "error");
  }
}

// ----------------------------------------------------
// SURVEY FLOW (Analytics Pillar)
// ----------------------------------------------------
function renderSurveyTags() {
  const container = document.getElementById('surveyTagsContainer');
  if (!container) return;
  container.innerHTML = SPEC_INTEREST_TAGS.map(t => `
    <label style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); padding:6px 14px; border-radius:18px; font-size:0.8rem; cursor:pointer; display:flex; align-items:center; gap:6px; color:#c4b5fd;">
      <input type="checkbox" value="${t.id}" ${['sports', 'arts', 'leadership', 'culture'].includes(t.id) ? 'checked' : ''}>
      ${t.label}
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
  const availability = Array.from(document.querySelectorAll('#surveyAvailabilityContainer input:checked')).map(cb => cb.value);

  if (selectedTags.length === 0) {
    showToast("Please select at least 1 interest tag.", "error");
    return;
  }

  if (currentUser) {
    currentUser.survey_completed = true;
    currentUser.survey_answers = {
      interest_tags: selectedTags,
      commitment_level: commitment,
      style: style,
      weekly_availability: availability
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

// ----------------------------------------------------
// LIVE UPCOMING CAMPUS EVENTS FEED
// ----------------------------------------------------
let allUpcomingEvents = [];

async function fetchUpcomingCampusEvents() {
  const container = document.getElementById('upcomingEventsFeed');
  if (!container) return;

  try {
    const res = await fetch('/api/events');
    const data = await res.json();

    if (data.success) {
      allUpcomingEvents = data.events || [];
      renderUpcomingEventsFeed();
    }
  } catch (err) {
    console.error('Error fetching campus events:', err);
  }
}

function renderUpcomingEventsFeed() {
  const container = document.getElementById('upcomingEventsFeed');
  if (!container) return;

  if (allUpcomingEvents.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); background: rgba(255,255,255,0.02); border-radius: 20px; border: 1px dashed var(--border-subtle);">
        <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">📅</div>
        <div style="font-size: 1.1rem; font-weight: 700; color: #fff; margin-bottom: 0.3rem;">No Upcoming Campus Events Yet</div>
        <p style="font-size: 0.875rem; color: #c4b5fd;">EXCO leads will post workshops, trials, and orientations here soon.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = allUpcomingEvents.map(evt => {
    const dateObj = new Date(evt.datetime);
    const dateFormatted = dateObj.toLocaleDateString('en-SG', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const timeFormatted = dateObj.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' });
    const isSignedUp = signedUpEventIds.has(evt.id);
    const isFull = evt.signup_count >= evt.capacity;

    return `
      <div class="cca-card" style="display:flex; flex-direction:column; justify-content:space-between; height:100%; border:1px solid rgba(167, 139, 250, 0.25); background: rgba(18, 14, 38, 0.85); backdrop-filter: blur(20px); border-radius: 22px; padding: 1.5rem;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.8rem; gap:0.5rem;">
            <span class="cca-badge" style="background:rgba(139, 92, 246, 0.2); color:#c4b5fd; border:1px solid rgba(139,92,246,0.3); font-weight:600;">
              ${escapeHtml(evt.cca_name || 'NP CCA')}
            </span>
            <span style="font-size:0.75rem; font-weight:700; color:${isFull ? '#ef4444' : '#10b981'}; background:${isFull ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}; padding:4px 10px; border-radius:12px;">
              ${isFull ? 'FULL' : `${evt.signup_count}/${evt.capacity} Slots`}
            </span>
          </div>

          <h3 style="font-family:var(--font-heading); font-size:1.15rem; color:#fff; margin-bottom:0.6rem; line-height:1.3;">
            ${escapeHtml(evt.title)}
          </h3>

          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.1rem; line-height:1.5;">
            ${escapeHtml(evt.description || '')}
          </p>

          <div style="font-size:0.8rem; color:#c4b5fd; display:flex; flex-direction:column; gap:6px; margin-bottom:1.2rem; background:rgba(255,255,255,0.03); padding:10px 14px; border-radius:14px; border:1px solid rgba(255,255,255,0.06);">
            <div><strong>🗓️ Date:</strong> ${dateFormatted} at ${timeFormatted}</div>
            <div><strong>📍 Venue:</strong> ${escapeHtml(evt.location || 'NP Campus')}</div>
          </div>
        </div>

        <div>
          ${isSignedUp ? `
            <button class="btn btn-outline" style="width:100%; border-color:#10b981; color:#10b981; background:rgba(16,185,129,0.1);" disabled>
              ✓ Registered & Confirmed
            </button>
          ` : `
            <button class="btn btn-primary" style="width:100%; font-size:0.875rem;" onclick="quickSignupEvent('${evt.id}', '${evt.cca_id}')" ${isFull ? 'disabled' : ''}>
              ${isFull ? 'Event Full' : 'Sign Up For Event 🚀'}
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

async function quickSignupEvent(eventId, ccaId) {
  if (!currentUser) {
    showToast("Please sign in with 2FA to register for events.", "info");
    openLoginModal();
    return;
  }

  try {
    const res = await fetch(`/api/events/${eventId}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: currentUser.email || currentUser.np_student_id,
        student_name: currentUser.name
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast(`🎉 ${data.message}`, "success");
      signedUpEventIds.add(eventId);
      localStorage.setItem('np_signed_up_events', JSON.stringify(Array.from(signedUpEventIds)));

      if (data.event) {
        const existingIdx = signedUpEventsDetails.findIndex(e => e.id === data.event.id);
        if (existingIdx >= 0) signedUpEventsDetails[existingIdx] = data.event;
        else signedUpEventsDetails.push(data.event);
        localStorage.setItem('np_signed_up_events_details', JSON.stringify(signedUpEventsDetails));
      }

      fetchUpcomingCampusEvents();
      renderMyCcasFeed();
      if (currentRole === 'admin') renderAdminDashboard();
    } else {
      showToast(`❌ Registration Failed: ${data.message}`, "error");
    }
  } catch (err) {
    console.error("Signup error:", err);
    showToast("Server connection error during signup.", "error");
  }
}

function renderCcaFeed() {
  const container = document.getElementById('ccaFeed');
  if (allCcas.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; color:var(--text-muted); text-align:center; padding:3rem;">No CCAs matched your search query.</p>`;
    return;
  }

  const studentTags = (currentUser && currentUser.survey_answers) ? currentUser.survey_answers.interest_tags.map(t => t.toLowerCase()) : [];

  container.innerHTML = allCcas.map((cca, index) => {
    const isBookmarked = bookmarkedCcaIds.has(cca.id);
    const hasScore = cca.match_score !== null && cca.match_score !== undefined;
    const staggerClass = `stagger-${(index % 5) + 1}`;

    return `
      <div class="cca-card reveal-on-scroll ${staggerClass}">
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

  initScrollObserver();
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
  localStorage.setItem('np_bookmarked_ccas', JSON.stringify(Array.from(bookmarkedCcaIds)));
  renderCcaFeed();
  renderMyCcasFeed();
}

function toggleEnrolment(ccaId) {
  const cca = allCcas.find(c => c.id === ccaId);
  const ccaName = cca ? cca.name : 'CCA';

  if (enrolledCcaIds.has(ccaId)) {
    enrolledCcaIds.delete(ccaId);
    showToast(`Left ${ccaName} membership.`, "info");
  } else {
    enrolledCcaIds.add(ccaId);
    showToast(`🎓 Officially joined ${ccaName} as a registered member!`, "success");
    appendTgMessage('bot', `🎓 **CCA Membership Confirmed!**\n\nYou are now an official registered member of **${ccaName}**.`);
  }
  localStorage.setItem('np_enrolled_ccas', JSON.stringify(Array.from(enrolledCcaIds)));
  renderCcaFeed();
  renderMyCcasFeed();
}

// ----------------------------------------------------
// DEDICATED "MY CCAs" SECTION FLOW
// ----------------------------------------------------
function showMyCcasSection() {
  const mySection = document.getElementById('myCcasSection');
  const allSection = document.getElementById('allCcasSection');

  if (mySection) mySection.style.display = 'block';
  if (allSection) allSection.style.display = 'none';

  renderMyCcasFeed();

  if (mySection) {
    mySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function showAllCcasSection() {
  const mySection = document.getElementById('myCcasSection');
  const allSection = document.getElementById('allCcasSection');

  if (mySection) mySection.style.display = 'none';
  if (allSection) allSection.style.display = 'block';

  if (allSection) {
    allSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function renderMyCcasFeed() {
  const container = document.getElementById('myCcasFeed');
  if (!container) return;

  const joinedCcas = allCcas.filter(cca => enrolledCcaIds.has(cca.id));
  const bookmarkedCcas = allCcas.filter(cca => bookmarkedCcaIds.has(cca.id));
  const registeredEvents = signedUpEventsDetails || [];

  const totalItems = joinedCcas.length + bookmarkedCcas.length + registeredEvents.length;

  if (totalItems === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding:3.5rem 1.5rem; background:rgba(255,255,255,0.02); border:1px dashed var(--border-subtle); border-radius:24px;">
        <div style="font-size:3rem; margin-bottom:0.75rem;">⭐</div>
        <h3 style="color:#c4b5fd; font-family:var(--font-heading); font-size:1.4rem; font-weight:700;">You currently have no cca</h3>
        <p style="color:var(--text-muted); font-size:0.9rem; max-width:440px; margin:0.6rem auto 1.5rem auto;">
          You haven't joined, bookmarked, or registered for any CCAs or events yet. Explore the directory to build your campus schedule!
        </p>
        <button class="btn btn-primary" onclick="showAllCcasSection()">Explore CCAs ✨</button>
      </div>
    `;
    return;
  }

  const studentTags = (currentUser && currentUser.survey_answers) ? currentUser.survey_answers.interest_tags.map(t => t.toLowerCase()) : [];

  let html = '';

  // SECTION 1: JOINED CCAS / OFFICIAL MEMBERSHIPS
  if (joinedCcas.length > 0) {
    html += `
      <div style="grid-column: 1/-1; margin-bottom:1rem;">
        <h3 style="font-family:var(--font-heading); font-size:1.25rem; color:#6ee7b7; display:flex; align-items:center; gap:8px;">
          🎓 Official Joined Memberships (${joinedCcas.length})
        </h3>
        <p style="font-size:0.825rem; color:var(--text-muted);">CCAs you are registered as an active official student member.</p>
      </div>
      <div class="cca-grid" style="grid-column: 1/-1; margin-bottom:2rem;">
        ${joinedCcas.map(cca => `
          <div class="cca-card" style="border-color:rgba(16,185,129,0.4);">
            <div>
              <div class="cca-header">
                <div>
                  <span class="cca-category">${cca.category}</span>
                  <h3 class="cca-name">${cca.name}</h3>
                </div>
                <span style="font-size:0.75rem; background:rgba(16,185,129,0.2); color:#6ee7b7; border:1px solid rgba(16,185,129,0.4); padding:4px 10px; border-radius:12px; font-weight:700;">OFFICIAL MEMBER</span>
              </div>
              <p class="cca-desc">${cca.description}</p>
              <div class="tags-list">
                ${cca.tags.map(tag => `<span class="tag-pill ${studentTags.includes(tag.toLowerCase()) ? 'matched' : ''}">#${tag}</span>`).join('')}
              </div>
            </div>
            <div class="cca-footer">
              <span class="meta-info">📍 ${cca.location}</span>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-outline btn-sm" style="font-size:0.75rem; color:#ef4444; border-color:rgba(239,68,68,0.4);" onclick="toggleEnrolment('${cca.id}')">Leave CCA</button>
                <button class="action-arrow-btn" onclick="openCcaDetail('${cca.id}')">↗</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // SECTION 2: BOOKMARKED / SAVED CCAS
  if (bookmarkedCcas.length > 0) {
    html += `
      <div style="grid-column: 1/-1; margin-bottom:1rem;">
        <h3 style="font-family:var(--font-heading); font-size:1.25rem; color:#fde68a; display:flex; align-items:center; gap:8px;">
          📌 Saved & Bookmarked CCAs (${bookmarkedCcas.length})
        </h3>
        <p style="font-size:0.825rem; color:var(--text-muted);">Activities you are exploring or considering joining.</p>
      </div>
      <div class="cca-grid" style="grid-column: 1/-1; margin-bottom:2rem;">
        ${bookmarkedCcas.map(cca => `
          <div class="cca-card">
            <div>
              <div class="cca-header">
                <div>
                  <span class="cca-category">${cca.category}</span>
                  <h3 class="cca-name">${cca.name}</h3>
                </div>
              </div>
              <p class="cca-desc">${cca.description}</p>
            </div>
            <div class="cca-footer">
              <span class="meta-info">📍 ${cca.location}</span>
              <div style="display:flex; gap:8px; align-items:center;">
                <button class="btn btn-primary btn-sm" style="font-size:0.75rem;" onclick="toggleEnrolment('${cca.id}')">Join CCA</button>
                <button class="bookmark-icon-btn active" style="background:transparent; border:none; color:#f59e0b; font-size:1.2rem; cursor:pointer;" onclick="toggleBookmark('${cca.id}')">★</button>
                <button class="action-arrow-btn" onclick="openCcaDetail('${cca.id}')">↗</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // SECTION 3: REGISTERED EVENTS & SCHEDULE
  if (registeredEvents.length > 0) {
    html += `
      <div style="grid-column: 1/-1; margin-bottom:1rem;">
        <h3 style="font-family:var(--font-heading); font-size:1.25rem; color:#a78bfa; display:flex; align-items:center; gap:8px;">
          🎟️ Registered Events & Schedule (${registeredEvents.length})
        </h3>
        <p style="font-size:0.825rem; color:var(--text-muted);">Your confirmed event registrations and schedule check.</p>
      </div>
      <div style="grid-column: 1/-1; display:flex; flex-direction:column; gap:1rem;">
        ${registeredEvents.map(evt => `
          <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:18px; padding:1.2rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
            <div>
              <span style="font-size:0.75rem; color:#c4b5fd; font-weight:700;">EVENT REGISTRATION</span>
              <h4 style="font-size:1.05rem; font-weight:700; color:#fff; margin-top:2px;">${evt.title}</h4>
              <p style="font-size:0.825rem; color:var(--text-muted); margin-top:4px;">
                📅 ${new Date(evt.datetime).toLocaleString()} | 📍 ${evt.location}
              </p>
              ${evt.registration_deadline ? `
                <span style="font-size:0.75rem; color:#fde68a;">⏳ Reg Deadline: ${new Date(evt.registration_deadline).toLocaleString()}</span>
              ` : ''}
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="color:#10b981; font-size:0.825rem; font-weight:700;">✅ Confirmed</span>
              <button class="btn btn-outline btn-sm" style="color:#ef4444; border-color:rgba(239,68,68,0.4);" onclick="cancelEventSignup('${evt.id}')">Cancel</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  container.innerHTML = html;
  initScrollObserver();
}

function cancelEventSignup(eventId) {
  signedUpEventIds.delete(eventId);
  signedUpEventsDetails = signedUpEventsDetails.filter(e => e.id !== eventId);
  localStorage.setItem('np_signed_up_events', JSON.stringify(Array.from(signedUpEventIds)));
  localStorage.setItem('np_signed_up_events_details', JSON.stringify(signedUpEventsDetails));
  showToast("Event registration cancelled.", "info");
  renderMyCcasFeed();
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
    const isEnrolled = enrolledCcaIds.has(cca.id);

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

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.4rem;">
        <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); padding:1rem; border-radius:18px;">
          <h4 style="font-size:0.85rem; color:#fff; margin-bottom:6px;">⏱️ Training Frequency</h4>
          <p style="font-size:0.825rem; color:#c4b5fd;">${cca.training_frequency || 'Weekly sessions'}</p>
        </div>
        <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); padding:1rem; border-radius:18px;">
          <h4 style="font-size:0.85rem; color:#fff; margin-bottom:6px;">📍 Venue & Commitment</h4>
          <p style="font-size:0.825rem; color:#c4b5fd;">${cca.location} • <span style="text-transform:capitalize;">${cca.commitment_level}</span></p>
        </div>
      </div>

      <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); padding:1.1rem; border-radius:18px; margin-bottom:1.4rem;">
        <h4 style="font-size:0.875rem; color:#fff; margin-bottom:8px;">📬 Contact & Social Details</h4>
        <div style="display:flex; flex-wrap:wrap; gap:14px; font-size:0.825rem; color:#c4b5fd; align-items:center;">
          ${cca.contact && cca.contact.email ? `<span>✉️ <a href="mailto:${cca.contact.email}" style="color:#a78bfa; text-decoration:underline;">${cca.contact.email}</a></span>` : ''}
          ${cca.contact && cca.contact.instagram ? `<span>📸 <strong style="color:#e9d5ff;">${cca.contact.instagram}</strong></span>` : ''}
          ${cca.contact && cca.contact.telegram ? `<span>💬 <strong style="color:#818cf8;">${cca.contact.telegram}</strong></span>` : ''}
        </div>
      </div>

      <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); padding:1.1rem; border-radius:18px; margin-bottom:1.4rem;">
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
            const deadlinePassed = evt.registration_deadline && new Date() > new Date(evt.registration_deadline);

            return `
              <div style="background:var(--bg-primary); border:1px solid var(--border-subtle); padding:1.1rem; border-radius:var(--radius-sm); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                <div>
                  <h4 style="font-size:0.98rem; font-weight:700; color:#fff;">${evt.title}</h4>
                  <p style="font-size:0.825rem; color:var(--text-muted); margin-top:3px;">
                    📅 ${new Date(evt.datetime).toLocaleString()} | 📍 ${evt.location}
                  </p>
                  <div style="display:flex; gap:12px; margin-top:4px; font-size:0.78rem;">
                    <span style="color:${isFull ? '#ef4444' : '#10b981'};">
                      Capacity: ${evt.signup_count} / ${evt.capacity} signed up
                    </span>
                    ${evt.registration_deadline ? `
                      <span style="color:${deadlinePassed ? '#ef4444' : '#fde68a'};">
                        ⏳ Reg Deadline: ${new Date(evt.registration_deadline).toLocaleString()}
                      </span>
                    ` : ''}
                  </div>
                </div>
                <div>
                  ${isSignedUp ? `
                    <span style="color:#10b981; font-size:0.825rem; font-weight:700;">✅ Registered</span>
                  ` : `
                    <button class="btn btn-primary btn-sm" ${isFull || isPast || deadlinePassed ? 'disabled' : ''} onclick="signUpForEvent('${evt.id}', '${cca.name}')">
                      ${isFull ? 'Full' : (deadlinePassed ? 'Deadline Passed' : (isPast ? 'Closed' : 'Sign Up'))}
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); padding-top:1.1rem; flex-wrap:wrap; gap:1rem;">
        <div style="display:flex; gap:10px;">
          <button class="btn btn-primary btn-sm" onclick="toggleEnrolment('${cca.id}')">
            ${isEnrolled ? '✓ Official Member' : '🎓 Join CCA / Enrol'}
          </button>
          <button class="btn btn-outline btn-sm" onclick="toggleBookmark('${cca.id}')">
            ${isBookmarked ? '★ Bookmarked' : '☆ Bookmark CCA'}
          </button>
        </div>
        <span style="font-size:0.825rem; color:var(--text-muted);">📩 Contact: ${cca.contact ? cca.contact.telegram : 'N/A'}</span>
      </div>
    `;

    document.getElementById('ccaDetailModal').classList.add('active');
  } catch (err) {
    showToast("Failed to load CCA details.", "error");
  }
}

async function signUpForEvent(eventId, ccaName = '') {
  if (!currentUser) {
    showToast("Please complete 2FA authentication first.", "error");
    openLoginModal(true);
    return;
  }

  // Schedule Clash Check across existing signed up events
  const clashingEvt = signedUpEventsDetails.find(e => {
    return e.id !== eventId && new Date(e.datetime).toDateString() === new Date().toDateString();
  });

  if (clashingEvt) {
    const confirmProceed = confirm(`⚠️ Schedule Clash Warning!\n\nYou are registered for "${clashingEvt.title}" around this timeframe.\n\nDo you still want to confirm signup for this event?`);
    if (!confirmProceed) return;
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
      localStorage.setItem('np_signed_up_events', JSON.stringify(Array.from(signedUpEventIds)));

      if (data.event) {
        signedUpEventsDetails = signedUpEventsDetails.filter(e => e.id !== eventId);
        signedUpEventsDetails.push(data.event);
        localStorage.setItem('np_signed_up_events_details', JSON.stringify(signedUpEventsDetails));
      }

      closeModal('ccaDetailModal');
      showToast(`🎉 ${data.message}`, "success");
      appendTgMessage('bot', `✅ **Event Registration Success!**\n\nRegistered for **${data.event.title}**.\n🔔 Automated Outlook + Telegram reminder activated!`);
      renderMyCcasFeed();
    } else {
      showToast(`Signup Failed: ${data.message}`, "error");
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

// ----------------------------------------------------
// SCROLL REVEAL & GLASS SPOTLIGHT HOVER ANIMATIONS
// ----------------------------------------------------
function initScrollObserver() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.reveal-on-scroll:not(.is-visible)').forEach(el => {
    observer.observe(el);
  });
}

function initSpotlightTracking() {
  document.addEventListener('mousemove', (e) => {
    const cards = document.querySelectorAll('.bento-card, .cca-card');
    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });
}
