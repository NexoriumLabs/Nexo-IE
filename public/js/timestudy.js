const tsToken = localStorage.getItem('token');
const tsUser = JSON.parse(localStorage.getItem('user'));

let tsState = {
  view: 'list',
  products: [],
  expandedProduct: null,
  operations: {},
  selectedProduct: null,
  selectedOperation: null,
  newOperations: [],
};

let timerState = {
  running: false,
  held: false,
  startTime: null,
  elapsed: 0,
  holdStart: null,
  totalHeld: 0,
  motions: [],
  currentMotionStart: 0,
  interval: null,
  cycleNumber: 1,
  // update mode
  updateMode: false,
  selectedMotionIndices: [],  // indices into motions array in selection order
  currentUpdateIndex: 0       // which selected motion we're currently timing
};

async function loadTimeStudy() {
  // Kill any running timer from previous session
  if (timerState.interval) {
    clearInterval(timerState.interval);
    timerState.interval = null;
  }
  timerState.running = false;
  document.onkeydown = null;

  const content = document.getElementById('content-area');
  content.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <div>
        <h2 style="font-family:'Space Grotesk',sans-serif; font-size:18px; font-weight:500; color:var(--text);">Time study</h2>
        <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">Select a product to view or start a study.</p>
      </div>
      <button onclick="showAddStudyPage()" style="display:flex; align-items:center; gap:6px; background:var(--teal); border:none; color:#fff; padding:8px 14px; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer;">
        <i class="ti ti-plus"></i> New study
      </button>
    </div>
    <div id="ts-product-list">
      <div class="coming-soon"><i class="ti ti-loader"></i><p>Loading products...</p></div>
    </div>`;

  const res = await fetch('/api/timestudy/products', {
    headers: { 'Authorization': `Bearer ${tsToken}` }
  });
  tsState.products = await res.json();
  renderProductAccordion();

  if (tsState.expandedProduct) {
    setTimeout(() => loadOperations(tsState.expandedProduct), 100);
  }
}

function renderProductAccordion() {
  const list = document.getElementById('ts-product-list');
  if (!tsState.products.length) {
    list.innerHTML = `<div class="coming-soon"><i class="ti ti-box"></i><h2>No active products</h2><p>Add a product first from the Products module.</p></div>`;
    return;
  }

  list.innerHTML = `
    <div style="border:0.5px solid var(--teal-border); border-radius:12px; overflow:hidden;">
      <div style="display:grid; grid-template-columns:120px 1fr 100px 100px 100px 80px 32px; gap:0; background:var(--sidebar-bg); border-bottom:0.5px solid var(--border); padding:10px 16px;">
        <span style="font-size:11px; color:var(--text-muted); letter-spacing:0.05em;">PRODUCT NO.</span>
        <span style="font-size:11px; color:var(--text-muted); letter-spacing:0.05em;">NAME</span>
        <span style="font-size:11px; color:var(--text-muted); letter-spacing:0.05em;">TYPE</span>
        <span style="font-size:11px; color:var(--text-muted); letter-spacing:0.05em;">PROCESS</span>
        <span style="font-size:11px; color:var(--text-muted); letter-spacing:0.05em;">STATUS</span>
        <span style="font-size:11px; color:var(--text-muted); letter-spacing:0.05em;">OPS</span>
        <span></span>
      </div>
      ${tsState.products.map((p) => `
        <div class="ts-product-row" id="ts-row-${p.id}" style="border-bottom:0.5px solid var(--border);">
          <div onclick="toggleProduct(${p.id})" style="display:grid; grid-template-columns:120px 1fr 100px 100px 100px 80px 32px; gap:0; padding:12px 16px; cursor:pointer; transition:
background 0.18s ease,
border-color 0.18s ease,
transform 0.18s ease,
box-shadow 0.18s ease; ${tsState.expandedProduct === p.id ? 'background:var(--teal-dim);' : 'background:var(--surface);'}">
            <span style="font-size:12px; color:var(--teal-light); font-weight:500;">${p.product_number}</span>
            <span style="font-size:13px; color:var(--text);">${p.product_name}</span>
            <span style="font-size:12px; color:var(--text-muted);">${p.product_type || '—'}</span>
            <span style="font-size:12px; color:var(--text-muted);">${p.process_type || '—'}</span>
            <span style="font-size:11px; padding:2px 8px; border-radius:20px; background:${p.status === 'active' ? 'rgba(29,158,117,0.15)' : 'rgba(255,255,255,0.05)'}; color:${p.status === 'active' ? 'var(--teal-light)' : 'var(--text-muted)'}; border:0.5px solid ${p.status === 'active' ? 'var(--teal-border)' : 'var(--border)'}; display:inline-block;">${p.status}</span>
            <span style="font-size:13px; color:var(--text);">${p.operation_count}</span>
            <span style="color:var(--text-muted); font-size:16px; transition:transform 0.2s; display:flex; align-items:center; justify-content:center; ${tsState.expandedProduct === p.id ? 'transform:rotate(180deg);' : ''}">
              <i class="ti ti-chevron-down"></i>
            </span>
          </div>
          <div id="ts-ops-${p.id}" style="display:${tsState.expandedProduct === p.id ? 'block' : 'none'}; background:#060f0f; border-top:0.5px solid var(--teal-border); max-height:320px; overflow-y:auto;">
            <div id="ts-ops-content-${p.id}" style="padding:8px 0;">
              <div style="padding:16px; text-align:center; color:var(--text-muted); font-size:13px;">Loading operations...</div>
            </div>
          </div>
        </div>`).join('')}
    </div>`;
}

async function toggleProduct(productId) {
  if (tsState.expandedProduct === productId) {
    tsState.expandedProduct = null;
    renderProductAccordion();
    return;
  }
  tsState.expandedProduct = productId;
  renderProductAccordion();
  await loadOperations(productId);
}

async function loadOperations(productId) {
  const res = await fetch(`/api/timestudy/${productId}/operations`, {
    headers: { 'Authorization': `Bearer ${tsToken}` }
  });
  const ops = await res.json();
  tsState.operations[productId] = ops;
  renderOperations(productId, ops);
}

function renderOperations(productId, ops) {
  const container = document.getElementById(`ts-ops-content-${productId}`);
  if (!container) return;

  if (!ops.length) {
    container.innerHTML = `
      <div style="padding:16px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:13px; color:var(--text-muted);">No operations yet for this product.</span>
        <button onclick="showAddStudyPage(${productId})" style="padding:6px 12px; background:var(--teal); border:none; border-radius:8px; color:#fff; font-size:12px; cursor:pointer;">
          <i class="ti ti-plus"></i> Add operation
        </button>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div style="display:grid; grid-template-columns:60px 1fr 80px 120px 60px 60px 100px 140px; gap:0; background:var(--sidebar-bg); padding:8px 16px; border-bottom:0.5px solid var(--border);">
      <span style="font-size:10px; color:var(--text-muted); letter-spacing:0.05em;">PRIORITY</span>
      <span style="font-size:10px; color:var(--text-muted); letter-spacing:0.05em;">OPERATION</span>
      <span style="font-size:10px; color:var(--text-muted); letter-spacing:0.05em;">FREQ</span>
      <span style="font-size:10px; color:var(--text-muted); letter-spacing:0.05em;">MACHINE</span>
      <span style="font-size:10px; color:var(--text-muted); letter-spacing:0.05em;">M/P</span>
      <span style="font-size:10px; color:var(--text-muted); letter-spacing:0.05em;">CYCLES</span>
      <span style="font-size:10px; color:var(--text-muted); letter-spacing:0.05em;">READINGS</span>
      <span style="font-size:10px; color:var(--text-muted); letter-spacing:0.05em;">ACTION</span>
    </div>
    ${ops.map(op => `
      <div style="display:grid; grid-template-columns:60px 1fr 80px 120px 60px 60px 100px 140px; gap:0; padding:10px 16px; border-bottom:0.5px solid var(--border); align-items:center;" onmouseover="this.style.background='var(--teal-dim)'" onmouseout="this.style.background='var(--surface)'">
        <span style="font-size:13px; color:var(--text-muted);">${op.operation_priority || '—'}</span>
        <span style="font-size:13px; color:var(--text); font-weight:500;">${op.operation_name}</span>
        <span style="font-size:12px; color:var(--text-muted);">${op.operation_frequency || 1}</span>
        <span style="font-size:12px; color:var(--text-muted);">${op.machine_type || '—'}</span>
        <span style="font-size:12px; color:var(--text-muted);">${op.manpower || 1}</span>
        <span style="font-size:12px; color:var(--teal-light); font-weight:500;">${op.cycle_count || 0}</span>
        <span style="font-size:12px; color:var(--text-muted);">${op.reading_count || 0}</span>
        <button onclick="handleOperationClick(${productId}, '${op.operation_id}', ${op.cycle_count || 0}, ${op.reading_count || 0}, '${op.operation_name}', ${op.operation_priority || 1}, ${op.operation_frequency || 1}, '${op.machine_type || ''}', ${op.manpower || 1})"
          style="padding:5px 10px; background:${op.cycle_count > 0 ? 'rgba(55,138,221,0.15)' : 'var(--teal-dim)'}; border:0.5px solid ${op.cycle_count > 0 ? 'rgba(55,138,221,0.3)' : 'var(--teal-border)'}; border-radius:8px; color:${op.cycle_count > 0 ? '#85B7EB' : 'var(--teal-light)'}; font-size:11px; cursor:pointer;">
          ${op.cycle_count > 0 ? '<i class="ti ti-refresh"></i> Update study' : '<i class="ti ti-player-play"></i> Start study'}
        </button>
      </div>`).join('')}
    <div style="padding:10px 16px;">
      <button onclick="showAddStudyPage(${productId})" style="padding:6px 12px; background:none; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--teal-light); font-size:12px; cursor:pointer;">
        <i class="ti ti-plus"></i> Add operation
      </button>
    </div>`;
}

function handleOperationClick(productId, operationId, cycleCount, readingCount, opName, opPriority, opFreq, machineType, manpower) {
  const op = {
    operation_id: operationId,
    operation_name: opName,
    operation_priority: opPriority,
    operation_frequency: opFreq,
    machine_type: machineType,
    manpower: manpower,
    cycle_count: cycleCount,
    reading_count: readingCount,
    product_id: productId
  };
  tsState.selectedOperation = op;
  tsState.selectedProduct = tsState.products.find(p => p.id == productId);

  if (cycleCount > 0) {
    showCycleSelector(productId, operationId, op);
  } else {
    openStudySession(productId, operationId, op, 1, false);
  }
}

function showCycleSelector(productId, operationId, op) {
  tsState.selectedOperation = { ...op, operation_id: operationId, product_id: productId };
  const content = document.getElementById('content-area');
  const cycleCount = parseInt(op.cycle_count) || 0;
  const cycles = Array.from({ length: cycleCount }, (_, i) => i + 1);

  content.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:24px;">
      <button onclick="tsState.operations={}; loadTimeStudy();" style="background:none; border:0.5px solid var(--border); border-radius:8px; padding:6px 10px; color:var(--text-muted); cursor:pointer; font-size:13px;">
        <i class="ti ti-arrow-left"></i> Back
      </button>
      <div>
        <h2 style="font-family:'Space Grotesk',sans-serif; font-size:16px; font-weight:500; color:var(--text);">${op.operation_name}</h2>
        <p style="font-size:11px; color:var(--text-muted);">${tsState.selectedProduct?.product_number || ''} · ${cycleCount} cycle(s) recorded</p>
      </div>
    </div>
    <div style="background:var(--surface); border:0.5px solid var(--teal-border); border-radius:12px; padding:20px; max-width:500px;">
      <p style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">Select a cycle to update, or add a new cycle:</p>
      <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;">
        ${cycles.map(c => `
          <button onclick="selectCycle(${c}, true)" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:#060f0f; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:13px; cursor:pointer; text-align:left; width:100%;">
            <span><i class="ti ti-clock" style="color:var(--teal-light); margin-right:8px;"></i>Cycle ${c}</span>
            <span style="font-size:11px; color:var(--teal-light);"><i class="ti ti-edit"></i> Update</span>
          </button>`).join('')}
      </div>
      <button onclick="selectCycle(${cycleCount + 1}, false)" style="width:100%; padding:10px; background:var(--teal); border:none; border-radius:8px; color:#fff; font-size:13px; font-weight:500; cursor:pointer;">
        <i class="ti ti-plus"></i> Add new cycle (Cycle ${cycleCount + 1})
      </button>
    </div>`;
}

