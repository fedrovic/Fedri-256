/**
 * SkillSwap Frontend API Client
 * ─────────────────────────────────────────────────────────────
 * Drop this file alongside your HTML pages.
 * Provides a clean JS interface to every backend endpoint.
 *
 * Usage in any HTML page:
 *   <script src="skillswap-api.js"></script>
 *   <script>
 *     const api = new SkillSwapAPI();
 *     const { data } = await api.auth.login({ email, password });
 *   </script>
 */

'use strict';

class SkillSwapAPI {
  constructor(baseURL = null) {
    // Priority: explicit constructor arg -> global override -> same-origin.
    // This keeps Vercel/Render deploys flexible without rebuilding frontend assets.
    const globalOverride = window.SKILLSWAP_API_BASE_URL;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    this.baseURL = baseURL || globalOverride || (isLocal ? 'http://localhost:4000/api/v1' : '/api/v1');

    // Token storage
    this._accessToken  = localStorage.getItem('ss_access_token');
    this._tokenExpiry  = localStorage.getItem('ss_token_expiry');

    // Expose namespaced modules
    this.auth          = new AuthModule(this);
    this.users         = new UsersModule(this);
    this.swaps         = new SwapsModule(this);
    this.sessions      = new SessionsModule(this);
    this.messages      = new MessagesModule(this);
    this.reviews       = new ReviewsModule(this);
    this.search        = new SearchModule(this);
    this.coins         = new CoinsModule(this);
    this.notifications = new NotificationsModule(this);
  }

  // ── Core fetch wrapper ──────────────────────────────────────
  async _request(method, path, body = null, options = {}) {
    // Auto-refresh token if expiring in < 60s
    if (this._accessToken && this._tokenExpiry) {
      const expiresIn = parseInt(this._tokenExpiry) - Date.now();
      if (expiresIn < 60_000 && expiresIn > 0) {
        await this._refreshToken();
      }
    }

    const url     = `${this.baseURL}${path}`;
    const headers = { 'Content-Type': 'application/json' };
    if (this._accessToken) {
      headers['Authorization'] = `Bearer ${this._accessToken}`;
    }

    const config = {
      method:      method.toUpperCase(),
      headers,
      credentials: 'include', // send refresh token cookie
      ...options,
    };

    if (body && !(body instanceof FormData)) {
      config.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
      delete config.headers['Content-Type']; // let browser set multipart boundary
      config.body = body;
    }

    const res = await fetch(url, config);

    // Token expired — try refresh once
    if (res.status === 401 && this._accessToken) {
      const refreshed = await this._refreshToken();
      if (refreshed) {
        config.headers['Authorization'] = `Bearer ${this._accessToken}`;
        const retry = await fetch(url, config);
        return this._handleResponse(retry);
      }
    }

    return this._handleResponse(res);
  }

  async _handleResponse(res) {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json();
      if (!res.ok) {
        const err = new Error(json.error?.message || json.message || 'Request failed');
        err.status = res.status;
        err.code   = json.error?.code;
        err.errors = json.error?.details;
        throw err;
      }
      return json;
    }
    // Non-JSON (e.g. ICS file download)
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  }

  // Helpers
  get(path, params = {})        {
    const qs = Object.keys(params).length ? '?' + new URLSearchParams(params) : '';
    return this._request('GET', path + qs);
  }
  post(path, body)              { return this._request('POST',   path, body); }
  patch(path, body)             { return this._request('PATCH',  path, body); }
  put(path, body)               { return this._request('PUT',    path, body); }
  delete(path)                  { return this._request('DELETE', path); }
  upload(path, formData)        { return this._request('POST',   path, formData); }

  // ── Token management ───────────────────────────────────────
  _setTokens(accessToken, expiresIn = 900) {
    this._accessToken = accessToken;
    this._tokenExpiry = String(Date.now() + expiresIn * 1000);
    localStorage.setItem('ss_access_token', accessToken);
    localStorage.setItem('ss_token_expiry', this._tokenExpiry);
  }

  _clearTokens() {
    this._accessToken = null;
    this._tokenExpiry = null;
    localStorage.removeItem('ss_access_token');
    localStorage.removeItem('ss_token_expiry');
    localStorage.removeItem('ss_user');
  }

  async _refreshToken() {
    try {
      const res = await fetch(`${this.baseURL}/auth/refresh-token`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
      });
      if (!res.ok) { this._clearTokens(); return false; }
      const json = await res.json();
      this._setTokens(json.data.accessToken);
      return true;
    } catch {
      this._clearTokens();
      return false;
    }
  }

  isAuthenticated()  { return !!this._accessToken; }
  requireAuth()      {
    if (!this.isAuthenticated()) {
      window.location.href = 'skillswap-auth.html';
      throw new Error('Authentication required');
    }
  }

  // ── Cached current user ─────────────────────────────────────
  _currentUser = null;
  async getCurrentUser(forceRefresh = false) {
    if (this._currentUser && !forceRefresh) return this._currentUser;
    try {
      const res = await this.get('/users/me');
      this._currentUser = res.data;
      localStorage.setItem('ss_user', JSON.stringify(res.data));
      return res.data;
    } catch {
      this._clearTokens();
      return null;
    }
  }
}

