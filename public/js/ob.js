const obToken = localStorage.getItem('token');

let obState = {
  products: [],
  selectedProduct: null,
  obData: null,
  efficiency: 85,
  wage: 600,
  isDirty: false
};

async function loadOB() {
  const content = document.getElementById('content-area');
  content.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <div>
        <h2 style="font-family:'Space Grotesk',sans-serif; font-size:18px; font-weight:500; color:var(--text);">Operation bulletin</h2>
        <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">Calculated summaries from time studies.</p>
      </div>
    </div>
    <div id="ob-product-list">
      <div class="coming-soon"><i class="ti ti-loader"></i><p>Loading...</p></div>
    </div>`;

  const res = await fetch('/api/ob/products', {
    headers: { 'Authorization': `Bearer ${obToken}` }
  });
  obState.products = await res.json();
  renderOBProductList();
}

function renderOBProductList() {
  const list = document.getElementById('ob-product-list');
  if (!obState.products.length) {
    list.innerHTML = `<div class="coming-soon"><i class="ti ti-box"></i><h2>No OB data yet</h2><p>Complete a time study first to generate OB.</p></div>`;
    return;
  }

  list.innerHTML = `
    <div style="border:0.5px solid var(--teal-border); border-radius:12px; overflow:hidden;">
      <div style="display:grid; grid-template-columns:130px 1fr 100px 100px 80px 100px 32px; background:var(--sidebar-bg); padding:10px 16px; border-bottom:0.5px solid var(--border);">
        <span style="font-size:11px; color:var(--text-muted); letter-spacing:0.05em;">PRODUCT NO.</span>
        <span style="font-size:11px; color:var(--text-muted); letter-spacing:0.05em;">NAME</span>
        <span style="font-size:11px; color:var(--text-muted); letter-spacing:0.05em;">TYPE</span>
        <span style="font-size:11px; color:var(--text-muted); letter-spacing:0.05em;">PROCESS</span>
        <span style="font-size:11px; color:var(--text-muted); letter-spacing:0.05em;">OPS</span>
        <span style="font-size:11px; color:var(--text-muted); letter-spacing:0.05em;">TOTAL SMV</span>
        <span></span>
      </div>
      ${obState.products.map(p => `
        <div style="border-bottom:0.5px solid var(--border);">
          <div onclick="openOBProduct(${p.id})" style="display:grid; grid-template-columns:130px 1fr 100px 100px 80px 100px 32px; padding:12px 16px; cursor:pointer; background:var(--surface); transition:background 0.15s;" onmouseover="
  this.style.background='var(--surface-2)';
  this.style.borderColor='var(--teal-border)';
" onmouseout="
  this.style.background='var(--surface)';
  this.style.borderColor='var(--border)';
">
            <span style="font-size:12px; color:var(--teal-light); font-weight:500;">${p.product_number}</span>
            <span style="font-size:13px; color:var(--text);">${p.product_name}</span>
            <span style="font-size:12px; color:var(--text-muted);">${p.product_type || '—'}</span>
            <span style="font-size:12px; color:var(--text-muted);">${p.process_type || '—'}</span>
            <span style="font-size:12px; color:var(--text);">${p.operation_count || 0}</span>
            <span style="font-size:13px; color:var(--teal-light); font-weight:500;">${p.total_smv ? parseFloat(p.total_smv).toFixed(3) : '—'}</span>
            <span style="color:var(--text-muted); font-size:16px; display:flex; align-items:center; justify-content:center;">
              <i class="ti ti-chevron-right"></i>
            </span>
          </div>
        </div>`).join('')}
    </div>`;
}

async function openOBProduct(productId) {
  const product = obState.products.find(p => p.id === productId);
  obState.selectedProduct = product;
  obState.isDirty = false;

  const content = document.getElementById('content-area');
  content.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
      <button onclick="loadOB()" style="background:none; border:0.5px solid var(--border); border-radius:8px; padding:6px 10px; color:var(--text-muted); cursor:pointer; font-size:13px;">
        <i class="ti ti-arrow-left"></i> Back
      </button>
      <div style="flex:1;">
        <h2 style="font-family:'Space Grotesk',sans-serif; font-size:16px; font-weight:500; color:var(--text);">${product.product_name}</h2>
        <p style="font-size:11px; color:var(--text-muted);">${product.product_number} · ${product.product_type || ''} · ${product.process_type || ''}</p>
      </div>
      <div id="ob-save-btn" style="display:none;">
        <button onclick="saveOBSettings(${productId})" style="padding:7px 14px; background:var(--teal); border:none; border-radius:8px; color:#fff; font-size:12px; font-weight:500; cursor:pointer;">
          <i class="ti ti-device-floppy"></i> Save changes
        </button>
      </div>
    </div>

    <div style="display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap;">
      <div style="flex:1; min-width:120px; background:var(--surface); border:0.5px solid var(--teal-border); border-radius:10px; padding:14px 18px;">
        <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px; letter-spacing:0.05em;">WORKING EFFICIENCY</div>
        <div style="display:flex; align-items:center; gap:6px;">
          <input id="ob-efficiency" type="number" min="1" max="100" value="85"
            oninput="obSettingChanged()"
            style="width:60px; padding:6px 8px; background:#000000; border:0.5px solid var(--teal-border); border-radius:6px; color:var(--teal-light); font-size:18px; font-weight:600; outline:none; text-align:center;"/>
          <span style="font-size:14px; color:var(--text-muted);">%</span>
        </div>
      </div>
      <div style="flex:1; min-width:120px; background:var(--surface); border:0.5px solid var(--teal-border); border-radius:10px; padding:14px 18px;">
        <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px; letter-spacing:0.05em;">WAGE PER PERSON / DAY</div>
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-size:14px; color:var(--text-muted);">₹</span>
          <input id="ob-wage" type="number" min="1" value="600"
            oninput="obSettingChanged()"
            style="width:80px; padding:6px 8px; background:#000000; border:0.5px solid var(--teal-border); border-radius:6px; color:var(--teal-light); font-size:18px; font-weight:600; outline:none; text-align:center;"/>
        </div>
      </div>
      <div style="flex:1; min-width:120px; background:var(--surface); border:0.5px solid var(--teal-border); border-radius:10px; padding:14px 18px;">
        <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px; letter-spacing:0.05em;">TOTAL SMV</div>
        <div id="ob-summary-smv" style="font-size:18px; font-weight:600; color:var(--teal-light);">—</div>
      </div>
      <div style="flex:1; min-width:120px; background:var(--surface); border:0.5px solid var(--teal-border); border-radius:10px; padding:14px 18px;">
        <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px; letter-spacing:0.05em;">TARGET / DAY</div>
        <div id="ob-summary-tpd" style="font-size:18px; font-weight:600; color:var(--teal-light);">—</div>
      </div>
      <div style="flex:1; min-width:120px; background:var(--surface); border:0.5px solid var(--teal-border); border-radius:10px; padding:14px 18px;">
        <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px; letter-spacing:0.05em;">COST PER PIECE</div>
        <div id="ob-summary-cpp" style="font-size:18px; font-weight:600; color:var(--teal-light);">—</div>
      </div>
    </div>

    <div id="ob-table-container" style="user-select:none; -webkit-user-select:none;">
      <div class="coming-soon"><i class="ti ti-loader"></i><p>Loading OB data...</p></div>
    </div>`;

  const res = await fetch(`/api/ob/${productId}`, {
    headers: { 'Authorization': `Bearer ${obToken}` }
  });
  obState.obData = await res.json();

  if (obState.obData.operations.length) {
    const eff = parseFloat(obState.obData.operations[0].efficiency) * 100;
    const wage = parseFloat(obState.obData.operations[0].wage_per_day);
    document.getElementById('ob-efficiency').value = eff;
    document.getElementById('ob-wage').value = wage;
    obState.efficiency = eff;
    obState.wage = wage;
  }

  renderOBTable();
}