function selectCycle(cycleNum, isUpdate) {
  const op = tsState.selectedOperation;
  openStudySession(op.product_id, op.operation_id, op, cycleNum, isUpdate);
}

function showAddStudyPage(productId = null) {
  tsState.newOperations = [];
  const content = document.getElementById('content-area');
  content.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:24px;">
      <button onclick="tsState.operations={}; loadTimeStudy();" style="background:none; border:0.5px solid var(--border); border-radius:8px; padding:6px 10px; color:var(--text-muted); cursor:pointer; font-size:13px;">
        <i class="ti ti-arrow-left"></i> Back
      </button>
      <h2 style="font-family:'Space Grotesk',sans-serif; font-size:18px; font-weight:500; color:var(--text);">New study setup</h2>
    </div>
    <div style="background:var(--surface); border:0.5px solid var(--teal-border); border-radius:12px; padding:20px; margin-bottom:16px;">
      <label style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:8px;">Select product</label>
      <select id="ts-product-select" onchange="tsSelectProduct(this.value)" style="width:100%; max-width:400px; padding:9px 12px; background:#060f0f; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:13px; outline:none;">
        <option value="">Choose a product...</option>
        ${tsState.products.map(p => `<option value="${p.id}" ${p.id == productId ? 'selected' : ''}>${p.product_number} — ${p.product_name}</option>`).join('')}
      </select>
    </div>
    <div id="ts-ops-builder" style="display:${productId ? 'block' : 'none'};">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="font-size:15px; font-weight:500; color:var(--text);">Operations</h3>
        <button onclick="addOperationRow()" style="padding:6px 12px; background:none; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--teal-light); font-size:12px; cursor:pointer;">
          <i class="ti ti-plus"></i> Add operation
        </button>
      </div>
      <div id="ts-ops-rows"></div>
    </div>`;

  if (productId) {
    tsState.selectedProduct = tsState.products.find(p => p.id == productId);
    document.getElementById('ts-product-select').value = productId;
    addOperationRow();
  }
}

function tsSelectProduct(productId) {
  if (!productId) return;
  tsState.selectedProduct = tsState.products.find(p => p.id == productId);
  document.getElementById('ts-ops-builder').style.display = 'block';
  document.getElementById('ts-ops-rows').innerHTML = '';
  tsState.newOperations = [];
  addOperationRow();
}

let opRowCount = 0;
function addOperationRow() {
  opRowCount++;
  const rowId = `op-row-${opRowCount}`;
  const container = document.getElementById('ts-ops-rows');
  const div = document.createElement('div');
  div.id = rowId;
  div.style.cssText = 'background:var(--surface); border:0.5px solid var(--teal-border); border-radius:12px; padding:16px; margin-bottom:12px;';
  div.innerHTML = `
    <div style="display:grid; grid-template-columns:80px 1fr 80px; gap:12px; margin-bottom:12px;">
      <div>
        <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:5px;">PRIORITY</label>
        <input id="${rowId}-priority" type="number" min="1" placeholder="1"
          style="width:100%; padding:8px; background:#060f0f; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:13px; outline:none;" />
      </div>
      <div>
        <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:5px;">OPERATION NAME</label>
        <input id="${rowId}-name" type="text" placeholder="e.g. Front placket attach"
          style="width:100%; padding:8px; background:#060f0f; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:13px; outline:none;" />
      </div>
      <div>
        <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:5px;">FREQUENCY</label>
        <input id="${rowId}-freq" type="number" min="1" value="1"
          style="width:100%; padding:8px; background:#060f0f; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:13px; outline:none;" />
      </div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
      <div>
        <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:5px;">MACHINE TYPE</label>
        <input id="${rowId}-machine" type="text" placeholder="e.g. Single needle"
          style="width:100%; padding:8px; background:#060f0f; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:13px; outline:none;" />
      </div>
      <div>
        <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:5px;">MANPOWER</label>
        <input id="${rowId}-manpower" type="number" min="1" value="1"
          style="width:100%; padding:8px; background:#060f0f; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:13px; outline:none;" />
      </div>
    </div>
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <span id="${rowId}-msg" style="font-size:12px; color:#F09995;"></span>
      <div style="display:flex; gap:8px;">
        <button onclick="startStudyFromRow('${rowId}')"
          style="padding:7px 14px; background:var(--teal); border:none; border-radius:8px; color:#fff; font-size:12px; cursor:pointer;">
          <i class="ti ti-player-play"></i> Start study
        </button>
        <button onclick="document.getElementById('${rowId}').remove()"
          style="padding:7px; background:none; border:0.5px solid var(--border); border-radius:8px; color:var(--text-muted); font-size:12px; cursor:pointer;">
          <i class="ti ti-trash"></i>
        </button>
      </div>
    </div>`;
  container.appendChild(div);
}

async function startStudyFromRow(rowId) {
  const priority = parseInt(document.getElementById(`${rowId}-priority`).value);
  const name = document.getElementById(`${rowId}-name`).value.trim();
  const freq = parseFloat(document.getElementById(`${rowId}-freq`).value) || 1;
  const machine = document.getElementById(`${rowId}-machine`).value.trim();
  const manpower = parseInt(document.getElementById(`${rowId}-manpower`).value) || 1;
  const msgEl = document.getElementById(`${rowId}-msg`);

  if (!name) { msgEl.textContent = 'Operation name required.'; return; }
  if (!priority) { msgEl.textContent = 'Priority number required.'; return; }

  const productId = document.getElementById('ts-product-select')?.value || tsState.selectedProduct?.id;
  if (!productId) { msgEl.textContent = 'Select a product first.'; return; }
  tsState.selectedProduct = tsState.products.find(p => p.id == productId);

  const existingOps = tsState.operations[productId] || [];
  const conflict = existingOps.find(op => op.operation_priority == priority);

  if (conflict) {
    const choice = confirm(`Priority ${priority} is already used by "${conflict.operation_name}".\n\nOK = Shift existing operations down.\nCancel = Change priority of this new operation.`);
    if (!choice) { msgEl.textContent = 'Please change the priority number.'; return; }
    await fetch('/api/timestudy/shiftpriorities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tsToken}` },
      body: JSON.stringify({ product_id: productId, from_priority: priority })
    });
  }

  const operationId = `op-${productId}-${priority}-${Date.now()}`;
  const op = { operation_name: name, operation_priority: priority, operation_frequency: freq, machine_type: machine, manpower, cycle_count: 0, reading_count: 0, product_id: productId };
  tsState.selectedOperation = { ...op, operation_id: operationId };
  openStudySession(productId, operationId, op, 1, false);
}