// ════════════════════════════════════════════════════════════
//  AUTH MODULE
// ════════════════════════════════════════════════════════════
class AuthModule {
  constructor(api) { this._api = api; }

  async register({ email, password, firstName, lastName, marketingOptIn = false }) {
    const res = await this._api.post('/auth/register', { email, password, firstName, lastName, marketingOptIn });
    if (res.data?.accessToken) this._api._setTokens(res.data.accessToken);
    return res;
  }

  async login({ email, password, rememberMe = false }) {
    const res = await this._api.post('/auth/login', { email, password, rememberMe });
    if (res.data?.accessToken) this._api._setTokens(res.data.accessToken);
    return res;
  }

  async loginWithGoogle() {
    // Use same-origin OAuth route on hosted frontends to keep auth flow on app domain.
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const oauthBase = isLocal ? 'http://localhost:4000/api/v1' : '/api/v1';
    window.location.href = `${oauthBase}/auth/google`;
  }

  async logout() {
    try { await this._api.post('/auth/logout', {}); } catch {}
    this._api._clearTokens();
    this._api._currentUser = null;
    window.location.href = 'skillswap-auth.html';
  }

  verifyEmail(token)             { return this._api.post('/auth/verify-email',    { token }); }
  forgotPassword(email)          { return this._api.post('/auth/forgot-password',  { email }); }
  resetPassword(token, password) { return this._api.post('/auth/reset-password',  { token, password }); }
  setup2FA()                     { return this._api.post('/auth/2fa/setup',        {}); }
  confirm2FA(code)               { return this._api.post('/auth/2fa/confirm',      { code }); }
  verify2FA(tempToken, code)     { return this._api.post('/auth/2fa/verify',       { tempToken, code }); }
  refreshToken()                 { return this._api._refreshToken(); }
}

// ════════════════════════════════════════════════════════════
//  USERS MODULE
// ════════════════════════════════════════════════════════════
class UsersModule {
  constructor(api) { this._api = api; }

  getMe()                         { return this._api.get('/users/me'); }
  updateMe(data)                  { return this._api.patch('/users/me', data); }
  deleteAccount()                 { return this._api.delete('/users/me'); }
  getProfile(userId)              { return this._api.get(`/users/${userId}`); }
  getReviews(userId, params = {}) { return this._api.get(`/users/${userId}/reviews`, params); }

  uploadAvatar(file) {
    const form = new FormData();
    form.append('avatar', file);
    return this._api.upload('/users/me/avatar', form);
  }

  addSkill(data)           { return this._api.post('/users/me/skills', data); }
  updateSkill(id, data)    { return this._api.patch(`/users/me/skills/${id}`, data); }
  removeSkill(id)          { return this._api.delete(`/users/me/skills/${id}`); }
  setAvailability(slots)   { return this._api.post('/users/me/availability', { availability: slots }); }

  getNotificationPrefs()   { return this._api.get('/users/me/notification-prefs'); }
  updateNotificationPrefs(prefs) { return this._api.patch('/users/me/notification-prefs', prefs); }

  blockUser(userId)        { return this._api.post(`/users/block/${userId}`, {}); }
  unblockUser(userId)      { return this._api.delete(`/users/block/${userId}`); }
}

// ════════════════════════════════════════════════════════════
//  SWAPS MODULE
// ════════════════════════════════════════════════════════════
class SwapsModule {
  constructor(api) { this._api = api; }

  create(data)             { return this._api.post('/swaps', data); }
  getAll(params = {})      { return this._api.get('/swaps', params); }
  getOne(id)               { return this._api.get(`/swaps/${id}`); }
  accept(id)               { return this._api.patch(`/swaps/${id}/accept`, {}); }
  decline(id, reason)      { return this._api.patch(`/swaps/${id}/decline`, { reason }); }
  counter(id, data)        { return this._api.patch(`/swaps/${id}/counter`, data); }
  pause(id, reason)        { return this._api.patch(`/swaps/${id}/pause`,   { reason }); }
  resume(id)               { return this._api.patch(`/swaps/${id}/resume`,  {}); }
  cancel(id, reason)       { return this._api.patch(`/swaps/${id}/cancel`,  { reason }); }
  complete(id, notes)      { return this._api.patch(`/swaps/${id}/complete`, { notes }); }
  openDispute(id, data)    { return this._api.post(`/swaps/${id}/dispute`,  data); }
}

