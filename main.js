const PASSPHRASE = 'instructor'; // 🔒 Replace for real use
const SITE_SALT = 'uO-section-2025-10-02'; // used in hash generation
const CSV_PATH = '14370.csv';

// Student roster (parsed from your CSV)
const STUDENTS = [
  "Acuna, Alana","Autar, Akash","Barnes, Aj","Bertelsen, Hailey","Bradshaw, Charlie","Cook Diaz, Rowan","Cooper, Mikala","Corcoran, Nick","Craddock, Yun","De Leon, Isaiah","Dennis, Kelsey","Ellorin, Ysabella","Enright, Taylor","Finemel, Annie","Freed, Drake","Friel, Liem","Fulk, Logan","Gomez-Chan, Fabiola","Hacker, Connor","Hansen, Reese","Hines, Nadia","Hussein, Rima","Kendall, Ava","Khanna, Ananya","Krueger, Tessa","Lage, Adeline","Lambo, Dexter","Lara, Diego","Lara, Victor","Leach, Gwendolynn","Lebo, Rachel","Lilly, Genevieve","Lucas, Grae","Maher, Kyle","Martin, Lea","Martinez, Marina","McDonald, Cam'Ron","Mehta, Jhil","Mosolgo, Anabella","Narbaez, Adrien","Nollette, Isabelle","Owens, Richie","Palmer, B J","Partain, Adrian","Petitt, McKenzie","Printz, Dane","Quizon, Ivanna","Rathore, Max","Roan, Dana","Robin, Aidan","Rook, Cassidy","Roscher, Wyatt","Rueter, Rochelle","Rutan, Triston","Sanada, Maia","Schmidt, Thomas","Schmitt, Eliot","Shaft, Isabella","Shepler, Izzy","Silvia, Noah","Spengler, Sascha","Tarbox, Michael","Toyooka, Luke","Uehara, Kierstin","Valdez, Bella","Walts, Benjamin","Watson, Magdalyn","Wenz, Kamryn","Winchester, Sierra","Wright, Jace"
].map(s=>s.trim());
console.log('Loaded students:', STUDENTS);

// Storage helpers
const KEY = 'section.signin.v1';
const load = () => JSON.parse(localStorage.getItem(KEY) || '{}');
const save = (obj) => localStorage.setItem(KEY, JSON.stringify(obj));

function emptyRecord(name){
  return { name, status: 'unchecked', toggles: 0, checkTime: null, uncheckTime: null, checkHash: null, uncheckHash: null };
}

