import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  listTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  listTags,
  createHousehold,
  findHouseholdByCode,
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function requireHousehold(req, res, next) {
  const raw = req.headers['x-household-id'];
  const householdId = Number(raw);
  if (!raw || !Number.isInteger(householdId)) {
    return res.status(400).json({ error: 'X-Household-Id header가 필요합니다' });
  }
  req.householdId = householdId;
  next();
}

app.post('/api/households', async (req, res) => {
  try {
    const household = await createHousehold(req.body?.name);
    res.status(201).json(household);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/households/join', async (req, res) => {
  try {
    const household = await findHouseholdByCode(req.body?.invite_code);
    if (!household) {
      return res.status(404).json({ error: '해당 초대 코드를 찾을 수 없습니다' });
    }
    res.json(household);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/todos', requireHousehold, async (req, res) => {
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

app.post('/api/todos', requireHousehold, async (req, res) => {
  try {
    const todo = await createTodo({ householdId: req.householdId, ...req.body });
    res.status(201).json(todo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/todos/:id', requireHousehold, async (req, res) => {
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

app.delete('/api/todos/:id', requireHousehold, async (req, res) => {
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

app.get('/api/tags', requireHousehold, async (req, res) => {
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
