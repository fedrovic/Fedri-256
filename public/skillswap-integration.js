/**
 * SkillSwap — Frontend ↔ Backend Integration Guide
 * ══════════════════════════════════════════════════
 *
 * Add to EVERY authenticated page (dashboard, discover, profile, etc.):
 *   <script src="skillswap-api.js"></script>
 *
 * Then in your page's <script>:
 *   const ctx = await SkillSwap.init();
 *   const { api, socket, user } = ctx;
 *
 * For public pages (landing):
 *   const api = SkillSwap.initPublic();
 */

// ════════════════════════════════════════════════════════════════
//  AUTH PAGE  (skillswap-auth.html)
// ════════════════════════════════════════════════════════════════
async function wireAuthPage() {
  const api = SkillSwap.initPublic();

  // If already logged in, skip to dashboard
  if (api.isAuthenticated()) {
    window.location.href = 'skillswap-dashboard.html';
    return;
  }

  // ── Login form ──────────────────────────────────────────────
  document.getElementById('loginBtn').addEventListener('click', async () => {
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPass').value;
    const errEl    = document.getElementById('loginError');
    errEl.classList.remove('show');

    try {
      const btn = document.getElementById('loginBtn');
      btn.classList.add('loading');
      await api.auth.login({ email, password });
      window.location.href = 'skillswap-dashboard.html';
    } catch (err) {
      document.getElementById('loginErrorText').textContent = err.message;
      document.getElementById('loginError').classList.add('show');
      document.getElementById('loginBtn').classList.remove('loading');
    }
  });

  // ── Register form ────────────────────────────────────────────
  document.getElementById('registerBtn').addEventListener('click', async () => {
    const firstName = document.getElementById('regFirst').value.trim();
    const lastName  = document.getElementById('regLast').value.trim();
    const email     = document.getElementById('regEmail').value.trim();
    const password  = document.getElementById('regPass').value;
    const confirm   = document.getElementById('regPassConfirm').value;
    const terms     = document.getElementById('agreeTerms').checked;

    const errEl = document.getElementById('regError');
    errEl.classList.remove('show');

    if (password !== confirm) {
      document.getElementById('regErrorText').textContent = 'Passwords do not match.';
      errEl.classList.add('show'); return;
    }
    if (!terms) {
      document.getElementById('regErrorText').textContent = 'Please accept the Terms of Service.';
      errEl.classList.add('show'); return;
    }

    try {
      document.getElementById('registerBtn').classList.add('loading');
      await api.auth.register({ email, password, firstName, lastName });
      window.location.href = 'skillswap-onboarding.html';
    } catch (err) {
      document.getElementById('regErrorText').textContent = err.message;
      errEl.classList.add('show');
      document.getElementById('registerBtn').classList.remove('loading');
    }
  });

  // ── Google OAuth button ──────────────────────────────────────
  document.getElementById('googleLoginBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    api.auth.loginWithGoogle();
  });

  // ── Forgot password ──────────────────────────────────────────
  document.getElementById('forgotBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('forgotEmail').value.trim();
    if (!email) return;
    try {
      await api.auth.forgotPassword(email);
      document.getElementById('forgotForm').style.display = 'none';
      document.getElementById('forgotSuccess').classList.add('show');
    } catch (err) {
      console.error('Forgot password error:', err.message);
    }
  });
}

// ════════════════════════════════════════════════════════════════
//  ONBOARDING PAGE  (skillswap-onboarding.html)
// ════════════════════════════════════════════════════════════════
async function wireOnboardingPage() {
  const ctx = await SkillSwap.init();
  if (!ctx) return;
  const { api, user } = ctx;

  // Pre-fill name from registration
  if (user) {
    document.getElementById('s1First').value   = user.firstName || '';
    document.getElementById('s1Last').value    = user.lastName  || '';
    document.getElementById('s1Display').value = user.displayName || '';
  }

  // Step 3 "Finish Setup" button
  document.querySelector('.btn-next[onclick="completeOnboarding()"]')?.addEventListener('click', async () => {
    try {
      // 1. Save profile
      const bio      = document.getElementById('s1Bio')?.value;
      const location = document.getElementById('s1Location')?.value;
      const language = document.getElementById('s1Lang')?.value;
      await api.users.updateMe({
        bio,
        location,
        ...(language && { languages: language.split(',').map(l => l.trim()) }),
      });

      // 2. Save availability
      const checkedDays = document.querySelectorAll('.day-check:checked');
      const availability = Array.from(checkedDays).map(cb => {
        const row     = cb.closest('.day-row');
        const dayMap  = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };
        const day     = row?.dataset.day;
        const selects = row?.querySelectorAll('.time-select');
        return {
          dayOfWeek: dayMap[day] ?? 1,
          startTime: selects?.[0]?.value || '09:00',
          endTime:   selects?.[1]?.value || '17:00',
          timezone:  document.getElementById('tzSelect')?.value?.split(' ')[0] || 'UTC',
        };
      });

      if (availability.length > 0) {
        await api.users.setAvailability(availability);
      }
    } catch (err) {
      console.error('Onboarding save error:', err.message);
      // Continue anyway — not blocking
    }
  });
}

