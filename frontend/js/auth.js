function setToken(token) {
  localStorage.setItem('token', token);
}

function getToken() {
  return localStorage.getItem('token');
}

function removeToken() {
  localStorage.removeItem('token');
}

function isAuthenticated() {
  return !!getToken();
}

function logout() {
  // Determine where to redirect based on current page
  const isAdminPage = window.location.pathname.includes('admin');
  removeToken();
  window.location.href = isAdminPage ? 'admin-login.html' : 'vendor-login.html';
}

/**
 * requireAuth — verifies the token is still valid with the server.
 * If the token is expired or revoked, clears localStorage and redirects to login.
 * Protected pages should call: requireAuth().catch(() => {});
 */
async function requireAuth() {
  if (!getToken()) {
    window.location.href = 'vendor-login.html';
    return;
  }

  try {
    await fetchAPI('/vendors/me');
  } catch (error) {
    // Token is invalid or revoked — wipe it and redirect
    removeToken();
    window.location.href = 'vendor-login.html';
  }
}

/**
 * requireAdminAuth — verifies the admin token is still valid.
 * Validates against /admin/me instead of /vendors/me.
 */
async function requireAdminAuth() {
  if (!getToken()) {
    window.location.href = 'admin-login.html';
    return;
  }

  try {
    await fetchAPI('/admin/me');
  } catch (error) {
    // Token is invalid or expired — wipe it and redirect to admin login
    removeToken();
    window.location.href = 'admin-login.html';
  }
}