// ── CORE STUDY SESSION ────────────────────────────────────────────────────────

function openStudySession(productId, operationId, op, cycleNumber, isUpdate) {
  tsState.selectedProduct = tsState.products.find(p => p.id == productId) || tsState.selectedProduct;
  tsState.selectedOperation = { ...op, operation_id: operationId, product_id: productId };

  // Full reset
  if (timerState.interval) clearInterval(timerState.interval);
  timerState = {
    running: false, held: false,
    startTime: null, elapsed: 0,
    holdStart: null, totalHeld: 0,
    motions: [], currentMotionStart: 0,
    interval: null,
    cycleNumber: cycleNumber || 1,
    updateMode: isUpdate || false,
    selectedMotionIndices: [],
    currentUpdateIndex: 0
  };

  const currentCycle = cycleNumber || 1;
  const content = document.getElementById('content-area');

  content.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
      <button onclick="document.onkeydown=null; if(timerState.interval)clearInterval(timerState.interval); timerState.running=false; timerState.interval=null; tsState.operations={}; loadTimeStudy();" style="background:none; border:0.5px solid var(--border); border-radius:8px; padding:6px 10px; color:var(--text-muted); cursor:pointer; font-size:13px;">
        <i class="ti ti-arrow-left"></i> Back
      </button>
      <div>
        <h2 style="font-family:'Space Grotesk',sans-serif; font-size:16px; font-weight:500; color:var(--text);">${op.operation_name}</h2>
        <p style="font-size:11px; color:var(--text-muted);">${tsState.selectedProduct?.product_number || ''} · Priority ${op.operation_priority} · ${op.machine_type || 'No machine'} · ${op.manpower || 1} operator(s) · <span style="color:var(--teal-light);">Cycle ${currentCycle}</span>${isUpdate ? ' · <span style="color:#f0c040;">Update mode</span>' : ''}</p>
      </div>
    </div>
    <div style="display:grid; grid-template-columns:280px 1fr; gap:16px; align-items:start;">
      <!-- Timer panel -->
      <div style="background:var(--surface); border:0.5px solid var(--teal-border); border-radius:12px; padding:20px; position:sticky; top:70px;">
        <div id="timer-display" style="font-family:'Space Grotesk',sans-serif; font-size:42px; font-weight:600; color:var(--text);
text-shadow:0 0 18px var(--teal-dim); text-align:center; letter-spacing:0.05em; margin-bottom:4px;">00:00.000</div>
        <div id="timer-status" style="font-size:11px; color:var(--text-muted); text-align:center; margin-bottom:20px;">${isUpdate ? 'Select motions to update, then start' : 'Ready to start'}</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
          <button onclick="timerAction('start')" id="btn-start" style="padding:10px; background:var(--teal); border:none; border-radius:8px; color:#fff; font-size:12px; font-weight:500; cursor:pointer;" ${isUpdate ? 'disabled' : ''}>
            <i class="ti ti-player-play"></i> Start
          </button>
          <button onclick="timerAction('lap')" id="btn-lap" style="padding:10px; background:none; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--teal-light); font-size:12px; cursor:pointer;" disabled>
            <i class="ti ti-flag"></i> Lap
          </button>
          <button onclick="timerAction('hold')" id="btn-hold" style="padding:10px; background:none; border:0.5px solid var(--border); border-radius:8px; color:var(--text-muted); font-size:12px; cursor:pointer;" disabled>
            <i class="ti ti-pause"></i> Hold
          </button>
          <button onclick="timerAction('stop')" id="btn-stop" style="padding:10px; background:none; border:0.5px solid rgba(240,153,149,0.3); border-radius:8px; color:#F09995; font-size:12px; cursor:pointer;" disabled>
            <i class="ti ti-player-stop"></i> Stop
          </button>
        </div>
        <div style="background:#060f0f; border-radius:8px; padding:10px; font-size:11px; color:var(--text-muted); line-height:1.8;">
          <div><kbd style="background:var(--surface); padding:1px 5px; border-radius:4px; border:0.5px solid var(--border);">Shift+R</kbd> Start / Resume</div>
          <div><kbd style="background:var(--surface); padding:1px 5px; border-radius:4px; border:0.5px solid var(--border);">Shift+S</kbd> Stop</div>
          <div><kbd style="background:var(--surface); padding:1px 5px; border-radius:4px; border:0.5px solid var(--border);">Shift+Q</kbd> Lap</div>
          <div><kbd style="background:var(--surface); padding:1px 5px; border-radius:4px; border:0.5px solid var(--border);">Shift+Z</kbd> Hold / Resume</div>
        </div>
        ${isUpdate ? `
        <div id="update-mode-hint" style="margin-top:12px; padding:10px; background:rgba(240,192,64,0.08); border:0.5px solid rgba(240,192,64,0.25); border-radius:8px; font-size:11px; color:#f0c040; line-height:1.6;">
          <i class="ti ti-info-circle"></i> Select motions to re-time using the checkboxes. Selected motions move to the top. Start records them in order.
        </div>` : ''}
        <div id="save-study-btn" style="display:none; margin-top:12px;">
          <button onclick="saveStudy()" style="width:100%; padding:10px; background:var(--teal); border:none; border-radius:8px; color:#fff; font-size:13px; font-weight:500; cursor:pointer;">
            <i class="ti ti-device-floppy"></i> Save study
          </button>
        </div>
      </div>
      <!-- Motions panel -->
      <div>
        <div id="motions-header" style="display:grid; grid-template-columns:${isUpdate ? '32px ' : ''}40px 1fr 90px 110px 100px 80px; gap:8px; background:var(--sidebar-bg); padding:8px 12px; border-radius:8px 8px 0 0; border:0.5px solid var(--border);">
          ${isUpdate ? '<span style="font-size:10px; color:var(--text-muted);">SEL</span>' : ''}
          <span style="font-size:10px; color:var(--text-muted);">#</span>
          <span style="font-size:10px; color:var(--text-muted);">MOTION NAME</span>
          <span style="font-size:10px; color:var(--text-muted);">TIME (sec)</span>
          <span style="font-size:10px; color:var(--text-muted);">CATEGORY</span>
          <span style="font-size:10px; color:var(--text-muted);">ALLOWANCE</span>
          <span style="font-size:10px; color:var(--text-muted);">INCLUDE</span>
        </div>
        <div id="motions-list" style="border:0.5px solid var(--border); border-top:none; border-radius:0 0 8px 8px; min-height:200px;">
          <div style="padding:20px; text-align:center; color:var(--text-muted); font-size:13px;">
            ${isUpdate ? 'Loading existing motions...' : 'Start the timer to begin recording motions.'}
          </div>
        </div>
      </div>
    </div>`;

  setupKeyboardShortcuts();

  if (isUpdate) {
    loadMotionsForUpdate(productId, operationId, cycleNumber);
  } else if (cycleNumber && parseInt(op.reading_count) > 0) {
    loadExistingMotions(productId, operationId, cycleNumber);
  }
}

// ── UPDATE MODE ───────────────────────────────────────────────────────────────

async function loadMotionsForUpdate(productId, operationId, cycleNumber) {
  const res = await fetch(`/api/timestudy/${productId}/${operationId}/readings?cycle=${cycleNumber}`, {
    headers: { 'Authorization': `Bearer ${tsToken}` }
  });
  const readings = await res.json();
  if (!readings.length) {
    document.getElementById('motions-list').innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:13px;">No motions found for this cycle.</div>`;
    return;
  }

  // Store all motions in timerState
  timerState.motions = readings.map(r => ({
    motion_name: r.motion_name,
    captured_time_sec: parseFloat(r.captured_time_sec),
    time_category: r.time_category,
    extra_allowance_sec: parseFloat(r.extra_allowance_sec),
    include_in_study: r.include_in_study,
    isExisting: true
  }));

  timerState.selectedMotionIndices = [];
  renderUpdateMotionList();
}

