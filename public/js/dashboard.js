const dbToken = localStorage.getItem('token');

async function loadDashboard() {
  const content = document.getElementById('content-area');
  content.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
      <div>
        <h2 style="font-family:'Space Grotesk',sans-serif; font-size:18px; font-weight:500; color:var(--text);">Dashboard</h2>
        <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">Overview of your production floor.</p>
      </div>
      <div style="font-size:12px; color:var(--text-muted);">
        ${new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
      </div>
    </div>
    <div id="db-content">
      <div class="coming-soon"><i class="ti ti-loader"></i><p>Loading dashboard...</p></div>
    </div>`;

  try {
    const [effRes, ltRes, obRes] = await Promise.all([
      fetch(`/api/efficiency/history`, { headers: { 'Authorization': `Bearer ${dbToken}` } }),
      fetch(`/api/losstime/history`, { headers: { 'Authorization': `Bearer ${dbToken}` } }),
      fetch(`/api/ob/products`, { headers: { 'Authorization': `Bearer ${dbToken}` } })
    ]);

    const [effAll, ltAll, obProducts] = await Promise.all([
      effRes.json(), ltRes.json(), obRes.json()
    ]);

    // Get OB details for each product
    if (!Array.isArray(obProducts)) { console.error('obProducts not array:', obProducts); }
    const safeObProducts = Array.isArray(obProducts) ? obProducts : [];
    const obDetails = await Promise.all(
  safeObProducts.filter(p => p.operation_count > 0).map(p =>
        fetch(`/api/ob/${p.id}`, { headers: { 'Authorization': `Bearer ${dbToken}` } })
          .then(r => r.json())
          .then(d => ({ ...p, operations: d.operations }))
      )
    );

    renderDashboard(effAll, ltAll, obDetails);
  } catch (err) {
    console.error(err);
    document.getElementById('db-content').innerHTML = `<div class="coming-soon"><p>Failed to load dashboard.</p></div>`;
  }
}

function renderDashboard(effAll, ltAll, obProducts) {
  const today = new Date().toISOString().split('T')[0];
  const effToday = effAll.filter(r => r.date?.toString().split('T')[0] === today);
  const ltToday = ltAll.filter(r => r.date?.toString().split('T')[0] === today);

  const container = document.getElementById('db-content');
  container.innerHTML = `
    <!-- SECTION: WORKSPACE -->
    <div style="margin-bottom:32px;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
        <div style="width:3px; height:16px; background:var(--teal); border-radius:2px;"></div>
        <span style="font-size:11px; color:var(--text-muted); letter-spacing:0.1em; font-weight:500;">WORKSPACE</span>
        <div style="flex:1; height:0.5px; background:var(--border);"></div>
      </div>
      <div id="db-workspace"></div>
    </div>

    <!-- SECTION: TRACKING -->
    <div style="margin-bottom:32px;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
        <div style="width:3px; height:16px; background:var(--teal); border-radius:2px;"></div>
        <span style="font-size:11px; color:var(--text-muted); letter-spacing:0.1em; font-weight:500;">TRACKING</span>
        <div style="flex:1; height:0.5px; background:var(--border);"></div>
      </div>
      <div id="db-tracking"></div>
    </div>`;

  renderWorkspace(obProducts);
  renderTracking(effAll, effToday, ltAll, ltToday);
}

// ── WORKSPACE ─────────────────────────────────────────────────────────────────

function renderWorkspace(obProducts) {
  const container = document.getElementById('db-workspace');

  if (!obProducts.length) {
    container.innerHTML = `<div style="background:var(--surface); border:0.5px solid var(--teal-border); border-radius:12px; padding:32px; text-align:center; color:var(--text-muted); font-size:13px;">No OB data yet. Complete time studies to see product health.</div>`;
    return;
  }

  // Score each product by issues
  const scored = obProducts.map(p => {
    const ops = p.operations || [];
    const efficiency = ops.length ? parseFloat(ops[0].efficiency) || 0.85 : 0.85;
    let critical = 0, warning = 0, balanced = 0;
    const computed = ops.map(op => {
      const smv = parseFloat(op.smv) || 0;
      return smv;
    });
    computed.forEach((smv, i) => {
      let status = 'balanced';
      if (smv > 2.0) { status = 'critical'; }
      else {
        const prev = i > 0 ? computed[i-1] : null;
        const next = i < computed.length-1 ? computed[i+1] : null;
        const diffs = [];
        if (prev !== null) diffs.push(Math.abs(smv - prev));
        if (next !== null) diffs.push(Math.abs(smv - next));
        const maxDiff = diffs.length ? Math.max(...diffs) : 0;
        if (maxDiff > 0.20) status = 'critical';
        else if (maxDiff >= 0.08) status = 'warning';
      }
      if (status === 'critical') critical++;
      else if (status === 'warning') warning++;
      else balanced++;
    });
    const totalSMV = ops.reduce((s, op) => s + (parseFloat(op.smv) || 0), 0);
    const lineTpd = totalSMV > 0 ? (60 / totalSMV) * 8 : 0;
    const avgCpp = ops.length ? ops.reduce((s, op) => s + (parseFloat(op.cost_per_piece) || 0), 0) / ops.length : 0;
    return { ...p, critical, warning, balanced, totalSMV, lineTpd, avgCpp, score: critical * 10 + warning };
  }).sort((a, b) => b.score - a.score);

  const top5 = scored.slice(0, 5);
  const rest = scored.slice(5);

  const cardHtml = (p, faded) => {
    const total = (p.critical + p.warning + p.balanced) || 1;
    const critPct = (p.critical / total) * 100;
    const warnPct = (p.warning / total) * 100;
    const balPct = (p.balanced / total) * 100;
    const statusColor = p.critical > 0 ? '#F09995' : p.warning > 0 ? '#f0c040' : 'var(--teal-light)';
    const borderColor = p.critical > 0 ? 'rgba(240,153,149,0.25)' : p.warning > 0 ? 'rgba(240,192,64,0.2)' : 'var(--teal-border)';

    return `
      <div style="background:var(--surface); border:0.5px solid ${borderColor}; border-radius:12px; padding:16px; opacity:${faded?'0.55':'1'}; transition:opacity 0.2s;"
        onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='${faded?'0.45':'1'}'">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
          <div>
            <div style="font-size:11px; color:var(--teal-light); letter-spacing:0.05em; margin-bottom:2px;">${p.product_number}</div>
            <div style="font-size:13px; font-weight:500; color:var(--text);">${p.product_name}</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:1px;">${p.process_type || '—'}</div>
          </div>
          ${p.critical > 0 ? `<span style="font-size:9px; padding:2px 7px; border-radius:20px; background:rgba(240,153,149,0.1); color:#F09995; border:0.5px solid rgba(240,153,149,0.25); font-weight:600; letter-spacing:0.05em;">${p.critical} CRITICAL</span>` :
            p.warning > 0 ? `<span style="font-size:9px; padding:2px 7px; border-radius:20px; background:rgba(240,192,64,0.1); color:#f0c040; border:0.5px solid rgba(240,192,64,0.2); font-weight:600; letter-spacing:0.05em;">${p.warning} WARNING</span>` :
            `<span style="font-size:9px; padding:2px 7px; border-radius:20px; background:rgba(29,158,117,0.1); color:var(--teal-light); border:0.5px solid var(--teal-border); font-weight:600; letter-spacing:0.05em;">BALANCED</span>`}
        </div>

        <!-- Operation status bar -->
        <div style="margin-bottom:12px;">
          <div style="display:flex; height:6px; border-radius:3px; overflow:hidden; gap:1px; margin-bottom:6px;">
            ${p.critical > 0 ? `<div style="flex:${p.critical}; background:#F09995; border-radius:3px;"></div>` : ''}
            ${p.warning > 0 ? `<div style="flex:${p.warning}; background:#f0c040; border-radius:3px;"></div>` : ''}
            ${p.balanced > 0 ? `<div style="flex:${p.balanced}; background:var(--teal-light); border-radius:3px; opacity:0.75;"></div>` : ''}
          </div>
          <div style="display:flex; gap:12px;">
            <span style="font-size:10px; color:#F09995;"><span style="font-weight:600;">${p.critical}</span> critical</span>
            <span style="font-size:10px; color:#f0c040;"><span style="font-weight:600;">${p.warning}</span> warning</span>
            <span style="font-size:10px; color:var(--teal-light); opacity:0.7;"><span style="font-weight:600;">${p.balanced}</span> balanced</span>
          </div>
        </div>

        <!-- Key metrics -->
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
          <div style="background:#000000; border-radius:8px; padding:8px;">
            <div style="font-size:9px; color:var(--text-dim); margin-bottom:2px;">TOTAL SMV</div>
            <div style="font-size:14px; font-weight:600; color:var(--teal-light); font-family:'Space Grotesk',sans-serif;">${p.totalSMV.toFixed(3)}</div>
          </div>
          <div style="background:#000000; border-radius:8px; padding:8px;">
            <div style="font-size:9px; color:var(--text-dim); margin-bottom:2px;">TARGET/DAY</div>
            <div style="font-size:14px; font-weight:600; color:var(--text); font-family:'Space Grotesk',sans-serif;">${p.lineTpd.toFixed(0)}</div>
          </div>
          <div style="background:#000000; border-radius:8px; padding:8px;">
            <div style="font-size:9px; color:var(--text-dim); margin-bottom:2px;">AVG CPP</div>
            <div style="font-size:14px; font-weight:600; color:var(--text); font-family:'Space Grotesk',sans-serif;">₹${p.avgCpp.toFixed(2)}</div>
          </div>
        </div>
      </div>`;
  };

  container.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px,1fr)); gap:12px; position:relative;">
      ${top5.map(p => cardHtml(p, false)).join('')}
      ${rest.length ? rest.map(p => cardHtml(p, true)).join('') : ''}
    </div>
    ${rest.length ? `
      <div style="text-align:center; margin-top:16px;">
        <button onclick="navToPage('line-balancing')"
          style="padding:7px 20px; background:none; border:0.5px solid var(--teal-border); border-radius:8px; color:var(--teal-light); font-size:12px; cursor:pointer;">
          View all ${scored.length} products in Bottleneck Identification <i class="ti ti-arrow-right"></i>
        </button>
      </div>` : ''}`;
}

// ── TRACKING ──────────────────────────────────────────────────────────────────

let dbChartView = 'week';
let dbEffAll, dbLtAll, dbEffToday, dbLtToday;

function renderTracking(effAll, effToday, ltAll, ltToday) {
  dbEffAll = effAll;
  dbLtAll = ltAll;
  dbEffToday = effToday;
  dbLtToday = ltToday;

  const container = document.getElementById('db-tracking');
  container.innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">

      <!-- EFFICIENCY PANEL -->
      <div style="background:var(--surface); border:0.5px solid var(--teal-border); border-radius:12px; padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div>
            <div style="font-size:14px; font-weight:500; color:var(--text);">Efficiency</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Today + trend</div>
          </div>
          <button onclick="navToPage('efficiency')" style="font-size:11px; color:var(--teal-light); background:none; border:none; cursor:pointer;">
            View details <i class="ti ti-arrow-right"></i>
          </button>
        </div>

        <!-- Today's process pills -->
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:16px;">
          ${['cutting','sewing','finishing'].map(p => {
            const rows = effToday.filter(r => r.process_type === p);
            const avg = rows.length ? rows.reduce((s,r) => s + parseFloat(r.efficiency_percent||0), 0) / rows.length : null;
            const color = avg === null ? 'var(--text-dim)' : avg >= 75 ? 'var(--teal-light)' : avg >= 50 ? '#f0c040' : '#F09995';
            return `
              <div style="background:#000000; border-radius:8px; padding:10px; text-align:center;">
                <div style="font-size:9px; color:var(--text-dim); letter-spacing:0.06em; margin-bottom:4px;">${p.toUpperCase()}</div>
                <div style="font-size:20px; font-weight:700; color:${color}; font-family:'Space Grotesk',sans-serif;">${avg !== null ? avg.toFixed(1)+'%' : '—'}</div>
                <div style="font-size:9px; color:var(--text-dim); margin-top:2px;">${rows.length} entr${rows.length===1?'y':'ies'}</div>
              </div>`;
          }).join('')}
        </div>

        <!-- Trend chart -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div style="font-size:11px; color:var(--text-muted);">Trend</div>
          <div style="display:flex; background:#000000; border-radius:6px; overflow:hidden; border:0.5px solid var(--border);">
            <button onclick="dbSetView('week')" id="db-eff-week"
              style="padding:4px 10px; border:none; font-size:10px; cursor:pointer; font-family:'Inter',sans-serif; background:var(--teal-dim); color:var(--teal-light);">Week</button>
            <button onclick="dbSetView('month')" id="db-eff-month"
              style="padding:4px 10px; border:none; font-size:10px; cursor:pointer; font-family:'Inter',sans-serif; background:transparent; color:var(--text-muted);">Month</button>
          </div>
        </div>
        <div id="db-eff-chart" style="height:100px; display:flex; align-items:flex-end; gap:3px;"></div>
        <div id="db-eff-labels" style="display:flex; gap:3px; margin-top:4px;"></div>
      </div>

      <!-- LOSS TIME PANEL -->
      <div style="background:var(--surface); border:0.5px solid var(--teal-border); border-radius:12px; padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div>
            <div style="font-size:14px; font-weight:500; color:var(--text);">Loss time</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Today + trend</div>
          </div>
          <button onclick="navToPage('loss-time')" style="font-size:11px; color:var(--teal-light); background:none; border:none; cursor:pointer;">
            View details <i class="ti ti-arrow-right"></i>
          </button>
        </div>

        <!-- Today's process pills -->
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:16px;">
          ${['cutting','sewing','finishing'].map(p => {
            const rows = ltToday.filter(r => r.process_type === p);
            const total = rows.reduce((s,r) => s + parseFloat(r.loss_minutes_recorded||0), 0);
            const color = total === 0 ? 'var(--text-dim)' : total > 60 ? '#F09995' : total > 30 ? '#f0c040' : 'var(--teal-light)';
            // Top reason
            const agg = {};
            rows.forEach(r => { if(!agg[r.loss_time_reason]) agg[r.loss_time_reason]=0; agg[r.loss_time_reason]+=parseFloat(r.loss_minutes_recorded||0); });
            const top = Object.entries(agg).sort((a,b)=>b[1]-a[1])[0];
            return `
              <div style="background:#000000; border-radius:8px; padding:10px; text-align:center;">
                <div style="font-size:9px; color:var(--text-dim); letter-spacing:0.06em; margin-bottom:4px;">${p.toUpperCase()}</div>
                <div style="font-size:20px; font-weight:700; color:${rows.length?color:'var(--text-dim)'}; font-family:'Space Grotesk',sans-serif;">${rows.length ? total.toFixed(0)+' min' : '—'}</div>
                <div style="font-size:9px; color:var(--text-dim); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${top ? top[0].split(' ')[0]+'…' : 'No data'}</div>
              </div>`;
          }).join('')}
        </div>

        <!-- Today reason donut-style breakdown -->
        <div style="font-size:11px; color:var(--text-muted); margin-bottom:10px;">Top reasons today</div>
        <div id="db-lt-breakdown">
          ${dbRenderLtBreakdown(ltToday)}
        </div>
      </div>
    </div>`;

  dbRenderEffChart();
}

function dbRenderLtBreakdown(ltRows) {
  if (!ltRows.length) return `<div style="font-size:12px; color:var(--text-dim); padding:16px 0; text-align:center;">No loss time recorded today</div>`;
  const agg = {};
  ltRows.forEach(r => { if(!agg[r.loss_time_reason]) agg[r.loss_time_reason]=0; agg[r.loss_time_reason]+=parseFloat(r.loss_minutes_recorded||0); });
  const total = Object.values(agg).reduce((s,v)=>s+v,0);
  const colors = ['var(--teal-light)','#85B7EB','#f0c040','#F09995','#a78bfa','#34d399','#fb923c'];
  return Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([reason, mins], i) => {
    const pct = total > 0 ? (mins/total)*100 : 0;
    return `
      <div style="margin-bottom:7px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
          <span style="font-size:11px; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:65%;">${reason}</span>
          <span style="font-size:11px; color:${colors[i%colors.length]}; font-weight:500; flex-shrink:0;">${pct.toFixed(0)}% · ${mins.toFixed(0)}m</span>
        </div>
        <div style="height:5px; background:var(--surface-2); border-radius:3px; overflow:hidden;">
          <div style="height:100%; width:${pct}%; background:${colors[i%colors.length]}; border-radius:3px;"></div>
        </div>
      </div>`;
  }).join('');
}

function dbSetView(view) {
  dbChartView = view;
  ['week','month'].forEach(v => {
    const btn = document.getElementById(`db-eff-${v}`);
    if (!btn) return;
    btn.style.background = v === view ? 'var(--teal-dim)' : 'transparent';
    btn.style.color = v === view ? 'var(--teal-light)' : 'var(--text-muted)';
  });
  dbRenderEffChart();
}

function dbRenderEffChart() {
  const chartEl = document.getElementById('db-eff-chart');
  const labelsEl = document.getElementById('db-eff-labels');
  if (!chartEl) return;

  const data = dbEffAll || [];
  if (!data.length) {
    chartEl.innerHTML = `<div style="font-size:11px; color:var(--text-dim); width:100%; text-align:center; padding-top:30px;">No data yet</div>`;
    if (labelsEl) labelsEl.innerHTML = '';
    return;
  }

  // Group
  const grouped = {};
  data.forEach(r => {
    const raw = r.date?.toString().split('T')[0];
    if (!raw) return;
    const [yr, mo, dy] = raw.split('-').map(Number);
    let key;
    if (dbChartView === 'week') {
      const d = new Date(yr, mo-1, dy);
      const diff = d.getDate() - d.getDay() + (d.getDay()===0?-6:1);
      key = new Date(yr, mo-1, diff).toISOString().split('T')[0];
    } else {
      key = `${yr}-${String(mo).padStart(2,'0')}`;
    }
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });

  // Keep last 8 periods
  const keys = Object.keys(grouped).sort().slice(-8);
  const barData = keys.map(k => {
    const rows = grouped[k];
    const totalProd = rows.reduce((s,r) => s + parseFloat(r.produced_minutes||0), 0);
    const totalAvail = rows.reduce((s,r) => s + parseFloat(r.available_minutes||0), 0);
    const avg = totalAvail > 0 ? (totalProd/totalAvail)*100 : 0;
    return { key: k, avg };
  });

  const maxVal = Math.max(...barData.map(b=>b.avg), 100);

  chartEl.innerHTML = barData.map(b => {
    const h = Math.max(Math.round((b.avg/maxVal)*90), 3);
    const color = b.avg >= 75 ? 'var(--teal-light)' : b.avg >= 50 ? '#f0c040' : '#F09995';
    return `
      <div style="display:flex; flex-direction:column; align-items:center; gap:2px; flex:1; min-width:0;">
        <div style="font-size:8px; color:${color}; font-weight:600;">${b.avg.toFixed(0)}%</div>
        <div style="width:100%; max-width:28px; background:${color}; border-radius:3px 3px 0 0; height:${h}px; opacity:0.8;"></div>
      </div>`;
  }).join('');

  if (labelsEl) {
    labelsEl.innerHTML = barData.map(b => {
      let label = b.key;
      if (dbChartView === 'week') {
        const [yr,mo,dy] = b.key.split('-').map(Number);
        const d = new Date(yr,mo-1,dy);
        label = d.toLocaleDateString('en-IN',{day:'numeric',month:'short'});
      } else {
        const [yr,mo] = b.key.split('-');
        const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        label = months[parseInt(mo)-1];
      }
      return `<div style="flex:1; font-size:8px; color:var(--text-dim); text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${label}</div>`;
    }).join('');
  }
}

function navToPage(page) {
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.click();
}