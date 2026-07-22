import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const TODO_SELECT = '*, todo_tags(tags(name))';
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 0/O, 1/I 제외

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

export async function listTodos({ householdId, search, tag, today, completed } = {}) {
  if (!householdId) throw new Error('householdId is required');

  let query = supabase.from('todos').select(TODO_SELECT).eq('household_id', householdId);

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

export async function getTodo(id, householdId) {
  const { data, error } = await supabase
    .from('todos')
    .select(TODO_SELECT)
    .eq('id', id)
    .eq('household_id', householdId)
    .maybeSingle();
  if (error) throw error;
  return data ? formatTodo(data) : null;
}

async function setTagsForTodo(todoId, householdId, tagNames) {
  const { error: deleteError } = await supabase.from('todo_tags').delete().eq('todo_id', todoId);
  if (deleteError) throw deleteError;

  for (const rawName of tagNames) {
    const name = rawName.trim();
    if (!name) continue;

    const { error: upsertError } = await supabase
      .from('tags')
      .upsert({ name, household_id: householdId }, { onConflict: 'household_id,name', ignoreDuplicates: true });
    if (upsertError) throw upsertError;

    const { data: tagRow, error: tagError } = await supabase
      .from('tags')
      .select('id')
      .eq('name', name)
      .eq('household_id', householdId)
      .single();
    if (tagError) throw tagError;

    const { error: linkError } = await supabase
      .from('todo_tags')
      .upsert({ todo_id: todoId, tag_id: tagRow.id }, { onConflict: 'todo_id,tag_id' });
    if (linkError) throw linkError;
  }
}

export async function createTodo({ householdId, title, description, due_date, priority, tags }) {
  if (!householdId) throw new Error('householdId is required');
  if (!title || !title.trim()) {
    throw new Error('title is required');
  }

  const { data: todo, error } = await supabase
    .from('todos')
    .insert({
      household_id: householdId,
      title: title.trim(),
      description: description ?? null,
      due_date: due_date ?? null,
      priority: priority ?? 'medium',
    })
    .select()
    .single();
  if (error) throw error;

  await setTagsForTodo(todo.id, householdId, tags ?? []);
  return getTodo(todo.id, householdId);
}

export async function updateTodo(id, householdId, fields) {
  const existing = await getTodo(id, householdId);
  if (!existing) return null;

  const patch = {};
  for (const key of ['title', 'description', 'due_date', 'priority']) {
    if (key in fields) patch[key] = fields[key];
  }
  if ('is_completed' in fields) patch.is_completed = !!fields.is_completed;

  if (Object.keys(patch).length) {
    const { error } = await supabase
      .from('todos')
      .update(patch)
      .eq('id', id)
      .eq('household_id', householdId);
    if (error) throw error;
  }
  if ('tags' in fields) {
    await setTagsForTodo(id, householdId, fields.tags ?? []);
  }
  return getTodo(id, householdId);
}

export async function deleteTodo(id, householdId) {
  const { error, count } = await supabase
    .from('todos')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function listTags(householdId) {
  if (!householdId) throw new Error('householdId is required');
  const { data, error } = await supabase
    .from('tags')
    .select('id, name')
    .eq('household_id', householdId)
    .order('name');
  if (error) throw error;
  return data;
}

function generateInviteCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}

export async function createHousehold(name) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const invite_code = generateInviteCode();
    const { data, error } = await supabase
      .from('households')
      .insert({ invite_code, name: name?.trim() || null })
      .select()
      .single();
    if (!error) return data;
    if (error.code !== '23505') throw error; // 23505 = unique_violation, retry on code clash
  }
  throw new Error('초대 코드 생성에 반복 실패했습니다. 다시 시도해주세요.');
}

export async function getHouseholdById(id) {
  const { data, error } = await supabase
    .from('households')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findHouseholdByCode(inviteCode) {
  if (!inviteCode || !inviteCode.trim()) {
    throw new Error('invite_code is required');
  }
  const { data, error } = await supabase
    .from('households')
    .select('*')
    .eq('invite_code', inviteCode.trim().toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createHouseholdForUser(userId, name) {
  const household = await createHousehold(name);
  const { error } = await supabase
    .from('household_members')
    .insert({ household_id: household.id, user_id: userId, role: 'admin' });
  if (error) throw error;
  return { ...household, role: 'admin' };
}

export async function joinHouseholdAsMember(userId, inviteCode) {
  const household = await findHouseholdByCode(inviteCode);
  if (!household) return null;

  const { error } = await supabase
    .from('household_members')
    .upsert(
      { household_id: household.id, user_id: userId, role: 'member' },
      { onConflict: 'household_id,user_id', ignoreDuplicates: true },
    );
  if (error) throw error;

  const role = await getMembership(userId, household.id);
  return { ...household, role };
}

export async function getMembership(userId, householdId) {
  const { data, error } = await supabase
    .from('household_members')
    .select('role')
    .eq('user_id', userId)
    .eq('household_id', householdId)
    .maybeSingle();
  if (error) throw error;
  return data ? data.role : null;
}
