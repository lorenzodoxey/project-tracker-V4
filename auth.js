// Simplified Authentication System for MHM Project Tracker
// Optimized for Netlify deployment with localStorage only

class SimpleAuth {
  constructor() {
    this.storageKey = 'mhm-tracker-users';
    this.sessionKey = 'mhm-tracker-session';
    this.users = {
      admin: { password: 'admin123', name: 'Administrator', role: 'admin' },
      mia: { password: 'mia123', name: 'Mia', role: 'editor' },
      leo: { password: 'leo123', name: 'Leo', role: 'editor' },
      kai: { password: 'kai123', name: 'Kai', role: 'editor' }
    };
    
    this.init();
  }

  init() {
    // Load any custom users from localStorage
    const customUsers = this.loadCustomUsers();
    this.users = { ...this.users, ...customUsers };
    console.log('Auth initialized. Total users:', Object.keys(this.users).length);
    console.log('Users:', Object.keys(this.users));
  }

  loadCustomUsers() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      const customUsers = stored ? JSON.parse(stored) : {};
      console.log('Loaded custom users from storage:', Object.keys(customUsers));
      return customUsers;
    } catch (error) {
      console.error('Error loading custom users:', error);
      return {};
    }
  }

  saveCustomUsers() {
    try {
      // Only save non-default users
      const customUsers = {};
      Object.keys(this.users).forEach(username => {
        if (!['admin', 'mia', 'leo', 'kai'].includes(username)) {
          customUsers[username] = this.users[username];
        }
      });
      localStorage.setItem(this.storageKey, JSON.stringify(customUsers));
      console.log('Saved custom users:', Object.keys(customUsers));
      return true;
    } catch (error) {
      console.error('Failed to save custom users:', error);
      return false;
    }
  }

  async login(username, password) {
    const userKey = username.toLowerCase();
    const user = this.users[userKey];
    
    console.log('Login attempt for:', userKey);
    console.log('Available users:', Object.keys(this.users));
    console.log('User found:', !!user);
    
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
    console.log('Login successful for:', userKey);
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
  createUser(username, password, name, role = 'editor') {
    const session = this.getCurrentSession();
    if (!session || session.role !== 'admin') {
      throw new Error('Admin access required');
    }

    const userKey = username.toLowerCase();
    if (this.users[userKey]) {
      throw new Error('Username already exists');
    }

    this.users[userKey] = {
      password: password,
      name: name,
      role: role
    };

    const saved = this.saveCustomUsers();
    if (!saved) {
      // Rollback if save failed
      delete this.users[userKey];
      throw new Error('Failed to save user');
    }
    
    console.log('User created successfully:', userKey, 'Total users:', Object.keys(this.users).length);
    return true;
  }

  updateUser(username, updates) {
    const session = this.getCurrentSession();
    if (!session || session.role !== 'admin') {
      throw new Error('Admin access required');
    }

    const user = this.users[username.toLowerCase()];
    if (!user) {
      throw new Error('User not found');
    }

    Object.assign(user, updates);
    this.saveCustomUsers();
    return true;
  }

  deleteUser(username) {
    const session = this.getCurrentSession();
    if (!session || session.role !== 'admin') {
      throw new Error('Admin access required');
    }

    if (['admin', 'mia', 'leo', 'kai'].includes(username.toLowerCase())) {
      throw new Error('Cannot delete default users');
    }

    delete this.users[username.toLowerCase()];
    this.saveCustomUsers();
    return true;
  }

  getAllUsers() {
    const session = this.getCurrentSession();
    if (!session || session.role !== 'admin') {
      throw new Error('Admin access required');
    }

    return Object.keys(this.users).map(username => ({
      username,
      name: this.users[username].name,
      role: this.users[username].role
    }));
  }
}

// Initialize auth system
window.auth = new SimpleAuth();

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