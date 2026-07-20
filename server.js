import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { listTodos, createTodo, updateTodo, deleteTodo, listTags } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/todos', async (req, res) => {
  try {
    const { search, tag, today, completed } = req.query;
    const todos = await listTodos({
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

app.post('/api/todos', async (req, res) => {
  try {
    const todo = await createTodo(req.body);
    res.status(201).json(todo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/todos/:id', async (req, res) => {
  try {
    const todo = await updateTodo(Number(req.params.id), req.body);
    if (!todo) {
      return res.status(404).json({ error: 'todo not found' });
    }
    res.json(todo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/todos/:id', async (req, res) => {
  try {
    const ok = await deleteTodo(Number(req.params.id));
    if (!ok) {
      return res.status(404).json({ error: 'todo not found' });
    }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tags', async (req, res) => {
  try {
    res.json(await listTags());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Todo app running at http://localhost:${PORT}`);
});
