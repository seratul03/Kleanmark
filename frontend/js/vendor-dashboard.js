requireAuth();

const checklistQuestions = {
  "Kitchen Cleanliness": [
    "Kitchen cleaned daily?",
    "Cooking area organized?",
    "Floors clean and dry?",
    "Dustbins covered?"
  ],
  "Staff Hygiene": [
    "Staff wear gloves?",
    "Staff wear apron/uniform?",
    "Staff wear head cover?",
    "Hand wash facility available?"
  ],
  "Food Storage": [
    "Raw food stored separately?",
    "Refrigerator working?",
    "Food stored in closed containers?",
    "Expiry dates checked?"
  ],
  "Packaging Hygiene": [
    "Food packed hygienically?",
    "Packaging materials stored safely?",
    "Disposable items stored properly?"
  ],
  "Water & Cleaning": [
    "Clean drinking water available?",
    "Utensils cleaned properly?",
    "Cleaning materials available?"
  ]
};

const imageTypes = ["Kitchen", "Staff Hygiene", "Storage Area", "Packaging Area", "Shop Front"];
let vendorId = null;

// Tab Navigation
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    
    tab.classList.add('active');
    document.getElementById(tab.dataset.target).classList.add('active');
  });
});

async function loadDashboard() {
  try {
    // Load Vendor Profile
    const vendor = await fetchAPI('/vendors/me');
    vendorId = vendor.id;
    document.getElementById('vendorName').textContent = vendor.business_name;
    document.getElementById('trustScore').textContent = Math.round(vendor.trust_score);
    if (vendor.staff_pin) {
      document.getElementById('staffPinSet').value = vendor.staff_pin;
    }
    
    const badgeVerified = document.getElementById('badgeVerified');
    if (vendor.verified) {
      badgeVerified.textContent = 'Verified';
      badgeVerified.className = 'badge badge-success';
    }
    
    const badgeActive = document.getElementById('badgeActive');
    if (!vendor.active) {
      badgeActive.textContent = 'Inactive - Renewal Needed';
      badgeActive.className = 'badge badge-danger';
    }

    if (vendor.qr_code) {
      document.getElementById('qrContainer').innerHTML = `<img src="${vendor.qr_code}" alt="QR Code" style="max-width: 250px;">`;
    }

    document.getElementById('btnPreviewPublic').onclick = () => {
      window.open(`public-vendor.html?id=${vendor.id}`, '_blank');
    };

    // Load Analytics
    try {
      const analytics = await fetchAPI('/vendors/analytics');
      document.getElementById('statScans').textContent = analytics.total_scans;
      document.getElementById('statCheckins').textContent = analytics.total_checkins;
      document.getElementById('statConv').textContent = `${analytics.conversion_rate}%`;
      document.getElementById('analyticsCard').style.display = 'block';
    } catch (e) {
      console.warn("Analytics not available yet.", e);
    }

    // Load Checklist
    const answers = await fetchAPI('/checklist/my');
    renderChecklist(answers);

    // Load Images
    const images = await fetchAPI('/images/my');
    renderImageSlots(images);

    // Load Reward Tiers (for redemption dropdown)
    // Actually we need to fetch public tiers, but we don't have a public reward list endpoint without vendor id.
    // Let's fetch from public endpoint
    const pub = await fetchAPI(`/public/vendor/${vendor.id}`);
    const select = document.getElementById('redeemTierId');
    select.innerHTML = '<option value="">Select Reward Tier</option>';
    if (pub.reward_tiers) {
      pub.reward_tiers.forEach(tier => {
        const opt = document.createElement('option');
        opt.value = tier.id;
        opt.textContent = `${tier.reward_name} (${tier.required_stars} stars)`;
        select.appendChild(opt);
      });
    }

  } catch (error) {
    console.error(error);
  }
}

