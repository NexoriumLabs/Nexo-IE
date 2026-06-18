
const ltToken = localStorage.getItem('token');

const LT_REASONS = [
  'Trims not available',
  'Cutting not available',
  'Machine problem',
  'Training',
  'Quality issue',
  'Waiting for work / Idle',
  'Power cut',
  'Maintenance',
  'Absenteeism',
  'Custom'
];

let ltState = {
  todayEntries: [],
  chartData: {},
  selectedEntry: null
};

async function loadLossTime() {
  const content = document.getElementById('content-area');
  const today = new Date();

  content.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <div>
        <h2 style="font-family:'Space Grotesk',sans-serif; font-size:18px; font-weight:500; color:var(--text);">Loss time monitor</h2>
        <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">Identify and track reasons for lost production time.</p>
      </div>
      <button onclick="loadLossTimeHistory()" style="padding:7px 14px; background:none; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--teal-light); font-size:12px; cursor:pointer;">
        <i class="ti ti-history"></i> Previous dates
      </button>
    </div>

    <!-- Summary blocks — cumulative reason % -->
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:20px;">
      ${['cutting','sewing','finishing'].map(p => `
        <div style="background:#0d2020; border:0.5px solid var(--teal-border); border-radius:10px; padding:14px 16px;">
          <div style="font-size:10px; color:var(--text-muted); letter-spacing:0.08em; margin-bottom:10px;">${p.toUpperCase()}</div>
          <div style="font-size:10px; color:var(--text-dim); margin-bottom:4px;">TOTAL LOSS</div>
          <div id="lt-sum-${p}" style="font-size:22px; font-weight:600; color:var(--teal-light); font-family:'Space Grotesk',sans-serif;">—</div>
          <div id="lt-top-reason-${p}" style="font-size:11px; color:var(--text-muted); margin-top:4px;">—</div>
        </div>`).join('')}
    </div>

    <!-- Main layout -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; align-items:start;">

      <!-- LEFT: Today's efficiency entries -->
      <div>
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px; letter-spacing:0.05em;">
          TODAY'S ENTRIES — ${today.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
        </div>
        <div id="lt-entries-list">
          <div class="coming-soon"><i class="ti ti-loader"></i><p>Loading...</p></div>
        </div>
      </div>

      <!-- RIGHT: Reason breakdown chart -->
      <div>
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px; letter-spacing:0.05em;">REASON BREAKDOWN — TODAY</div>
        <div style="background:#0d2020; border:0.5px solid var(--teal-border); border-radius:12px; padding:16px;">
          <div id="lt-reason-chart">
            <div style="color:var(--text-dim); font-size:12px; text-align:center; padding:40px 0;">No loss time recorded today</div>
          </div>
        </div>
      </div>
    </div>`;

  await ltLoadTodayData();
}

async function ltLoadTodayData() {
  const today = new Date().toISOString().split('T')[0];

  const [effRes, ltRes] = await Promise.all([
    fetch(`/api/efficiency/today?date=${today}`, { headers: { 'Authorization': `Bearer ${ltToken}` } }),
    fetch(`/api/losstime/today?date=${today}`, { headers: { 'Authorization': `Bearer ${ltToken}` } })
  ]);

  ltState.todayEntries = await effRes.json();
  const ltData = await ltRes.json();

  ltRenderEntriesList(ltData);
  ltRenderReasonChart(ltData);
  ltUpdateSummaryBlocks(ltData);
}

function ltRenderEntriesList(ltData) {
  const container = document.getElementById('lt-entries-list');
  if (!ltState.todayEntries.length) {
    container.innerHTML = `<div class="coming-soon"><i class="ti ti-clock-pause"></i><h2>No entries today</h2><p>Add entries in Efficiency tracker first.</p></div>`;
    return;
  }

  // Build map of how many loss reasons already logged per efficiency entry
  const loggedMap = {};
  ltData.forEach(r => {
    if (!loggedMap[r.efficiency_entry_id]) loggedMap[r.efficiency_entry_id] = 0;
    loggedMap[r.efficiency_entry_id]++;
  });

  container.innerHTML = ltState.todayEntries.map(entry => {
    const lossMin = parseFloat(entry.available_minutes) - parseFloat(entry.produced_minutes);
    const logged = loggedMap[entry.id] || 0;
    const hasLoss = lossMin > 0;
    const lossColor = lossMin > 60 ? '#F09995' : lossMin > 30 ? '#f0c040' : 'var(--teal-light)';

    return `
      <div onclick="ltOpenEntry(${entry.id})"
        style="background:#0d2020; border:0.5px solid ${logged > 0 ? 'var(--teal-border)' : 'rgba(255,255,255,0.08)'}; border-radius:10px; padding:14px 16px; margin-bottom:10px; cursor:pointer; transition:border-color 0.15s;"
        onmouseover="this.style.borderColor='var(--teal-border)'" onmouseout="this.style.borderColor='${logged > 0 ? 'var(--teal-border)' : 'rgba(255,255,255,0.08)'}'">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <div>
            <div style="font-size:13px; font-weight:500; color:var(--text);">${entry.product_name || 'Unknown product'}</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
              ${(entry.process_type || '').charAt(0).toUpperCase() + (entry.process_type || '').slice(1)} · 
              ${entry.process_type === 'cutting' ? 'Table' : 'Line'} ${entry.line_no} · 
              ${entry.manpower} operators
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:18px; font-weight:600; color:${lossColor}; font-family:'Space Grotesk',sans-serif;">${lossMin.toFixed(0)}</div>
            <div style="font-size:10px; color:var(--text-dim);">loss min</div>
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; gap:12px;">
            <div>
              <span style="font-size:10px; color:var(--text-dim);">EFF </span>
              <span style="font-size:12px; color:${parseFloat(entry.efficiency_percent) >= 75 ? 'var(--teal-light)' : '#f0c040'}; font-weight:500;">${parseFloat(entry.efficiency_percent).toFixed(1)}%</span>
            </div>
            <div>
              <span style="font-size:10px; color:var(--text-dim);">OUTPUT </span>
              <span style="font-size:12px; color:var(--text);">${entry.output}</span>
            </div>
          </div>
          <div style="font-size:11px; color:${logged > 0 ? 'var(--teal-light)' : 'var(--text-dim)'};">
            ${logged > 0 ? `${logged} reason${logged > 1 ? 's' : ''} logged` : 'No reasons logged'}
            <i class="ti ti-chevron-right" style="margin-left:4px;"></i>
          </div>
        </div>
      </div>`;
  }).join('');
}

async function ltOpenEntry(efficiencyEntryId) {
  const entry = ltState.todayEntries.find(e => e.id === efficiencyEntryId);
  if (!entry) return;
  ltState.selectedEntry = entry;

  const lossMin = parseFloat(entry.available_minutes) - parseFloat(entry.produced_minutes);

  const content = document.getElementById('content-area');
  content.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
      <button onclick="loadLossTime()" style="background:none; border:0.5px solid var(--border); border-radius:8px; padding:6px 10px; color:var(--text-muted); cursor:pointer; font-size:13px;">
        <i class="ti ti-arrow-left"></i> Back
      </button>
      <div style="flex:1;">
        <h2 style="font-family:'Space Grotesk',sans-serif; font-size:16px; font-weight:500; color:var(--text);">${entry.product_name}</h2>
        <p style="font-size:11px; color:var(--text-muted);">
          ${(entry.process_type||'').charAt(0).toUpperCase()+(entry.process_type||'').slice(1)} · 
          ${entry.process_type === 'cutting' ? 'Table' : 'Line'} ${entry.line_no} · 
          ${new Date().toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})}
        </p>
      </div>
      <div style="background:#0d2020; border:0.5px solid var(--teal-border); border-radius:10px; padding:10px 16px; text-align:center;">
        <div style="font-size:10px; color:var(--text-muted); margin-bottom:2px;">RECORDED LOSS</div>
        <div style="font-size:20px; font-weight:600; color:#f0c040; font-family:'Space Grotesk',sans-serif;">${lossMin.toFixed(0)} min</div>
      </div>
    </div>

    <!-- Reason rows -->
    <div style="background:#0d2020; border:0.5px solid var(--teal-border); border-radius:12px; padding:20px; margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="font-size:13px; font-weight:500; color:var(--text);">Loss reasons</div>
        <button onclick="ltAddReasonRow()" style="padding:6px 12px; background:none; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--teal-light); font-size:12px; cursor:pointer;">
          <i class="ti ti-plus"></i> Add reason
        </button>
      </div>
      <div id="lt-reason-rows"></div>
      <div id="lt-rows-summary" style="display:none; margin-top:12px; padding-top:12px; border-top:0.5px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:12px; color:var(--text-muted);">Total assigned: <span id="lt-total-assigned" style="color:var(--teal-light); font-weight:500;">0</span> min</span>
        <span style="font-size:12px; color:var(--text-muted);">Unaccounted: <span id="lt-unaccounted" style="color:var(--text);">0</span> min</span>
      </div>
      <button onclick="ltSaveReasons(${efficiencyEntryId})" style="width:100%; margin-top:16px; padding:10px; background:var(--teal); border:none; border-radius:8px; color:#fff; font-size:13px; font-weight:500; cursor:pointer;">
        <i class="ti ti-device-floppy"></i> Save reasons
      </button>
      <p id="lt-save-msg" style="font-size:12px; text-align:center; margin-top:8px; min-height:16px;"></p>
    </div>

    <!-- Breakdown chart for this entry -->
    <div style="background:#0d2020; border:0.5px solid var(--teal-border); border-radius:12px; padding:20px;">
      <div style="font-size:13px; font-weight:500; color:var(--text); margin-bottom:16px;">Reason breakdown</div>
      <div id="lt-entry-chart">
        <div style="color:var(--text-dim); font-size:12px; text-align:center; padding:20px 0;">Add reasons above to see breakdown</div>
      </div>
    </div>`;

  // Load existing reasons for this entry
  const res = await fetch(`/api/losstime/entry/${efficiencyEntryId}`, {
    headers: { 'Authorization': `Bearer ${ltToken}` }
  });
  const existing = await res.json();

  if (existing.length) {
    existing.forEach(r => ltAddReasonRow(r.loss_time_reason, r.loss_minutes_recorded, r.loss_time_category));
    ltUpdateReasonSummary(lossMin);
    ltRenderEntryChart(existing, lossMin);
  } else {
    ltAddReasonRow();
  }
}

