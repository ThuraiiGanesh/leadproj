const API_BASE = (typeof window !== 'undefined' && (window.location.protocol === 'file:' || (window.location.hostname === 'localhost' && !window.location.port) || typeof window.Capacitor !== 'undefined')) ? 'https://leadproj.vercel.app' : '';
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
let eventReminders = new Set(JSON.parse(localStorage.getItem('np_event_reminders') || '[]'));
let googleCalendarSynced = false;
let googleCalendarEvents = [];
let weeklyCommitments = JSON.parse(localStorage.getItem('np_weekly_commitments') || '[]');
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
    const res = await fetch(API_BASE + '/api/auth/login', {
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
    const res = await fetch(API_BASE + '/api/auth/verify-2fa', {
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
    const eventsRes = await fetch(`${API_BASE}/api/ccas/${selectedAdminCcaId}`);
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
    renderExcoAnalyticsChart();
  } catch (err) {
    console.error("Admin Dashboard Error:", err);
  }
  renderIcons();
}

async function fetchAdminRoster(eventId) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/events/${eventId}/signups`);
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
    const res = await fetch(API_BASE + '/api/admin/events/create', {
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

  const tagSubtext = {
    dance: 'Chinese / Contemporary / Hip Hop / DanceSport',
    music: 'Concert Band, Orchestra, Strings, Piano, Percussion, Song Composing',
    drama: 'English & Chinese Drama, Stage Production',
    arts: 'Photography, Calligraphy, Visual Arts & Media',
    culture: 'Chinese, Japanese, Korean, Malay & Indian Cultural',
    sports: 'Football, Basketball, Handball, Netball, Rugby, Hockey, Volleyball',
    combat: 'Judo, Taekwondo, Silat, Wushu, Fencing, Archery',
    water: 'Swimming, Canoeing, Dragon Boat, Water Polo, Lifesaving',
    racket: 'Badminton, Tennis, Squash, Table Tennis, Pickleball, Bowling',
    volunteering: 'Leo Club, Rotaract, FoodAID, Environmental Rangers, RCYC, NP Mentors',
    faith: 'Buddhist, Catholic, Cru, Christian Fellowship, Muslim Students',
    academic: 'Current Affairs Club, Toastmasters',
    stem: 'Astronomy, Makers Guild, Sandbox, Developers',
    games: 'Tabletop Games & Strategy',
    leadership: 'Peer Helpers, Ambassadors, Student Council'
  };

  container.innerHTML = SPEC_INTEREST_TAGS.map(t => `
    <label style="background:var(--paper); border:1px solid var(--border-subtle); padding:10px 12px; border-radius:10px; font-size:0.825rem; cursor:pointer; display:flex; flex-direction:column; gap:4px; color:var(--ink-navy); width:100%; box-sizing:border-box;">
      <div style="display:flex; align-items:center; gap:8px; font-weight:700;">
        <input type="checkbox" value="${t.id}" ${['sports', 'arts', 'leadership', 'culture'].includes(t.id) ? 'checked' : ''}>
        ${t.label}
      </div>
      <span style="font-size:0.75rem; color:var(--text-muted); padding-left:24px; line-height:1.3;">${tagSubtext[t.id] || ''}</span>
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
    let url = `${API_BASE}/api/ccas?`;
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
      renderTop3MatchesCard();
    }
  } catch (err) {
    console.error("Error fetching CCAs:", err);
  }
}

// ----------------------------------------------------
// GOOGLE CALENDAR & TIMETABLE SCHEDULE CLASH ENGINE
// ----------------------------------------------------

async function fetchSyncedGoogleCalendar() {
  try {
    const res = await fetch(API_BASE + '/api/calendar/events');
    const data = await res.json();
    if (data.success && data.is_synced) {
      googleCalendarSynced = true;
      googleCalendarEvents = data.events || [];
    } else {
      googleCalendarSynced = false;
      googleCalendarEvents = [];
    }
  } catch (err) {
    console.warn("Google Calendar sync check notice:", err);
  }
}

