document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Registering...';

  const payload = {
    business_name: document.getElementById('businessName').value,
    owner_name: document.getElementById('ownerName').value,
    email: document.getElementById('email').value,
    category: document.getElementById('category').value,
    address: document.getElementById('address').value,
    password: document.getElementById('password').value,
  };

  try {
    const res = await fetchAPI('/vendors/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    showToast('Registration successful! Redirecting to login...', 'success');
    setTimeout(() => {
      window.location.href = 'vendor-login.html?registered=true';
    }, 2000);
  } catch (error) {
    // Error is handled in api.js
    btn.disabled = false;
    btn.textContent = 'Register Business';
  }
});