// ════════════════════════════════════════════════════════════════
//  DASHBOARD PAGE  (skillswap-dashboard.html)
// ════════════════════════════════════════════════════════════════
async function wireDashboardPage() {
  const ctx = await SkillSwap.init();
  if (!ctx) return;
  const { api, socket, user } = ctx;

  // ── Personalise greeting ────────────────────────────────────
  const greetingEl = document.querySelector('.wb-text h2');
  if (greetingEl && user) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    greetingEl.textContent = `${greeting}, ${user.firstName || user.displayName} 👋`;
  }

  // ── Load stats ──────────────────────────────────────────────
  try {
    const [swapsRes, sessionsRes, coinRes, notifRes] = await Promise.all([
      api.swaps.getAll({ status: 'ACTIVE', limit: 3 }),
      api.sessions.getUpcoming(),
      api.coins.getWallet(),
      api.notifications.getUnreadCount(),
    ]);

    // Update stat cards
    const statCards = document.querySelectorAll('.stat-card');
    if (statCards[0]) statCards[0].querySelector('.stat-value').textContent = swapsRes.meta?.total || 0;
    if (statCards[2]) statCards[2].querySelector('.stat-value').textContent = `⬡ ${coinRes.data?.balance || 0}`;
    if (statCards[3]) statCards[3].querySelector('.stat-value').textContent = `${user?.reputationScore?.toFixed(1) || '0.0'}★`;

    // Update pending requests badge
    const pendingRes = await api.swaps.getAll({ status: 'PENDING' });
    if (pendingRes.data?.length > 0) {
      document.querySelectorAll('.nav-badge').forEach(b => {
        if (b.closest('[href="skillswap-swaps.html"]')) b.textContent = pendingRes.data.length;
      });
    }
  } catch (err) {
    console.error('Dashboard load error:', err.message);
  }

  // ── Real-time: new messages badge ───────────────────────────
  socket.on('message:new', () => {
    const msgBadge = document.querySelector('.icon-btn:nth-child(2) .notif-badge');
    if (msgBadge) {
      msgBadge.textContent = (parseInt(msgBadge.textContent) || 0) + 1;
      msgBadge.style.background = 'var(--green)';
    }
  });

  // ── Logout button ────────────────────────────────────────────
  document.querySelectorAll('[href="skillswap-auth.html"]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      await api.auth.logout();
    });
  });
}

// ════════════════════════════════════════════════════════════════
//  DISCOVER PAGE  (skillswap-discover.html)
// ════════════════════════════════════════════════════════════════
async function wireDiscoverPage() {
  const ctx = await SkillSwap.init();
  if (!ctx) return;
  const { api } = ctx;

  // Load categories into the category bar
  try {
    const { data: cats } = await api.search.categories();
    // (categories already hardcoded in HTML but real app would render from API)
    console.log('[Discover] Categories loaded:', cats.length);
  } catch (err) {
    console.error('Categories load error:', err.message);
  }

  // Wire search input to backend
  let searchTimer;
  document.getElementById('mainSearch')?.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      const q = e.target.value.trim();
      if (!q) return;
      try {
        const res = await api.search.users({ q, limit: 20 });
        document.getElementById('resultCount').textContent = res.meta?.total || 0;
      } catch {}
    }, 400);
  });

  // Wire "View Profile" buttons (delegated)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-view');
    if (btn) {
      // In a real SPA, pass userId via data attribute
      window.location.href = 'skillswap-profile.html';
    }
  });
}

// ════════════════════════════════════════════════════════════════
//  SWAP MANAGER PAGE  (skillswap-swaps.html)
// ════════════════════════════════════════════════════════════════
async function wireSwapsPage() {
  const ctx = await SkillSwap.init();
  if (!ctx) return;
  const { api, socket } = ctx;

  // Load real swaps
  try {
    const active    = await api.swaps.getAll({ status: 'ACTIVE' });
    const pending   = await api.swaps.getAll({ status: 'PENDING' });
    const completed = await api.swaps.getAll({ status: 'COMPLETED' });

    // Update tab counts
    const tabs = document.querySelectorAll('.swap-tab .tab-count');
    if (tabs[0]) tabs[0].textContent = active.meta?.total    || 0;
    if (tabs[1]) tabs[1].textContent = pending.meta?.total   || 0;
    if (tabs[2]) tabs[2].textContent = completed.meta?.total || 0;

    console.log('[Swaps] Loaded:', { active: active.meta?.total, pending: pending.meta?.total });
  } catch (err) {
    console.error('Swaps load error:', err.message);
  }

  // Real-time swap updates
  socket.on('swap:updated', (data) => {
    console.log('[Swaps] Real-time update:', data);
    // Refresh the active tab
  });
}