async function syncGoogleCalendar() {
  try {
    const res = await fetch(API_BASE + '/api/auth/google/url');
    const data = await res.json();
    if (data.success && data.is_configured && data.auth_url) {
      window.open(data.auth_url, 'GoogleAuth', 'width=500,height=600');
    } else {
      // Self-contained demo sync mode (Data Minimization: temporary mock sync)
      googleCalendarSynced = true;
      googleCalendarEvents = [
        {
          id: 'demo_cal_1',
          summary: 'IT2003 Web Development Lecture',
          start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          end: new Date(Date.now() + (24 * 60 * 60 + 2 * 3600) * 1000).toISOString()
        },
        {
          id: 'demo_cal_2',
          summary: 'MP201 Project Presentation',
          start: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          end: new Date(Date.now() + (48 * 60 * 60 + 3 * 3600) * 1000).toISOString()
        }
      ];
      showToast("Google Calendar Connected (Synced for Clash Detection)!", "success");
      renderMyCcasFeed();
      renderUpcomingEventsFeed();
    }
  } catch (err) {
    showToast("Google Calendar sync error.", "error");
  }
}

async function disconnectGoogleCalendar() {
  try {
    await fetch(API_BASE + '/api/calendar/disconnect', { method: 'POST' });
    googleCalendarSynced = false;
    googleCalendarEvents = [];
    showToast("Google Calendar disconnected. Session data cleared.", "info");
    renderMyCcasFeed();
    renderUpcomingEventsFeed();
  } catch (err) {
    showToast("Failed to disconnect calendar.", "error");
  }
}

function openAddScheduleModal() {
  document.getElementById('schLabel').value = '';
  document.getElementById('addScheduleModal').classList.add('active');
}

