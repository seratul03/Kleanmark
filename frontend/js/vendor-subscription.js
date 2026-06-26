requireAuth();

async function loadPlans() {
  try {
    const plans = await fetchAPI('/vendors/subscriptions/plans');
    const container = document.getElementById('plansContainer');
    container.innerHTML = '';
    
    if(plans.length === 0) {
        container.innerHTML = '<p>No active subscription plans found.</p>';
        return;
    }

    plans.forEach(plan => {
      const p1 = plan.description_1 ? `<p>✓ ${plan.description_1}</p>` : '';
      const p2 = plan.description_2 ? `<p>✓ ${plan.description_2}</p>` : '';
      const p3 = plan.description_3 ? `<p>✓ ${plan.description_3}</p>` : '';
      
      container.innerHTML += `
        <div class="plan-card">
          <h2>${plan.name}</h2>
          <div class="plan-price">₹${plan.price}</div>
          <p style="color: var(--text-secondary); font-size: 0.875rem;">/ month</p>
          
          <div class="plan-desc">
            ${p1}${p2}${p3}
          </div>
          
          <button class="btn btn-primary" onclick="subscribe('${plan.id}')">Select Plan</button>
        </div>
      `;
    });
  } catch (e) {
    document.getElementById('plansContainer').innerHTML = '<p style="color:red">Failed to load plans.</p>';
  }
}

async function subscribe(planId) {
  if(!confirm('Are you sure you want to subscribe to this plan?')) return;
  
  try {
    const res = await fetchAPI('/vendors/subscriptions/subscribe', {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId })
    });
    
    showToast(res.message, 'success');
    
    // Redirect to dashboard after a short delay
    setTimeout(() => {
        window.location.href = 'vendor-dashboard.html';
    }, 2000);
    
  } catch (e) {
      // Error is handled by fetchAPI toast
  }
}

document.addEventListener('DOMContentLoaded', loadPlans);
