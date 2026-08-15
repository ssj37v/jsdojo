// lifecycle: ops
// ch09 각 스텝을 "학습자가 올바르게 해냈을 때"의 상태로 만드는 조작.
// 손으로 확인하던 일을 test/*.test.mjs 로 옮긴다.
//
// 이 챕터의 판정은 뮤테이션 검사다 — 구현을 망가뜨려 보고 테스트가 잡는지 본다.
// 그래서 여기 적는 테스트는 "정말 무언가를 지키는" 것이어야 한다.
import { write } from './helpers.mjs';

const FORMAT_TEST = `import test from 'node:test'
import assert from 'node:assert/strict'
import formatTask from '../lib/format.mjs'

test('아직 안 끝난 할 일은 [ ] 로 쓴다', () => {
  assert.equal(formatTask('우유 사기'), '[ ] 우유 사기')
})

test('끝낸 할 일은 [x] 로 쓴다', () => {
  assert.equal(formatTask('빨래 개기', true), '[x] 빨래 개기')
})

test('완료 여부를 생략하면 아직 안 끝난 것으로 본다', () => {
  assert.equal(formatTask('장보기'), '[ ] 장보기')
})
`;

const TASKS_TEST_BASE = `import test from 'node:test'
import assert from 'node:assert/strict'
import { addTask, completeTask, countPending } from '../lib/tasks.mjs'

test('addTask 는 목록 끝에 새 할 일을 넣고 그것을 돌려준다', () => {
  const tasks = []
  const added = addTask(tasks, '우유 사기')

  assert.deepEqual(tasks, [{ title: '우유 사기', done: false }])
  assert.equal(added, tasks[0])
})

test('addTask 는 앞뒤 공백을 떼고 담는다', () => {
  const tasks = []
  addTask(tasks, '  장보기  ')

  assert.equal(tasks[0].title, '장보기')
})

test('빈 제목은 거부하고 목록에 남기지 않는다', () => {
  const tasks = []

  assert.throws(() => addTask(tasks, ''), { name: 'InvalidInputError' })
  assert.throws(() => addTask(tasks, '   '), { name: 'InvalidInputError' })
  assert.equal(tasks.length, 0)
})

test('목록 자리에 배열이 아닌 것을 주면 거부한다', () => {
  assert.throws(() => addTask(null, '우유 사기'), { name: 'InvalidInputError' })
})

test('completeTask 는 지목한 것만 완료한다', () => {
  const tasks = [
    { title: '우유 사기', done: false },
    { title: '빨래 개기', done: false },
  ]

  const target = completeTask(tasks, '빨래 개기')

  assert.equal(target, tasks[1])
  assert.equal(tasks[1].done, true)
  assert.equal(tasks[0].done, false)
})

test('없는 제목은 던지지 않고 undefined 를 돌려준다', () => {
  const tasks = [{ title: '우유 사기', done: false }]

  assert.equal(completeTask(tasks, '세차하기'), undefined)
  assert.equal(tasks[0].done, false)
})

test('countPending 은 아직 안 끝난 것만 센다', () => {
  assert.equal(countPending([]), 0)
  assert.equal(countPending([
    { title: 'a', done: false },
    { title: 'b', done: true },
    { title: 'c', done: false },
  ]), 2)
})
`;

// s04 에서 중복 금지 규칙을 테스트로 먼저 못 박는다.
const DUPLICATE_TESTS = `
test('같은 제목을 두 번 넣을 수 없다', () => {
  const tasks = []
  addTask(tasks, '우유 사기')

  assert.throws(() => addTask(tasks, '우유 사기'), { name: 'InvalidInputError' })
  assert.equal(tasks.length, 1)
})

test('앞뒤 공백만 다른 제목도 같은 것으로 본다', () => {
  const tasks = []
  addTask(tasks, '우유 사기')

  assert.throws(() => addTask(tasks, '  우유 사기  '), { name: 'InvalidInputError' })
  assert.equal(tasks.length, 1)
})

test('다른 제목은 그대로 들어간다', () => {
  const tasks = []
  addTask(tasks, '우유 사기')
  addTask(tasks, '빨래 개기')

  assert.equal(tasks.length, 2)
})
`;

