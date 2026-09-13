/* ============================================================
   AI DAY PLANNER — основная логика
   ============================================================ */

// ---------- КОНСТАНТЫ ----------
const STORAGE = {
  TASKS: 'aidp_tasks',
  CHAT: 'aidp_chat',
  SETTINGS: 'aidp_settings',
  ONBOARDED: 'aidp_onboarded',
};

const CATEGORIES = {
  work:    { label: 'Работа',  color: '#7C5CFF' },
  study:   { label: 'Учёба',   color: '#6EE7B7' },
  sport:   { label: 'Спорт',   color: '#FFB86C' },
  personal:{ label: 'Личное',  color: '#FF79C6' },
  health:  { label: 'Здоровье',color: '#8BE9FD' },
  other:   { label: 'Другое',  color: '#8B8D98' },
};

const DEFAULT_SETTINGS = {
  name: '',
  apiKey: '',
  apiUrl: 'https://api.deepseek.com/v1/chat/completions',
  apiModel: 'deepseek-chat',
  notifTasks: true,
  notifDigest: true,
  amoled: false,
};

// ---------- СОСТОЯНИЕ ----------
let state = {
  tasks: [],      // {id, title, date:'YYYY-MM-DD', time:'HH:MM', duration, category, done}
  chat: [],       // {role:'user'|'ai', text}
  settings: { ...DEFAULT_SETTINGS },
  selectedDate: todayISO(),
  calMonth: new Date(),
  editingTaskId: null,
};

// ---------- УТИЛИТЫ ----------
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

// ---------- ХРАНИЛИЩЕ ----------
function load() {
  try {
    state.tasks = JSON.parse(localStorage.getItem(STORAGE.TASKS) || '[]');
    state.chat = JSON.parse(localStorage.getItem(STORAGE.CHAT) || '[]');
    state.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE.SETTINGS) || '{}') };
  } catch (e) { console.warn('load error', e); }
}
function save() {
  localStorage.setItem(STORAGE.TASKS, JSON.stringify(state.tasks));
  localStorage.setItem(STORAGE.CHAT, JSON.stringify(state.chat));
  localStorage.setItem(STORAGE.SETTINGS, JSON.stringify(state.settings));
}

// ============================================================
// РЕНДЕР
// ============================================================

