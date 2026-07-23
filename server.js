import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  listTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  listTags,
  createHouseholdForUser,
  joinHouseholdAsMember,
  getMembership,
  getHouseholdById,
} from './db.js';
import { sendInviteEmail } from './email.js';

const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function requireUser(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!token) {
    return res.status(401).json({ error: '로그인이 필요합니다' });
  }
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: '세션이 만료되었습니다. 다시 로그인해주세요' });
  }
  req.user = { id: data.user.id, email: data.user.email };
  next();
}

async function requireHousehold(req, res, next) {
  const raw = req.headers['x-household-id'];
  const householdId = Number(raw);
  if (!raw || !Number.isInteger(householdId)) {
    return res.status(400).json({ error: 'X-Household-Id header가 필요합니다' });
  }
  try {
    const role = await getMembership(req.user.id, householdId);
    if (!role) {
      return res.status(403).json({ error: '이 모임의 구성원이 아닙니다' });
    }
    req.householdId = householdId;
    req.membership = { role };
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function requireAdmin(req, res, next) {
  if (req.membership?.role !== 'admin') {
    return res.status(403).json({ error: '관리자만 할 수 있는 작업입니다' });
  }
  next();
}

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const { data, error } = await supabaseAuth.auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ user: { id: data.user?.id, email: data.user?.email } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });
    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: { id: data.user.id, email: data.user.email },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const email = req.body?.email?.trim();
    if (!email) {
      return res.status(400).json({ error: 'email이 필요합니다' });
    }
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password.html`,
    });
    if (error) return res.status(400).json({ error: error.message });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { access_token, password } = req.body ?? {};
    if (!access_token || !password) {
      return res.status(400).json({ error: 'access_token과 password가 필요합니다' });
    }
    const { data, error } = await supabaseAuth.auth.getUser(access_token);
    if (error || !data?.user) {
      return res.status(401).json({ error: '유효하지 않거나 만료된 링크입니다. 다시 요청해주세요' });
    }
    const { error: updateError } = await supabaseAuth.auth.admin.updateUserById(data.user.id, { password });
    if (updateError) return res.status(400).json({ error: updateError.message });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body ?? {};
    const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token });
    if (error) return res.status(401).json({ error: error.message });
    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/households', requireUser, async (req, res) => {
  try {
    const household = await createHouseholdForUser(req.user.id, req.body?.name);
    res.status(201).json(household);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/households/join', requireUser, async (req, res) => {
  try {
    const household = await joinHouseholdAsMember(req.user.id, req.body?.invite_code);
    if (!household) {
      return res.status(404).json({ error: '해당 초대 코드를 찾을 수 없습니다' });
    }
    res.json(household);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/households/:id/invite', requireUser, requireHousehold, requireAdmin, async (req, res) => {
  try {
    const email = req.body?.email?.trim();
    if (!email) {
      return res.status(400).json({ error: 'email이 필요합니다' });
    }
    const household = await getHouseholdById(req.householdId);
    if (!household) {
      return res.status(404).json({ error: 'household not found' });
    }
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    await sendInviteEmail({
      to: email,
      inviteCode: household.invite_code,
      householdName: household.name,
      appUrl,
    });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/todos', requireUser, requireHousehold, async (req, res) => {
  try {
    const { search, tag, today, completed } = req.query;
    const todos = await listTodos({
      householdId: req.householdId,
      search,
      tag,
      today: today === 'true',
      completed,
    });
    res.json(todos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/todos', requireUser, requireHousehold, async (req, res) => {
  try {
    const todo = await createTodo({ householdId: req.householdId, ...req.body });
    res.status(201).json(todo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/todos/:id', requireUser, requireHousehold, async (req, res) => {
  try {
    const todo = await updateTodo(Number(req.params.id), req.householdId, req.body);
    if (!todo) {
      return res.status(404).json({ error: 'todo not found' });
    }
    res.json(todo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/todos/:id', requireUser, requireHousehold, async (req, res) => {
  try {
    const ok = await deleteTodo(Number(req.params.id), req.householdId);
    if (!ok) {
      return res.status(404).json({ error: 'todo not found' });
    }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tags', requireUser, requireHousehold, async (req, res) => {
  try {
    res.json(await listTags(req.householdId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Todo app running at http://localhost:${PORT}`);
});
