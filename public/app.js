// NP CCA Match — Campus Life Discovery & RBAC Logic

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

// 15 SPEC Interest Categories
const SPEC_INTEREST_TAGS = [
  { id: 'dance', label: 'Dance & Performance' },
  { id: 'music', label: 'Music & Instruments' },
  { id: 'drama', label: 'Theatre & Drama' },
  { id: 'arts', label: 'Visual Arts & Media' },
  { id: 'culture', label: 'Cultural & Language' },
  { id: 'sports', label: 'Team Sports' },
  { id: 'combat', label: 'Combat & Individual Sports' },
  { id: 'water', label: 'Water Sports' },
  { id: 'racket', label: 'Racquet & Precision Sports' },
  { id: 'volunteering', label: 'Community Service & Volunteering' },
  { id: 'faith', label: 'Faith & Spirituality' },
  { id: 'academic', label: 'Academic/Debate & Current Affairs' },
  { id: 'stem', label: 'STEM & Innovation' },
  { id: 'games', label: 'Games & Strategy' },
  { id: 'leadership', label: 'Leadership & Peer Support' }
];

// List of Open Events CCAs (Don't require prior membership)
const OPEN_EVENTS_CCA_IDS = [
  'leo_club', 'rotaract_club', 'food_aid', 'environmental_rangers', 
  'red_cross_youth', 'np_mentors', 'bb_primers'
];

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
      showToast(`Microsoft 365 SSO Verified! Welcome back, ${currentUser.name}.`, "success");
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

  // Open Login Modal on initial load if not logged in
  openLoginModal(true);
});

// Helper to refresh icons
function renderIcons() {
  setTimeout(() => {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }, 50);
}

// ----------------------------------------------------
// ROLE SWITCHING
// ----------------------------------------------------
function switchRole(role) {
  if (role === 'admin' && (!currentUser || !currentUser.is_exco)) {
    showToast("Access restricted to CCA EXCO Members only.", "error");
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
  renderIcons();
}

// ----------------------------------------------------
// AUTH & 2FA GATE FLOW
// ----------------------------------------------------
function openLoginModal(isMandatory = false) {
  document.getElementById('loginStep1').style.display = 'block';
  document.getElementById('loginStep2').style.display = 'none';
  const modal = document.getElementById('loginModal');
  modal.classList.add('active');
  renderIcons();
}

function loginWithMicrosoft() {
  showToast("Enter your NP Student Email to log in.", "info");
  const input = document.getElementById('loginStudentId');
  if (input) {
    input.focus();
    input.placeholder = "e.g. s99999999@connect.np.edu.sg";
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
      document.getElementById('outlookEmailSpan').textContent = data.outlook_email || 's99999999@connect.np.edu.sg';
      
      const demoCodeSpan = document.getElementById('demoCodeSpan');
      if (demoCodeSpan) demoCodeSpan.textContent = currentGeneratedOtp;

      document.getElementById('loginStep1').style.display = 'none';
      document.getElementById('loginStep2').style.display = 'block';
      showToast(`Verification code sent to Outlook email.`, "success");
    } else {
      showToast(data.message, "error");
    }
  } catch (err) {
    showToast("Login connection error.", "error");
  }
  renderIcons();
}

function toggleDemoCodeDisplay(checkbox) {
  const box = document.getElementById('demoCodeBox');
  if (box) box.style.display = checkbox.checked ? 'block' : 'none';
}

function autofillDemoCode() {
  const input = document.getElementById('otpInput');
  if (input) input.value = currentGeneratedOtp || '123456';
  showToast("Verification code auto-filled.", "info");
}