let ltRowCount = 0;
function ltAddReasonRow(existingReason = '', existingMinutes = '', existingCategory = '') {
  ltRowCount++;
  const rowId = `lt-row-${ltRowCount}`;
  const container = document.getElementById('lt-reason-rows');
  const div = document.createElement('div');
  div.id = rowId;
  div.style.cssText = 'display:grid; grid-template-columns:1fr 120px 32px; gap:10px; margin-bottom:10px; align-items:start;';

  const isCustom = existingReason && !LT_REASONS.slice(0,-1).includes(existingReason);
  const selectedCategory = isCustom ? 'Custom' : (existingReason || '');

  div.innerHTML = `
    <div>
      <select id="${rowId}-reason" onchange="ltReasonChanged('${rowId}')"
        style="width:100%; padding:9px 12px; background:#060f0f; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:13px; outline:none; margin-bottom:6px;">
        <option value="">Select reason...</option>
        ${LT_REASONS.map(r => `<option value="${r}" ${(isCustom ? 'Custom' : existingReason) === r ? 'selected' : ''}>${r}</option>`).join('')}
      </select>
      <input id="${rowId}-custom" type="text" placeholder="Describe the reason..."
        value="${isCustom ? existingReason : ''}"
        style="width:100%; padding:9px 12px; background:#060f0f; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:13px; outline:none; display:${isCustom ? 'block' : 'none'};"
        oninput="ltUpdateReasonSummary(${parseFloat(ltState.selectedEntry?.available_minutes||0) - parseFloat(ltState.selectedEntry?.produced_minutes||0)})" />
    </div>
    <div>
      <input id="${rowId}-minutes" type="number" min="0" step="1" placeholder="Minutes"
        value="${existingMinutes}"
        oninput="ltUpdateReasonSummary(${parseFloat(ltState.selectedEntry?.available_minutes||0) - parseFloat(ltState.selectedEntry?.produced_minutes||0)})"
        style="width:100%; padding:9px 12px; background:#060f0f; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--text); font-size:13px; outline:none;" />
    </div>
    <button onclick="document.getElementById('${rowId}').remove(); ltUpdateReasonSummary(${parseFloat(ltState.selectedEntry?.available_minutes||0) - parseFloat(ltState.selectedEntry?.produced_minutes||0)})"
      style="padding:9px; background:none; border:0.5px solid var(--border); border-radius:8px; color:var(--text-muted); cursor:pointer; font-size:13px; margin-top:0;">
      <i class="ti ti-trash"></i>
    </button>`;

  container.appendChild(div);
  document.getElementById('lt-rows-summary').style.display = 'flex';
}

