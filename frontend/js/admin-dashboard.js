// Auth guard — verifies token is still valid before loading anything
(async () => {
  await requireAuth();
  loadDashboard();
})();

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
  loadSummary();
  loadVendors();
  loadFraud();
  loadRewards();
  loadSubscriptions();
  loadPendingImages();
}

async function loadSummary() {
  try {
    const data = await fetchAPI('/admin/reports/summary');
    
    const grid = document.getElementById('statsGrid');
    grid.innerHTML = `
      <div class="stat-card">
        <div class="stat-title">Total Vendors</div>
        <div class="stat-value">${data.total_vendors}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Avg Trust Score</div>
        <div class="stat-value">${data.avg_trust_score}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Total Check-ins</div>
        <div class="stat-value">${data.total_visits}</div>
      </div>
      <div class="stat-card" style="border-color: var(--danger)">
        <div class="stat-title">Active Fraud Flags</div>
        <div class="stat-value" style="color: var(--danger)">${data.active_fraud_flags}</div>
      </div>
    `;
  } catch (e) {}
}

async function loadVendors() {
  try {
    const vendors = await fetchAPI('/admin/vendors');
    const tbody = document.getElementById('vendorTableBody');
    tbody.innerHTML = '';
    
    vendors.forEach(v => {
      const statusBadge = v.verified 
        ? (v.active ? '<span class="badge badge-success">Verified Active</span>' : '<span class="badge badge-danger">Inactive</span>')
        : '<span class="badge badge-warning">Pending</span>';
        
      tbody.innerHTML += `
        <tr>
          <td>
            <strong>${v.business_name}</strong><br>
            <span style="font-size:0.75rem; color: var(--text-secondary)">${v.category}</span>
          </td>
          <td>${Math.round(v.trust_score)}</td>
          <td>${statusBadge}</td>
          <td>
            ${!v.verified ? `<button class="action-btn" onclick="approveVendor('${v.id}')">Approve</button>` : ''}
            ${v.active ? `<button class="action-btn" onclick="deactivateVendor('${v.id}')">Deactivate</button>` : ''}
            <button class="action-btn" onclick="window.open('public-vendor.html?id=${v.id}', '_blank')">View</button>
          </td>
        </tr>
      `;
    });
  } catch (e) {}
}

async function loadFraud() {
  try {
    const flags = await fetchAPI('/admin/fraud-flags');
    const tbody = document.getElementById('fraudTableBody');
    tbody.innerHTML = '';
    
    flags.forEach(f => {
      // Supabase nested relation object or null check
      const email = f.customers ? f.customers.email : 'Unknown';
      const vName = f.vendors ? f.vendors.business_name : 'Unknown';
      
      const actionHtml = f.resolved 
        ? `<span class="badge badge-success">Resolved</span>` 
        : `<button class="action-btn" onclick="resolveFraud('${f.id}')">Mark Resolved</button>`;

      tbody.innerHTML += `
        <tr style="opacity: ${f.resolved ? '0.5' : '1'}">
          <td>${new Date(f.flagged_at).toLocaleDateString()}</td>
          <td>${email}</td>
          <td>${vName}</td>
          <td>${f.reason}</td>
          <td>${actionHtml}</td>
        </tr>
      `;
    });
  } catch (e) {}
}

async function loadRewards() {
  try {
    const tiers = await fetchAPI('/admin/rewards/tiers');
    // Tiers are available but there's no display UI currently — data is ready for future use
  } catch (e) {}
}

// Actions
async function approveVendor(id) {
  if(!confirm('Approve this vendor?')) return;
  await fetchAPI(`/admin/vendors/${id}/approve`, { method: 'PUT' });
  loadVendors();
}

async function deactivateVendor(id) {
  if(!confirm('Deactivate this vendor?')) return;
  await fetchAPI(`/admin/vendors/${id}/deactivate`, { method: 'PUT' });
  loadVendors();
}

