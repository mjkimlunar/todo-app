import { listTodos } from './db.js';

const [, , command] = process.argv;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function priorityLabel(priority) {
  return { high: '높음', medium: '보통', low: '낮음' }[priority] ?? priority;
}

function formatLine(todo) {
  const check = todo.is_completed ? '[x]' : '[ ]';
  const due = todo.due_date ? ` (마감 ${todo.due_date})` : '';
  const tags = todo.tags.length ? ` #${todo.tags.join(' #')}` : '';
  return `${check} #${todo.id} [${priorityLabel(todo.priority)}] ${todo.title}${due}${tags}`;
}

async function runList() {
  const todos = await listTodos({});
  if (!todos.length) {
    console.log('할 일이 없습니다.');
    return;
  }
  todos.forEach((todo) => console.log(formatLine(todo)));
}

async function runSummary() {
  const todos = await listTodos({});
  const today = todayISO();

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

  console.log(`전체 ${total}개 / 완료 ${completed}개 / 미완료 ${total - completed}개`);
  console.log(`마감 지남 ${overdue}개, 오늘 마감 ${dueToday}개`);
  console.log(`우선순위(미완료 기준) — 높음 ${byPriority.high}, 보통 ${byPriority.medium}, 낮음 ${byPriority.low}`);

  const tagEntries = Object.entries(byTag).sort((a, b) => b[1] - a[1]);
  if (tagEntries.length) {
    console.log('태그별: ' + tagEntries.map(([name, count]) => `#${name}(${count})`).join(', '));
  }
}

async function main() {
  if (command === 'list') {
    await runList();
  } else if (command === 'summary') {
    await runSummary();
  } else {
    console.log('사용법: node --env-file=.env cli.js <list|summary>');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('오류:', err.message);
  process.exitCode = 1;
});