function renderGreeting() {
  const h = new Date().getHours();
  let greet = 'Доброй ночи';
  if (h >= 5 && h < 12) greet = 'Доброе утро';
  else if (h >= 12 && h < 18) greet = 'Добрый день';
  else if (h >= 18 && h < 23) greet = 'Добрый вечер';

  const name = state.settings.name ? `, ${state.settings.name}` : '';
  $('#greeting').textContent = greet + name;

  const d = new Date();
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const days = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
  $('#currentDate').textContent = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function renderTasks() {
  const date = state.selectedDate;
  const dayTasks = state.tasks
    .filter(t => t.date === date)
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

  const done = dayTasks.filter(t => t.done).length;
  const total = dayTasks.length;

  $('#progressLabel').textContent = `Выполнено ${done} из ${total}`;
  $('#progressFill').style.width = total ? `${(done / total) * 100}%` : '0%';

  const list = $('#taskList');
  const empty = $('#emptyTasks');
  list.innerHTML = '';

  if (dayTasks.length === 0) {
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
    dayTasks.forEach(t => list.appendChild(taskEl(t)));
  }
}

function taskEl(t) {
  const li = document.createElement('li');
  li.className = 'task-item' + (t.done ? ' done' : '');
  li.dataset.id = t.id;

  const cat = CATEGORIES[t.category] || CATEGORIES.other;
  const timeStr = t.time ? `${t.time}` : '—';

  li.innerHTML = `
    <input type="checkbox" class="task-check" ${t.done ? 'checked' : ''} />
    <div class="task-body">
      <div class="task-title">${escapeHtml(t.title)}</div>
      <div class="task-meta">
        <span class="task-cat-dot" style="background:${cat.color}"></span>
        <span>${cat.label}</span>
        <span>·</span>
        <span>${timeStr}${t.duration ? ` · ${t.duration} мин` : ''}</span>
      </div>
    </div>
    <button class="task-del" aria-label="Удалить">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
    </button>
  `;

  li.querySelector('.task-check').addEventListener('change', e => {
    t.done = e.target.checked;
    save(); renderTasks(); renderCalendar();
    if (t.done) checkAllDone();
  });

  li.querySelector('.task-del').addEventListener('click', () => {
    if (confirm(`Удалить "${t.title}"?`)) {
      state.tasks = state.tasks.filter(x => x.id !== t.id);
      save(); renderTasks(); renderCalendar();
    }
  });

  // Тап по телу задачи — редактирование
  li.querySelector('.task-body').addEventListener('click', () => openTaskModal(t.id));

  return li;
}

// ---------- КАЛЕНДАРЬ ----------
function renderCalendar() {
  const grid = $('#calGrid');
  grid.innerHTML = '';

  const m = state.calMonth;
  const year = m.getFullYear();
  const month = m.getMonth();

  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  $('#calMonthLabel').textContent = `${months[month]} ${year}`;

  const first = new Date(year, month, 1);
  // Понедельник = 0
  let startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  const todayStr = todayISO();

  // предыдущие дни
  for (let i = startOffset - 1; i >= 0; i--) {
    const day = prevDays - i;
    const d = new Date(year, month - 1, day);
    grid.appendChild(calDay(d, true));
  }
  // текущий месяц
  for (let d = 1; d <= daysInMonth; d++) {
    grid.appendChild(calDay(new Date(year, month, d), false));
  }
  // следующие
  const cells = grid.children.length;
  const rest = (7 - (cells % 7)) % 7;
  for (let d = 1; d <= rest; d++) {
    grid.appendChild(calDay(new Date(year, month + 1, d), true));
  }
}

function calDay(d, other) {
  const btn = document.createElement('button');
  btn.className = 'cal-day';
  const iso = isoDate(d);
  if (other) btn.classList.add('other');
  if (iso === todayISO()) btn.classList.add('today');
  if (iso === state.selectedDate) btn.classList.add('selected');

  btn.textContent = d.getDate();

  const hasTasks = state.tasks.some(t => t.date === iso);
  if (hasTasks) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    btn.appendChild(dot);
  }

  btn.addEventListener('click', () => {
    state.selectedDate = iso;
    if (other) {
      state.calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    }
    renderCalendar();
    renderTasks();
    renderSheet();
  });

  return btn;
}

// ---------- ЧАТ ----------
function renderChat() {
  const box = $('#chatMessages');
  box.innerHTML = '';
  if (state.chat.length === 0) {
    addMsgToDOM('ai', 'Привет! Опиши свой день словами — я расставлю задачи по времени ✨');
    return;
  }
  state.chat.forEach(m => addMsgToDOM(m.role, m.text));
  box.scrollTop = box.scrollHeight;
}

function addMsgToDOM(role, text, loading = false) {
  const box = $('#chatMessages');
  const el = document.createElement('div');
  el.className = `msg ${role}${loading ? ' loading' : ''}`;
  el.textContent = text;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
  return el;
}

// ============================================================
// AI
// ============================================================

const SYSTEM_PROMPT = `Ты — ассистент-планировщик. Пользователь описывает свой день на русском. 
Верни СТРОГО JSON-массив задач без markdown, без пояснений.
Формат каждой задачи: {"title":"...","time":"HH:MM","duration":число_минут,"category":"work|study|sport|personal|health|other"}
Правила:
- Если время не указано — предложи логичное.
- duration в минутах.
- Категория строго из списка.
- Никаких комментариев до или после JSON.`;

async function askAI(prompt) {
  if (!state.settings.apiKey) return demoResponse(prompt);

  const body = {
    model: state.settings.apiModel || 'deepseek-chat',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
  };

  try {
    const res = await fetch(state.settings.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.settings.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    return parseAITasks(text, prompt);
  } catch (e) {
    console.error(e);
    return { ok: false, error: 'Ошибка запроса к ИИ: ' + e.message };
  }
}

function parseAITasks(raw, prompt) {
  // вытащить JSON из возможного markdown
  let clean = raw.trim();
  const m = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) clean = m[1].trim();
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start === -1 || end === -1) return { ok: false, error: 'ИИ вернул не-JSON' };

  try {
    const arr = JSON.parse(clean.slice(start, end + 1));
    if (!Array.isArray(arr)) throw new Error('не массив');
    return { ok: true, tasks: arr };
  } catch (e) {
    return { ok: false, error: 'Не удалось распарсить ответ ИИ' };
  }
}

