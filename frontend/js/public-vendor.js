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
          document.getElementById('btnCheckInFloating').style.display = 'block';
          document.getElementById('btnCheckInFloating').textContent = 'Check In Now';
        } else {
          document.getElementById('btnCheckInFloating').style.display = 'none'; // admin/vendor viewing
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

    // Render unlocked rewards
    if (data.unlocked_rewards && data.unlocked_rewards.length > 0) {
      let urHtml = '<h4>Unlocked Rewards</h4>';
      data.unlocked_rewards.forEach(r => {
        urHtml += `
          <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span>🎁 ${r.reward_name}</span>
            <button class="btn btn-primary" style="padding: 4px 12px; font-size: 0.875rem; width: auto;" onclick="openPinModal('${r.id}')">Redeem</button>
          </div>
        `;
      });
      document.getElementById('unlockedRewardsContainer').innerHTML = urHtml;
    } else {
      document.getElementById('unlockedRewardsContainer').innerHTML = '';
    }

    renderStars(currentStars, tierMax);

  } catch (error) {
    console.error(error);
  }
}

function renderStars(filled, total) {
  total = Math.max(total, filled);
  const maxUI = 5; // Simpler for mobile
  let html = '<div style="display:flex; align-items:center; width:100%; padding: 8px 0;">';
  
  for (let i = 0; i < Math.min(total, maxUI); i++) {
    const isFilled = i < filled;
    const isGift = (i === Math.min(total, maxUI) - 1);
    
    html += `<div style="
      width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: ${isFilled ? 'var(--primary)' : 'rgba(0,179,126,0.1)'};
      color: ${isFilled ? 'white' : 'var(--primary)'};
      font-size: 1.25rem; font-weight: bold;
      box-shadow: ${isFilled ? 'var(--shadow-sm)' : 'none'};
      z-index: 2;
    ">`;
    html += isGift ? (isFilled ? '🏆' : '🎁') : (isFilled ? '⭐' : i+1);
    html += `</div>`;
    
    // Connecting line
    if (i < Math.min(total, maxUI) - 1) {
      html += `<div style="flex: 1; height: 6px; background: ${isFilled && i < filled - 1 ? 'var(--primary)' : 'rgba(0,179,126,0.2)'}; border-radius: 3px; margin: 0 4px;"></div>`;
    }
  }
  
  if (total > maxUI) html += `<div style="margin-left: 8px; font-weight: 600; color: var(--text-secondary);">+${total - maxUI}</div>`;
  html += '</div>';
  
  document.getElementById('starRow').innerHTML = html;
}

// ----- Anonymous Feedback -----
async function submitFeedback() {
  const text = document.getElementById('feedbackText').value.trim();
  if (!text) {
    showToast("Please enter some feedback.", "warning");
    return;
  }
  
  try {
    await fetchAPI(`/public/vendor/${vendorId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ feedback_text: text })
    });
    showToast("Feedback submitted anonymously. Thank you!", "success");
    document.getElementById('feedbackText').value = '';
  } catch(e) {
    showToast("Failed to submit feedback.", "error");
  }
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
        showToast('🎉 You have unlocked a reward! Check below to redeem.', 'success');
      }, 500);
    }
    
    loadLoyaltyProgress();
  } catch (error) {}
}

// ----- Staff PIN Redemption Modal -----
let pendingRewardId = null;

function openPinModal(rewardId) {
  pendingRewardId = rewardId;
  document.getElementById('staffPinInput').value = '';
  document.getElementById('pinModal').classList.add('active');
}

function closePinModal() {
  pendingRewardId = null;
  document.getElementById('pinModal').classList.remove('active');
}

async function submitStaffPin() {
  if (!pendingRewardId) return;
  const staffPin = document.getElementById('staffPinInput').value;
  if (!staffPin) {
    showToast("Staff PIN is required", "warning");
    return;
  }
  
  try {
    await fetchAPI('/rewards/redeem-pin', {
      method: 'POST',
      body: JSON.stringify({ 
        vendor_id: vendorId, 
        reward_tier_id: pendingRewardId, 
        staff_pin: staffPin 
      })
    });
    showToast("Reward redeemed successfully!", "success");
    closePinModal();
    loadLoyaltyProgress();
  } catch (e) {}
}
