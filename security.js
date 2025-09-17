// MHM Project Tracker - Enhanced Security & Authentication System
console.log('🔐 Loading authentication system...');

// Security configuration with cloud sync support
const SECURITY_CONFIG = {
  // Storage keys
  userStorageKey: 'mhm-tracker-users-v3',
  sessionStorageKey: 'mhm-tracker-session-v3',
  
  // Security settings
  minPasswordLength: 6,
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  
  // Session settings
  session: {
    timeout: 24 * 60 * 60 * 1000, // 24 hours
    extendOnActivity: true
  },
  
  // Cloud configuration
  cloudConfig: {
    useCloud: true,
    binId: '68c8db8d43b1c97be9447254', // Correct bin ID
    apiKey: '$2a$10$liLMgaGZEfQW.T9t1pSRJuQCsWk88mMNtMoRW6kt1X2WXZ.uGB9WK'
  },
  
  // Simple hash function for password verification (legacy support)
  legacyHashPassword: (password) => {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
    }
    return Math.abs(hash).toString(36);
  },
  
  // Enhanced password hashing with SHA-256
  hashPassword: async (password, salt = null) => {
    if (!salt) {
      salt = crypto.getRandomValues(new Uint8Array(16));
    }
    
    const encoder = new TextEncoder();
    const data = encoder.encode(password + Array.from(salt).join(''));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    
    return {
      hash: hashArray.map(b => b.toString(16).padStart(2, '0')).join(''),
      salt: Array.from(salt)
    };
  },
  
  // Default user accounts with pre-computed hashes
  defaultUsers: {
    'admin': { 
      hash: '2f24jul', // admin123
      name: 'Administrator', 
      role: 'admin',
      channels: [], // Admin has access to all channels
      active: true,
      isDefault: true
    },
    'mia': { 
      hash: 'hrpveb', // mia123
      name: 'Mia', 
      role: 'editor',
      channels: ['Main Brand', 'Clips Channel'],
      active: true,
      isDefault: true
    },
    'leo': { 
      hash: 'iapqck', // leo123
      name: 'Leo', 
      role: 'editor',
      channels: ['Client Channel', 'Main Brand'],
      active: true,
      isDefault: true
    },
    'kai': { 
      hash: 'iu2d1d', // kai123
      name: 'Kai', 
      role: 'editor',
      channels: ['Clips Channel'],
      active: true,
      isDefault: true
    }
  },
  
  // User credentials object (populated by loadUsers)
  users: {},
  
  // Cloud storage functions
  cloud: {
    // Load users from cloud storage
    loadFromCloud: async () => {
      if (!SECURITY_CONFIG.cloudConfig.useCloud) return null;
      
      try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${SECURITY_CONFIG.cloudConfig.binId}/latest`, {
          headers: {
            'X-Access-Key': SECURITY_CONFIG.cloudConfig.apiKey
          }
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('☁️ Loaded users from cloud');
          return result.record || {};
        } else {
          console.log('☁️ No cloud data found, using defaults');
          return {};
        }
      } catch (error) {
        console.warn('⚠️ Cloud sync failed, using local storage:', error.message);
        return null;
      }
    },
    
    // Save users to cloud storage
    saveToCloud: async (userData) => {
      if (!SECURITY_CONFIG.cloudConfig.useCloud) return false;
      
      try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${SECURITY_CONFIG.cloudConfig.binId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Access-Key': SECURITY_CONFIG.cloudConfig.apiKey
          },
          body: JSON.stringify(userData)
        });
        
        if (response.ok) {
          console.log('☁️ Saved users to cloud');
          return true;
        } else {
          console.warn('⚠️ Cloud save failed');
          return false;
        }
      } catch (error) {
        console.warn('⚠️ Cloud save error:', error.message);
        return false;
      }
    }
  },
  
  // Load users from cloud first, fallback to localStorage
  loadUsers: async () => {
    try {
      // Try loading from cloud first
      const cloudUsers = await SECURITY_CONFIG.cloud.loadFromCloud();
      const localUsers = JSON.parse(localStorage.getItem(SECURITY_CONFIG.userStorageKey) || '{}');
      let customUsers = {};
      
      if (cloudUsers !== null && Object.keys(cloudUsers).length > 0) {
        // Cloud data available - merge with local data
        customUsers = SECURITY_CONFIG.mergeUserData(cloudUsers, localUsers);
        console.log('👥 Using merged cloud and local user data');
        
        // Update localStorage with merged data
        localStorage.setItem(SECURITY_CONFIG.userStorageKey, JSON.stringify(customUsers));
      } else if (Object.keys(localUsers).length > 0) {
        // No cloud data, use local data
        customUsers = localUsers;
        console.log('👥 Using local user data (offline mode)');
        
        // Try to upload local data to cloud for sync
        SECURITY_CONFIG.cloud.saveToCloud(customUsers).catch(err => {
          console.log('📴 Could not sync local data to cloud:', err.message);
        });
      } else {
        console.log('👥 No custom users found, using defaults only');
      }
      
      // Merge default users with custom users
      SECURITY_CONFIG.users = { ...SECURITY_CONFIG.defaultUsers, ...customUsers };
      
      console.log('👥 Total users loaded:', Object.keys(SECURITY_CONFIG.users).length);
      return true;
    } catch (error) {
      console.error('❌ Error loading users:', error);
      // Fallback to defaults only
      SECURITY_CONFIG.users = { ...SECURITY_CONFIG.defaultUsers };
      return false;
    }
  },
  
  // Conflict resolution for user data merging
  mergeUserData: (cloudUsers, localUsers) => {
    const merged = {};
    const allUsernames = new Set([...Object.keys(cloudUsers), ...Object.keys(localUsers)]);
    
    allUsernames.forEach(username => {
      const cloudUser = cloudUsers[username];
      const localUser = localUsers[username];
      
      if (!cloudUser && localUser) {
        // Only exists locally
        merged[username] = localUser;
        console.log(`🔄 User ${username}: using local version (cloud missing)`);
      } else if (cloudUser && !localUser) {
        // Only exists in cloud
        merged[username] = cloudUser;
        console.log(`🔄 User ${username}: using cloud version (local missing)`);
      } else if (cloudUser && localUser) {
        // Exists in both - use timestamp to resolve conflict
        const cloudTime = cloudUser.lastModified || 0;
        const localTime = localUser.lastModified || 0;
        
        if (localTime > cloudTime) {
          merged[username] = localUser;
          console.log(`🔄 User ${username}: using local version (newer)`);
        } else {
          merged[username] = cloudUser;
          console.log(`🔄 User ${username}: using cloud version (newer or same)`);
        }
      }
    });
    
    return merged;
  },
  
  // Save custom users to both cloud and localStorage
  saveUsers: async () => {
    try {
      const customUsers = {};
      
      // Only save non-default users
      Object.keys(SECURITY_CONFIG.users).forEach(username => {
        const user = SECURITY_CONFIG.users[username];
        if (!user.isDefault) {
          customUsers[username] = {
            ...user,
            lastModified: Date.now() // Add timestamp for conflict resolution
          };
        }
      });
      
      // Save to localStorage as primary backup
      localStorage.setItem(SECURITY_CONFIG.userStorageKey, JSON.stringify(customUsers));
      console.log('💾 Saved users to localStorage');
      
      // Try to save to cloud (with retry mechanism)
      let cloudSaved = false;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!cloudSaved && retryCount < maxRetries) {
        try {
          cloudSaved = await SECURITY_CONFIG.cloud.saveToCloud(customUsers);
          if (cloudSaved) {
            console.log('☁️ Users synced to cloud');
          } else {
            retryCount++;
            if (retryCount < maxRetries) {
              console.log(`⏳ Cloud save failed, retrying (${retryCount}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Progressive delay
            }
          }
        } catch (error) {
          retryCount++;
          console.error(`❌ Cloud save error (attempt ${retryCount}):`, error.message);
          if (retryCount >= maxRetries) {
            console.log('📴 Using offline mode - changes saved locally');
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error saving users:', error);
      return false;
    }
  },
  
  // Authentication function
  authenticate: async (username, password) => {
    console.log('🔍 Authenticating:', username);
    
    // Always load latest users before authentication (for real-time sync)
    await SECURITY_CONFIG.loadUsers();
    
    console.log('👥 Current users loaded:', Object.keys(SECURITY_CONFIG.users));
    console.log('🔍 Looking for user:', username.toLowerCase());
    
    const user = SECURITY_CONFIG.users[username.toLowerCase()];
    if (!user) {
      console.log('❌ User not found:', username);
      console.log('📋 Available users:', Object.keys(SECURITY_CONFIG.users).join(', '));
      return null;
    }
    
    if (!user.active) {
      console.log('❌ User account disabled:', username);
      return null;
    }
    
    console.log('✅ User found:', username, '- Role:', user.role, '- Has hash:', !!user.hash);
    
    let passwordMatch = false;
    
    // Check if user has new-style hash with salt
    if (user.salt && user.hash) {
      const hashedInput = await SECURITY_CONFIG.hashPassword(password, user.salt);
      passwordMatch = hashedInput.hash === user.hash;
      console.log('🔑 New hash check:', passwordMatch);
    } else if (user.hash) {
      // Fallback to legacy hash for existing users
      const legacyHash = SECURITY_CONFIG.legacyHashPassword(password);
      passwordMatch = legacyHash === user.hash;
      console.log('🔑 Legacy hash check:', passwordMatch);
      
      // Upgrade to new hash format on successful login
      if (passwordMatch) {
        const newHash = await SECURITY_CONFIG.hashPassword(password);
        user.hash = newHash.hash;
        user.salt = newHash.salt;
        await SECURITY_CONFIG.saveUsers();
        console.log('⬆️ Upgraded user to new hash format');
      }
    }
    
    if (passwordMatch) {
      console.log('✅ Login successful!');
      
      // Update lastLogin timestamp
      user.lastLogin = new Date().toISOString();
      await SECURITY_CONFIG.saveUsers();
      
      const sessionUser = {
        username: username.toLowerCase(),
        name: user.name,
        role: user.role,
        channels: user.channels || [],
        active: user.active,
        lastLogin: user.lastLogin
      };
      
      // Create session
      const session = SECURITY_CONFIG.sessionManager.createSession(sessionUser);
      return session;
    }
    
    console.log('❌ Wrong password');
    return null;
  },
  
  // Initialize users on app start
  initializeUsers: async () => {
    await SECURITY_CONFIG.loadUsers();
  },
  
  // Admin user management functions
  admin: {
    // Create a new user
    createUser: async (adminUser, userData) => {
      if (!adminUser || adminUser.role !== 'admin') {
        console.log('❌ Unauthorized: Only admins can create users');
        return { success: false, error: 'Unauthorized access' };
      }
      
      const { username, password, name, role = 'editor', channels = [] } = userData;
      
      if (!username || !password || !name) {
        return { success: false, error: 'Missing required fields' };
      }
      
      const userKey = username.toLowerCase();
      if (SECURITY_CONFIG.users[userKey]) {
        return { success: false, error: 'Username already exists' };
      }
      
      try {
        // Create the new user with enhanced hash
        const hashedData = await SECURITY_CONFIG.hashPassword(password);
        SECURITY_CONFIG.users[userKey] = {
          hash: hashedData.hash,
          salt: hashedData.salt,
          name: name,
          role: role,
          channels: channels,
          active: true,
          isDefault: false,
          created: Date.now()
        };
        
        console.log('✅ User created:', username);
        
        // Save immediately
        await SECURITY_CONFIG.saveUsers();
        
        return { success: true, message: 'User created successfully' };
        
      } catch (error) {
        console.error('❌ Error creating user:', error);
        delete SECURITY_CONFIG.users[userKey];
        return { success: false, error: 'Failed to create user' };
      }
    },
    
    // Update user
    updateUser: async (adminUser, username, updates) => {
      if (!adminUser || adminUser.role !== 'admin') {
        return { success: false, error: 'Unauthorized access' };
      }
      
      const userKey = username.toLowerCase();
      const user = SECURITY_CONFIG.users[userKey];
      
      if (!user) {
        return { success: false, error: 'User not found' };
      }
      
      try {
        // Update allowed fields
        if (updates.name) user.name = updates.name;
        if (updates.role) user.role = updates.role;
        if (updates.channels !== undefined) user.channels = updates.channels;
        if (updates.active !== undefined) user.active = updates.active;
        if (updates.password) {
          const hashedData = await SECURITY_CONFIG.hashPassword(updates.password);
          user.hash = hashedData.hash;
          user.salt = hashedData.salt;
        }
        
        await SECURITY_CONFIG.saveUsers();
        return { success: true, message: 'User updated successfully' };
      } catch (error) {
        return { success: false, error: 'Failed to update user' };
      }
    },
    
    // Delete user
    deleteUser: async (adminUser, username) => {
      if (!adminUser || adminUser.role !== 'admin') {
        return { success: false, error: 'Unauthorized access' };
      }
      
      const userKey = username.toLowerCase();
      if (userKey === 'admin') {
        return { success: false, error: 'Cannot delete admin user' };
      }
      
      if (!SECURITY_CONFIG.users[userKey]) {
        return { success: false, error: 'User not found' };
      }
      
      try {
        delete SECURITY_CONFIG.users[userKey];
        await SECURITY_CONFIG.saveUsers();
        return { success: true, message: 'User deleted successfully' };
      } catch (error) {
        return { success: false, error: 'Failed to delete user' };
      }
    },
    
    // Get all users
    getAllUsers: (adminUser) => {
      if (!adminUser || adminUser.role !== 'admin') {
        return { success: false, error: 'Unauthorized access' };
      }
      
      const users = Object.keys(SECURITY_CONFIG.users).map(username => ({
        username,
        name: SECURITY_CONFIG.users[username].name,
        role: SECURITY_CONFIG.users[username].role,
        channels: SECURITY_CONFIG.users[username].channels || [],
        active: SECURITY_CONFIG.users[username].active !== false,
        isDefault: SECURITY_CONFIG.users[username].isDefault || false
      }));
      
      return { success: true, users };
    }
  },
  
  // Session management
  sessionManager: {
    // Create a new session
    createSession: (user) => {
      const sessionId = crypto.randomUUID();
      const now = Date.now();
      const session = {
        id: sessionId,
        username: user.username,
        name: user.name,
        role: user.role,
        channels: user.channels,
        loginTime: now,
        lastActivity: now,
        expiresAt: now + SECURITY_CONFIG.session.timeout,
        deviceInfo: navigator.userAgent.substring(0, 100) // Truncated for privacy
      };
      
      // Store session in localStorage
      localStorage.setItem(SECURITY_CONFIG.sessionStorageKey, JSON.stringify(session));
      console.log('✅ Session created:', sessionId);
      return session;
    },
    
    // Get current session
    getCurrentSession: () => {
      try {
        const sessionData = localStorage.getItem(SECURITY_CONFIG.sessionStorageKey);
        if (!sessionData) return null;
        
        const session = JSON.parse(sessionData);
        const now = Date.now();
        
        // Check if session has expired
        if (session.expiresAt < now) {
          SECURITY_CONFIG.sessionManager.clearSession();
          console.log('🕐 Session expired');
          return null;
        }
        
        // Extend session if activity-based extension is enabled
        if (SECURITY_CONFIG.session.extendOnActivity) {
          session.lastActivity = now;
          session.expiresAt = now + SECURITY_CONFIG.session.timeout;
          localStorage.setItem(SECURITY_CONFIG.sessionStorageKey, JSON.stringify(session));
        }
        
        return session;
      } catch (error) {
        console.error('❌ Error reading session:', error);
        SECURITY_CONFIG.sessionManager.clearSession();
        return null;
      }
    },
    
    // Clear current session
    clearSession: () => {
      localStorage.removeItem(SECURITY_CONFIG.sessionStorageKey);
      console.log('🗑️ Session cleared');
    },
    
    // Check if user should auto-login
    checkAutoLogin: async () => {
      const session = SECURITY_CONFIG.sessionManager.getCurrentSession();
      if (!session) return null;
      
      // Verify user still exists and is active
      await SECURITY_CONFIG.loadUsers();
      const user = SECURITY_CONFIG.users[session.username];
      if (!user || !user.active) {
        SECURITY_CONFIG.sessionManager.clearSession();
        return null;
      }
      
      return session;
    }
  }
};

