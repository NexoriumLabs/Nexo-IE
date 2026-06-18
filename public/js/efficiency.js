const etToken = localStorage.getItem('token');
let etState = {
  products: [],
  selectedProcess: null,
  chartData: { cutting: [], sewing: [], finishing: [] },
  showCost: false,
  currentSAM: 0,
  lastCalc: null
};

let ehState = {
  allData: [],
  filtered: [],
  view: 'week',
  metric: 'efficiency',
  editingId: null
};

// ─── MAIN EFFICIENCY PAGE ───────────────────────────────────────────────────

async function loadEfficiency() {
  const content = document.getElementById('content-area');
  const today = new Date();

  content.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <div>
        <h2 style="font-family:'Space Grotesk',sans-serif; font-size:18px; font-weight:500; color:var(--text);">Efficiency tracker</h2>
        <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">Log daily production and track line efficiency.</p>
      </div>
      <button onclick="loadEfficiencyHistory()" style="padding:7px 14px; background:none; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--teal-light); font-size:12px; cursor:pointer;">
        <i class="ti ti-history"></i> Previous dates
      </button>
    </div>

    <!-- Summary blocks top -->
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:20px;">
      ${['cutting','sewing','finishing'].map(p => `
        <div style="background:var(--surface); border:0.5px solid var(--teal-border); border-radius:10px; padding:14px 16px;">
          <div style="font-size:10px; color:var(--text-muted); letter-spacing:0.08em; margin-bottom:10px; text-transform:uppercase;">${p}</div>
          <div style="display:flex; justify-content:space-between; align-items:flex-end;">
            <div>
              <div style="font-size:10px; color:var(--text-dim); margin-bottom:2px;">EFFICIENCY</div>
              <div id="sum-eff-${p}" style="font-size:22px; font-weight:600; color:var(--teal-light); font-family:'Space Grotesk',sans-serif;">—</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:10px; color:var(--text-dim); margin-bottom:2px;">COST/PC</div>
              <div id="sum-cpp-${p}" style="font-size:16px; font-weight:500; color:var(--text);">—</div>
            </div>
          </div>
        </div>`).join('')}
    </div>

    <!-- Main layout -->
    <div style="display:grid; grid-template-columns:320px 1fr; gap:16px; align-items:start;">

      <!-- LEFT FORM -->
      <div style="background:var(--surface); border:0.5px solid var(--teal-border); border-radius:12px; padding:20px; position:sticky; top:70px;">
        <div style="margin-bottom:18px;">
          <div style="font-size:10px; color:var(--text-muted); letter-spacing:0.08em; margin-bottom:4px;">TODAY</div>
          <div style="font-size:15px; font-weight:600; color:var(--teal-light); font-family:'Space Grotesk',sans-serif;">${today.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
          <div style="font-size:11px; color:var(--text-muted);">${today.toLocaleDateString('en-IN',{weekday:'long'})}</div>
        </div>

        <div style="margin-bottom:16px;">
          <div style="font-size:10px; color:var(--text-muted); letter-spacing:0.08em; margin-bottom:8px;">PROCESS</div>
          <div style="display:flex; gap:6px;">
            ${['cutting','sewing','finishing','other'].map(p => `
              <button onclick="etSelectProcess('${p}')" id="et-proc-${p}"
                style="flex:1; padding:7px 4px; border-radius:8px; border:0.5px solid var(--teal-border); background:transparent; color:var(--text-muted); font-size:11px; cursor:pointer; transition:all 0.15s; font-family:'Inter',sans-serif;">
                ${p.charAt(0).toUpperCase()+p.slice(1)}
              </button>`).join('')}
          </div>
        </div>

        <div style="margin-bottom:16px;">
          <div id="et-line-label" style="font-size:10px; color:var(--text-muted); letter-spacing:0.08em; margin-bottom:6px;">LINE NO.</div>
          <input id="et-line-no" type="number" min="1" value="1"
            style="width:100%; padding:9px 12px; background:#000000; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:13px; outline:none;" />
        </div>

        <div style="margin-bottom:16px;">
          <div style="font-size:10px; color:var(--text-muted); letter-spacing:0.08em; margin-bottom:6px;">PRODUCT</div>
          <div style="position:relative;">
            <input id="et-product-search" type="text" placeholder="Select process first..."
              oninput="etFilterProducts(this.value)"
              style="width:100%; padding:9px 12px; background:#000000; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:13px; outline:none;" />
            <div id="et-product-dropdown" style="display:none; position:absolute; top:100%; left:0; right:0; background:var(--surface); border:0.5px solid var(--teal-border); border-radius:8px; z-index:50; max-height:180px; overflow-y:auto; margin-top:4px;"></div>
          </div>
          <input type="hidden" id="et-product-id" />
        </div>

        <div style="margin-bottom:16px; background:#000000; border-radius:8px; padding:10px 12px; border:0.5px solid var(--border);">
          <div style="font-size:10px; color:var(--text-muted); letter-spacing:0.08em; margin-bottom:4px;">SAM (auto from OB)</div>
          <div id="et-sam-display" style="font-size:20px; font-weight:600; color:var(--teal-light); font-family:'Space Grotesk',sans-serif;">—</div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
          <div>
            <div style="font-size:10px; color:var(--text-muted); letter-spacing:0.08em; margin-bottom:6px;">MANPOWER</div>
            <input id="et-manpower" type="number" min="1" value="1" oninput="etCalculate()"
              style="width:100%; padding:9px 12px; background:#000000; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:13px; outline:none;" />
          </div>
          <div>
            <div style="font-size:10px; color:var(--text-muted); letter-spacing:0.08em; margin-bottom:6px;">PRODUCTION</div>
            <input id="et-production" type="number" min="0" placeholder="0" oninput="etCalculate()"
              style="width:100%; padding:9px 12px; background:#000000; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:13px; outline:none;" />
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
          <div>
            <div style="font-size:10px; color:var(--text-muted); letter-spacing:0.08em; margin-bottom:6px;">WORKING HRS</div>
            <input id="et-working-hrs" type="number" min="0" step="0.5" value="8" oninput="etCalculate()"
              style="width:100%; padding:9px 12px; background:#000000; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:13px; outline:none;" />
          </div>
          <div>
            <div style="font-size:10px; color:var(--text-muted); letter-spacing:0.08em; margin-bottom:6px;">OT HRS</div>
            <input id="et-ot-hrs" type="number" min="0" step="0.5" value="0" oninput="etCalculate()"
              style="width:100%; padding:9px 12px; background:#000000; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:13px; outline:none;" />
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <div style="font-size:10px; color:var(--text-muted); letter-spacing:0.08em; margin-bottom:6px;">WAGE / PERSON / DAY (₹)</div>
          <input id="et-wage" type="number" min="0" value="600" oninput="etCalculate()"
            style="width:100%; padding:9px 12px; background:#000000; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:13px; outline:none;" />
        </div>

        <div id="et-calc-results" style="background:#000000; border-radius:8px; padding:12px; margin-bottom:12px; display:none; border:0.5px solid var(--border);">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <div>
              <div style="font-size:10px; color:var(--text-dim); margin-bottom:2px;">AVAIL. MINS</div>
              <div id="et-res-avail" style="font-size:14px; font-weight:500; color:var(--text);">—</div>
            </div>
            <div>
              <div style="font-size:10px; color:var(--text-dim); margin-bottom:2px;">PRODUCED MINS</div>
              <div id="et-res-prod" style="font-size:14px; font-weight:500; color:var(--text);">—</div>
            </div>
            <div>
              <div style="font-size:10px; color:var(--text-dim); margin-bottom:2px;">EFFICIENCY</div>
              <div id="et-res-eff" style="font-size:20px; font-weight:600; color:var(--teal-light); font-family:'Space Grotesk',sans-serif;">—</div>
            </div>
            <div>
              <div style="font-size:10px; color:var(--text-dim); margin-bottom:2px;">COST / PIECE</div>
              <div id="et-res-cpp" style="font-size:20px; font-weight:600; color:var(--teal-light); font-family:'Space Grotesk',sans-serif;">—</div>
            </div>
          </div>
        </div>

        <button onclick="etSaveEntry()" style="width:100%; padding:10px; background:var(--teal); border:none; border-radius:8px; color:#fff; font-size:13px; font-weight:500; cursor:pointer;">
          <i class="ti ti-device-floppy"></i> Save entry
        </button>
        <p id="et-msg" style="font-size:12px; text-align:center; margin-top:8px; min-height:16px;"></p>
      </div>

      <!-- RIGHT CHARTS -->
      <div>
        <div style="display:flex; justify-content:flex-end; margin-bottom:12px;">
          <button onclick="etToggleChart()" id="et-chart-toggle"
            style="padding:6px 14px; background:var(--surface); border:0.5px solid var(--teal-border); border-radius:20px; color:var(--teal-light); font-size:12px; cursor:pointer; font-weight:500;">
            <i class="ti ti-percentage"></i> Efficiency
          </button>
        </div>
        ${['cutting','sewing','finishing'].map(p => `
          <div style="background:var(--surface); border:0.5px solid var(--teal-border); border-radius:12px; padding:16px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <div>
                <div style="font-size:13px; font-weight:500; color:var(--text);">${p.charAt(0).toUpperCase()+p.slice(1)}</div>
                <div style="font-size:11px; color:var(--text-muted);">By ${p==='cutting'?'table':'line'} number · Today</div>
              </div>
              <div style="font-size:10px; color:var(--teal-light); background:var(--teal-dim); padding:3px 8px; border-radius:20px; border:0.5px solid var(--teal-border);">${p==='cutting'?'TABLE':'LINE'}</div>
            </div>
            <div id="et-chart-${p}" style="height:130px; display:flex; align-items:flex-end; gap:6px;">
              <div style="color:var(--text-dim); font-size:12px; width:100%; text-align:center; padding-top:40px;">No data for today</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;

  const res = await fetch('/api/products', { headers: { 'Authorization': `Bearer ${etToken}` } });
  etState.products = await res.json();
  await etLoadChartData();

  if (!window.etGlobalClickBound) {
  document.addEventListener('click', (e) => {
    const dd = document.getElementById('et-product-dropdown');
    if (dd && !e.target.closest('#et-product-search') && !e.target.closest('#et-product-dropdown')) {
      dd.style.display = 'none';
    }
  });
  window.etGlobalClickBound = true;
}
}

function etSelectProcess(process) {
  etState.selectedProcess = process;
  ['cutting','sewing','finishing','other'].forEach(p => {
    const btn = document.getElementById(`et-proc-${p}`);
    if (!btn) return;
    btn.style.background = p === process ? 'var(--teal-dim)' : 'transparent';
    btn.style.color = p === process ? 'var(--teal-light)' : 'var(--text-muted)';
  });
  const label = document.getElementById('et-line-label');
  if (label) label.textContent = process === 'cutting' ? 'TABLE NO.' : 'LINE NO.';
  const search = document.getElementById('et-product-search');
  if (search) { search.value = ''; search.placeholder = 'Search product...'; }
  document.getElementById('et-product-id').value = '';
  document.getElementById('et-sam-display').textContent = '—';
  etState.currentSAM = 0;
}

function etFilterProducts(query) {
  const dd = document.getElementById('et-product-dropdown');
  if (!etState.selectedProcess) {
    document.getElementById('et-product-search').placeholder = 'Select a process first...';
    dd.style.display = 'none'; return;
  }
  const filtered = etState.products.filter(p => {
    const pt = (p.process_type || '').toLowerCase();
    const matchProcess = pt === etState.selectedProcess ||
      pt === 'full-process' ||
      (etState.selectedProcess === 'other' && !['cutting','sewing','finishing','full-process'].includes(pt));
    const matchQuery = !query ||
      p.product_name.toLowerCase().includes(query.toLowerCase()) ||
      p.product_number.toLowerCase().includes(query.toLowerCase());
    return matchProcess && matchQuery;
  });
  if (!filtered.length) {
    dd.style.display = 'block';
    dd.innerHTML = `<div style="padding:10px 12px; font-size:12px; color:var(--text-muted);">No products found for ${etState.selectedProcess} process.</div>`;
    return;
  }
  dd.style.display = 'block';
  dd.innerHTML = filtered.map(p => `
    <div onclick="etSelectProduct(${p.id},'${p.product_number}','${p.product_name.replace(/'/g,"&#39;")}')"
      style="padding:10px 12px; cursor:pointer; border-bottom:0.5px solid var(--border); font-size:13px; color:var(--text);"
      onmouseover="this.style.background='var(--teal-dim)'" onmouseout="this.style.background='transparent'">
      <span style="color:var(--teal-light); font-size:11px;">${p.product_number}</span>
      <span style="margin-left:8px;">${p.product_name}</span>
    </div>`).join('');
}

// In loadEfficiency(), after the products fetch line, add this:
document.addEventListener('click', (e) => {
  if (e.target.id === 'et-product-search') {
    etFilterProducts(document.getElementById('et-product-search').value);
  }
  // ... existing dropdown close logic
});

async function etSelectProduct(id, number, name) {
  document.getElementById('et-product-id').value = id;
  document.getElementById('et-product-search').value = `${number} — ${name}`;
  document.getElementById('et-product-dropdown').style.display = 'none';
  const res = await fetch(`/api/ob/${id}`, { headers: { 'Authorization': `Bearer ${etToken}` } });
  const data = await res.json();
  const totalSMV = data.operations.reduce((sum, op) => sum + parseFloat(op.smv || 0), 0);
  document.getElementById('et-sam-display').textContent = totalSMV > 0 ? totalSMV.toFixed(3) : '—';
  etState.currentSAM = totalSMV;
  etCalculate();
}

function etCalculate() {
  const sam = etState.currentSAM || 0;
  const manpower = parseFloat(document.getElementById('et-manpower')?.value) || 1;
  const production = parseFloat(document.getElementById('et-production')?.value) || 0;
  const workingHrs = parseFloat(document.getElementById('et-working-hrs')?.value) || 8;
  const otHrs = parseFloat(document.getElementById('et-ot-hrs')?.value) || 0;
  const wage = parseFloat(document.getElementById('et-wage')?.value) || 600;
  if (!sam || !production) return;
  const availMins = (workingHrs * manpower * 60) + (otHrs * 60);
  const producedMins = sam * production;
  const efficiency = availMins > 0 ? (producedMins / availMins) * 100 : 0;
  const totalWage = wage * manpower;
  const otCost = (wage / 8) * otHrs * manpower;
  const totalCost = totalWage + otCost;
  const cpp = production > 0 ? totalCost / production : 0;
  document.getElementById('et-res-avail').textContent = availMins.toFixed(0) + ' min';
  document.getElementById('et-res-prod').textContent = producedMins.toFixed(0) + ' min';
  document.getElementById('et-res-eff').textContent = efficiency.toFixed(1) + '%';
  document.getElementById('et-res-cpp').textContent = '₹' + cpp.toFixed(2);
  document.getElementById('et-calc-results').style.display = 'block';
  etState.lastCalc = { availMins, producedMins, efficiency, cpp, totalCost };
}

async function etSaveEntry() {
  const msg = document.getElementById('et-msg');
  const productId = document.getElementById('et-product-id').value;
  const process = etState.selectedProcess;
  const lineNo = document.getElementById('et-line-no').value;
  const manpower = parseInt(document.getElementById('et-manpower').value) || 1;
  const production = parseInt(document.getElementById('et-production').value) || 0;
  const workingHrs = parseFloat(document.getElementById('et-working-hrs').value) || 8;
  const otHrs = parseFloat(document.getElementById('et-ot-hrs').value) || 0;
  const wage = parseFloat(document.getElementById('et-wage').value) || 600;
  const sam = etState.currentSAM || 0;
  if (!process) { msg.style.color='#F09995'; msg.textContent='Select a process first.'; return; }
  if (!productId) { msg.style.color='#F09995'; msg.textContent='Select a product.'; return; }
  if (!production) { msg.style.color='#F09995'; msg.textContent='Enter production count.'; return; }
  if (!sam) { msg.style.color='#F09995'; msg.textContent='No SAM found for this product.'; return; }
  if (!etState.lastCalc) { msg.style.color='#F09995'; msg.textContent='Calculation error.'; return; }
  const calc = etState.lastCalc;
  const res = await fetch('/api/efficiency', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${etToken}` },
    body: JSON.stringify({
      product_id: productId, line_no: lineNo, process_type: process,
      manpower, sam, output: production, working_hours: workingHrs, ot_hours: otHrs,
      available_minutes: calc.availMins, produced_minutes: calc.producedMins,
      efficiency_percent: calc.efficiency, hr_cost_per_day: calc.totalCost,
      cost_per_piece: calc.cpp, per_person_productivity: production / manpower, wage_per_day: wage
    })
  });
  if (res.ok) {
    msg.style.color = '#5DCAA5'; msg.textContent = 'Entry saved.';
    await etLoadChartData();
    setTimeout(() => { msg.textContent = ''; }, 2000);
  } else { msg.style.color = '#F09995'; msg.textContent = 'Save failed.'; }
}

