// Enhanced Configuration with Multi-User Authentication
const CONFIG = {
  storageKey: 'mhm-tracker-data-v2',
  // Real-time sync intervals (reduced for better responsiveness)
  autoSaveInterval: 15000, // 15 seconds
  syncCheckInterval: 5000,  // 5 seconds for real-time feel
  // Updated stages for video editing workflow
  stages: [
    { id: 'uploaded', name: 'Uploaded', color: '#00ffa3' },
    { id: 'assigned', name: 'Assigned', color: '#00d4ff' },
    { id: 'editing', name: 'Editing', color: '#ff6b35' },
    { id: 'revisions', name: 'Revisions', color: '#ffb347' },
    { id: 'final', name: 'Final', color: '#7c3aed' },
    { id: 'posted', name: 'Posted', color: '#10b981' }
  ],
  defaultPlatforms: ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn'],
  defaultEditors: ['Mia', 'Leo', 'Kai'],
  defaultChannels: ['Main Brand', 'Clips Channel', 'Client Channel'],
  cardColors: [
    { value: 'teal', name: 'Teal' },
    { value: 'coral', name: 'Coral' },
    { value: 'navy', name: 'Navy' },
    { value: 'purple', name: 'Purple' },
    { value: 'green', name: 'Green' }
  ]
};

// Enhanced Application State with User Management
let appState = {
  currentUser: null, // Will store logged in user info
  isLoggedIn: false,
  projects: [],
  trash: [],
  editors: [...CONFIG.defaultEditors],
  platforms: [...CONFIG.defaultPlatforms],
  channels: [...CONFIG.defaultChannels],
  editingProject: null,
  currentChecklist: [],
  lastSaveTime: null
};