function renderChecklist(existingAnswers) {
  const container = document.getElementById('checklistContainer');
  container.innerHTML = '';

  const answerMap = {};
  existingAnswers.forEach(ans => {
    answerMap[`${ans.category}_${ans.question}`] = ans.answer;
  });

  Object.entries(checklistQuestions).forEach(([category, questions], cIdx) => {
    let html = `<div class="checklist-category">
                  <div class="category-header">${category}</div>`;
                  
    questions.forEach((q, qIdx) => {
      const isYes = answerMap[`${category}_${q}`] === true;
      const isNo = answerMap[`${category}_${q}`] === false;
      
      html += `<div class="checklist-item">
                <span>${q}</span>
                <div class="toggle-switch">
                  <label><input type="radio" name="chk_${cIdx}_${qIdx}" value="true" data-cat="${category}" data-q="${q}" ${isYes ? 'checked' : ''} required> Yes</label>
                  <label><input type="radio" name="chk_${cIdx}_${qIdx}" value="false" data-cat="${category}" data-q="${q}" ${isNo ? 'checked' : ''}> No</label>
                </div>
              </div>`;
    });
    
    html += `</div>`;
    container.innerHTML += html;
  });
}

document.getElementById('checklistForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const items = [];
  
  const radios = document.querySelectorAll('input[type="radio"]:checked');
  radios.forEach(r => {
    items.push({
      category: r.dataset.cat,
      question: r.dataset.q,
      answer: r.value === 'true'
    });
  });

  try {
    await fetchAPI('/checklist/submit', {
      method: 'POST',
      body: JSON.stringify({ items })
    });
    showToast('Checklist updated successfully');
    loadDashboard(); // reload to get new score
  } catch (error) {}
});

function renderImageSlots(uploadedImages) {
  const container = document.getElementById('imageSlotsContainer');
  container.innerHTML = '';

  const imgMap = {};
  uploadedImages.forEach(img => {
    imgMap[img.image_type] = img.image_url;
  });

  imageTypes.forEach(type => {
    const url = imgMap[type];
    const previewHtml = url ? `<img src="${url}" class="image-preview">` : `<div class="image-preview">No Image</div>`;
    
    const html = `
      <div class="image-slot">
        ${previewHtml}
        <div class="image-actions">
          <h4 style="margin-bottom: 8px;">${type}</h4>
          <input type="file" id="file_${type.replace(/\s+/g, '')}" accept="image/*" style="display: none;" onchange="uploadImage('${type}', this)">
          <button class="btn btn-outline" style="padding: 6px 12px;" onclick="document.getElementById('file_${type.replace(/\s+/g, '')}').click()">Upload New</button>
        </div>
      </div>
    `;
    container.innerHTML += html;
  });
}

async function uploadImage(type, input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  
  const formData = new FormData();
  formData.append('image_type', type);
  formData.append('file', file);

  try {
    showToast('Uploading...', 'success');
    await fetchAPI('/images/upload', {
      method: 'POST',
      body: formData
    });
    showToast('Image uploaded successfully');
    loadDashboard(); // reload score and preview
  } catch (error) {}
}

async function generateQR() {
  try {
    const res = await fetchAPI('/qr/generate');
    document.getElementById('qrContainer').innerHTML = `<img src="${res.qr_code}" alt="QR Code" style="max-width: 250px;">`;
  } catch (error) {}
}

document.getElementById('redeemForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const payload = {
    customer_email: document.getElementById('redeemEmail').value,
    reward_tier_id: document.getElementById('redeemTierId').value
  };

  try {
    const res = await fetchAPI('/rewards/redeem', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    showToast(res.message);
    document.getElementById('redeemForm').reset();
  } catch (error) {}
});

document.getElementById('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const payload = {
    staff_pin: document.getElementById('staffPinSet').value
  };

  try {
    await fetchAPI('/vendors/me', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    showToast("Settings saved successfully!", "success");
  } catch (error) {}
});

loadDashboard();