// Legacy UserManager class for backward compatibility
class UserManager {
  constructor() {
    console.log('🔧 Initializing UserManager...');
    this.currentSession = SECURITY_CONFIG.sessionManager.getCurrentSession();
    console.log('✅ UserManager initialized');
  }
  
  async authenticateUser(username, password) {
    const result = await SECURITY_CONFIG.authenticate(username, password);
    if (result) {
      this.currentSession = result;
      return { username: result.username, role: result.role };
    } else {
      throw new Error('Invalid username or password');
    }
  }
  
  async createUser(username, password, role = 'user') {
    if (!this.currentSession || this.currentSession.role !== 'admin') {
      throw new Error('Admin privileges required');
    }
    
    const result = await SECURITY_CONFIG.admin.createUser(this.currentSession, {
      username, password, name: username, role
    });
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    return true;
  }
  
  updateUser(username, updates) {
    if (!this.currentSession || this.currentSession.role !== 'admin') {
      throw new Error('Admin privileges required');
    }
    
    return SECURITY_CONFIG.admin.updateUser(this.currentSession, username, updates);
  }
  
  deleteUser(username) {
    if (!this.currentSession || this.currentSession.role !== 'admin') {
      throw new Error('Admin privileges required');
    }
    
    return SECURITY_CONFIG.admin.deleteUser(this.currentSession, username);
  }
  
