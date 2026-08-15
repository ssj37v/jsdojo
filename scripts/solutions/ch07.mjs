// lifecycle: ops
// ch07 각 스텝을 "학습자가 올바르게 해냈을 때"의 상태로 만드는 조작.
// 목록이 프로그램과 함께 사라지던 것을 tasks.json 으로 이어지게 만든다.
import { write } from './helpers.mjs';

// s01: writeFile 이 돌려주는 Promise 를 그대로 돌려준다.
const STORE_S01 = `import { writeFile } from 'node:fs/promises'

const FILE = 'tasks.json'

export function saveTasks(tasks, file = FILE) {
  return writeFile(file, JSON.stringify(tasks, null, 2))
}
`;

// s02: async 로 바꾼다. 돌려주는 것은 여전히 Promise 다.
const STORE_S02 = `import { writeFile } from 'node:fs/promises'

const FILE = 'tasks.json'

export async function saveTasks(tasks, file = FILE) {
  await writeFile(file, JSON.stringify(tasks, null, 2))
}
`;

// s03: 읽기가 붙는다. 파일이 없는 것은 실패가 아니다.
const STORE_S03 = `import { readFile, writeFile } from 'node:fs/promises'

const FILE = 'tasks.json'

export async function saveTasks(tasks, file = FILE) {
  await writeFile(file, JSON.stringify(tasks, null, 2))
}

export async function readTasks(file = FILE) {
  try {
    const raw = await readFile(file, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  }
}
`;

// s04: 읽기와 해석을 각각 감싸, 망가진 파일만 이름 붙은 실패로 바꾼다.
const STORE_S04 = `import { readFile, writeFile } from 'node:fs/promises'
import { invalidInput } from './errors.mjs'

const FILE = 'tasks.json'

export async function saveTasks(tasks, file = FILE) {
  await writeFile(file, JSON.stringify(tasks, null, 2))
}

export async function readTasks(file = FILE) {
  let raw
  try {
    raw = await readFile(file, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  }

  try {
    return JSON.parse(raw)
  } catch {
    throw invalidInput(\`할 일 파일이 망가져 읽을 수 없다: \${file}\`)
  }
}
`;

const HELPERS = `const USAGE = '사용법: node app.mjs <add 제목 | done 제목 | list>'

const render = (task) => formatTask(task.title, task.done)

function printAll(items) {
  const lines = items.map((task, i) => \`\${i + 1}. \${render(task)}\`)
  for (const line of lines) {
    console.log(line)
  }
}

function fail(prefix, error) {
  if (error.name !== 'InvalidInputError') {
    throw error
  }
  console.log(\`\${prefix}: \${error.message}\`)
  process.exit(1)
}`;

// s01~s04 의 app.mjs 는 아직 시작 목록을 코드에 박아 둔다.
const HARDCODED = `const tasks = [
  { title: '우유 사기', done: false },
  { title: '빨래 개기', done: true },
]`;

const DONE_NO_SAVE = `  try {
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
  }`;

const DONE_SAVING = `  try {
    const target = completeTask(tasks, title)
    if (target) {
      await saveTasks(tasks)
      console.log(\`완료: \${render(target)}\`)
      printAll(tasks)
    } else {
      console.log(\`그런 할 일이 없다: \${title}\`)
      process.exit(1)
    }
  } catch (error) {
    fail('완료하지 못했다', error)
  }`;

const LIST_AND_TAIL = `} else if (command === 'list') {
  console.log(\`할 일 \${tasks.length}개 (남은 것 \${countPending(tasks)}개)\`)
  printAll(tasks)
} else {
  console.log(USAGE)
  process.exit(1)
}
`;

const app = ({ storeImport, load, add, done }) => `import { addTask, completeTask, countPending } from './lib/tasks.mjs'
import ${storeImport} from './lib/store.mjs'
import formatTask from './lib/format.mjs'

${HELPERS}

${load}

const command = process.argv[2]
const title = process.argv[3]

if (command === 'add') {
${add}
} else if (command === 'done') {
${done}
${LIST_AND_TAIL}`;

export default {
  'ch07-s01': (ws) => {
    write(ws, 'lib/store.mjs', STORE_S01);
    write(ws, 'app.mjs', app({
      storeImport: '{ saveTasks }',
      load: HARDCODED,
      add: `  try {
    const added = addTask(tasks, title)
    saveTasks(tasks).then(() => {
      console.log(\`추가: \${render(added)}\`)
      printAll(tasks)
    })
  } catch (error) {
    fail('추가하지 못했다', error)
  }`,
      done: DONE_NO_SAVE,
    }));
  },

  'ch07-s02': (ws) => {
    write(ws, 'lib/store.mjs', STORE_S02);
    write(ws, 'app.mjs', app({
      storeImport: '{ saveTasks }',
      load: HARDCODED,
      add: `  try {
    const added = addTask(tasks, title)
    await saveTasks(tasks)
    console.log(\`추가: \${render(added)}\`)
    printAll(tasks)
  } catch (error) {
    fail('추가하지 못했다', error)
  }`,
      done: DONE_SAVING,
    }));
  },

  // 모듈만 넓힌다. app 은 보스에서 한 번에 정리한다.
  'ch07-s03': (ws) => {
    write(ws, 'lib/store.mjs', STORE_S03);
  },

  'ch07-s04': (ws) => {
    write(ws, 'lib/store.mjs', STORE_S04);
  },

  // 보스: 시작 목록이 코드에서 사라지고 파일에서 온다.
  'ch07-s05': (ws) => {
    write(ws, 'app.mjs', app({
      storeImport: '{ readTasks, saveTasks }',
      load: `let tasks
try {
  tasks = await readTasks()
} catch (error) {
  fail('목록을 읽지 못했다', error)
}`,
      add: `  try {
    const added = addTask(tasks, title)
    await saveTasks(tasks)
    console.log(\`추가: \${render(added)}\`)
    printAll(tasks)
  } catch (error) {
    fail('추가하지 못했다', error)
  }`,
      done: DONE_SAVING,
    }));
  },
};