function renderUpdateMotionList() {
  const list = document.getElementById('motions-list');
  const selected = timerState.selectedMotionIndices;
  const motions = timerState.motions;

  // Split into selected (in order) and unselected
  const selectedMotions = selected.map(i => ({ i, m: motions[i] }));
  const unselectedMotions = motions.map((m, i) => ({ i, m })).filter(x => !selected.includes(x.i));

  const renderRow = ({ i, m }, isSelected, selOrder) => {
    const gridCols = '32px 40px 1fr 90px 110px 100px 80px';
    const bg = isSelected ? 'var(--teal-dim)' : 'transparent';
    const border = isSelected ? '0.5px solid var(--teal-border)' : '0.5px solid transparent';
    return `
      <div id="update-row-${i}" style="display:grid; grid-template-columns:${gridCols}; gap:8px; padding:8px 12px; border-bottom:0.5px solid var(--border); align-items:center; background:${bg}; transition:
background 0.18s ease,
border-color 0.18s ease,
transform 0.18s ease,
box-shadow 0.18s ease;">
        <div style="display:flex; align-items:center; justify-content:center;">
          <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleMotionSelection(${i}, this.checked)"
            style="width:16px; height:16px; accent-color:var(--teal); cursor:pointer;" />
        </div>
        <span style="font-size:12px; color:${isSelected ? 'var(--teal-light)' : 'var(--text-muted)'}; font-weight:500;">${isSelected ? selOrder + 1 : i + 1}</span>
        <span style="font-size:13px; color:var(--text); font-weight:${isSelected ? '500' : '400'};">${m.motion_name || '—'}</span>
        <span style="font-size:13px; color:${isSelected ? '#f0c040' : 'var(--teal-light)'}; font-weight:500;" id="update-time-${i}">${m.captured_time_sec}s</span>
        <span style="font-size:11px; color:var(--text-muted);">${m.time_category}</span>
        <span style="font-size:11px; color:var(--text-muted);">${m.extra_allowance_sec || 0}</span>
        <span style="font-size:11px; color:${m.include_in_study ? 'var(--teal-light)' : 'var(--text-dim)'};">${m.include_in_study ? '✓' : '—'}</span>
      </div>`;
  };

  // Selected motions first, then unselected
  list.innerHTML = [
    ...selectedMotions.map((x, selOrder) => renderRow(x, true, selOrder)),
    ...unselectedMotions.map(x => renderRow(x, false, -1))
  ].join('');

  // After rendering selected motions, show a divider if any selected
  if (selectedMotions.length > 0 && unselectedMotions.length > 0) {
    // Insert divider after last selected row
    const divider = document.createElement('div');
    divider.style.cssText = 'padding:6px 12px; background:#060f0f; border-bottom:0.5px solid var(--border); font-size:10px; color:var(--text-dim); letter-spacing:0.08em;';
    divider.textContent = 'UNSELECTED — TIMES UNCHANGED';
    const rows = list.querySelectorAll('[id^="update-row-"]');
    if (rows[selectedMotions.length]) {
      list.insertBefore(divider, rows[selectedMotions.length]);
    }
  }

  // Show hint or enable start
  const statusEl = document.getElementById('timer-status');
  const startBtn = document.getElementById('btn-start');
  if (selected.length > 0) {
    if (statusEl) statusEl.textContent = `${selected.length} motion(s) selected — ready to start`;
    if (startBtn) startBtn.disabled = false;
    // Hide the update hint
    const hint = document.getElementById('update-mode-hint');
    if (hint) hint.style.display = 'none';
  } else {
    if (statusEl) statusEl.textContent = 'Select motions to update, then start';
    if (startBtn) startBtn.disabled = true;
  }
}