// ════════════════════════════════════════════════════════════════
//  MESSAGES PAGE  (skillswap-messages.html)
// ════════════════════════════════════════════════════════════════
async function wireMessagesPage() {
  const ctx = await SkillSwap.init();
  if (!ctx) return;
  const { api, socket, user } = ctx;

  let activeSwapId = null;

  // ── Load inbox ──────────────────────────────────────────────
  try {
    const { data: inbox } = await api.messages.getInbox();
    console.log('[Messages] Inbox loaded:', inbox.length, 'conversations');
    // In a real SPA, render inbox items from API data
  } catch (err) {
    console.error('Inbox load error:', err.message);
  }

  // ── Send message ─────────────────────────────────────────────
  document.getElementById('sendBtn')?.addEventListener('click', async () => {
    if (!activeSwapId) return;
    const input   = document.getElementById('chatInput');
    const content = input.value.trim();
    if (!content) return;

    try {
      await api.messages.send(activeSwapId, content);
      input.value = '';
      input.style.height = 'auto';
      document.getElementById('sendBtn').disabled = true;
    } catch (err) {
      console.error('Send failed:', err.message);
    }
  });

  // ── Real-time incoming messages ──────────────────────────────
  socket.on('message:new', (msg) => {
    if (msg.swapId === activeSwapId) {
      // renderMessage(msg) — handled by existing HTML demo
      console.log('[Messages] New message received:', msg.id);
    }
    // Update unread count in inbox
  });

  // ── Typing indicator ─────────────────────────────────────────
  let typingTimer;
  document.getElementById('chatInput')?.addEventListener('input', () => {
    if (!activeSwapId) return;
    socket.sendTyping(activeSwapId, true);
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => socket.sendTyping(activeSwapId, false), 1500);
  });

  socket.on('typing:start', ({ userId }) => {
    if (userId !== user.id) {
      document.getElementById('typingIndicator').style.display = 'flex';
    }
  });
  socket.on('typing:stop', () => {
    document.getElementById('typingIndicator').style.display = 'none';
  });
}

// ════════════════════════════════════════════════════════════════
//  PROFILE PAGE  (skillswap-profile.html)
// ════════════════════════════════════════════════════════════════
async function wireProfilePage() {
  const ctx = await SkillSwap.init();
  if (!ctx) return;
  const { api } = ctx;

  // In real SPA: get userId from URL params
  // const userId = new URLSearchParams(window.location.search).get('id');
  // const { data: profile } = await api.users.getProfile(userId);

  // ── Send swap request ─────────────────────────────────────────
  document.getElementById('swapModal')?.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-send-swap') || e.target.id === 'sendSwapBtn') {
      const offeredSkillId   = document.querySelector('.src-select:first-of-type')?.value;
      const requestedSkillId = document.querySelector('.src-select:last-of-type')?.value;
      const intro            = document.querySelector('.src-textarea')?.value;

      try {
        await api.swaps.create({
          recipientId:     'PROFILE_USER_ID', // replace with actual userId
          offeredSkillId,
          requestedSkillId,
          introMessage: intro,
          format: 'LIVE_VIDEO',
        });
        console.log('[Profile] Swap request sent!');
      } catch (err) {
        console.error('Swap request error:', err.message);
      }
    }
  });
}

// ════════════════════════════════════════════════════════════════
//  AUTO-WIRE based on current page
// ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const page = window.location.pathname.split('/').pop() || 'index.html';

  const wires = {
    'skillswap-auth.html':        wireAuthPage,
    'skillswap-onboarding.html':  wireOnboardingPage,
    'skillswap-dashboard.html':   wireDashboardPage,
    'skillswap-discover.html':    wireDiscoverPage,
    'skillswap-swaps.html':       wireSwapsPage,
    'skillswap-messages.html':    wireMessagesPage,
    'skillswap-profile.html':     wireProfilePage,
  };

  const wireFn = wires[page];
  if (wireFn) {
    wireFn().catch(err => console.error(`[SkillSwap] Wire error on ${page}:`, err));
  }
});
