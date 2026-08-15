// lifecycle: ops
// ch05 각 스텝을 "학습자가 올바르게 해냈을 때"의 상태로 만드는 조작.
// ch04까지 한 파일에 뒤엉켜 있던 app.mjs 를 lib/tasks.mjs · lib/format.mjs 로 갈라낸다.
import { write } from './helpers.mjs';

const ADD_TASK = `export function addTask(tasks, title) {
  tasks.push({ title: title, done: false })
  return tasks[tasks.length - 1]
}`;

// s04: 내보내지 않는 도우미와 완료·집계 기능이 더해진다.
const TASKS_FULL = `const isPending = (task) => task.done === false

${ADD_TASK}

export function completeTask(tasks, title) {
  const target = tasks.find((task) => task.title === title)
  if (target) {
    target.done = true
  }
  return target
}

export function countPending(tasks) {
  return tasks.filter(isPending).length
}
`;

const FORMAT_MODULE = `export default function formatTask(title, done = false) {
  if (done) {
    return \`[x] \${title}\`
  } else {
    return \`[ ] \${title}\`
  }
}
`;

// app.mjs 안에 남아 있는 formatTask 선언 (s03 에서 lib/format.mjs 로 옮겨 간다).
const LOCAL_FORMAT = `function formatTask(title, done = false) {
  if (done) {
    return \`[x] \${title}\`
  } else {
    return \`[ ] \${title}\`
  }
}`;

const RENDER_AND_PRINT = `const render = (task) => formatTask(task.title, task.done)

function printAll(items) {
  const lines = items.map((task, i) => \`\${i + 1}. \${render(task)}\`)
  for (const line of lines) {
    console.log(line)
  }
}`;

const TASKS_DATA = `const tasks = [
  { title: '우유 사기', done: false },
  { title: '빨래 개기', done: true },
]`;

const app = ({ imports = '', format, add, done, list }) => `${imports}const USAGE = '사용법: node app.mjs <add 제목 | done 제목 | list>'

${format ? `${format}\n\n` : ''}${RENDER_AND_PRINT}

${TASKS_DATA}

const command = process.argv[2]
const title = process.argv[3]

if (command === 'add' && title) {
${add}
} else if (command === 'done' && title) {
${done}
} else if (command === 'list') {
${list}
} else {
  console.log(USAGE)
  process.exit(1)
}
`;

// ch04 가 남긴 인라인 구현들.
const ADD_INLINE = `  tasks.push({ title: title, done: false })
  console.log(\`추가: \${render(tasks[tasks.length - 1])}\`)
  printAll(tasks)`;

const ADD_VIA_MODULE = `  const added = addTask(tasks, title)
  console.log(\`추가: \${render(added)}\`)
  printAll(tasks)`;

const DONE_INLINE = `  const target = tasks.find((task) => task.title === title)
  if (target) {
    target.done = true
    console.log(\`완료: \${render(target)}\`)
    printAll(tasks)
  } else {
    console.log(\`그런 할 일이 없다: \${title}\`)
    process.exit(1)
  }`;

const LIST_INLINE = `  const remaining = tasks.filter((task) => task.done === false)
  console.log(\`할 일 \${tasks.length}개 (남은 것 \${remaining.length}개)\`)
  printAll(tasks)`;

export default {
  // 모듈 파일만 만든다. app.mjs 는 아직 그대로다.
  'ch05-s01': (ws) => {
    write(ws, 'lib/tasks.mjs', `${ADD_TASK}\n`);
  },

  'ch05-s02': (ws) => {
    write(ws, 'app.mjs', app({
      imports: "import { addTask } from './lib/tasks.mjs'\n\n",
      format: LOCAL_FORMAT,
      add: ADD_VIA_MODULE,
      done: DONE_INLINE,
      list: LIST_INLINE,
    }));
  },

  'ch05-s03': (ws) => {
    write(ws, 'lib/format.mjs', FORMAT_MODULE);
    write(ws, 'app.mjs', app({
      imports: "import { addTask } from './lib/tasks.mjs'\nimport formatTask from './lib/format.mjs'\n\n",
      format: null,
      add: ADD_VIA_MODULE,
      done: DONE_INLINE,
      list: LIST_INLINE,
    }));
  },

  // 모듈만 넓힌다. app.mjs 는 다음 스텝에서 한 번에 정리한다.
  'ch05-s04': (ws) => {
    write(ws, 'lib/tasks.mjs', TASKS_FULL);
  },

  'ch05-s05': (ws) => {
    write(ws, 'app.mjs', app({
      imports: "import { addTask, completeTask, countPending } from './lib/tasks.mjs'\nimport formatTask from './lib/format.mjs'\n\n",
      format: null,
      add: ADD_VIA_MODULE,
      done: `  const target = completeTask(tasks, title)
  if (target) {
    console.log(\`완료: \${render(target)}\`)
    printAll(tasks)
  } else {
    console.log(\`그런 할 일이 없다: \${title}\`)
    process.exit(1)
  }`,
      list: `  console.log(\`할 일 \${tasks.length}개 (남은 것 \${countPending(tasks)}개)\`)
  printAll(tasks)`,
    }));
  },
};