// Enhanced Utility Functions with User Session Management
const utils = {
  generateId: () => Date.now().toString(36) + Math.random().toString(36).substr(2),
  
  formatDate: (date) => {
    try {
      return new Date(date).toLocaleDateString();
    } catch (e) {
      return 'Invalid Date';
    }
  },
  
  daysBetween: (date1, date2) => {
    try {
      const diff = Math.abs(new Date(date2) - new Date(date1));
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    } catch (e) {
      return 0;
    }
  },
  
  saveToStorage: () => {
    try {
      const dataToSave = {
        projects: appState.projects,
        trash: appState.trash,
        editors: appState.editors,
        platforms: appState.platforms,
        channels: appState.channels,
        lastSaved: Date.now(),
        lastUser: appState.currentUser ? appState.currentUser.username : null,
        saveId: utils.generateId(), // Unique save identifier
        version: '2.2' // Updated version for better multi-user support
      };
      
      const dataString = JSON.stringify(dataToSave);
      localStorage.setItem(CONFIG.storageKey, dataString);
      
      // Also save to a backup key with timestamp for recovery
      const backupKey = `${CONFIG.storageKey}-backup-${Date.now()}`;
      localStorage.setItem(backupKey, dataString);
      
      // Clean up old backups (keep only last 5)
      utils.cleanupBackups();
      
      appState.lastSaveTime = Date.now();
      console.log('Data saved successfully at', new Date().toLocaleTimeString(), 'by', appState.currentUser?.username);
      return true;
    } catch (error) {
      console.error('Failed to save data:', error);
      showNotification('Failed to save data. Please try again.', 'error');
      return false;
    }
  },

  cleanupBackups: () => {
    try {
      const backupKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${CONFIG.storageKey}-backup-`)) {
          backupKeys.push(key);
        }
      }
      
      // Sort by timestamp and keep only the 5 most recent
      backupKeys.sort().slice(0, -5).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error('Error cleaning up backups:', error);
    }
  },

  loadFromStorage: () => {
    try {
      const data = JSON.parse(localStorage.getItem(CONFIG.storageKey));
      if (data && data.version) {
        // Check for data conflicts (if multiple users edited simultaneously)
        const timeDiff = Date.now() - (data.lastSaved || 0);
        const isRecentSave = timeDiff < 60000; // Within last minute
        
        if (data.lastUser && data.lastUser !== appState.currentUser?.username && isRecentSave) {
          console.log(`⚠️ Recent changes by ${data.lastUser} detected. Loading their updates.`);
          showNotification(`Loading recent changes by ${data.lastUser}`, 'info', 3000);
        }
        
        appState.projects = Array.isArray(data.projects) ? data.projects : [];
        appState.trash = Array.isArray(data.trash) ? data.trash : [];
        appState.editors = Array.isArray(data.editors) ? data.editors : [...CONFIG.defaultEditors];
        appState.platforms = Array.isArray(data.platforms) ? data.platforms : [...CONFIG.defaultPlatforms];
        appState.channels = Array.isArray(data.channels) ? data.channels : [...CONFIG.defaultChannels];
        
        // Log who last used the system
        if (data.lastUser) {
          console.log('Data last saved by user:', data.lastUser, 'at', new Date(data.lastSaved).toLocaleString());
        }
        
        // Validate and migrate existing projects
        appState.projects.forEach(project => {
          if (!project.id) project.id = utils.generateId();
          if (!CONFIG.stages.find(s => s.id === project.stage)) {
            const stageMap = {
              'ideation': 'uploaded',
              'filming': 'assigned', 
              'editing': 'editing',
              'revisions': 'revisions',
              'posting': 'posted'
            };
            project.stage = stageMap[project.stage] || 'uploaded';
          }
          if (!project.checklist) project.checklist = [];
          if (!project.timeline) project.timeline = {};
        });
        
        console.log('Data loaded successfully');
        return true;
      } else {
        console.log('No existing data found, initializing defaults');
        return false;
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      return false;
    }
  },

  autoSave: () => {
    if (appState.isLoggedIn) {
      utils.saveToStorage();
    }
  },

  // Debounced autosave for real-time changes
  debouncedAutoSave: null,

  initDebouncedAutoSave: () => {
    utils.debouncedAutoSave = debounce(() => {
      if (appState.isLoggedIn) {
        utils.saveToStorage();
        showNotification('Auto-saved', 'info', 1500);
      }
    }, 2000); // Save 2 seconds after user stops typing
  },

  // Check for updates from other users
  checkForUpdates: () => {
    if (!appState.isLoggedIn) return;
    
    try {
      const data = JSON.parse(localStorage.getItem(CONFIG.storageKey));
      if (data && data.lastSaved && data.lastSaved > appState.lastSaveTime) {
        const timeDiff = Date.now() - data.lastSaved;
        if (timeDiff < 300000) { // Only sync if changes are less than 5 minutes old
          console.log('🔄 Detecting updates from other user, syncing...');
          utils.loadFromStorage();
          renderBoard();
          updateStats();
          utils.updateAllDropdowns();
          showNotification(`Synced updates from ${data.lastUser || 'another user'}`, 'info', 2000);
        }
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  },

  updateAllDropdowns: () => {
    updateFilters();
    updateFormSelects();
  }
};

// Auto-save every 15 seconds and check for updates every 5 seconds
setInterval(utils.autoSave, CONFIG.autoSaveInterval);
setInterval(utils.checkForUpdates, CONFIG.syncCheckInterval);

// Enhanced real-time sync checker (throttled)
let lastSyncCheck = 0;
setInterval(async () => {
  const now = Date.now();
  if (now - lastSyncCheck < 30000) return; // Only check every 30 seconds max
  
  if (typeof SECURITY_CONFIG !== 'undefined' && SECURITY_CONFIG.syncManager) {
    const hasUpdates = await SECURITY_CONFIG.syncManager.checkForUpdates();
    if (hasUpdates) {
      lastSyncCheck = now;
      console.log('🔄 Users updated from cloud');
      // Only refresh admin panel, no popup notifications
      if (appState.currentUser && appState.currentUser.role === 'admin') {
        const adminModal = document.getElementById('adminModal');
        if (adminModal && !adminModal.classList.contains('hidden')) {
          loadUsersList();
        }
      }
    }
  }
}, 30000); // Check every 30 seconds instead of 5

// Listen for cross-tab synchronization (throttled)
let lastBroadcastTime = 0;
window.addEventListener('storage', (e) => {
  if (e.key === 'mhm-tracker-broadcast' && e.newValue) {
    try {
      const now = Date.now();
      if (now - lastBroadcastTime < 5000) return; // Throttle broadcasts
      
      const broadcastData = JSON.parse(e.newValue);
      console.log('📡 Received cross-tab broadcast:', broadcastData.type);
      
      if (broadcastData.type === 'user_created' || broadcastData.type === 'user_updated') {
        lastBroadcastTime = now;
        // Only refresh admin panel, no notifications
        if (appState.currentUser && appState.currentUser.role === 'admin') {
          const adminModal = document.getElementById('adminModal');
          if (adminModal && !adminModal.classList.contains('hidden')) {
            loadUsersList();
          }
        }
      }
    } catch (error) {
      console.error('❌ Error handling cross-tab broadcast:', error);
    }
  }
});

// Remove the global sync update handler that was causing spam
// window.onUserSyncUpdate is removed

// Session timeout checker (reduced frequency)
setInterval(() => {
  if (appState.isLoggedIn && typeof userManager !== 'undefined') {
    if (!userManager.isLoggedIn()) {
      console.log('🕐 Session expired, logging out...');
      
      // Auto-logout due to session expiry
      appState.currentUser = null;
      appState.isLoggedIn = false;
      
      // Reset UI
      document.getElementById('loginScreen').classList.remove('hidden');
      document.getElementById('mainApp').classList.add('hidden');
      document.getElementById('usernameInput').value = '';
      document.getElementById('passwordInput').value = '';
      document.getElementById('loginError').classList.add('hidden');
      document.title = 'MHM Project Tracker';
      
      showNotification('Session expired. Please log in again.', 'warning');
      
      // Focus on username input
      setTimeout(() => {
        document.getElementById('usernameInput').focus();
      }, 100);
    }
  }
}, 60000); // Check every minute

// Enhanced Authentication Function using UserManager
async function checkPassword() {
  const usernameInput = document.getElementById('usernameInput');
  const passwordInput = document.getElementById('passwordInput');
  const errorEl = document.getElementById('loginError');
  const loginBtn = document.querySelector('.login-card button');
  
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  
  console.log('🔑 Attempting login for:', username);
  
  if (!username || !password) {
    errorEl.classList.remove('hidden');
    errorEl.textContent = 'Please enter both username and password.';
    return;
  }
  
  // Check if userManager is available
  if (typeof userManager === 'undefined' || !userManager) {
    console.error('❌ UserManager not loaded');
    errorEl.classList.remove('hidden');
    errorEl.textContent = 'Authentication system not ready. Please refresh the page.';
    return;
  }
  
  // Add loading state
  if (loginBtn) {
    loginBtn.classList.add('loading');
    loginBtn.textContent = 'Logging in...';
  }
  
  try {
    // Use the new UserManager for authentication
    const result = await userManager.authenticateUser(username, password);
    
    // Success! Set up user session
    appState.currentUser = {
      username: result.username,
      role: result.role
    };
    appState.isLoggedIn = true;
    
    // Update UI
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    errorEl.classList.add('hidden');
    
    updateUserDisplay();
    initializeApp();
    
    showNotification(`Welcome, ${result.username}!`, 'success');
    console.log('✅ Login successful for:', username);
    
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    
    // Show error
    errorEl.classList.remove('hidden');
    errorEl.textContent = error.message;
    
    passwordInput.value = '';
    
    // Add shake animation
    const loginCard = document.querySelector('.login-card');
    if (loginCard) {
      loginCard.style.animation = 'shake 0.5s ease-in-out';
      setTimeout(() => loginCard.style.animation = '', 500);
    }
  } finally {
    // Remove loading state
    if (loginBtn) {
      loginBtn.classList.remove('loading');
      loginBtn.textContent = 'Login';
    }
  }
}function updateUserDisplay() {
  if (!appState.currentUser) return;
  
  // Update the user info in the header
  const userInfo = document.getElementById('userInfo');
  if (userInfo) {
    userInfo.innerHTML = `
      <div class="user-badge ${appState.currentUser.role}">
        <span class="user-name">${escapeHtml(appState.currentUser.username)}</span>
        <span class="user-role">${appState.currentUser.role}</span>
      </div>
    `;
  }
  
  // Show admin panel button for admins
  const adminPanelBtn = document.getElementById('adminPanelBtn');
  if (adminPanelBtn) {
    adminPanelBtn.style.display = appState.currentUser.role === 'admin' ? 'inline-block' : 'none';
  }
  
  // Update the page title to show current user
  document.title = `MHM Project Tracker - ${appState.currentUser.username}`;
}

function logout() {
  if (confirm(`${appState.currentUser.username}, are you sure you want to logout? Any unsaved changes will be saved automatically.`)) {
    // Save data before logout
    utils.saveToStorage();
    
    // Log the session end
    console.log('Session ended:', {
      user: appState.currentUser.username,
      role: appState.currentUser.role,
      time: new Date().toLocaleString()
    });
    
    // Clear session using UserManager
    if (typeof userManager !== 'undefined') {
      userManager.logout();
    }
    
    // Clear user session
    appState.currentUser = null;
    appState.isLoggedIn = false;
    
    // Reset UI
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('usernameInput').value = '';
    document.getElementById('passwordInput').value = '';
    document.getElementById('loginError').classList.add('hidden');
    document.title = 'MHM Project Tracker';
    
    showNotification('Logged out successfully. Next user can now log in.', 'success');
    console.log('Logged out successfully');
    
    // Focus on username input for next user
    setTimeout(() => {
      document.getElementById('usernameInput').focus();
    }, 100);
  }
}

// Admin Panel Functions
let adminState = {
  editingUser: null,
  defaultChannelsForNewUsers: []
};

// Admin Panel Functions
function openAdminPanel() {
  if (!appState.currentUser || appState.currentUser.role !== 'admin') {
    showNotification('Access denied. Admin privileges required.', 'error');
    return;
  }
  
  document.getElementById('adminModal').classList.remove('hidden');
  loadUsersList();
}

function loadUsersList() {
  if (!userManager) return;
  
  const usersList = document.getElementById('usersList');
  if (!usersList) return;
  
  const users = userManager.getUserList();
  
  usersList.innerHTML = `
    <div class="admin-section-header">
      <div>
        <h3 style="margin: 0; color: var(--primary); font-size: 20px; font-weight: 700;">User Management</h3>
        <p style="margin: 4px 0 0; color: var(--muted); font-size: 14px;">Manage user accounts and permissions</p>
      </div>
      <button class="btn primary" onclick="showCreateUserForm()">
        <span style="margin-right: 8px;">👥</span>Add User
      </button>
    </div>
    
    <div class="users-stats" style="background: rgba(0, 212, 255, 0.05); border: 1px solid rgba(0, 212, 255, 0.2); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
      <div style="display: flex; gap: 24px; align-items: center;">
        <div style="text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: var(--primary);">${users.length}</div>
          <div style="font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px;">Total Users</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: var(--purple);">${users.filter(u => u.role === 'admin').length}</div>
          <div style="font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px;">Admins</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 24px; font-weight: 700; color: var(--accent);">${users.filter(u => u.role === 'editor').length}</div>
          <div style="font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px;">Editors</div>
        </div>
      </div>
    </div>
    
    <div class="users-list">
      ${users.map(user => `
        <div class="user-item">
          <div class="user-info">
            <div class="user-header">
              <span class="user-name">${escapeHtml(user.username)}</span>
              <span class="user-role ${user.role}">${user.role}</span>
              ${user.role === 'admin' ? '<span style="margin-left: 8px;">👑</span>' : ''}
            </div>
            <div class="user-details">
              <span class="username">@${user.username}</span>
              <span class="last-login" style="color: ${user.lastLogin ? 'var(--primary)' : 'var(--muted)'};">
                ${user.lastLogin ? 
                  '🟢 Last: ' + new Date(user.lastLogin).toLocaleDateString() : 
                  '⚪ Never logged in'}
              </span>
              ${user.role === 'editor' && user.channels && user.channels.length > 0 ? 
                `<div class="user-channels">🏷️ Channels: ${user.channels.join(', ')}</div>` : 
                user.role === 'editor' ? '<div class="user-channels" style="color: var(--muted);">📝 No channels assigned</div>' : ''}
            </div>
          </div>
          <div class="user-actions">
            <button class="btn-small secondary" onclick="editUser('${user.username}')">
              <span style="margin-right: 4px;">✏️</span>Edit
            </button>
            ${user.username !== 'admin' ? 
              `<button class="btn-small danger" onclick="deleteUser('${user.username}')">
                <span style="margin-right: 4px;">🗑️</span>Delete
              </button>` : 
              '<button class="btn-small" style="opacity: 0.5; cursor: not-allowed;" disabled>🔒 Protected</button>'}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function showCreateUserForm() {
  const modal = document.getElementById('userFormModal');
  if (!modal) {
    // Create modal if it doesn't exist
    createUserFormModal();
  }
  
  document.getElementById('userFormModal').classList.remove('hidden');
  document.getElementById('userFormTitle').textContent = 'Create New User';
  document.getElementById('userFormUsername').value = '';
  document.getElementById('userFormPassword').value = '';
  document.getElementById('userFormRole').value = 'user';
  document.getElementById('userFormUsername').disabled = false;
  
  adminState.editingUser = null;
}

function editUser(username) {
  const modal = document.getElementById('userFormModal');
  if (!modal) {
    createUserFormModal();
  }
  
  document.getElementById('userFormModal').classList.remove('hidden');
  document.getElementById('userFormTitle').textContent = 'Edit User';
  document.getElementById('userFormUsername').value = username;
  document.getElementById('userFormPassword').value = '';
  document.getElementById('userFormRole').value = userManager.users[username]?.role || 'user';
  document.getElementById('userFormUsername').disabled = true;
  
  adminState.editingUser = username;
}

function createUserFormModal() {
  const modalHTML = `
    <div id="userFormModal" class="modal hidden">
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <div>
            <h3 id="userFormTitle" style="margin: 0; color: var(--primary);">Create User</h3>
            <p style="margin: 4px 0 0; color: var(--muted); font-size: 14px;">Add a new user to the system</p>
          </div>
          <button class="close-btn" onclick="closeUserForm()">&times;</button>
        </div>
        <div class="modal-body" style="padding: 24px;">
          <div class="form-group" style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; color: var(--text); font-weight: 500;">
              <span style="margin-right: 8px;">👤</span>Username:
            </label>
            <input type="text" id="userFormUsername" placeholder="Enter username" 
                   style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: rgba(0, 0, 0, 0.3); color: var(--text); font-size: 14px;">
          </div>
          <div class="form-group" style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; color: var(--text); font-weight: 500;">
              <span style="margin-right: 8px;">🔑</span>Password:
            </label>
            <input type="password" id="userFormPassword" placeholder="Enter password" 
                   style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: rgba(0, 0, 0, 0.3); color: var(--text); font-size: 14px;">
          </div>
          <div class="form-group" style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; color: var(--text); font-weight: 500;">
              <span style="margin-right: 8px;">🛡️</span>Role:
            </label>
            <select id="userFormRole" onchange="toggleChannelAssignment()" 
                    style="width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: rgba(0, 0, 0, 0.3); color: var(--text); font-size: 14px;">
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div id="channelAssignment" class="form-group" style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; color: var(--text); font-weight: 500;">
              <span style="margin-right: 8px;">🏷️</span>Assign Channels:
            </label>
            <div id="channelCheckboxes" style="max-height: 120px; overflow-y: auto; padding: 8px; border: 1px solid var(--border); border-radius: 8px; background: rgba(0, 0, 0, 0.2);">
              <!-- Channel checkboxes will be populated here -->
            </div>
            <p style="margin: 8px 0 0; color: var(--muted); font-size: 12px;">Select which channels this editor can access</p>
          </div>
        </div>
        <div class="modal-footer" style="padding: 16px 24px; border-top: 1px solid var(--border); display: flex; gap: 12px; justify-content: flex-end;">
          <button class="btn secondary" onclick="closeUserForm()">Cancel</button>
          <button class="btn primary" onclick="saveUserForm()">
            <span style="margin-right: 8px;">💾</span>Save User
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Populate channel checkboxes after modal is created
  setTimeout(() => {
    populateChannelCheckboxes();
    toggleChannelAssignment(); // Hide channels for admin by default
  }, 100);
}

// Channel assignment functions
function populateChannelCheckboxes() {
  const channelContainer = document.getElementById('channelCheckboxes');
  if (!channelContainer) return;
  
  // Get available channels from the kanban board
  const channels = ['Todo', 'In Progress', 'In Review', 'Testing', 'Done'];
  
  channelContainer.innerHTML = channels.map(channel => `
    <label style="display: flex; align-items: center; padding: 8px; margin-bottom: 4px; cursor: pointer; border-radius: 4px; transition: background 0.2s;" 
           onmouseover="this.style.background='rgba(0, 212, 255, 0.1)'" 
           onmouseout="this.style.background='transparent'">
      <input type="checkbox" name="userChannels" value="${channel}" 
             style="margin-right: 8px; accent-color: var(--primary);">
      <span style="color: var(--text);">${channel}</span>
    </label>
  `).join('');
}

function toggleChannelAssignment() {
  const role = document.getElementById('userFormRole').value;
  const channelAssignment = document.getElementById('channelAssignment');
  
  if (channelAssignment) {
    channelAssignment.style.display = role === 'editor' ? 'block' : 'none';
  }
}

function getSelectedChannels() {
  const checkboxes = document.querySelectorAll('input[name="userChannels"]:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

function closeUserForm() {
  document.getElementById('userFormModal').classList.add('hidden');
  adminState.editingUser = null;
}

async function saveUserForm() {
  const username = document.getElementById('userFormUsername').value.trim();
  const password = document.getElementById('userFormPassword').value.trim();
  const role = document.getElementById('userFormRole').value;
  const channels = role === 'editor' ? getSelectedChannels() : [];
  
  if (!username) {
    showNotification('Username is required', 'error');
    return;
  }
  
  if (!password && !adminState.editingUser) {
    showNotification('Password is required for new users', 'error');
    return;
  }
  
  try {
    if (adminState.editingUser) {
      // Update existing user
      const updates = { role, channels };
      if (password) {
        const hashedData = await hashPassword(password);
        updates.password = hashedData.hash;
        updates.salt = hashedData.salt;
      }
      userManager.updateUser(username, updates);
      showNotification('User updated successfully', 'success');
    } else {
      // Create new user with channel assignment
      await userManager.createUser(username, password, role, channels);
      showNotification('User created successfully', 'success');
    }
    
    closeUserForm();
    loadUsersList();
    
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

async function deleteUser(username) {
  if (!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
    return;
  }
  
  try {
    userManager.deleteUser(username);
    showNotification('User deleted successfully', 'success');
    loadUsersList();
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// Auto-login check on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Page loaded, checking authentication system...');
  
  // Wait a moment for all scripts to load
  setTimeout(() => {
    if (typeof userManager === 'undefined' || !userManager) {
      console.error('❌ UserManager not loaded properly');
      const errorEl = document.getElementById('loginError');
      if (errorEl) {
        errorEl.classList.remove('hidden');
        errorEl.textContent = 'Authentication system failed to load. Please refresh the page.';
      }
      return;
    }
    
    console.log('✅ UserManager loaded successfully');
    
    // Check for existing session
    if (userManager.isLoggedIn()) {
      const currentUser = userManager.getCurrentUser();
      if (currentUser) {
        appState.currentUser = currentUser;
        appState.isLoggedIn = true;
        
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        
        updateUserDisplay();
        initializeApp();
        
        console.log('Auto-login successful for:', currentUser.username);
      }
    } else {
      console.log('No existing session found, showing login screen');
      // Focus on username input
      const usernameInput = document.getElementById('usernameInput');
      if (usernameInput) {
        usernameInput.focus();
      }
    }
  }, 100); // Small delay to ensure all scripts are loaded
});

// Helper function for HTML escaping
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Notification system
function showNotification(message, type = 'info', duration = null) {
  let notification = document.getElementById('notification');
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'notification';
    notification.className = 'notification hidden';
    document.body.appendChild(notification);
  }
  
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.classList.remove('hidden');
  
  // Auto-hide based on duration or message type
  let hideTime = duration;
  if (!hideTime) {
    hideTime = message.includes('Welcome') || message.includes('Logged out') ? 4000 : 3000;
    if (type === 'info') hideTime = 2000; // Shorter for info messages like auto-save
  }
  
  setTimeout(() => {
    if (notification) {
      notification.classList.add('hidden');
    }
  }, hideTime);
}

// App Initialization
function initializeApp() {
  try {
    console.log('Initializing app for user:', appState.currentUser.name);
    const loaded = utils.loadFromStorage();
    if (!loaded) {
      createSampleData();
    }
    
    setupEventListeners();
    renderBoard();
    utils.updateAllDropdowns();
    updateStats();
    
    // Show personalized welcome message
    setTimeout(() => {
      const total = appState.projects.length;
      showNotification(`${appState.currentUser.name}, you have access to ${total} projects.`, 'info');
    }, 1500);
    
    console.log('App initialized successfully for:', appState.currentUser.name);
  } catch (error) {
    console.error('Error initializing app:', error);
    showNotification('Error initializing app. Please refresh and try again.', 'error');
  }
}

function createSampleData() {
  const sampleProjects = [
    {
      id: utils.generateId(),
      title: 'Client Nova – Launch Campaign',
      client: 'Nova',
      editor: 'Mia',
      platform: 'Instagram',
      channel: 'Main Brand',
      due: '2025-09-05',
      uploadDate: '',
      priority: 'HIGH',
      stage: 'editing',
      color: 'teal',
      links: '',
      rawFootage: '',
      notes: 'Focus on product hero shots and brand messaging.',
      hook: 'Show hero shot in first 1s',
      ending: 'Swipe up for full reveal',
      script: '',
      voiceover: '',
      keyShots: 'Hero shot\nLogo sting\nProduct close-up',
      locations: 'Studio A\nOutdoor location',
      music: '',
      editNotes: 'Add dynamic transitions',
      checklist: [
        { id: utils.generateId(), text: 'Review raw footage', done: true },
        { id: utils.generateId(), text: 'Create rough cut', done: false },
        { id: utils.generateId(), text: 'Add sound design', done: false }
      ],
      createdAt: Date.now(),
      createdBy: 'admin',
      timeline: { uploaded: Date.now() - 86400000, assigned: Date.now() - 43200000, editing: Date.now() }
    },
    {
      id: utils.generateId(),
      title: 'TechCorp – Behind the Scenes',
      client: 'TechCorp',
      editor: 'Leo',
      platform: 'YouTube',
      channel: 'Client Channel',
      due: '2025-09-02',
      uploadDate: '',
      priority: 'MEDIUM',
      stage: 'revisions',
      color: 'navy',
      links: '',
      rawFootage: '',
      notes: 'Documentary style editing with interviews.',
      hook: 'Cold open with team at work',
      ending: 'Subscribe for more content',
      script: '',
      voiceover: '',
      keyShots: 'Interview setups\nOffice b-roll\nTeam collaboration',
      locations: 'Client office\nConference room',
      music: 'Corporate upbeat',
      editNotes: 'Keep pace engaging, use split screens',
      checklist: [
        { id: utils.generateId(), text: 'First cut complete', done: true },
        { id: utils.generateId(), text: 'Client feedback received', done: true },
        { id: utils.generateId(), text: 'Implement revisions', done: false }
      ],
      createdAt: Date.now() - 172800000,
      createdBy: 'admin',
      timeline: { 
        uploaded: Date.now() - 172800000, 
        assigned: Date.now() - 129600000, 
        editing: Date.now() - 86400000,
        revisions: Date.now() - 43200000
      }
    }
  ];
  
  appState.projects = sampleProjects;
  utils.saveToStorage();
}

function setupEventListeners() {
  try {
    // Initialize debounced autosave
    utils.initDebouncedAutoSave();
    
    // Search and filters
    const searchInput = document.getElementById('searchInput');
    const editorFilter = document.getElementById('editorFilter');
    const platformFilter = document.getElementById('platformFilter');
    const channelFilter = document.getElementById('channelFilter');
    
    if (searchInput) searchInput.addEventListener('input', debounce(renderBoard, 300));
    if (editorFilter) editorFilter.addEventListener('change', renderBoard);
    if (platformFilter) platformFilter.addEventListener('change', renderBoard);
    if (channelFilter) channelFilter.addEventListener('change', renderBoard);
    
    // Form submission
    const projectForm = document.getElementById('projectForm');
    if (projectForm) {
      projectForm.addEventListener('submit', handleFormSubmit);
      
      // Add autosave listeners to all form inputs
      const formInputs = projectForm.querySelectorAll('input, textarea, select');
      formInputs.forEach(input => {
        if (input.type !== 'submit' && input.type !== 'button') {
          input.addEventListener('input', utils.debouncedAutoSave);
          input.addEventListener('change', utils.debouncedAutoSave);
        }
      });
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Only handle shortcuts when logged in
      if (!appState.isLoggedIn) return;
      
      if (e.key === 'Escape') closeModal();
      if (e.key === 'n' && e.ctrlKey) {
        e.preventDefault();
        addNewProject();
      }
      if (e.key === 's' && e.ctrlKey) {
        e.preventDefault();
        utils.saveToStorage();
        showNotification('Data saved manually', 'success');
      }
    });
    
    // Login form handling
    const usernameInput = document.getElementById('usernameInput');
    const passwordInput = document.getElementById('passwordInput');
    
    if (usernameInput) {
      usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          passwordInput.focus();
        }
      });
    }
    
    if (passwordInput) {
      passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          checkPassword();
        }
      });
    }

    // Handle page unload to save data
    window.addEventListener('beforeunload', (e) => {
      if (appState.isLoggedIn) {
        utils.saveToStorage();
      }
    });

    // Click outside modal to close
    document.addEventListener('click', (e) => {
      const modals = ['manageModal', 'trashModal', 'projectModal'];
      modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal && !modal.classList.contains('hidden') && e.target === modal) {
          closeModal();
        }
      });
    });
    
    console.log('Event listeners set up successfully');
  } catch (error) {
    console.error('Error setting up event listeners:', error);
  }
}

