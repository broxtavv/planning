/* ============================================================
   AI DAY PLANNER — минимализм
   ============================================================ */

const STORAGE = {
  TASKS: 'aidp_tasks',
  CHAT: 'aidp_chat',
  SETTINGS: 'aidp_settings',
};

const DEFAULT_SETTINGS = {
  apiKey: '',
  apiUrl: 'https://api.deepseek.com/v1/chat/completions',
  apiModel: 'deepseek-chat',
};

let state = {
  tasks: [],
  chat: [],
  settings: { ...DEFAULT_SETTINGS },
  selectedDate: todayISO(),
  calMonth: new Date(),
  editingTaskId: null,
};

// ---------- УТИЛИТЫ ----------
function todayISO() { return new Date().toISOString().slice(0, 10); }
function isoDate(d) { return d.toISOString().slice(0, 10); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function $(s) { return document.querySelector(s); }
function $$(s) { return document.querySelectorAll(s); }

// ---------- ХРАНИЛИЩЕ ----------
function load() {
  try {
    state.tasks = JSON.parse(localStorage.getItem(STORAGE.TASKS) || '[]');
    state.chat = JSON.parse(localStorage.getItem(STORAGE.CHAT) || '[]');
    state.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE.SETTINGS) || '{}') };
  } catch (e) { console.warn(e); }
}
function save() {
  localStorage.setItem(STORAGE.TASKS, JSON.stringify(state.tasks));
  localStorage.setItem(STORAGE.CHAT, JSON.stringify(state.chat));
  localStorage.setItem(STORAGE.SETTINGS, JSON.stringify(state.settings));
}

// ---------- ДАТА В ХЕДЕРЕ ----------
function renderDate() {
  const d = new Date();
  const days = ['вс','пн','вт','ср','чт','пт','сб'];
  const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  $('#dateLabel').textContent = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

// ---------- ЗАДАЧИ ----------
function renderTasks() {
  const date = state.selectedDate;
  const dayTasks = state.tasks
    .filter(t => t.date === date)
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

  const done = dayTasks.filter(t => t.done).length;
  $('#progressLabel').textContent = `${done} из ${dayTasks.length}`;

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
  li.innerHTML = `
    <input type="checkbox" class="task-check" ${t.done ? 'checked' : ''} />
    <div class="task-body">
      <div class="task-title">${escapeHtml(t.title)}</div>
      <div class="task-meta">${t.time || ''}${t.duration ? ' · ' + t.duration + 'м' : ''}</div>
    </div>
    <button class="task-del">×</button>
  `;

  li.querySelector('.task-check').addEventListener('change', e => {
    t.done = e.target.checked;
    save(); renderTasks(); renderCalendar();
  });
  li.querySelector('.task-del').addEventListener('click', () => {
    state.tasks = state.tasks.filter(x => x.id !== t.id);
    save(); renderTasks(); renderCalendar();
  });
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

  const months = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
  $('#calMonthLabel').textContent = `${months[month]} ${year}`;

  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();

  for (let i = startOffset - 1; i >= 0; i--) {
    grid.appendChild(calDay(new Date(year, month - 1, prevDays - i), true));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    grid.appendChild(calDay(new Date(year, month, d), false));
  }
  const rest = (7 - (grid.children.length % 7)) % 7;
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

  if (state.tasks.some(t => t.date === iso)) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    btn.appendChild(dot);
  }

  btn.addEventListener('click', () => {
    state.selectedDate = iso;
    if (other) state.calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    renderCalendar(); renderTasks(); renderSheet();
  });

  return btn;
}

