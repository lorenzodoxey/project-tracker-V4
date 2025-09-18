// MHM Project Tracker - Simplified for Netlify
const CONFIG = {
  storageKey: 'mhm-tracker-data',
  autoSaveInterval: 30000, // 30 seconds
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

let appState = {
  currentUser: null,
  isLoggedIn: false,
  projects: [],
  trash: [],
  editors: [...CONFIG.defaultEditors],
  platforms: [...CONFIG.defaultPlatforms],
  channels: [...CONFIG.defaultChannels],
  editingProject: null,
  currentChecklist: []
};

// Utility functions
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
        version: '3.0'
      };
      
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(dataToSave));
      return true;
    } catch (error) {
      showNotification('Failed to save data', 'error');
      return false;
    }
  },

  loadFromStorage: () => {
    try {
      const data = JSON.parse(localStorage.getItem(CONFIG.storageKey));
      if (data) {
        appState.projects = Array.isArray(data.projects) ? data.projects : [];
        appState.trash = Array.isArray(data.trash) ? data.trash : [];
        appState.editors = Array.isArray(data.editors) ? data.editors : [...CONFIG.defaultEditors];
        appState.platforms = Array.isArray(data.platforms) ? data.platforms : [...CONFIG.defaultPlatforms];
        appState.channels = Array.isArray(data.channels) ? data.channels : [...CONFIG.defaultChannels];
        
        // Validate projects
        appState.projects.forEach(project => {
          if (!project.id) project.id = utils.generateId();
          if (!CONFIG.stages.find(s => s.id === project.stage)) {
            project.stage = 'uploaded';
          }
          if (!project.checklist) project.checklist = [];
        });
        
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  },

  debounce: (func, wait) => {
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
};

// Authentication functions
async function checkPassword() {
  const usernameInput = document.getElementById('usernameInput');
  const passwordInput = document.getElementById('passwordInput');
  const errorEl = document.getElementById('loginError');
  const loginBtn = document.querySelector('.login-card button');
  
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  
  if (!username || !password) {
    errorEl.classList.remove('hidden');
    errorEl.textContent = 'Please enter both username and password.';
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';
  
  try {
    const session = await auth.login(username, password);
    
    appState.currentUser = session;
    appState.isLoggedIn = true;
    
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    errorEl.classList.add('hidden');
    
    updateUserDisplay();
    initializeApp();
    
    showNotification(`Welcome, ${session.name}!`, 'success');
    
  } catch (error) {
    errorEl.classList.remove('hidden');
    errorEl.textContent = error.message;
    passwordInput.value = '';
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
}

function updateUserDisplay() {
  if (!appState.currentUser) return;
  
  const userInfo = document.getElementById('userInfo');
  if (userInfo) {
    userInfo.innerHTML = `
      <div class="user-badge ${appState.currentUser.role}">
        <span class="user-name">${escapeHtml(appState.currentUser.name)}</span>
        <span class="user-role">${appState.currentUser.role}</span>
      </div>
    `;
  }
  
  const adminPanelBtn = document.getElementById('adminPanelBtn');
  if (adminPanelBtn) {
    adminPanelBtn.style.display = appState.currentUser.role === 'admin' ? 'inline-block' : 'none';
  }
  
  document.title = `MHM Project Tracker - ${appState.currentUser.name}`;
}

function logout() {
  if (confirm('Are you sure you want to logout?')) {
    utils.saveToStorage();
    auth.logout();
    
    appState.currentUser = null;
    appState.isLoggedIn = false;
    
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('usernameInput').value = '';
    document.getElementById('passwordInput').value = '';
    
    showNotification('Logged out successfully', 'info');
  }
}

// Project management functions
function addNewProject() {
  appState.editingProject = null;
  openProjectModal();
}

function openProjectModal() {
  const modal = document.getElementById('projectModal');
  const title = document.getElementById('modalTitle');
  
  title.textContent = appState.editingProject ? 'Edit Project' : 'New Project';
  
  if (appState.editingProject) {
    populateForm(appState.editingProject);
  } else {
    clearForm();
  }
  
  updateAllDropdowns();
  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('projectModal').classList.add('hidden');
  appState.editingProject = null;
}

function saveProject(event) {
  event.preventDefault();
  
  const title = document.getElementById('projectTitle').value.trim();
  if (!title) {
    showNotification('Project title is required', 'error');
    return;
  }
  
  const project = {
    id: appState.editingProject?.id || utils.generateId(),
    title: title,
    client: document.getElementById('projectClient').value.trim(),
    editor: document.getElementById('projectEditor').value,
    platform: document.getElementById('projectPlatform').value,
    channel: document.getElementById('projectChannel').value,
    priority: document.getElementById('projectPriority').value,
    stage: document.getElementById('projectStage').value || 'uploaded',
    dueDate: document.getElementById('projectDue').value,
    uploadDate: document.getElementById('projectUpload').value,
    color: document.getElementById('projectColor').value,
    notes: document.getElementById('projectNotes').value.trim(),
    checklist: appState.editingProject?.checklist || [],
    timeline: appState.editingProject?.timeline || {},
    lastModified: Date.now()
  };
  
  if (appState.editingProject) {
    const index = appState.projects.findIndex(p => p.id === appState.editingProject.id);
    if (index >= 0) {
      appState.projects[index] = project;
    }
  } else {
    appState.projects.push(project);
  }
  
  utils.saveToStorage();
  renderBoard();
  updateStats();
  updateAllDropdowns();
  closeModal();
  
  showNotification(`Project ${appState.editingProject ? 'updated' : 'created'} successfully`, 'success');
}

function editProject(projectId) {
  appState.editingProject = appState.projects.find(p => p.id === projectId);
  if (appState.editingProject) {
    openProjectModal();
  }
}

function deleteProject(projectId) {
  const project = appState.projects.find(p => p.id === projectId);
  if (!project) return;
  
  if (confirm(`Delete "${project.title}"?`)) {
    appState.projects = appState.projects.filter(p => p.id !== projectId);
    appState.trash.push({ ...project, deletedAt: Date.now() });
    
    utils.saveToStorage();
    renderBoard();
    updateStats();
    updateTrashCount();
    
    showNotification('Project moved to trash', 'info');
  }
}

function moveProject(projectId, newStage) {
  const project = appState.projects.find(p => p.id === projectId);
  if (!project) return;
  
  project.stage = newStage;
  project.lastModified = Date.now();
  
  if (!project.timeline) project.timeline = {};
  project.timeline[newStage] = Date.now();
  
  utils.saveToStorage();
  renderBoard();
  updateStats();
  
  showNotification(`Project moved to ${CONFIG.stages.find(s => s.id === newStage)?.name}`, 'success');
}

// UI rendering functions
function renderBoard() {
  const board = document.getElementById('kanbanBoard');
  if (!board) return;
  
  const filteredProjects = getFilteredProjects();
  
  board.innerHTML = CONFIG.stages.map(stage => `
    <div class="column" data-stage="${stage.id}">
      <div class="column-header" style="border-top: 4px solid ${stage.color}">
        <h3>${stage.name}</h3>
        <span class="count">${filteredProjects.filter(p => p.stage === stage.id).length}</span>
      </div>
      <div class="column-content" ondrop="drop(event)" ondragover="allowDrop(event)">
        ${filteredProjects
          .filter(p => p.stage === stage.id)
          .map(project => renderProjectCard(project))
          .join('')}
      </div>
    </div>
  `).join('');
}

function renderProjectCard(project) {
  const daysUntilDue = project.dueDate ? utils.daysBetween(new Date(), project.dueDate) : null;
  const overdue = daysUntilDue !== null && daysUntilDue < 0;
  
  return `
    <div class="card ${project.color || 'teal'} ${project.priority?.toLowerCase()}" 
         draggable="true" 
         ondragstart="drag(event)" 
         data-id="${project.id}">
      <div class="card-header">
        <h4>${escapeHtml(project.title)}</h4>
        <div class="card-actions">
          <button onclick="editProject('${project.id}')" class="btn-icon" title="Edit">✏️</button>
          <button onclick="deleteProject('${project.id}')" class="btn-icon" title="Delete">🗑️</button>
        </div>
      </div>
      ${project.client ? `<div class="card-meta">Client: ${escapeHtml(project.client)}</div>` : ''}
      <div class="card-meta">
        ${project.editor ? `Editor: ${escapeHtml(project.editor)} • ` : ''}
        ${project.platform ? `${escapeHtml(project.platform)}` : ''}
      </div>
      ${project.dueDate ? `<div class="card-due ${overdue ? 'overdue' : ''}">${overdue ? 'Overdue by' : 'Due in'} ${Math.abs(daysUntilDue)} days</div>` : ''}
      ${project.notes ? `<div class="card-notes">${escapeHtml(project.notes.substring(0, 100))}${project.notes.length > 100 ? '...' : ''}</div>` : ''}
    </div>
  `;
}

function getFilteredProjects() {
  let filtered = appState.projects;
  
  const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const editorFilter = document.getElementById('editorFilter')?.value || '';
  const platformFilter = document.getElementById('platformFilter')?.value || '';
  const channelFilter = document.getElementById('channelFilter')?.value || '';
  
  if (searchTerm) {
    filtered = filtered.filter(p => 
      p.title.toLowerCase().includes(searchTerm) ||
      p.client?.toLowerCase().includes(searchTerm) ||
      p.notes?.toLowerCase().includes(searchTerm)
    );
  }
  
  if (editorFilter) {
    filtered = filtered.filter(p => p.editor === editorFilter);
  }
  
  if (platformFilter) {
    filtered = filtered.filter(p => p.platform === platformFilter);
  }
  
  if (channelFilter) {
    filtered = filtered.filter(p => p.channel === channelFilter);
  }
  
  return filtered;
}

function updateStats() {
  const projects = getFilteredProjects();
  const completed = projects.filter(p => p.stage === 'posted');
  
  document.getElementById('totalCount').textContent = projects.length;
  document.getElementById('completedCount').textContent = completed.length;
  
  // Calculate average days for completed projects
  if (completed.length > 0) {
    const avgDays = completed.reduce((sum, project) => {
      if (project.uploadDate && project.timeline?.posted) {
        return sum + utils.daysBetween(project.uploadDate, project.timeline.posted);
      }
      return sum;
    }, 0) / completed.length;
    
    document.getElementById('avgDays').textContent = Math.round(avgDays);
  } else {
    document.getElementById('avgDays').textContent = '-';
  }
}

function updateTrashCount() {
  document.getElementById('trashCount').textContent = appState.trash.length;
}

// Form functions
function clearForm() {
  document.getElementById('projectForm').reset();
  document.getElementById('projectColor').value = 'teal';
}

function populateForm(project) {
  document.getElementById('projectTitle').value = project.title || '';
  document.getElementById('projectClient').value = project.client || '';
  document.getElementById('projectEditor').value = project.editor || '';
  document.getElementById('projectPlatform').value = project.platform || '';
  document.getElementById('projectChannel').value = project.channel || '';
  document.getElementById('projectPriority').value = project.priority || 'MEDIUM';
  document.getElementById('projectDue').value = project.dueDate || '';
  document.getElementById('projectUpload').value = project.uploadDate || '';
  document.getElementById('projectColor').value = project.color || 'teal';
  document.getElementById('projectNotes').value = project.notes || '';
}

function updateAllDropdowns() {
  updateDropdown('projectEditor', appState.editors);
  updateDropdown('projectPlatform', appState.platforms);
  updateDropdown('projectChannel', appState.channels);
  updateDropdown('editorFilter', appState.editors);
  updateDropdown('platformFilter', appState.platforms);
  updateDropdown('channelFilter', appState.channels);

  // Populate Stage dropdown
  const stageSelect = document.getElementById('projectStage');
  if (stageSelect) {
    const currentValue = stageSelect.value;
    stageSelect.innerHTML = '<option value="">Select...</option>';
    CONFIG.stages.forEach(stage => {
      const option = document.createElement('option');
      option.value = stage.id;
      option.textContent = stage.name;
      stageSelect.appendChild(option);
    });
    if (currentValue && CONFIG.stages.find(s => s.id === currentValue)) {
      stageSelect.value = currentValue;
    }
  }

  // Populate Card Color dropdown
  const colorSelect = document.getElementById('projectColor');
  if (colorSelect) {
    const currentValue = colorSelect.value;
    colorSelect.innerHTML = '<option value="">Select...</option>';
    CONFIG.cardColors.forEach(color => {
      const option = document.createElement('option');
      option.value = color.value;
      option.textContent = color.name;
      colorSelect.appendChild(option);
    });
    if (currentValue && CONFIG.cardColors.find(c => c.value === currentValue)) {
      colorSelect.value = currentValue;
    }
  }
}

function updateDropdown(elementId, options) {
  const select = document.getElementById(elementId);
  if (!select) return;
  
  const currentValue = select.value;
  const isFilter = elementId.includes('Filter');
  
  select.innerHTML = isFilter ? '<option value="">All</option>' : '<option value="">Select...</option>';
  
  options.forEach(option => {
    const optionEl = document.createElement('option');
    optionEl.value = option;
    optionEl.textContent = option;
    select.appendChild(optionEl);
  });
  
  if (currentValue && options.includes(currentValue)) {
    select.value = currentValue;
  }
}

// Drag and drop functions
function allowDrop(ev) {
  ev.preventDefault();
}

function drag(ev) {
  ev.dataTransfer.setData("text", ev.target.dataset.id);
}

function drop(ev) {
  ev.preventDefault();
  const projectId = ev.dataTransfer.getData("text");
  const column = ev.target.closest('.column');
  if (column) {
    const newStage = column.dataset.stage;
    moveProject(projectId, newStage);
  }
}

// Utility functions
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function showNotification(message, type = 'info', duration = 3000) {
  // Remove existing notifications
  document.querySelectorAll('.notification').forEach(n => n.remove());
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => notification.classList.add('show'), 100);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

// Data management functions
function exportData() {
  const data = {
    projects: appState.projects,
    trash: appState.trash,
    editors: appState.editors,
    platforms: appState.platforms,
    channels: appState.channels,
    exportDate: new Date().toISOString(),
    version: '3.0'
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mhm-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showNotification('Data exported successfully', 'success');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (confirm('This will replace all current data. Continue?')) {
          if (data.projects) appState.projects = data.projects;
          if (data.trash) appState.trash = data.trash;
          if (data.editors) appState.editors = data.editors;
          if (data.platforms) appState.platforms = data.platforms;
          if (data.channels) appState.channels = data.channels;
          
          utils.saveToStorage();
          renderBoard();
          updateStats();
          updateAllDropdowns();
          updateTrashCount();
          
          showNotification('Data imported successfully', 'success');
        }
      } catch (error) {
        showNotification('Invalid file format', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// Trash management
function openTrash() {
  if (appState.trash.length === 0) {
    showNotification('Trash is empty', 'info');
    return;
  }
  
  const trashHtml = appState.trash.map(project => `
    <div class="trash-item">
      <h4>${escapeHtml(project.title)}</h4>
      <p>Deleted: ${utils.formatDate(project.deletedAt)}</p>
      <div class="trash-actions">
        <button onclick="restoreProject('${project.id}')" class="btn secondary">Restore</button>
        <button onclick="permanentDelete('${project.id}')" class="btn warning">Delete Forever</button>
      </div>
    </div>
  `).join('');
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Trash (${appState.trash.length})</h3>
        <button onclick="this.closest('.modal').remove()" class="modal-close-btn">×</button>
      </div>
      <div class="trash-container">
        ${trashHtml}
      </div>
      <div class="modal-footer">
        <button onclick="emptyTrash()" class="btn warning">Empty Trash</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

function restoreProject(projectId) {
  const projectIndex = appState.trash.findIndex(p => p.id === projectId);
  if (projectIndex >= 0) {
    const project = appState.trash[projectIndex];
    delete project.deletedAt;
    appState.projects.push(project);
    appState.trash.splice(projectIndex, 1);
    
    utils.saveToStorage();
    renderBoard();
    updateStats();
    updateTrashCount();
    
    document.querySelector('.modal')?.remove();
    showNotification('Project restored', 'success');
  }
}

function permanentDelete(projectId) {
  if (confirm('Permanently delete this project? This cannot be undone.')) {
    appState.trash = appState.trash.filter(p => p.id !== projectId);
    utils.saveToStorage();
    updateTrashCount();
    
    document.querySelector('.modal')?.remove();
    showNotification('Project permanently deleted', 'info');
  }
}

function emptyTrash() {
  if (confirm('Permanently delete all trash items? This cannot be undone.')) {
    appState.trash = [];
    utils.saveToStorage();
    updateTrashCount();
    
    document.querySelector('.modal')?.remove();
    showNotification('Trash emptied', 'info');
  }
}

// Management modal
function openManageModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Manage Lists</h3>
        <button onclick="this.closest('.modal').remove()" class="modal-close-btn">×</button>
      </div>
      <div class="manage-grid">
        <div class="manage-section">
          <h4>Editors</h4>
          <div class="manage-list" id="editorsList"></div>
          <div class="add-item">
            <input type="text" id="newEditor" placeholder="Add editor">
            <button onclick="addEditor()">Add</button>
          </div>
        </div>
        <div class="manage-section">
          <h4>Platforms</h4>
          <div class="manage-list" id="platformsList"></div>
          <div class="add-item">
            <input type="text" id="newPlatform" placeholder="Add platform">
            <button onclick="addPlatform()">Add</button>
          </div>
        </div>
        <div class="manage-section">
          <h4>Channels</h4>
          <div class="manage-list" id="channelsList"></div>
          <div class="add-item">
            <input type="text" id="newChannel" placeholder="Add channel">
            <button onclick="addChannel()">Add</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  renderManageLists();
}

function renderManageLists() {
  renderManageList('editorsList', appState.editors, 'removeEditor');
  renderManageList('platformsList', appState.platforms, 'removePlatform');
  renderManageList('channelsList', appState.channels, 'removeChannel');
}

function renderManageList(containerId, items, removeFunction) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = items.map(item => `
    <div class="manage-item">
      <span>${escapeHtml(item)}</span>
      <button onclick="${removeFunction}('${item}')" class="btn-remove">×</button>
    </div>
  `).join('');
}

function addEditor() {
  const input = document.getElementById('newEditor');
  const value = input.value.trim();
  if (value && !appState.editors.includes(value)) {
    appState.editors.push(value);
    input.value = '';
    utils.saveToStorage();
    renderManageLists();
    updateAllDropdowns();
  }
}

function removeEditor(editor) {
  appState.editors = appState.editors.filter(e => e !== editor);
  utils.saveToStorage();
  renderManageLists();
  updateAllDropdowns();
}

function addPlatform() {
  const input = document.getElementById('newPlatform');
  const value = input.value.trim();
  if (value && !appState.platforms.includes(value)) {
    appState.platforms.push(value);
    input.value = '';
    utils.saveToStorage();
    renderManageLists();
    updateAllDropdowns();
  }
}

function removePlatform(platform) {
  appState.platforms = appState.platforms.filter(p => p !== platform);
  utils.saveToStorage();
  renderManageLists();
  updateAllDropdowns();
}

function addChannel() {
  const input = document.getElementById('newChannel');
  const value = input.value.trim();
  if (value && !appState.channels.includes(value)) {
    appState.channels.push(value);
    input.value = '';
    utils.saveToStorage();
    renderManageLists();
    updateAllDropdowns();
  }
}

function removeChannel(channel) {
  appState.channels = appState.channels.filter(c => c !== channel);
  utils.saveToStorage();
  renderManageLists();
  updateAllDropdowns();
}

// Admin panel
async function openAdminPanel() {
  if (appState.currentUser?.role !== 'admin') return;
  
  try {
    const users = await auth.getAllUsers();
    // Ensure we don't duplicate the admin panel modal
    document.getElementById('adminPanelDynamic')?.remove();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'adminPanelDynamic';
    modal.innerHTML = `
    <div class="modal-content large">
      <div class="modal-header">
        <h3>Admin Panel</h3>
        <button onclick="this.closest('.modal').remove()" class="modal-close-btn">×</button>
      </div>
      <div class="modal-body">
        <div class="admin-section">
          <h4><span class="section-icon">👥</span> Users</h4>
          <div class="users-list">
            ${users.map(user => `
              <div class="user-row">
                <div class="user-info">
                  <div class="user-name">${escapeHtml(user.name)}</div>
                  <div class="user-details">@${user.username} • ${user.role}</div>
                </div>
                ${user.username !== 'admin' ? 
                  `<button onclick="deleteUser('${user.username}')" class="btn-delete">Delete</button>` : ''
                }
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="admin-section">
          <h4><span class="section-icon">➕</span> Add New User</h4>
          <div class="add-user-form">
            <div class="form-row">
              <div class="form-group">
                <label>Username</label>
                <input type="text" id="newUsername" placeholder="e.g., editor_jane">
              </div>
              <div class="form-group">
                <label>Display Name</label>
                <input type="text" id="newUserName" placeholder="e.g., Jane Doe">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Password</label>
                <input type="password" id="newUserPassword" placeholder="Enter password">
              </div>
              <div class="form-group">
                <label>Role</label>
                <select id="newUserRole" onchange="window.renderChannelAssignment()">
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div id="channelAssignmentContainer"></div>
            <button class="btn primary create-user-btn" onclick="createUser()">Create User</button>
          </div>
        </div>
      </div>
    </div>
  `;
// Render channel assignment checkboxes for editors in admin panel
window.renderChannelAssignment = function() {
  const modal = document.getElementById('adminPanelDynamic');
  if (!modal) return;
  const role = modal.querySelector('#newUserRole')?.value;
  const container = modal.querySelector('#channelAssignmentContainer');
  if (!container) return;
  if (role === 'admin') {
    container.innerHTML = '';
    return;
  }
  // Get channels from appState or fallback
  const channels = (window.appState?.channels && Array.isArray(window.appState.channels)) ? window.appState.channels : ["Main Brand", "Clips Channel", "Client Channel"];
  container.innerHTML = `
    <div class="channel-assignment">
      <label>Assign Channels</label>
      <div class="channel-checkboxes">
        ${channels.map(ch => `
          <label class="channel-checkbox">
            <input type="checkbox" class="channel-assign-checkbox" value="${escapeHtml(ch)}">
            <span>${escapeHtml(ch)}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `;
}
  
  document.body.appendChild(modal);
  renderChannelAssignment();
  } catch (error) {
    showNotification('Failed to load users: ' + error.message, 'error');
  }
}

async function createUser() {
  const modal = document.getElementById('adminPanelDynamic') || document;
  const usernameEl = modal.querySelector('#newUsername');
  const nameEl = modal.querySelector('#newUserName');
  const passwordEl = modal.querySelector('#newUserPassword');
  const roleEl = modal.querySelector('#newUserRole');

  const username = (usernameEl?.value || '').trim();
  const name = (nameEl?.value || '').trim();
  const password = (passwordEl?.value || '').trim();
  const role = roleEl?.value || '';

  // Gather assigned channels for editors
  let assignedChannels = [];
  if (role === 'editor') {
    assignedChannels = Array.from(modal.querySelectorAll('.channel-assign-checkbox:checked')).map(cb => cb.value);
  } else if (role === 'admin') {
    // Admins get all channels
    assignedChannels = (window.appState?.channels && Array.isArray(window.appState.channels)) ? window.appState.channels : ["Main Brand", "Clips Channel", "Client Channel"];
  }
  
  console.log('Create user values:', { username, name, password: password ? '***' : '', role });
  
  if (!username || !name || !password) {
    console.log('Validation failed:', { username: !!username, name: !!name, password: !!password });
    // Highlight missing fields
    if (usernameEl && !username) usernameEl.classList.add('input-error');
    if (nameEl && !name) nameEl.classList.add('input-error');
    if (passwordEl && !password) passwordEl.classList.add('input-error');
    // Remove highlight when user starts typing
    [usernameEl, nameEl, passwordEl].forEach(el => el && el.addEventListener('input', () => el.classList.remove('input-error'), { once: true }));
    showNotification('All fields are required', 'error');
    return;
  }
  
  try {
    await auth.createUser(username, password, name, role, assignedChannels);
    showNotification('User created successfully and synced globally', 'success');
    // Clear the form
    if (usernameEl) usernameEl.value = '';
    if (nameEl) nameEl.value = '';
    if (passwordEl) passwordEl.value = '';
    if (roleEl) roleEl.value = 'editor';
    // Uncheck all channel checkboxes
    Array.from(modal.querySelectorAll('.channel-assign-checkbox')).forEach(cb => { cb.checked = false; });
    // Refresh the admin panel to show the new user
    document.getElementById('adminPanelDynamic')?.remove();
    openAdminPanel();
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

async function deleteUser(username) {
  if (confirm(`Delete user "${username}"?`)) {
    try {
      await auth.deleteUser(username);
      showNotification('User deleted successfully', 'success');
      document.getElementById('adminPanelDynamic')?.remove();
      openAdminPanel();
    } catch (error) {
      showNotification(error.message, 'error');
    }
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Check for existing session
  const session = auth.getCurrentSession();
  if (session) {
    appState.currentUser = session;
    appState.isLoggedIn = true;
    
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    
    updateUserDisplay();
    initializeApp();
  }
  
  // Add Enter key support for login
  document.getElementById('passwordInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      checkPassword();
    }
  });
  
  // Add search and filter event listeners
  document.getElementById('searchInput')?.addEventListener('input', utils.debounce(renderBoard, 300));
  document.getElementById('editorFilter')?.addEventListener('change', renderBoard);
  document.getElementById('platformFilter')?.addEventListener('change', renderBoard);
  document.getElementById('channelFilter')?.addEventListener('change', renderBoard);
  
  // Auto-save
  setInterval(() => {
    if (appState.isLoggedIn) {
      utils.saveToStorage();
    }
  }, CONFIG.autoSaveInterval);
});

// Initialize app after login
function initializeApp() {
  utils.loadFromStorage();
  renderBoard();
  updateStats();
  updateAllDropdowns();
  updateTrashCount();
}

// Make functions globally available
window.checkPassword = checkPassword;
window.logout = logout;
window.addNewProject = addNewProject;
window.editProject = editProject;
window.deleteProject = deleteProject;
window.saveProject = saveProject;
window.closeModal = closeModal;
window.allowDrop = allowDrop;
window.drag = drag;
window.drop = drop;
window.exportData = exportData;
window.importData = importData;
window.openTrash = openTrash;
window.openManageModal = openManageModal;
window.openAdminPanel = openAdminPanel;
window.restoreProject = restoreProject;
window.permanentDelete = permanentDelete;
window.emptyTrash = emptyTrash;
window.addEditor = addEditor;
window.removeEditor = removeEditor;
window.addPlatform = addPlatform;
window.removePlatform = removePlatform;
window.addChannel = addChannel;
window.removeChannel = removeChannel;
window.createUser = createUser;
window.deleteUser = deleteUser;