// ДЕМО-РЕЖИМ (если нет API-ключа)
function demoResponse(prompt) {
  const p = prompt.toLowerCase();
  const tasks = [];
  const targetDate = state.selectedDate;

  const add = (title, time, duration, category) => {
    tasks.push({ title, time, duration, category });
  };

  if (p.includes('учёб')) add('Учёба', '09:00', 300, 'study');
  if (p.includes('спорт') || p.includes('зал')) add('Спортзал', '15:00', 90, 'sport');
  if (p.includes('продукт') || p.includes('магазин')) add('Купить продукты', '18:00', 45, 'personal');
  if (p.includes('мам') || p.includes('позвон')) add('Позвонить маме', '19:30', 20, 'personal');
  if (p.includes('работ')) add('Работа', '10:00', 240, 'work');
  if (p.includes('зарядк') || p.includes('утр')) add('Утренняя зарядка', '07:30', 20, 'health');
  if (p.includes('завтрак')) add('Завтрак', '08:00', 30, 'health');
  if (p.includes('душ')) add('Душ', '08:30', 15, 'health');
  if (p.includes('план')) add('Планирование дня', '08:50', 15, 'work');

  if (tasks.length === 0) {
    add('Задача из промпта', '10:00', 60, 'other');
  }

  return {
    ok: true,
    tasks,
    _demo: true,
    _targetDate: targetDate,
  };
}

// ============================================================
// ОБРАБОТКА ОТПРАВКИ В ЧАТ
// ============================================================

async function sendChat(text) {
  if (!text.trim()) return;
  addMsgToDOM('user', text);
  state.chat.push({ role: 'user', text });

  const loadingEl = addMsgToDOM('ai', 'Думаю…', true);

  const res = await askAI(text);

  if (!res.ok) {
    loadingEl.remove();
    addMsgToDOM('ai', '⚠️ ' + (res.error || 'Не получилось'));
    state.chat.push({ role: 'ai', text: '⚠️ ' + (res.error || 'Не получилось') });
    save();
    return;
  }

  // Добавляем задачи
  const targetDate = res._targetDate || state.selectedDate;
  const created = [];
  res.tasks.forEach(t => {
    const task = {
      id: uid(),
      title: t.title || 'Задача',
      date: targetDate,
      time: t.time || '12:00',
      duration: t.duration || 30,
      category: CATEGORIES[t.category] ? t.category : 'other',
      done: false,
    };
    state.tasks.push(task);
    created.push(task);
    scheduleNotification(task);
  });

  const firstTime = created.map(t => t.time).sort()[0] || '09:00';
  const confirmText = `Добавил ${created.length} ${plural(created.length, 'задачу','задачи','задач')} на ${formatDateHuman(targetDate)}, начиная с ${firstTime} ✨` + (res._demo ? '\n\n(демо-режим: добавь API-ключ в настройках)' : '');

  loadingEl.remove();
  addMsgToDOM('ai', confirmText);
  state.chat.push({ role: 'ai', text: confirmText });

  save();
  renderTasks();
  renderCalendar();
}

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

function formatDateHuman(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((date - today) / 86400000);
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  if (diff === -1) return 'вчера';
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `${d} ${months[m - 1]}`;
}

// ============================================================
// УВЕДОМЛЕНИЯ
// ============================================================

const scheduledTimers = {};

async function requestNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch (e) {}
  }
}

function scheduleNotification(task) {
  if (!state.settings.notifTasks) return;
  if (Notification.permission !== 'granted') return;
  if (task.done) return;

  const [h, m] = (task.time || '12:00').split(':').map(Number);
  const [y, mo, d] = task.date.split('-').map(Number);
  const when = new Date(y, mo - 1, d, h, m, 0);
  const remindAt = when.getTime() - 15 * 60 * 1000; // за 15 минут
  const delay = remindAt - Date.now();
  if (delay < 0) return;

  if (scheduledTimers[task.id]) clearTimeout(scheduledTimers[task.id]);

  scheduledTimers[task.id] = setTimeout(() => {
    showNotif('Напоминание', `Через 15 минут: ${task.title}`, `task-${task.id}`);
  }, delay);
}