// ════════════════════════════════════════════════════════════
//  SESSIONS MODULE
// ════════════════════════════════════════════════════════════
class SessionsModule {
  constructor(api) { this._api = api; }

  schedule(swapId, data)       { return this._api.post(`/sessions/swap/${swapId}`, data); }
  getForSwap(swapId)           { return this._api.get(`/sessions/swap/${swapId}`); }
  getUpcoming()                { return this._api.get('/sessions/upcoming'); }
  join(sessionId)              { return this._api.get(`/sessions/${sessionId}/join`); }
  complete(sessionId, notes)   { return this._api.patch(`/sessions/${sessionId}/complete`, { notes }); }
  reportMissed(sessionId)      { return this._api.patch(`/sessions/${sessionId}/missed`, {}); }
  reschedule(sessionId, data)  { return this._api.patch(`/sessions/${sessionId}/reschedule`, data); }

  getCalendarLink(icsToken) {
    return `${this._api.baseURL}/sessions/calendar/${icsToken}`;
  }
}

// ════════════════════════════════════════════════════════════
//  MESSAGES MODULE
// ════════════════════════════════════════════════════════════
class MessagesModule {
  constructor(api) { this._api = api; }

  getInbox()                       { return this._api.get('/messages/inbox'); }
  getMessages(swapId, params = {}) { return this._api.get(`/messages/${swapId}`, params); }

  send(swapId, content, type = 'TEXT') {
    return this._api.post(`/messages/${swapId}`, { content, type });
  }

  sendFile(swapId, file) {
    const form = new FormData();
    form.append('attachment', file);
    return this._api.upload(`/messages/${swapId}`, form);
  }

  edit(swapId, messageId, content)  { return this._api.patch(`/messages/${swapId}/${messageId}`, { content }); }
  delete(swapId, messageId)         { return this._api.delete(`/messages/${swapId}/${messageId}`); }
  react(swapId, messageId, emoji)   { return this._api.post(`/messages/${swapId}/${messageId}/react`, { emoji }); }
  unreact(swapId, messageId, emoji) { return this._api.delete(`/messages/${swapId}/${messageId}/react/${encodeURIComponent(emoji)}`); }
  report(swapId, messageId, reason) { return this._api.post(`/messages/${swapId}/${messageId}/report`, { reason }); }
}

// ════════════════════════════════════════════════════════════
//  REVIEWS MODULE
// ════════════════════════════════════════════════════════════
class ReviewsModule {
  constructor(api) { this._api = api; }

  create(data)                   { return this._api.post('/reviews', data); }
  respond(reviewId, response)    { return this._api.patch(`/reviews/${reviewId}/respond`, { response }); }
  flag(reviewId, reason)         { return this._api.post(`/reviews/${reviewId}/flag`, { reason }); }
  getForUser(userId, params = {}) { return this._api.get(`/reviews/user/${userId}`, params); }
}

// ════════════════════════════════════════════════════════════
//  SEARCH MODULE
// ════════════════════════════════════════════════════════════
class SearchModule {
  constructor(api) { this._api = api; }

  users(params = {})      { return this._api.get('/search/users',        params); }
  skills(params = {})     { return this._api.get('/search/skills',       params); }
  categories()            { return this._api.get('/search/categories'); }
  autocomplete(q)         { return this._api.get('/search/autocomplete', { q }); }
}

// ════════════════════════════════════════════════════════════
//  COINS MODULE
// ════════════════════════════════════════════════════════════
class CoinsModule {
  constructor(api) { this._api = api; }

  getWallet()                       { return this._api.get('/coins/wallet'); }
  spend(amount, description, swapId) { return this._api.post('/coins/spend', { amount, description, swapId }); }
  purchase(pkg)                      { return this._api.post('/coins/purchase', { package: pkg }); }
  transfer(recipientId, amount, swapId) { return this._api.post('/coins/transfer', { recipientId, amount, swapId }); }
}

// ════════════════════════════════════════════════════════════
//  NOTIFICATIONS MODULE
// ════════════════════════════════════════════════════════════
class NotificationsModule {
  constructor(api) { this._api = api; }

  getAll(params = {})   { return this._api.get('/notifications', params); }
  getUnreadCount()      { return this._api.get('/notifications/unread-count'); }
  markRead(id)          { return this._api.patch(`/notifications/${id}`, {}); }
  markAllRead()         { return this._api.patch('/notifications/read-all', {}); }
  delete(id)            { return this._api.delete(`/notifications/${id}`); }
}

// ════════════════════════════════════════════════════════════
//  REAL-TIME SOCKET CLIENT
// ════════════════════════════════════════════════════════════
class SkillSwapSocket {
  constructor(api) {
    this._api    = api;
    this._socket = null;
    this._handlers = {};
  }