function toggleMotionSelection(motionIndex, isChecked) {
  if (isChecked) {
    // Add to end of selection order
    if (!timerState.selectedMotionIndices.includes(motionIndex)) {
      timerState.selectedMotionIndices.push(motionIndex);
    }
  } else {
    // Remove from selection
    timerState.selectedMotionIndices = timerState.selectedMotionIndices.filter(i => i !== motionIndex);
  }
  renderUpdateMotionList();
}

// ── TIMER ACTIONS ─────────────────────────────────────────────────────────────

function timerAction(action) {
  const now = performance.now();

  if (action === 'start') {
    if (!timerState.running) {
      timerState.running = true;
      timerState.held = false;
      timerState.startTime = now;
      timerState.totalHeld = 0;
      timerState.currentMotionStart = 0;
      timerState.interval = setInterval(updateTimerDisplay, 10);
      updateButtons('running');

      if (timerState.updateMode) {
        // Update mode — don't add new rows, just start timing selected motions
        timerState.currentUpdateIndex = 0;
        const currentMotionIdx = timerState.selectedMotionIndices[0];
        const statusEl = document.getElementById('timer-status');
        if (statusEl) statusEl.textContent = `Recording motion ${timerState.currentUpdateIndex + 1} of ${timerState.selectedMotionIndices.length}: "${timerState.motions[currentMotionIdx]?.motion_name || '—'}"`;
        // Highlight current motion
        highlightCurrentUpdateMotion();
      } else {
        // Fresh mode
        timerState.motions = [];
        addMotionRow(0);
        document.getElementById('timer-status').textContent = 'Recording...';
      }
    }
  }

  else if (action === 'lap') {
    if (timerState.running && !timerState.held) {
      const elapsed = now - timerState.startTime;
      const motionTime = ((elapsed - timerState.currentMotionStart) / 1000).toFixed(3);

      if (timerState.updateMode) {
        // Save time to current selected motion
        const currentMotionIdx = timerState.selectedMotionIndices[timerState.currentUpdateIndex];
        if (currentMotionIdx !== undefined) {
          timerState.motions[currentMotionIdx].captured_time_sec = parseFloat(motionTime);
          // Update display
          const timeEl = document.getElementById(`update-time-${currentMotionIdx}`);
          if (timeEl) {
            timeEl.textContent = motionTime + 's';
            timeEl.style.color = 'var(--teal-light)';
          }
        }
        timerState.currentUpdateIndex++;
        timerState.currentMotionStart = elapsed;

        if (timerState.currentUpdateIndex < timerState.selectedMotionIndices.length) {
          // Move to next selected motion
          const nextMotionIdx = timerState.selectedMotionIndices[timerState.currentUpdateIndex];
          const statusEl = document.getElementById('timer-status');
          if (statusEl) statusEl.textContent = `Recording motion ${timerState.currentUpdateIndex + 1} of ${timerState.selectedMotionIndices.length}: "${timerState.motions[nextMotionIdx]?.motion_name || '—'}"`;
          highlightCurrentUpdateMotion();
        } else {
          // All selected motions timed — now allow adding new motions freely
          const statusEl = document.getElementById('timer-status');
          if (statusEl) statusEl.textContent = 'Selected motions done — timer running, add new motions or stop';
          // Switch to free-add mode: add a new empty row
          addMotionRow(timerState.motions.length);
        }
      } else {
        // Normal fresh mode
        const motionIndex = timerState.motions.length - 1;
        if (motionIndex >= 0) {
          timerState.motions[motionIndex].captured_time_sec = parseFloat(motionTime);
          updateMotionTime(motionIndex, motionTime);
        }
        timerState.currentMotionStart = elapsed;
        addMotionRow(timerState.motions.length);
      }
    }
  }

  else if (action === 'hold') {
    if (timerState.running && !timerState.held) {
      timerState.held = true;
      timerState.holdStart = now;
      clearInterval(timerState.interval);
      updateButtons('held');
      document.getElementById('timer-status').textContent = 'Held — not recording';
    } else if (timerState.held) {
      const heldMs = now - timerState.holdStart;
      timerState.startTime = timerState.startTime + heldMs;
      timerState.held = false;
      timerState.interval = setInterval(updateTimerDisplay, 10);
      updateButtons('running');
      document.getElementById('timer-status').textContent = 'Recording...';
    }
  }

  else if (action === 'stop') {
    if (timerState.running) {
      clearInterval(timerState.interval);
      timerState.running = false;
      const elapsed = now - timerState.startTime;
      const motionTime = ((elapsed - timerState.currentMotionStart) / 1000).toFixed(3);

      if (timerState.updateMode) {
        // If we stopped mid-selected-motions, capture current one
        if (timerState.currentUpdateIndex < timerState.selectedMotionIndices.length) {
          const currentMotionIdx = timerState.selectedMotionIndices[timerState.currentUpdateIndex];
          if (currentMotionIdx !== undefined) {
            timerState.motions[currentMotionIdx].captured_time_sec = parseFloat(motionTime);
            const timeEl = document.getElementById(`update-time-${currentMotionIdx}`);
            if (timeEl) timeEl.textContent = motionTime + 's';
          }
        } else {
          // In free-add mode after selected motions done
          const motionIndex = timerState.motions.length - 1;
          if (motionIndex >= 0 && !timerState.motions[motionIndex].isExisting) {
            timerState.motions[motionIndex].captured_time_sec = parseFloat(motionTime);
            updateMotionTime(motionIndex, motionTime);
          }
        }
      } else {
        const motionIndex = timerState.motions.length - 1;
        if (motionIndex >= 0) {
          timerState.motions[motionIndex].captured_time_sec = parseFloat(motionTime);
          updateMotionTime(motionIndex, motionTime);
        }
      }

      updateButtons('stopped');
      document.getElementById('timer-status').textContent = `Study complete · ${timerState.motions.length} motions`;
      document.getElementById('save-study-btn').style.display = 'block';
    }
  }
}