function ltReasonChanged(rowId) {
  const val = document.getElementById(`${rowId}-reason`).value;
  const customInput = document.getElementById(`${rowId}-custom`);
  customInput.style.display = val === 'Custom' ? 'block' : 'none';
}

function ltUpdateReasonSummary(totalLoss) {
  const rows = document.querySelectorAll('[id^="lt-row-"]');
  let total = 0;
  rows.forEach(row => {
    const minInput = row.querySelector('[id$="-minutes"]');
    if (minInput) total += parseFloat(minInput.value) || 0;
  });
  const unaccounted = totalLoss - total;
  const el = document.getElementById('lt-total-assigned');
  const el2 = document.getElementById('lt-unaccounted');
  if (el) el.textContent = total.toFixed(0);
  if (el2) {
    el2.textContent = unaccounted.toFixed(0);
    el2.style.color = unaccounted < 0 ? '#F09995' : unaccounted === 0 ? 'var(--teal-light)' : 'var(--text)';
  }
}

async function ltSaveReasons(efficiencyEntryId) {
  const msg = document.getElementById('lt-save-msg');
  const entry = ltState.selectedEntry;
  const rows = document.querySelectorAll('[id^="lt-row-"]');
  const reasons = [];

  rows.forEach(row => {
    const reasonSelect = row.querySelector('[id$="-reason"]');
    const customInput = row.querySelector('[id$="-custom"]');
    const minutesInput = row.querySelector('[id$="-minutes"]');
    if (!reasonSelect || !minutesInput) return;

    const category = reasonSelect.value;
    const reason = category === 'Custom' ? (customInput?.value?.trim() || 'Custom') : category;
    const minutes = parseFloat(minutesInput.value) || 0;

    if (category && minutes > 0) {
      reasons.push({ category, reason, minutes });
    }
  });

  if (!reasons.length) {
    msg.style.color = '#F09995';
    msg.textContent = 'Add at least one reason with minutes.';
    return;
  }

  const totalLoss = parseFloat(entry.available_minutes) - parseFloat(entry.produced_minutes);

  const res = await fetch('/api/losstime/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ltToken}` },
    body: JSON.stringify({
      efficiency_entry_id: efficiencyEntryId,
      product_id: entry.product_id,
      line_no: entry.line_no,
      process_type: entry.process_type,
      total_loss_minutes: totalLoss,
      reasons
    })
  });

  if (res.ok) {
    msg.style.color = '#5DCAA5';
    msg.textContent = 'Saved.';
    // Reload chart
    const dataRes = await fetch(`/api/losstime/entry/${efficiencyEntryId}`, {
      headers: { 'Authorization': `Bearer ${ltToken}` }
    });
    const data = await dataRes.json();
    ltRenderEntryChart(data, totalLoss);
    setTimeout(() => { msg.textContent = ''; }, 2000);
  } else {
    msg.style.color = '#F09995';
    msg.textContent = 'Save failed.';
  }
}

