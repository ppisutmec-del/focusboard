// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FOCUSBOARD — app.js
// Firebase Firestore + All UI Logic
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { initializeApp }          from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getFirestore, collection, addDoc, updateDoc, setDoc, deleteDoc, doc, query, orderBy, onSnapshot, serverTimestamp }
                                  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getAuth, signInAnonymously, onAuthStateChanged, browserLocalPersistence, setPersistence }
                                  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { firebaseConfig }         from './firebase-config.js';

// ── Firebase init ────────────────────────────────────────
const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);
export const userId = () => auth.currentUser?.uid ?? null;

// ── Date helpers ─────────────────────────────────────────
const THdays  = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
const THmonth = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const THmonthFull = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0,0,0,0);
  return x;
}

function daysRemaining(isoDate) {
  const today    = startOfDay(new Date());
  const deadline = startOfDay(new Date(isoDate + 'T00:00:00'));
  return Math.ceil((deadline - today) / 86400000);
}

function fmtDate(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return `${d.getDate()} ${THmonth[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtDaysLabel(n) {
  if (n < 0)  return `เลย ${Math.abs(n)} วัน`;
  if (n === 0) return 'วันนี้!';
  if (n === 1) return 'เหลือ 1 วัน';
  return `เหลือ ${n} วัน`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Firebase CRUD (Shared Board: PC & Smartphone sync directly) ──
const BOARD_ID = 'main';
const tasksCollection = () => collection(db, 'boards', BOARD_ID, 'tasks');
const taskDoc = (id) => doc(db, 'boards', BOARD_ID, 'tasks', id);
const boardDoc = () => doc(db, 'boards', BOARD_ID);

export async function addTask(task) {
  await addDoc(tasksCollection(), {
    ...task,
    status:    task.status    ?? 'todo',
    progress:  task.progress  ?? 0,
    urgency:   task.urgency   ?? false,
    importance:task.importance?? false,
    createdAt: serverTimestamp(),
  });
}

export async function updateTask(id, patch) {
  await updateDoc(taskDoc(id), patch);
}

export async function deleteTask(id) {
  await deleteDoc(taskDoc(id));
}

export function onTasksChange(callback) {
  const q = query(
    tasksCollection(),
    orderBy('deadline', 'asc')
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ── Color → CSS event class ──────────────────────────────
function colorToEvClass(c) {
  const map = { 'note-p':'ev-r','note-y':'ev-a','note-b':'ev-b','note-g':'ev-g','note-o':'ev-o' };
  return map[c] || 'ev-a';
}

// ── Render: Alert strip ──────────────────────────────────
function renderAlertStrip(tasks) {
  const urgent = tasks.filter(t => t.status !== 'done' && daysRemaining(t.deadline) <= 3);
  const overdue = urgent.filter(t => daysRemaining(t.deadline) < 0);

  document.getElementById('overdueCount').textContent = `เลยกำหนด ${overdue.length} งาน`;

  // Sidebar / mobile badges
  const today0 = tasks.filter(t => t.status !== 'done' && daysRemaining(t.deadline) === 0).length;
  const in3    = tasks.filter(t => t.status !== 'done' && daysRemaining(t.deadline) > 0 && daysRemaining(t.deadline) <= 3).length;
  document.getElementById('badgeToday').textContent = today0;
  document.getElementById('badge3d').textContent    = in3;
  const bnBadge = document.getElementById('bnBadge');
  if (bnBadge) { bnBadge.classList.toggle('show', (today0 + in3) > 0); }

  const container = document.getElementById('alertItems');
  if (!urgent.length) {
    container.innerHTML = '<div class="alert-empty">✓ ยังไม่มีงานด่วนในขณะนี้</div>';
    return;
  }

  container.innerHTML = urgent.map(t => {
    const days = daysRemaining(t.deadline);
    let tagClass = 'urgency-3d';
    let tagText  = `ภายใน ${days} วัน`;
    if (days < 0)  { tagClass = 'urgency-ov'; tagText = `เลย ${Math.abs(days)} วัน`; }
    if (days === 0){ tagClass = 'urgency-now'; tagText = 'ครบวันนี้'; }
    if (days === 1){ tagClass = 'urgency-now'; tagText = 'ครบพรุ่งนี้'; }
    return `
      <div class="alert-item">
        <div class="alert-item-l">
          <span class="urgency-tag ${tagClass}">${tagText}</span>
          <span class="task-name">${escHtml(t.title)}</span>
        </div>
        <div class="act-row">
          <button class="btn-ghost" onclick="openEditModal('${t.id}')">แก้ไข</button>
          <button class="btn-solid-sm" onclick="markDoing('${t.id}')">ทำตอนนี้</button>
        </div>
      </div>`;
  }).join('');
}

// ── Render: Focus 3 ──────────────────────────────────────
function renderFocusGrid(tasks) {
  const active = tasks
    .filter(t => t.status !== 'done')
    .sort((a,b) => {
      const da = daysRemaining(a.deadline), db2 = daysRemaining(b.deadline);
      // urgency flag first, then deadline proximity
      if (a.urgency !== b.urgency) return a.urgency ? -1 : 1;
      return da - db2;
    })
    .slice(0, 3);

  const grid = document.getElementById('focusGrid');
  if (!active.length) {
    grid.innerHTML = '<div class="postit-placeholder">ยังไม่มีงาน — กด "+ งานใหม่" เพื่อเริ่มต้น</div>';
    return;
  }

  const labels = ['01 · ด่วนมาก','02 · งานหลัก','03 · งานถัดไป'];
  const rotates = ['-0.7deg','0.6deg','-0.4deg'];
  grid.innerHTML = active.map((t, i) => {
    const days = daysRemaining(t.deadline);
    return `
      <div class="postit ${t.color || 'note-y'}" style="transform:rotate(${rotates[i]})" onclick="openEditModal('${t.id}')">
        <div class="postit-num">${labels[i]}</div>
        <div class="postit-title">${escHtml(t.title)}</div>
        <div class="postit-meta">กำหนด: <span class="postit-deadline ${days <= 1 ? 'hot':''}">${fmtDate(t.deadline)}</span></div>
        <div class="postit-footer">
          <span class="postit-days">⏱ ${fmtDaysLabel(days)}</span>
          <label class="check-lbl" onclick="event.stopPropagation()">
            <input type="checkbox" ${t.status==='done'?'checked':''} onchange="toggleDone('${t.id}',this.checked)"> เสร็จแล้ว
          </label>
        </div>
      </div>`;
  }).join('');
}

// ── Render: Calendar ─────────────────────────────────────
function renderCalendar(tasks) {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();

  document.getElementById('calTitle').textContent = `ปฏิทิน — ${THmonthFull[month]} ${year}`;

  const firstDay  = new Date(year, month, 1).getDay();
  const daysInMon = new Date(year, month+1, 0).getDate();
  const todayDate = now.getDate();

  // group tasks by day of current month
  const byDay = {};
  tasks.filter(t => t.status !== 'done').forEach(t => {
    const d = new Date(t.deadline + 'T00:00:00');
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = d.getDate();
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(t);
    }
  });

  const dows = ['อา','จ','อ','พ','พฤ','ศ','ส'];
  let html = dows.map(d => `<div class="cal-dow">${d}</div>`).join('');

  // leading blanks
  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day dim"><span class="day-num">—</span></div>`;

  for (let day = 1; day <= daysInMon; day++) {
    const isToday = day === todayDate;
    const evts = byDay[day] || [];
    const evHtml = evts.slice(0,2).map(t =>
      `<div class="cal-ev ${colorToEvClass(t.color)}" onclick="openEditModal('${t.id}')" title="${escHtml(t.title)}">${escHtml(t.title)}</div>`
    ).join('') + (evts.length > 2 ? `<div class="cal-ev" style="color:var(--ink-3)">+${evts.length-2} อีก</div>` : '');
    html += `<div class="cal-day${isToday?' today':''}"><span class="day-num">${day}</span>${evHtml}</div>`;
  }

  // trailing blanks
  const total = firstDay + daysInMon;
  const trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 0; i < trailing; i++) html += `<div class="cal-day dim"><span class="day-num">—</span></div>`;

  document.getElementById('calGrid').innerHTML = html;
}