function showNotif(title, body, tag) {
  if (Notification.permission !== 'granted') return;
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag,
        vibrate: [100, 50, 100],
      });
    });
  } else {
    new Notification(title, { body, tag });
  }
}

function scheduleDigest() {
  if (!state.settings.notifDigest) return;
  const now = new Date();
  const next = new Date(now);
  next.setHours(8, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const delay = next - now;
  setTimeout(() => {
    const today = todayISO();
    const count = state.tasks.filter(t => t.date === today && !t.done).length;
    if (count > 0) showNotif('☀️ Доброе утро', `Сегодня у тебя ${count} задач, начнём?`, 'digest');
    scheduleDigest();
  }, delay);
}

// ============================================================
// НАВИГАЦИЯ
// ============================================================

function setupNav() {
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      $$('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (tab === 'day') {
        state.selectedDate = todayISO();
        state.calMonth = new Date();
        renderCalendar(); renderTasks();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (tab === 'calendar') {
        $('.calendar-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (tab === 'ai') {
        $('.chat-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (tab === 'settings') {
        openSettings();
      }
    });
  });
}

// ============================================================
// МОДАЛКИ / ШТОРКА
// ============================================================

function openSettings() {
  $('#setName').value = state.settings.name || '';
  $('#setApiKey').value = state.settings.apiKey || '';
  $('#setApiUrl').value = state.settings.apiUrl || '';
  $('#setApiModel').value = state.settings.apiModel || '';
  $('#setNotifTasks').checked = state.settings.notifTasks;
  $('#setNotifDigest').checked = state.settings.notifDigest;
  $('#setAmoled').checked = state.settings.amoled;
  $('#settingsBackdrop').classList.remove('hidden');
  $('#settingsModal').classList.remove('hidden');
}
function closeSettings() {
  $('#settingsBackdrop').classList.add('hidden');
  $('#settingsModal').classList.add('hidden');
}

function openTaskModal(id = null) {
  state.editingTaskId = id;
  const modal = $('#taskModal');
  $('#taskModalTitle').textContent = id ? 'Редактировать' : 'Новая задача';
  if (id) {
    const t = state.tasks.find(x => x.id === id);
    if (!t) return;
    $('#taskTitle').value = t.title;
    $('#taskDate').value = t.date;
    $('#taskTime').value = t.time || '';
    $('#taskDuration').value = t.duration || 30;
    $('#taskCategory').value = t.category || 'other';
  } else {
    $('#taskTitle').value = '';
    $('#taskDate').value = state.selectedDate;
    $('#taskTime').value = '10:00';
    $('#taskDuration').value = 30;
    $('#taskCategory').value = 'personal';
  }
  $('#taskBackdrop').classList.remove('hidden');
  modal.classList.remove('hidden');
}
function closeTaskModal() {
  $('#taskBackdrop').classList.add('hidden');
  $('#taskModal').classList.add('hidden');
}

function saveTask() {
  const title = $('#taskTitle').value.trim();
  if (!title) { alert('Введите название'); return; }
  const data = {
    title,
    date: $('#taskDate').value || todayISO(),
    time: $('#taskTime').value || '12:00',
    duration: parseInt($('#taskDuration').value) || 30,
    category: $('#taskCategory').value,
  };

  if (state.editingTaskId) {
    const t = state.tasks.find(x => x.id === state.editingTaskId);
    Object.assign(t, data);
    scheduleNotification(t);
  } else {
    const t = { id: uid(), ...data, done: false };
    state.tasks.push(t);
    scheduleNotification(t);
  }
  save(); closeTaskModal();
  renderTasks(); renderCalendar();
}