const STORE_TEST = `import test from 'node:test'
import assert from 'node:assert/strict'
import { rm, writeFile } from 'node:fs/promises'
import { readTasks, saveTasks } from '../lib/store.mjs'

// 진짜 목록(tasks.json)은 건드리지 않는다. 테스트는 자기 파일만 쓰고 치운다.
const FILE = 'tasks.test.json'

test('파일이 아직 없으면 빈 목록으로 시작한다', async (t) => {
  t.after(() => rm(FILE, { force: true }))
  await rm(FILE, { force: true })

  assert.deepEqual(await readTasks(FILE), [])
})

test('저장한 것을 그대로 읽어 온다', async (t) => {
  t.after(() => rm(FILE, { force: true }))

  const tasks = [
    { title: '우유 사기', done: false },
    { title: '빨래 개기', done: true },
  ]
  await saveTasks(tasks, FILE)

  assert.deepEqual(await readTasks(FILE), tasks)
})

test('망가진 파일은 이름 붙은 실패로 알린다', async (t) => {
  t.after(() => rm(FILE, { force: true }))
  await writeFile(FILE, '[{"title": "우유 사기",')

  await assert.rejects(() => readTasks(FILE), { name: 'InvalidInputError' })
})
`;

const TASK_STORE_TEST = `import test from 'node:test'
import assert from 'node:assert/strict'
import { TaskStore } from '../lib/task-store.mjs'

test('찍어 낸 것마다 자기 목록을 갖는다', () => {
  const a = new TaskStore()
  const b = new TaskStore()

  a.add('우유 사기')

  assert.equal(a.size, 1)
  assert.equal(b.size, 0, '목록을 나눠 쓰고 있다')
})

test('all() 은 복사본을 돌려준다', () => {
  const store = new TaskStore([{ title: '우유 사기', done: false }])

  const escaped = store.all()
  escaped.push({ title: '몰래 넣은 것', done: false })
  escaped.length = 0

  assert.equal(store.all().length, 1, '내보낸 것으로 안쪽을 바꿀 수 있으면 안 된다')
  assert.equal(store.all()[0].title, '우유 사기')
})

test('size 와 pending 은 읽을 때마다 계산된다', () => {
  const store = new TaskStore()
  assert.equal(store.size, 0)
  assert.equal(store.pending, 0)

  store.add('우유 사기')
  store.add('빨래 개기')
  assert.equal(store.size, 2)
  assert.equal(store.pending, 2)

  store.complete('우유 사기')
  assert.equal(store.size, 2, '완료해도 전체 개수는 그대로다')
  assert.equal(store.pending, 1)
})

test('감춘 목록은 밖에서 보이지 않는다', () => {
  const store = new TaskStore([{ title: '우유 사기', done: false }])

  assert.equal(store.tasks, undefined)
  assert.deepEqual(Object.keys(store), [])
})

test('틀도 6장의 규칙을 그대로 지킨다', () => {
  const store = new TaskStore()

  assert.throws(() => store.add('   '), { name: 'InvalidInputError' })
  assert.equal(store.size, 0)
})
`;

// s04: 중복 제목을 막는 규칙이 들어간 lib/tasks.mjs
const TASKS_WITH_DUPLICATE_RULE = `import { invalidInput } from './errors.mjs'

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
  if (tasks.find((task) => task.title === clean)) {
    throw invalidInput(\`이미 있는 할 일이다: \${clean}\`)
  }
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

export default {
  'ch09-s01': (ws) => write(ws, 'test/format.test.mjs', FORMAT_TEST),

  'ch09-s02': (ws) => write(ws, 'test/tasks.test.mjs', TASKS_TEST_BASE),

  'ch09-s03': (ws) => write(ws, 'test/store.test.mjs', STORE_TEST),

  // 테스트를 먼저 더하고(빨강), 규칙을 넣어 초록으로 만든다.
  'ch09-s04': (ws) => {
    write(ws, 'test/tasks.test.mjs', `${TASKS_TEST_BASE}${DUPLICATE_TESTS}`);
    write(ws, 'lib/tasks.mjs', TASKS_WITH_DUPLICATE_RULE);
  },

  'ch09-s05': (ws) => write(ws, 'test/task-store.test.mjs', TASK_STORE_TEST),
};
