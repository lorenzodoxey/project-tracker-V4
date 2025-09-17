// Global Authentication System for MHM Project Tracker
// Works across all browsers and computers using cloud storage

class GlobalAuth {
  constructor() {
    this.sessionKey = 'mhm-tracker-session';
    // Cloud persistence (multi-endpoint with fallback):
    // 1) Netlify Function on this site
    // 2) Public JSONBlob (no key) created for this project
    this.cloudEnabled = true;
    this.cloudEndpoints = [
      { type: 'netlify', url: '/.netlify/functions/users' },
      { type: 'jsonblob', url: 'https://jsonblob.com/api/jsonBlob/1417956693685493760' }
    ];
    this.apiKey = '';
    this.users = {
      admin: { password: 'admin123', name: 'Administrator', role: 'admin' },
      mia: { password: 'mia123', name: 'Mia', role: 'editor' },
      leo: { password: 'leo123', name: 'Leo', role: 'editor' },
      kai: { password: 'kai123', name: 'Kai', role: 'editor' }
    };
  this.lastCloudOk = false;
    
    this.init();
  }

  async init() {
    console.log('🌐 Initializing authentication...');
    // Always load local fallback first so app is usable offline and cross-refresh
    const localUsers = this.loadLocalFallback();
    this.users = { ...this.users, ...localUsers };

    if (this.cloudEnabled) {
      try {
        await this.loadUsersFromCloud();
        console.log('✅ Auth ready (cloud+local). Users:', Object.keys(this.users).length);
      } catch (error) {
        console.warn('⚠️ Cloud unavailable, using local storage only:', error.message);
      }
    } else {
      console.log('🛜 Cloud sync disabled. Using local storage only.');
    }
  }

  async loadUsersFromCloud() {
    if (!this.cloudEnabled) { return false; }
    const tryFetch = async (endpoint) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 7000);
      try {
        const res = await fetch(endpoint.url, { method: 'GET', headers: { 'Accept': 'application/json' }, mode: 'cors', signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) return null;
        const data = await res.json();
        // Data shapes supported: {users:{...}} or direct {username:{...}}
        const cloudUsers = (data && data.users && typeof data.users === 'object') ? data.users : (
          data && !Array.isArray(data) && typeof data === 'object' ? data : {}
        );
        return cloudUsers;
      } catch (e) { clearTimeout(t); return null; }
    };