function ltRenderEntryChart(reasons, totalLoss) {
  const container = document.getElementById('lt-entry-chart');
  if (!reasons.length) return;

  // Aggregate by reason
  const agg = {};
  reasons.forEach(r => {
    const key = r.loss_time_reason;
    if (!agg[key]) agg[key] = 0;
    agg[key] += parseFloat(r.loss_minutes_recorded);
  });

  const total = Object.values(agg).reduce((s, v) => s + v, 0);
  const colors = ['var(--teal-light)', '#85B7EB', '#f0c040', '#F09995', '#a78bfa', '#34d399', '#fb923c', '#e879f9', '#38bdf8', '#4ade80'];

  container.innerHTML = Object.entries(agg).map(([reason, mins], i) => {
    const pct = total > 0 ? (mins / total) * 100 : 0;
    const color = colors[i % colors.length];
    return `
      <div style="margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="font-size:12px; color:var(--text);">${reason}</span>
          <span style="font-size:12px; color:${color}; font-weight:500;">${pct.toFixed(1)}% · ${mins.toFixed(0)} min</span>
        </div>
        <div style="height:8px; background:rgba(255,255,255,0.06); border-radius:4px; overflow:hidden;">
          <div style="height:100%; width:${pct}%; background:${color}; border-radius:4px; transition:width 0.4s;"></div>
        </div>
      </div>`;
  }).join('');
}