function renderSheet() {
  const list = $('#sheetTaskList');
  list.innerHTML = '';
  const tasks = state.tasks
    .filter(t => t.date === state.selectedDate)
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

  $('#sheetDate').textContent = formatDateHuman(state.selectedDate);

  if (tasks.length === 0) {
    list.innerHTML = '<li class="empty-state">Нет задач на этот день</li>';
  } else {
    tasks.forEach(t => list.appendChild(taskEl(t)));
  }
}
function openSheet() {
  renderSheet();
  $('#sheetBackdrop').classList.remove('hidden');
  $('#daySheet').classList.remove('hidden');
}
function closeSheet() {
  $('#sheetBackdrop').classList.add('hidden');
  $('#daySheet').classList.add('hidden');
}

// ============================================================
// КОНФЕТТИ
// ============================================================

let lastAllDone = null;
function checkAllDone() {
  const today = state.selectedDate;
  const tasks = state.tasks.filter(t => t.date === today);
  if (tasks.length < 2) return;
  const all = tasks.every(t => t.done);
  if (all && lastAllDone !== today) {
    lastAllDone = today;
    launchConfetti();
  }
}

function launchConfetti() {
  const canvas = $('#confetti');
  canvas.classList.remove('hidden');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ['#7C5CFF', '#6EE7B7', '#FFB86C', '#FF79C6', '#8BE9FD'];
  const parts = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 100,
    vx: (Math.random() - 0.5) * 4,
    vy: 3 + Math.random() * 4,
    size: 5 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.2,
  }));

  let frames = 0;
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    frames++;
    if (frames < 180) requestAnimationFrame(tick);
    else canvas.classList.add('hidden');
  }
  tick();
}

// ============================================================
// ЭКСПОРТ / ИМПОРТ
// ============================================================

function exportData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks: state.tasks,
    chat: state.chat,
    settings: state.settings,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aidp-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.tasks) state.tasks = data.tasks;
      if (data.chat) state.chat = data.chat;
      if (data.settings) state.settings = { ...DEFAULT_SETTINGS, ...data.settings };
      save();
      applyTheme();
      renderGreeting(); renderTasks(); renderCalendar(); renderChat();
      closeSettings();
      alert('Импортировано!');
    } catch (err) {
      alert('Ошибка импорта: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ============================================================
// ТЕМА
// ============================================================

function applyTheme() {
  document.body.classList.toggle('amoled', !!state.settings.amoled);
}

// ============================================================
// ГОЛОС
// ============================================================

function startVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert('Голосовой ввод не поддерживается'); return; }
  const rec = new SR();
  rec.lang = 'ru-RU';
  rec.interimResults = false;
  rec.onresult = e => {
    const text = e.results[0][0].transcript;
    $('#chatInput').value = text;
    sendChat(text);
    $('#chatInput').value = '';
  };
  rec.onerror = e => console.warn(e);
  rec.start();
}

// ============================================================
// ОНБОРДИНГ
// ============================================================

function setupOnboarding() {
  const onboarded = localStorage.getItem(STORAGE.ONBOARDED) === '1';
  if (onboarded) return;

  const onb = $('#onboarding');
  onb.classList.remove('hidden');
  const track = $('#onbTrack');
  const dots = $('#onbDots');
  let slide = 0;

  [0, 1, 2].forEach(i => {
    const d = document.createElement('div');
    d.className = 'dot' + (i === 0 ? ' active' : '');
    dots.appendChild(d);
  });

  function go(i) {
    slide = Math.max(0, Math.min(2, i));
    track.style.transform = `translateX(-${slide * 100}%)`;
    dots.querySelectorAll('.dot').forEach((d, idx) => d.classList.toggle('active', idx === slide));
    $('#onbNext').textContent = slide === 2 ? 'Начать' : 'Далее';
  }

  $('#onbNext').addEventListener('click', () => {
    if (slide === 2) {
      localStorage.setItem(STORAGE.ONBOARDED, '1');
      onb.classList.add('hidden');
      requestNotifPermission();
    } else go(slide + 1);
  });
  $('#onbSkip').addEventListener('click', () => {
    localStorage.setItem(STORAGE.ONBOARDED, '1');
    onb.classList.add('hidden');
    requestNotifPermission();
  });

  // свайп
  let sx = 0;
  track.addEventListener('touchstart', e => sx = e.touches[0].clientX);
  track.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 40) go(dx < 0 ? slide + 1 : slide - 1);
  });
}

