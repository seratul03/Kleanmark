// admin/js/main.js

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadDashboardStats();
  
  // Setup forms
  const rewardForm = document.getElementById('rewardForm');
  if (rewardForm) {
    rewardForm.addEventListener('submit', handleAddRewardTier);
  }

  const addVendorForm = document.getElementById('addVendorForm');
  if (addVendorForm) {
    addVendorForm.addEventListener('submit', addVendorSubmit);
  }
});

// --- Tabs Logic ---
function initTabs() {
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const pageTitle = document.getElementById('pageTitle');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remove active from all
      navItems.forEach(n => n.classList.remove('active'));
      tabPanes.forEach(t => t.classList.remove('active'));

      // Add active to clicked
      item.classList.add('active');
      const targetId = item.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active');
      
      // Update Title
      pageTitle.textContent = item.textContent;

      // Load data based on tab
      if (targetId === 'dashboard') loadDashboardStats();
      if (targetId === 'vendors') loadVendors();
      if (targetId === 'verifications') loadVerifications();
      if (targetId === 'fraud') loadFraudFlags();
      if (targetId === 'rewards') loadRewards();
      if (targetId === 'subscriptions') {
        loadSubscriptions();
        loadSubscribers();
      }
      if (targetId === 'images') loadPendingImages();
      if (targetId === 'logs') loadLogs();
    });
  });
}

// --- Dashboard Stats ---
async function loadDashboardStats() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/dashboard/analytics`, {
      headers: getAuthHeaders()
    });
    if (res.status === 401 || res.status === 403) {
      logout();
      return;
    }
    if (!res.ok) throw new Error('Failed to fetch stats');
    const data = await res.json();

    const container = document.getElementById('statsContainer');
    container.innerHTML = `
      <div class="card stat-card">
        <div class="stat-title">Total Vendors</div>
        <div class="stat-value">${data.total_vendors}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-title">Active Plans</div>
        <div class="stat-value">${data.active_plans_count}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-title">Monthly Revenue</div>
        <div class="stat-value">₹${data.monthly_revenue.toFixed(2)}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-title">Verification Queue</div>
        <div class="stat-value">${data.verification_queue_count}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-title">Avg Trust Score</div>
        <div class="stat-value">${data.avg_trust_score.toFixed(1)}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-title">Active Fraud Flags</div>
        <div class="stat-value" style="color: ${data.active_fraud_flags > 0 ? 'var(--danger)' : 'var(--primary-color)'}">${data.active_fraud_flags}</div>
      </div>
    `;
  } catch (err) {
    console.error(err);
  }
}

// --- Vendors ---
async function loadVendors() {
  const tbody = document.getElementById('vendorTableBody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>';
  
  try {
    const res = await fetch(`${API_BASE_URL}/admin/vendors`, { headers: getAuthHeaders() });
    if (res.status === 401 || res.status === 403) {
      logout();
      return;
    }
    if (!res.ok) throw new Error('Failed to fetch vendors');
    const vendors = await res.json();

    tbody.innerHTML = '';
    if (vendors.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No vendors found.</td></tr>';
      return;
    }

    vendors.forEach(v => {
      const statusBadge = v.active 
        ? `<span class="badge badge-success">Active</span>` 
        : `<span class="badge badge-danger">Inactive</span>`;
      const verifiedBadge = v.verified 
        ? `<span class="badge badge-success">Verified</span>` 
        : `<span class="badge badge-warning">Pending</span>`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="font-weight: 500;">${v.business_name}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${verifiedBadge}</div>
        </td>
        <td>${v.category || 'N/A'}</td>
        <td><strong>${v.trust_score}</strong></td>
        <td>${statusBadge}</td>
        <td>
          <div class="table-actions">
            ${!v.verified ? `<button class="btn btn-sm btn-success" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="approveVendor('${v.id}')">Approve</button>` : ''}
            ${v.active ? `<button class="btn btn-sm btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="openSuspendModal('${v.id}')">Suspend</button>` : `<button class="btn btn-sm btn-success" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="reactivateVendor('${v.id}')">Activate</button>`}
            <button class="btn btn-sm btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="openVendorModal('${v.id}', '${v.business_name}', ${v.trust_score})">Details</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--danger);">Error loading vendors</td></tr>';
  }
}