// HTML escape function for security
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Debounce function for search
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Enhanced Project Management with User Tracking
function addNewProject(stage = 'uploaded') {
  try {
    appState.editingProject = null;
    appState.currentChecklist = [];
    resetForm();
    document.getElementById('modalTitle').textContent = 'New Project';
    document.getElementById('projectModal').classList.remove('hidden');
    document.getElementById('projectTitle').focus();
    renderChecklist();
  } catch (error) {
    console.error('Error opening new project modal:', error);
    showNotification('Error opening project form. Please try again.', 'error');
  }
}

function editProject(projectId) {
  try {
    const project = appState.projects.find(p => p.id === projectId);
    if (!project) {
      showNotification('Project not found', 'error');
      return;
    }
    
    appState.editingProject = project;
    appState.currentChecklist = project.checklist ? [...project.checklist] : [];
    populateForm(project);
    document.getElementById('modalTitle').textContent = 'Edit Project';
    document.getElementById('projectModal').classList.remove('hidden');
    renderChecklist();
  } catch (error) {
    console.error('Error editing project:', error);
    showNotification('Error opening project for editing. Please try again.', 'error');
  }
}

function deleteProject(projectId) {
  try {
    if (!confirm('Delete this project? It will be moved to trash.')) return;
    
    const projectIndex = appState.projects.findIndex(p => p.id === projectId);
    if (projectIndex !== -1) {
      const project = appState.projects.splice(projectIndex, 1)[0];
      project.deletedAt = Date.now();
      project.deletedBy = appState.currentUser.username;
      appState.trash.push(project);
      
      if (utils.saveToStorage()) {
        renderBoard();
        updateStats();
        showNotification('Project moved to trash', 'success');
      }
    }
  } catch (error) {
    console.error('Error deleting project:', error);
    showNotification('Error deleting project. Please try again.', 'error');
  }
}