// ============================================================
// SWIPE МЕЖДУ МЕСЯЦАМИ
// ============================================================

function setupCalendarSwipe() {
  const cal = $('.calendar-card');
  let sx = 0, sy = 0;
  cal.addEventListener('touchstart', e => {
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  });
  cal.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      state.calMonth.setMonth(state.calMonth.getMonth() + (dx < 0 ? 1 : -1));
      renderCalendar();
    }
  });
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

function setupEvents() {
  // чат
  $('#btnSend').addEventListener('click', () => {
    const v = $('#chatInput').value;
    $('#chatInput').value = '';
    sendChat(v);
  });
  $('#chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const v = e.target.value;
      e.target.value = '';
      sendChat(v);
    }
  });
  $('#btnVoice').addEventListener('click', startVoice);
  $('#btnClearChat').addEventListener('click', () => {
    if (confirm('Очистить чат?')) {
      state.chat = []; save(); renderChat();
    }
  });
  $$('.chip').forEach(c => c.addEventListener('click', () => {
    $('#chatInput').value = c.dataset.prompt;
    $('#chatInput').focus();
  }));

  // настройки
  $('#btnSettings').addEventListener('click', openSettings);
  $('#settingsClose').addEventListener('click', closeSettings);
  $('#settingsBackdrop').addEventListener('click', closeSettings);

  $('#setName').addEventListener('input', e => { state.settings.name = e.target.value; save(); renderGreeting(); });
  $('#setApiKey').addEventListener('input', e => { state.settings.apiKey = e.target.value.trim(); save(); });
  $('#setApiUrl').addEventListener('input', e => { state.settings.apiUrl = e.target.value.trim(); save(); });
  $('#setApiModel').addEventListener('input', e => { state.settings.apiModel = e.target.value.trim(); save(); });
  $('#setNotifTasks').addEventListener('change', e => { state.settings.notifTasks = e.target.checked; save(); });
  $('#setNotifDigest').addEventListener('change', e => {
    state.settings.notifDigest = e.target.checked; save();
    if (e.target.checked) { requestNotifPermission(); scheduleDigest(); }
  });
  $('#setAmoled').addEventListener('change', e => {
    state.settings.amoled = e.target.checked; save(); applyTheme();
  });

  $('#btnExport').addEventListener('click', exportData);
  $('#btnImport').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', e => {
    if (e.target.files[0]) importData(e.target.files[0]);
  });
  $('#btnReset').addEventListener('click', () => {
    if (confirm('Удалить все данные?')) {
      localStorage.clear();
      location.reload();
    }
  });

  // задачи
  $('#btnAddTask').addEventListener('click', () => openTaskModal());
  $('#fabAdd').addEventListener('click', () => openTaskModal());
  $('#taskClose').addEventListener('click', closeTaskModal);
  $('#taskBackdrop').addEventListener('click', closeTaskModal);
  $('#taskSave').addEventListener('click', saveTask);

  // календарь
  $('#calPrev').addEventListener('click', () => {
    state.calMonth.setMonth(state.calMonth.getMonth() - 1);
    renderCalendar();
  });
  $('#calNext').addEventListener('click', () => {
    state.calMonth.setMonth(state.calMonth.getMonth() + 1);
    renderCalendar();
  });

  // шторка
  $('#sheetClose').addEventListener('click', closeSheet);
  $('#sheetBackdrop').addEventListener('click', closeSheet);

  // кнопка уведомлений
  $('#btnNotifications').addEventListener('click', async () => {
    await requestNotifPermission();
    alert('Разрешение уведомлений: ' + Notification.permission);
  });

  // bottom nav
  setupNav();
}

function init() {
  load();
  applyTheme();
  renderGreeting();
  renderTasks();
  renderCalendar();
  renderChat();
  setupEvents();
  setupOnboarding();
  setupCalendarSwipe();

  // регистрация SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(e => console.warn('SW', e));
  }

  // напоминания для существующих задач
  state.tasks.forEach(scheduleNotification);
  scheduleDigest();

  // иконки
  if (window.lucide) lucide.createIcons();

  // обновление приветствия каждую минуту
  setInterval(renderGreeting, 60000);
}

document.addEventListener('DOMContentLoaded', init);