function ltRenderReasonChart(ltData) {
  const container = document.getElementById('lt-reason-chart');
  if (!ltData.length) return;

  const agg = {};
  ltData.forEach(r => {
    const key = r.loss_time_reason;
    if (!agg[key]) agg[key] = 0;
    agg[key] += parseFloat(r.loss_minutes_recorded);
  });

  const total = Object.values(agg).reduce((s, v) => s + v, 0);
  const colors = ['var(--teal-light)', '#85B7EB', '#f0c040', '#F09995', '#a78bfa', '#34d399', '#fb923c', '#e879f9', '#38bdf8', '#4ade80'];

  container.innerHTML = Object.entries(agg).sort((a,b) => b[1]-a[1]).map(([reason, mins], i) => {
    const pct = total > 0 ? (mins / total) * 100 : 0;
    const color = colors[i % colors.length];
    return `
      <div style="margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span style="font-size:12px; color:var(--text);">${reason}</span>
          <span style="font-size:12px; color:${color}; font-weight:500;">${pct.toFixed(1)}%</span>
        </div>
        <div style="height:8px; background:rgba(255,255,255,0.06); border-radius:4px; overflow:hidden;">
          <div style="height:100%; width:${pct}%; background:${color}; border-radius:4px; transition:width 0.4s;"></div>
        </div>
      </div>`;
  }).join('');
}

function ltUpdateSummaryBlocks(ltData) {
  ['cutting','sewing','finishing'].forEach(process => {
    const rows = ltData.filter(r => r.process_type === process);
    const el = document.getElementById(`lt-sum-${process}`);
    const topEl = document.getElementById(`lt-top-reason-${process}`);
    if (!rows.length) return;

    const total = rows.reduce((s,r) => s + parseFloat(r.loss_minutes_recorded), 0);
    if (el) el.textContent = total.toFixed(0) + ' min';

    const agg = {};
    rows.forEach(r => {
      if (!agg[r.loss_time_reason]) agg[r.loss_time_reason] = 0;
      agg[r.loss_time_reason] += parseFloat(r.loss_minutes_recorded);
    });
    const top = Object.entries(agg).sort((a,b) => b[1]-a[1])[0];
    if (topEl && top) topEl.textContent = `Top: ${top[0]}`;
  });
}