async function etLoadChartData() {
  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(`/api/efficiency/today?date=${today}`, { headers: { 'Authorization': `Bearer ${etToken}` } });
  const data = await res.json();
  etState.chartData = { cutting: [], sewing: [], finishing: [] };
  data.forEach(row => {
    if (etState.chartData[row.process_type] !== undefined) etState.chartData[row.process_type].push(row);
  });
  etRenderCharts();
  etUpdateSummaryBlocks();
}

function etRenderCharts() {
  ['cutting','sewing','finishing'].forEach(process => {
    const rows = etState.chartData[process];
    const container = document.getElementById(`et-chart-${process}`);
    if (!container) return;
    if (!rows.length) {
      container.innerHTML = `<div style="color:var(--text-dim); font-size:12px; width:100%; text-align:center; padding-top:40px;">No data for today</div>`;
      return;
    }
    const getValue = r => etState.showCost ? parseFloat(r.cost_per_piece) : parseFloat(r.efficiency_percent);
    const maxVal = Math.max(...rows.map(getValue), 1);
    container.innerHTML = rows.map(row => {
      const val = getValue(row);
      const h = Math.round((val / maxVal) * 110);
      const color = etState.showCost ? 'var(--teal-light)' : (val >= 75 ? 'var(--teal-light)' : val >= 50 ? '#f0c040' : '#F09995');
      const label = etState.showCost ? `₹${val.toFixed(2)}` : `${val.toFixed(1)}%`;
      return `
        <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex:1; min-width:0;">
          <div style="font-size:10px; color:${color}; font-weight:500; white-space:nowrap; overflow:hidden; max-width:100%; text-overflow:ellipsis;">${label}</div>
          <div style="width:100%; max-width:36px; background:${color}; border-radius:4px 4px 0 0; height:${Math.max(h,4)}px; opacity:0.75; transition:height 0.3s;"></div>
          <div style="font-size:10px; color:var(--text-muted);">${process==='cutting'?'T':'L'}${row.line_no}</div>
        </div>`;
    }).join('');
  });
}