function duplicateProject(projectId) {
  try {
    const original = appState.projects.find(p => p.id === projectId);
    if (!original) {
      showNotification('Project not found', 'error');
      return;
    }
    
    const duplicate = {
      ...JSON.parse(JSON.stringify(original)),
      id: utils.generateId(),
      title: original.title + ' (Copy)',
      createdAt: Date.now(),
      createdBy: appState.currentUser.username,
      timeline: { [original.stage]: Date.now() },
      checklist: (original.checklist || []).map(item => ({
        id: utils.generateId(),
        text: item.text,
        done: false
      }))
    };
    
    appState.projects.push(duplicate);
    
    if (utils.saveToStorage()) {
      renderBoard();
      updateStats();
      showNotification('Project duplicated successfully', 'success');
    }
  } catch (error) {
    console.error('Error duplicating project:', error);
    showNotification('Error duplicating project. Please try again.', 'error');
  }
}

function moveProject(projectId, newStage) {
  try {
    const project = appState.projects.find(p => p.id === projectId);
    if (!project || project.stage === newStage) return;
    
    project.stage = newStage;
    project.timeline = project.timeline || {};
    project.timeline[newStage] = Date.now();
    project.lastModifiedBy = appState.currentUser.username;
    
    if (utils.saveToStorage()) {
      renderBoard();
      updateStats();
      const stageName = CONFIG.stages.find(s => s.id === newStage)?.name || newStage;
      showNotification(`Project moved to ${stageName}`, 'success');
    }
  } catch (error) {
    console.error('Error moving project:', error);
    showNotification('Error moving project. Please try again.', 'error');
  }
}