function saveWeeklyCommitment() {
  const label = document.getElementById('schLabel').value.trim();
  const day = parseInt(document.getElementById('schDay').value, 10);
  const startTime = document.getElementById('schStartTime').value;
  const endTime = document.getElementById('schEndTime').value;

  if (!label) {
    showToast("Please enter a subject or activity name.", "error");
    return;
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const newCommitment = {
    id: 'sch_' + Date.now(),
    label,
    day,
    dayName: dayNames[day],
    startTime,
    endTime
  };

  weeklyCommitments.push(newCommitment);
  localStorage.setItem('np_weekly_commitments', JSON.stringify(weeklyCommitments));
  closeModal('addScheduleModal');
  showToast(`Added "${label}" to your weekly schedule!`, "success");
  renderMyCcasFeed();
  renderUpcomingEventsFeed();
}

function deleteWeeklyCommitment(id) {
  weeklyCommitments = weeklyCommitments.filter(c => c.id !== id);
  localStorage.setItem('np_weekly_commitments', JSON.stringify(weeklyCommitments));
  showToast("Schedule commitment removed.", "info");
  renderMyCcasFeed();
  renderUpcomingEventsFeed();
}

// Unified Schedule Clash Engine (Google Calendar + Timetable + Registered Events)
function detectScheduleClash(eventDatetimeStr, durationMinutes = 120) {
  if (!eventDatetimeStr) return { isClash: false };

  const evtStart = new Date(eventDatetimeStr);
  const evtEnd = new Date(evtStart.getTime() + durationMinutes * 60 * 1000);
  const evtDay = evtStart.getDay();
  const evtStartMins = evtStart.getHours() * 60 + evtStart.getMinutes();
  const evtEndMins = evtEnd.getHours() * 60 + evtEnd.getMinutes();

  // 1. Check Synced Google Calendar Events
  if (googleCalendarEvents.length > 0) {
    for (const gEvt of googleCalendarEvents) {
      const gStart = new Date(gEvt.start);
      const gEnd = new Date(gEvt.end);

      if (evtStart < gEnd && evtEnd > gStart) {
        const timeRangeStr = `${gStart.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${gEnd.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
        return {
          isClash: true,
          clashingTitle: gEvt.summary,
          timeRange: timeRangeStr,
          source: 'Google Calendar'
        };
      }
    }
  }

  // 2. Check Weekly Timetable Commitments
  for (const item of weeklyCommitments) {
    if (item.day === evtDay) {
      const [sH, sM] = item.startTime.split(':').map(Number);
      const [eH, eM] = item.endTime.split(':').map(Number);
      const itemStartMins = sH * 60 + sM;
      const itemEndMins = eH * 60 + eM;

      if (evtStartMins < itemEndMins && evtEndMins > itemStartMins) {
        return {
          isClash: true,
          clashingTitle: item.label,
          timeRange: `${item.startTime} - ${item.endTime}`,
          source: 'Weekly Timetable'
        };
      }
    }
  }

  // 3. Check Registered Events
  for (const regEvt of signedUpEventsDetails) {
    const regStart = new Date(regEvt.datetime);
    const regEnd = new Date(regStart.getTime() + 120 * 60 * 1000);

    if (evtStart < regEnd && evtEnd > regStart) {
      const timeRangeStr = `${regStart.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${regEnd.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
      return {
        isClash: true,
        clashingTitle: regEvt.title,
        timeRange: timeRangeStr,
        source: 'Registered Event'
      };
    }
  }

  return { isClash: false };
}

// ----------------------------------------------------
// LIVE UPCOMING CAMPUS EVENTS FEED
// ----------------------------------------------------
let allUpcomingEvents = [];

async function fetchUpcomingCampusEvents() {
  const container = document.getElementById('upcomingEventsFeed');
  if (!container) return;

  try {
    const res = await fetch(API_BASE + '/api/events');
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
            ${(() => {
              const clash = detectScheduleClash(evt.datetime);
              if (clash.isClash) {
                return `<div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:6px; padding:6px 10px; margin-top:6px; font-size:0.775rem; color:var(--stamp-red); font-weight:600;">
                  ⚠️ This clashes with <strong>${escapeHtml(clash.clashingTitle)}</strong> on your calendar (${clash.timeRange}).
                </div>`;
              }
              return '';
            })()}
          </div>
        </div>

        <div style="display:flex; gap:8px;">
          ${isSignedUp ? `
            <button class="btn btn-outline" style="flex:1; border-color:var(--moss); color:var(--moss);" disabled>
              ✓ Registered
            </button>
          ` : `
            <button class="btn btn-primary" style="flex:1; font-size:0.875rem;" onclick="quickSignupEvent('${evt.id}', '${evt.cca_id}')" ${isFull ? 'disabled' : ''}>
              ${isFull ? 'Full' : 'Sign Up'}
            </button>
          `}
          <button class="btn btn-outline btn-sm" style="${eventReminders.has(evt.id) ? 'border-color:var(--ink-navy); color:var(--ink-navy); background:rgba(155, 138, 196, 0.12); font-weight:700;' : ''}" onclick="toggleEventReminder('${evt.id}')">
            ${eventReminders.has(evt.id) ? '🔔 Reminded' : '🔔 Remind Me'}
          </button>
        </div>
      </div>
    `;
  }).join('');
  renderIcons();
}

async function quickSignupEvent(eventId, ccaId) {
  if (!currentUser) {
    showToast("Please sign in with 2FA to register for events.", "info");
    openLoginModal();
    return;
  }

  const evtObj = allUpcomingEvents.find(e => e.id === eventId) || signedUpEventsDetails.find(e => e.id === eventId);
  const clash = evtObj ? detectScheduleClash(evtObj.datetime) : { isClash: false };
  if (clash.isClash) {
    const proceed = confirm(`⚠️ Schedule Clash Warning!\n\nThis event clashes with "${clash.clashingTitle}" on your ${clash.source} (${clash.timeRange}).\n\nDo you still want to confirm registration?`);
    if (!proceed) return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/events/${eventId}/signup`, {
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
    showToast(`Withdrew application for ${ccaName}.`, "info");
  } else {
    enrolledCcaIds.add(ccaId);
    showToast(`Application submitted for ${ccaName}!`, "success");
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

  const appliedCcas = allCcas.filter(cca => enrolledCcaIds.has(cca.id));
  const bookmarkedCcas = allCcas.filter(cca => bookmarkedCcaIds.has(cca.id));
  const registeredEvents = signedUpEventsDetails || [];

  const totalItems = appliedCcas.length + bookmarkedCcas.length + registeredEvents.length;

  if (totalItems === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:3rem 1.5rem; background:var(--paper); border:1px dashed var(--border-subtle); border-radius:14px;">
        <h3 style="color:var(--ink-navy); font-family:var(--font-heading); font-size:1.3rem; font-weight:700;">You currently have no saved or applied CCAs</h3>
        <p style="color:var(--text-muted); font-size:0.875rem; max-width:440px; margin:0.6rem auto 1.5rem auto;">
          You haven't applied for, bookmarked, or registered for any CCAs or events yet. Explore the directory to build your schedule!
        </p>
        <button class="btn btn-primary" onclick="showAllCcasSection()">Explore CCAs</button>
      </div>
    `;
    return;
  }

  let html = '';

  // SECTION 0: CALENDAR SYNC & TIMETABLE CLASH SETTINGS
  html += `
    <div style="background:var(--paper-elevated); border:1px solid var(--border-subtle); border-radius:14px; padding:1.4rem; margin-bottom:2.2rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; margin-bottom:1rem;">
        <div>
          <span style="font-size:0.75rem; background:rgba(139,92,246,0.15); color:var(--ink-navy); border:1px solid rgba(139,92,246,0.3); padding:3px 8px; border-radius:6px; font-weight:700;">CALENDAR SYNC & CLASH DETECTION</span>
          <h3 style="font-family:var(--font-heading); font-size:1.25rem; color:var(--ink-navy); margin-top:4px;">Google Calendar & Timetable Sync</h3>
          <p style="font-size:0.825rem; color:var(--text-muted);">Sync your Google Calendar or add class blocks to detect real-time event clashes.</p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${googleCalendarSynced ? `
            <span style="display:inline-flex; align-items:center; gap:6px; font-size:0.825rem; color:var(--moss); font-weight:700; background:rgba(138,154,91,0.15); padding:6px 12px; border-radius:8px; border:1px solid rgba(138,154,91,0.3);">
              ✓ Google Calendar Synced (${googleCalendarEvents.length} events)
            </span>
            <button class="btn btn-outline btn-sm" style="color:var(--stamp-red); border-color:var(--stamp-red);" onclick="disconnectGoogleCalendar()">Disconnect Calendar</button>
          ` : `
            <button class="btn btn-primary btn-sm" style="background:#4285F4; border-color:#4285F4;" onclick="syncGoogleCalendar()">
              📅 Sync Google Calendar
            </button>
          `}
          <button class="btn btn-outline btn-sm" onclick="openAddScheduleModal()">+ Add Lesson Commitment</button>
        </div>
      </div>

      <!-- Weekly Timetable Commitments Preview -->
      <div style="background:var(--paper); border:1px solid var(--border-subtle); border-radius:10px; padding:1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
          <h4 style="font-size:0.875rem; color:var(--ink-navy); font-weight:700;">📚 Active Timetable Commitments (${weeklyCommitments.length})</h4>
          <span style="font-size:0.75rem; color:var(--text-muted);">Used for automatic event clash warning banners</span>
        </div>
        ${weeklyCommitments.length === 0 ? `
          <p style="font-size:0.8rem; color:var(--text-muted); font-style:italic;">No weekly lesson blocks added yet. Click "+ Add Lesson Commitment" to configure your schedule.</p>
        ` : `
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:0.75rem;">
            ${weeklyCommitments.map(item => `
              <div style="background:var(--paper-elevated); border:1px solid var(--border-subtle); border-radius:8px; padding:0.75rem; display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-size:0.85rem; font-weight:700; color:var(--ink-navy);">${escapeHtml(item.label)}</div>
                  <div style="font-size:0.775rem; color:var(--text-muted);">${item.dayName} ${item.startTime} - ${item.endTime}</div>
                </div>
                <button class="btn btn-outline btn-sm" style="color:var(--stamp-red); padding:2px 6px; font-size:0.75rem;" onclick="deleteWeeklyCommitment('${item.id}')">✕</button>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <div style="margin-top:0.8rem; font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
        🔒 <strong>LegalTech Data Minimization:</strong> Calendar details are processed in-memory solely for clash checking and are not stored permanently.
      </div>
    </div>
  `;

  // SECTION 1: APPLIED CCAS / MEMBERSHIP APPLICATIONS
  if (appliedCcas.length > 0) {
    html += `
      <div style="margin-bottom:1.2rem;">
        <h3 style="font-family:var(--font-heading); font-size:1.2rem; color:var(--moss); display:flex; align-items:center; gap:8px;">
          📝 Applied CCAs (${appliedCcas.length})
        </h3>
        <p style="font-size:0.825rem; color:var(--text-muted);">CCAs you have submitted an official membership application for.</p>
      </div>
      <div class="cca-grid" style="margin-bottom:2.2rem;">
        ${appliedCcas.map(cca => `
          <div class="cca-card" style="border-left:4px solid var(--moss);">
            <div>
              <div class="cca-header">
                <div>
                  <span class="cca-category">${cca.category}</span>
                  <h3 class="cca-name">${cca.name}</h3>
                </div>
                <span style="font-size:0.75rem; background:rgba(138,154,91,0.15); color:var(--moss); border:1px solid rgba(138,154,91,0.3); padding:4px 8px; border-radius:6px; font-weight:700;">APPLICATION SUBMITTED</span>
              </div>
              <p class="cca-desc">${cca.description}</p>
            </div>
            <div class="cca-footer">
              <span class="meta-info">📍 ${cca.location}</span>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-outline btn-sm" style="color:var(--stamp-red); border-color:var(--stamp-red);" onclick="toggleEnrolment('${cca.id}')">Withdraw Application</button>
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
        <p style="font-size:0.825rem; color:var(--text-muted);">Activities you are exploring or considering applying for.</p>
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
                <button class="btn btn-primary btn-sm" onclick="toggleEnrolment('${cca.id}')">Apply for CCA</button>
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
    const res = await fetch(`${API_BASE}/api/ccas/${ccaId}`);
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

      <div style="background:var(--paper); border:1px solid var(--border-subtle); padding:1.1rem; border-radius:12px; margin-bottom:1.4rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
          <div>
            <h4 style="font-size:0.875rem; color:var(--ink-navy); margin-bottom:4px;">📍 Campus Location & Training Venue</h4>
            <p style="font-size:0.85rem; color:var(--text-secondary); margin:0;">${escapeHtml(cca.location)} • <span style="text-transform:capitalize;">${cca.commitment_level} commitment</span></p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="initMapDirectionsForCca('${cca.id}')">
            🗺️ Show Walking Route
          </button>
        </div>

        <div id="cca_map_${cca.id}_wrapper" class="map-embed-wrapper" style="display:none;">
          <div id="cca_map_${cca.id}_container" class="map-container-box"></div>
          <div id="cca_map_${cca.id}_panel" class="map-info-panel">
            <div id="cca_map_${cca.id}_stats" class="map-stats-badge">
              <span>⏳ Initializing Navigation...</span>
            </div>
            <button id="cca_map_${cca.id}_stop_btn" class="btn-stop-location" onclick="stopLiveLocationWatch('cca_map_${cca.id}')">
              🛑 Stop sharing location
            </button>
          </div>
        </div>
        <div id="cca_map_${cca.id}_status"></div>
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
                  <div style="display:flex; flex-direction:column; gap:4px; margin-top:4px; font-size:0.78rem;">
                    <span style="color:${isFull ? 'var(--stamp-red)' : 'var(--moss)'};">
                      Capacity: ${evt.signup_count} / ${evt.capacity} signed up
                    </span>
                    ${evt.registration_deadline ? `
                      <span style="color:${deadlinePassed ? 'var(--stamp-red)' : 'var(--ink-navy)'}; font-weight:600;">
                        ⏳ Reg Deadline: ${new Date(evt.registration_deadline).toLocaleString()}
                      </span>
                    ` : ''}
                    ${(() => {
                      const clash = detectScheduleClash(evt.datetime);
                      if (clash.isClash) {
                        return `<div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); border-radius:6px; padding:4px 8px; font-size:0.75rem; color:var(--stamp-red); font-weight:600;">
                          ⚠️ This clashes with <strong>${escapeHtml(clash.clashingTitle)}</strong> on your calendar (${clash.timeRange}).
                        </div>`;
                      }
                      return '';
                    })()}
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
            ${isEnrolled ? '✓ Application Submitted' : 'Apply for CCA'}
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
    const res = await fetch(`${API_BASE}/api/events/${eventId}/signup`, {
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

// ====================================================
// GOOGLE MAPS LIVE WALKING DIRECTIONS MODULE
// ====================================================
let googleMapsLoadedPromise = null;
let activeWatchId = null;
let currentMap = null;
let currentDirectionsRenderer = null;
let currentDirectionsService = null;
let currentUserMarker = null;
let currentDestMarker = null;
let currentActiveTargetId = null;

// Official Loader implementation: Async promise fetching key from API
function loadGoogleMapsApi() {
  if (googleMapsLoadedPromise) return googleMapsLoadedPromise;

  googleMapsLoadedPromise = (async () => {
    try {
      let apiKey = 'AIzaSyAqaxtYBHgAS3cyal8ZOl8hkm92i_-Wcfk';
      try {
        const res = await fetch(API_BASE + '/api/config/maps-key');
        if (res.ok) {
          const data = await res.json();
          if (data.apiKey) apiKey = data.apiKey;
        }
      } catch (e) {
        console.warn("Using default Google Maps API key fallback.");
      }

      if (window.google && window.google.maps && window.google.maps.Map) {
        return window.google.maps;
      }

      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places,geometry`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
          if (window.google && window.google.maps) {
            resolve(window.google.maps);
          } else {
            reject(new Error("Google Maps failed to load properly."));
          }
        };
        script.onerror = (err) => reject(new Error("Failed to load Google Maps script. Check network or API key restrictions."));
        document.head.appendChild(script);
      });
    } catch (err) {
      console.error("Google Maps Loader Error:", err);
      throw err;
    }
  })();

  return googleMapsLoadedPromise;
}

// Stop live location watch & clear markers (LegalTech/PDPA story: consent revocable)
function stopLiveLocationWatch(targetId) {
  try {
    if (activeWatchId !== null) {
      navigator.geolocation.clearWatch(activeWatchId);
      activeWatchId = null;
    }
    if (currentUserMarker) {
      currentUserMarker.setMap(null);
      currentUserMarker = null;
    }
    
    const wrapper = document.getElementById(`${targetId}_wrapper`);
    const statusBox = document.getElementById(`${targetId}_status`);

    if (wrapper) wrapper.style.display = 'none';
    if (statusBox) {
      statusBox.innerHTML = `
        <div style="background:rgba(255,255,255,0.05); border:1px solid var(--border-subtle); padding:10px 14px; border-radius:8px; color:var(--text-muted); font-size:0.825rem; margin-top:0.75rem;">
          ℹ️ Location sharing stopped (Consent revoked under PDPA). Click "Show Walking Route" to navigate again.
        </div>
      `;
    }

    showToast("Location tracking stopped. Consent revoked.", "info");
  } catch (err) {
    console.error("Error stopping location watch:", err);
  }
}

// ====================================================
// LEAFLET / OPENSTREETMAP FALLBACK ENGINE
// ====================================================
let leafletLoadedPromise = null;
function loadLeafletApi() {
  if (leafletLoadedPromise) return leafletLoadedPromise;
  leafletLoadedPromise = new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve(window.L);
    script.onerror = (err) => reject(new Error("Failed to load Leaflet script"));
    document.head.appendChild(script);
  });
  return leafletLoadedPromise;
}

let currentLeafletMap = null;
let currentLeafletPolyline = null;
let currentLeafletUserMarker = null;

function getDirectDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function renderLeafletFallbackMap(userLat, userLng, destLat, destLng, destName, container, stats) {
  try {
    const L = await loadLeafletApi();
    
    if (currentLeafletMap) {
      try { currentLeafletMap.remove(); } catch(e){}
      currentLeafletMap = null;
    }

    container.innerHTML = ''; // clear Google Maps error overlay
    currentLeafletMap = L.map(container).setView([userLat, userLng], 16);

    // CartoDB Dark Matter tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19
    }).addTo(currentLeafletMap);

    // Custom User Marker (Blue Circle)
    const userIcon = L.divIcon({
      className: 'custom-user-marker',
      html: '<div style="background:#3b82f6; width:16px; height:16px; border-radius:50%; border:3px solid #ffffff; box-shadow:0 0 10px #3b82f6;"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    // Custom Dest Marker (Red Pin)
    const destIcon = L.divIcon({
      className: 'custom-dest-marker',
      html: '<div style="background:#ef4444; width:22px; height:22px; border-radius:50%; border:2px solid #ffffff; box-shadow:0 0 10px #ef4444; display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px; font-weight:bold;">📍</div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    currentLeafletUserMarker = L.marker([userLat, userLng], { icon: userIcon, title: "Your Location" }).addTo(currentLeafletMap);
    L.marker([destLat, destLng], { icon: destIcon, title: destName }).addTo(currentLeafletMap);

    // Route Polyline
    const latlngs = [[userLat, userLng], [destLat, destLng]];
    currentLeafletPolyline = L.polyline(latlngs, { color: '#8b5cf6', weight: 5, opacity: 0.85 }).addTo(currentLeafletMap);

    // Fit bounds
    currentLeafletMap.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50] });

    // Calculate distance
    const distKm = getDirectDistanceKm(userLat, userLng, destLat, destLng);
    const approxMins = Math.max(1, Math.round((distKm / 4.5) * 60));
    const distStr = distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`;

    if (stats) {
      stats.innerHTML = `
        <span style="color:#8b5cf6; font-weight:700;">🗺️ Live Map Route:</span>
        <span><strong>${distStr}</strong> (~${approxMins} mins walk) to <strong>${escapeHtml(destName)}</strong></span>
      `;
    }
  } catch (err) {
    console.error("Leaflet fallback error:", err);
  }
}

// Main live walking route initializer
async function startLiveWalkingDirections(destLat, destLng, destName, targetId) {
  currentActiveTargetId = targetId;
  const wrapper = document.getElementById(`${targetId}_wrapper`);
  const container = document.getElementById(`${targetId}_container`);
  const stats = document.getElementById(`${targetId}_stats`);
  const statusBox = document.getElementById(`${targetId}_status`);

  if (statusBox) statusBox.innerHTML = '';
  if (wrapper) wrapper.style.display = 'block';
  if (stats) stats.innerHTML = '<span>⏳ Requesting live location permission...</span>';

  // 1. Geolocation availability check
  if (!navigator.geolocation) {
    if (stats) stats.innerHTML = '';
    if (statusBox) {
      statusBox.innerHTML = `<div class="map-permission-alert">Location access is needed to show walking directions. Please enable location permissions.</div>`;
    }
    showToast("Geolocation is not supported by your browser.", "error");
    return;
  }

  // 2. Request initial fix with getCurrentPosition()
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;
      const numDestLat = Number(destLat);
      const numDestLng = Number(destLng);

      // Register Google Maps Auth Failure Fallback Handler
      window.gm_authFailure = () => {
        console.warn("Google Maps Auth Failure detected. Switching seamlessly to Dark Mode Leaflet Map!");
        renderLeafletFallbackMap(userLat, userLng, numDestLat, numDestLng, destName, container, stats);
      };

      try {
        if (stats) stats.innerHTML = '<span>🗺️ Loading Maps API...</span>';

        // 3. Async load Maps API
        const maps = await loadGoogleMapsApi();

        // Dark map styling matching existing app theme
        const darkMapStyles = [
          { elementType: "geometry", stylers: [{ color: "#212121" }] },
          { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
          { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
          { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
          { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
          { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#181818" }] },
          { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
          { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
          { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#373737" }] },
          { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] }
        ];

        currentMap = new maps.Map(container, {
          zoom: 17,
          center: { lat: userLat, lng: userLng },
          styles: darkMapStyles,
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false
        });

        currentDirectionsService = new maps.DirectionsService();
        currentDirectionsRenderer = new maps.DirectionsRenderer({
          map: currentMap,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: "#8b5cf6",
            strokeWeight: 5,
            strokeOpacity: 0.85
          }
        });

        // Custom markers (with safe SymbolPath fallbacks)
        const userPos = { lat: userLat, lng: userLng };
        const destPos = { lat: Number(destLat), lng: Number(destLng) };

        currentUserMarker = new maps.Marker({
          position: userPos,
          map: currentMap,
          title: "Your Live Position",
          icon: (maps.SymbolPath && maps.SymbolPath.CIRCLE) ? {
            path: maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#3b82f6",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3
          } : undefined
        });

        currentDestMarker = new maps.Marker({
          position: destPos,
          map: currentMap,
          title: destName,
          icon: (maps.SymbolPath && maps.SymbolPath.BACKWARD_CLOSED_ARROW) ? {
            path: maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: "#ef4444",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2
          } : undefined
        });

        // Helper: Calculate Haversine straight-line distance in km
        function getDirectDistanceKm(lat1, lon1, lat2, lon2) {
          const R = 6371;
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          return R * c;
        }

        let fallbackPolyline = null;

        // Calculate walking directions
        function calculateRoute(origin, destination) {
          try {
            // Fit map bounds to show both origin and destination
            const bounds = new maps.LatLngBounds();
            bounds.extend(origin);
            bounds.extend(destination);
            currentMap.fitBounds(bounds, 60);

            currentDirectionsService.route(
              {
                origin: origin,
                destination: destination,
                travelMode: maps.TravelMode.WALKING
              },
              (result, status) => {
                if (status === maps.DirectionsStatus.OK && result.routes && result.routes.length > 0) {
                  if (fallbackPolyline) {
                    fallbackPolyline.setMap(null);
                    fallbackPolyline = null;
                  }
                  currentDirectionsRenderer.setDirections(result);
                  const leg = result.routes[0].legs[0];
                  if (stats) {
                    stats.innerHTML = `
                      <span style="color:#8b5cf6; font-weight:700;">🚶 Live Walking Route:</span>
                      <span><strong>${leg.distance.text}</strong> (${leg.duration.text}) to <strong>${escapeHtml(destName)}</strong></span>
                    `;
                  }
                } else {
                  console.warn("DirectionsService status notice:", status);
                  const distKm = getDirectDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);
                  const approxMins = Math.round((distKm / 4.5) * 60);
                  const distStr = distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`;

                  // Render direct route line on map
                  if (!fallbackPolyline) {
                    fallbackPolyline = new maps.Polyline({
                      path: [origin, destination],
                      geodesic: true,
                      strokeColor: "#8b5cf6",
                      strokeOpacity: 0.8,
                      strokeWeight: 4,
                      map: currentMap
                    });
                  } else {
                    fallbackPolyline.setPath([origin, destination]);
                  }

                  if (stats) {
                    stats.innerHTML = `
                      <span style="color:#8b5cf6; font-weight:700;">📍 Location Direct Route:</span>
                      <span><strong>${distStr}</strong> (~${approxMins} mins walk) to <strong>${escapeHtml(destName)}</strong></span>
                    `;
                  }
                }
              }
            );
          } catch (err) {
            console.error("Directions route calculation error:", err);
            if (stats) stats.innerHTML = `<span style="color:#f87171;">⚠️ Unable to calculate a walking route right now</span>`;
          }
        }

        calculateRoute(userPos, destPos);

        // 4. Start live location watchPosition for real-time updates as user moves
        if (activeWatchId !== null) {
          navigator.geolocation.clearWatch(activeWatchId);
        }

        activeWatchId = navigator.geolocation.watchPosition(
          (watchPos) => {
            try {
              const liveLat = watchPos.coords.latitude;
              const liveLng = watchPos.coords.longitude;
              const newPos = { lat: liveLat, lng: liveLng };

              if (currentUserMarker) {
                currentUserMarker.setPosition(newPos);
              }
              calculateRoute(newPos, destPos);
            } catch (err) {
              console.error("WatchPosition update error:", err);
            }
          },
          (watchErr) => {
            console.warn("WatchPosition notice:", watchErr.message);
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
        );

      } catch (err) {
        console.error("Live Directions initialization error:", err);
        renderLeafletFallbackMap(userLat, userLng, numDestLat, numDestLng, destName, container, stats);
      }
    },
    (err) => {
      console.warn("Geolocation permission error:", err.message);
      if (stats) stats.innerHTML = '';
      if (statusBox) {
        statusBox.innerHTML = `<div class="map-permission-alert">Location access is needed to show walking directions. Please enable location permissions.</div>`;
      }
      showToast("Location access is needed to show walking directions. Please enable location permissions.", "error");
    },
    { enableHighAccuracy: true, timeout: 15000 }
  );
}

// Wrapper for CCA modal map button
function initMapDirectionsForCca(ccaId) {
  const cca = allCcas.find(c => c.id === ccaId);
  if (!cca) {
    console.error("CCA not found in allCcas array:", ccaId);
    showToast("Unable to locate CCA venue details.", "error");
    return;
  }
  const lat = cca.latitude || 1.3326;
  const lng = cca.longitude || 103.7744;
  startLiveWalkingDirections(lat, lng, cca.name, `cca_map_${cca.id}`);
}

// Wrapper for Event map button
function initMapDirectionsForEvent(eventId) {
  fetch(API_BASE + '/api/events/' + eventId)
    .then(res => res.json())
    .then(data => {
      if (data.success && data.event) {
        const evt = data.event;
        const lat = evt.latitude || 1.3326;
        const lng = evt.longitude || 103.7744;
        startLiveWalkingDirections(lat, lng, evt.title, `evt_map_${evt.id}`);
      }
    })
    .catch(err => {
      console.error("Event map error:", err);
      showToast("Unable to load event venue location.", "error");
    });
}

