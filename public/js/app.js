const tsScript = document.createElement('script');
tsScript.src = '/js/timestudy.js';
document.head.appendChild(tsScript);

const etScript = document.createElement('script');
etScript.src = '/js/efficiency.js';
document.head.appendChild(etScript);

const ltScript = document.createElement('script');
ltScript.src = '/js/losstime.js';
document.head.appendChild(ltScript);

const bnScript = document.createElement('script');
bnScript.src = '/js/bottleneck.js';
document.head.appendChild(bnScript);

const dbScript = document.createElement('script');
dbScript.src = '/js/dashboard.js';
document.head.appendChild(dbScript);

const obScript = document.createElement('script');
obScript.src = '/js/ob.js';
document.head.appendChild(obScript);

const user = JSON.parse(localStorage.getItem('user'));
const token = localStorage.getItem('token');


if (!user || !token) {
  window.location.href = '/';
}

document.getElementById('user-name').textContent = user?.name || 'User';
document.getElementById('user-avatar').textContent = (user?.name || 'U')[0].toUpperCase();

const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');
const sidebarClose = document.getElementById('sidebar-close');
const overlay = document.getElementById('sidebar-overlay');

menuBtn.addEventListener('click', () => {
  sidebar.classList.add('open');
  overlay.classList.add('show');
});

const closeSidebar = () => {
  sidebar.classList.remove('open');
  overlay.classList.remove('show');
};

sidebarClose.addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = '/';
});

const navItems = document.querySelectorAll('.nav-item');
const contentArea = document.getElementById('content-area');
const topbarTitle = document.getElementById('topbar-title');

const pageTitles = {
  'products': 'Products',
  'time-study': 'Time study',
  'operation-bulletin': 'Operation bulletin',
  'line-balancing': 'Bottleneck Identification',
  'efficiency': 'Efficiency tracker',
  'loss-time': 'Loss time monitor',
  'reports': 'Reports & summary',
  'dashboard': 'Dashboard'
};

navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    const page = item.dataset.page;
    topbarTitle.textContent = pageTitles[page] || page;
    closeSidebar();
if (page === 'products') {
  loadProducts();
} else if (page === 'time-study') {
  setTimeout(() => loadTimeStudy(), 50);
} else if (page === 'operation-bulletin') {
  setTimeout(() => loadOB(), 50);
} else if (page === 'efficiency') {
  setTimeout(() => loadEfficiency(), 50);
} else if (page === 'loss-time') {
  setTimeout(() => loadLossTime(), 50);
} else if (page === 'line-balancing') {
  setTimeout(() => loadBottleneck(), 50);
} else if (page === 'dashboard') {
  setTimeout(() => loadDashboard(), 50);
}
 else {
  contentArea.innerHTML = `
    <div class="coming-soon">
      <i class="ti ti-tools"></i>
      <h2>${pageTitles[page]}</h2>
      <p>This module is coming soon.</p>
    </div>`;
}
  });
});

