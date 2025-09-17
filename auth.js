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
  }

  loadCustomUsers() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
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
      return true;
    } catch (error) {
      return false;
    }
  }

  async login(username, password) {
    const user = this.users[username.toLowerCase()];
    
    if (!user || user.password !== password) {
      throw new Error('Invalid username or password');
    }

    const session = {
      username: username.toLowerCase(),
      name: user.name,
      role: user.role,
      loginTime: Date.now(),
      expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };

    localStorage.setItem(this.sessionKey, JSON.stringify(session));
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

    if (this.users[username.toLowerCase()]) {
      throw new Error('Username already exists');
    }

    this.users[username.toLowerCase()] = {
      password: password,
      name: name,
      role: role
    };

    this.saveCustomUsers();
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