    for (const ep of this.cloudEndpoints) {
      const users = await tryFetch(ep);
      if (users) {
        this.users = { ...this.users, ...users };
        console.log(`☁️ Loaded users from cloud (${ep.type})`, Object.keys(users));
        this.lastCloudOk = true;
        return true;
      }
    }
    // Fallback to local
    const localUsers = this.loadLocalFallback();
    this.users = { ...this.users, ...localUsers };
    this.lastCloudOk = false;
    return false;
  }

  // Fallback to localStorage when cloud is unavailable
  loadLocalFallback() {
    try {
      const stored = localStorage.getItem('mhm-tracker-users-fallback');
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      return {};
    }
  }

  saveLocalFallback() {
    try {
      const customUsers = {};
      Object.keys(this.users).forEach(username => {
        if (!['admin', 'mia', 'leo', 'kai'].includes(username)) {
          customUsers[username] = this.users[username];
        }
      });
      localStorage.setItem('mhm-tracker-users-fallback', JSON.stringify(customUsers));
      return true;
    } catch (error) {
      return false;
    }
  }

  async saveUsersToCloud() {
    if (!this.cloudEnabled) {
      // Always save to local fallback so data persists in this browser
      this.saveLocalFallback();
      return false;
    }
    try {
      // Only save non-default users
      const customUsers = {};
      Object.keys(this.users).forEach(username => {
        if (!['admin', 'mia', 'leo', 'kai'].includes(username)) {
          customUsers[username] = { ...this.users[username], lastModified: Date.now() };
        }
      });

      const payloads = this.cloudEndpoints.map(ep => ({
        ep,
        body: ep.type === 'netlify' ? customUsers : { _meta: 'mhm-tracker-users', users: customUsers, _updated: Date.now() }
      }));

      let anyOk = false;
      for (const { ep, body } of payloads) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 7000);
        try {
          const res = await fetch(ep.url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, mode: 'cors', body: JSON.stringify(body), signal: ctrl.signal });
          clearTimeout(t);
          if (res.ok) { anyOk = true; }
        } catch (e) { clearTimeout(t); /* ignore */ }
      }

      if (anyOk) {
        console.log('☁️ Users saved to cloud (one or more backends)');
        this.saveLocalFallback();
        this.lastCloudOk = true;
      } else {
        console.warn('⚠️ All cloud saves failed, using local fallback only');
        this.saveLocalFallback();
        this.lastCloudOk = false;
      }
      return true;
    } catch (error) {
      console.warn('⚠️ Cloud save error, using local fallback:', error.message);
      this.saveLocalFallback();
      this.lastCloudOk = false;
      return true;
    }
  }

  async login(username, password) {
    const userKey = username.toLowerCase();
    
    // Try to refresh from cloud if enabled; otherwise ensure we have local fallback
    if (this.cloudEnabled) {
      try {
        await this.loadUsersFromCloud();
      } catch (error) {
        console.warn('⚠️ Using cached users for login');
      }
    } else {
      const localUsers = this.loadLocalFallback();
      this.users = { ...{
        admin: { password: 'admin123', name: 'Administrator', role: 'admin' },
        mia: { password: 'mia123', name: 'Mia', role: 'editor' },
        leo: { password: 'leo123', name: 'Leo', role: 'editor' },
        kai: { password: 'kai123', name: 'Kai', role: 'editor' }
      }, ...localUsers };
    }
    
    const user = this.users[userKey];
    
    console.log('🔑 Login attempt for:', userKey);
    console.log('📋 Available users:', Object.keys(this.users));
    
    if (!user || user.password !== password) {
      throw new Error('Invalid username or password');
    }

    const session = {
      username: userKey,
      name: user.name,
      role: user.role,
      loginTime: Date.now(),
      expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };

    localStorage.setItem(this.sessionKey, JSON.stringify(session));
    console.log('✅ Login successful for:', userKey);
    return session;
  }

  getCurrentSession() {
    try {
      const session = JSON.parse(localStorage.getItem(this.sessionKey));
      if (!session || session.expires < Date.now()) {
        this.logout();
        return null;
      }
      return session;
    } catch (error) {
      return null;
    }
  }

  logout() {
    localStorage.removeItem(this.sessionKey);
  }

  isLoggedIn() {
    return this.getCurrentSession() !== null;
  }

  // Admin functions
  async createUser(username, password, name, role = 'editor') {
    const session = this.getCurrentSession();
    if (!session || session.role !== 'admin') {
      throw new Error('Admin access required');
    }

    const userKey = username.toLowerCase();
    if (this.users[userKey]) {
      throw new Error('Username already exists');
    }

    // Add user locally
    this.users[userKey] = {
      password: password,
      name: name,
      role: role,
      created: Date.now()
    };

    // Persist
    await this.saveUsersToCloud();
    // Always save local fallback too
    this.saveLocalFallback();
    console.log('✅ User created:', userKey, '| Cloud:', this.cloudEnabled ? 'attempted' : 'disabled');
    
    return true;
  }

  async updateUser(username, updates) {
    const session = this.getCurrentSession();
    if (!session || session.role !== 'admin') {
      throw new Error('Admin access required');
    }

    const userKey = username.toLowerCase();
    const user = this.users[userKey];
    if (!user) {
      throw new Error('User not found');
    }

    // Apply updates
    Object.assign(user, updates, { lastModified: Date.now() });

    // Persist
    await this.saveUsersToCloud();
    this.saveLocalFallback();

    return true;
  }

  async deleteUser(username) {
    const session = this.getCurrentSession();
    if (!session || session.role !== 'admin') {
      throw new Error('Admin access required');
    }

    const userKey = username.toLowerCase();
    if (['admin', 'mia', 'leo', 'kai'].includes(userKey)) {
      throw new Error('Cannot delete default users');
    }

    if (!this.users[userKey]) {
      throw new Error('User not found');
    }

    // Remove user
    delete this.users[userKey];

    // Persist
    await this.saveUsersToCloud();
    this.saveLocalFallback();

    return true;
  }

  async getAllUsers() {
    const session = this.getCurrentSession();
    if (!session || session.role !== 'admin') {
      throw new Error('Admin access required');
    }

    // Try to refresh from cloud if enabled; always include local fallback
    if (this.cloudEnabled) {
      try {
        await this.loadUsersFromCloud();
      } catch (error) {
        console.warn('⚠️ Using cached users for admin panel');
      }
    } else {
      const localUsers = this.loadLocalFallback();
      this.users = { ...{
        admin: { password: 'admin123', name: 'Administrator', role: 'admin' },
        mia: { password: 'mia123', name: 'Mia', role: 'editor' },
        leo: { password: 'leo123', name: 'Leo', role: 'editor' },
        kai: { password: 'kai123', name: 'Kai', role: 'editor' }
      }, ...localUsers };
    }

    return Object.keys(this.users).map(username => ({
      username,
      name: this.users[username].name,
      role: this.users[username].role,
      created: this.users[username].created || null,
      lastModified: this.users[username].lastModified || null
    }));
  }

  // Force refresh users from cloud (useful for admin panel)
  async refreshUsers() {
    try {
      if (this.cloudEnabled) {
        await this.loadUsersFromCloud();
        console.log('🔄 Users refreshed from cloud');
      }
      // Always refresh from local fallback as well
      const localUsers = this.loadLocalFallback();
      this.users = { ...{
        admin: { password: 'admin123', name: 'Administrator', role: 'admin' },
        mia: { password: 'mia123', name: 'Mia', role: 'editor' },
        leo: { password: 'leo123', name: 'Leo', role: 'editor' },
        kai: { password: 'kai123', name: 'Kai', role: 'editor' }
      }, ...localUsers, ...this.users };
      console.log('🔄 Users refreshed from local storage');
      return true;
    } catch (error) {
      console.error('❌ Failed to refresh users:', error.message);
      return false;
    }
  }

  // --- Manual Sync helpers (copy/paste) ---
  exportUsers() {
    const customUsers = this.loadLocalFallback();
    const payload = JSON.stringify(customUsers);
    // Base64 encode for compact sharing
    return btoa(unescape(encodeURIComponent(payload)));
  }

  importUsers(encoded) {
    try {
      const json = decodeURIComponent(escape(atob(encoded.trim())));
      const incoming = JSON.parse(json);
      // Merge and persist
      const merged = { ...this.loadLocalFallback(), ...incoming };
      localStorage.setItem('mhm-tracker-users-fallback', JSON.stringify(merged));
      this.users = { ...{
        admin: { password: 'admin123', name: 'Administrator', role: 'admin' },
        mia: { password: 'mia123', name: 'Mia', role: 'editor' },
        leo: { password: 'leo123', name: 'Leo', role: 'editor' },
        kai: { password: 'kai123', name: 'Kai', role: 'editor' }
      }, ...merged };
      return true;
    } catch (e) {
      console.error('Failed to import users:', e);
      return false;
    }
  }

  getCloudStatus() {
    return { enabled: this.cloudEnabled, healthy: this.lastCloudOk };
  }
}

// Initialize global auth system
window.auth = new GlobalAuth();

// Backward compatibility
window.userManager = {
  authenticateUser: (username, password) => auth.login(username, password),
  getCurrentUser: () => auth.getCurrentSession(),
  isLoggedIn: () => auth.isLoggedIn(),
  logout: () => auth.logout(),
  createUser: (username, password, role, channels) => 
    auth.createUser(username, password, username, role),
  updateUser: (username, updates) => auth.updateUser(username, updates),
  deleteUser: (username) => auth.deleteUser(username),
  getUserList: () => auth.getAllUsers()
};

console.log('🌐 Global authentication system loaded');
console.log('💡 Users are now synchronized across all browsers and computers');
console.log('🔑 Default users: admin/admin123, mia/mia123, leo/leo123, kai/kai123');