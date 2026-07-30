// NP STUDENT PORTAL — Client Engine & 3D WebGL Campus Navigator

document.addEventListener('DOMContentLoaded', () => {

  // Global State Store
  const state = {
    session: JSON.parse(localStorage.getItem('np_student_session') || 'null'),
    profile: JSON.parse(localStorage.getItem('np_student_profile') || '{"name":"Alex Tan","studentId":"S10234567","school":"ICT"}'),
    pendingAuthId: null,
    surveyAnswers: {
      school: 'ICT',
      interests: [],
      commitment: 'Medium'
    },
    allCCAs: [],
    matchedCCAs: [],
    events: [],
    registeredEvents: [],
    selectedBlockId: null
  };

  // DOM Elements
  const authOverlay = document.getElementById('auth-overlay');
  const authLoginCard = document.getElementById('auth-login-card');
  const auth2FACard = document.getElementById('auth-2fa-card');
  const authLoginForm = document.getElementById('auth-login-form');
  const auth2FAForm = document.getElementById('auth-2fa-form');
  const authLoginErr = document.getElementById('auth-login-error');
  const auth2FAErr = document.getElementById('auth-2fa-error');
  
  const outlookToast = document.getElementById('outlook-toast');
  const toastCodeVal = document.getElementById('toast-code-val');
  const toastAutofillBtn = document.getElementById('toast-autofill-btn');
  const input2FACode = document.getElementById('input-2fa-code');

  const appLayout = document.getElementById('app');
  const btnLogout = document.getElementById('btn-logout');

  // Navigation Links
  const navLinks = document.querySelectorAll('.nav-links .nav-link');
  const mobileTabs = document.querySelectorAll('.mobile-bottom-nav .mobile-tab');
  const sections = document.querySelectorAll('.view-section');

  // ─── 1. AUTHENTICATION & 2FA ENGINE ─────────────────────────────
  checkAuthSession();

  function checkAuthSession() {
    if (state.session && state.session.token) {
      if (authOverlay) authOverlay.style.display = 'none';
      if (appLayout) appLayout.style.display = 'flex';
      initPortalAfterAuth();
    } else {
      if (authOverlay) authOverlay.style.display = 'flex';
      if (appLayout) appLayout.style.display = 'none';
    }
  }

  // Handle Login Submission
  if (authLoginForm) {
    authLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      authLoginErr.style.display = 'none';
      const emailOrId = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      const btnSubmit = document.getElementById('btn-submit-login');
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span>Authenticating...</span>';

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailOrId, password })
        });
        const data = await res.json();

        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<span>Sign In & Send 2FA Code</span> <span class="arr">➔</span>';

        if (data.success && data.require2FA) {
          state.pendingAuthId = data.studentId;

          // Switch Auth Card view to 2FA Card
          authLoginCard.style.display = 'none';
          auth2FACard.style.display = 'block';
          document.getElementById('2fa-subtext-msg').textContent = `A 6-digit security code has been sent to ${data.maskedEmail}. Please check your inbox.`;
          
          if (input2FACode) {
            input2FACode.value = data.devCode || '';
            input2FACode.focus();
          }

        } else {
          authLoginErr.textContent = data.error || 'Authentication failed.';
          authLoginErr.style.display = 'block';
        }
      } catch (err) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<span>Sign In & Send 2FA Code</span> <span class="arr">➔</span>';
        authLoginErr.textContent = 'Server connection error. Please try again.';
        authLoginErr.style.display = 'block';
      }
    });
  }

  // Toast Auto-fill Button
  if (toastAutofillBtn) {
    toastAutofillBtn.addEventListener('click', () => {
      if (input2FACode && toastCodeVal) {
        input2FACode.value = toastCodeVal.textContent;
        if (outlookToast) outlookToast.style.display = 'none';
      }
    });
  }

  // Handle 2FA Verification Submission
  if (auth2FAForm) {
    auth2FAForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      auth2FAErr.style.display = 'none';
      const code = input2FACode.value.trim();

      const btnVerify = document.getElementById('btn-submit-2fa');
      btnVerify.disabled = true;
      btnVerify.innerHTML = '<span>Verifying Code...</span>';

      try {
        const res = await fetch('/api/auth/verify-2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: state.pendingAuthId, code })
        });
        const data = await res.json();

        btnVerify.disabled = false;
        btnVerify.innerHTML = '<span>Verify 2FA & Enter Portal</span> <span class="arr">➔</span>';

        if (data.success && data.token) {
          state.session = { token: data.token };
          state.profile = data.profile;
          localStorage.setItem('np_student_session', JSON.stringify(state.session));
          localStorage.setItem('np_student_profile', JSON.stringify(state.profile));

          if (outlookToast) outlookToast.style.display = 'none';
          checkAuthSession();
        } else {
          auth2FAErr.textContent = data.error || 'Invalid 2FA verification code.';
          auth2FAErr.style.display = 'block';
        }
      } catch (err) {
        btnVerify.disabled = false;
        btnVerify.innerHTML = '<span>Verify 2FA & Enter Portal</span> <span class="arr">➔</span>';
        auth2FAErr.textContent = 'Verification error. Please try again.';
        auth2FAErr.style.display = 'block';
      }
    });
  }

  // Resend 2FA Code
  const btnResend2FA = document.getElementById('btn-resend-2fa');
  if (btnResend2FA) {
    btnResend2FA.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/auth/resend-2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: state.pendingAuthId })
        });
        const data = await res.json();
        if (data.success) {
          if (toastCodeVal) toastCodeVal.textContent = data.debugCode;
          if (outlookToast) outlookToast.style.display = 'block';
          if (input2FACode) input2FACode.value = data.debugCode;
          alert('New 2FA code dispatched to Outlook mail.');
        }
      } catch (err) {
        console.error('Resend 2FA error:', err);
      }
    });
  }

  // Back to Login Card
  const btnBackLogin = document.getElementById('btn-back-login');
  if (btnBackLogin) {
    btnBackLogin.addEventListener('click', () => {
      auth2FACard.style.display = 'none';
      authLoginCard.style.display = 'block';
      if (outlookToast) outlookToast.style.display = 'none';
    });
  }

  // Logout Handler
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('np_student_session');
      state.session = null;
      checkAuthSession();
    });
  }

  // ─── 2. PORTAL INITIALIZATION POST-AUTH ──────────────────────────
  function initPortalAfterAuth() {
    initHeaderAndProfileUI();
    setupTabNavigation();
    setupDashboardView();
    setupSurveyWizard();
    fetchDirectoryCCAs();
    fetchUpcomingEvents();
    fetchMyRegisteredEvents();

    // Initialize 3D Canvas Engine
    init3DCampusMap();
  }

  function initHeaderAndProfileUI() {
    const avatarHeader = document.getElementById('header-avatar-initial');
    const nameHeader = document.getElementById('header-user-name');
    const dashName = document.getElementById('dash-student-name');
    const dashSchool = document.getElementById('dash-school-lbl');

    const profName = document.getElementById('profile-display-name');
    const profSchool = document.getElementById('profile-school-tag');
    const profAvatar = document.getElementById('profile-avatar-large');

    const inputName = document.getElementById('prof-input-name');
    const inputId = document.getElementById('prof-input-id');
    const inputSchool = document.getElementById('prof-input-school');

    if (state.profile) {
      const initial = (state.profile.name || 'S').charAt(0).toUpperCase();
      if (avatarHeader) avatarHeader.textContent = initial;
      if (nameHeader) nameHeader.textContent = state.profile.name || 'Alex Tan';
      if (dashName) dashName.textContent = state.profile.name || 'Alex Tan';
      if (dashSchool) dashSchool.textContent = `School of ${state.profile.school || 'ICT'}`;

      if (profAvatar) profAvatar.textContent = initial;
      if (profName) profName.textContent = state.profile.name || 'Alex Tan';
      if (profSchool) profSchool.textContent = `School of ${state.profile.school || 'ICT'} • Ngee Ann Poly`;

      if (inputName) inputName.value = state.profile.name || '';
      if (inputId) inputId.value = state.profile.studentId || '';
      if (inputSchool) inputSchool.value = state.profile.school || 'ICT';
    }
  }

  // ─── 3. TAB ROUTING ENGINE ──────────────────────────────────────
  function setupTabNavigation() {
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        const targetTab = link.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });

    mobileTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });

    document.querySelectorAll('.btn-nav-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        switchTab(target);
      });
    });

    document.querySelectorAll('.btn-nav-map-3d').forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab('map');
      });
    });

    const btnQuickProf = document.getElementById('btn-quick-profile');
    if (btnQuickProf) {
      btnQuickProf.addEventListener('click', () => switchTab('profile'));
    }

    const brandHome = document.getElementById('brand-home-trigger');
    if (brandHome) {
      brandHome.addEventListener('click', () => switchTab('dashboard'));
    }
  }

  function switchTab(tabId) {
    navLinks.forEach(l => {
      if (l.getAttribute('data-tab') === tabId) l.classList.add('active');
      else l.classList.remove('active');
    });

    mobileTabs.forEach(m => {
      if (m.getAttribute('data-tab') === tabId) m.classList.add('active');
      else m.classList.remove('active');
    });

    sections.forEach(s => {
      if (s.id === `view-${tabId}`) s.classList.add('active');
      else s.classList.remove('active');
    });

    if (tabId === 'map') {
      setTimeout(() => onResize3DCanvas(), 100);
    }
    if (tabId === 'events') fetchUpcomingEvents();
    if (tabId === 'profile') fetchMyRegisteredEvents();
  }

  // ─── 4. DASHBOARD VIEW CONTROLLER ──────────────────────────────
  function setupDashboardView() {
    document.querySelectorAll('.btn-focus-3d').forEach(btn => {
      btn.addEventListener('click', () => {
        const blockId = btn.getAttribute('data-block');
        switchTab('map');
        selectBlockIn3DMap(blockId);
      });
    });
  }

  // ─── 5. 3D WEBGL CAMPUS NAVIGATOR ENGINE (Three.js) ────────────
  let scene, camera, renderer, controls;
  let buildingMeshes = [];
  let pinMeshes = [];
  let routeBeamMesh = null;
  let raycaster, mouse;
  let animFrameId = null;

  function init3DCampusMap() {
    const holder = document.getElementById('three-canvas-holder');
    if (!holder || typeof THREE === 'undefined') return;

    // Clear previous canvas if re-initializing
    holder.innerHTML = '';

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.FogExp2(0x0f172a, 0.008);

    // Camera
    const aspect = holder.clientWidth / holder.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(45, 55, 65);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(holder.clientWidth, holder.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    holder.appendChild(renderer.domElement);

    // OrbitControls
    if (typeof THREE.OrbitControls !== 'undefined') {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.maxPolarAngle = Math.PI / 2 - 0.05; // don't go below ground
      controls.target.set(0, 0, 0);
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x60a5fa, 1.2);
    dirLight.position.set(40, 80, 40);
    scene.add(dirLight);

    const purpleLight = new THREE.PointLight(0xa855f7, 2, 100);
    purpleLight.position.set(-20, 30, -10);
    scene.add(purpleLight);

    // Ground Grid & Base Floor
    const gridHelper = new THREE.GridHelper(140, 35, 0x3b82f6, 0x1e293b);
    gridHelper.position.y = -0.1;
    scene.add(gridHelper);

    const groundGeo = new THREE.PlaneGeometry(160, 160);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9, metalness: 0.1 });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.2;
    scene.add(groundMesh);

    // Build 3D Buildings & Floating Pins from CAMPUS_LOCATIONS
    buildingMeshes = [];
    pinMeshes = [];

    if (typeof CAMPUS_LOCATIONS !== 'undefined') {
      CAMPUS_LOCATIONS.forEach(loc => {
        if (!loc.pos3d) return;

        // 3D Building Mesh
        const bGeo = new THREE.BoxGeometry(loc.dim3d.width, loc.dim3d.height, loc.dim3d.depth);
        const bMat = new THREE.MeshStandardMaterial({
          color: parseInt(loc.color.replace('#', '0x'), 16),
          roughness: 0.3,
          metalness: 0.3,
          transparent: true,
          opacity: 0.85
        });
        const building = new THREE.Mesh(bGeo, bMat);
        building.position.set(loc.pos3d.x, loc.dim3d.height / 2, loc.pos3d.z);
        building.userData = { location: loc };
        scene.add(building);
        buildingMeshes.push(building);

        // Building Wireframe Edges
        const edges = new THREE.EdgesGeometry(bGeo);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1, transparent: true, opacity: 0.4 });
        const wireframe = new THREE.LineSegments(edges, lineMat);
        building.add(wireframe);

        // 3D Floating Pin
        const pinGroup = new THREE.Group();
        const sphereGeo = new THREE.SphereGeometry(1.2, 16, 16);
        const sphereMat = new THREE.MeshBasicMaterial({ color: parseInt(loc.color.replace('#', '0x'), 16) });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);

        const coneGeo = new THREE.ConeGeometry(0.8, 2, 16);
        const coneMat = new THREE.MeshBasicMaterial({ color: parseInt(loc.color.replace('#', '0x'), 16) });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.rotation.x = Math.PI;
        cone.position.y = -1.2;

        pinGroup.add(sphere);
        pinGroup.add(cone);
        pinGroup.position.set(loc.pos3d.x, loc.pinOffset || (loc.dim3d.height + 4), loc.pos3d.z);
        pinGroup.userData = { location: loc, baseY: loc.pinOffset || (loc.dim3d.height + 4) };

        scene.add(pinGroup);
        pinMeshes.push(pinGroup);
      });
    }

    // Raycasting setup for mouse clicks
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    holder.addEventListener('click', onCanvasClick);
    window.addEventListener('resize', onResize3DCanvas);

    // Setup Camera Toolbar Presets
    setupCameraToolbar();

    // Start Animation Loop
    animate3D();
  }

  function animate3D() {
    animFrameId = requestAnimationFrame(animate3D);

    const time = Date.now() * 0.003;

    // Float 3D Pins up and down smoothly
    pinMeshes.forEach(pin => {
      if (pin.userData && pin.userData.baseY) {
        pin.position.y = pin.userData.baseY + Math.sin(time + pin.position.x) * 0.4;
        pin.rotation.y += 0.01;
      }
    });

    if (controls) controls.update();
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  function onResize3DCanvas() {
    const holder = document.getElementById('three-canvas-holder');
    if (!holder || !renderer || !camera) return;

    camera.aspect = holder.clientWidth / holder.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(holder.clientWidth, holder.clientHeight);
  }

  function onCanvasClick(e) {
    const holder = document.getElementById('three-canvas-holder');
    if (!holder || !raycaster) return;

    const rect = holder.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / holder.clientWidth) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / holder.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(buildingMeshes, false);

    if (intersects.length > 0) {
      const targetBuilding = intersects[0].object;
      const loc = targetBuilding.userData.location;
      selectBlockIn3DMap(loc.id);
    }
  }

  function selectBlockIn3DMap(blockId) {
    const loc = CAMPUS_LOCATIONS.find(l => l.id === blockId);
    if (!loc) return;

    state.selectedBlockId = blockId;

    // Reset Building opacity
    buildingMeshes.forEach(mesh => {
      if (mesh.userData.location.id === blockId) {
        mesh.material.opacity = 1.0;
        mesh.material.color.setHex(0x60a5fa);
      } else {
        mesh.material.opacity = 0.5;
        mesh.material.color.setHex(parseInt(mesh.userData.location.color.replace('#', '0x'), 16));
      }
    });

    // Tween Camera to focus on target block
    if (controls && loc.pos3d) {
      const targetPos = new THREE.Vector3(loc.pos3d.x, 0, loc.pos3d.z);
      const camPos = new THREE.Vector3(loc.pos3d.x + 20, 25, loc.pos3d.z + 25);
      
      controls.target.copy(targetPos);
      camera.position.copy(camPos);
    }

    // Render Indoor Route Guide Timeline & Details
    renderBlockInspector(loc);

    // Draw Animated 3D Route Beam from Blk 1 Atrium to Target
    draw3DRouteBeam(loc);
  }

  function renderBlockInspector(loc) {
    const defaultMsg = document.getElementById('inspector-default-msg');
    const content = document.getElementById('inspector-content');

    const title = document.getElementById('insp-name');
    const school = document.getElementById('insp-school');
    const icon = document.getElementById('insp-icon');
    const levelsList = document.getElementById('insp-levels-list');
    const routeSteps = document.getElementById('insp-route-steps');
    const ccasTags = document.getElementById('insp-ccas-tags');

    if (!content) return;

    defaultMsg.style.display = 'none';
    content.style.display = 'block';

    if (title) title.textContent = loc.name;
    if (school) school.textContent = `${loc.school} • Block ${loc.number}`;
    if (icon) icon.textContent = loc.icon || '📍';

    if (levelsList) {
      levelsList.innerHTML = (loc.levels || []).map(lvl => `<li>🏢 ${lvl}</li>`).join('');
    }

    if (routeSteps) {
      routeSteps.innerHTML = (loc.indoorGuide || []).map(stepObj => `
        <div class="route-step-item">
          <div class="step-num-badge">${stepObj.step}</div>
          <div class="step-text">${stepObj.text}</div>
        </div>
      `).join('');
    }

    if (ccasTags) {
      ccasTags.innerHTML = (loc.ccasHere || []).map(c => `<span class="cca-tag-pill">${c}</span>`).join('');
    }
  }

  function draw3DRouteBeam(loc) {
    if (routeBeamMesh) {
      scene.remove(routeBeamMesh);
      routeBeamMesh = null;
    }

    const startPos = new THREE.Vector3(0, 0.5, 12); // Blk 1 Main Atrium
    const endPos = new THREE.Vector3(loc.pos3d.x, 0.5, loc.pos3d.z);

    const curve = new THREE.CatmullRomCurve3([
      startPos,
      new THREE.Vector3((startPos.x + endPos.x) / 2, 4, (startPos.z + endPos.z) / 2),
      endPos
    ]);

    const points = curve.getPoints(50);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x60a5fa, linewidth: 4 });

    routeBeamMesh = new THREE.Line(geometry, material);
    scene.add(routeBeamMesh);
  }

  function setupCameraToolbar() {
    const btnIso = document.getElementById('btn-cam-iso');
    const btnTop = document.getElementById('btn-cam-top');
    const btnBlk31 = document.getElementById('btn-cam-blk31');
    const btnBlk72 = document.getElementById('btn-cam-blk72');
    const btnSports = document.getElementById('btn-cam-sports');
    const btnReset = document.getElementById('btn-cam-reset');

    function setActiveBtn(activeBtn) {
      document.querySelectorAll('.canvas-toolbar .tb-btn').forEach(b => b.classList.remove('active'));
      if (activeBtn) activeBtn.classList.add('active');
    }

    if (btnIso) {
      btnIso.addEventListener('click', () => {
        setActiveBtn(btnIso);
        camera.position.set(45, 55, 65);
        if (controls) controls.target.set(0, 0, 0);
      });
    }

    if (btnTop) {
      btnTop.addEventListener('click', () => {
        setActiveBtn(btnTop);
        camera.position.set(0, 100, 0.1);
        if (controls) controls.target.set(0, 0, 0);
      });
    }

    if (btnBlk31) {
      btnBlk31.addEventListener('click', () => {
        setActiveBtn(btnBlk31);
        selectBlockIn3DMap('blk31');
      });
    }

    if (btnBlk72) {
      btnBlk72.addEventListener('click', () => {
        setActiveBtn(btnBlk72);
        selectBlockIn3DMap('blk72');
      });
    }

    if (btnSports) {
      btnSports.addEventListener('click', () => {
        setActiveBtn(btnSports);
        selectBlockIn3DMap('sports_complex');
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        setActiveBtn(btnIso);
        camera.position.set(45, 55, 65);
        if (controls) controls.target.set(0, 0, 0);
        buildingMeshes.forEach(mesh => {
          mesh.material.opacity = 0.85;
          mesh.material.color.setHex(parseInt(mesh.userData.location.color.replace('#', '0x'), 16));
        });
        if (routeBeamMesh) {
          scene.remove(routeBeamMesh);
          routeBeamMesh = null;
        }
      });
    }
  }

  // ─── 6. OPTIONAL SURVEY WIZARD ───────────────────────────────────
  function setupSurveyWizard() {
    const q1 = document.getElementById('survey-q1');
    const q2 = document.getElementById('survey-q2');
    const q3 = document.getElementById('survey-q3');
    const pill1 = document.getElementById('step-pill-1');
    const pill2 = document.getElementById('step-pill-2');
    const pill3 = document.getElementById('step-pill-3');

    const btnNextQ2 = document.getElementById('btn-next-q2');
    const btnRetake = document.getElementById('btn-retake-survey');
    const surveyCard = document.getElementById('survey-card');
    const matchResultsSec = document.getElementById('match-results-section');

    function updateWizardProgress(step) {
      if (step === 1) {
        if (pill1) pill1.classList.add('active');
        if (pill2) pill2.classList.remove('active');
        if (pill3) pill3.classList.remove('active');
      } else if (step === 2) {
        if (pill1) pill1.classList.add('active');
        if (pill2) pill2.classList.add('active');
        if (pill3) pill3.classList.remove('active');
      } else if (step === 3) {
        if (pill1) pill1.classList.add('active');
        if (pill2) pill2.classList.add('active');
        if (pill3) pill3.classList.add('active');
      }
    }

    document.querySelectorAll('#survey-q1 .school-glass-card').forEach(btn => {
      btn.addEventListener('click', () => {
        state.surveyAnswers.school = btn.getAttribute('data-val');
        if (q1) q1.style.display = 'none';
        if (q2) q2.style.display = 'block';
        updateWizardProgress(2);
      });
    });

    document.querySelectorAll('#survey-q2 .multi-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('selected');
        const val = btn.getAttribute('data-val');
        if (btn.classList.contains('selected')) {
          if (!state.surveyAnswers.interests.includes(val)) state.surveyAnswers.interests.push(val);
        } else {
          state.surveyAnswers.interests = state.surveyAnswers.interests.filter(i => i !== val);
        }
      });
    });

    if (btnNextQ2) {
      btnNextQ2.addEventListener('click', () => {
        if (q2) q2.style.display = 'none';
        if (q3) q3.style.display = 'block';
        updateWizardProgress(3);
      });
    }

    document.querySelectorAll('#survey-q3 .commitment-glass-card').forEach(btn => {
      btn.addEventListener('click', async () => {
        state.surveyAnswers.commitment = btn.getAttribute('data-val');
        if (surveyCard) surveyCard.style.display = 'none';
        if (matchResultsSec) matchResultsSec.style.display = 'block';
        await calculateAndRenderMatches();
      });
    });

    if (btnRetake) {
      btnRetake.addEventListener('click', () => {
        if (surveyCard) surveyCard.style.display = 'block';
        if (matchResultsSec) matchResultsSec.style.display = 'none';
        if (q1) q1.style.display = 'block';
        if (q2) q2.style.display = 'none';
        if (q3) q3.style.display = 'none';
        updateWizardProgress(1);
        document.querySelectorAll('.multi-opt').forEach(b => b.classList.remove('selected'));
        state.surveyAnswers.interests = [];
      });
    }
  }

  async function calculateAndRenderMatches() {
    const container = document.getElementById('match-cards-container');
    if (!container) return;

    container.innerHTML = `<div style="text-align:center; padding:3rem; color:var(--ink-soft);">Computing matches...</div>`;

    try {
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.surveyAnswers)
      });
      state.matchedCCAs = await res.json();
      container.innerHTML = state.matchedCCAs.map(cca => renderCCABentoHTML(cca, true)).join('');
      bindCardActionEvents(container);
    } catch (err) {
      console.error('Match error:', err);
    }
  }

  // ─── 7. CCA DIRECTORY & EVENTS HANDLERS ─────────────────────────
  async function fetchDirectoryCCAs(category = 'All', query = '') {
    const container = document.getElementById('directory-cards-container');
    const countBadge = document.getElementById('cca-count');
    if (!container) return;

    try {
      const url = `/api/ccas?category=${encodeURIComponent(category)}&query=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      state.allCCAs = await res.json();

      if (countBadge) countBadge.textContent = `${state.allCCAs.length} CCAs`;

      if (state.allCCAs.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:3rem; color:var(--ink-muted); grid-column:1/-1;">No clubs found matching "${query}".</div>`;
        return;
      }

      container.innerHTML = state.allCCAs.map(cca => renderCCABentoHTML(cca, false)).join('');
      bindCardActionEvents(container);
    } catch (err) {
      console.error('Directory fetch error:', err);
    }
  }

  const searchInput = document.getElementById('cca-search-input');
  const segmentPills = document.querySelectorAll('.segment-pill');
  let selectedCategory = 'All';

  segmentPills.forEach(btn => {
    btn.addEventListener('click', () => {
      segmentPills.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCategory = btn.getAttribute('data-filter-cat');
      fetchDirectoryCCAs(selectedCategory, searchInput ? searchInput.value.trim() : '');
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      fetchDirectoryCCAs(selectedCategory, e.target.value.trim());
    });
  }

  async function fetchUpcomingEvents() {
    const container = document.getElementById('events-list-container');
    const previewContainer = document.getElementById('dash-events-preview');

    try {
      const res = await fetch('/api/events');
      state.events = await res.json();

      if (previewContainer) {
        previewContainer.innerHTML = state.events.slice(0, 2).map(evt => `
          <div style="background:var(--control-dark); border:1px solid var(--line-glass); padding:1rem; border-radius:var(--radius-md); margin-bottom:0.75rem;">
            <div style="font-size:0.78rem; color:var(--brand-blue); font-weight:700;">${evt.cca_name}</div>
            <div style="font-weight:600; font-size:1rem; margin:0.2rem 0;">${evt.title}</div>
            <div style="font-size:0.8rem; color:var(--ink-muted); margin-bottom:0.5rem;">📅 ${evt.date} • 📍 ${evt.location}</div>
            <button class="btn btn-sage btn-sm btn-signup-event" data-event-id="${evt.id}">
              1-Click Sign Up ➔
            </button>
          </div>
        `).join('');
      }

      if (container) {
        container.innerHTML = state.events.map(evt => {
          const [year, monthNum, dayStr] = evt.date.split('-');
          const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
          const monthStr = monthNames[parseInt(monthNum, 10) - 1] || 'AUG';

          return `
            <div class="bento-glass event-glass-card" style="padding:1.5rem; border-radius:var(--radius-lg); margin-bottom:1rem; display:flex; gap:1.5rem; align-items:center;">
              <div style="text-align:center; background:rgba(59,130,246,0.15); padding:0.8rem 1.2rem; border-radius:var(--radius-md); border:1px solid rgba(59,130,246,0.3);">
                <div style="font-size:0.75rem; font-weight:800; color:var(--brand-blue);">${monthStr}</div>
                <div style="font-size:1.6rem; font-weight:800; color:var(--ink-bright);">${dayStr}</div>
              </div>

              <div style="flex:1;">
                <div style="font-size:0.8rem; font-weight:700; color:var(--brand-blue);">${evt.cca_name}</div>
                <h3 style="font-size:1.15rem; color:var(--ink-bright); margin:0.2rem 0;">${evt.title}</h3>
                <p style="font-size:0.86rem; color:var(--ink-soft); margin-bottom:0.5rem;">${evt.description}</p>
                <div style="font-size:0.8rem; color:var(--ink-muted);">⏰ ${evt.time} • 📍 ${evt.location}</div>
              </div>

              <button class="btn btn-sage btn-sm btn-signup-event" data-event-id="${evt.id}">
                <span>One-Click Sign Up</span> <span class="arr">↗</span>
              </button>
            </div>
          `;
        }).join('');
      }

      bindEventSignupHandlers();
    } catch (err) {
      console.error('Events fetch error:', err);
    }
  }

  function bindEventSignupHandlers() {
    document.querySelectorAll('.btn-signup-event').forEach(btn => {
      btn.addEventListener('click', async () => {
        const eventId = btn.getAttribute('data-event-id');
        btn.disabled = true;

        try {
          const res = await fetch('/api/events/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentId: state.profile.studentId || 'S10234567',
              studentName: state.profile.name || 'Alex Tan',
              eventId
            })
          });

          const data = await res.json();
          if (data.success) {
            alert(`🎉 ${data.message}`);
            btn.innerHTML = '<span>✓ Registered</span>';
            btn.classList.replace('btn-sage', 'btn-ghost');
            fetchMyRegisteredEvents();
          } else {
            alert(`⚠️ ${data.error || 'Registration failed'}`);
            btn.disabled = false;
          }
        } catch (err) {
          console.error('Signup error:', err);
          btn.disabled = false;
        }
      });
    });
  }

  async function fetchMyRegisteredEvents() {
    const container = document.getElementById('my-events-container');
    const countBadge = document.getElementById('my-events-count');
    if (!container) return;

    try {
      const studentId = state.profile.studentId || 'S10234567';
      const res = await fetch(`/api/user/events?studentId=${encodeURIComponent(studentId)}`);
      state.registeredEvents = await res.json();

      if (countBadge) countBadge.textContent = `${state.registeredEvents.length} Events`;

      if (state.registeredEvents.length === 0) {
        container.innerHTML = `<div style="padding:1.5rem; text-align:center; color:var(--ink-muted);">No event registrations yet.</div>`;
        return;
      }

      container.innerHTML = state.registeredEvents.map(evt => `
        <div style="background:var(--control-dark); border:1px solid var(--line-glass); padding:1rem; border-radius:var(--radius-md); margin-bottom:0.75rem;">
          <div style="font-family:var(--font-serif); font-size:1.05rem; margin-bottom:0.2rem;">${evt.title}</div>
          <div style="font-size:0.78rem; color:var(--brand-emerald); font-weight:600; margin-bottom:0.5rem;">✓ Registered • ${evt.cca_name}</div>
          <div style="font-size:0.78rem; color:var(--ink-muted); margin-bottom:0.75rem;">📅 ${evt.date} (${evt.time}) • 📍 ${evt.location}</div>
          <button class="btn btn-sage btn-sm btn-focus-3d" data-block="${evt.block_query ? 'blk31' : 'blk31'}">
            Navigate in 3D Map
          </button>
        </div>
      `).join('');

    } catch (err) {
      console.error('My events error:', err);
    }
  }

  function renderCCABentoHTML(cca, isMatch = false) {
    return `
      <div class="bento-glass bento-item">
        <div>
          <div class="bento-item-header">
            <div>
              <h3 class="bento-item-title">${cca.name}</h3>
              <div class="bento-item-category">${cca.category} • School of ${cca.school}</div>
            </div>
            ${isMatch ? `<span class="match-score-pill">${cca.matchPercentage}% Match</span>` : ''}
          </div>

          <p class="bento-item-desc">${cca.description}</p>

          <div class="bento-meta-stack">
            <div><span>📍 ${cca.location}</span></div>
            <div><span>⚡ ${cca.commitment} Commitment</span></div>
          </div>
        </div>

        <div class="bento-item-actions">
          <button class="btn btn-ghost btn-sm btn-focus-3d" data-block="${cca.block_query.includes('31') ? 'blk31' : (cca.block_query.includes('72') ? 'blk72' : 'sports_complex')}">
            <span>3D Map Guide</span>
          </button>
          <button class="btn btn-sage btn-sm btn-nav-tab" data-target="events">
            <span>View Events</span> <span class="arr">↗</span>
          </button>
        </div>
      </div>
    `;
  }

  function bindCardActionEvents(parentEl) {
    if (!parentEl) return;
    parentEl.querySelectorAll('.btn-focus-3d').forEach(btn => {
      btn.addEventListener('click', () => {
        const blockId = btn.getAttribute('data-block');
        switchTab('map');
        selectBlockIn3DMap(blockId);
      });
    });
    parentEl.querySelectorAll('.btn-nav-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        switchTab(target);
      });
    });
  }

});