// ── Render: Deadline list ────────────────────────────────
function renderDeadlineList(tasks) {
  const list = tasks.filter(t => t.status !== 'done').slice(0, 5);
  const el   = document.getElementById('deadlineList');
  if (!list.length) { el.innerHTML = '<div class="dl-empty">ยังไม่มีงาน</div>'; return; }
  el.innerHTML = list.map((t, i) => {
    const days = daysRemaining(t.deadline);
    return `
      <div class="dl-item" onclick="openEditModal('${t.id}')">
        <div class="dl-rank">${i+1}</div>
        <span class="dl-name">${escHtml(t.title)}</span>
        <span class="dl-date ${days <= 1 ? 'hot':''}">${fmtDate(t.deadline)}</span>
      </div>`;
  }).join('');
}

// ── Render: Weekly strip ─────────────────────────────────
function renderWeekCols(tasks) {
  const now   = new Date();
  const dow   = now.getDay(); // 0=Sun
  // Make Monday the start
  const monOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + monOffset);

  const names = ['จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์','อาทิตย์'];
  let html = '';
  for (let i = 0; i < 7; i++) {
    const d   = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const isToday = iso === todayISO();
    const isWeekend = i >= 5;
    const dayTasks = tasks.filter(t => t.deadline === iso && t.status !== 'done');
    const notesHtml = dayTasks.map(t =>
      `<div class="week-note ${t.color || 'note-y'}" onclick="openEditModal('${t.id}')">${escHtml(t.title)}</div>`
    ).join('');
    html += `
      <div class="week-day ${isToday?'today-col':''} ${isWeekend?'dim-col':''}">
        <div class="wday-name">${names[i]}</div>
        <div class="wday-num">${d.getDate()}</div>
        ${notesHtml}
      </div>`;
  }
  // Update title
  const sun = new Date(monday); sun.setDate(monday.getDate() + 6);
  document.getElementById('weekTitle').textContent = `สัปดาห์นี้ — ${monday.getDate()} ${THmonth[monday.getMonth()]} ถึง ${sun.getDate()} ${THmonth[sun.getMonth()]}`;
  document.getElementById('weekCols').innerHTML = html;
}