async function loadLossTimeHistory() {
  const content = document.getElementById('content-area');
  content.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
      <button onclick="loadLossTime()" style="background:none; border:0.5px solid var(--border); border-radius:8px; padding:6px 10px; color:var(--text-muted); cursor:pointer; font-size:13px;">
        <i class="ti ti-arrow-left"></i> Back
      </button>
      <div>
        <h2 style="font-family:'Space Grotesk',sans-serif; font-size:16px; font-weight:500; color:var(--text);">Loss time history</h2>
        <p style="font-size:11px; color:var(--text-muted);">All recorded loss reasons</p>
      </div>
    </div>

    <!-- View tabs -->
    <div style="display:flex; gap:8px; margin-bottom:20px;">
      ${['Daily','Weekly','Monthly'].map((v,i) => `
        <button onclick="ltHistoryView('${v.toLowerCase()}')" id="lt-view-${v.toLowerCase()}"
          style="padding:7px 16px; border-radius:8px; border:0.5px solid var(--teal-border); background:${i===0?'var(--teal-dim)':'transparent'}; color:${i===0?'var(--teal-light)':'var(--text-muted)'}; font-size:12px; cursor:pointer;">
          ${v}
        </button>`).join('')}
    </div>

    <div id="lt-history-content">
      <div class="coming-soon"><i class="ti ti-loader"></i><p>Loading...</p></div>
    </div>`;

  const res = await fetch('/api/losstime/history', {
    headers: { 'Authorization': `Bearer ${ltToken}` }
  });
  ltState.historyData = await res.json();
  ltHistoryView('daily');
}

function ltHistoryView(view) {
  ['daily','weekly','monthly'].forEach(v => {
    const btn = document.getElementById(`lt-view-${v}`);
    if (!btn) return;
    btn.style.background = v === view ? 'var(--teal-dim)' : 'transparent';
    btn.style.color = v === view ? 'var(--teal-light)' : 'var(--text-muted)';
  });

  const data = ltState.historyData || [];
  const container = document.getElementById('lt-history-content');

  if (!data.length) {
    container.innerHTML = `<div class="coming-soon"><i class="ti ti-clock-pause"></i><h2>No history yet</h2></div>`;
    return;
  }

  // Group data
  const grouped = {};
  data.forEach(r => {
    const rawDate = r.date.toString().split('T')[0];
    const [yr, mo, dy] = rawDate.split('-').map(Number);
    let key;
    if (view === 'daily') key = rawDate;
    else if (view === 'weekly') {
      const d = new Date(yr, mo-1, dy);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else {
      key = `${yr}-${String(mo).padStart(2,'0')}`;
    }
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });

  const colors = ['var(--teal-light)', '#85B7EB', '#f0c040', '#F09995', '#a78bfa', '#34d399', '#fb923c'];

  container.innerHTML = Object.keys(grouped).sort((a,b) => b.localeCompare(a)).map(key => {
    const rows = grouped[key];
    let label;
    if (view === 'daily') {
      const [yr,mo,dy] = key.split('-').map(Number);
      label = new Date(yr,mo-1,dy).toLocaleDateString('en-IN', {weekday:'short', day:'numeric', month:'short', year:'numeric'});
    } else if (view === 'weekly') {
      const [yr,mo,dy] = key.split('-').map(Number);
      const start = new Date(yr,mo-1,dy);
      const end = new Date(start); end.setDate(start.getDate()+6);
      label = `Week of ${start.toLocaleDateString('en-IN',{day:'numeric',month:'short'})} – ${end.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`;
    } else {
      const [yr,mo] = key.split('-');
      label = new Date(parseInt(yr), parseInt(mo)-1, 1).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
    }

    const totalLoss = rows.reduce((s,r) => s + parseFloat(r.loss_minutes_recorded), 0);
    const agg = {};
    rows.forEach(r => {
      if (!agg[r.loss_time_reason]) agg[r.loss_time_reason] = 0;
      agg[r.loss_time_reason] += parseFloat(r.loss_minutes_recorded);
    });

    return `
      <div style="margin-bottom:20px; background:#0d2020; border:0.5px solid var(--teal-border); border-radius:12px; padding:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <div style="font-size:13px; font-weight:500; color:var(--teal-light);">${label}</div>
          <div style="font-size:12px; color:var(--text-muted);">Total loss: <span style="color:var(--text); font-weight:500;">${totalLoss.toFixed(0)} min</span></div>
        </div>
        ${Object.entries(agg).sort((a,b)=>b[1]-a[1]).map(([reason, mins], i) => {
          const pct = totalLoss > 0 ? (mins/totalLoss)*100 : 0;
          const color = colors[i % colors.length];
          return `
            <div style="margin-bottom:8px;">
              <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                <span style="font-size:12px; color:var(--text);">${reason}</span>
                <span style="font-size:12px; color:${color}; font-weight:500;">${pct.toFixed(1)}% · ${mins.toFixed(0)} min</span>
              </div>
              <div style="height:6px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden;">
                <div style="height:100%; width:${pct}%; background:${color}; border-radius:3px;"></div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }).join('');
}