async function submit2FA() {
  const studentId = document.getElementById('loginStudentId').value.trim() || 's99999999@connect.np.edu.sg';
  const otpCode = document.getElementById('otpInput').value.trim();

  if (!otpCode) {
    showToast("Please enter the 6-digit verification code.", "error");
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
        showToast(`Welcome EXCO Lead, ${currentUser.name}! Admin Portal unlocked for ${currentUser.managed_ccas.map(c => c.name).join(', ')}.`, "success");
      } else {
        showToast(`Welcome back, ${currentUser.name}! Logged in as Student.`, "success");
      }

      openSurveyModal();
    } else {
      showToast(data.message, "error");
    }
  } catch (err) {
    showToast("2FA verification failed.", "error");
  }
  renderIcons();
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

    try {
      localStorage.setItem('np_match_user', JSON.stringify(currentUser));
    } catch (e) {
      console.error("Failed to save session to localStorage", e);
    }

    document.getElementById('userAvatarPill').style.display = 'flex';
    document.getElementById('userStatusText').textContent = currentUser.name;
    const initials = currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    document.getElementById('avatarInitials').textContent = initials;
    
    document.getElementById('loginNavBtn').style.display = 'none';
    document.getElementById('myCcasBtn').style.display = 'inline-flex';
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';

    const roleSwitcher = document.getElementById('roleSwitcher');
    if (currentUser.is_exco && currentUser.managed_ccas && currentUser.managed_ccas.length > 0) {
      roleSwitcher.style.display = 'flex';
      setupAdminCcaSelector();
    } else {
      roleSwitcher.style.display = 'none';
      switchRole('student');
    }
  }
  renderIcons();
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
      <div style="background:var(--paper); border:1px solid var(--border-subtle); padding:1rem; border-radius:var(--radius-sm); margin-bottom:0.75rem; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h4 style="font-size:0.925rem; font-weight:700; color:var(--ink-navy);">${escapeHtml(evt.title)}</h4>
          <p style="font-size:0.78rem; color:var(--text-muted);">🗓️ ${new Date(evt.datetime).toLocaleString()}</p>
        </div>
        <button class="btn btn-outline btn-sm" onclick="fetchAdminRoster('${evt.id}')">View Roster</button>
      </div>
    `).join('');

    if (eventsList.length > 0) {
      fetchAdminRoster(eventsList[0].id);
    }
  } catch (err) {
    console.error("Admin Dashboard Error:", err);
  }
  renderIcons();
}

async function fetchAdminRoster(eventId) {
  try {
    const res = await fetch(`/api/admin/events/${eventId}/signups`);
    const data = await res.json();

    if (!data.success) return;

    const container = document.getElementById('adminRosterList');
    container.innerHTML = `
      <h4 style="font-size:0.95rem; font-weight:700; color:var(--ink-navy); margin-bottom:0.6rem;">${escapeHtml(data.event_title)} (${data.signup_count}/${data.capacity} Slots)</h4>
      ${data.signups.length === 0 ? `<p style="font-size:0.875rem; color:var(--text-muted);">No student signups yet.</p>` : `
        <table style="width:100%; font-size:0.825rem; border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--border-subtle); text-align:left; color:var(--text-muted);">
              <th style="padding:6px;">Student Name</th>
              <th style="padding:6px;">NP Student ID</th>
            </tr>
          </thead>
          <tbody>
            ${data.signups.map(s => `
              <tr style="border-bottom:1px solid var(--border-subtle);">
                <td style="padding:6px; font-weight:600; color:var(--ink-navy);">${escapeHtml(s.name)}</td>
                <td style="padding:6px; color:var(--text-muted);">${escapeHtml(s.student_id)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    `;
  } catch (err) {
    showToast("Failed to fetch student roster.", "error");
  }
  renderIcons();
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

  const deadline = new Date(tomorrow.getTime() - 4 * 3600000);
  const deadlineIso = new Date(deadline.getTime() - (deadline.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
  document.getElementById('evtRegDeadline').value = deadlineIso;

  const modal = document.getElementById('createEventModal');
  if (modal) modal.classList.add('active');
  renderIcons();
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
  const regDeadline = document.getElementById('evtRegDeadline').value;
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
        registration_deadline: regDeadline || datetime,
        location,
        description,
        remarks,
        links: link,
        image_url: imageUrl
      })
    });
    const data = await res.json();

    if (data.success) {
      showToast("Event successfully published to Campus Life!", "success");
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
// SURVEY FLOW
// ----------------------------------------------------
function renderSurveyTags() {
  const container = document.getElementById('surveyTagsContainer');
  if (!container) return;
  container.innerHTML = SPEC_INTEREST_TAGS.map(t => `
    <label style="background:var(--paper); border:1px solid var(--border-subtle); padding:6px 12px; border-radius:9999px; font-size:0.8rem; cursor:pointer; display:flex; align-items:center; gap:6px; color:var(--ink-navy);">
      <input type="checkbox" value="${t.id}" ${['sports', 'arts', 'leadership', 'culture'].includes(t.id) ? 'checked' : ''}>
      ${t.label}
    </label>
  `).join('');
}

function openSurveyModal() {
  document.getElementById('surveyModal').classList.add('active');
  renderIcons();
}

function skipSurvey() {
  closeModal('surveyModal');
  if (currentUser) {
    currentUser.survey_completed = false;
  }
  document.getElementById('surveyBanner').innerHTML = `
    Showing all 81 CCAs. Take the <a href="#" onclick="openSurveyModal()" style="color:var(--ink-navy); font-weight:700; text-decoration:underline;">Matching Survey</a> to see your personalized matches.
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
    <strong>Personalized Matches Active:</strong> Sorted by match score algorithm.
  `;

  await fetchCcas(true, selectedTags, commitment, style);
  showToast("Match scores calculated successfully!", "success");
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
      <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); background: var(--paper); border-radius: 14px; border: 1px dashed var(--border-subtle);">
        <div style="font-size: 1.1rem; font-weight: 700; color: var(--ink-navy); margin-bottom: 0.3rem;">No Upcoming Campus Events Yet</div>
        <p style="font-size: 0.875rem; color: var(--text-muted);">EXCO leads will post workshops, trials, and orientations here soon.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = allUpcomingEvents.map(evt => {
    const dateObj = new Date(evt.datetime);
    const dateFormatted = dateObj.toLocaleDateString('en-SG', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const timeFormatted = dateObj.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' });
    
    let regFormatted = '';
    if (evt.registration_deadline) {
      const regObj = new Date(evt.registration_deadline);
      regFormatted = regObj.toLocaleDateString('en-SG', { month: 'short', day: 'numeric' });
    }

    const isSignedUp = signedUpEventIds.has(evt.id);
    const isFull = evt.signup_count >= evt.capacity;

    return `
      <div class="cca-card" style="display:flex; flex-direction:column; justify-content:space-between; height:100%;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.8rem; gap:0.5rem;">
            <span class="cca-category">
              ${escapeHtml(evt.cca_name || 'NP CCA')}
            </span>
            <span style="font-size:0.75rem; font-weight:700; color:${isFull ? 'var(--stamp-red)' : 'var(--moss)'}; background:${isFull ? 'rgba(193,68,14,0.1)' : 'rgba(138,154,91,0.12)'}; padding:4px 10px; border-radius:6px;">
              ${isFull ? 'FULL' : `${evt.signup_count}/${evt.capacity} Slots`}
            </span>
          </div>

          <h3 class="cca-name" style="margin-bottom:0.6rem;">
            ${escapeHtml(evt.title)}
          </h3>

          <p class="cca-desc">
            ${escapeHtml(evt.description || '')}
          </p>

          <div style="font-size:0.8rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:4px; margin-bottom:1.2rem; background:var(--paper); padding:10px 12px; border-radius:8px; border:1px solid var(--border-subtle);">
            <div><strong>🗓️ Date:</strong> ${dateFormatted} at ${timeFormatted}</div>
            <div><strong>📍 Venue:</strong> ${escapeHtml(evt.location || 'NP Campus')}</div>
            ${regFormatted ? `<div><strong>⏳ Reg Deadline:</strong> ${regFormatted}</div>` : ''}
          </div>
        </div>

        <div>
          ${isSignedUp ? `
            <button class="btn btn-outline" style="width:100%; border-color:var(--moss); color:var(--moss);" disabled>
              ✓ Registered & Confirmed
            </button>
          ` : `
            <button class="btn btn-primary" style="width:100%; font-size:0.875rem;" onclick="quickSignupEvent('${evt.id}', '${evt.cca_id}')" ${isFull ? 'disabled' : ''}>
              ${isFull ? 'Event Full' : 'Sign Up For Event'}
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
  renderIcons();
}

// Check schedule clash with student's weekly availability or registered events
function checkScheduleClash(eventDatetime) {
  const evtDate = new Date(eventDatetime);
  const day = evtDate.getDay(); // 0: Sun, 6: Sat
  const hour = evtDate.getHours();

  if (currentUser && currentUser.survey_answers && currentUser.survey_answers.weekly_availability) {
    const avail = currentUser.survey_answers.weekly_availability;
    let isClash = false;
    
    if (day === 0 && !avail.includes('sunday')) isClash = true;
    if (day === 6 && !avail.includes('saturday')) isClash = true;
    if (day >= 1 && day <= 5) {
      if (hour < 12 && !avail.includes('weekday_mornings')) isClash = true;
      if (hour >= 12 && hour < 17 && !avail.includes('weekday_afternoons')) isClash = true;
      if (hour >= 17 && !avail.includes('weekday_evenings')) isClash = true;
    }

    if (isClash) return true;
  }

  // Also check existing signed up events
  const clashRegistered = signedUpEventsDetails.some(e => {
    return new Date(e.datetime).toDateString() === evtDate.toDateString();
  });

  return clashRegistered;
}

async function quickSignupEvent(eventId, ccaId) {
  if (!currentUser) {
    showToast("Please sign in with 2FA to register for events.", "info");
    openLoginModal();
    return;
  }

  const evtObj = allUpcomingEvents.find(e => e.id === eventId);
  if (evtObj && checkScheduleClash(evtObj.datetime)) {
    const proceed = confirm(`⚠️ Schedule Clash Warning!\n\nThis event (${evtObj.title}) may clash with your existing CCA commitments or weekly availability.\n\nDo you still want to confirm registration?`);
    if (!proceed) return;
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
      showToast(`${data.message}`, "success");
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
      showToast(`Registration Failed: ${data.message}`, "error");
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

  container.innerHTML = allCcas.map((cca) => {
    const isBookmarked = bookmarkedCcaIds.has(cca.id);
    const hasScore = cca.match_score !== null && cca.match_score !== undefined;
    const isTopMatch = hasScore && cca.match_score >= 70;

    return `
      <div class="cca-card ${isTopMatch ? 'top-match-card' : ''}">
        <div>
          <div class="cca-header">
            <div>
              <span class="cca-category">${cca.category}</span>
              <h3 class="cca-name">${cca.name}</h3>
            </div>
            ${isTopMatch ? `
              <div class="top-match-stamp">TOP MATCH (${cca.match_score}%)</div>
            ` : (hasScore ? `
              <div style="font-size:0.8rem; font-weight:700; color:var(--text-muted);">${cca.match_score}%</div>
            ` : '')}
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
            <button class="btn btn-outline btn-sm" onclick="openCcaDetail('${cca.id}')">Details ↗</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  renderIcons();
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
    showToast("CCA bookmarked to My CCAs!", "success");
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
    showToast(`Officially joined ${ccaName} as a registered member!`, "success");
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
      <div style="text-align:center; padding:3rem 1.5rem; background:var(--paper); border:1px dashed var(--border-subtle); border-radius:14px;">
        <h3 style="color:var(--ink-navy); font-family:var(--font-heading); font-size:1.3rem; font-weight:700;">You currently have no saved or joined CCAs</h3>
        <p style="color:var(--text-muted); font-size:0.875rem; max-width:440px; margin:0.6rem auto 1.5rem auto;">
          You haven't joined, bookmarked, or registered for any CCAs or events yet. Explore the directory to build your schedule!
        </p>
        <button class="btn btn-primary" onclick="showAllCcasSection()">Explore CCAs</button>
      </div>
    `;
    return;
  }

  let html = '';

  // SECTION 1: JOINED CCAS / OFFICIAL MEMBERSHIPS
  if (joinedCcas.length > 0) {
    html += `
      <div style="margin-bottom:1.2rem;">
        <h3 style="font-family:var(--font-heading); font-size:1.2rem; color:var(--moss); display:flex; align-items:center; gap:8px;">
          🎓 Official Joined Memberships (${joinedCcas.length})
        </h3>
        <p style="font-size:0.825rem; color:var(--text-muted);">CCAs you are registered as an active official student member.</p>
      </div>
      <div class="cca-grid" style="margin-bottom:2.2rem;">
        ${joinedCcas.map(cca => `
          <div class="cca-card" style="border-left:4px solid var(--moss);">
            <div>
              <div class="cca-header">
                <div>
                  <span class="cca-category">${cca.category}</span>
                  <h3 class="cca-name">${cca.name}</h3>
                </div>
                <span style="font-size:0.75rem; background:rgba(138,154,91,0.15); color:var(--moss); border:1px solid rgba(138,154,91,0.3); padding:4px 8px; border-radius:6px; font-weight:700;">OFFICIAL MEMBER</span>
              </div>
              <p class="cca-desc">${cca.description}</p>
            </div>
            <div class="cca-footer">
              <span class="meta-info">📍 ${cca.location}</span>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-outline btn-sm" style="color:var(--stamp-red); border-color:var(--stamp-red);" onclick="toggleEnrolment('${cca.id}')">Leave CCA</button>
                <button class="btn btn-outline btn-sm" onclick="openCcaDetail('${cca.id}')">Details ↗</button>
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
      <div style="margin-bottom:1.2rem;">
        <h3 style="font-family:var(--font-heading); font-size:1.2rem; color:var(--ink-navy); display:flex; align-items:center; gap:8px;">
          📌 Bookmarked & Saved CCAs (${bookmarkedCcas.length})
        </h3>
        <p style="font-size:0.825rem; color:var(--text-muted);">Activities you are exploring or considering joining.</p>
      </div>
      <div class="cca-grid" style="margin-bottom:2.2rem;">
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
                <button class="btn btn-primary btn-sm" onclick="toggleEnrolment('${cca.id}')">Join CCA</button>
                <button class="btn btn-outline btn-sm" style="color:var(--stamp-red);" onclick="toggleBookmark('${cca.id}')">Remove</button>
                <button class="btn btn-outline btn-sm" onclick="openCcaDetail('${cca.id}')">Details ↗</button>
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
      <div style="margin-bottom:1.2rem;">
        <h3 style="font-family:var(--font-heading); font-size:1.2rem; color:var(--ink-navy); display:flex; align-items:center; gap:8px;">
          🎟️ Registered Events & Schedule (${registeredEvents.length})
        </h3>
        <p style="font-size:0.825rem; color:var(--text-muted);">Your confirmed event registrations and schedule check.</p>
      </div>
      <div style="display:flex; flex-direction:column; gap:1rem;">
        ${registeredEvents.map(evt => `
          <div style="background:var(--paper-elevated); border:1px solid var(--border-subtle); border-radius:14px; padding:1.2rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
            <div>
              <span style="font-size:0.75rem; color:var(--moss); font-weight:700;">EVENT REGISTRATION</span>
              <h4 style="font-size:1.05rem; font-weight:700; color:var(--ink-navy); margin-top:2px;">${escapeHtml(evt.title)}</h4>
              <p style="font-size:0.825rem; color:var(--text-muted); margin-top:4px;">
                🗓️ ${new Date(evt.datetime).toLocaleString()} | 📍 ${escapeHtml(evt.location)}
              </p>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="color:var(--moss); font-size:0.825rem; font-weight:700;">Confirmed</span>
              <button class="btn btn-outline btn-sm" style="color:var(--stamp-red); border-color:var(--stamp-red);" onclick="cancelEventSignup('${evt.id}')">Cancel</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  container.innerHTML = html;
  renderIcons();
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

    const content = document.getElementById('ccaDetailContent');
    content.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
        <div>
          <span class="cca-category">${cca.category}</span>
          <h2 style="font-family:var(--font-heading); font-size:1.6rem; color:var(--ink-navy); margin-top:4px;">${cca.name}</h2>
        </div>
        <button class="btn btn-outline btn-sm" onclick="closeModal('ccaDetailModal')">✕ Close</button>
      </div>

      <p style="color:var(--text-secondary); font-size:0.925rem; margin-bottom:1.4rem; line-height:1.6;">${cca.description}</p>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.4rem;">
        <div style="background:var(--paper); border:1px solid var(--border-subtle); padding:1rem; border-radius:12px;">
          <h4 style="font-size:0.85rem; color:var(--ink-navy); margin-bottom:4px;">⏱️ Training Frequency</h4>
          <p style="font-size:0.825rem; color:var(--text-muted);">${cca.training_frequency || 'Weekly sessions'}</p>
        </div>
        <div style="background:var(--paper); border:1px solid var(--border-subtle); padding:1rem; border-radius:12px;">
          <h4 style="font-size:0.85rem; color:var(--ink-navy); margin-bottom:4px;">📍 Venue & Commitment</h4>
          <p style="font-size:0.825rem; color:var(--text-muted);">${cca.location} • <span style="text-transform:capitalize;">${cca.commitment_level}</span></p>
        </div>
      </div>

      <div style="background:var(--paper); border:1px solid var(--border-subtle); padding:1.1rem; border-radius:12px; margin-bottom:1.4rem;">
        <h4 style="font-size:0.875rem; color:var(--ink-navy); margin-bottom:8px;">📬 Contact & Social Details</h4>
        <div style="display:flex; flex-wrap:wrap; gap:14px; font-size:0.825rem; color:var(--text-secondary); align-items:center;">
          ${cca.contact && cca.contact.email ? `<span>✉️ Email: <a href="mailto:${cca.contact.email}" style="color:var(--ink-navy); text-decoration:underline;">${cca.contact.email}</a></span>` : ''}
          ${cca.contact && cca.contact.instagram ? `<span>📸 Instagram: <strong>${cca.contact.instagram}</strong></span>` : ''}
          ${cca.contact && cca.contact.telegram ? `<span>💬 Telegram: <strong>${cca.contact.telegram}</strong></span>` : ''}
        </div>
      </div>

      <div style="background:var(--paper); border:1px solid var(--border-subtle); padding:1.1rem; border-radius:12px; margin-bottom:1.4rem;">
        <h4 style="font-size:0.875rem; color:var(--ink-navy); margin-bottom:8px;">👥 EXCO Leadership Team</h4>
        <div style="display:flex; gap:14px; font-size:0.825rem; color:var(--text-muted);">
          ${cca.exco ? cca.exco.map(e => `<span><strong>${e.role}:</strong> ${e.name}</span>`).join(' • ') : 'EXCO Team'}
        </div>
      </div>

      <h3 style="font-family:var(--font-heading); font-size:1.2rem; margin-bottom:0.85rem; color:var(--ink-navy);">Upcoming Events</h3>
      <div style="display:flex; flex-direction:column; gap:0.85rem; margin-bottom:1.6rem;">
        ${events.length === 0 ? `<p style="font-size:0.875rem; color:var(--text-muted);">No upcoming events scheduled.</p>` : 
          events.map(evt => {
            const isSignedUp = signedUpEventIds.has(evt.id);
            const isFull = evt.signup_count >= evt.capacity;
            const isPast = new Date(evt.datetime) <= new Date();
            const deadlinePassed = evt.registration_deadline && new Date() > new Date(evt.registration_deadline);

            return `
              <div style="background:var(--paper); border:1px solid var(--border-subtle); padding:1.1rem; border-radius:var(--radius-sm); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                <div>
                  <h4 style="font-size:0.98rem; font-weight:700; color:var(--ink-navy);">${escapeHtml(evt.title)}</h4>
                  <p style="font-size:0.825rem; color:var(--text-muted); margin-top:3px;">
                    🗓️ ${new Date(evt.datetime).toLocaleString()} | 📍 ${escapeHtml(evt.location)}
                  </p>
                  <div style="display:flex; gap:12px; margin-top:4px; font-size:0.78rem;">
                    <span style="color:${isFull ? 'var(--stamp-red)' : 'var(--moss)'};">
                      Capacity: ${evt.signup_count} / ${evt.capacity} signed up
                    </span>
                    ${evt.registration_deadline ? `
                      <span style="color:${deadlinePassed ? 'var(--stamp-red)' : 'var(--ink-navy)'}; font-weight:600;">
                        ⏳ Reg Deadline: ${new Date(evt.registration_deadline).toLocaleString()}
                      </span>
                    ` : ''}
                  </div>
                </div>
                <div>
                  ${isSignedUp ? `
                    <span style="color:var(--moss); font-size:0.825rem; font-weight:700;">✓ Registered</span>
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
            ${isEnrolled ? '✓ Official Member' : 'Join CCA'}
          </button>
          <button class="btn btn-outline btn-sm" onclick="toggleBookmark('${cca.id}')">
            ${isBookmarked ? '★ Bookmarked' : '☆ Bookmark'}
          </button>
        </div>
        <span style="font-size:0.825rem; color:var(--text-muted);">📩 Contact: ${cca.contact ? cca.contact.email : 'N/A'}</span>
      </div>
    `;

    document.getElementById('ccaDetailModal').classList.add('active');
  } catch (err) {
    showToast("Failed to load CCA details.", "error");
  }
  renderIcons();
}

async function signUpForEvent(eventId, ccaName = '') {
  if (!currentUser) {
    showToast("Please complete 2FA authentication first.", "error");
    openLoginModal(true);
    return;
  }

  const evtObj = signedUpEventsDetails.find(e => e.id === eventId) || allUpcomingEvents.find(e => e.id === eventId);
  if (evtObj && checkScheduleClash(evtObj.datetime)) {
    const proceed = confirm(`⚠️ Schedule Clash Warning!\n\nThis event (${evtObj.title}) may clash with your existing CCA commitments or weekly availability.\n\nDo you still want to confirm registration?`);
    if (!proceed) return;
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
      showToast(`${data.message}`, "success");
      appendTgMessage('bot', `✅ **Event Registration Success!**\n\nRegistered for **${data.event.title}**.\n🔔 Reminder set!`);
      renderMyCcasFeed();
    } else {
      showToast(`Signup Failed: ${data.message}`, "error");
    }
  } catch (err) {
    showToast("Event signup request error.", "error");
  }
}

// ----------------------------------------------------
// TELEGRAM BOT PREVIEW SIMULATOR
// ----------------------------------------------------
let tgQuizStep = 0;
let tgQuizAnswers = { tags: [], commitment: 'medium', style: 'team' };

function toggleTelegramDrawer() {
  document.getElementById('telegramDrawer').classList.toggle('active');
  renderIcons();
}

function appendTgMessage(sender, text, actionsHtml = '') {
  const body = document.getElementById('tgBody');
  if (!body) return;

  const msg = document.createElement('div');
  msg.className = `tg-message ${sender}`;
  msg.innerHTML = text.replace(/\n/g, '<br>') + (actionsHtml ? `<div class="tg-actions">${actionsHtml}</div>` : '');
  body.appendChild(msg);
  body.scrollTop = body.scrollHeight;
  renderIcons();
}

function sendTgCommand(cmd) {
  appendTgMessage('user', cmd);

  if (cmd === '/start') {
    tgQuizStep = 0;
    setTimeout(() => {
      appendTgMessage('bot', 
        `🎯 **Welcome to NP CCA Match Bot!**\n\nI can help you discover perfect CCAs, find open campus events, and manage your schedule.\n\nChoose an option:`,
        `<button class="tg-action-btn" onclick="sendTgCommand('start_quiz')">🎯 Take Match Quiz</button>
         <button class="tg-action-btn" onclick="sendTgCommand('/browse')">📋 Browse All CCAs</button>
         <button class="tg-action-btn" onclick="sendTgCommand('/events')">🙌 Open Events</button>
         <button class="tg-action-btn" onclick="sendTgCommand('/myccas')">⭐ My CCAs</button>
         <button class="tg-action-btn" onclick="sendTgCommand('/surprise')">🎲 Surprise Me</button>`
      );
    }, 400);
  } else if (cmd === 'start_quiz') {
    tgQuizStep = 1;
    setTimeout(() => {
      appendTgMessage('bot',
        `<strong>Question 1/3: What activities interest you most?</strong>`,
        `<button class="tg-action-btn" onclick="submitTgQuizAnswer('sports')">🏀 Team Sports</button>
         <button class="tg-action-btn" onclick="submitTgQuizAnswer('arts')">🎭 Arts & Media</button>
         <button class="tg-action-btn" onclick="submitTgQuizAnswer('volunteering')">🤝 Volunteering</button>
         <button class="tg-action-btn" onclick="submitTgQuizAnswer('leadership')">👑 Leadership</button>`
      );
    }, 400);
  } else if (cmd === '/browse') {
    setTimeout(() => {
      appendTgMessage('bot',
        `<strong>📋 Browse NP CCAs (81 Total):</strong>\nSelect a category to view clubs:`,
        `<button class="tg-action-btn" onclick="sendTgCommand('cat_Arts')">🎭 Arts & Culture</button>
         <button class="tg-action-btn" onclick="sendTgCommand('cat_Sports')">⚽ Sports</button>
         <button class="tg-action-btn" onclick="sendTgCommand('cat_Community')">❤️ Community Service</button>
         <button class="tg-action-btn" onclick="sendTgCommand('cat_Special Interest')">💡 Special Interest</button>`
      );
    }, 400);
  } else if (cmd.startsWith('cat_')) {
    const cat = cmd.replace('cat_', '');
    const filtered = allCcas.filter(c => c.category.toLowerCase().includes(cat.toLowerCase())).slice(0, 5);
    setTimeout(() => {
      appendTgMessage('bot',
        `<strong>Found ${filtered.length} CCAs in ${cat}:</strong>\n` + 
        filtered.map((c, i) => `${i+1}. **${c.name}** — ${c.description.slice(0, 50)}...`).join('\n\n'),
        filtered.map(c => `<button class="tg-action-btn" onclick="toggleBookmark('${c.id}'); appendTgMessage('bot', '🔖 Bookmarked ${c.name}!')">🔖 Bookmark ${c.name.split(' ')[0]}</button>`).join('')
      );
    }, 400);
  } else if (cmd === '/events') {
    setTimeout(() => {
      const openEvents = allUpcomingEvents.filter(e => OPEN_EVENTS_CCA_IDS.includes(e.cca_id) || true).slice(0, 4);
      appendTgMessage('bot',
        `<strong>🙌 Open Campus Events (No Membership Required):</strong>\nThese events are open to all NP students!\n\n` +
        openEvents.map(e => `📌 **${e.title}**\n🗓️ ${new Date(e.datetime).toLocaleDateString()} at ${new Date(e.datetime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}\n📍 ${e.location}`).join('\n\n'),
        openEvents.map(e => `<button class="tg-action-btn" onclick="quickSignupEvent('${e.id}', '${e.cca_id}')">✅ Join ${e.title.slice(0, 15)}...</button>`).join('') +
        `<button class="tg-action-btn" onclick="appendTgMessage('bot', '🔔 Event reminder scheduled for 2 hours before start date!')">🔔 Remind Me</button>`
      );
    }, 400);
  } else if (cmd === '/myccas') {
    const joined = allCcas.filter(c => enrolledCcaIds.has(c.id));
    const bookmarked = allCcas.filter(c => bookmarkedCcaIds.has(c.id));
    setTimeout(() => {
      appendTgMessage('bot',
        `<strong>⭐ Your Schedule Summary:</strong>\n\n` +
        `<strong>Joined CCAs (${joined.length}):</strong>\n` + (joined.length ? joined.map(c => `• ${c.name}`).join('\n') : 'None yet') + '\n\n' +
        `<strong>Bookmarked CCAs (${bookmarked.length}):</strong>\n` + (bookmarked.length ? bookmarked.map(c => `• ${c.name}`).join('\n') : 'None yet') + '\n\n' +
        `<strong>Registered Events (${signedUpEventIds.size}):</strong>\n` + (signedUpEventsDetails.length ? signedUpEventsDetails.map(e => `• ${e.title}`).join('\n') : 'None yet')
      );
    }, 400);
  } else if (cmd === '/surprise') {
    const rand = allCcas[Math.floor(Math.random() * allCcas.length)];
    setTimeout(() => {
      appendTgMessage('bot',
        `🎲 **Random CCA Pick:**\n\n` +
        `**${rand.name}** (${rand.category})\n` +
        `"${rand.description}"\n\n` +
        `📍 Location: ${rand.location}\n` +
        `⏱️ Frequency: ${rand.training_frequency || 'Weekly'}`,
        `<button class="tg-action-btn" onclick="toggleBookmark('${rand.id}'); appendTgMessage('bot', '🔖 Bookmarked ${rand.name}!')">🔖 Bookmark This CCA</button>`
      );
    }, 400);
  } else if (cmd.startsWith('/search')) {
    const q = cmd.replace('/search', '').trim().toLowerCase();
    const matches = allCcas.filter(c => c.name.toLowerCase().includes(q) || c.tags.some(t => t.toLowerCase().includes(q))).slice(0, 4);
    setTimeout(() => {
      if (matches.length === 0) {
        appendTgMessage('bot', `🔍 No CCAs found matching "${q}". Try another keyword!`);
      } else {
        appendTgMessage('bot',
          `🔍 **Search Results for "${q}":**\n\n` +
          matches.map(c => `• **${c.name}** (${c.category})\n  ${c.description.slice(0, 60)}...`).join('\n\n')
        );
      }
    }, 400);
  }
}

function submitTgQuizAnswer(ans) {
  if (tgQuizStep === 1) {
    tgQuizAnswers.tags = [ans];
    tgQuizStep = 2;
    appendTgMessage('user', `Selected: ${ans}`);
    setTimeout(() => {
      appendTgMessage('bot',
        `<strong>Question 2/3: Time Availability per week?</strong>`,
        `<button class="tg-action-btn" onclick="submitTgQuizAnswer('low')">🌱 Low (1-2 hrs/wk)</button>
         <button class="tg-action-btn" onclick="submitTgQuizAnswer('medium')">⚡ Medium (3-5 hrs/wk)</button>
         <button class="tg-action-btn" onclick="submitTgQuizAnswer('high')">🔥 High (6+ hrs/wk)</button>`
      );
    }, 400);
  } else if (tgQuizStep === 2) {
    tgQuizAnswers.commitment = ans;
    tgQuizStep = 3;
    appendTgMessage('user', `Selected: ${ans}`);
    setTimeout(() => {
      appendTgMessage('bot',
        `<strong>Question 3/3: Preferred activity style?</strong>`,
        `<button class="tg-action-btn" onclick="submitTgQuizAnswer('team')">👥 Team & Group</button>
         <button class="tg-action-btn" onclick="submitTgQuizAnswer('solo')">🎯 Solo Practice</button>
         <button class="tg-action-btn" onclick="submitTgQuizAnswer('mixed')">🔀 Mixed</button>`
      );
    }, 400);
  } else if (tgQuizStep === 3) {
    tgQuizAnswers.style = ans;
    tgQuizStep = 0;
    appendTgMessage('user', `Selected: ${ans}`);

    // Compute top matches
    const topMatches = allCcas.slice(0, 3);
    setTimeout(() => {
      appendTgMessage('bot',
        `🎉 **Quiz Complete! Your Top 3 CCA Matches:**\n\n` +
        topMatches.map((c, i) => `${i+1}. ⭐ **${c.name}**\n   "${c.description.slice(0, 50)}..."\n   📍 ${c.location}`).join('\n\n'),
        `<button class="tg-action-btn" onclick="sendTgCommand('/browse')">View All CCAs ▶️</button>`
      );
    }, 400);
  }
}

function submitTgInput() {
  const input = document.getElementById('tgInput');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  input.value = '';
  sendTgCommand(val);
}

// ----------------------------------------------------
// HELPER UTILITIES
// ----------------------------------------------------
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

function showToast(msg, type = "success") {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  if (type === 'error') toast.style.borderLeft = '4px solid var(--stamp-red)';
  if (type === 'info') toast.style.borderLeft = '4px solid var(--ink-navy)';

  toast.innerHTML = `<span>${type === 'error' ? '❌' : '✨'}</span> ${escapeHtml(msg)}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
