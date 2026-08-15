// lifecycle: ops
// ch11 각 스텝을 "학습자가 올바르게 해냈을 때"의 상태로 만드는 조작.
// 전략·옵저버·커맨드·팩토리·모듈 싱글턴으로 app.mjs 를 갈아 끼운다.
import fs from 'node:fs';
import path from 'node:path';
import { read, write } from './helpers.mjs';

const SORT_MODULE = `import { invalidInput } from './errors.mjs'

export const SORTS = {
  none: (tasks) => tasks.slice(),
  title: (tasks) => tasks.slice().sort((a, b) => a.title.localeCompare(b.title)),
  pending: (tasks) => tasks.slice().sort((a, b) => Number(a.done) - Number(b.done)),
}

export function sortTasks(tasks, how = 'none') {
  const strategy = SORTS[how]
  if (!strategy) {
    throw invalidInput(\`그런 정렬 방식이 없다: \${how}\`)
  }
  return strategy(tasks)
}
`;

const COMMAND_MODULE = `import { invalidInput } from './errors.mjs'

export function command(store, label, action) {
  let snapshot = null

  return {
    label,
    run() {
      // all() 은 배열만 복사한다. 안의 객체까지 새로 만들어야 complete 도 되돌려진다.
      snapshot = store.all().map((task) => ({ title: task.title, done: task.done }))
      return action()
    },
    undo() {
      if (snapshot === null) {
        throw invalidInput(\`아직 실행하지 않았거나 이미 되돌린 명령이다: \${label}\`)
      }
      store.restore(snapshot)
      snapshot = null
    },
  }
}
`;

const FACTORY_MODULE = `import { invalidInput } from './errors.mjs'
import { command } from './command.mjs'

const MAKERS = {
  add: (store, title) => command(store, \`추가: \${title}\`, () => store.add(title)),
  done: (store, title) => command(store, \`완료: \${title}\`, () => store.complete(title)),
}

export function createCommand(store, name, title) {
  const make = MAKERS[name]
  if (!make) {
    throw invalidInput(\`그런 명령이 없다: \${name}\`)
  }
  return make(store, title)
}
`;

const LOGGER_MODULE = `const entries = []

export function log(message) {
  entries.push(\`\${entries.length + 1}. \${message}\`)
}

export function history() {
  return entries.slice()
}

export function clear() {
  entries.length = 0
}
`;

/** s02: 구독·통지가 더해진 TaskStore. */
const STORE_WITH_EVENTS = `import { addTask, completeTask, countPending } from './tasks.mjs'

export class TaskStore {
  #tasks
  #listeners = []

  constructor(tasks = []) {
    this.#tasks = tasks
  }

  on(event, handler) {
    const entry = { event, handler }
    this.#listeners.push(entry)
    return () => {
      this.#listeners = this.#listeners.filter((it) => it !== entry)
    }
  }

  #emit(event, payload) {
    for (const entry of this.#listeners) {
      if (entry.event === event) entry.handler(payload)
    }
  }

  all() {
    return this.#tasks.slice()
  }

  add(title) {
    const added = addTask(this.#tasks, title)
    this.#emit('added', added)
    return added
  }

  complete(title) {
    const target = completeTask(this.#tasks, title)
    if (target) this.#emit('completed', target)
    return target
  }

  get size() {
    return this.#tasks.length
  }

  get pending() {
    return countPending(this.#tasks)
  }
}
`;

/** s03: 되돌릴 자리(restore)가 더해진다. */
const STORE_WITH_RESTORE = STORE_WITH_EVENTS.replace(
  `  all() {
    return this.#tasks.slice()
  }`,
  `  all() {
    return this.#tasks.slice()
  }

  restore(tasks) {
    this.#tasks = tasks.slice()
  }`,
);

const APP = `import { TaskStore } from './lib/task-store.mjs'
import { readTasks, saveTasks } from './lib/store.mjs'
import { sortTasks } from './lib/sort.mjs'
import { createCommand } from './lib/command-factory.mjs'
import { history, log } from './lib/logger.mjs'
import formatTask from './lib/format.mjs'

const USAGE = '사용법: node app.mjs <add 제목 | done 제목 | list [--sort=title|pending]>   (예: node app.mjs add "우유 사기")'

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

function printLog() {
  for (const entry of history()) {
    console.log(\`기록: \${entry}\`)
  }
}

let store
try {
  store = new TaskStore(await readTasks())
} catch (error) {
  fail('목록을 읽지 못했다', error)
}

// 바뀌었다는 사실만 듣고 기록한다. 틀은 기록이 있는지조차 모른다.
store.on('added', (task) => log(\`추가: \${task.title}\`))
store.on('completed', (task) => log(\`완료: \${task.title}\`))

const command = process.argv[2]
const title = process.argv[3]

if (command === 'list') {
  const option = process.argv[3] ?? ''
  const how = option.startsWith('--sort=') ? option.slice('--sort='.length) : 'none'
  try {
    const shown = sortTasks(store.all(), how)
    console.log(\`할 일 \${store.size}개 (남은 것 \${store.pending}개)\`)
    printAll(shown)
  } catch (error) {
    fail('목록을 보여 주지 못했다', error)
  }
} else if (command === 'add' || command === 'done') {
  try {
    const made = createCommand(store, command, title)
    const target = made.run()
    if (command === 'done' && !target) {
      console.log(\`그런 할 일이 없다: \${title}\`)
      process.exit(1)
    }
    await saveTasks(store.all())
    console.log(\`\${made.label}\`)
    printAll(store.all())
    printLog()
  } catch (error) {
    fail(command === 'add' ? '추가하지 못했다' : '완료하지 못했다', error)
  }
} else {
  console.log(USAGE)
  process.exit(1)
}
`;

export default {
  // 심어 둔 레거시를 갈아 끼우고 옛 파일을 치운다.
  'ch11-s01': (ws) => {
    write(ws, 'lib/sort.mjs', SORT_MODULE);
    const legacy = path.join(ws, 'lib', 'legacy-sort.mjs');
    if (fs.existsSync(legacy)) fs.rmSync(legacy);
  },

  'ch11-s02': (ws) => write(ws, 'lib/task-store.mjs', STORE_WITH_EVENTS),

  'ch11-s03': (ws) => {
    write(ws, 'lib/task-store.mjs', STORE_WITH_RESTORE);
    write(ws, 'lib/command.mjs', COMMAND_MODULE);
  },

  'ch11-s04': (ws) => write(ws, 'lib/command-factory.mjs', FACTORY_MODULE),

  'ch11-s05': (ws) => write(ws, 'lib/logger.mjs', LOGGER_MODULE),

  'ch11-s06': (ws) => {
    // 앞 장에서 확인해 둔 것이 그대로 있는지 짚고 넘어간다.
    if (!read(ws, 'lib/task-store.mjs').includes('restore(')) {
      throw new Error('lib/task-store.mjs 에 restore 가 없다 — s03 이 적용되지 않았다');
    }
    write(ws, 'app.mjs', APP);
  },
};