// ── Render: Kanban ───────────────────────────────────────
function renderKanban(tasks) {
  const cols = { todo: [], doing: [], done: [] };
  tasks.forEach(t => { (cols[t.status] || cols.todo).push(t); });

  document.getElementById('kCountTodo').textContent  = cols.todo.length;
  document.getElementById('kCountDoing').textContent = cols.doing.length;
  document.getElementById('kCountDone').textContent  = cols.done.length;

  function noteHtml(t) {
    const progHtml = (t.status === 'doing' && t.progress > 0)
      ? `<div class="prog-bar"><div class="prog-fill" style="width:${t.progress}%;background:#0284c7"></div></div>` : '';
    return `
      <div class="k-note ${t.color || 'note-y'} ${t.status==='done'?'done':''}" onclick="openEditModal('${t.id}')">
        <div class="k-title">${escHtml(t.title)}</div>
        <div class="k-meta">ครบ ${fmtDate(t.deadline)}${t.progress>0?' · '+t.progress+'%':''}</div>
        ${progHtml}
      </div>`;
  }

  document.getElementById('kColTodo').innerHTML  = cols.todo.map(noteHtml).join('') || '<div style="font-size:.72rem;color:var(--ink-3);font-style:italic;padding:8px 0">ไม่มีงาน</div>';
  document.getElementById('kColDoing').innerHTML = cols.doing.map(noteHtml).join('') || '<div style="font-size:.72rem;color:var(--ink-3);font-style:italic;padding:8px 0">ไม่มีงาน</div>';
  document.getElementById('kColDone').innerHTML  = cols.done.map(noteHtml).join('') || '<div style="font-size:.72rem;color:var(--ink-3);font-style:italic;padding:8px 0">ยังไม่มีงานที่เสร็จ</div>';
}