async function approveVendor(id) {
  if (!confirm('Are you sure you want to approve this vendor?')) return;
  try {
    await fetch(`${API_BASE_URL}/admin/vendors/${id}/approve`, { method: 'PUT', headers: getAuthHeaders() });
    loadVendors();
  } catch (err) {
    alert('Failed to approve vendor');
  }
}

async function reactivateVendor(id) {
  if (!confirm('Reactivate this vendor?')) return;
  try {
    await fetch(`${API_BASE_URL}/admin/vendors/${id}`, { 
      method: 'PUT', 
      headers: getAuthHeaders(),
      body: JSON.stringify({ active: true })
    });
    loadVendors();
  } catch (err) {
    alert('Failed to reactivate vendor');
  }
}

function openAddVendorModal() {
  document.getElementById('addVendorForm').reset();
  document.getElementById('addVendorModal').classList.add('active');
}

async function addVendorSubmit(e) {
  e.preventDefault();
  const payload = {
    business_name: document.getElementById('avBusinessName').value,
    owner_name: document.getElementById('avOwnerName').value,
    email: document.getElementById('avEmail').value,
    password: document.getElementById('avPassword').value,
    category: document.getElementById('avCategory').value
  };

  try {
    const res = await fetch(`${API_BASE_URL}/admin/vendors`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert('Vendor created');
      closeModal('addVendorModal');
      loadVendors();
    } else {
      throw new Error();
    }
  } catch (err) {
    alert('Failed to create vendor');
  }
}

function openSuspendModal(id) {
  document.getElementById('svId').value = id;
  document.getElementById('svReason').value = '';
  document.getElementById('suspendVendorModal').classList.add('active');
}

async function suspendVendorSubmit() {
  const id = document.getElementById('svId').value;
  const reason = document.getElementById('svReason').value;
  if (!reason) {
    alert('Please provide a reason');
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE_URL}/admin/vendors/${id}/suspend`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason })
    });
    if (res.ok) {
      alert('Vendor suspended');
      closeModal('suspendVendorModal');
      loadVendors();
    } else {
      throw new Error();
    }
  } catch (err) {
    alert('Failed to suspend vendor');
  }
}

// --- Vendor Modal ---
async function openVendorModal(id, name, score) {
  document.getElementById('vmTitle').textContent = name;
  document.getElementById('vmVendorId').value = id;
  document.getElementById('vmScoreInput').value = score;
  
  const imgContainer = document.getElementById('vmImages');
  imgContainer.innerHTML = 'Loading images...';
  
  document.getElementById('vendorModal').classList.add('active');

  try {
    const res = await fetch(`${API_BASE_URL}/admin/images/${id}`, { headers: getAuthHeaders() });
    const images = await res.json();
    
    if (images && images.length > 0) {
      imgContainer.innerHTML = images.map(img => `
        <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); overflow: hidden;">
          <div style="padding: 0.25rem 0.5rem; background: #F1F5F9; font-size: 0.75rem; font-weight: 500;">${img.image_type}</div>
          <img src="${img.image_url}" alt="${img.image_type}" style="width: 100%; height: auto; display: block; max-height: 200px; object-fit: contain; background: #000;">
        </div>
      `).join('');
    } else {
      imgContainer.innerHTML = '<p style="grid-column: 1 / -1; color: var(--text-muted);">No images found for this vendor.</p>';
    }
  } catch (err) {
    imgContainer.innerHTML = '<p style="color: var(--danger);">Failed to load images.</p>';
  }
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

async function updateTrustScore() {
  const id = document.getElementById('vmVendorId').value;
  const newScore = parseFloat(document.getElementById('vmScoreInput').value);
  
  try {
    const res = await fetch(`${API_BASE_URL}/admin/vendors/${id}/trust-override`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ trust_score: newScore })
    });
    if (res.ok) {
      alert('Trust score updated successfully');
      loadVendors();
      closeModal('vendorModal');
    } else {
      throw new Error();
    }
  } catch (err) {
    alert('Failed to update trust score');
  }
}

// --- Verifications Queue ---
async function loadVerifications() {
  const tbody = document.getElementById('verificationTableBody');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';
  
  try {
    const res = await fetch(`${API_BASE_URL}/admin/verifications/pending`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error();
    const vendors = await res.json();

    tbody.innerHTML = '';
    if (vendors.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No pending verifications.</td></tr>';
      return;
    }

    vendors.forEach(v => {
      const checklistCount = v.checklist ? v.checklist.length : 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><div style="font-weight: 500;">${v.business_name}</div><div style="font-size:0.75rem; color: var(--text-muted);">${v.owner_name}</div></td>
        <td>${v.category || 'N/A'}</td>
        <td>${checklistCount} answers</td>
        <td>
          <button class="btn btn-sm btn-success" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="approveVendor('${v.id}'); loadVerifications()">Approve</button>
          <button class="btn btn-sm btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="openVendorModal('${v.id}', '${v.business_name}', ${v.trust_score})">View Images</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--danger);">Error loading queue</td></tr>';
  }
}

// --- Fraud Flags ---
async function loadFraudFlags() {
  const tbody = document.getElementById('fraudTableBody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>';
  
  try {
    const res = await fetch(`${API_BASE_URL}/admin/fraud-flags`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error();
    const flags = await res.json();

    tbody.innerHTML = '';
    if (flags.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No fraud flags found.</td></tr>';
      return;
    }

    flags.forEach(f => {
      const customerEmail = f.customers ? f.customers.email : 'Unknown';
      const vendorName = f.vendors ? f.vendors.business_name : 'Unknown';
      
      const tr = document.createElement('tr');
      tr.style.opacity = f.resolved ? '0.6' : '1';
      tr.innerHTML = `
        <td>${new Date(f.flagged_at).toLocaleDateString()}</td>
        <td>${customerEmail}</td>
        <td>${vendorName}</td>
        <td>${f.reason}</td>
        <td>
          ${!f.resolved 
            ? `<button class="btn btn-sm btn-primary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="resolveFraud('${f.id}')">Mark Resolved</button>` 
            : `<span class="badge badge-neutral">Resolved</span>`
          }
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--danger);">Error loading fraud flags</td></tr>';
  }
}