  getUserList() {
    if (!this.currentSession || this.currentSession.role !== 'admin') {
      return [];
    }
    
    const result = SECURITY_CONFIG.admin.getAllUsers(this.currentSession);
    return result.success ? result.users : [];
  }
  
  getCurrentUser() {
    return this.currentSession;
  }
  
  isLoggedIn() {
    return this.currentSession !== null;
  }
  
  logout() {
    SECURITY_CONFIG.sessionManager.clearSession();
    this.currentSession = null;
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Initializing security system...');
  
  // Load users from cloud/local storage
  await SECURITY_CONFIG.initializeUsers();
  
  console.log('✅ Security system ready');
  console.log('👥 Available users:', Object.keys(SECURITY_CONFIG.users).length);
  console.log('💡 Default users: admin/admin123, mia/mia123, leo/leo123, kai/kai123');
});

// Create global instances for backward compatibility
const userManager = new UserManager();

// Export for use in other modules
window.userManager = userManager;
window.SECURITY_CONFIG = SECURITY_CONFIG;

// Debug function for troubleshooting login issues
window.debugAuth = async () => {
  console.log('🔧 DEBUG: Current authentication state');
  await SECURITY_CONFIG.loadUsers();
  console.log('👥 All users:', Object.keys(SECURITY_CONFIG.users));
  console.log('📋 User details:');
  Object.keys(SECURITY_CONFIG.users).forEach(username => {
    const user = SECURITY_CONFIG.users[username];
    console.log(`  ${username}: role=${user.role}, active=${user.active}, hasHash=${!!user.hash}, isDefault=${user.isDefault}`);
  });
  
  // Check cloud data
  try {
    const cloudData = await SECURITY_CONFIG.cloud.loadFromCloud();
    console.log('☁️ Cloud data:', cloudData);
  } catch (error) {
    console.log('❌ Cloud error:', error.message);
  }
  
  // Check local storage
  const localData = JSON.parse(localStorage.getItem(SECURITY_CONFIG.userStorageKey) || '{}');
  console.log('� Local storage data:', localData);
};

console.log('�🚀 Enhanced security system loaded with cloud sync');
console.log('💡 Run debugAuth() in console to troubleshoot login issues');