// Debug Script for MHM Project Tracker
// Paste this into the browser console to debug user issues

console.log('🔧 MHM Project Tracker Debug Script');
console.log('=====================================');

// Check if auth system is loaded
if (typeof auth === 'undefined') {
  console.error('❌ Auth system not loaded!');
} else {
  console.log('✅ Auth system loaded');
  
  // Check current users
  console.log('📋 Current users:', Object.keys(auth.users));
  
  // Check localStorage
  const storedUsers = localStorage.getItem('mhm-tracker-users');
  console.log('💾 Stored custom users:', storedUsers);
  
  // Check session
  const session = localStorage.getItem('mhm-tracker-session');
  console.log('🔑 Current session:', session);
  
  // Test creating a user manually
  window.debugCreateUser = function(username, password, name, role = 'editor') {
    console.log(`🧪 Testing user creation: ${username}`);
    try {
      // First check if logged in as admin
      const currentSession = auth.getCurrentSession();
      if (!currentSession) {
        console.error('❌ Not logged in. Login as admin first.');
        return false;
      }
      
      if (currentSession.role !== 'admin') {
        console.error('❌ Not admin. Current role:', currentSession.role);
        return false;
      }
      
      // Try to create user
      const result = auth.createUser(username, password, name, role);
      console.log('✅ User created successfully');
      
      // Check if user exists now
      console.log('📋 Users after creation:', Object.keys(auth.users));
      
      // Check storage
      const storedAfter = localStorage.getItem('mhm-tracker-users');
      console.log('💾 Storage after creation:', storedAfter);
      
      return true;
    } catch (error) {
      console.error('❌ User creation failed:', error.message);
      return false;
    }
  };
  
  // Test login function
  window.debugLogin = function(username, password) {
    console.log(`🧪 Testing login: ${username}`);
    try {
      const result = auth.login(username, password);
      console.log('✅ Login successful:', result);
      return true;
    } catch (error) {
      console.error('❌ Login failed:', error.message);
      return false;
    }
  };
  
  // Clear all data function
  window.debugClearAll = function() {
    console.log('🗑️ Clearing all localStorage data...');
    localStorage.removeItem('mhm-tracker-users');
    localStorage.removeItem('mhm-tracker-session');
    localStorage.removeItem('mhm-tracker-data');
    console.log('✅ All data cleared. Refresh the page.');
  };
  
  console.log('🎯 Available debug functions:');
  console.log('  debugCreateUser("username", "password", "Display Name", "role")');
  console.log('  debugLogin("username", "password")');
  console.log('  debugClearAll()');
  console.log('');
  console.log('📖 Quick test steps:');
  console.log('1. Login as admin (admin/admin123)');
  console.log('2. Run: debugCreateUser("testuser", "test123", "Test User")');
  console.log('3. Logout and try: debugLogin("testuser", "test123")');
}