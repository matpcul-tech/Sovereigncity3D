import { createClient } from '@supabase/supabase-js';
import './facilitator.css';

/* =========================================================
   SOVEREIGN CITY — FACILITATOR DASHBOARD
   Access: /Sovereigncity3D/facilitator.html?code=TOWN_CODE
   No auth required — town code IS the access credential.
   ========================================================= */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Canonical vocabulary terms in curriculum order
const VOCAB_TERMS = [
  'Value Proposition','Customer Discovery','Rejection Handling',
  'Churn','Overhead','Payroll','Revenue vs Profit','Runway',
  'Market Timing','Pricing Power','Competitive Moat','Blue Ocean',
  'Equity Dilution','Cap Table','Valuation','Systems','Resilience','Sovereignty'
];

const STAGE_NAMES = ['','Ideator','Hustler','Builder','Scaler','Sovereign'];

function fmt(n) {
  if (n == null || isNaN(n)) return '$0';
  return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();
}
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function timeSince(ts) {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

let sb = null, townId = null, founders = [], urlCode = '';

function getUrlCode() {
  return (new URLSearchParams(location.search).get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
}

/* ---- Data ---- */
async function loadData() {
  if (!sb || !urlCode) return;
  try {
    const { data: town } = await sb.from('towns').select('id,daily_challenge').eq('code', urlCode).maybeSingle();
    if (town) {
      townId = town.id;
      const inp = document.getElementById('challengeInput');
      if (inp && !inp._dirty) inp.value = town.daily_challenge || '';
    }
    const { data: saves } = await sb.from('saves')
      .select('founder_name,data,updated_at')
      .eq('town_code', urlCode)
      .order('updated_at', { ascending: false });
    founders = saves || [];
  } catch (e) { console.warn('[fac] load error', e); }
  renderTable();
  const ts = document.getElementById('lastRefresh');
  if (ts) ts.textContent = 'Updated ' + new Date().toLocaleTimeString();
}

/* ---- Render ---- */
function renderTable() {
  const tbody = document.getElementById('founderTbody');
  const vwrap = document.getElementById('vocabWrap');
  if (!tbody) return;

  if (!founders.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:#9A917F">No founders have joined this town yet.</td></tr>';
    if (vwrap) vwrap.innerHTML = '<p style="color:var(--sub);font-size:13px">No founders yet.</p>';
    return;
  }

  tbody.innerHTML = founders.map(row => {
    const d = row.data || {};
    const biz = d.biz || {};
    const st = d.stage || 1;
    const p = d.lastProfit;
    return `<tr>
      <td><div class="fn">${esc(row.founder_name)}</div><div class="bn">${esc(biz.name||'—')}</div></td>
      <td>${esc(biz.industry||'—')}</td>
      <td><span class="stage-pill s${st}">${esc(STAGE_NAMES[st]||'Ideator')}</span></td>
      <td>${d.customers||0}</td>
      <td class="${p>0?'pos':p<0?'neg':''}">${fmt(p)}/day</td>
      <td>${d.day||1}</td>
      <td>${(d.learned||[]).length}</td>
      <td>${(d.insights||[]).length}</td>
      <td class="ts">${timeSince(row.updated_at)}</td>
    </tr>`;
  }).join('');

  if (vwrap) renderVocabGrid(vwrap);
}

function renderVocabGrid(container) {
  // Only show terms at least one founder has earned
  const earned = new Set();
  founders.forEach(r => (r.data?.learned||[]).forEach(l => l.t && earned.add(l.t)));
  const cols = VOCAB_TERMS.filter(t => earned.has(t));

  if (!cols.length) {
    container.innerHTML = '<p style="color:var(--sub);font-size:13px">No vocabulary terms unlocked yet.</p>';
    return;
  }

  const hdr = '<tr><th class="th-name">Founder</th>' +
    cols.map(t => `<th><span class="rh" title="${esc(t)}">${esc(t)}</span></th>`).join('') + '</tr>';

  const rows = founders.map(r => {
    const has = new Set((r.data?.learned||[]).map(l=>l.t));
    return '<tr><td class="td-name">' + esc(r.founder_name) + '</td>' +
      cols.map(t => `<td>${has.has(t)?'<span class="vc">✓</span>':''}</td>`).join('') + '</tr>';
  }).join('');

  container.innerHTML = `<div class="vocab-wrap"><table class="vocab-table"><thead>${hdr}</thead><tbody>${rows}</tbody></table></div>`;
}

/* ---- Set Challenge ---- */
async function setChallenge() {
  if (!sb) { showToast('Supabase not configured.'); return; }
  if (!townId) {
    // Try to resolve town first
    const { data: t } = await sb.from('towns').select('id').eq('code', urlCode).maybeSingle();
    if (t) townId = t.id;
    if (!townId) { showToast('Town not found. Have a player join first.'); return; }
  }
  const inp = document.getElementById('challengeInput');
  const val = (inp?.value || '').trim();
  const btn = document.getElementById('setChallengeBtn');
  if (btn) btn.disabled = true;
  const { error } = await sb.from('towns').update({ daily_challenge: val || null }).eq('id', townId);
  if (btn) btn.disabled = false;
  if (inp) inp._dirty = false;
  showToast(error ? 'Error: ' + error.message : val ? 'Challenge set! Players will see it at next game day.' : 'Challenge cleared.');
}

/* ---- CSV Export ---- */
function exportCSV() {
  const headers = ['Founder Name','Business','Industry','Stage','Customers','Days','Profit/Loss per Day','Terms Learned','Insights Earned'];
  const rows = founders.map(r => {
    const d = r.data||{}, b = d.biz||{};
    return [r.founder_name||'', b.name||'', b.industry||'', STAGE_NAMES[d.stage||1]||'Ideator',
            d.customers||0, d.day||1, d.lastProfit||0,
            (d.learned||[]).length, (d.insights||[]).length
    ].map(v => '"' + String(v).replace(/"/g,'""') + '"').join(',');
  });
  const csv = [headers.join(','), ...rows].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'sovereign-city-' + urlCode + '-' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

/* ---- Toast ---- */
let _toastTimer;
function showToast(msg) {
  let el = document.getElementById('facToast');
  if (!el) { el = Object.assign(document.createElement('div'), { id:'facToast', className:'fac-toast' }); document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(_toastTimer); _toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ---- Realtime ---- */
function subscribeRealtime() {
  if (!sb || !urlCode) return;
  sb.channel('fac-saves-' + urlCode)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'saves', filter: `town_code=eq.${urlCode}` },
        () => loadData())
    .subscribe();
}

/* ---- Shell HTML ---- */
function renderShell() {
  document.getElementById('fac-root').innerHTML = `
    <header class="fac-header">
      <div><div class="eyebrow">SOVEREIGN CITY</div><h1>Facilitator Dashboard</h1></div>
      <span class="code-badge">${esc(urlCode)}</span>
      <span class="auto-tag" id="lastRefresh">Loading…</span>
    </header>
    <div class="fac-controls">
      <label for="challengeInput">Today's Hustle</label>
      <input id="challengeInput" class="hustle-input" type="text" maxlength="160"
             placeholder="Set a custom challenge visible to all founders in this town…">
      <button id="setChallengeBtn" class="btn btn-gold">Set Challenge</button>
      <button class="btn btn-outline" id="exportBtn">⬇ Export Session Report (CSV)</button>
      <button class="btn btn-outline" onclick="window.print()">🖨 Print</button>
    </div>
    <div class="fac-main">
      <div class="fac-section-title">Founders — Town ${esc(urlCode)}</div>
      <table class="founder-table">
        <thead><tr>
          <th>Founder / Business</th><th>Industry</th><th>Stage</th>
          <th>Customers</th><th>Daily P&amp;L</th><th>Days</th>
          <th>Terms</th><th>Insights</th><th>Last Active</th>
        </tr></thead>
        <tbody id="founderTbody"><tr><td colspan="9" style="text-align:center;padding:32px;color:#9A917F">Loading…</td></tr></tbody>
      </table>
      <div class="fac-section-title">Vocabulary Progress</div>
      <div id="vocabWrap">Loading…</div>
    </div>`;

  document.getElementById('setChallengeBtn').addEventListener('click', setChallenge);
  document.getElementById('exportBtn').addEventListener('click', exportCSV);
  const inp = document.getElementById('challengeInput');
  inp.addEventListener('input', () => { inp._dirty = true; });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') setChallenge(); });
}

function renderCodeForm() {
  document.getElementById('fac-root').innerHTML = `
    <header class="fac-header"><div><h1>Facilitator Dashboard</h1></div></header>
    <div class="code-form">
      <div style="font-size:40px;margin-bottom:12px">🏫</div>
      <h2>Enter Town Code</h2>
      <p>Enter the 6-character code you shared with your class.</p>
      <input id="codeInp" type="text" maxlength="6" placeholder="ABC123" autocomplete="off">
      <button class="btn btn-gold" id="goCodeBtn" style="width:100%;padding:13px;font-size:15px">Open Dashboard</button>
    </div>`;

  const inp = document.getElementById('codeInp');
  const go = () => {
    const code = inp.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
    if (!code) return;
    location.href = location.pathname + '?code=' + code;
  };
  inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g,''); });
  inp.addEventListener('keydown', e => { if (e.key==='Enter') go(); });
  document.getElementById('goCodeBtn').addEventListener('click', go);
  inp.focus();
}

/* ---- Boot ---- */
document.addEventListener('DOMContentLoaded', async () => {
  urlCode = getUrlCode();
  if (!urlCode) { renderCodeForm(); return; }

  if (SUPABASE_URL && SUPABASE_ANON_KEY) sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  renderShell();

  if (!sb) {
    document.getElementById('founderTbody').innerHTML =
      '<tr><td colspan="9" style="text-align:center;padding:32px;color:#b83030">Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</td></tr>';
    return;
  }

  await loadData();
  subscribeRealtime();
  setInterval(loadData, 60000);
});
