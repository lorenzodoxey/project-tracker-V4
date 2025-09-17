// Global Authentication System for MHM Project Tracker
// Works across all browsers and computers using cloud storage

class GlobalAuth {
  constructor() {
    this.sessionKey = 'mhm-tracker-session';
    this.cloudEndpoint = 'https://api.jsonbin.io/v3/b/677a8f5ead19ca34f8c77d2a'; // Your cloud storage
    this.apiKey = '$2a$10$liLMgaGZEfQW.T9t1pSRJuQCsWk88mMNtMoRW6kt1X2WXZ.uGB9WK';
    this.users = {
      admin: { password: 'admin123', name: 'Administrator', role: 'admin' },
      mia: { password: 'mia123', name: 'Mia', role: 'editor' },
      leo: { password: 'leo123', name: 'Leo', role: 'editor' },
      kai: { password: 'kai123', name: 'Kai', role: 'editor' }
    };
    
    this.init();
  }

  async init() {
    console.log('🌐 Initializing global authentication...');
    try {
      await this.loadUsersFromCloud();
      console.log('✅ Global auth ready. Users:', Object.keys(this.users).length);
    } catch (error) {
      console.warn('⚠️ Using offline mode:', error.message);
    }
  }

  async loadUsersFromCloud() {
    try {
      const response = await fetch(`${this.cloudEndpoint}/latest`, {
        headers: {
          'X-Access-Key': this.apiKey
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const cloudUsers = data.record || {};
        
        // Merge cloud users with default users
        this.users = { ...this.users, ...cloudUsers };
        console.log('☁️ Loaded users from cloud:', Object.keys(cloudUsers));
        return true;
      } else {
        console.log('📂 No cloud users found, using defaults');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to load from cloud:', error.message);
      throw error;
    }
  }

  async saveUsersToCloud() {
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
        headers: {
          'Content-Type': 'application/json',
          'X-Access-Key': this.apiKey
        },
        body: JSON.stringify(customUsers)
      });

      if (response.ok) {
        console.log('☁️ Users saved to cloud successfully');
        return true;
      } else {
        console.error('❌ Failed to save to cloud:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Cloud save error:', error.message);
      return false;
    }
  }

  async login(username, password) {
    const userKey = username.toLowerCase();
    
    // Always load latest users before login
    try {
      await this.loadUsersFromCloud();
    } catch (error) {
      console.warn('⚠️ Using cached users for login');
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

    // Save to cloud immediately
    const saved = await this.saveUsersToCloud();
    if (!saved) {
      // Rollback if cloud save failed
      delete this.users[userKey];
      throw new Error('Failed to save user to cloud storage');
    }
    
    console.log('✅ User created globally:', userKey);
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

    // Save to cloud
    const saved = await this.saveUsersToCloud();
    if (!saved) {
      throw new Error('Failed to update user in cloud storage');
    }

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

    // Save to cloud
    const saved = await this.saveUsersToCloud();
    if (!saved) {
      throw new Error('Failed to delete user from cloud storage');
    }

    return true;
  }

  async getAllUsers() {
    const session = this.getCurrentSession();
    if (!session || session.role !== 'admin') {
      throw new Error('Admin access required');
    }

    // Load latest users from cloud
    try {
      await this.loadUsersFromCloud();
    } catch (error) {
      console.warn('⚠️ Using cached users for admin panel');
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
      await this.loadUsersFromCloud();
      console.log('🔄 Users refreshed from cloud');
      return true;
    } catch (error) {
      console.error('❌ Failed to refresh users:', error.message);
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