const gateEl = document.getElementById('gate');
const appEl = document.getElementById('app');
const gateErrorEl = document.getElementById('gate-error');
const createHouseholdBtn = document.getElementById('create-household-btn');
const joinHouseholdBtn = document.getElementById('join-household-btn');
const joinCodeInput = document.getElementById('join-code-input');
const leaveHouseholdBtn = document.getElementById('leave-household-btn');
const householdCodeEl = document.getElementById('household-code');

const form = document.getElementById('todo-form');
const titleInput = document.getElementById('title');
const descriptionInput = document.getElementById('description');
const dueDateInput = document.getElementById('due_date');
const priorityInput = document.getElementById('priority');
const tagsInput = document.getElementById('tags');

const searchInput = document.getElementById('search');
const tagFilter = document.getElementById('tag-filter');
const todayOnlyInput = document.getElementById('today-only');
const listEl = document.getElementById('todo-list');

let household = null;

function loadHousehold() {
  const raw = localStorage.getItem('household');
  return raw ? JSON.parse(raw) : null;
}

function saveHousehold(h) {
  household = h;
  localStorage.setItem('household', JSON.stringify(h));
}

function clearHousehold() {
  household = null;
  localStorage.removeItem('household');
}

function householdHeaders() {
  return { 'X-Household-Id': String(household.id) };
}

function enterApp() {
  gateEl.style.display = 'none';
  appEl.style.display = '';
  householdCodeEl.textContent = household.invite_code;
  fetchTags();
  fetchTodos();
}

function showGate(message) {
  appEl.style.display = 'none';
  gateEl.style.display = '';
  gateErrorEl.textContent = message || '';
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function fetchTodos() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
  if (tagFilter.value) params.set('tag', tagFilter.value);
  if (todayOnlyInput.checked) params.set('today', 'true');

  const res = await fetch(`/api/todos?${params.toString()}`, { headers: householdHeaders() });
  const todos = await res.json();
  renderTodos(todos);
}

async function fetchTags() {
  const res = await fetch('/api/tags', { headers: householdHeaders() });
  const tags = await res.json();
  const current = tagFilter.value;
  tagFilter.innerHTML = '<option value="">전체 태그</option>' +
    tags.map(t => `<option value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</option>`).join('');
  tagFilter.value = current;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function renderTodos(todos) {
  if (!todos.length) {
    listEl.innerHTML = '<li class="empty">할 일이 없어요.</li>';
    return;
  }

  const today = todayISO();

  listEl.innerHTML = todos.map(todo => {
    const overdue = todo.due_date && todo.due_date < today && !todo.is_completed;
    const dueLabel = todo.due_date ? `<span class="due-date ${overdue ? 'overdue' : ''}">${todo.due_date}</span>` : '';
    const tagsLabel = todo.tags.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('');

    return `
      <li class="todo-item ${todo.is_completed ? 'completed' : ''}" data-id="${todo.id}">
        <input type="checkbox" class="toggle" ${todo.is_completed ? 'checked' : ''}>
        <div class="todo-body">
          <div class="todo-title">${escapeHtml(todo.title)}</div>
          ${todo.description ? `<div class="todo-desc">${escapeHtml(todo.description)}</div>` : ''}
          <div class="todo-meta">
            <span class="badge priority-${todo.priority}">${priorityLabel(todo.priority)}</span>
            ${dueLabel}
            ${tagsLabel}
          </div>
        </div>
        <button class="delete-btn" title="삭제">&times;</button>
      </li>
    `;
  }).join('');
}

function priorityLabel(priority) {
  return { low: '낮음', medium: '보통', high: '높음' }[priority] ?? priority;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);

  const res = await fetch('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...householdHeaders() },
    body: JSON.stringify({
      title: titleInput.value,
      description: descriptionInput.value || null,
      due_date: dueDateInput.value || null,
      priority: priorityInput.value,
      tags,
    }),
  });

  if (res.ok) {
    form.reset();
    priorityInput.value = 'medium';
    await fetchTags();
    await fetchTodos();
  }
});

listEl.addEventListener('click', async (e) => {
  const li = e.target.closest('.todo-item');
  if (!li) return;
  const id = li.dataset.id;

  if (e.target.classList.contains('toggle')) {
    await fetch(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...householdHeaders() },
      body: JSON.stringify({ is_completed: e.target.checked }),
    });
    await fetchTodos();
  }

  if (e.target.classList.contains('delete-btn')) {
    await fetch(`/api/todos/${id}`, { method: 'DELETE', headers: householdHeaders() });
    await fetchTodos();
  }
});

let searchDebounce;
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(fetchTodos, 300);
});

tagFilter.addEventListener('change', fetchTodos);
todayOnlyInput.addEventListener('change', fetchTodos);

createHouseholdBtn.addEventListener('click', async () => {
  const res = await fetch('/api/households', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    gateErrorEl.textContent = '가족 생성에 실패했어요. 다시 시도해주세요.';
    return;
  }
  saveHousehold(await res.json());
  enterApp();
});

joinHouseholdBtn.addEventListener('click', async () => {
  const invite_code = joinCodeInput.value.trim();
  if (!invite_code) {
    gateErrorEl.textContent = '코드를 입력해주세요.';
    return;
  }
  const res = await fetch('/api/households/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invite_code }),
  });
  if (!res.ok) {
    gateErrorEl.textContent = '해당 코드를 찾을 수 없어요. 다시 확인해주세요.';
    return;
  }
  saveHousehold(await res.json());
  enterApp();
});

leaveHouseholdBtn.addEventListener('click', () => {
  clearHousehold();
  joinCodeInput.value = '';
  showGate();
});

household = loadHousehold();
if (household) {
  enterApp();
} else {
  showGate();
}
