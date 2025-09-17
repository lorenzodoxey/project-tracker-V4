// Quick fix for cross-browser login issues
// This file provides immediate solutions for the login problem

// Enhanced initialization that forces user creation on first load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🔧 Quick Fix: Ensuring user data is available...');
  
  // Wait for security system to load
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (window.SECURITY_CONFIG && window.userManager) {
    // Force load users
    await SECURITY_CONFIG.loadUsers();
    
    // Check if we have the basic users
    const expectedUsers = ['admin', 'mia', 'leo', 'kai'];
    const currentUsers = Object.keys(SECURITY_CONFIG.users);
    
    console.log('👥 Currently loaded users:', currentUsers);
    
    // If missing default users, recreate them
    const missingUsers = expectedUsers.filter(user => !currentUsers.includes(user));
    if (missingUsers.length > 0) {
      console.log('⚠️ Missing default users, recreating...');
      
      // Recreate default users with proper structure
      const defaultPasswords = {
        admin: 'admin123',
        mia: 'mia123',
        leo: 'leo123',
        kai: 'kai123'
      };
      
      for (const username of missingUsers) {
        try {
          const password = defaultPasswords[username];
          const hashedData = await SECURITY_CONFIG.hashPassword(password);
          
          SECURITY_CONFIG.users[username] = {
            hash: hashedData.hash,
            salt: hashedData.salt,
            name: username,
            role: username === 'admin' ? 'admin' : 'editor',
            channels: [],
            active: true,
            isDefault: true,
            created: Date.now()
          };
          
          console.log(`✅ Recreated user: ${username}`);
        } catch (error) {
          console.error(`❌ Failed to recreate user ${username}:`, error);
        }
      }
      
      // Save the recreated users
      await SECURITY_CONFIG.saveUsers();
      console.log('💾 Saved recreated users');
    }
    
    // Add a manual login function for testing
    window.quickLogin = async (username, password) => {
      console.log(`🧪 Quick Login Test: ${username}`);
      
      // Force reload users first
      await SECURITY_CONFIG.loadUsers();
      
      const result = await SECURITY_CONFIG.authenticate(username, password);
      if (result) {
        console.log('✅ Login successful!');
        
        // Manually update UI state
        if (window.appState) {
          window.appState.currentUser = result;
          localStorage.setItem('currentUser', JSON.stringify(result));
          
          // Hide login screen and show main app
          const loginScreen = document.getElementById('loginScreen');
          const mainApp = document.getElementById('mainApp');
          if (loginScreen && mainApp) {
            loginScreen.style.display = 'none';
            mainApp.style.display = 'block';
          }
          
          // Update UI elements
          if (window.updateUI) {
            window.updateUI();
          }
        }
        
        return true;
      } else {
        console.log('❌ Login failed');
        return false;
      }
    };
    
    console.log('🔧 Quick fix loaded! Available functions:');
    console.log('  - quickLogin(username, password) - Test login and auto-login');
    console.log('  - SECURITY_CONFIG.users - View all users');
  }
});