// ── Render: Matrix ───────────────────────────────────────
function renderMatrix(tasks) {
  const active = tasks.filter(t => t.status !== 'done');
  // q1: urgent+important, q2: !urgent+important, q3: urgent+!important, q4: !urgent+!important
  const q1 = active.filter(t =>  t.urgency &&  t.importance);
  const q2 = active.filter(t => !t.urgency &&  t.importance);
  const q3 = active.filter(t =>  t.urgency && !t.importance);
  const q4 = active.filter(t => !t.urgency && !t.importance);

  function quadHtml(list) {
    if (!list.length) return '<div class="matrix-empty">ยังไม่มีงานในกลุ่มนี้</div>';
    return list.map(t => `
      <div class="k-note ${t.color||'note-y'}" onclick="openEditModal('${t.id}')">
        <div class="k-title">${escHtml(t.title)}</div>
        <div class="k-meta">ครบ ${fmtDate(t.deadline)} · ${fmtDaysLabel(daysRemaining(t.deadline))}</div>
      </div>`).join('');
  }

  document.getElementById('q1').innerHTML = quadHtml(q1);
  document.getElementById('q2').innerHTML = quadHtml(q2);
  document.getElementById('q3').innerHTML = quadHtml(q3);
  document.getElementById('q4').innerHTML = quadHtml(q4);
}

// ── Render: all overview ─────────────────────────────────
function renderOverview(tasks) {
  renderAlertStrip(tasks);
  renderFocusGrid(tasks);
  renderCalendar(tasks);
  renderDeadlineList(tasks);
  renderWeekCols(tasks);
  renderKanban(tasks);
}

// ── View switching ───────────────────────────────────────
window.switchView = function(view, el) {
  const ov   = document.getElementById('viewOverview');
  const mx   = document.getElementById('viewMatrix');
  const tabOv = document.getElementById('tabOv');
  const tabMx = document.getElementById('tabMx');
  const title = document.getElementById('topbarTitle');

  if (view === 'overview') {
    ov.classList.remove('hidden'); mx.classList.add('hidden');
    tabOv?.classList.add('active'); tabMx?.classList.remove('active');
    title.textContent = 'ภาพรวมงาน';
  } else {
    mx.classList.remove('hidden'); ov.classList.add('hidden');
    tabMx?.classList.add('active'); tabOv?.classList.remove('active');
    title.textContent = 'จัดลำดับความสำคัญ';
  }
  document.querySelectorAll('.sb-item[data-view]').forEach(s => s.classList.remove('active'));
  document.querySelector(`.sb-item[data-view="${view}"]`)?.classList.add('active');
};

window.setBottomActive = function(el) {
  document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
};

// ── Modal ────────────────────────────────────────────────
let currentEditId = null;

window.openModal = function() {
  currentEditId = null;
  document.getElementById('modalTitle').textContent   = '📝 แปะ Post-it งานใหม่';
  document.getElementById('btnSubmit').textContent    = 'แปะลงบอร์ดทันที';
  document.getElementById('btnDelete').style.display  = 'none';
  document.getElementById('editTaskId').value         = '';
  document.getElementById('addTaskForm').reset();
  document.getElementById('taskDeadline').value       = todayISO();
  document.getElementById('taskColor').value          = 'note-p';
  document.querySelectorAll('.swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.color === 'note-p');
  });
  document.getElementById('modalBackdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('taskTitle').focus(), 100);
};

window.openEditModal = function(id) {
  // find task from last known snapshot
  const t = _lastTasks.find(x => x.id === id);
  if (!t) return;
  currentEditId = id;
  document.getElementById('modalTitle').textContent   = '✏️ แก้ไขงาน';
  document.getElementById('btnSubmit').textContent    = 'บันทึกการเปลี่ยนแปลง';
  document.getElementById('btnDelete').style.display  = 'block';
  document.getElementById('editTaskId').value         = id;
  document.getElementById('taskTitle').value          = t.title;
  document.getElementById('taskDeadline').value       = t.deadline;
  document.getElementById('taskStatus').value         = t.status || 'todo';
  document.getElementById('taskProgress').value       = t.progress || 0;
  document.getElementById('taskUrgency').checked      = !!t.urgency;
  document.getElementById('taskImportance').checked   = !!t.importance;
  document.getElementById('taskColor').value          = t.color || 'note-y';
  document.querySelectorAll('.swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.color === (t.color || 'note-y'));
  });
  document.getElementById('modalBackdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.closeModal = function() {
  document.getElementById('modalBackdrop').classList.remove('open');
  document.body.style.overflow = '';
  currentEditId = null;
};

window.handleBdClick = function(e) {
  if (e.target === document.getElementById('modalBackdrop')) closeModal();
};

window.selectSwatch = function(el) {
  document.querySelectorAll('.swatch').forEach(s => {
    s.classList.remove('selected');
    s.setAttribute('aria-checked','false');
  });
  el.classList.add('selected');
  el.setAttribute('aria-checked','true');
  document.getElementById('taskColor').value = el.dataset.color;
};

