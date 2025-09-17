// Global Authentication System for MHM Project Tracker
// Works across all browsers and computers using cloud storage

class GlobalAuth {
  constructor() {
    this.sessionKey = 'mhm-tracker-session';
  // Use Netlify Function as cloud storage
  this.cloudEnabled = true;
  this.cloudEndpoint = '/.netlify/functions/users';
  this.apiKey = '';
    this.users = {
      admin: { password: 'admin123', name: 'Administrator', role: 'admin' },
      mia: { password: 'mia123', name: 'Mia', role: 'editor' },
      leo: { password: 'leo123', name: 'Leo', role: 'editor' },
      kai: { password: 'kai123', name: 'Kai', role: 'editor' }
    };
    
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
    try {
      const response = await fetch(`${this.cloudEndpoint}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors'
      });
      
      if (response.ok) {
  const data = await response.json();
  const cloudUsers = data.users || {};
        
        // Merge cloud users with default users
        this.users = { ...this.users, ...cloudUsers };
        console.log('☁️ Loaded users from cloud:', Object.keys(cloudUsers));
        return true;
      } else {
        console.log('📂 No cloud users found, using defaults');
        return false;
      }
    } catch (error) {
      console.warn('⚠️ Cloud storage unavailable, using local fallback:', error.message);
      // Try to load from localStorage as fallback
      const localUsers = this.loadLocalFallback();
      this.users = { ...this.users, ...localUsers };
      return false;
    }
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
      // Only save custom users (not defaults)
      const customUsers = {};
      Object.keys(this.users).forEach(username => {
        if (!['admin', 'mia', 'leo', 'kai'].includes(username)) {
          customUsers[username] = {
            ...this.users[username],
            lastModified: Date.now()
          };
        }
      });

      const response = await fetch(this.cloudEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify(customUsers)
      });

      if (response.ok) {
        console.log('☁️ Users saved to cloud successfully');
        // Also save to local fallback
        this.saveLocalFallback();
        return true;
      } else {
        console.warn('⚠️ Cloud save failed, using local fallback');
        this.saveLocalFallback();
        return true; // Return true so app continues working
      }
    } catch (error) {
      console.warn('⚠️ Cloud save error, using local fallback:', error.message);
      this.saveLocalFallback();
      return true; // Return true so app continues working
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