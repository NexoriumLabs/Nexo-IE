const bnToken = localStorage.getItem('token');

let bnState = {
  products: [],
  selectedProduct: null,
  obData: null
};

async function loadBottleneck() {
  const content = document.getElementById('content-area');
  content.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <div>
        <h2 style="font-family:'Space Grotesk',sans-serif; font-size:18px; font-weight:500; color:var(--text);">Bottleneck identification</h2>
        <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">Identify imbalanced operations slowing down your production line.</p>
      </div>
    </div>
    <div id="bn-product-list">
      <div class="coming-soon"><i class="ti ti-loader"></i><p>Loading products...</p></div>
    </div>`;

  const res = await fetch('/api/ob/products', { headers: { 'Authorization': `Bearer ${bnToken}` } });
  bnState.products = await res.json();
  bnRenderProductList();
}

function bnRenderProductList() {
  const list = document.getElementById('bn-product-list');
  const products = bnState.products.filter(p => p.operation_count > 0);

  if (!products.length) {
    list.innerHTML = `<div class="coming-soon"><i class="ti ti-adjustments-horizontal"></i><h2>No OB data yet</h2><p>Complete time studies and generate OB first.</p></div>`;
    return;
  }

  list.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px,1fr)); gap:14px;">
      ${products.map(p => {
        // We'll show placeholder bottleneck count — actual count computed when opened
        return `
          <div onclick="bnOpenProduct(${p.id})"
            style="background:var(--surface); border:0.5px solid var(--teal-border); border-radius:12px; padding:18px; cursor:pointer; transition:border-color 0.2s, background 0.2s;"
            onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background='var(--surface)'">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px;">
              <div>
                <div style="font-size:11px; color:var(--primary-light); letter-spacing:0.05em; margin-bottom:3px;">${p.product_number}</div>
                <div style="font-size:14px; font-weight:500; color:var(--text);">${p.product_name}</div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${p.process_type || '—'} · ${p.product_type || '—'}</div>
              </div>
              <i class="ti ti-chevron-right" style="color:var(--text-dim); font-size:16px; margin-top:2px;"></i>
            </div>
            <div style="display:flex; gap:8px;">
              <div style="flex:1; background:#000000; border-radius:8px; padding:8px; text-align:center;">
                <div style="font-size:16px; font-weight:600; color:var(--text);">${p.operation_count || 0}</div>
                <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">Operations</div>
              </div>
              <div style="flex:1; background:#000000; border-radius:8px; padding:8px; text-align:center;">
                <div style="font-size:16px; font-weight:600; color:var(--primary-light);">${p.total_smv ? parseFloat(p.total_smv).toFixed(2) : '—'}</div>
                <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">Total SAM</div>
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

async function bnOpenProduct(productId) {
  const product = bnState.products.find(p => p.id === productId);
  bnState.selectedProduct = product;

  const content = document.getElementById('content-area');
  content.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
      <button onclick="loadBottleneck()" style="background:none; border:0.5px solid var(--border); border-radius:8px; padding:6px 10px; color:var(--text-muted); cursor:pointer; font-size:13px;">
        <i class="ti ti-arrow-left"></i> Back
      </button>
      <div style="flex:1;">
        <h2 style="font-family:'Space Grotesk',sans-serif; font-size:16px; font-weight:500; color:var(--text);">${product.product_name}</h2>
        <p style="font-size:11px; color:var(--text-muted);">${product.product_number} · Bottleneck analysis</p>
      </div>
    </div>
    <div id="bn-analysis-area">
      <div class="coming-soon"><i class="ti ti-loader"></i><p>Analysing operations...</p></div>
    </div>`;

  const res = await fetch(`/api/ob/${productId}`, { headers: { 'Authorization': `Bearer ${bnToken}` } });
  bnState.obData = await res.json();
  bnRenderAnalysis();
}

function bnRenderAnalysis() {
  const container = document.getElementById('bn-analysis-area');
  const ops = bnState.obData?.operations || [];

  if (!ops.length) {
    container.innerHTML = `<div class="coming-soon"><i class="ti ti-box"></i><p>No operations found.</p></div>`;
    return;
  }

  // ── Compute per-operation values ──────────────────────────────────────────
  const efficiency = ops.length ? parseFloat(ops[0].efficiency) || 0.85 : 0.85;

  const computed = ops.map(op => {
    const smv = parseFloat(op.smv) || 0;
    const tph = smv > 0 ? 60 / smv : 0;
    const tpd = tph * 8;
    const manpower = parseInt(op.manpower) || 1;
    return {
      op,
      smv,
      tph: parseFloat(tph.toFixed(1)),
      tpd: parseFloat(tpd.toFixed(0)),
      manpower,
      frequency: parseFloat(op.operation_frequency) || 1
    };
  });

  // ── Line expected output = bottleneck (min tpd) ───────────────────────────
  const bottleneckTpd = Math.min(...computed.map(c => c.tpd));
  const bottleneckOp = computed.find(c => c.tpd === bottleneckTpd);
  const avgSMV = ops.reduce((s, op) => s + (parseFloat(op.smv) || 0), 0) / ops.length;

  // ── Status logic ──────────────────────────────────────────────────────────
  // RED:    smv > 2.0  OR  |smv_diff with adjacent| > 0.20
  // YELLOW: |smv_diff| between 0.08 and 0.20
  // GREEN:  |smv_diff| < 0.08  AND  smv <= 2.0
  function getStatus(index) {
    const c = computed[index];
    if (c.smv > 2.0) return 'red';
    const prev = index > 0 ? computed[index - 1] : null;
    const next = index < computed.length - 1 ? computed[index + 1] : null;
    const diffs = [];
    if (prev) diffs.push(Math.abs(c.smv - prev.smv));
    if (next) diffs.push(Math.abs(c.smv - next.smv));
    const maxDiff = diffs.length ? Math.max(...diffs) : 0;
    if (maxDiff > 0.20) return 'red';
    if (maxDiff >= 0.08) return 'yellow';
    return 'green';
  }

  // ── Difference vs prev/next ───────────────────────────────────────────────
  function getDiff(index) {
    const c = computed[index];
    const prev = index > 0 ? computed[index - 1] : null;
    const next = index < computed.length - 1 ? computed[index + 1] : null;
    return {
      vsPrev: prev ? c.tpd - prev.tpd : null,    // +ve = this faster than prev
      vsNext: next ? c.tpd - next.tpd : null,     // +ve = this faster than next
      samDiffPrev: prev ? (c.smv - prev.smv) : null,
      samDiffNext: next ? (c.smv - next.smv) : null
    };
  }

  // ── Count issues ─────────────────────────────────────────────────────────
  let redCount = 0, yellowCount = 0;
  computed.forEach((_, i) => {
    const s = getStatus(i);
    if (s === 'red') redCount++;
    else if (s === 'yellow') yellowCount++;
  });

  const statusColor = { red: '#F09995', yellow: '#f0c040', green: 'var(--primary-light)' };
  const statusBg = { red: 'rgba(240,153,149,0.08)', yellow: 'rgba(240,192,64,0.08)', green: 'var(--primary-dim)' };
  const statusBorder = { red: 'rgba(240,153,149,0.25)', yellow: 'rgba(240,192,64,0.25)', green: 'var(--primary-border)' };
  const statusLabel = { red: 'CRITICAL', yellow: 'WARNING', green: 'BALANCED' };

  // ── Summary strip ─────────────────────────────────────────────────────────
  const summaryHtml = `
    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:20px;">
      <div style="background:var(--surface); border:0.5px solid var(--teal-border); border-radius:10px; padding:14px 16px;">
        <div style="font-size:10px; color:var(--text-dim); letter-spacing:0.06em; margin-bottom:4px;">LINE OUTPUT / DAY</div>
        <div style="font-size:22px; font-weight:600; color:var(--primary-light); font-family:'Space Grotesk',sans-serif;">${bottleneckTpd.toFixed(0)}</div>
        <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">Based on bottleneck op</div>
      </div>
      <div style="background:var(--surface); border:0.5px solid var(--teal-border); border-radius:10px; padding:14px 16px;">
        <div style="font-size:10px; color:var(--text-dim); letter-spacing:0.06em; margin-bottom:4px;">AVG SAM / OPERATION</div>
        <div style="font-size:22px; font-weight:600; color:var(--text); font-family:'Space Grotesk',sans-serif;">${avgSMV.toFixed(3)}</div>
        <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">Target ≤ 2.0 per op</div>
      </div>
      <div style="background:var(--surface); border:0.5px solid ${redCount > 0 ? 'rgba(240,153,149,0.3)' : 'var(--primary-border)'}; border-radius:10px; padding:14px 16px;">
        <div style="font-size:10px; color:var(--text-dim); letter-spacing:0.06em; margin-bottom:4px;">CRITICAL OPERATIONS</div>
        <div style="font-size:22px; font-weight:600; color:${redCount > 0 ? '#F09995' : 'var(--primary-light)'}; font-family:'Space Grotesk',sans-serif;">${redCount}</div>
        <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">Need immediate attention</div>
      </div>
      <div style="background:var(--surface); border:0.5px solid ${yellowCount > 0 ? 'rgba(240,192,64,0.3)' : 'var(--primary-border)'}; border-radius:10px; padding:14px 16px;">
        <div style="font-size:10px; color:var(--text-dim); letter-spacing:0.06em; margin-bottom:4px;">WARNINGS</div>
        <div style="font-size:22px; font-weight:600; color:${yellowCount > 0 ? '#f0c040' : 'var(--primary-light)'}; font-family:'Space Grotesk',sans-serif;">${yellowCount}</div>
        <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">Monitor closely</div>
      </div>
    </div>`;

  // ── Legend ────────────────────────────────────────────────────────────────
  const legendHtml = `
    <div style="display:flex; gap:16px; align-items:center; margin-bottom:16px; flex-wrap:wrap;">
      <span style="font-size:11px; color:var(--text-muted);">Status key:</span>
      ${[['green','BALANCED','SAM ≤ 2.0 · diff < 0.08'],['yellow','WARNING','diff 0.08 – 0.20'],['red','CRITICAL','SAM > 2.0 or diff > 0.20']].map(([s,l,d]) => `
        <div style="display:flex; align-items:center; gap:6px;">
          <div style="width:10px; height:10px; border-radius:50%; background:${statusColor[s]};"></div>
          <span style="font-size:11px; color:${statusColor[s]}; font-weight:500;">${l}</span>
          <span style="font-size:10px; color:var(--text-dim);">${d}</span>
        </div>`).join('')}
      <div style="margin-left:auto; font-size:11px; color:var(--text-muted);">
        Bottleneck: <span style="color:#F09995; font-weight:500;">${bottleneckOp?.op.operation_name || '—'}</span> · ${bottleneckTpd.toFixed(0)} pcs/day
      </div>
    </div>`;

  // ── Operation cards ───────────────────────────────────────────────────────
  const cardsHtml = `
    <div style="display:flex; flex-wrap:wrap; gap:12px;">
      ${computed.map((c, i) => {
        const status = getStatus(i);
        const diff = getDiff(i);
        const isBottleneck = c.tpd === bottleneckTpd;

        // Diff indicator vs prev
        const prevDiffHtml = diff.vsPrev !== null ? (() => {
          const absSAM = Math.abs(diff.samDiffPrev);
          const color = absSAM > 0.20 ? '#F09995' : absSAM >= 0.08 ? '#f0c040' : 'var(--primary-light)';
          const arrow = diff.vsPrev > 0 ? '↑' : diff.vsPrev < 0 ? '↓' : '=';
          const label = diff.vsPrev > 0 ? `+${diff.vsPrev.toFixed(0)}` : diff.vsPrev.toFixed(0);
          return `
            <div style="padding:6px 10px; background:rgba(255,255,255,0.03); border-radius:6px; border:0.5px solid rgba(255,255,255,0.06);">
              <div style="font-size:9px; color:var(--text-dim); margin-bottom:2px;">vs PREV OP</div>
              <div style="font-size:13px; font-weight:600; color:${color};">${arrow} ${label} pcs/day</div>
              <div style="font-size:9px; color:${color};">SAM diff: ${diff.samDiffPrev > 0 ? '+' : ''}${diff.samDiffPrev.toFixed(3)}</div>
            </div>`;
        })() : `<div style="padding:6px 10px; background:rgba(255,255,255,0.03); border-radius:6px; border:0.5px solid rgba(255,255,255,0.04);"><div style="font-size:9px; color:var(--text-dim);">FIRST OP</div></div>`;

        const nextDiffHtml = diff.vsNext !== null ? (() => {
          const absSAM = Math.abs(diff.samDiffNext);
          const color = absSAM > 0.20 ? '#F09995' : absSAM >= 0.08 ? '#f0c040' : 'var(--primary-light)';
          const arrow = diff.vsNext > 0 ? '↑' : diff.vsNext < 0 ? '↓' : '=';
          const label = diff.vsNext > 0 ? `+${diff.vsNext.toFixed(0)}` : diff.vsNext.toFixed(0);
          return `
            <div style="padding:6px 10px; background:rgba(255,255,255,0.03); border-radius:6px; border:0.5px solid rgba(255,255,255,0.06);">
              <div style="font-size:9px; color:var(--text-dim); margin-bottom:2px;">vs NEXT OP</div>
              <div style="font-size:13px; font-weight:600; color:${color};">${arrow} ${label} pcs/day</div>
              <div style="font-size:9px; color:${color};">SAM diff: ${diff.samDiffNext > 0 ? '+' : ''}${diff.samDiffNext.toFixed(3)}</div>
            </div>`;
        })() : `<div style="padding:6px 10px; background:rgba(255,255,255,0.03); border-radius:6px; border:0.5px solid rgba(255,255,255,0.04);"><div style="font-size:9px; color:var(--text-dim);">LAST OP</div></div>`;

        // WIP dump warning
        let warnMsg = '';
        if (diff.vsNext !== null && diff.vsNext > 0 && Math.abs(diff.samDiffNext) > 0.20) {
          warnMsg = `<div style="margin-top:8px; padding:6px 10px; background:rgba(240,153,149,0.08); border-radius:6px; border:0.5px solid rgba(240,153,149,0.2); font-size:10px; color:#F09995;">
            <i class="ti ti-alert-triangle"></i> WIP dump risk — this op outpaces next by ${diff.vsNext.toFixed(0)} pcs/day
          </div>`;
        } else if (diff.vsPrev !== null && diff.vsPrev < 0 && Math.abs(diff.samDiffPrev) > 0.20) {
          warnMsg = `<div style="margin-top:8px; padding:6px 10px; background:rgba(240,153,149,0.08); border-radius:6px; border:0.5px solid rgba(240,153,149,0.2); font-size:10px; color:#F09995;">
            <i class="ti ti-alert-triangle"></i> Starvation risk — previous op feeds ${Math.abs(diff.vsPrev).toFixed(0)} pcs/day more than this can process
          </div>`;
        }

        // SAM > 2 warning
        const samWarn = c.smv > 2.0 ? `
          <div style="margin-top:8px; padding:6px 10px; background:rgba(240,153,149,0.08); border-radius:6px; border:0.5px solid rgba(240,153,149,0.2); font-size:10px; color:#F09995;">
            <i class="ti ti-scissors"></i> SAM ${c.smv.toFixed(3)} > 2.0 — consider breaking this operation down
          </div>` : '';

        return `
          <div style="width:calc(33.333% - 8px); min-width:260px; flex:1;
            background:${statusBg[status]};
            border:0.5px solid ${isBottleneck ? '#F09995' : statusBorder[status]};
            border-radius:12px; padding:16px; position:relative; box-sizing:border-box;">

            <!-- Priority badge + status pill -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <div style="width:28px; height:28px; border-radius:50%; background:${statusBg[status]}; border:0.5px solid ${statusBorder[status]}; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; color:${statusColor[status]};">${c.op.operation_priority}</div>
                <div>
                  <div style="font-size:13px; font-weight:500; color:var(--text); line-height:1.2;">${c.op.operation_name}</div>
                  <div style="font-size:10px; color:var(--text-muted);">${c.op.machine_type || 'No machine'} · ${c.manpower} op${c.manpower > 1 ? 's' : ''}</div>
                </div>
              </div>
              <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                <span style="font-size:9px; padding:2px 7px; border-radius:20px; background:${statusBg[status]}; color:${statusColor[status]}; border:0.5px solid ${statusBorder[status]}; font-weight:600; letter-spacing:0.05em;">${statusLabel[status]}</span>
                ${isBottleneck ? `<span style="font-size:9px; padding:2px 7px; border-radius:20px; background:rgba(240,153,149,0.1); color:#F09995; border:0.5px solid rgba(240,153,149,0.25); font-weight:600;">BOTTLENECK</span>` : ''}
              </div>
            </div>

            <!-- Core metrics -->
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-bottom:12px;">
              <div style="background:rgba(0,0,0,0.2); border-radius:6px; padding:8px;">
                <div style="font-size:9px; color:var(--text-dim); margin-bottom:2px;">SAM</div>
                <div style="font-size:15px; font-weight:600; color:${c.smv > 2.0 ? '#F09995' : 'var(--primary-light)'}; font-family:'Space Grotesk',sans-serif;">${c.smv.toFixed(3)}</div>
              </div>
              <div style="background:rgba(0,0,0,0.2); border-radius:6px; padding:8px;">
                <div style="font-size:9px; color:var(--text-dim); margin-bottom:2px;">T/HR</div>
                <div style="font-size:15px; font-weight:600; color:var(--text); font-family:'Space Grotesk',sans-serif;">${c.tph.toFixed(0)}</div>
              </div>
              <div style="background:rgba(0,0,0,0.2); border-radius:6px; padding:8px;">
                <div style="font-size:9px; color:var(--text-dim); margin-bottom:2px;">T/DAY</div>
                <div style="font-size:15px; font-weight:600; color:var(--text); font-family:'Space Grotesk',sans-serif;">${c.tpd.toFixed(0)}</div>
              </div>
            </div>

            <!-- Freq if > 1 -->
            ${c.frequency > 1 ? `<div style="font-size:10px; color:var(--text-muted); margin-bottom:10px;">Frequency: ×${c.frequency} per piece</div>` : ''}

            <!-- Diff vs adjacent -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
              ${prevDiffHtml}
              ${nextDiffHtml}
            </div>

            ${samWarn}
            ${warnMsg}
          </div>`;
      }).join('')}
    </div>`;

  container.innerHTML = summaryHtml + legendHtml + cardsHtml;
}