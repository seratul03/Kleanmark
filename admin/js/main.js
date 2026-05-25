// admin/js/main.js

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadDashboardStats();
  
  // Setup forms
  const rewardForm = document.getElementById('rewardForm');
  if (rewardForm) {
    rewardForm.addEventListener('submit', handleAddRewardTier);
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
      if (targetId === 'fraud') loadFraudFlags();
    });
  });
}

// --- Dashboard Stats ---
async function loadDashboardStats() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/reports/summary`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch stats');
    const data = await res.json();

    const container = document.getElementById('statsContainer');
    container.innerHTML = `
      <div class="card stat-card">
        <div class="stat-title">Total Vendors</div>
        <div class="stat-value">${data.total_vendors}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-title">Avg Trust Score</div>
        <div class="stat-value">${data.avg_trust_score.toFixed(1)}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-title">Total Visits</div>
        <div class="stat-value">${data.total_visits}</div>
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
            ${v.active ? `<button class="btn btn-sm btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="deactivateVendor('${v.id}')">Dismiss</button>` : ''}
            <button class="btn btn-sm btn-outline" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="openVendorModal('${v.id}', '${v.business_name}', ${v.trust_score})">View Details</button>
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

async function deactivateVendor(id) {
  if (!confirm('Are you sure you want to dismiss (deactivate) this vendor?')) return;
  try {
    await fetch(`${API_BASE_URL}/admin/vendors/${id}/deactivate`, { method: 'PUT', headers: getAuthHeaders() });
    loadVendors();
  } catch (err) {
    alert('Failed to deactivate vendor');
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
