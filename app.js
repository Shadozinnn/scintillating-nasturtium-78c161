const SUPA_URL = 'https://bnlqoxggdziohbikqcgt.supabase.co';
const SUPA_KEY = 'sb_publishable_bkiGxBLN8cUNf8ghb623iw_wRCXB5m-';
const sb = supabase.createClient(SUPA_URL, SUPA_KEY);

const TODAY = new Date().toISOString().slice(0, 10);
const CATS_OUT = ['🍔 Alimentação','🚗 Transporte','🏠 Moradia','💊 Saúde','🎮 Lazer','📚 Educação','👕 Roupas','💡 Contas','💳 Outros'];
const CATS_IN  = ['💼 Salário','💰 Freelance','📈 Investimentos','🎁 Presente','🏦 Outros'];

let USER = null;
let D = { todos: [], habits: [], notes: [], transactions: [] };
let UI = { finType: 'out', finCat: CATS_OUT[0], finFilter: 'all', authMode: 'login' };

// UTILS
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtBRL(v) { return 'R$ ' + Number(v).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function fmtDate(d) { return new Date(d+'T00:00:00').toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit'}); }
function streak(days) {
  if (!days || !days.length) return 0;
  const s = [...days].sort().reverse(); let k = 0, cur = new Date(TODAY);
  for (let d of s) { const dd = new Date(d+'T00:00:00'); const df = Math.round((cur-dd)/86400000);
    if (df===0||df===1) { k++; cur = new Date(dd-86400000); } else break; } return k;
}

// THEME
function applyTheme(t) {
  document.body.classList.toggle('light', t === 'light');
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = t === 'light' ? '🌙' : '☀️';
}
function toggleTheme() {
  const t = document.body.classList.contains('light') ? 'dark' : 'light';
  localStorage.setItem('theme', t); applyTheme(t);
}
applyTheme(localStorage.getItem('theme') || 'dark');

// AUTH
function switchTab(mode) {
  UI.authMode = mode;
  document.querySelectorAll('.auth-tab').forEach((b,i) => b.classList.toggle('active', (i===0&&mode==='login')||(i===1&&mode==='signup')));
  document.getElementById('auth-btn').textContent = mode === 'login' ? 'Entrar' : 'Cadastrar';
  document.getElementById('auth-err').textContent = '';
}

async function doAuth() {
  const email = document.getElementById('auth-email').value.trim();
  const pass  = document.getElementById('auth-pass').value;
  const errEl = document.getElementById('auth-err');
  errEl.textContent = ''; errEl.style.color = '#f87171';
  if (!email || !pass) { errEl.textContent = 'Preencha e-mail e senha.'; return; }
  document.getElementById('auth-btn').textContent = 'Aguarde...';
  let res;
  if (UI.authMode === 'login') {
    res = await sb.auth.signInWithPassword({ email, password: pass });
  } else {
    res = await sb.auth.signUp({ email, password: pass });
  }
  document.getElementById('auth-btn').textContent = UI.authMode === 'login' ? 'Entrar' : 'Cadastrar';
  if (res.error) { errEl.textContent = res.error.message; return; }
  if (UI.authMode === 'signup' && !res.data.session) {
    errEl.style.color = '#4ade80';
    errEl.textContent = 'Cadastro feito! Confirme seu e-mail e depois entre.';
    return;
  }
  await initApp(res.data.user || res.data.session?.user);
}

async function logout() {
  await sb.auth.signOut();
  USER = null; D = { todos:[], habits:[], notes:[], transactions:[] };
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
}

async function initApp(user) {
  USER = user;
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  document.getElementById('user-email').textContent = user.email;
  await loadAll();
  renderAll();
}

// LOAD
async function loadAll() {
  const uid = USER.id;
  const [t, h, n, tx] = await Promise.all([
    sb.from('todos').select('*').eq('user_id', uid).order('created_at', {ascending:true}),
    sb.from('habits').select('*').eq('user_id', uid),
    sb.from('notes').select('*').eq('user_id', uid).order('date', {ascending:false}),
    sb.from('transactions').select('*').eq('user_id', uid).order('date', {ascending:false})
  ]);
  D.todos        = t.data  || [];
  D.habits       = h.data  || [];
  D.notes        = n.data  || [];
  D.transactions = tx.data || [];
}

function showTab(id, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('show'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('show');
  btn.classList.add('active');
}
function renderAll() { renderOverview(); renderTodos(); renderHabits(); renderNotes(); renderFinance(); }

// OVERVIEW
function renderOverview() {
  const el = document.getElementById('tab-overview');
  const tdone = D.todos.filter(t=>t.done).length, ttotal = D.todos.length;
  const hdone = D.habits.filter(h=>h.days&&h.days.includes(TODAY)).length, htotal = D.habits.length;
  const inc = D.transactions.filter(t=>t.type==='in').reduce((a,t)=>a+Number(t.amount),0);
  const exp = D.transactions.filter(t=>t.type==='out').reduce((a,t)=>a+Number(t.amount),0);
  const bal = inc - exp;
  const balColor = bal >= 0 ? '#4ade80' : '#f87171';
  const pending  = D.todos.filter(t=>!t.done).slice(0,3);
  const recentTx = D.transactions.slice(0,3);
  el.innerHTML = `
    <div class="card">
      <div class="ch"><span class="ct">Bom dia 👋</span><span class="cs">${new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}</span></div>
      <div class="ov-grid">
        <div class="ov-card"><div class="ov-title">Tarefas</div><div class="ov-val">${tdone}<span style="font-size:14px;color:#888">/${ttotal}</span></div><div class="ov-sub">concluídas</div></div>
        <div class="ov-card"><div class="ov-title">Hábitos hoje</div><div class="ov-val">${hdone}<span style="font-size:14px;color:#888">/${htotal}</span></div><div class="ov-sub">feitos</div></div>
        <div class="ov-card"><div class="ov-title">Receitas</div><div class="ov-val" style="font-size:16px;color:#4ade80">${fmtBRL(inc)}</div></div>
        <div class="ov-card"><div class="ov-title">Saldo</div><div class="ov-val" style="font-size:16px;color:${balColor}">${fmtBRL(bal)}</div></div>
      </div>
    </div>
    ${pending.length ? `<div class="card"><div class="ch"><span class="ct">Tarefas pendentes</span></div><div class="tlist">${pending.map(t=>`<div class="ti"><span class="td">${esc(t.text)}</span></div>`).join('')}</div></div>` : ''}
    ${recentTx.length ? `<div class="card"><div class="ch"><span class="ct">Últimos lançamentos</span></div><div class="txlist">${recentTx.map(t=>`<div class="txi"><span class="txic">${esc((t.category||'💳').split(' ')[0])}</span><div class="txin"><div class="txd">${esc(t.description)}</div><div class="txm">${esc((t.category||'').split(' ').slice(1).join(' '))} · ${fmtDate(t.date)}</div></div><span class="txa ${t.type==='in'?'txin2':'txout'}">${t.type==='in'?'+':'-'}${fmtBRL(t.amount)}</span></div>`).join('')}</div></div>` : ''}
  `;
}

// TODOS
function renderTodos() {
  const el = document.getElementById('tab-todos');
  const done = D.todos.filter(t=>t.done).length;
  el.innerHTML = `<div class="card"><div class="ch"><span class="ct">Tarefas</span><span class="cs">${done}/${D.todos.length} concluídas</span></div>
    <div class="ri"><input type="text" id="ti" placeholder="Nova tarefa..." maxlength="120"/><button class="btn" onclick="addTodo()">Adicionar</button></div>
    <div class="tlist">${D.todos.length ? D.todos.map(t=>`<div class="ti ${t.done?'done':''}">
      <input type="checkbox" class="tck" ${t.done?'checked':''} onchange="toggleTodo('${t.id}',${t.done})"/>
      <span class="td">${esc(t.text)}</span>
      <button class="xbtn" onclick="delTodo('${t.id}')">&#215;</button>
    </div>`).join('') : '<p class="empty">Nenhuma tarefa ainda.</p>'}</div>
  </div>`;
  document.getElementById('ti')?.addEventListener('keydown', e => { if (e.key==='Enter') addTodo(); });
}
async function addTodo() {
  const v = (document.getElementById('ti')?.value||'').trim(); if (!v) return;
  const {data} = await sb.from('todos').insert({user_id:USER.id, text:v, done:false}).select().single();
  if (data) { D.todos.push(data); renderTodos(); renderOverview(); }
}
async function toggleTodo(id, done) {
  await sb.from('todos').update({done:!done}).eq('id', id);
  const t = D.todos.find(x=>x.id===id); if (t) t.done = !done;
  renderTodos(); renderOverview();
}
async function delTodo(id) {
  await sb.from('todos').delete().eq('id', id);
  D.todos = D.todos.filter(x=>x.id!==id); renderTodos(); renderOverview();
}

// HABITS
function renderHabits() {
  const el = document.getElementById('tab-habits');
  const done = D.habits.filter(h=>h.days&&h.days.includes(TODAY)).length;
  el.innerHTML = `<div class="card"><div class="ch"><span class="ct">Hábitos de hoje</span><span class="cs">${done}/${D.habits.length} feitos</span></div>
    <div class="ri"><input type="text" id="hi" placeholder="Novo hábito..." maxlength="80"/><button class="btn" onclick="addHabit()">Adicionar</button></div>
    <div class="hlist">${D.habits.length ? D.habits.map(h => { const d = h.days&&h.days.includes(TODAY); const s = streak(h.days||[]); return `<div class="hi">
      <button class="htog" onclick="toggleHabit('${h.id}')">${d?'✅':'⬜'}</button>
      <span class="hn">${esc(h.name)}</span>
      <span class="hstr">${s>0?'🔥 '+s+' dia'+(s>1?'s':''):''}</span>
      <button class="xbtn" onclick="delHabit('${h.id}')">&#215;</button>
    </div>`; }).join('') : '<p class="empty">Nenhum hábito ainda.</p>'}</div>
  </div>`;
  document.getElementById('hi')?.addEventListener('keydown', e => { if (e.key==='Enter') addHabit(); });
}
async function addHabit() {
  const v = (document.getElementById('hi')?.value||'').trim(); if (!v) return;
  const {data} = await sb.from('habits').insert({user_id:USER.id, name:v, days:[]}).select().single();
  if (data) { D.habits.push(data); renderHabits(); renderOverview(); }
}
async function toggleHabit(id) {
  const h = D.habits.find(x=>x.id===id); if (!h) return;
  const days = h.days || [];
  const idx = days.indexOf(TODAY);
  if (idx === -1) days.push(TODAY); else days.splice(idx, 1);
  await sb.from('habits').update({days}).eq('id', id);
  h.days = days; renderHabits(); renderOverview();
}
async function delHabit(id) {
  await sb.from('habits').delete().eq('id', id);
  D.habits = D.habits.filter(x=>x.id!==id); renderHabits(); renderOverview();
}

// NOTES
function renderNotes() {
  const el = document.getElementById('tab-notes');
  el.innerHTML = `<div class="card"><div class="ch"><span class="ct">Notas</span><span class="cs">${D.notes.length} nota${D.notes.length!==1?'s':''}</span></div>
    <textarea class="ntarea" id="ni" placeholder="Escreva uma nota..."></textarea>
    <button class="btn btn-full" onclick="addNote()">Salvar nota</button>
    <div style="margin-top:.75rem" class="nlist">${D.notes.length ? D.notes.map(n=>`<div class="nc"><div class="ntop"><span class="ntxt">${esc(n.text)}</span><button class="xbtn" onclick="delNote('${n.id}')">&#215;</button></div><div class="ndate">${fmtDate(n.date)}</div></div>`).join('') : '<p class="empty">Nenhuma nota ainda.</p>'}</div>
  </div>`;
}
async function addNote() {
  const v = (document.getElementById('ni')?.value||'').trim(); if (!v) return;
  const {data} = await sb.from('notes').insert({user_id:USER.id, text:v, date:TODAY}).select().single();
  if (data) { D.notes.unshift(data); renderNotes(); renderOverview(); }
}
async function delNote(id) {
  await sb.from('notes').delete().eq('id', id);
  D.notes = D.notes.filter(x=>x.id!==id); renderNotes(); renderOverview();
}

// FINANCE
function renderFinance() {
  const el = document.getElementById('tab-finance');
  const inc = D.transactions.filter(t=>t.type==='in').reduce((a,t)=>a+Number(t.amount),0);
  const exp = D.transactions.filter(t=>t.type==='out').reduce((a,t)=>a+Number(t.amount),0);
  const bal = inc - exp;
  const balColor = bal >= 0 ? '#4ade80' : '#f87171';
  const catMap = {}; D.transactions.filter(t=>t.type==='out').forEach(t=>{ catMap[t.category]=(catMap[t.category]||0)+Number(t.amount); });
  const catTotals = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  const maxCat = catTotals.length ? catTotals[0][1] : 1;
  const filtered = UI.finFilter==='all' ? D.transactions : D.transactions.filter(t=>t.type===UI.finFilter);
  const cats = UI.finType==='out' ? CATS_OUT : CATS_IN;
  el.innerHTML = `
    <div class="card">
      <div class="ch"><span class="ct">Resumo financeiro</span><span class="cs">${new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</span></div>
      <div class="metrics">
        <div class="metric"><div class="ml">Receitas</div><div class="mv inc">${fmtBRL(inc)}</div></div>
        <div class="metric"><div class="ml">Despesas</div><div class="mv exp">${fmtBRL(exp)}</div></div>
        <div class="metric"><div class="ml">Saldo</div><div class="mv" style="color:${balColor}">${fmtBRL(bal)}</div></div>
      </div>
      ${catTotals.length ? `<div class="cs" style="margin-bottom:8px">Gastos por categoria</div><div class="bar-wrap">${catTotals.slice(0,5).map(([cat,val])=>`<div class="bar-row"><span class="bar-lbl">${esc(cat)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(val/maxCat*100)}%"></div></div><span class="bar-val">${fmtBRL(val)}</span></div>`).join('')}</div>` : ''}
    </div>
    <div class="card">
      <div class="ch"><span class="ct">Nova transação</span>
        <div class="ttog">
          <button class="tbtn ${UI.finType==='out'?'ao':''}" onclick="setFType('out')">Despesa</button>
          <button class="tbtn ${UI.finType==='in'?'ai':''}" onclick="setFType('in')">Receita</button>
        </div>
      </div>
      <div class="f3">
        <input type="text" id="fdesc" placeholder="Descrição..." maxlength="60"/>
        <input type="number" id="famt" placeholder="Valor (R$)" min="0" step="0.01"/>
        <select id="fcat">${cats.map(c=>`<option value="${esc(c)}" ${UI.finCat===c?'selected':''}>${esc(c)}</option>`).join('')}</select>
      </div>
      <button class="btn btn-full" onclick="addTx()">Adicionar transação</button>
    </div>
    <div class="card">
      <div class="ch"><span class="ct">Lançamentos</span>
        <div class="ttog">
          <button class="tbtn ${UI.finFilter==='all'?'aa':''}" onclick="setFFilter('all')">Todos</button>
          <button class="tbtn ${UI.finFilter==='in'?'ai':''}" onclick="setFFilter('in')">Receitas</button>
          <button class="tbtn ${UI.finFilter==='out'?'ao':''}" onclick="setFFilter('out')">Despesas</button>
        </div>
      </div>
      <div class="txlist">${filtered.length ? filtered.map(t=>`<div class="txi">
        <span class="txic">${esc((t.category||'💳').split(' ')[0])}</span>
        <div class="txin"><div class="txd">${esc(t.description)}</div><div class="txm">${esc((t.category||'').split(' ').slice(1).join(' '))} · ${fmtDate(t.date)}</div></div>
        <span class="txa ${t.type==='in'?'txin2':'txout'}">${t.type==='in'?'+':'-'}${fmtBRL(t.amount)}</span>
        <button class="xbtn" onclick="delTx('${t.id}')">&#215;</button>
      </div>`).join('') : '<p class="empty">Nenhum lançamento ainda.</p>'}</div>
    </div>`;
  document.getElementById('fdesc')?.addEventListener('keydown', e => { if (e.key==='Enter') addTx(); });
  document.getElementById('fcat')?.addEventListener('change', e => { UI.finCat = e.target.value; });
}
function setFType(t) { UI.finType = t; UI.finCat = t==='out' ? CATS_OUT[0] : CATS_IN[0]; renderFinance(); }
function setFFilter(t) { UI.finFilter = t; renderFinance(); }
async function addTx() {
  const desc = (document.getElementById('fdesc')?.value||'').trim();
  const amt  = parseFloat(document.getElementById('famt')?.value||'0');
  const cat  = document.getElementById('fcat')?.value || UI.finCat;
  if (!desc || !amt || amt <= 0) return;
  const {data} = await sb.from('transactions').insert({user_id:USER.id, description:desc, amount:amt, category:cat, type:UI.finType, date:TODAY}).select().single();
  if (data) { D.transactions.unshift(data); renderFinance(); renderOverview(); }
}
async function delTx(id) {
  await sb.from('transactions').delete().eq('id', id);
  D.transactions = D.transactions.filter(x=>x.id!==id); renderFinance(); renderOverview();
}

// INIT
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) await initApp(session.user);
})();