function etUpdateSummaryBlocks() {
  ['cutting','sewing','finishing'].forEach(p => {
    const rows = etState.chartData[p];
    const effEl = document.getElementById(`sum-eff-${p}`);
    const cppEl = document.getElementById(`sum-cpp-${p}`);
    if (!rows.length) { if(effEl) effEl.textContent='—'; if(cppEl) cppEl.textContent='—'; return; }
    const avgEff = rows.reduce((s,r)=>s+parseFloat(r.efficiency_percent),0)/rows.length;
    const avgCpp = rows.reduce((s,r)=>s+parseFloat(r.cost_per_piece),0)/rows.length;
    if(effEl) effEl.textContent = avgEff.toFixed(1)+'%';
    if(cppEl) cppEl.textContent = '₹'+avgCpp.toFixed(2);
  });
}

function etToggleChart() {
  etState.showCost = !etState.showCost;
  const btn = document.getElementById('et-chart-toggle');
  if (btn) btn.innerHTML = etState.showCost ? '<i class="ti ti-currency-rupee"></i> Cost/piece' : '<i class="ti ti-percentage"></i> Efficiency';
  etRenderCharts();
}

// ─── HISTORY PAGE ───────────────────────────────────────────────────────────

async function loadEfficiencyHistory() {
  const content = document.getElementById('content-area');
  content.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
      <button onclick="loadEfficiency()" style="background:none; border:0.5px solid var(--border); border-radius:8px; padding:6px 10px; color:var(--text-muted); cursor:pointer; font-size:13px;">
        <i class="ti ti-arrow-left"></i> Back
      </button>
      <div style="flex:1;">
        <h2 style="font-family:'Space Grotesk',sans-serif; font-size:16px; font-weight:500; color:var(--text);">Efficiency history</h2>
        <p style="font-size:11px; color:var(--text-muted);">Browse, filter and edit past entries</p>
      </div>
    </div>

    <!-- Filters row -->
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; align-items:center;">
      <div style="display:flex; background:#000000; border:0.5px solid var(--teal-border); border-radius:8px; overflow:hidden;">
        ${['day','week','month'].map(v=>`
          <button onclick="ehSetView('${v}')" id="eh-view-${v}"
            style="padding:7px 14px; border:none; font-size:12px; cursor:pointer; font-family:'Inter',sans-serif; transition:all 0.15s;
            ${v==='week'?'background:var(--teal-dim);color:var(--teal-light);':'background:transparent;color:var(--text-muted);'}">
            ${v.charAt(0).toUpperCase()+v.slice(1)}
          </button>`).join('')}
      </div>
      <select id="eh-filter-process" onchange="ehApplyFilters()"
        style="padding:7px 12px; background:#000000; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:12px; outline:none;">
        <option value="">All processes</option>
        <option value="cutting">Cutting</option>
        <option value="sewing">Sewing</option>
        <option value="finishing">Finishing</option>
        <option value="other">Other</option>
      </select>
      <select id="eh-filter-line" onchange="ehApplyFilters()"
        style="padding:7px 12px; background:#000000; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:12px; outline:none;">
        <option value="">All lines</option>
      </select>
      <select id="eh-filter-product" onchange="ehApplyFilters()"
        style="padding:7px 12px; background:#000000; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:12px; outline:none;">
        <option value="">All products</option>
      </select>
      <div style="display:flex; background:#000000; border:0.5px solid var(--teal-border); border-radius:8px; overflow:hidden; margin-left:auto;">
        ${['efficiency','cost','output'].map(m=>`
          <button onclick="ehSetMetric('${m}')" id="eh-metric-${m}"
            style="padding:7px 12px; border:none; font-size:12px; cursor:pointer; font-family:'Inter',sans-serif; transition:all 0.15s;
            ${m==='efficiency'?'background:var(--teal-dim);color:var(--teal-light);':'background:transparent;color:var(--text-muted);'}">
            ${m==='efficiency'?'% Eff':m==='cost'?'₹ Cost':'Output'}
          </button>`).join('')}
      </div>
    </div>

    <!-- Summary strip -->
    <div id="eh-summary-strip" style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:16px;"></div>

    <!-- Chart -->
    <div style="background:var(--surface); border:0.5px solid var(--teal-border); border-radius:12px; padding:16px; margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div id="eh-chart-title" style="font-size:13px; font-weight:500; color:var(--text);">Weekly efficiency trend</div>
      </div>
      <div id="eh-chart-area" style="height:160px; display:flex; align-items:flex-end; gap:3px; position:relative;">
        <div style="color:var(--text-dim); font-size:12px; width:100%; text-align:center; padding-top:60px;">Loading...</div>
      </div>
      <div id="eh-chart-labels" style="display:flex; gap:3px; margin-top:6px;"></div>
    </div>

    <!-- Records -->
    <div id="eh-records-container"></div>

    <!-- Edit modal -->
    <div id="eh-edit-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:300; align-items:center; justify-content:center;">
      <div style="background:var(--surface); border:0.5px solid var(--teal-border); border-radius:16px; padding:24px; width:100%; max-width:460px; margin:16px; max-height:90vh; overflow-y:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h3 style="font-family:'Space Grotesk',sans-serif; font-size:15px; font-weight:500; color:var(--text);">Edit entry</h3>
          <button onclick="ehCloseEdit()" style="background:none; border:none; color:var(--text-muted); font-size:20px; cursor:pointer;"><i class="ti ti-x"></i></button>
        </div>
        <div id="eh-edit-form"></div>
      </div>
    </div>`;

  const res = await fetch('/api/efficiency/history', { headers: { 'Authorization': `Bearer ${etToken}` } });
  ehState.allData = await res.json();
  ehPopulateFilters();
  ehApplyFilters();
}

function ehParseDate(raw) {
  if (!raw) return null;
  const s = raw.toString().split('T')[0];
  const [yr, mo, dy] = s.split('-');
  return new Date(parseInt(yr), parseInt(mo)-1, parseInt(dy));
}

function ehFormatDate(raw) {
  const d = ehParseDate(raw);
  if (!d) return 'Invalid date';
  return d.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}

function ehGetWeekKey(raw) {
  const d = ehParseDate(raw);
  if (!d) return '';
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().split('T')[0];
}

function ehGetMonthKey(raw) {
  const s = raw.toString().split('T')[0];
  return s.substring(0, 7);
}

function ehPopulateFilters() {
  const lines = [...new Set(ehState.allData.map(r => r.line_no))].sort((a,b)=>a-b);
  const products = [...new Map(ehState.allData.map(r => [r.product_id, { id: r.product_id, name: r.product_name }])).values()];
  const lineEl = document.getElementById('eh-filter-line');
  const prodEl = document.getElementById('eh-filter-product');
  if (lineEl) lines.forEach(l => { const o = document.createElement('option'); o.value = l; o.textContent = `Line ${l}`; lineEl.appendChild(o); });
  if (prodEl) products.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.name || `Product ${p.id}`; prodEl.appendChild(o); });
}

function ehApplyFilters() {
  const process = document.getElementById('eh-filter-process')?.value || '';
  const line = document.getElementById('eh-filter-line')?.value || '';
  const product = document.getElementById('eh-filter-product')?.value || '';
  ehState.filtered = ehState.allData.filter(r =>
    (!process || r.process_type === process) &&
    (!line || String(r.line_no) === String(line)) &&
    (!product || String(r.product_id) === String(product))
  );
  ehRenderSummary();
  ehRenderChart();
  ehRenderRecords();
}

function ehSetView(v) {
  ehState.view = v;
  ['day','week','month'].forEach(x => {
    const btn = document.getElementById(`eh-view-${x}`);
    if (!btn) return;
    btn.style.background = x === v ? 'var(--teal-dim)' : 'transparent';
    btn.style.color = x === v ? 'var(--teal-light)' : 'var(--text-muted)';
  });
  ehRenderChart();
  ehRenderRecords();
}

function ehSetMetric(m) {
  ehState.metric = m;
  ['efficiency','cost','output'].forEach(x => {
    const btn = document.getElementById(`eh-metric-${x}`);
    if (!btn) return;
    btn.style.background = x === m ? 'var(--teal-dim)' : 'transparent';
    btn.style.color = x === m ? 'var(--teal-light)' : 'var(--text-muted)';
  });
  ehRenderSummary();
  ehRenderChart();
}

function ehGetMetricValue(r) {
  if (ehState.metric === 'efficiency') return parseFloat(r.efficiency_percent) || 0;
  if (ehState.metric === 'cost') return parseFloat(r.cost_per_piece) || 0;
  return parseInt(r.output) || 0;
}

function ehFormatMetric(val) {
  if (ehState.metric === 'efficiency') return val.toFixed(1) + '%';
  if (ehState.metric === 'cost') return '₹' + val.toFixed(2);
  return val.toFixed(0) + ' pcs';
}

function ehMetricColor(val) {
  if (ehState.metric === 'efficiency') return val >= 75 ? 'var(--teal-light)' : val >= 50 ? '#f0c040' : '#F09995';
  return 'var(--teal-light)';
}

function ehRenderSummary() {
  const container = document.getElementById('eh-summary-strip');
  if (!container || !ehState.filtered.length) { if(container) container.innerHTML=''; return; }
  let avg = 0;

if (ehState.metric === 'cost') {

  const totalCost = ehState.filtered.reduce(
    (s, r) => s + parseFloat(r.hr_cost_per_day || 0),
    0
  );

  const totalOutput = ehState.filtered.reduce(
    (s, r) => s + parseFloat(r.output || 0),
    0
  );

  avg = totalOutput > 0 ? totalCost / totalOutput : 0;

} else if (ehState.metric === 'efficiency') {

  const totalProducedMins = ehState.filtered.reduce(
    (s, r) => s + parseFloat(r.produced_minutes || 0),
    0
  );

  const totalAvailableMins = ehState.filtered.reduce(
    (s, r) => s + parseFloat(r.available_minutes || 0),
    0
  );

  avg = totalAvailableMins > 0
    ? (totalProducedMins / totalAvailableMins) * 100
    : 0;

} else {

  const totalOutput = ehState.filtered.reduce(
    (s, r) => s + parseFloat(r.output || 0),
    0
  );

  avg = totalOutput / ehState.filtered.length;
}

const vals = ehState.filtered.map(ehGetMetricValue);
const best = Math.max(...vals);
const worst = Math.min(...vals);
  const total = ehState.metric === 'output' ? vals.reduce((a,b)=>a+b,0) : null;
  const isCost = ehState.metric === 'cost';

const items = [
  {
    label: 'AVERAGE',
    value: ehFormatMetric(avg),
    color: 'var(--teal-light)'
  },
  {
    label: 'BEST',
    value: ehFormatMetric(isCost ? worst : best),
    color: '#5DCAA5'
  },
  {
    label: 'WORST',
    value: ehFormatMetric(isCost ? best : worst),
    color: '#F09995'
  },
  {
    label: ehState.metric === 'output' ? 'TOTAL ENTRIES' : 'ENTRIES',
    value: ehState.filtered.length,
    color: 'var(--text-muted)'
  },
];
  container.innerHTML = items.map(i => `
    <div style="background:var(--surface); border:0.5px solid var(--teal-border); border-radius:10px; padding:12px 14px;">
      <div style="font-size:10px; color:var(--text-dim); letter-spacing:0.06em; margin-bottom:4px;">${i.label}</div>
      <div style="font-size:18px; font-weight:600; color:${i.color}; font-family:'Space Grotesk',sans-serif;">${i.value}</div>
    </div>`).join('');
}

function ehRenderChart() {
  const chartArea = document.getElementById('eh-chart-area');
  const labelsEl = document.getElementById('eh-chart-labels');
  const titleEl = document.getElementById('eh-chart-title');
  if (!chartArea) return;

  if (!ehState.filtered.length) {
    chartArea.innerHTML = `<div style="color:var(--text-dim);font-size:12px;width:100%;text-align:center;padding-top:60px;">No data</div>`;
    if (labelsEl) labelsEl.innerHTML = '';
    return;
  }

  // Group by view
  const grouped = {};
  ehState.filtered.forEach(r => {
    let key;
    if (ehState.view === 'day') key = r.date.toString().split('T')[0];
    else if (ehState.view === 'week') key = ehGetWeekKey(r.date);
    else key = ehGetMonthKey(r.date);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });

  const keys = Object.keys(grouped).sort();
  const barData = keys.map(k => {
    const vals = grouped[k].map(ehGetMetricValue);
    return { key: k, avg: vals.reduce((a,b)=>a+b,0)/vals.length, count: vals.length };
  });

  const maxVal = Math.max(...barData.map(b=>b.avg), 1);
  const metricLabel = ehState.metric==='efficiency' ? '% Efficiency' : ehState.metric==='cost' ? 'Cost/pc (₹)' : 'Output (pcs)';
  const viewLabels = {
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly'
};

if (titleEl) titleEl.textContent = `${viewLabels[ehState.view]} ${metricLabel} trend`;

  chartArea.innerHTML = barData.map(b => {
    const h = Math.max(Math.round((b.avg / maxVal) * 140), 4);
    const color = ehMetricColor(b.avg);
    return `
      <div style="display:flex; flex-direction:column; align-items:center; gap:2px; flex:1; min-width:0;">
        <div style="font-size:9px; color:${color}; font-weight:500; white-space:nowrap;">${ehFormatMetric(b.avg)}</div>
        <div style="width:100%; max-width:32px; background:${color}; border-radius:3px 3px 0 0; height:${h}px; opacity:0.8; transition:height 0.3s; position:relative;"
          title="${ehFormatMetric(b.avg)} · ${b.count} entries">
        </div>
      </div>`;
  }).join('');

  if (labelsEl) {
    labelsEl.style.cssText = 'display:flex; gap:3px;';
    labelsEl.innerHTML = barData.map(b => {
      let label = b.key;
      if (ehState.view === 'day') {
        const d = ehParseDate(b.key);
        label = d ? d.toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : b.key;
      } else if (ehState.view === 'week') {
        const d = ehParseDate(b.key);
        label = d ? 'W'+d.toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : b.key;
      } else {
        const [yr, mo] = b.key.split('-');
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        label = (months[parseInt(mo)-1]||mo) + ' ' + yr.slice(2);
      }
      return `<div style="flex:1; font-size:9px; color:var(--text-dim); text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${label}</div>`;
    }).join('');
  }
}