function obSettingChanged() {
  obState.isDirty = true;
  document.getElementById('ob-save-btn').style.display = 'block';
  renderOBTable();
}

function renderOBTable() {
  const container = document.getElementById('ob-table-container');
  const data = obState.obData;
  if (!data || !data.operations.length) {
    container.innerHTML = `<div class="coming-soon"><i class="ti ti-box"></i><p>No operations found.</p></div>`;
    return;
  }

  const efficiency = parseFloat(document.getElementById('ob-efficiency')?.value || obState.efficiency) / 100;
  // wage = single value from input box — used directly for CPP, NOT multiplied by manpower
  const wage = parseFloat(document.getElementById('ob-wage')?.value || obState.wage);
  const maxCycles = data.max_cycles || 0;
  const cycleHeaders = Array.from({ length: maxCycles }, (_, i) => `C${i + 1}`);

  // cycle lookup
  const cycleMap = {};
  data.cycle_matrix.forEach(c => {
    if (!cycleMap[c.operation_id]) cycleMap[c.operation_id] = {};
    cycleMap[c.operation_id][c.cycle_number] = parseFloat(c.cycle_total || 0);
  });

  let totalSMV = 0;

  const rowsData = data.operations.map(op => {
    const manpower = parseInt(op.manpower) || 1;
    const frequency = parseFloat(op.operation_frequency) || 1;
    const avg_time = parseFloat(op.avg_time_sec) || 0;
    const time_per_person = avg_time * manpower;
    const smv = ((time_per_person * frequency) / 60) / efficiency;
    const tph = smv > 0 ? 60 / smv : 0;
    const tpd = tph * 8;
    // HR cost = wage * manpower (shown per operation, informational only)
    const hr_cost = wage * manpower;
    // CPP per operation = wage (raw input) / tpd
    const cpp = tpd > 0 ? wage / tpd : 0;

    totalSMV += smv;
    return { op, manpower, frequency, avg_time, time_per_person, smv, hr_cost, tph, tpd, cpp };
  });

  // Line totals — based on total SMV
  const lineTph = totalSMV > 0 ? 60 / totalSMV : 0;
  const lineTpd = lineTph * 8;
  // Line CPP = wage (single input) / line target per day
  const lineCpp = lineTpd > 0 ? wage / lineTpd : 0;

  const tableHtml = rowsData.map(({ op, manpower, frequency, avg_time, time_per_person, smv, hr_cost, tph, tpd, cpp }) => {
    const cycleCells = Array.from({ length: maxCycles }, (_, i) => {
      const val = cycleMap[op.operation_id]?.[i + 1];
      return `<td style="padding:8px 12px; text-align:center; color:${val !== undefined ? 'var(--text)' : 'var(--text-dim)'}; font-size:12px; border-right:0.5px solid var(--border);">${val !== undefined ? val.toFixed(3) : '—'}</td>`;
    }).join('');

    return `
      <tr style="border-bottom:0.5px solid var(--border);" onmouseover="this.style.background='var(--teal-dim)'" onmouseout="this.style.background='var(--surface)'">
        <td style="padding:8px 12px; font-size:12px; color:var(--text-muted); border-right:0.5px solid var(--border); position:sticky; left:0; background:var(--surface); z-index:1;">${op.operation_priority || '—'}</td>
        <td style="padding:8px 12px; font-size:13px; color:var(--text); font-weight:500; border-right:0.5px solid var(--border); position:sticky; left:48px; background:var(--surface); min-width:160px; z-index:1;">${op.operation_name}</td>
        <td style="padding:8px 12px; font-size:12px; color:var(--text-muted); text-align:center; border-right:0.5px solid var(--border); white-space:nowrap;">${op.machine_type || '—'}</td>
        <td style="padding:8px 12px; font-size:12px; color:var(--text-muted); text-align:center; border-right:0.5px solid var(--border);">${manpower}</td>
        <td style="padding:8px 12px; font-size:12px; color:var(--text-muted); text-align:center; border-right:0.5px solid var(--border);">${frequency}</td>
        <td style="padding:8px 12px; font-size:12px; color:var(--text-muted); text-align:center; border-right:0.5px solid var(--border);">${op.cycle_count || 0}</td>
        ${cycleCells}
        <td style="padding:8px 12px; font-size:12px; color:var(--teal-light); text-align:center; border-right:0.5px solid var(--border); font-weight:500;">${avg_time.toFixed(3)}</td>
        <td style="padding:8px 12px; font-size:12px; color:var(--text); text-align:center; border-right:0.5px solid var(--border);">${time_per_person.toFixed(3)}</td>
        <td style="padding:8px 12px; font-size:13px; color:var(--teal-light); text-align:center; border-right:0.5px solid var(--border); font-weight:500;">${smv.toFixed(3)}</td>
        <td style="padding:8px 12px; font-size:12px; color:var(--text); text-align:center; border-right:0.5px solid var(--border);">${tph.toFixed(0)}</td>
        <td style="padding:8px 12px; font-size:12px; color:var(--text); text-align:center; border-right:0.5px solid var(--border);">${tpd.toFixed(0)}</td>
        <td style="padding:8px 12px; font-size:12px; color:var(--text); text-align:center; border-right:0.5px solid var(--border);">₹${hr_cost.toFixed(2)}</td>
        <td style="padding:8px 12px; font-size:12px; color:var(--teal-light); text-align:center; font-weight:500;">₹${cpp.toFixed(2)}</td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div id="ob-scroll-wrapper" style="overflow-x:auto; overflow-y:visible; max-height:none; border:0.5px solid var(--teal-border); border-radius:12px; max-width:100%; box-sizing:border-box; display:block;">
      <table style="border-collapse:collapse; table-layout:fixed; width:1600px;">
        <thead>
          <tr style="background:var(--sidebar-bg); border-bottom:0.5px solid var(--teal-border);">
            <th style="padding:10px 12px; font-size:10px; color:var(--text-muted); letter-spacing:0.05em; text-align:left; border-right:0.5px solid var(--border); position:sticky; left:0; background:var(--sidebar-bg); z-index:2; white-space:nowrap;">PRI</th>
            <th style="padding:10px 12px; font-size:10px; color:var(--text-muted); letter-spacing:0.05em; text-align:left; border-right:0.5px solid var(--border); position:sticky; left:48px; background:var(--sidebar-bg); min-width:160px; z-index:2; white-space:nowrap;">OPERATION</th>
            <th style="padding:10px 12px; font-size:10px; color:var(--text-muted); letter-spacing:0.05em; text-align:center; border-right:0.5px solid var(--border); white-space:nowrap;">MACHINE</th>
            <th style="padding:10px 12px; font-size:10px; color:var(--text-muted); letter-spacing:0.05em; text-align:center; border-right:0.5px solid var(--border); white-space:nowrap;">M/P</th>
            <th style="padding:10px 12px; font-size:10px; color:var(--text-muted); letter-spacing:0.05em; text-align:center; border-right:0.5px solid var(--border); white-space:nowrap;">FREQ</th>
            <th style="padding:10px 12px; font-size:10px; color:var(--text-muted); letter-spacing:0.05em; text-align:center; border-right:0.5px solid var(--border); white-space:nowrap;">CYCLES</th>
            ${cycleHeaders.map(c => `<th style="padding:10px 12px; font-size:10px; color:var(--teal-light); letter-spacing:0.05em; text-align:center; border-right:0.5px solid var(--border); white-space:nowrap;">${c}</th>`).join('')}
            <th style="padding:10px 12px; font-size:10px; color:var(--teal-light); letter-spacing:0.05em; text-align:center; border-right:0.5px solid var(--border); white-space:nowrap;">AVG (sec)</th>
            <th style="padding:10px 12px; font-size:10px; color:var(--text-muted); letter-spacing:0.05em; text-align:center; border-right:0.5px solid var(--border); white-space:nowrap;">T/PERSON</th>
            <th style="padding:10px 12px; font-size:10px; color:var(--teal-light); letter-spacing:0.05em; text-align:center; border-right:0.5px solid var(--border); white-space:nowrap;">SMV</th>
            <th style="padding:10px 12px; font-size:10px; color:var(--text-muted); letter-spacing:0.05em; text-align:center; border-right:0.5px solid var(--border); white-space:nowrap;">T/HR</th>
            <th style="padding:10px 12px; font-size:10px; color:var(--text-muted); letter-spacing:0.05em; text-align:center; border-right:0.5px solid var(--border); white-space:nowrap;">T/DAY</th>
            <th style="padding:10px 12px; font-size:10px; color:var(--text-muted); letter-spacing:0.05em; text-align:center; border-right:0.5px solid var(--border); white-space:nowrap;">HR COST</th>
            <th style="padding:10px 12px; font-size:10px; color:var(--teal-light); letter-spacing:0.05em; text-align:center; white-space:nowrap;">CPP</th>
          </tr>
        </thead>
        <tbody>
          ${tableHtml}
          <tr style="background:var(--sidebar-bg); border-top:0.5px solid var(--teal-border);">
          <td style="padding:10px 12px; font-size:11px; color:var(--text-muted); letter-spacing:0.05em; font-weight:500; border-right:0.5px solid var(--border); position:sticky; left:0; background:var(--sidebar-bg); z-index:2; white-space:nowrap;">LINE</td>
          <td style="padding:10px 12px; font-size:11px; color:var(--text-muted); font-weight:500; border-right:0.5px solid var(--border); position:sticky; left:48px; background:var(--sidebar-bg); z-index:2; white-space:nowrap;">TOTALS</td>
          <td style="padding:10px 12px; border-right:0.5px solid var(--border); background:var(--sidebar-bg);"></td>
          <td style="padding:10px 12px; border-right:0.5px solid var(--border); background:var(--sidebar-bg);"></td>
          <td style="padding:10px 12px; border-right:0.5px solid var(--border); background:var(--sidebar-bg);"></td>
          <td style="padding:10px 12px; border-right:0.5px solid var(--border); background:var(--sidebar-bg);"></td>
          ${Array.from({length: maxCycles}, () => `<td style="padding:10px 12px; border-right:0.5px solid var(--border); background:var(--sidebar-bg);"></td>`).join('')}
          <td style="padding:10px 12px; border-right:0.5px solid var(--border); background:var(--sidebar-bg);"></td>
          <td style="padding:10px 12px; border-right:0.5px solid var(--border); background:var(--sidebar-bg);"></td>
          <td style="padding:10px 12px; font-size:14px; color:var(--teal-light); font-weight:600; text-align:center; border-right:0.5px solid var(--border); background:var(--sidebar-bg);">${totalSMV.toFixed(3)}</td>
          <td style="padding:10px 12px; font-size:12px; color:var(--text); text-align:center; border-right:0.5px solid var(--border); background:var(--sidebar-bg);">${lineTph.toFixed(0)}</td>
          <td style="padding:10px 12px; font-size:14px; color:var(--teal-light); font-weight:600; text-align:center; border-right:0.5px solid var(--border); background:var(--sidebar-bg);">${lineTpd.toFixed(0)}</td>
          <td style="padding:10px 12px; border-right:0.5px solid var(--border); background:var(--sidebar-bg);"></td>
          <td style="padding:10px 12px; font-size:14px; color:var(--teal-light); font-weight:600; text-align:center; background:var(--sidebar-bg);">₹${lineCpp.toFixed(2)}</td>
        </tr>
        </tbody>
      </table>
    </div>`;

  // Update summary boxes
  document.getElementById('ob-summary-smv').textContent = totalSMV.toFixed(3);
  document.getElementById('ob-summary-tpd').textContent = lineTpd.toFixed(0);
  document.getElementById('ob-summary-cpp').textContent = '₹' + lineCpp.toFixed(2);
}

async function saveOBSettings(productId) {
  const efficiency = document.getElementById('ob-efficiency').value;
  const wage = document.getElementById('ob-wage').value;

  const res = await fetch(`/api/ob/${productId}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${obToken}` },
    body: JSON.stringify({ efficiency, wage_per_day: wage })
  });

  if (res.ok) {
    obState.isDirty = false;
    document.getElementById('ob-save-btn').style.display = 'none';
    obState.efficiency = parseFloat(efficiency);
    obState.wage = parseFloat(wage);
    const dataRes = await fetch(`/api/ob/${productId}`, {
      headers: { 'Authorization': `Bearer ${obToken}` }
    });
    obState.obData = await dataRes.json();
    renderOBTable();
  }
}

function exportOB(productId) {
  alert('Export to Sheets — coming soon with subscription.');
}