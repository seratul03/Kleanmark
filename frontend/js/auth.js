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
  removeToken();
  window.location.href = 'vendor-login.html';
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