// Enhanced Form Handling with User Tracking
function resetForm() {
  try {
    const form = document.getElementById('projectForm');
    if (form) form.reset();
    updateFormSelects();
    appState.currentChecklist = [];
    renderChecklist();
    
    // Show/hide action buttons appropriately
    const deleteBtn = document.getElementById('deleteBtn');
    const duplicateBtn = document.getElementById('duplicateBtn');
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (duplicateBtn) duplicateBtn.style.display = 'none';
  } catch (error) {
    console.error('Error resetting form:', error);
  }
}

function populateForm(project) {
  try {
    updateFormSelects();
    
    const fields = [
      'projectTitle', 'projectClient', 'projectEditor', 'projectPlatform',
      'projectChannel', 'projectDue', 'projectUpload', 'projectPriority',
      'projectStage', 'projectColor', 'projectLinks', 'projectFootage',
      'projectNotes', 'projectHook', 'projectEnding', 'projectCreativeBrief'
    ];
    
    const fieldMap = {
      projectTitle: 'title', projectClient: 'client', projectEditor: 'editor',
      projectPlatform: 'platform', projectChannel: 'channel', projectDue: 'due',
      projectUpload: 'uploadDate', projectPriority: 'priority', projectStage: 'stage',
      projectColor: 'color', projectLinks: 'links', projectFootage: 'rawFootage',
      projectNotes: 'notes', projectHook: 'hook', projectEnding: 'ending',
      projectCreativeBrief: 'creativeBrief'
    };
    
    fields.forEach(fieldId => {
      const element = document.getElementById(fieldId);
      const projectField = fieldMap[fieldId];
      if (element && projectField) {
        element.value = project[projectField] || '';
      }
    });
    
    // For backwards compatibility, if no creativeBrief field exists, combine old fields
    if (!project.creativeBrief && element && element.id === 'projectCreativeBrief') {
      const oldFields = [
        project.script ? `Script:\n${project.script}\n\n` : '',
        project.voiceover ? `Voiceover:\n${project.voiceover}\n\n` : '',
        project.keyShots ? `Key Shots:\n${project.keyShots}\n\n` : '',
        project.locations ? `Locations:\n${project.locations}\n\n` : '',
        project.music ? `Music:\n${project.music}\n\n` : '',
        project.editNotes ? `Edit Notes:\n${project.editNotes}\n\n` : ''
      ].filter(field => field).join('');
      
      if (oldFields.trim()) {
        element.value = oldFields.trim();
      }
    }
    
    // Show action buttons for existing projects
    const deleteBtn = document.getElementById('deleteBtn');
    const duplicateBtn = document.getElementById('duplicateBtn');
    if (deleteBtn) deleteBtn.style.display = '';
    if (duplicateBtn) duplicateBtn.style.display = '';
  } catch (error) {
    console.error('Error populating form:', error);
    showNotification('Error loading project data into form.', 'error');
  }
}

// Helper function to get channels available to current user
function getAvailableChannelsForUser() {
  if (!appState.currentUser) return [];
  
  // Admin users can see all channels
  if (appState.currentUser.role === 'admin') {
    return appState.channels;
  }
  
  // Editor users can only see their assigned channels
  const userChannels = SECURITY_CONFIG.getUserChannels(appState.currentUser);
  return userChannels.filter(channel => appState.channels.includes(channel));
}

function updateFormSelects() {
  try {
    // Get channels based on user permissions
    const availableChannels = getAvailableChannelsForUser();
    
    const selects = [
      { id: 'projectEditor', data: appState.editors, placeholder: 'Select Editor' },
      { id: 'projectPlatform', data: appState.platforms, placeholder: 'Select Platform' },
      { id: 'projectChannel', data: availableChannels, placeholder: 'Select Channel' }
    ];
    
    selects.forEach(({ id, data, placeholder }) => {
      const select = document.getElementById(id);
      if (select) {
        const currentValue = select.value;
        select.innerHTML = `<option value="">${placeholder}</option>` +
          data.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');
        if (currentValue && data.includes(currentValue)) {
          select.value = currentValue;
        }
      }
    });
    
    // Update stage select
    const stageSelect = document.getElementById('projectStage');
    if (stageSelect) {
      const currentValue = stageSelect.value;
      stageSelect.innerHTML = CONFIG.stages.map(stage => 
        `<option value="${stage.id}">${stage.name}</option>`).join('');
      if (currentValue) {
        stageSelect.value = currentValue;
      }
    }
    
    // Update color select
    const colorSelect = document.getElementById('projectColor');
    if (colorSelect) {
      const currentValue = colorSelect.value;
      colorSelect.innerHTML = CONFIG.cardColors.map(color => 
        `<option value="${color.value}">${color.name}</option>`).join('');
      if (currentValue) {
        colorSelect.value = currentValue;
      }
    }
  } catch (error) {
    console.error('Error updating form selects:', error);
  }
}