  connect() {
    if (this._socket?.connected) return this._socket;
    if (typeof io === 'undefined') {
      console.warn('Socket.IO client not loaded. Add: <script src="https://cdn.socket.io/4.7.4/socket.io.min.js"></script>');
      return null;
    }

    this._socket = io(this._api.baseURL.replace('/api/v1', ''), {
      auth:      { token: this._api._accessToken },
      transports:['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this._socket.on('connect',    () => console.log('[SkillSwap] Socket connected'));
    this._socket.on('disconnect', () => console.log('[SkillSwap] Socket disconnected'));
    this._socket.on('connect_error', (err) => console.error('[SkillSwap] Socket error:', err.message));

    // Forward all server events to registered handlers
    const EVENTS = [
      'message:new', 'message:read', 'notification:new',
      'presence:online', 'presence:offline',
      'typing:start', 'typing:stop',
      'swap:updated', 'session:starting',
    ];
    EVENTS.forEach(event => {
      this._socket.on(event, (data) => {
        (this._handlers[event] || []).forEach(fn => fn(data));
      });
    });

    return this._socket;
  }

  disconnect() {
    this._socket?.disconnect();
    this._socket = null;
  }

  on(event, handler) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(handler);
    return () => this.off(event, handler); // returns unsubscribe function
  }

  off(event, handler) {
    this._handlers[event] = (this._handlers[event] || []).filter(fn => fn !== handler);
  }

  // ── Emit helpers ─────────────────────────────────────────
  joinSwap(swapId)           { this._socket?.emit('join:swap',     { swapId }); }
  leaveSwap(swapId)          { this._socket?.emit('leave:swap',    { swapId }); }
  sendTyping(swapId, typing) { this._socket?.emit('message:typing', { swapId, isTyping: typing }); }
  joinSession(sessionId)     { this._socket?.emit('session:join',  { sessionId }); }
}

// ════════════════════════════════════════════════════════════
//  PAGE BOOTSTRAP HELPERS
//  Each page can call these to set up auth + user context
// ════════════════════════════════════════════════════════════
const SkillSwap = {
  /**
   * Initialise for authenticated pages.
   * Redirects to login if not authenticated.
   * Returns { api, socket, user }
   */
  async init() {
    const api = new SkillSwapAPI();

    if (!api.isAuthenticated()) {
      window.location.href = 'skillswap-auth.html';
      return null;
    }

    const user = await api.getCurrentUser();
    if (!user) return null;

    const socket = new SkillSwapSocket(api);
    socket.connect();

    // Fetch unread notification count and update badge
    try {
      const { data } = await api.notifications.getUnreadCount();
      SkillSwap._updateNotifBadge(data.count);
    } catch {}

    // Listen for new notifications
    socket.on('notification:new', (notif) => {
      SkillSwap._updateNotifBadge('+');
      SkillSwap._showToast(notif.title, notif.body);
    });

    return { api, socket, user };
  },

  /**
   * Initialise for public pages (no redirect if not authed).
   */
  initPublic() {
    return new SkillSwapAPI();
  },

  _updateNotifBadge(count) {
    const badges = document.querySelectorAll('.notif-badge');
    badges.forEach(b => {
      if (count === '+') {
        const current = parseInt(b.textContent) || 0;
        b.textContent = current + 1;
        b.style.display = '';
      } else if (count > 0) {
        b.textContent = count;
        b.style.display = '';
      } else {
        b.style.display = 'none';
      }
    });
  },

  _showToast(title, body) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;
      background:#0F1E33;border:1px solid #2A4466;border-radius:14px;
      padding:1rem 1.25rem;max-width:300px;box-shadow:0 8px 32px rgba(0,0,0,.4);
      animation:slideInToast .3s ease;font-family:'Outfit',sans-serif;color:#EEF2FF;
    `;
    toast.innerHTML = `
      <div style="font-weight:600;font-size:.875rem;margin-bottom:.25rem">${title}</div>
      <div style="font-size:.8rem;color:#9AAEC8">${body}</div>
    `;
    if (!document.getElementById('toast-style')) {
      const s = document.createElement('style');
      s.id = 'toast-style';
      s.textContent = '@keyframes slideInToast{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}';
      document.head.appendChild(s);
    }
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4500);
  },
};

// ── Auto-handle OAuth callback ─────────────────────────────────
(function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const token  = params.get('token');
  if (token && window.location.pathname.includes('auth')) {
    const api = new SkillSwapAPI();
    api._setTokens(token);
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
    window.location.href = 'skillswap-onboarding.html';
  }
})();

// Make globally available
window.SkillSwapAPI    = SkillSwapAPI;
window.SkillSwapSocket = SkillSwapSocket;
window.SkillSwap       = SkillSwap;
