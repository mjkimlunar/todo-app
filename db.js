import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const TODO_SELECT = '*, todo_tags(tags(name))';

function formatTodo(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    is_completed: row.is_completed,
    priority: row.priority,
    due_date: row.due_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    tags: (row.todo_tags ?? []).map((tt) => tt.tags.name),
  };
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function compareTodos(a, b) {
  if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
  const aNull = a.due_date === null;
  const bNull = b.due_date === null;
  if (aNull !== bNull) return aNull ? 1 : -1;
  if (!aNull && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
  const aPriority = PRIORITY_ORDER[a.priority] ?? 1;
  const bPriority = PRIORITY_ORDER[b.priority] ?? 1;
  if (aPriority !== bPriority) return aPriority - bPriority;
  return b.id - a.id;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function listTodos({ search, tag, today, completed } = {}) {
  let query = supabase.from('todos').select(TODO_SELECT);

  if (search) query = query.ilike('title', `%${search}%`);
  if (today) query = query.eq('due_date', todayISO());
  if (completed === true || completed === 'true') query = query.eq('is_completed', true);
  else if (completed === false || completed === 'false') query = query.eq('is_completed', false);

  const { data, error } = await query;
  if (error) throw error;

  let todos = data.map(formatTodo);
  if (tag) {
    todos = todos.filter((t) => t.tags.includes(tag));
  }
  return todos.sort(compareTodos);
}

export async function getTodo(id) {
  const { data, error } = await supabase
    .from('todos')
    .select(TODO_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? formatTodo(data) : null;
}

async function setTagsForTodo(todoId, tagNames) {
  const { error: deleteError } = await supabase.from('todo_tags').delete().eq('todo_id', todoId);
  if (deleteError) throw deleteError;

  for (const rawName of tagNames) {
    const name = rawName.trim();
    if (!name) continue;

    const { error: upsertError } = await supabase
      .from('tags')
      .upsert({ name }, { onConflict: 'name', ignoreDuplicates: true });
    if (upsertError) throw upsertError;

    const { data: tagRow, error: tagError } = await supabase
      .from('tags')
      .select('id')
      .eq('name', name)
      .single();
    if (tagError) throw tagError;

    const { error: linkError } = await supabase
      .from('todo_tags')
      .upsert({ todo_id: todoId, tag_id: tagRow.id }, { onConflict: 'todo_id,tag_id' });
    if (linkError) throw linkError;
  }
}

export async function createTodo({ title, description, due_date, priority, tags }) {
  if (!title || !title.trim()) {
    throw new Error('title is required');
  }

  const { data: todo, error } = await supabase
    .from('todos')
    .insert({
      title: title.trim(),
      description: description ?? null,
      due_date: due_date ?? null,
      priority: priority ?? 'medium',
    })
    .select()
    .single();
  if (error) throw error;

  await setTagsForTodo(todo.id, tags ?? []);
  return getTodo(todo.id);
}

export async function updateTodo(id, fields) {
  const existing = await getTodo(id);
  if (!existing) return null;

  const patch = {};
  for (const key of ['title', 'description', 'due_date', 'priority']) {
    if (key in fields) patch[key] = fields[key];
  }
  if ('is_completed' in fields) patch.is_completed = !!fields.is_completed;

  if (Object.keys(patch).length) {
    const { error } = await supabase.from('todos').update(patch).eq('id', id);
    if (error) throw error;
  }
  if ('tags' in fields) {
    await setTagsForTodo(id, fields.tags ?? []);
  }
  return getTodo(id);
}

export async function deleteTodo(id) {
  const { error, count } = await supabase
    .from('todos')
    .delete({ count: 'exact' })
    .eq('id', id);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function listTags() {
  const { data, error } = await supabase.from('tags').select('id, name').order('name');
  if (error) throw error;
  return data;
}
