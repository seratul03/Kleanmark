// Check if redirected from registration
if (getQueryParam('registered') === 'true') {
  document.getElementById('registrationMsg').style.display = 'block';
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.textContent = 'Logging in...';

  const payload = {
    email: document.getElementById('email').value,
    password: document.getElementById('password').value,
  };

  try {
    const res = await fetchAPI('/vendors/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    setToken(res.access_token);
    window.location.href = 'vendor-dashboard.html';
  } catch (error) {
    btn.disabled = false;
    btn.textContent = 'Log In';
  }
});