// ---------- ЧАТ ----------
function renderChat() {
  const box = $('#chatMessages');
  box.innerHTML = '';
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

// ---------- AI ----------
const SYSTEM_PROMPT = `Ты — ассистент-планировщик. Пользователь описывает свой день на русском.
Верни СТРОГО JSON-массив задач без markdown и пояснений.
Формат: {"title":"...","time":"HH:MM","duration":минуты,"category":"work|study|sport|personal|health|other"}
Никаких комментариев до или после JSON.`;

async function askAI(prompt) {
  if (!state.settings.apiKey) return demoResponse(prompt);

  try {
    const res = await fetch(state.settings.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.settings.apiKey}`,
      },
      body: JSON.stringify({
        model: state.settings.apiModel || 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    return parseAITasks(text);
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function parseAITasks(raw) {
  let clean = raw.trim();
  const m = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) clean = m[1].trim();
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start === -1 || end === -1) return { ok: false, error: 'не JSON' };
  try {
    const arr = JSON.parse(clean.slice(start, end + 1));
    return { ok: true, tasks: arr };
  } catch (e) {
    return { ok: false, error: 'парсинг' };
  }
}

function demoResponse(prompt) {
  const p = prompt.toLowerCase();
  const tasks = [];
  const add = (title, time, duration, category) => tasks.push({ title, time, duration, category });

  if (p.includes('учёб')) add('Учёба', '09:00', 300, 'study');
  if (p.includes('спорт') || p.includes('зал')) add('Спортзал', '15:00', 90, 'sport');
  if (p.includes('продукт')) add('Продукты', '18:00', 45, 'personal');
  if (p.includes('мам') || p.includes('позвон')) add('Позвонить', '19:30', 20, 'personal');
  if (p.includes('работ')) add('Работа', '10:00', 240, 'work');
  if (tasks.length === 0) add('Задача', '10:00', 60, 'other');

  return { ok: true, tasks, _demo: true };
}

// ---------- ОТПРАВКА ----------
async function sendChat(text) {
  if (!text.trim()) return;
  addMsgToDOM('user', text);
  state.chat.push({ role: 'user', text });

  const loading = addMsgToDOM('ai', '…', true);
  const res = await askAI(text);

  if (!res.ok) {
    loading.remove();
    addMsgToDOM('ai', 'ошибка');
    state.chat.push({ role: 'ai', text: 'ошибка' });
    save();
    return;
  }

  res.tasks.forEach(t => {
    state.tasks.push({
      id: uid(),
      title: t.title || 'Задача',
      date: state.selectedDate,
      time: t.time || '12:00',
      duration: t.duration || 30,
      category: t.category || 'other',
      done: false,
    });
  });

  const confirmText = `+${res.tasks.length} задач`;
  loading.remove();
  addMsgToDOM('ai', confirmText);
  state.chat.push({ role: 'ai', text: confirmText });

  save(); renderTasks(); renderCalendar();
}

// ---------- ШТОРКА ----------
function renderSheet() {
  const list = $('#sheetTaskList');
  list.innerHTML = '';
  const tasks = state.tasks
    .filter(t => t.date === state.selectedDate)
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

  const [y, m, d] = state.selectedDate.split('-');
  $('#sheetDate').textContent = `${d}.${m}.${y}`;

  if (tasks.length === 0) {
    list.innerHTML = '<li class="empty">пусто</li>';
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

// ---------- МОДАЛКА ЗАДАЧИ ----------
function openTaskModal(id = null) {
  state.editingTaskId = id;
  $('#taskModalTitle').textContent = id ? 'Изменить' : 'Новая';
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
  $('#taskModal').classList.remove('hidden');
}
function closeTaskModal() {
  $('#taskBackdrop').classList.add('hidden');
  $('#taskModal').classList.add('hidden');
}

function saveTask() {
  const title = $('#taskTitle').value.trim();
  if (!title) return;
  const data = {
    title,
    date: $('#taskDate').value || todayISO(),
    time: $('#taskTime').value || '12:00',
    duration: parseInt($('#taskDuration').value) || 30,
    category: $('#taskCategory').value,
  };
  if (state.editingTaskId) {
    Object.assign(state.tasks.find(x => x.id === state.editingTaskId), data);
  } else {
    state.tasks.push({ id: uid(), ...data, done: false });
  }
  save(); closeTaskModal(); renderTasks(); renderCalendar();
}

// ---------- МОДАЛКА API-КЛЮЧА ----------
function openKeyModal() {
  $('#keyInput').value = state.settings.apiKey || '';
  $('#keyBackdrop').classList.remove('hidden');
  $('#keyModal').classList.remove('hidden');
}
function closeKeyModal() {
  $('#keyBackdrop').classList.add('hidden');
  $('#keyModal').classList.add('hidden');
}

// ---------- СОБЫТИЯ ----------
function setupEvents() {
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

  $('#btnAddTask').addEventListener('click', () => openTaskModal());
  $('#taskClose').addEventListener('click', closeTaskModal);
  $('#taskBackdrop').addEventListener('click', closeTaskModal);
  $('#taskSave').addEventListener('click', saveTask);

  $('#calPrev').addEventListener('click', () => {
    state.calMonth.setMonth(state.calMonth.getMonth() - 1);
    renderCalendar();
  });
  $('#calNext').addEventListener('click', () => {
    state.calMonth.setMonth(state.calMonth.getMonth() + 1);
    renderCalendar();
  });

  $('#sheetClose').addEventListener('click', closeSheet);
  $('#sheetBackdrop').addEventListener('click', closeSheet);

  $('#keyClose').addEventListener('click', closeKeyModal);
  $('#keyBackdrop').addEventListener('click', closeKeyModal);
  $('#keySave').addEventListener('click', () => {
    state.settings.apiKey = $('#keyInput').value.trim();
    save(); closeKeyModal();
  });

  // двойной тап по дате сверху → модалка ключа
  let taps = 0, timer;
  $('#dateLabel').addEventListener('click', () => {
    taps++;
    clearTimeout(timer);
    timer = setTimeout(() => taps = 0, 400);
    if (taps >= 3) { openKeyModal(); taps = 0; }
  });
}

// ---------- INIT ----------
function init() {
  load();
  renderDate();
  renderTasks();
  renderCalendar();
  renderChat();
  setupEvents();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
