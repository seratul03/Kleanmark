// admin/js/auth.js
const API_BASE_URL = 'http://localhost:8000'; // Default local API url

// Check if already logged in (for login page)
if (window.location.pathname.includes('login.html')) {
  const token = localStorage.getItem('adminToken');
  if (token) {
    window.location.href = 'index.html';
  }
}

// Handle Login Form Submit
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const usernameInput = document.getElementById('username').value;
    const passwordInput = document.getElementById('password').value;
    const errorDiv = document.getElementById('errorMessage');
    const submitBtn = loginForm.querySelector('button[type="submit"]');

    errorDiv.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: usernameInput,
          password: passwordInput
        })
      });

      if (!response.ok) {
        throw new Error('Invalid credentials');
      }

      const data = await response.json();
      localStorage.setItem('adminToken', data.access_token);
      
      // Redirect to dashboard
      window.location.href = 'index.html';
      
    } catch (err) {
      errorDiv.textContent = err.message || 'An error occurred during login';
      errorDiv.style.display = 'flex';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });
}

// Utility to get auth headers for API calls
function getAuthHeaders() {
  const token = localStorage.getItem('adminToken');
  if (!token) {
    logout();
    throw new Error("No token found");
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// Global logout function
window.logout = function() {
  localStorage.removeItem('adminToken');
  window.location.href = 'login.html';
};

// Check auth on protected pages
function requireAuth() {
  const token = localStorage.getItem('adminToken');
  if (!token && !window.location.pathname.includes('login.html')) {
    window.location.href = 'login.html';
  }
}

// Call on load for non-login pages
if (!window.location.pathname.includes('login.html')) {
  requireAuth();
}
