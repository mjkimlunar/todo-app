export function computeSummary(todos, today = new Date().toISOString().slice(0, 10)) {
  const total = todos.length;
  const completed = todos.filter((t) => t.is_completed).length;
  const overdue = todos.filter((t) => !t.is_completed && t.due_date && t.due_date < today).length;
  const dueToday = todos.filter((t) => !t.is_completed && t.due_date === today).length;

  const byPriority = { high: 0, medium: 0, low: 0 };
  const byTag = {};
  for (const todo of todos) {
    if (!todo.is_completed) byPriority[todo.priority] = (byPriority[todo.priority] ?? 0) + 1;
    for (const tag of todo.tags) byTag[tag] = (byTag[tag] ?? 0) + 1;
  }

  return { total, completed, incomplete: total - completed, overdue, dueToday, byPriority, byTag };
}