function ehRenderRecords() {
  const container = document.getElementById('eh-records-container');
  if (!container) return;
  if (!ehState.filtered.length) {
    container.innerHTML = `<div class="coming-soon"><i class="ti ti-chart-bar"></i><h2>No entries</h2><p>Adjust filters to see data.</p></div>`;
    return;
  }

  // Group by view period
  const grouped = {};
  ehState.filtered.forEach(r => {
    let key, label;
    if (ehState.view === 'day') {
      key = r.date.toString().split('T')[0];
      label = ehFormatDate(r.date);
    } else if (ehState.view === 'week') {
      key = ehGetWeekKey(r.date);
      const d = ehParseDate(key);
      const end = new Date(d); end.setDate(end.getDate()+6);
      label = `Week of ${d.toLocaleDateString('en-IN',{day:'numeric',month:'short'})} – ${end.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`;
    } else {
      key = ehGetMonthKey(r.date);
      const [yr, mo] = key.split('-');
      const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
      label = (months[parseInt(mo)-1]||mo) + ' ' + yr;
    }
    if (!grouped[key]) grouped[key] = { label, rows: [] };
    grouped[key].rows.push(r);
  });

  const sortedKeys = Object.keys(grouped).sort((a,b)=>b.localeCompare(a));

  container.innerHTML = sortedKeys.map(key => {
    const { label, rows } = grouped[key];
    const avgEff = rows.reduce((s,r)=>s+parseFloat(r.efficiency_percent||0),0)/rows.length;
    const avgCpp = rows.reduce((s,r)=>s+parseFloat(r.cost_per_piece||0),0)/rows.length;
    const totalOut = rows.reduce((s,r)=>s+parseInt(r.output||0),0);

    return `
      <div style="margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div style="font-size:12px; color:var(--teal-light); font-weight:500; letter-spacing:0.04em;">${label}</div>
          <div style="display:flex; gap:16px;">
            <span style="font-size:11px; color:var(--text-muted);">Avg eff: <span style="color:${avgEff>=75?'var(--teal-light)':avgEff>=50?'#f0c040':'#F09995'}; font-weight:500;">${avgEff.toFixed(1)}%</span></span>
            <span style="font-size:11px; color:var(--text-muted);">Avg CPP: <span style="color:var(--text); font-weight:500;">₹${avgCpp.toFixed(2)}</span></span>
            <span style="font-size:11px; color:var(--text-muted);">Output: <span style="color:var(--text); font-weight:500;">${totalOut}</span></span>
          </div>
        </div>
        <div style="border:0.5px solid var(--teal-border); border-radius:10px; overflow:hidden;">
          <div style="display:grid; grid-template-columns:90px 60px 60px 1fr 55px 65px 60px 60px 70px 80px 44px; background:var(--surface-2); padding:8px 14px; border-bottom:0.5px solid var(--border);">
            ${['DATE','PROC','LINE','PRODUCT','M/P','OUTPUT','W.HRS','OT','EFF %','CPP',''].map(h=>`<span style="font-size:10px; color:var(--text-muted); letter-spacing:0.04em;">${h}</span>`).join('')}
          </div>
          ${rows.sort((a,b)=>b.date.toString().localeCompare(a.date.toString())).map(r => {
            const eff = parseFloat(r.efficiency_percent||0);
            const effColor = eff>=75?'var(--teal-light)':eff>=50?'#f0c040':'#F09995';
            const dateStr = ehFormatDate(r.date);
            return `
              <div style="display:grid; grid-template-columns:90px 60px 60px 1fr 55px 65px 60px 60px 70px 80px 44px; padding:9px 14px; border-bottom:0.5px solid var(--border); align-items:center; transition:background 0.1s;"
                onmouseover="this.style.background='var(--teal-hover)'" onmouseout="this.style.background='transparent'">
                <span style="font-size:11px; color:var(--text-muted);">${dateStr.split(',').slice(0,2).join(',')}</span>
                <span style="font-size:11px; color:var(--text-muted); text-transform:capitalize;">${r.process_type||'—'}</span>
                <span style="font-size:11px; color:var(--text-muted);">${r.process_type==='cutting'?'T':'L'}${r.line_no}</span>
                <span style="font-size:12px; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.product_name||'—'}</span>
                <span style="font-size:12px; color:var(--text-muted); text-align:center;">${r.manpower||1}</span>
                <span style="font-size:12px; color:var(--text); font-weight:500;">${r.output}</span>
                <span style="font-size:11px; color:var(--text-muted);">${parseFloat(r.working_hours||8).toFixed(1)}h</span>
                <span style="font-size:11px; color:var(--text-muted);">${parseFloat(r.ot_hours||0).toFixed(1)}h</span>
                <span style="font-size:13px; font-weight:600; color:${effColor}; font-family:'Space Grotesk',sans-serif;">${eff.toFixed(1)}%</span>
                <span style="font-size:12px; color:var(--teal-light);">₹${parseFloat(r.cost_per_piece||0).toFixed(2)}</span>
                <button onclick="ehOpenEdit(${r.id})"
                  style="padding:4px 8px; background:transparent; border:0.5px solid var(--teal-border); border-radius:6px; color:var(--teal-light); font-size:11px; cursor:pointer;">
                  <i class="ti ti-edit"></i>
                </button>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');
}

function ehOpenEdit(id) {
  const row = ehState.allData.find(r => r.id === id);
  if (!row) return;
  ehState.editingId = id;
  const form = document.getElementById('eh-edit-form');
  const inp = (id, label, type, val, step='') => `
    <div style="margin-bottom:12px;">
      <div style="font-size:10px; color:var(--text-muted); letter-spacing:0.06em; margin-bottom:5px;">${label}</div>
      <input id="ehedit-${id}" type="${type}" value="${val}" ${step?`step="${step}"`:''}
        style="width:100%; padding:9px 12px; background:#000000; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:13px; outline:none;" />
    </div>`;

  form.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
      ${inp('output','PRODUCTION (pcs)','number',row.output)}
      ${inp('manpower','MANPOWER','number',row.manpower||1)}
      ${inp('working_hours','WORKING HRS','number',parseFloat(row.working_hours||8).toFixed(1),'0.5')}
      ${inp('ot_hours','OT HRS','number',parseFloat(row.ot_hours||0).toFixed(1),'0.5')}
      ${inp('wage_per_day','WAGE/PERSON/DAY (₹)','number',parseFloat(row.wage_per_day||600).toFixed(0))}
      ${inp('line_no',row.process_type==='cutting'?'TABLE NO.':'LINE NO.','number',row.line_no)}
    </div>
    <div style="background:#000000; border-radius:8px; padding:10px 12px; margin:12px 0; border:0.5px solid var(--border);">
      <div style="font-size:10px; color:var(--text-dim); margin-bottom:4px;">SAM</div>
      <div style="font-size:16px; font-weight:600; color:var(--teal-light);">${parseFloat(row.sam||0).toFixed(3)}</div>
    </div>
    <div id="ehedit-preview" style="background:#000000; border-radius:8px; padding:10px 12px; margin-bottom:14px; border:0.5px solid var(--border); display:grid; grid-template-columns:1fr 1fr; gap:8px;">
      <div><div style="font-size:10px; color:var(--text-dim); margin-bottom:2px;">EFFICIENCY</div><div id="ehedit-eff" style="font-size:16px; font-weight:600; color:var(--teal-light); font-family:'Space Grotesk',sans-serif;">—</div></div>
      <div><div style="font-size:10px; color:var(--text-dim); margin-bottom:2px;">COST/PIECE</div><div id="ehedit-cpp" style="font-size:16px; font-weight:600; color:var(--teal-light); font-family:'Space Grotesk',sans-serif;">—</div></div>
    </div>
    <div style="display:flex; gap:10px;">
      <button onclick="ehSaveEdit(${id}, ${parseFloat(row.sam||0)})" style="flex:1; padding:10px; background:var(--teal); border:none; border-radius:8px; color:#fff; font-size:13px; font-weight:500; cursor:pointer;">
        <i class="ti ti-device-floppy"></i> Save changes
      </button>
      <button onclick="ehCloseEdit()" style="padding:10px 16px; background:none; border:0.5px solid var(--border); border-radius:8px; color:var(--text-muted); font-size:13px; cursor:pointer;">Cancel</button>
    </div>
    <p id="ehedit-msg" style="font-size:12px; text-align:center; margin-top:8px; min-height:16px;"></p>`;

  // Live recalc on input
  ['output','manpower','working_hours','ot_hours','wage_per_day'].forEach(f => {
    const el = document.getElementById(`ehedit-${f}`);
    if (el) el.addEventListener('input', () => ehEditRecalc(parseFloat(row.sam||0)));
  });
  ehEditRecalc(parseFloat(row.sam||0));

  document.getElementById('eh-edit-modal').style.display = 'flex';
}

function ehEditRecalc(sam) {
  const output = parseFloat(document.getElementById('ehedit-output')?.value) || 0;
  const manpower = parseFloat(document.getElementById('ehedit-manpower')?.value) || 1;
  const workHrs = parseFloat(document.getElementById('ehedit-working_hours')?.value) || 8;
  const otHrs = parseFloat(document.getElementById('ehedit-ot_hours')?.value) || 0;
  const wage = parseFloat(document.getElementById('ehedit-wage_per_day')?.value) || 600;
  if (!sam || !output) return;
  const availMins = (workHrs * manpower * 60) + (otHrs * 60);
  const prodMins = sam * output;
  const eff = availMins > 0 ? (prodMins / availMins) * 100 : 0;
  const totalCost = (wage * manpower) + ((wage/8) * otHrs * manpower);
  const cpp = output > 0 ? totalCost / output : 0;
  const effEl = document.getElementById('ehedit-eff');
  const cppEl = document.getElementById('ehedit-cpp');
  if (effEl) effEl.textContent = eff.toFixed(1) + '%';
  if (cppEl) cppEl.textContent = '₹' + cpp.toFixed(2);
  ehState._editCalc = { availMins, prodMins, eff, cpp, totalCost };
}

async function ehSaveEdit(id, sam) {
  const msg = document.getElementById('ehedit-msg');
  const output = parseInt(document.getElementById('ehedit-output')?.value) || 0;
  const manpower = parseInt(document.getElementById('ehedit-manpower')?.value) || 1;
  const workHrs = parseFloat(document.getElementById('ehedit-working_hours')?.value) || 8;
  const otHrs = parseFloat(document.getElementById('ehedit-ot_hours')?.value) || 0;
  const wage = parseFloat(document.getElementById('ehedit-wage_per_day')?.value) || 600;
  const lineNo = document.getElementById('ehedit-line_no')?.value;
  const calc = ehState._editCalc;
  if (!calc) { msg.style.color='#F09995'; msg.textContent='Recalculate first.'; return; }

  const res = await fetch(`/api/efficiency/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${etToken}` },
    body: JSON.stringify({
      output, manpower, working_hours: workHrs, ot_hours: otHrs, wage_per_day: wage,
      line_no: lineNo, available_minutes: calc.availMins, produced_minutes: calc.prodMins,
      efficiency_percent: calc.eff, hr_cost_per_day: calc.totalCost,
      cost_per_piece: calc.cpp, per_person_productivity: output / manpower
    })
  });

  if (res.ok) {
    msg.style.color = '#5DCAA5'; msg.textContent = 'Saved.';
    // Refresh data
    const dataRes = await fetch('/api/efficiency/history', { headers: { 'Authorization': `Bearer ${etToken}` } });
    ehState.allData = await dataRes.json();
    ehApplyFilters();
    setTimeout(() => { ehCloseEdit(); }, 800);
  } else { msg.style.color = '#F09995'; msg.textContent = 'Save failed.'; }
}

function ehCloseEdit() {
  const modal = document.getElementById('eh-edit-modal');
  if (modal) modal.style.display = 'none';
  ehState.editingId = null;
}