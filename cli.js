import { listTodos } from './db.js';
import { computeSummary } from './stats.js';

const [, , command, ...flags] = process.argv;
const hasFlag = (name) => flags.includes(name);

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
  let todos = await listTodos({});

  if (hasFlag('--overdue-completed')) {
    const today = todayISO();
    todos = todos.filter((t) => t.is_completed && t.due_date && t.due_date < today);
  }

  if (hasFlag('--json')) {
    console.log(JSON.stringify(todos, null, 2));
    return;
  }

  if (!todos.length) {
    console.log('할 일이 없습니다.');
    return;
  }
  todos.forEach((todo) => console.log(formatLine(todo)));
}

async function runSummary() {
  const todos = await listTodos({});
  const { total, completed, overdue, dueToday, byPriority, byTag } = computeSummary(todos, todayISO());

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
    console.log('사용법: node --env-file=.env cli.js <list|summary> [--overdue-completed] [--json]');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('오류:', err.message);
  process.exitCode = 1;
});
