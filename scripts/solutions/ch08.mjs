// lifecycle: ops
// ch08 각 스텝을 "학습자가 올바르게 해냈을 때"의 상태로 만드는 조작.
// 목록과 그것을 다루는 함수를 TaskStore 한 틀로 묶고, 안쪽을 감춘다.
import { write } from './helpers.mjs';

const STORE_S01 = `export class TaskStore {
  tasks = []

  all() {
    return this.tasks
  }
}
`;

const STORE_S02 = `export class TaskStore {
  tasks

  constructor(tasks = []) {
    this.tasks = tasks
  }

  all() {
    return this.tasks
  }
}
`;

const STORE_S03 = `import { addTask, completeTask } from './tasks.mjs'

export class TaskStore {
  tasks

  constructor(tasks = []) {
    this.tasks = tasks
  }

  all() {
    return this.tasks
  }

  add(title) {
    return addTask(this.tasks, title)
  }

  complete(title) {
    return completeTask(this.tasks, title)
  }
}
`;

const STORE_S04 = `import { addTask, completeTask } from './tasks.mjs'

export class TaskStore {
  #tasks

  constructor(tasks = []) {
    this.#tasks = tasks
  }

  all() {
    return this.#tasks.slice()
  }

  add(title) {
    return addTask(this.#tasks, title)
  }

  complete(title) {
    return completeTask(this.#tasks, title)
  }
}
`;

const STORE_S05 = `import { addTask, completeTask, countPending } from './tasks.mjs'

export class TaskStore {
  #tasks

  constructor(tasks = []) {
    this.#tasks = tasks
  }

  all() {
    return this.#tasks.slice()
  }

  add(title) {
    return addTask(this.#tasks, title)
  }

  complete(title) {
    return completeTask(this.#tasks, title)
  }

  get size() {
    return this.#tasks.length
  }

  get pending() {
    return countPending(this.#tasks)
  }
}
`;

const APP = `import { TaskStore } from './lib/task-store.mjs'
import { readTasks, saveTasks } from './lib/store.mjs'
import formatTask from './lib/format.mjs'

const USAGE = '사용법: node app.mjs <add 제목 | done 제목 | list>'

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
}

let store
try {
  store = new TaskStore(await readTasks())
} catch (error) {
  fail('목록을 읽지 못했다', error)
}

const command = process.argv[2]
const title = process.argv[3]

if (command === 'add') {
  try {
    const added = store.add(title)
    await saveTasks(store.all())
    console.log(\`추가: \${render(added)}\`)
    printAll(store.all())
  } catch (error) {
    fail('추가하지 못했다', error)
  }
} else if (command === 'done') {
  try {
    const target = store.complete(title)
    if (target) {
      await saveTasks(store.all())
      console.log(\`완료: \${render(target)}\`)
      printAll(store.all())
    } else {
      console.log(\`그런 할 일이 없다: \${title}\`)
      process.exit(1)
    }
  } catch (error) {
    fail('완료하지 못했다', error)
  }
} else if (command === 'list') {
  console.log(\`할 일 \${store.size}개 (남은 것 \${store.pending}개)\`)
  printAll(store.all())
} else {
  console.log(USAGE)
  process.exit(1)
}
`;

export default {
  'ch08-s01': (ws) => write(ws, 'lib/task-store.mjs', STORE_S01),
  'ch08-s02': (ws) => write(ws, 'lib/task-store.mjs', STORE_S02),
  'ch08-s03': (ws) => write(ws, 'lib/task-store.mjs', STORE_S03),
  'ch08-s04': (ws) => write(ws, 'lib/task-store.mjs', STORE_S04),
  'ch08-s05': (ws) => write(ws, 'lib/task-store.mjs', STORE_S05),
  'ch08-s06': (ws) => write(ws, 'app.mjs', APP),
};