function highlightCurrentUpdateMotion() {
  // Clear all highlights
  timerState.motions.forEach((_, i) => {
    const row = document.getElementById(`update-row-${i}`);
    if (row) row.style.background = timerState.selectedMotionIndices.includes(i) ? 'var(--teal-dim)' : 'transparent';
  });
  // Highlight current
  const currentIdx = timerState.selectedMotionIndices[timerState.currentUpdateIndex];
  const row = document.getElementById(`update-row-${currentIdx}`);
  if (row) row.style.background = 'var(--teal-dim)';
}

function updateTimerDisplay() {
  const now = performance.now();
  const elapsed = now - timerState.startTime;
  const ms = elapsed % 1000;
  const s = Math.floor(elapsed / 1000) % 60;
  const m = Math.floor(elapsed / 60000);
  const el = document.getElementById('timer-display');
  if (el) el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(Math.floor(ms)).padStart(3,'0')}`;
}

function updateButtons(state) {
  const start = document.getElementById('btn-start');
  const lap = document.getElementById('btn-lap');
  const hold = document.getElementById('btn-hold');
  const stop = document.getElementById('btn-stop');
  if (!start) return;
  if (state === 'running') {
    start.disabled = true; lap.disabled = false; hold.disabled = false; stop.disabled = false;
    hold.innerHTML = '<i class="ti ti-pause"></i> Hold';
    hold.style.color = 'var(--text-muted)';
  } else if (state === 'held') {
    start.disabled = true; lap.disabled = true; hold.disabled = false; stop.disabled = true;
    hold.innerHTML = '<i class="ti ti-player-play"></i> Resume';
    hold.style.color = 'var(--teal-light)';
  } else if (state === 'stopped') {
    start.disabled = true; lap.disabled = true; hold.disabled = true; stop.disabled = true;
  }
}

function addMotionRow(index) {
  const motionData = { motion_name: '', captured_time_sec: 0, time_category: 'normal', extra_allowance_sec: 0, include_in_study: true, isExisting: false };
  timerState.motions.push(motionData);

  const list = document.getElementById('motions-list');
  if (index === 0) list.innerHTML = '';

  const row = document.createElement('div');
  row.id = `motion-row-${index}`;
  const gridCols = timerState.updateMode ? '32px 40px 1fr 90px 110px 100px 80px' : '40px 1fr 90px 110px 100px 80px';
  row.style.cssText = `display:grid; grid-template-columns:${gridCols}; gap:8px; padding:8px 12px; border-bottom:0.5px solid var(--border); align-items:center;`;
  row.innerHTML = `
    ${timerState.updateMode ? '<span style="font-size:11px; color:var(--teal-light);">NEW</span>' : ''}
    <span style="font-size:12px; color:var(--text-muted); font-weight:500;">${index + 1}</span>
    <input placeholder="Motion name..." value=""
      oninput="timerState.motions[${index}].motion_name=this.value"
      style="padding:6px 8px; background:#060f0f; border:0.5px solid var(--border); border-radius:6px; color:var(--text); font-size:12px; outline:none; width:100%;"/>
    <span id="motion-time-${index}" style="font-size:13px; color:var(--teal-light); font-weight:500;">—</span>
    <select onchange="timerState.motions[${index}].time_category=this.value"
      style="padding:5px 6px; background:#060f0f; border:0.5px solid var(--border); border-radius:6px; color:var(--text); font-size:11px; outline:none;">
      <option value="normal">Normal</option>
      <option value="foreign">Foreign element</option>
      <option value="machine">Machine time</option>
      <option value="handling">Handling</option>
      <option value="idle">Idle</option>
    </select>
    <input type="number" placeholder="0" min="0" step="0.001"
      oninput="timerState.motions[${index}].extra_allowance_sec=parseFloat(this.value)||0"
      style="padding:6px 8px; background:#060f0f; border:0.5px solid var(--border); border-radius:6px; color:var(--text); font-size:12px; outline:none; width:100%;"/>
    <input type="checkbox" checked onchange="timerState.motions[${index}].include_in_study=this.checked"
      style="width:16px; height:16px; accent-color:var(--teal); cursor:pointer;"/>`;
  list.appendChild(row);
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updateMotionTime(index, time) {
  const el = document.getElementById(`motion-time-${index}`);
  if (el) el.textContent = time + 's';
  if (timerState.motions[index]) timerState.motions[index].captured_time_sec = parseFloat(time);
}

function setupKeyboardShortcuts() {
  document.onkeydown = (e) => {
    if (!e.shiftKey) return;
    const k = e.key.toUpperCase();
    if (k === 'R') { e.preventDefault(); timerAction('start'); }
    if (k === 'S') { e.preventDefault(); timerAction('stop'); }
    if (k === 'Q') { e.preventDefault(); timerAction('lap'); }
    if (k === 'Z') { e.preventDefault(); timerAction('hold'); }
  };
}

async function loadExistingMotions(productId, operationId, cycleNumber) {
  const res = await fetch(`/api/timestudy/${productId}/${operationId}/readings?cycle=${cycleNumber}`, {
    headers: { 'Authorization': `Bearer ${tsToken}` }
  });
  const readings = await res.json();
  if (!readings.length) return;

  const list = document.getElementById('motions-list');
  list.innerHTML = '';
  timerState.motions = [];

  readings.forEach((r, index) => {
    timerState.motions.push({
      motion_name: r.motion_name,
      captured_time_sec: parseFloat(r.captured_time_sec),
      time_category: r.time_category,
      extra_allowance_sec: parseFloat(r.extra_allowance_sec),
      include_in_study: r.include_in_study,
      isExisting: true
    });

    const row = document.createElement('div');
    row.id = `motion-row-${index}`;
    row.style.cssText = 'display:grid; grid-template-columns:40px 1fr 90px 110px 100px 80px; gap:8px; padding:8px 12px; border-bottom:0.5px solid var(--border); align-items:center;';
    row.innerHTML = `
      <span style="font-size:12px; color:var(--text-muted); font-weight:500;">${index + 1}</span>
      <input placeholder="Motion name..." value="${r.motion_name || ''}"
        oninput="timerState.motions[${index}].motion_name=this.value"
        style="padding:6px 8px; background:#060f0f; border:0.5px solid var(--border); border-radius:6px; color:var(--text); font-size:12px; outline:none; width:100%;"/>
      <span id="motion-time-${index}" style="font-size:13px; color:var(--teal-light); font-weight:500;">${r.captured_time_sec}s</span>
      <select onchange="timerState.motions[${index}].time_category=this.value"
        style="padding:5px 6px; background:#060f0f; border:0.5px solid var(--border); border-radius:6px; color:var(--text); font-size:11px; outline:none;">
        <option value="normal" ${r.time_category==='normal'?'selected':''}>Normal</option>
        <option value="foreign" ${r.time_category==='foreign'?'selected':''}>Foreign element</option>
        <option value="machine" ${r.time_category==='machine'?'selected':''}>Machine time</option>
        <option value="handling" ${r.time_category==='handling'?'selected':''}>Handling</option>
        <option value="idle" ${r.time_category==='idle'?'selected':''}>Idle</option>
      </select>
      <input type="number" placeholder="0" value="${r.extra_allowance_sec || 0}" min="0" step="0.001"
        oninput="timerState.motions[${index}].extra_allowance_sec=parseFloat(this.value)||0"
        style="padding:6px 8px; background:#060f0f; border:0.5px solid var(--border); border-radius:6px; color:var(--text); font-size:12px; outline:none; width:100%;"/>
      <input type="checkbox" ${r.include_in_study ? 'checked' : ''} onchange="timerState.motions[${index}].include_in_study=this.checked"
        style="width:16px; height:16px; accent-color:var(--teal); cursor:pointer;"/>`;
    list.appendChild(row);
  });

  document.getElementById('save-study-btn').style.display = 'block';
  document.getElementById('timer-status').textContent = `${readings.length} existing motions loaded — update or save`;
}

async function saveStudy() {
  const op = tsState.selectedOperation;
  if (!op) { alert('No operation selected.'); return; }
  if (!timerState.motions.length) { alert('No motions recorded.'); return; }

  const readings = timerState.motions.map(m => ({
    motion_name: m.motion_name || '',
    captured_time_sec: parseFloat(m.captured_time_sec) || 0,
    time_category: m.time_category || 'normal',
    extra_allowance_sec: parseFloat(m.extra_allowance_sec) || 0,
    include_in_study: m.include_in_study !== false
  }));

  const payload = {
    product_id: op.product_id,
    operation_id: op.operation_id,
    operation_name: op.operation_name,
    operation_priority: op.operation_priority,
    operation_frequency: op.operation_frequency,
    machine_type: op.machine_type,
    manpower: op.manpower,
    cycle_number: timerState.cycleNumber || 1,
    readings
  };

  try {
    const res = await fetch('/api/timestudy/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tsToken}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) { alert('Save failed: ' + data.message); return; }
    document.onkeydown = null;
    tsState.operations = {};
    loadTimeStudy();
  } catch (err) {
    console.error(err);
    alert('Server error while saving.');
  }
}