async function resolveFraud(id) {
  if (!confirm('Mark this flag as resolved?')) return;
  try {
    await fetch(`${API_BASE_URL}/admin/fraud-flags/${id}/resolve`, { method: 'PUT', headers: getAuthHeaders() });
    loadFraudFlags();
  } catch (err) {
    alert('Failed to resolve flag');
  }
}

// --- Rewards ---
async function handleAddRewardTier(e) {
  e.preventDefault();
  const name = document.getElementById('rName').value;
  const stars = parseInt(document.getElementById('rStars').value, 10);
  
  try {
    const res = await fetch(`${API_BASE_URL}/admin/rewards/tiers`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ required_stars: stars, reward_name: name })
    });
    if (res.ok) {
      alert('Reward tier added successfully!');
      document.getElementById('rName').value = '';
      document.getElementById('rStars').value = '';
    } else {
      throw new Error();
    }
  } catch (err) {
    alert('Failed to add reward tier');
  }
}

async function loadRewards() {
  const tbody = document.getElementById('rewardTableBody');
  tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading...</td></tr>';
  try {
    const res = await fetch(`${API_BASE_URL}/admin/rewards/tiers`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error();
    const tiers = await res.json();
    tbody.innerHTML = '';
    if (tiers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No reward tiers found.</td></tr>';
      return;
    }
    tiers.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${t.reward_name}</td>
        <td>${t.required_stars}</td>
        <td>
          <button class="btn btn-sm btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="deleteReward('${t.id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch(err) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--danger)">Error loading rewards</td></tr>';
  }
}

async function deleteReward(id) {
  if(!confirm('Delete this reward tier?')) return;
  try {
    const res = await fetch(`${API_BASE_URL}/admin/rewards/tiers/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    if(res.ok) loadRewards();
  } catch(err) {
    alert('Failed to delete');
  }
}

// --- Subscriptions ---
async function loadSubscribers() {
  const tbody = document.getElementById('subscribersTableBody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading...</td></tr>';
  try {
    const res = await fetch(`${API_BASE_URL}/admin/subscriptions/active`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error();
    const subs = await res.json();
    tbody.innerHTML = '';
    if(subs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No active subscriptions found.</td></tr>';
        return;
    }
    subs.forEach(s => {
      const vendorName = s.vendors ? s.vendors.business_name : 'Unknown';
      const email = s.vendors ? s.vendors.email : '';
      tbody.innerHTML += `
        <tr>
          <td><strong>${vendorName}</strong></td>
          <td>${email}</td>
          <td><span class="badge badge-success">${s.plan_name}</span></td>
          <td>₹${s.amount}</td>
          <td>${new Date(s.start_date).toLocaleDateString()}</td>
          <td>
            ${email ? `<a href="mailto:${email}" class="btn btn-sm btn-primary">Email Vendor</a>` : ''}
          </td>
        </tr>
      `;
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--danger)">Error loading subscribers</td></tr>';
  }
}

async function loadSubscriptions() {
  const tbody = document.getElementById('subscriptionsTableBody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading...</td></tr>';
  try {
    const res = await fetch(`${API_BASE_URL}/admin/subscriptions/plans`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error();
    const plans = await res.json();
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
            <button class="btn btn-sm btn-primary" onclick="saveSubscription('${p.id}')">Save</button>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--danger)">Error loading plans</td></tr>';
  }
}

async function saveSubscription(id) {
  const payload = {
    price: parseFloat(document.getElementById(`price_${id}`).value),
    description_1: document.getElementById(`desc1_${id}`).value,
    description_2: document.getElementById(`desc2_${id}`).value,
    description_3: document.getElementById(`desc3_${id}`).value,
  };
  try {
    const res = await fetch(`${API_BASE_URL}/admin/subscriptions/plans/${id}`, { 
      method: 'PUT', 
      headers: getAuthHeaders(),
      body: JSON.stringify(payload) 
    });
    if(res.ok) alert('Subscription updated successfully');
  } catch(e) {
    alert('Failed to update subscription');
  }
}

// --- Image Review ---
async function loadPendingImages() {
  const tbody = document.getElementById('imagesTableBody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>';
  try {
    const res = await fetch(`${API_BASE_URL}/admin/images/pending`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error();
    const images = await res.json();
    tbody.innerHTML = '';
    if(images.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No pending images.</td></tr>';
        return;
    }
    images.forEach(img => {
      const vendorName = img.vendors ? img.vendors.business_name : 'Unknown';
      tbody.innerHTML += `
        <tr>
          <td><strong>${vendorName}</strong></td>
          <td>${img.image_type}</td>
          <td><a href="${img.image_url}" target="_blank"><img src="${img.image_url}" style="height: 60px; border-radius: 4px; object-fit: contain;"></a></td>
          <td><input type="number" id="score_${img.id}" min="0" max="5" value="0" class="form-control" style="width: 60px;"></td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="scoreImage('${img.id}')">Submit Score</button>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--danger)">Error loading images</td></tr>';
  }
}

async function scoreImage(id) {
  const scoreVal = parseInt(document.getElementById(`score_${id}`).value);
  if(isNaN(scoreVal) || scoreVal < 0 || scoreVal > 5) {
    alert("Score must be between 0 and 5");
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/admin/images/${id}/score`, { 
      method: 'PUT', 
      headers: getAuthHeaders(),
      body: JSON.stringify({ score: scoreVal }) 
    });
    if(res.ok) {
        alert('Image scored!');
        loadPendingImages();
    }
  } catch(e) {
      alert('Failed to score image');
  }
}

// --- Logs ---
async function loadLogs() {
  const tbody = document.getElementById('logsTableBody');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';
  try {
    const res = await fetch(`${API_BASE_URL}/admin/logs`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error();
    const logs = await res.json();
    tbody.innerHTML = '';
    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No logs found.</td></tr>';
      return;
    }
    logs.forEach(l => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(l.created_at).toLocaleString()}</td>
        <td>${l.admin_username}</td>
        <td><span class="badge badge-neutral">${l.action}</span></td>
        <td style="font-size: 0.875rem;">${l.details || ''} <br><small style="color:var(--text-muted)">${l.target_id || ''}</small></td>
      `;
      tbody.appendChild(tr);
    });
  } catch(err) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--danger)">Error loading logs</td></tr>';
  }
}

// --- System (Freshness) ---
async function triggerFreshnessCheck() {
  const btn = document.getElementById('freshnessBtn');
  const resText = document.getElementById('freshnessResult');
  
  btn.disabled = true;
  btn.textContent = 'Running...';
  resText.textContent = '';
  resText.style.color = 'var(--text-main)';

  try {
    const res = await fetch(`${API_BASE_URL}/admin/run-freshness-check`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    
    resText.textContent = `Success: ${JSON.stringify(data)}`;
    resText.style.color = 'var(--success)';
  } catch (err) {
    resText.textContent = 'Failed to execute freshness check.';
    resText.style.color = 'var(--danger)';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Execute Freshness Check';
  }
}
