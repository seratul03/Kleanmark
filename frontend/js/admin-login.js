document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const payload = {
    username: document.getElementById('username').value,
    password: document.getElementById('password').value,
  };

  try {
    const res = await fetchAPI('/admin/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    setToken(res.access_token);
    window.location.href = 'admin-dashboard.html';
  } catch (error) {}
});