function handleFormSubmit(e) {
  e.preventDefault();
  
  try {
    const getFieldValue = (id) => {
      const element = document.getElementById(id);
      return element ? element.value.trim() : '';
    };
    
    const formData = {
      title: getFieldValue('projectTitle'),
      client: getFieldValue('projectClient'),
      editor: getFieldValue('projectEditor'),
      platform: getFieldValue('projectPlatform'),
      channel: getFieldValue('projectChannel'),
      due: getFieldValue('projectDue'),
      uploadDate: getFieldValue('projectUpload'),
      priority: getFieldValue('projectPriority') || 'MEDIUM',
      stage: getFieldValue('projectStage') || 'uploaded',
      color: getFieldValue('projectColor') || 'teal',
      links: getFieldValue('projectLinks'),
      rawFootage: getFieldValue('projectFootage'),
      notes: getFieldValue('projectNotes'),
      hook: getFieldValue('projectHook'),
      ending: getFieldValue('projectEnding'),
      creativeBrief: getFieldValue('projectCreativeBrief'),
      checklist: appState.currentChecklist.slice()
    };
    
    if (!formData.title) {
      showNotification('Please enter a project title', 'error');
      document.getElementById('projectTitle').focus();
      return;
    }
    
    if (appState.editingProject) {
      // Update existing project
      Object.assign(appState.editingProject, formData);
      appState.editingProject.lastModifiedBy = appState.currentUser.username;
      appState.editingProject.lastModified = Date.now();
      showNotification('Project updated successfully', 'success');
    } else {
      // Create new project
      const newProject = {
        id: utils.generateId(),
        ...formData,
        createdAt: Date.now(),
        createdBy: appState.currentUser.username,
        timeline: { [formData.stage]: Date.now() }
      };
      appState.projects.push(newProject);
      showNotification('Project created successfully', 'success');
    }
    
    // Add new items to lists if they don't exist
    const updated = updateListsFromForm(formData);
    
    if (utils.saveToStorage()) {
      closeModal();
      renderBoard();
      if (updated) {
        utils.updateAllDropdowns();
      }
      updateStats();
    }
  } catch (error) {
    console.error('Error saving project:', error);
    showNotification('Error saving project. Please try again.', 'error');
  }
}

function updateListsFromForm(formData) {
  let updated = false;
  
  if (formData.editor && !appState.editors.includes(formData.editor)) {
    appState.editors.push(formData.editor);
    appState.editors.sort();
    updated = true;
  }
  if (formData.platform && !appState.platforms.includes(formData.platform)) {
    appState.platforms.push(formData.platform);
    appState.platforms.sort();
    updated = true;
  }
  if (formData.channel && !appState.channels.includes(formData.channel)) {
    appState.channels.push(formData.channel);
    appState.channels.sort();
    updated = true;
  }
  
  return updated;
}

function closeModal() {
  try {
    const modals = ['projectModal', 'manageModal', 'trashModal', 'adminModal'];
    modals.forEach(modalId => {
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.add('hidden');
    });
    appState.editingProject = null;
    adminState.editingUser = null;
  } catch (error) {
    console.error('Error closing modal:', error);
  }
}