// Crypto: SHA-256 hex
async function sha256Hex(str){
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function makeHash(name, iso){
  const ua = navigator.userAgent || 'ua';
  const payload = `${SITE_SALT}|${name}|${ua}|${iso}`;
  return await sha256Hex(payload);
}

/***********************
 * RENDER: STUDENT LIST
 ***********************/
const listEl = document.getElementById('studentList');
const remainingInfo = document.getElementById('remainingInfo');

function renderList(filter=''){
  const db = load();
  const q = filter.toLowerCase();
  listEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  STUDENTS.filter(n=>n.toLowerCase().includes(q)).forEach((name, idx) => {
    const rec = db[name] || emptyRecord(name);
    const row = document.createElement('div');
    row.className = 'row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = rec.status === 'checked';
    cb.disabled = rec.toggles >= 2; // lock after 2 toggles
    cb.id = `cb-${idx}`;

    cb.addEventListener('change', async () => {
      const now = new Date().toISOString();
      const newDB = load();
      const r = newDB[name] || emptyRecord(name);
      if(r.toggles >= 2){
        cb.checked = r.status === 'checked';
        return;
      }
      if(cb.checked){
        r.status = 'checked';
        r.toggles += 1;
        r.checkTime = now;
        r.checkHash = await makeHash(name, now);
      } else {
        r.status = 'unchecked';
        r.toggles += 1; // only allow single uncheck after a check
        r.uncheckTime = now;
        r.uncheckHash = await makeHash(name, now);
      }
      newDB[name] = r; save(newDB);
      refreshInstructor();
      renderList(document.getElementById('search').value);
    });

    const label = document.createElement('label');
    label.htmlFor = cb.id;
    label.style.display = 'contents';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    nameSpan.textContent = name;

    const status = document.createElement('small');
    status.innerHTML = rec.status === 'checked' ? '<span class="pill ok">checked</span>' : '<span class="pill">not checked</span>';

    const left = document.createElement('small');
    const remaining = Math.max(0, 2 - rec.toggles);
    left.className = 'muted';
    left.textContent = `remaining actions: ${remaining}`;

    row.append(cb, label, nameSpan, status, left);
    frag.appendChild(row);
  });
  listEl.appendChild(frag);
  const totalRemaining = STUDENTS.reduce((acc,n)=>{const r=(load()[n]||emptyRecord(n));return acc + Math.max(0,2-r.toggles)},0);
  remainingInfo.textContent = `${totalRemaining} actions remaining across class`;
}

/*************************
 * INSTRUCTOR DASHBOARD
 *************************/
const insPanel = document.getElementById('instructorPanel');
const insTBody = document.querySelector('#insTable tbody');

function renderInsRow(rec){
  const tr = document.createElement('tr');
  const fmt = (iso)=> iso? new Date(iso).toLocaleString(): '';
  tr.innerHTML = `
    <td>${rec.name}</td>
    <td>${rec.status === 'checked' ? '<span class="pill ok">checked</span>' : '<span class="pill">not checked</span>'} <span class="muted">(${rec.toggles}/2)</span></td>
    <td class="muted">${fmt(rec.checkTime)}</td>
    <td><code>${rec.checkHash ? rec.checkHash.slice(0,12)+'…' : ''}</code></td>
    <td class="muted">${fmt(rec.uncheckTime)}</td>
    <td><code>${rec.uncheckHash ? rec.uncheckHash.slice(0,12)+'…' : ''}</code></td>
    <td>
      <button class="btn btn-warn" data-act="reset" data-name="${rec.name}">Reset</button>
    </td>`;
  return tr;
}

function refreshInstructor(){
  const db = load();
  insTBody.innerHTML = '';
  STUDENTS.forEach(name => {
    const rec = db[name] || emptyRecord(name);
    insTBody.appendChild(renderInsRow(rec));
  });
}

// Delegate button clicks (per‑user reset)
insTBody.addEventListener('click', e => {
  const btn = e.target.closest('button[data-act="reset"]');
  if(!btn) return;
  const name = btn.getAttribute('data-name');
  const db = load();
  db[name] = emptyRecord(name);
  save(db);
  refreshInstructor();
  renderList(document.getElementById('search').value);
});

// Reset all
document.getElementById('resetAll').addEventListener('click', () => {
  if(!confirm('Reset all students? This clears all statuses, times, and hashes.')) return;
  const db = {};
  STUDENTS.forEach(n=>db[n]=emptyRecord(n));
  save(db);
  refreshInstructor();
  renderList(document.getElementById('search').value);
});

/***********************
 * AUTH MODAL
 ***********************/
const authModal = document.getElementById('authModal');
const passInput = document.getElementById('pass');

function requireAuth(){
  authModal.showModal();
  passInput.value='';
  setTimeout(()=>passInput.focus(), 50);
}

function openInstructor(){
  insPanel.classList.remove('hidden');
  insPanel.setAttribute('aria-hidden','false');
  refreshInstructor();
}

function closeInstructor(){
  insPanel.classList.add('hidden');
  insPanel.setAttribute('aria-hidden','true');
}

// Initial state: instructor panel hidden
closeInstructor();

// open modal
document.getElementById('instructorBtn').addEventListener('click', requireAuth);

// handle auth
document.getElementById('authGo').addEventListener('click', (e) => {
  e.preventDefault();
  if(passInput.value === PASSPHRASE){
    authModal.close();
    openInstructor();
  } else {
    alert('Incorrect passphrase');
  }
});

// sign out
document.getElementById('signOut').addEventListener('click', closeInstructor);

/***********************
 * EXPORT CSV
 ***********************/
function exportCSV(){
  const db = load();
  const rows = [['Name','Status','Toggles','Check Time','Check Hash','Uncheck Time','Uncheck Hash']];
  STUDENTS.forEach(n=>{
    const r = db[n] || emptyRecord(n);
    rows.push([r.name,r.status,r.toggles,r.checkTime||'',r.checkHash||'',r.uncheckTime||'',r.uncheckHash||'']);
  });
  const csv = rows.map(r=>r.map(x=>`"${String(x).replaceAll('"','""')}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'),{href:url,download:'sign_in_log.csv'});
  a.click(); URL.revokeObjectURL(url);
}

document.getElementById('exportBtn').addEventListener('click', exportCSV);

/***********************
 * SEARCH
 ***********************/
const search = document.getElementById('search');
search.addEventListener('input', (e)=> renderList(e.target.value));

/***********************
 * INIT
 ***********************/
(function init(){
  // Ensure all students exist in storage
  const db = load();
  let changed = false;
  STUDENTS.forEach(n=>{ if(!db[n]){ db[n] = emptyRecord(n); changed = true; } });
  if(changed) save(db);
  renderList();
})();