const authGateEl = document.getElementById('auth-gate');
const signupFormEl = document.getElementById('signup-form');
const loginFormEl = document.getElementById('login-form');
const signupEmailInput = document.getElementById('signup-email');
const signupPasswordInput = document.getElementById('signup-password');
const signupBtn = document.getElementById('signup-btn');
const signupMessageEl = document.getElementById('signup-message');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginBtn = document.getElementById('login-btn');
const authErrorEl = document.getElementById('auth-error');
const showLoginLink = document.getElementById('show-login-link');
const showSignupLink = document.getElementById('show-signup-link');
const logoutBtn = document.getElementById('logout-btn');

const gateEl = document.getElementById('gate');
const appEl = document.getElementById('app');
const gateErrorEl = document.getElementById('gate-error');
const createHouseholdBtn = document.getElementById('create-household-btn');
const joinHouseholdBtn = document.getElementById('join-household-btn');
const joinCodeInput = document.getElementById('join-code-input');
const leaveHouseholdBtn = document.getElementById('leave-household-btn');
const householdCodeEl = document.getElementById('household-code');

const adminPanelEl = document.getElementById('admin-panel');
const inviteEmailInput = document.getElementById('invite-email-input');
const inviteBtn = document.getElementById('invite-btn');
const inviteMessageEl = document.getElementById('invite-message');

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

let auth = null;
let household = null;

function loadAuth() {
  const raw = localStorage.getItem('auth');
  return raw ? JSON.parse(raw) : null;
}

function saveAuth(a) {
  auth = a;
  localStorage.setItem('auth', JSON.stringify(a));
}

function clearAuth() {
  auth = null;
  localStorage.removeItem('auth');
}

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

// 만료된 access_token은 refresh_token으로 한 번 갱신을 시도하고, 그래도 안 되면 로그아웃 처리한다.
async function apiFetch(url, opts = {}) {
  const headers = { ...(opts.headers || {}), Authorization: `Bearer ${auth.access_token}` };
  let res = await fetch(url, { ...opts, headers });

  if (res.status === 401) {
    const refreshed = await refreshAuth();
    if (!refreshed) {
      handleLogout();
      throw new Error('세션이 만료되었습니다. 다시 로그인해주세요.');
    }
    res = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${auth.access_token}` } });
  }
  return res;
}

async function refreshAuth() {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: auth.refresh_token }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    saveAuth({ ...auth, access_token: data.access_token, refresh_token: data.refresh_token });
    return true;
  } catch {
    return false;
  }
}

function handleLogout() {
  clearAuth();
  clearHousehold();
  showAuthGate();
}

function showAuthGate() {
  authGateEl.style.display = '';
  gateEl.style.display = 'none';
  appEl.style.display = 'none';
}

function enterApp() {
  authGateEl.style.display = 'none';
  gateEl.style.display = 'none';
  appEl.style.display = '';
  householdCodeEl.textContent = household.invite_code;
  adminPanelEl.style.display = household.role === 'admin' ? '' : 'none';
  fetchTags();
  fetchTodos();
}

function showGate(message) {
  authGateEl.style.display = 'none';
  appEl.style.display = 'none';
  gateEl.style.display = '';
  gateErrorEl.textContent = message || '';
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function handleHouseholdRejected() {
  clearHousehold();
  showGate('이 모임에 더 이상 접근할 수 없어요. 코드를 다시 확인해주세요.');
}

async function fetchTodos() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
  if (tagFilter.value) params.set('tag', tagFilter.value);
  if (todayOnlyInput.checked) params.set('today', 'true');

  const res = await apiFetch(`/api/todos?${params.toString()}`, { headers: householdHeaders() });
  if (res.status === 403) return handleHouseholdRejected();
  const todos = await res.json();
  renderTodos(todos);
}

async function fetchTags() {
  const res = await apiFetch('/api/tags', { headers: householdHeaders() });
  if (res.status === 403) return handleHouseholdRejected();
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

  const res = await apiFetch('/api/todos', {
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
    await apiFetch(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...householdHeaders() },
      body: JSON.stringify({ is_completed: e.target.checked }),
    });
    await fetchTodos();
  }

  if (e.target.classList.contains('delete-btn')) {
    await apiFetch(`/api/todos/${id}`, { method: 'DELETE', headers: householdHeaders() });
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
  const res = await apiFetch('/api/households', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    gateErrorEl.textContent = '모임 생성에 실패했어요. 다시 시도해주세요.';
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
  const res = await apiFetch('/api/households/join', {
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

logoutBtn.addEventListener('click', handleLogout);

inviteBtn.addEventListener('click', async () => {
  const email = inviteEmailInput.value.trim();
  inviteMessageEl.textContent = '';
  if (!email) {
    inviteMessageEl.textContent = '이메일을 입력해주세요.';
    return;
  }
  const res = await apiFetch(`/api/households/${household.id}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...householdHeaders() },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    inviteMessageEl.textContent = body.error || '초대 발송에 실패했어요.';
    return;
  }
  inviteMessageEl.textContent = `${email}로 초대를 보냈어요.`;
  inviteEmailInput.value = '';
});

showLoginLink.addEventListener('click', (e) => {
  e.preventDefault();
  authErrorEl.textContent = '';
  signupFormEl.style.display = 'none';
  loginFormEl.style.display = '';
});

showSignupLink.addEventListener('click', (e) => {
  e.preventDefault();
  authErrorEl.textContent = '';
  loginFormEl.style.display = 'none';
  signupFormEl.style.display = '';
});

signupBtn.addEventListener('click', async () => {
  authErrorEl.textContent = '';
  signupMessageEl.textContent = '';
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: signupEmailInput.value.trim(), password: signupPasswordInput.value }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    authErrorEl.textContent = body.error || '가입에 실패했어요.';
    return;
  }
  signupMessageEl.textContent = '가입 완료! 받은 편지함에서 인증 메일을 확인한 뒤 로그인해주세요.';
  loginEmailInput.value = signupEmailInput.value.trim();
  signupFormEl.style.display = 'none';
  loginFormEl.style.display = '';
});

loginBtn.addEventListener('click', async () => {
  authErrorEl.textContent = '';
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: loginEmailInput.value.trim(), password: loginPasswordInput.value }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    authErrorEl.textContent = body.error || '로그인에 실패했어요.';
    return;
  }
  saveAuth({ access_token: body.access_token, refresh_token: body.refresh_token, user: body.user });

  const codeFromLink = new URLSearchParams(window.location.search).get('code');
  if (codeFromLink) joinCodeInput.value = codeFromLink;

  household = loadHousehold();
  if (household) {
    enterApp();
  } else {
    showGate();
  }
});

auth = loadAuth();
household = loadHousehold();
if (auth && household) {
  enterApp();
} else if (auth) {
  showGate();
} else {
  const codeFromLink = new URLSearchParams(window.location.search).get('code');
  if (codeFromLink) joinCodeInput.value = codeFromLink;
  showAuthGate();
}
