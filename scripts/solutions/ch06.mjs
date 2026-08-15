// lifecycle: ops
// ch06 각 스텝을 "학습자가 올바르게 해냈을 때"의 상태로 만드는 조작.
// ch05가 갈라 놓은 모듈에 입력 검사와 실패 처리를 얹는다.
import { write } from './helpers.mjs';

const ERRORS_MODULE = `export function invalidInput(message) {
  const error = new Error(message)
  error.name = 'InvalidInputError'
  return error
}
`;

// s01: addTask 만 자기를 지킨다. 아직 익명 Error 다.
const TASKS_S01 = `const isPending = (task) => task.done === false

export function addTask(tasks, title) {
  if (title === undefined || title.trim() === '') {
    throw new Error('할 일 제목이 비어 있다')
  }
  tasks.push({ title: title.trim(), done: false })
  return tasks[tasks.length - 1]
}

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

// s03: 이름 붙은 실패로 바꾼다.
const TASKS_S03 = `import { invalidInput } from './errors.mjs'

const isPending = (task) => task.done === false

export function addTask(tasks, title) {
  if (title === undefined || title.trim() === '') {
    throw invalidInput('할 일 제목이 비어 있다')
  }
  tasks.push({ title: title.trim(), done: false })
  return tasks[tasks.length - 1]
}

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

// s04: 가드 절을 도우미로 뽑아 공개 함수 셋 모두의 입구에 둔다.
const TASKS_S04 = `import { invalidInput } from './errors.mjs'

const isPending = (task) => task.done === false

function requireList(tasks) {
  if (Array.isArray(tasks) === false) {
    throw invalidInput('할 일 목록이 배열이 아니다')
  }
  return tasks
}

function requireTitle(title) {
  if (typeof title !== 'string' || title.trim() === '') {
    throw invalidInput('할 일 제목이 비어 있다')
  }
  return title.trim()
}

export function addTask(tasks, title) {
  requireList(tasks)
  const clean = requireTitle(title)
  tasks.push({ title: clean, done: false })
  return tasks[tasks.length - 1]
}

export function completeTask(tasks, title) {
  requireList(tasks)
  const clean = requireTitle(title)
  const target = tasks.find((task) => task.title === clean)
  if (target) {
    target.done = true
  }
  return target
}

export function countPending(tasks) {
  requireList(tasks)
  return tasks.filter(isPending).length
}
`;

const HEAD = `import { addTask, completeTask, countPending } from './lib/tasks.mjs'
import formatTask from './lib/format.mjs'

const USAGE = '사용법: node app.mjs <add 제목 | done 제목 | list>'

const render = (task) => formatTask(task.title, task.done)

function printAll(items) {
  const lines = items.map((task, i) => \`\${i + 1}. \${render(task)}\`)
  for (const line of lines) {
    console.log(line)
  }
}`;

const DATA = `const tasks = [
  { title: '우유 사기', done: false },
  { title: '빨래 개기', done: true },
]

const command = process.argv[2]
const title = process.argv[3]`;

// ch05 가 남긴 done 가지. s05 보스에서 try 로 감싸인다.
const DONE_GUARDED = `} else if (command === 'done' && title) {
  const target = completeTask(tasks, title)
  if (target) {
    console.log(\`완료: \${render(target)}\`)
    printAll(tasks)
  } else {
    console.log(\`그런 할 일이 없다: \${title}\`)
    process.exit(1)
  }`;

const LIST_BRANCH = `} else if (command === 'list') {
  console.log(\`할 일 \${tasks.length}개 (남은 것 \${countPending(tasks)}개)\`)
  printAll(tasks)
} else {
  console.log(USAGE)
  process.exit(1)
}
`;

const app = ({ helper = '', add, done }) => `${HEAD}
${helper}
${DATA}

if (command === 'add') {
${add}
${done}
${LIST_BRANCH}`;

// s02: 모든 실패를 똑같이 다룬다.
const ADD_CATCH_ALL = `  try {
    const added = addTask(tasks, title)
    console.log(\`추가: \${render(added)}\`)
    printAll(tasks)
  } catch (error) {
    console.log(\`추가하지 못했다: \${error.message}\`)
    process.exit(1)
  }`;

// s03: 아는 실패만 옮기고 나머지는 다시 던진다.
const ADD_CATCH_NAMED = `  try {
    const added = addTask(tasks, title)
    console.log(\`추가: \${render(added)}\`)
    printAll(tasks)
  } catch (error) {
    if (error.name !== 'InvalidInputError') {
      throw error
    }
    console.log(\`추가하지 못했다: \${error.message}\`)
    process.exit(1)
  }`;

export default {
  'ch06-s01': (ws) => {
    write(ws, 'lib/tasks.mjs', TASKS_S01);
  },

  'ch06-s02': (ws) => {
    write(ws, 'app.mjs', app({ add: ADD_CATCH_ALL, done: DONE_GUARDED }));
  },

  'ch06-s03': (ws) => {
    write(ws, 'lib/errors.mjs', ERRORS_MODULE);
    write(ws, 'lib/tasks.mjs', TASKS_S03);
    write(ws, 'app.mjs', app({ add: ADD_CATCH_NAMED, done: DONE_GUARDED }));
  },

  'ch06-s04': (ws) => {
    write(ws, 'lib/tasks.mjs', TASKS_S04);
  },

  // 보스: 두 catch 가 같은 일을 하므로 도우미 하나로 묶고, done 도 try 로 감싼다.
  'ch06-s05': (ws) => {
    write(ws, 'app.mjs', app({
      helper: `
function fail(prefix, error) {
  if (error.name !== 'InvalidInputError') {
    throw error
  }
  console.log(\`\${prefix}: \${error.message}\`)
  process.exit(1)
}
`,
      add: `  try {
    const added = addTask(tasks, title)
    console.log(\`추가: \${render(added)}\`)
    printAll(tasks)
  } catch (error) {
    fail('추가하지 못했다', error)
  }`,
      done: `} else if (command === 'done') {
  try {
    const target = completeTask(tasks, title)
    if (target) {
      console.log(\`완료: \${render(target)}\`)
      printAll(tasks)
    } else {
      console.log(\`그런 할 일이 없다: \${title}\`)
      process.exit(1)
    }
  } catch (error) {
    fail('완료하지 못했다', error)
  }`,
    }));
  },
};