async function loadProducts() {
  topbarTitle.textContent = 'Products';
  contentArea.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <div>
        <h2 style="font-family:'Space Grotesk',sans-serif; font-size:18px; font-weight:500; color:var(--text);">Products</h2>
        <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">Manage your styles and products.</p>
      </div>
      <button id="add-product-btn" style="display:flex; align-items:center; gap:6px; background:var(--teal); border:none; color:#fff; padding:8px 14px; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer;">
        <i class="ti ti-plus"></i> Add product
      </button>
    </div>
    <div id="products-list">
      <div class="coming-soon"><i class="ti ti-loader"></i><p>Loading products...</p></div>
    </div>
    <div id="product-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:200; align-items:center; justify-content:center;">
      <div style="background:#0d2020; border:0.5px solid var(--teal-border); border-radius:16px; padding:28px; width:100%; max-width:480px; margin:16px; max-height:90vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h3 id="modal-title" style="font-family:'Space Grotesk',sans-serif; font-size:16px; font-weight:500;">Add product</h3>
          <button id="modal-close" style="background:none; border:none; color:var(--text-muted); font-size:20px; cursor:pointer;"><i class="ti ti-x"></i></button>
        </div>
        <form id="product-form">
          <input type="hidden" id="product-id" />
          ${productFormFields()}
          <div style="display:flex; gap:10px; margin-top:20px;">
            <button type="submit" style="flex:1; padding:10px; background:var(--teal); border:none; border-radius:8px; color:#fff; font-size:13px; font-weight:500; cursor:pointer;">Save product</button>
            <button type="button" id="cancel-btn" style="padding:10px 16px; background:none; border:0.5px solid var(--border); border-radius:8px; color:var(--text-muted); font-size:13px; cursor:pointer;">Cancel</button>
          </div>
          <p id="product-msg" style="font-size:12px; color:#5DCAA5; text-align:center; margin-top:10px;"></p>
        </form>
      </div>
    </div>`;

  await fetchAndRenderProducts();

  document.getElementById('add-product-btn').addEventListener('click', () => openModal());
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('cancel-btn').addEventListener('click', closeModal);
  document.getElementById('product-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('product-modal')) closeModal();
  });

  document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('product-modal');

  if (e.key === 'Escape' && modal.style.display === 'flex') {
    closeModal();
  }
});

  document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('product-id').value;
    const body = {
      product_number: document.getElementById('f-product-number').value.trim(),
      product_name: document.getElementById('f-product-name').value.trim(),
      product_type: document.getElementById('f-product-type').value,
      process_type: document.getElementById('f-process-type').value,
      process_model: document.getElementById('f-process-model').value,
      expected_cost: document.getElementById('f-expected-cost').value || null,
      status: document.getElementById('f-status').value
    };
    const url = id ? `/api/products/${id}` : '/api/products';
    const method = id ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        document.getElementById('product-msg').textContent = data.message;
        document.getElementById('product-msg').style.color = '#F09995';
        return;
      }
      closeModal();
      await fetchAndRenderProducts();
    } catch (err) {
      document.getElementById('product-msg').textContent = 'Server error.';
    }
  });
}

function productFormFields(p = {}) {
  const inp = (id, label, type='text', placeholder='', val='') => `
    <div style="margin-bottom:14px;">
      <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:5px;">${label}</label>
      <input id="${id}" type="${type}" placeholder="${placeholder}" value="${val}"
        style="width:100%; padding:9px 12px; background:#060f0f; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:13px; outline:none; font-family:'Inter',sans-serif;" />
    </div>`;
  const sel = (id, label, options, val='') => `
    <div style="margin-bottom:14px;">
      <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:5px;">${label}</label>
      <select id="${id}" style="width:100%; padding:9px 12px; background:#060f0f; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:13px; outline:none; font-family:'Inter',sans-serif;">
        ${options.map(o => `<option value="${o.v}" ${val===o.v?'selected':''}>${o.l}</option>`).join('')}
      </select>
    </div>`;
  return `
    ${inp('f-product-number', 'Product / Style number *', 'text', 'e.g. JS-2024-001', p.product_number||'')}
    ${inp('f-product-name', 'Product name *', 'text', 'e.g. Men\'s casual shirt', p.product_name||'')}
    ${sel('f-product-type', 'Product type', [
  {v:'',l:'Select type'},
  {v:'tshirt',l:'T-Shirt'},
  {v:'shirt',l:'Shirt'},
  {v:'hoodie',l:'Hoodie'},
  {v:'pants',l:'Pants'},
  {v:'shorts',l:'Shorts'},
  {v:'sofa-cover',l:'Sofa cover'},
  {v:'bag',l:'Bag'},
  {v:'shoe',l:'Shoe'},
  {v:'furniture',l:'Furniture'},
  {v:'electronics',l:'Electronics'},
  {v:'packaging',l:'Packaging'},
  {v:'medical',l:'Medical product'},
  {v:'automotive',l:'Automotive'},
  {v:'other',l:'Other'}
], p.product_type||'')}
    ${sel('f-process-type', 'Process type', [
      {v:'',l:'Select process'},{v:'sewing',l:'Sewing'},{v:'cutting',l:'Cutting'},
      {v:'finishing',l:'Finishing'},{v:'other',l:'Other'}
    ], p.process_type||'')}
    ${sel('f-process-model', 'Process model', [
  {v:'',l:'Select model'},
  {v:'incentive-roll',l:'Incentive roll'},
  {v:'company-roll',l:'Company roll'},
  {v:'technician-roll',l:'Technician roll'}
], p.process_model||'')}
    ${inp('f-expected-cost', 'Expected cost per piece (₹)', 'number', '0.00', p.expected_cost||'')}
    ${sel('f-status', 'Status', [
      {v:'active',l:'Active'},{v:'on-hold',l:'On hold'},{v:'completed',l:'Completed'},{v:'archived',l:'Archived'}
    ], p.status||'active')}`;
}

async function fetchAndRenderProducts() {
  try {
    const res = await fetch('/api/products', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const products = await res.json();
    const list = document.getElementById('products-list');
    if (!products.length) {
      list.innerHTML = `
        <div class="coming-soon">
          <i class="ti ti-box"></i>
          <h2>No products yet</h2>
          <p>Click "Add product" to create your first product.</p>
        </div>`;
      return;
    }
    list.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px,1fr)); gap:14px;">
        ${products.map(p => `
          <div class="product-card" data-id="${p.id}" style="background:#0d2020; border:0.5px solid var(--teal-border); border-radius:12px; padding:16px; cursor:pointer; transition:border-color 0.15s;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
              <div>
                <div style="font-size:11px; color:var(--teal-light); letter-spacing:0.05em; margin-bottom:3px;">${p.product_number}</div>
                <div style="font-size:14px; font-weight:500; color:var(--text);">${p.product_name}</div>
              </div>
              <span style="font-size:10px; padding:3px 8px; border-radius:20px; background:${p.status==='active'?'rgba(29,158,117,0.15)':'rgba(255,255,255,0.05)'}; color:${p.status==='active'?'#5DCAA5':'var(--text-muted)'}; border:0.5px solid ${p.status==='active'?'var(--teal-border)':'var(--border)'};">${p.status}</span>
            </div>
            <div style="display:flex; gap:8px; margin-top:12px;">
              <div style="flex:1; background:#060f0f; border-radius:8px; padding:8px; text-align:center;">
                <div style="font-size:16px; font-weight:500; color:var(--text);">${p.time_study_count}</div>
                <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">Time studies</div>
              </div>
              <div style="flex:1; background:#060f0f; border-radius:8px; padding:8px; text-align:center;">
                <div style="font-size:16px; font-weight:500; color:var(--text);">${p.ob_count}</div>
                <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">OB entries</div>
              </div>
            </div>
            <div style="display:flex; gap:8px; margin-top:10px;">
              <button class="edit-btn" data-id="${p.id}" style="flex:1; padding:7px; background:none; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--teal-light); font-size:12px; cursor:pointer;">
                <i class="ti ti-edit"></i> Edit
              </button>
            </div>
          </div>`).join('')}
      </div>`;

    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const res = await fetch(`/api/products/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const p = await res.json();
        openModal(p);
      });
    });
  } catch (err) {
    document.getElementById('products-list').innerHTML = `<div class="coming-soon"><p>Failed to load products.</p></div>`;
  }
}

function openModal(p = null) {
  const modal = document.getElementById('product-modal');
  document.getElementById('modal-title').textContent = p ? 'Edit product' : 'Add product';
  document.getElementById('product-id').value = p?.id || '';
  document.getElementById('product-form').querySelector('div:nth-child(3)').outerHTML;
  const form = document.getElementById('product-form');
  const submitBtn = form.querySelector('button[type="submit"]');
  const cancelBtn = document.getElementById('cancel-btn');
  form.innerHTML = `
    <input type="hidden" id="product-id" value="${p?.id||''}" />
    ${productFormFields(p || {})}
    <div style="display:flex; gap:10px; margin-top:20px;">
      <button type="submit" style="flex:1; padding:10px; background:var(--teal); border:none; border-radius:8px; color:#fff; font-size:13px; font-weight:500; cursor:pointer;">Save product</button>
      <button type="button" id="cancel-btn" style="padding:10px 16px; background:none; border:0.5px solid var(--border); border-radius:8px; color:var(--text-muted); font-size:13px; cursor:pointer;">Cancel</button>
    </div>
    <p id="product-msg" style="font-size:12px; color:#5DCAA5; text-align:center; margin-top:10px;"></p>`;

  document.getElementById('cancel-btn').addEventListener('click', closeModal);

  form.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('product-id').value;
    const body = {
      product_number: document.getElementById('f-product-number').value.trim(),
      product_name: document.getElementById('f-product-name').value.trim(),
      product_type: document.getElementById('f-product-type').value,
      process_type: document.getElementById('f-process-type').value,
      process_model: document.getElementById('f-process-model').value,
      expected_cost: document.getElementById('f-expected-cost').value || null,
      status: document.getElementById('f-status').value
    };
    const url = id ? `/api/products/${id}` : '/api/products';
    const method = id ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        document.getElementById('product-msg').textContent = data.message;
        document.getElementById('product-msg').style.color = '#F09995';
        return;
      }
      closeModal();
      await fetchAndRenderProducts();
    } catch (err) {
      document.getElementById('product-msg').textContent = 'Server error.';
    }
  };

  modal.style.display = 'flex';
}

function closeModal() {
  document.getElementById('product-modal').style.display = 'none';
}

// Auto-load dashboard on startup
const dashNav = document.querySelector('.nav-item[data-page="dashboard"]');
if (dashNav) {
  dashNav.classList.add('active');
  topbarTitle.textContent = 'Dashboard';
  setTimeout(() => loadDashboard(), 300);
}