window.handleFormSubmit = async function(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSubmit');
  btn.disabled = true;
  btn.textContent = 'กำลังบันทึก...';

  const payload = {
    title:      document.getElementById('taskTitle').value.trim(),
    deadline:   document.getElementById('taskDeadline').value,
    color:      document.getElementById('taskColor').value,
    status:     document.getElementById('taskStatus').value,
    progress:   Number(document.getElementById('taskProgress').value) || 0,
    urgency:    document.getElementById('taskUrgency').checked,
    importance: document.getElementById('taskImportance').checked,
  };

  try {
    if (currentEditId) {
      await updateTask(currentEditId, payload);
    } else {
      await addTask(payload);
    }
    closeModal();
  } catch(err) {
    alert('บันทึกไม่สำเร็จ: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = currentEditId ? 'บันทึกการเปลี่ยนแปลง' : 'แปะลงบอร์ดทันที';
  }
};

window.handleDelete = async function() {
  if (!currentEditId) return;
  if (!confirm('ยืนยันลบงานนี้?')) return;
  try {
    await deleteTask(currentEditId);
    closeModal();
  } catch(err) {
    alert('ลบไม่สำเร็จ: ' + err.message);
  }
};

window.toggleDone = async function(id, checked) {
  await updateTask(id, { status: checked ? 'done' : 'todo', progress: checked ? 100 : 0 });
};

window.markDoing = async function(id) {
  await updateTask(id, { status: 'doing' });
};

// ── Topbar date ──────────────────────────────────────────
function setDateStrings() {
  const now = new Date();
  const dateStr = `${THdays[now.getDay()]}ที่ ${now.getDate()} ${THmonthFull[now.getMonth()]} ${now.getFullYear()}`;
  const monoStr = `${String(now.getDate()).padStart(2,'0')} ${THmonth[now.getMonth()].toUpperCase()} ${now.getFullYear()}`;
  document.getElementById('topbarDate').textContent = dateStr;
  document.getElementById('sbDate').textContent     = monoStr;
}

// ── HTML escape ──────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Memo note persistence (Realtime Cloud Sync) ──────────
function initMemo() {
  const el = document.getElementById('memoText');
  const key = 'focusboard_memo';
  const saved = localStorage.getItem(key);
  if (saved) el.textContent = saved;

  // Listen to remote changes from other devices (PC <-> Phone)
  onSnapshot(boardDoc(), snap => {
    if (snap.exists()) {
      const remoteMemo = snap.data().memo;
      if (remoteMemo !== undefined && document.activeElement !== el) {
        el.textContent = remoteMemo;
        localStorage.setItem(key, remoteMemo);
      }
    }
  });

  // Debounced save to Firestore
  let timer;
  el.addEventListener('input', () => {
    localStorage.setItem(key, el.textContent);
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        await setDoc(boardDoc(), { memo: el.textContent }, { merge: true });
      } catch (e) {
        console.warn('Memo sync error:', e);
      }
    }, 600);
  });
}

// ── FAB visibility ───────────────────────────────────────
function initFab() {
  const fab = document.getElementById('fab');
  if (!fab) return;
  const mq = window.matchMedia('(max-width: 767px)');
  const update = () => { fab.style.display = mq.matches ? 'flex' : 'none'; };
  mq.addEventListener('change', update);
  update();
}

// ── Store last snapshot for edit modal ───────────────────
let _lastTasks = [];

// ── Start app after auth ─────────────────────────────────
function startApp() {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('viewOverview').classList.remove('hidden');

  setDateStrings();
  initMemo();
  initFab();

  onTasksChange(tasks => {
    _lastTasks = tasks;
    renderOverview(tasks);
    renderMatrix(tasks);
  });
}

// ── Auth bootstrap ───────────────────────────────────────
(async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
    onAuthStateChanged(auth, user => {
      if (user) {
        startApp();
      }
    });
    await signInAnonymously(auth);
  } catch(err) {
    document.getElementById('loadingScreen').innerHTML =
      `<div class="loading-inner"><div style="color:var(--rose);font-size:.85rem">เชื่อมต่อ Firebase ไม่สำเร็จ<br><small>${err.message}</small></div></div>`;
  }
})();
