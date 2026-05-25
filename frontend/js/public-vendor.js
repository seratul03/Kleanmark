const vendorId = getQueryParam('id');
let currentStars = 0;

if (!vendorId) {
  document.body.innerHTML = '<h2 style="text-align:center; padding: 40px;">Invalid QR Code / Vendor ID missing</h2>';
} else {
  loadPublicPage();
}

async function loadPublicPage() {
  try {
    const data = await fetchAPI(`/public/vendor/${vendorId}`);
    const v = data.vendor;

    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';

    if (!v.active) {
      document.getElementById('warningBanner').style.display = 'block';
      document.getElementById('vVerified').textContent = '⚠️ Inactive';
      document.getElementById('vVerified').style.background = 'rgba(229, 62, 62, 0.1)';
      document.getElementById('vVerified').style.color = 'var(--danger)';
    }

    document.getElementById('vName').textContent = v.business_name;
    document.getElementById('vCategory').textContent = `${v.category} • ${v.address}`;
    
    // Trust Score Anim
    animateScore('vScore', v.trust_score);
    
    const sCircle = document.getElementById('scoreCircle');
    const sLabel = document.getElementById('vLabel');
    sLabel.textContent = data.trust_level;

    if (v.trust_score >= 90) { sCircle.style.borderColor = '#00B37E'; sLabel.style.background = '#00B37E'; }
    else if (v.trust_score >= 70) { sCircle.style.borderColor = '#38A169'; sLabel.style.background = '#38A169'; }
    else if (v.trust_score >= 50) { sCircle.style.borderColor = '#F6AD55'; sLabel.style.background = '#F6AD55'; }
    else { sCircle.style.borderColor = '#E53E3E'; sLabel.style.background = '#E53E3E'; }

    const lastUpdated = v.last_checklist_at ? new Date(v.last_checklist_at).toLocaleDateString() : 'Never';
    document.getElementById('vLastUpdated').textContent = `Last updated: ${lastUpdated}`;

    // Images
    const gal = document.getElementById('vGallery');
    Object.keys(data.images).forEach(type => {
      gal.innerHTML += `<img src="${data.images[type]}" class="gallery-img" alt="${type}">`;
    });

    // Checklist
    const chk = document.getElementById('vChecklist');
    Object.keys(data.checklist_summary).forEach(cat => {
      const summary = data.checklist_summary[cat];
      chk.innerHTML += `
        <div class="check-row">
          <div class="check-row-title">${cat}</div>
          <div class="check-row-score">${summary.yes}/${summary.total} Passed</div>
        </div>
      `;
    });

    // Loyalty Data if logged in as customer
    if (getToken()) {
      // Decode token to see if it's a customer
      try {
        const payload = JSON.parse(atob(getToken().split('.')[1]));
        if (payload.role === 'customer') {
          loadLoyaltyProgress();
          document.getElementById('btnCheckIn').style.display = 'block';
          document.getElementById('btnCheckIn').textContent = 'Check In Now';
        } else {
          document.getElementById('btnCheckIn').style.display = 'none'; // admin/vendor viewing
        }
      } catch (e) {
        removeToken();
      }
    } else {
      renderStars(0, 5); // default mock
    }

  } catch (error) {
    document.getElementById('loading').textContent = 'Failed to load vendor profile.';
  }
}

function animateScore(id, target) {
  let start = 0;
  const dur = 1000;
  const stepTime = Math.abs(Math.floor(dur / target));
  const obj = document.getElementById(id);
  const timer = setInterval(() => {
    start += 1;
    obj.textContent = start;
    if (start >= target) {
      clearInterval(timer);
      obj.textContent = Math.round(target);
    }
  }, stepTime);
}

async function loadLoyaltyProgress() {
  try {
    const data = await fetchAPI(`/loyalty/progress?vendorId=${vendorId}`);
    currentStars = data.stars;
    document.getElementById('lStars').textContent = currentStars;
    
    if (data.next_reward_name) {
      document.getElementById('loyaltyProgressText').textContent = `${data.stars_needed} more visits to unlock: 🎁 ${data.next_reward_name}`;
    } else {
      document.getElementById('loyaltyProgressText').textContent = `All rewards unlocked!`;
    }

    // Determine total stars needed for next tier to render empty stars
    let tierMax = 5;
    if (data.all_tiers && data.all_tiers.length > 0) {
      for (let t of data.all_tiers) {
        if (currentStars < t.required_stars) {
          tierMax = t.required_stars;
          break;
        }
      }
      if (currentStars >= data.all_tiers[data.all_tiers.length-1].required_stars) {
        tierMax = currentStars; // reached max
      }
    }

    renderStars(currentStars, tierMax);

  } catch (error) {
    console.error(error);
  }
}

function renderStars(filled, total) {
  // If filled > total, adjust total
  total = Math.max(total, filled);
  // Cap at 10 for UI layout sanity, maybe use a wrap
  const maxUI = 10;
  let html = '';
  for (let i = 0; i < Math.min(total, maxUI); i++) {
    if (i < filled) html += '⭐';
    else html += '⚪';
  }
  if (total > maxUI) html += ` +${total - maxUI}`;
  document.getElementById('starRow').innerHTML = html;
}

// ----- Check In Modal -----

function openCheckInModal() {
  if (getToken()) {
    // Already have customer token, try direct check-in
    performCheckIn();
  } else {
    document.getElementById('otpModal').classList.add('active');
  }
}

function closeCheckInModal() {
  document.getElementById('otpModal').classList.remove('active');
}

async function requestOTP() {
  const email = document.getElementById('cEmail').value;
  if(!email) return;

  try {
    await fetchAPI('/otp/send', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    
    document.getElementById('stepPhone').style.display = 'none';
    document.getElementById('stepOTP').style.display = 'block';
    
    // For dev ease, auto fetch the OTP and fill it
    setTimeout(async () => {
      try {
        const res = await fetchAPI(`/otp/dev-peek?email=${email}`);
        document.getElementById('cOTP').value = res.otp;
        showToast(`Auto-filled Mock OTP: ${res.otp}`, 'success');
      } catch (e) {}
    }, 1000);

  } catch (error) {}
}

async function verifyOTP() {
  const email = document.getElementById('cEmail').value;
  const otp = document.getElementById('cOTP').value;
  
  try {
    const res = await fetchAPI('/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email, otp })
    });
    
    setToken(res.access_token);
    closeCheckInModal();
    
    // Now perform checkin
    performCheckIn();
  } catch (error) {}
}

async function performCheckIn() {
  try {
    showToast('Checking in...');
    const res = await fetchAPI('/checkin/', {
      method: 'POST',
      body: JSON.stringify({ vendor_id: vendorId })
    });
    
    showToast('Checked in successfully! +1 Star ⭐', 'success');
    
    if (res.reward_unlocked) {
      setTimeout(() => {
        alert('🎉 Congratulations! You have unlocked a reward! Show this to the vendor to redeem.');
      }, 500);
    }
    
    loadLoyaltyProgress();
  } catch (error) {}
}