// Enhanced Checklist Management
function renderChecklist() {
  const container = document.getElementById('checklistContainer');
  if (!container) return;
  
  try {
    if (appState.currentChecklist.length === 0) {
      container.innerHTML = '<p class="empty-checklist">No items yet. Add some above.</p>';
    } else {
      container.innerHTML = appState.currentChecklist.map(item => `
        <div class="checklist-item">
          <input type="checkbox" ${item.done ? 'checked' : ''} 
                 onchange="toggleChecklistItem('${item.id}')" />
          <input type="text" value="${escapeHtml(item.text)}" 
                 onchange="updateChecklistItem('${item.id}', this.value)" />
          <button type="button" class="btn-remove" onclick="removeChecklistItem('${item.id}')">×</button>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Error rendering checklist:', error);
    container.innerHTML = '<p class="empty-checklist">Error loading checklist</p>';
  }
}

function addChecklistItem() {
  try {
    const input = document.getElementById('newChecklistItem');
    if (!input) return;
    
    const text = input.value.trim();
    if (!text) return;
    
    appState.currentChecklist.push({
      id: utils.generateId(),
      text: text,
      done: false
    });
    
    input.value = '';
    renderChecklist();
  } catch (error) {
    console.error('Error adding checklist item:', error);
  }
}

function toggleChecklistItem(itemId) {
  try {
    const item = appState.currentChecklist.find(i => i.id === itemId);
    if (item) {
      item.done = !item.done;
    }
  } catch (error) {
    console.error('Error toggling checklist item:', error);
  }
}

function updateChecklistItem(itemId, newText) {
  try {
    const item = appState.currentChecklist.find(i => i.id === itemId);
    if (item) {
      item.text = newText.trim();
    }
  } catch (error) {
    console.error('Error updating checklist item:', error);
  }
}

function removeChecklistItem(itemId) {
  try {
    appState.currentChecklist = appState.currentChecklist.filter(i => i.id !== itemId);
    renderChecklist();
  } catch (error) {
    console.error('Error removing checklist item:', error);
  }
}

// Enhanced Rendering Functions
function renderBoard() {
  try {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;
    
    const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const editorFilter = document.getElementById('editorFilter')?.value || '';
    const platformFilter = document.getElementById('platformFilter')?.value || '';
    const channelFilter = document.getElementById('channelFilter')?.value || '';
    
    // Get channels user has access to
    const userChannels = getAvailableChannelsForUser();
    const isAdmin = appState.currentUser && appState.currentUser.role === 'admin';
    
    // Filter projects
    const filteredProjects = appState.projects.filter(project => {
      const matchesSearch = !searchTerm || 
        project.title.toLowerCase().includes(searchTerm) ||
        (project.client || '').toLowerCase().includes(searchTerm);
      const matchesEditor = !editorFilter || project.editor === editorFilter;
      const matchesPlatform = !platformFilter || project.platform === platformFilter;
      const matchesChannel = !channelFilter || project.channel === channelFilter;
      
      // Channel permission check - admins see all, editors see only their channels
      const hasChannelAccess = isAdmin || !project.channel || userChannels.includes(project.channel);
      
      return matchesSearch && matchesEditor && matchesPlatform && matchesChannel && hasChannelAccess;
    });
    
    // Group by stage
    const projectsByStage = CONFIG.stages.reduce((acc, stage) => {
      acc[stage.id] = filteredProjects.filter(p => p.stage === stage.id);
      return acc;
    }, {});
    
    // Render columns
    board.innerHTML = CONFIG.stages.map(stage => `
      <div class="column" style="border-top: 3px solid ${stage.color};">
        <div class="column-header" style="background: linear-gradient(135deg, ${stage.color}20, ${stage.color}10);">
          <span style="color: ${stage.color}; font-weight: 700;">${stage.name}</span>
          <span class="column-count" style="background: ${stage.color}30; color: ${stage.color}; border-color: ${stage.color}50;">${projectsByStage[stage.id].length}</span>
        </div>
        <div class="drop-zone" data-stage="${stage.id}" ondrop="handleDrop(event)" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)">
          ${projectsByStage[stage.id].map(renderProjectCard).join('')}
          <button class="btn secondary" onclick="addNewProject('${stage.id}')" style="margin-top: auto;">
            + Add Project
          </button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error rendering board:', error);
    showNotification('Error rendering board. Please refresh.', 'error');
  }
}

function renderProjectCard(project) {
  try {
    const dueDate = project.due ? new Date(project.due) : null;
    const isOverdue = dueDate && dueDate < new Date();
    const dueSoon = dueDate && utils.daysBetween(new Date(), dueDate) <= 3;
    
    const stageIndex = CONFIG.stages.findIndex(s => s.id === project.stage);
    const progress = ((stageIndex + 1) / CONFIG.stages.length) * 100;
    
    const completedTasks = (project.checklist || []).filter(item => item.done).length;
    const totalTasks = (project.checklist || []).length;
    
    // Get assigned user display
    const assignedUser = project.editor || 'Unassigned';
    const assignedUserClass = project.editor ? 'assigned' : 'unassigned';
    
    return `
      <div class="project-card ${project.color || 'teal'}" draggable="true" data-id="${project.id}" 
           ondragstart="handleDragStart(event)" ondragend="handleDragEnd(event)"
           ondblclick="quickComplete('${project.id}')">
        <div class="card-header">
          <div class="card-title-section">
            <h4 class="card-title">${escapeHtml(project.title)}</h4>
            <div class="assigned-to ${assignedUserClass}">
              <span class="assigned-label">Assigned to:</span>
              <span class="assigned-user">${escapeHtml(assignedUser)}</span>
            </div>
          </div>
          <span class="priority ${project.priority.toLowerCase()}">${project.priority.charAt(0)}</span>
        </div>
        <div class="card-meta">
          ${project.client ? `<span class="meta-tag">${escapeHtml(project.client)}</span>` : ''}
          ${project.platform ? `<span class="meta-tag">📱 ${escapeHtml(project.platform)}</span>` : ''}
          ${project.channel ? `<span class="meta-tag">📺 ${escapeHtml(project.channel)}</span>` : ''}
          ${project.due ? `<span class="meta-tag ${isOverdue ? 'overdue' : dueSoon ? 'due-soon' : ''}">📅 ${utils.formatDate(project.due)}</span>` : ''}
          ${project.uploadDate ? `<span class="meta-tag">📤 ${utils.formatDate(project.uploadDate)}</span>` : ''}
          ${project.createdBy ? `<span class="meta-tag created-by">Created by ${escapeHtml(project.createdBy)}</span>` : ''}
        </div>
        <div class="card-progress">
          <div class="progress-bar" style="width: ${progress}%"></div>
        </div>
        ${totalTasks > 0 ? `<div class="checklist-progress">${completedTasks}/${totalTasks} tasks completed</div>` : ''}
        <div class="card-actions">
          <button class="icon-btn" onclick="editProject('${project.id}')" title="Edit">✏️</button>
          <button class="icon-btn" onclick="duplicateProject('${project.id}')" title="Duplicate">📋</button>
          <button class="icon-btn" onclick="deleteProject('${project.id}')" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Error rendering project card:', error);
    return '<div class="project-card">Error loading project</div>';
  }
}

function updateFilters() {
  try {
    // Get channels based on user permissions for filters
    const availableChannels = getAvailableChannelsForUser();
    
    const filters = [
      { id: 'editorFilter', data: appState.editors, label: 'All Editors' },
      { id: 'platformFilter', data: appState.platforms, label: 'All Platforms' },
      { id: 'channelFilter', data: availableChannels, label: 'All Channels' }
    ];
    
    filters.forEach(({ id, data, label }) => {
      const filter = document.getElementById(id);
      if (filter) {
        const currentValue = filter.value;
        filter.innerHTML = `<option value="">${label}</option>` +
          data.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');
        if (currentValue && data.includes(currentValue)) {
          filter.value = currentValue;
        }
      }
    });
  } catch (error) {
    console.error('Error updating filters:', error);
  }
}

function updateStats() {
  try {
    const total = appState.projects.length;
    const completed = appState.projects.filter(p => p.stage === 'posted').length;
    
    // Calculate average cycle time
    const completedProjects = appState.projects.filter(p => 
      p.stage === 'posted' && p.timeline && p.timeline.uploaded && p.timeline.posted
    );
    
    const avgDays = completedProjects.length > 0 
      ? Math.round(completedProjects.reduce((sum, p) => 
          sum + utils.daysBetween(p.timeline.uploaded, p.timeline.posted), 0
        ) / completedProjects.length)
      : 0;
    
    const updateStat = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    };
    
    updateStat('totalCount', total);
    updateStat('completedCount', completed);
    updateStat('avgDays', avgDays || '-');
    updateStat('trashCount', appState.trash.length);
  } catch (error) {
    console.error('Error updating stats:', error);
  }
}

// Drag and Drop Functions
function handleDragStart(e) {
  try {
    e.dataTransfer.setData('text/plain', e.target.dataset.id);
    e.target.classList.add('dragging');
  } catch (error) {
    console.error('Error starting drag:', error);
  }
}

function handleDragEnd(e) {
  try {
    e.target.classList.remove('dragging');
  } catch (error) {
    console.error('Error ending drag:', error);
  }
}

function handleDragOver(e) {
  try {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  } catch (error) {
    console.error('Error during drag over:', error);
  }
}

function handleDragLeave(e) {
  try {
    e.currentTarget.classList.remove('drag-over');
  } catch (error) {
    console.error('Error during drag leave:', error);
  }
}

function handleDrop(e) {
  try {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    const projectId = e.dataTransfer.getData('text/plain');
    const newStage = e.currentTarget.dataset.stage;
    
    moveProject(projectId, newStage);
  } catch (error) {
    console.error('Error dropping item:', error);
  }
}

// Quick Actions
function quickComplete(projectId) {
  moveProject(projectId, 'posted');
}

function exportData() {
  try {
    const data = {
      projects: appState.projects,
      trash: appState.trash,
      editors: appState.editors,
      platforms: appState.platforms,
      channels: appState.channels,
      exportDate: new Date().toISOString(),
      exportedBy: appState.currentUser.username,
      version: '2.1'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mhm-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('Data exported successfully', 'success');
  } catch (error) {
    console.error('Error exporting data:', error);
    showNotification('Error exporting data', 'error');
  }
}

function importData() {
  const fileInput = document.getElementById('fileInput');
  if (fileInput) fileInput.click();
}

// Management Functions
function openManageModal() {
  try {
    renderManagementLists();
    document.getElementById('manageModal').classList.remove('hidden');
  } catch (error) {
    console.error('Error opening manage modal:', error);
    showNotification('Error opening management interface', 'error');
  }
}

function renderManagementLists() {
  try {
    // Render editors list
    const editorsContainer = document.getElementById('manageEditors');
    if (editorsContainer) {
      editorsContainer.innerHTML = `
        <div class="manage-list-wrapper">
          <div class="manage-items-container">
            ${appState.editors.map((editor, index) => `
              <div class="manage-item" data-index="${index}">
                <span class="manage-item-text">${escapeHtml(editor)}</span>
                <button class="btn-remove" onclick="removeEditor('${escapeHtml(editor)}')" title="Remove ${escapeHtml(editor)}">×</button>
              </div>
            `).join('')}
          </div>
          <div class="manage-add">
            <input type="text" id="newEditor" placeholder="Add new editor" maxlength="50" />
            <button class="btn secondary" onclick="addEditor()">Add Editor</button>
          </div>
        </div>
      `;
    }
    
    // Render platforms list
    const platformsContainer = document.getElementById('managePlatforms');
    if (platformsContainer) {
      platformsContainer.innerHTML = `
        <div class="manage-list-wrapper">
          <div class="manage-items-container">
            ${appState.platforms.map((platform, index) => `
              <div class="manage-item" data-index="${index}">
                <span class="manage-item-text">${escapeHtml(platform)}</span>
                <button class="btn-remove" onclick="removePlatform('${escapeHtml(platform)}')" title="Remove ${escapeHtml(platform)}">×</button>
              </div>
            `).join('')}
          </div>
          <div class="manage-add">
            <input type="text" id="newPlatform" placeholder="Add new platform" maxlength="50" />
            <button class="btn secondary" onclick="addPlatform()">Add Platform</button>
          </div>
        </div>
      `;
    }
    
    // Render channels list
    const channelsContainer = document.getElementById('manageChannels');
    if (channelsContainer) {
      channelsContainer.innerHTML = `
        <div class="manage-list-wrapper">
          <div class="manage-items-container">
            ${appState.channels.map((channel, index) => `
              <div class="manage-item" data-index="${index}">
                <span class="manage-item-text">${escapeHtml(channel)}</span>
                <button class="btn-remove" onclick="removeChannel('${escapeHtml(channel)}')" title="Remove ${escapeHtml(channel)}">×</button>
              </div>
            `).join('')}
          </div>
          <div class="manage-add">
            <input type="text" id="newChannel" placeholder="Add new channel" maxlength="50" />
            <button class="btn secondary" onclick="addChannel()">Add Channel</button>
          </div>
        </div>
      `;
    }

    // Add enter key listeners for inputs
    ['newEditor', 'newPlatform', 'newChannel'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (id === 'newEditor') addEditor();
            else if (id === 'newPlatform') addPlatform();
            else if (id === 'newChannel') addChannel();
          }
        });
      }
    });
  } catch (error) {
    console.error('Error rendering management lists:', error);
  }
}

// Editor management functions
function addEditor() {
  const input = document.getElementById('newEditor');
  const value = input.value.trim();
  if (value && !appState.editors.includes(value)) {
    appState.editors.push(value);
    appState.editors.sort();
    input.value = '';
    utils.saveToStorage();
    renderManagementLists();
    utils.updateAllDropdowns();
    showNotification(`Editor "${value}" added successfully`, 'success');
  } else if (appState.editors.includes(value)) {
    showNotification('Editor already exists', 'warning');
    input.focus();
  }
}

function removeEditor(editor) {
  if (confirm(`Remove "${editor}" from editors list?\n\nNote: This won't affect existing projects using this editor.`)) {
    appState.editors = appState.editors.filter(e => e !== editor);
    utils.saveToStorage();
    renderManagementLists();
    utils.updateAllDropdowns();
    showNotification(`Editor "${editor}" removed successfully`, 'success');
  }
}

// Platform management functions
function addPlatform() {
  const input = document.getElementById('newPlatform');
  const value = input.value.trim();
  if (value && !appState.platforms.includes(value)) {
    appState.platforms.push(value);
    appState.platforms.sort();
    input.value = '';
    utils.saveToStorage();
    renderManagementLists();
    utils.updateAllDropdowns();
    showNotification(`Platform "${value}" added successfully`, 'success');
  } else if (appState.platforms.includes(value)) {
    showNotification('Platform already exists', 'warning');
    input.focus();
  }
}

function removePlatform(platform) {
  if (confirm(`Remove "${platform}" from platforms list?\n\nNote: This won't affect existing projects using this platform.`)) {
    appState.platforms = appState.platforms.filter(p => p !== platform);
    utils.saveToStorage();
    renderManagementLists();
    utils.updateAllDropdowns();
    showNotification(`Platform "${platform}" removed successfully`, 'success');
  }
}

// Channel management functions
function addChannel() {
  const input = document.getElementById('newChannel');
  const value = input.value.trim();
  if (value && !appState.channels.includes(value)) {
    appState.channels.push(value);
    appState.channels.sort();
    input.value = '';
    utils.saveToStorage();
    renderManagementLists();
    utils.updateAllDropdowns();
    showNotification(`Channel "${value}" added successfully`, 'success');
  } else if (appState.channels.includes(value)) {
    showNotification('Channel already exists', 'warning');
    input.focus();
  }
}

function removeChannel(channel) {
  if (confirm(`Remove "${channel}" from channels list?\n\nNote: This won't affect existing projects using this channel.`)) {
    appState.channels = appState.channels.filter(c => c !== channel);
    utils.saveToStorage();
    renderManagementLists();
    utils.updateAllDropdowns();
    showNotification(`Channel "${channel}" removed successfully`, 'success');
  }
}

// Trash Management
function openTrash() {
  try {
    const trashList = document.getElementById('trashList');
    const trashModal = document.getElementById('trashModal');
    
    if (!trashList || !trashModal) return;
    
    if (appState.trash.length === 0) {
      trashList.innerHTML = '<p class="empty-state">Trash is empty</p>';
    } else {
      trashList.innerHTML = appState.trash.map(project => `
        <div class="trash-item">
          <div class="trash-item-info">
            <strong>${escapeHtml(project.title)}</strong>
            <br><small>${escapeHtml(project.client || 'No client')} • ${escapeHtml(project.editor || 'No editor')}</small>
            ${project.deletedBy ? `<br><small>Deleted by ${escapeHtml(project.deletedBy)}</small>` : ''}
          </div>
          <div class="trash-item-actions">
            <button class="btn secondary" onclick="restoreProject('${project.id}')">Restore</button>
            <button class="btn warning" onclick="permanentDelete('${project.id}')">Delete Forever</button>
          </div>
        </div>
      `).join('');
    }
    
    trashModal.classList.remove('hidden');
  } catch (error) {
    console.error('Error opening trash:', error);
    showNotification('Error opening trash', 'error');
  }
}

function closeTrash() {
  const trashModal = document.getElementById('trashModal');
  if (trashModal) trashModal.classList.add('hidden');
}

function restoreProject(projectId) {
  try {
    const projectIndex = appState.trash.findIndex(p => p.id === projectId);
    if (projectIndex !== -1) {
      const project = appState.trash.splice(projectIndex, 1)[0];
      delete project.deletedAt;
      delete project.deletedBy;
      appState.projects.push(project);
      
      if (utils.saveToStorage()) {
        renderBoard();
        updateStats();
        openTrash(); // Refresh trash view
        showNotification('Project restored successfully', 'success');
      }
    }
  } catch (error) {
    console.error('Error restoring project:', error);
    showNotification('Error restoring project', 'error');
  }
}

function permanentDelete(projectId) {
  try {
    if (confirm('Permanently delete this project? This cannot be undone.')) {
      appState.trash = appState.trash.filter(p => p.id !== projectId);
      
      if (utils.saveToStorage()) {
        updateStats();
        openTrash(); // Refresh trash view
        showNotification('Project deleted permanently', 'success');
      }
    }
  } catch (error) {
    console.error('Error permanently deleting project:', error);
    showNotification('Error deleting project', 'error');
  }
}

function emptyTrash() {
  try {
    if (confirm('Permanently delete ALL projects in trash? This cannot be undone.')) {
      appState.trash = [];
      
      if (utils.saveToStorage()) {
        updateStats();
        closeTrash();
        showNotification('Trash emptied successfully', 'success');
      }
    }
  } catch (error) {
    console.error('Error emptying trash:', error);
    showNotification('Error emptying trash', 'error');
  }
}

// Replace the DOMContentLoaded listener at the bottom with this:
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('🌐 DOM loaded, initializing enhanced app...');
    
    // Initialize user system first
    if (typeof SECURITY_CONFIG !== 'undefined') {
      await SECURITY_CONFIG.initializeUsers();
      console.log('👥 User system initialized with cloud sync');
      console.log('🔐 Security system ready');
      
      // Check for existing session (auto-login)
      const existingSession = await SECURITY_CONFIG.sessionManager.checkAutoLogin();
      if (existingSession) {
        console.log('🔄 Restoring previous session for:', existingSession.name);
        
        appState.currentUser = {
          username: existingSession.username,
          name: existingSession.name,
          role: existingSession.role,
          channels: existingSession.channels,
          sessionId: existingSession.id
        };
        appState.isLoggedIn = true;
        
        // Hide login screen and show main app
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        
        updateUserDisplay();
        initializeApp();
        
        showNotification(`Welcome back, ${existingSession.name}! Session restored.`, 'success');
        
        console.log('✅ Auto-login successful');
      } else {
        // Show login screen
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
      }
    } else {
      console.warn('⚠️ SECURITY_CONFIG not available, login may not work');
    }
    
    // Auto-focus username input if on login screen
    const usernameInput = document.getElementById('usernameInput');
    const loginScreen = document.getElementById('loginScreen');
    if (usernameInput && loginScreen && !loginScreen.classList.contains('hidden')) {
      usernameInput.focus();
    }
    
    console.log('🎯 Enhanced authentication system ready');
    
    // Show available users for debugging
    if (typeof SECURITY_CONFIG !== 'undefined') {
      const userCount = Object.keys(SECURITY_CONFIG.users).length;
      console.log(`👥 ${userCount} users available for login`);
      console.log('💡 Default users: admin/admin123, mia/mia123, leo/leo123, kai/kai123');
      console.log('💡 Custom users created by admin will also be available');
      
      // Debug: Show loaded users
      console.log('🔍 Loaded users:', Object.keys(SECURITY_CONFIG.users));
    }
  } catch (error) {
    console.error('💥 Error during DOM load:', error);
  }
});