async function resolveFraud(id) {
  await fetchAPI(`/admin/fraud-flags/${id}/resolve`, { method: 'PUT' });
  loadFraud();
  loadSummary();
}

async function runFreshness() {
  if(!confirm('Run monthly freshness check? This will flag inactive vendors.')) return;
  try {
    const res = await fetchAPI('/admin/run-freshness-check', { method: 'POST' });
    showToast(`Success. Flagged ${res.flagged_vendors_count} vendors.`, 'success');
    loadVendors();
  } catch (e) {}
}

document.getElementById('rewardForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    reward_name: document.getElementById('rName').value,
    required_stars: parseInt(document.getElementById('rStars').value),
    active: true
  };
  try {
    await fetchAPI('/admin/rewards/tiers', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Reward tier added', 'success');
    document.getElementById('rewardForm').reset();
    // loadRewards(); // reload
  } catch (e) {}
});

// -- SUBSCRIPTIONS --
async function loadSubscriptions() {
  try {
    const plans = await fetchAPI('/admin/subscriptions/plans');
    const tbody = document.getElementById('subscriptionsTableBody');
    tbody.innerHTML = '';
    
    plans.forEach(p => {
      tbody.innerHTML += `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td><input type="number" id="price_${p.id}" value="${p.price}" class="form-control" style="width: 80px;"></td>
          <td><input type="text" id="desc1_${p.id}" value="${p.description_1 || ''}" class="form-control"></td>
          <td><input type="text" id="desc2_${p.id}" value="${p.description_2 || ''}" class="form-control"></td>
          <td><input type="text" id="desc3_${p.id}" value="${p.description_3 || ''}" class="form-control"></td>
          <td>
            <button class="btn btn-primary" style="padding: 4px 8px; font-size: 12px; width: auto;" onclick="saveSubscription('${p.id}')">Save</button>
          </td>
        </tr>
      `;
    });
  } catch (e) {}
}

async function saveSubscription(id) {
  const payload = {
    price: parseFloat(document.getElementById(`price_${id}`).value),
    description_1: document.getElementById(`desc1_${id}`).value,
    description_2: document.getElementById(`desc2_${id}`).value,
    description_3: document.getElementById(`desc3_${id}`).value,
  };
  try {
    await fetchAPI(`/admin/subscriptions/plans/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    showToast('Subscription updated', 'success');
  } catch(e) {}
}

// -- IMAGE REVIEW --
async function loadPendingImages() {
  try {
    const images = await fetchAPI('/admin/images/pending');
    const tbody = document.getElementById('imagesTableBody');
    tbody.innerHTML = '';
    
    images.forEach(img => {
      const vendorName = img.vendors ? img.vendors.business_name : 'Unknown';
      tbody.innerHTML += `
        <tr>
          <td><strong>${vendorName}</strong></td>
          <td>${img.image_type}</td>
          <td><a href="${img.image_url}" target="_blank"><img src="${img.image_url}" style="height: 60px; border-radius: 4px;"></a></td>
          <td><input type="number" id="score_${img.id}" min="0" max="5" value="0" class="form-control" style="width: 60px;"></td>
          <td>
            <button class="btn btn-primary" style="padding: 4px 8px; font-size: 12px; width: auto;" onclick="scoreImage('${img.id}')">Submit Score</button>
          </td>
        </tr>
      `;
    });
  } catch (e) {}
}

async function scoreImage(id) {
  const scoreVal = parseInt(document.getElementById(`score_${id}`).value);
  if(isNaN(scoreVal) || scoreVal < 0 || scoreVal > 5) {
    alert("Score must be between 0 and 5");
    return;
  }
  
  try {
    const res = await fetchAPI(`/admin/images/${id}/score`, { method: 'PUT', body: JSON.stringify({ score: scoreVal }) });
    showToast(`Image scored! New Trust Score: ${res.new_trust_score}`, 'success');
    loadPendingImages();
  } catch(e) {}
}

// Page init handled by async IIFE at top of file
