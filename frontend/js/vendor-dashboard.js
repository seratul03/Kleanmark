// Auth guard — verifies token is still valid before loading anything
(async () => {
  await requireAuth();
  loadDashboard();
})();

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
    
    // Generate Badge Image
    const widgetUrl = `http://127.0.0.1:8000/public/widget/${vendor.id}`;
    document.getElementById('badgeImageContainer').innerHTML = `<img src="${widgetUrl}" alt="Trust Badge" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">`;
    
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
    
    // Load Tickets
    const tickets = await fetchAPI('/vendors/tickets');
    renderTickets(tickets);

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

// ----- Tickets Logic -----
let currentTicketId = null;

function renderTickets(tickets) {
  const container = document.getElementById('ticketsContainer');
  if (!tickets || tickets.length === 0) {
    container.innerHTML = '<p>No feedback tickets at this time.</p>';
    return;
  }
  
  let html = '';
  tickets.forEach(t => {
    const isResolved = t.status === 'resolved';
    html += `
      <div style="background: var(--background); padding: 16px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid ${isResolved ? 'var(--primary)' : 'var(--danger)'}">
        <p><strong>Customer Feedback:</strong> "${t.feedback_text}"</p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
          <span class="badge ${isResolved ? 'badge-success' : 'badge-danger'}">${t.status.toUpperCase()}</span>
          ${isResolved ? `<a href="${t.resolution_image_url}" target="_blank" style="font-size: 0.875rem;">View Proof</a>` : `<button class="btn btn-primary" style="padding: 4px 12px; font-size: 0.875rem; width: auto;" onclick="openResolutionModal('${t.id}')">Resolve Issue</button>`}
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function openResolutionModal(ticketId) {
  currentTicketId = ticketId;
  document.getElementById('resolutionModal').classList.add('active');
}

function closeResolutionModal() {
  currentTicketId = null;
  document.getElementById('resolutionImageInput').value = '';
  document.getElementById('resolutionModal').classList.remove('active');
}

async function submitResolution() {
  if (!currentTicketId) return;
  const input = document.getElementById('resolutionImageInput');
  if (!input.files || input.files.length === 0) {
    showToast('Please select a photo.', 'warning');
    return;
  }
  
  try {
    showToast('Uploading proof image...', 'success');
    
    // Upload to /images/upload endpoint using FormData, same as proof images
    const formData = new FormData();
    formData.append('image_type', 'Kitchen'); // Use Kitchen as a stand-in type for resolution images
    formData.append('file', input.files[0]);
    
    const uploadRes = await fetchAPI('/images/upload', {
      method: 'POST',
      body: formData
    });
    
    const realUrl = uploadRes.image_url;
    
    await fetchAPI(`/vendors/tickets/${currentTicketId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution_image_url: realUrl })
    });
    showToast('Ticket resolved! Trust score increased.', 'success');
    closeResolutionModal();
    loadDashboard();
  } catch (error) {}
}

// Page init handled by async IIFE at top of file
