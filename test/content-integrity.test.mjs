// 콘텐츠 판정이 헐겁지 않은지 확인한다.
//
// verify-chapter.mjs 는 "정답이면 통과한다 / 아무것도 안 하면 통과하지 않는다"를 본다.
// 여기서 보는 것은 그 사이에 있는 것 — **그럴듯하게 베껴 넣은 오답이 통과하지 않는가**다.
// 이 도장의 존재 이유가 정직한 통과 판정이므로, 콘텐츠를 고칠 때 이 그물을 약화시키지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadChapters } from '../dojo/content-loader.mjs';
import { verifyStep } from '../dojo/verify/index.mjs';
import { runProcess } from '../dojo/verify/run-process.mjs';

const STEPS = new Map(
  loadChapters().flatMap((chapter) => chapter.steps.map((step) => [step.id, step])),
);

/**
 * 오답 코드를 workspace에 놓고 그 스텝을 판정한다.
 * @param {string|Record<string,string>} source 문자열이면 app.mjs 하나, 객체면 {상대경로: 내용}
 */
async function judge(stepId, source) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-cheat-'));
  const workspaceDir = path.join(rootDir, 'workspace');
  fs.mkdirSync(workspaceDir, { recursive: true });

  const files = typeof source === 'string' ? { 'app.mjs': source } : source;
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(workspaceDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }

  const step = STEPS.get(stepId);
  assert.ok(step, `${stepId} 스텝이 콘텐츠에 없다 — 테스트가 실제 콘텐츠를 보고 있지 않다`);
  try {
    return await verifyStep(step, { workspaceDir, rootDir });
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

const FORMAT_TASK = `function formatTask(title, done = false) {
  if (done) {
    return \`[x] \${title}\`
  } else {
    return \`[ ] \${title}\`
  }
}`;

// 음성 대조군. 이것이 없으면 아래 오답 테스트들이 "하네스가 뭐든 거부한다"는 이유로도 통과해 버린다.
test('대조군: 제대로 된 구현은 이 하네스에서 통과한다', async () => {
  const result = await judge('ch02-s07', `${FORMAT_TASK}

const USAGE = '사용법: node app.mjs <add|done> <할 일 제목>'

const command = process.argv[2]
const title = process.argv[3]

if (command === 'add' && title) {
  console.log(\`추가: \${formatTask(title)}\`)
} else if (command === 'done' && title) {
  console.log(\`완료: \${formatTask(title, true)}\`)
} else {
  console.log(USAGE)
  process.exit(1)
}
`);
  assert.equal(result.passed, true, `정답이 막히면 판정이 과하다 — ${result.results.at(-1)?.detail}`);
});

test('ch02-s02: 함수가 찍기도 하고 값도 안 돌려주면 통과하지 않는다', async () => {
  // return 으로 바꾸다 만 상태. 화면에는 기대한 두 줄이 다 나오지만 undefined 가 섞인다.
  const result = await judge('ch02-s02', `function formatTask(title) {
  console.log(\`- \${title}\`)
  return
}

console.log(formatTask('우유 사기'))
console.log(formatTask('빨래 개기'))
`);
  assert.equal(result.passed, false, 'undefined 가 섞인 출력이 통과하면 return을 배우지 않고 넘어간다');
});

test('ch02-s05: 기대 출력을 하드코딩하면 통과하지 않는다', async () => {
  // 첫 번째 검사만 보고 베껴 넣은 코드. 두 번째 인자에서 반드시 걸려야 한다.
  const result = await judge('ch02-s05', `${FORMAT_TASK}

const title = process.argv[2]
console.log('[ ] 우유 사기')
`);
  assert.equal(result.passed, false, '인자를 무시하고 찍는 코드가 통과하면 process.argv를 배우지 않는다');
  assert.match(
    result.results.at(-1).label,
    /다른 제목/,
    '두 번째(다른 인자) 검사에서 걸려야 한다 — 첫 검사만으로는 하드코딩을 못 잡는다',
  );
});

test('ch02-s06: 사용법을 찍어도 성공으로 끝나면 통과하지 않는다', async () => {
  // 화면 글자는 맞지만 종료 코드가 0이다. 이 장이 가르치는 것이 바로 그 신호다.
  const result = await judge('ch02-s06', `${FORMAT_TASK}

const title = process.argv[2]
if (title) {
  console.log(formatTask(title))
} else {
  console.log('사용법: node app.mjs <할 일 제목>')
}
`);
  assert.equal(result.passed, false, '종료 코드를 보지 않으면 실패를 성공처럼 끝내도 통과해 버린다');
});

test('ch02-s07: 인자와 무관하게 다 찍어 버리면 통과하지 않는다', async () => {
  // 검사에 나오는 문구를 전부 출력해 한 번에 만족시키려는 시도.
  const result = await judge('ch02-s07', `${FORMAT_TASK}

const command = process.argv[2]
const title = process.argv[3]

console.log('추가: [ ] 우유 사기')
console.log('완료: [x] 빨래 개기')
console.log('사용법: node app.mjs <add|done> <할 일 제목>')
`);
  assert.equal(result.passed, false, '모든 기대 문구를 쏟아내는 코드가 통과하면 보스 스텝이 무의미해진다');
});

test('ch02-s07: 종료 코드만 빠져도 통과하지 않는다', async () => {
  // 분기는 제대로 했지만 실패를 실패로 알리지 않는 경우.
  const result = await judge('ch02-s07', `${FORMAT_TASK}

const USAGE = '사용법: node app.mjs <add|done> <할 일 제목>'

const command = process.argv[2]
const title = process.argv[3]

if (command === 'add' && title) {
  console.log(\`추가: \${formatTask(title)}\`)
} else if (command === 'done' && title) {
  console.log(\`완료: \${formatTask(title, true)}\`)
} else {
  console.log(USAGE)
}
`);
  assert.equal(result.passed, false, 'process.exit(1) 없이 통과하면 s06에서 배운 것이 되돌아간다');
});

const OBJECT_TASKS = `const tasks = [
  { title: '우유 사기', done: false },
  { title: '빨래 개기', done: true },
]`;

test('대조군: ch03 보스의 제대로 된 구현은 통과한다', async () => {
  const result = await judge('ch03-s06', `${FORMAT_TASK}

const USAGE = '사용법: node app.mjs <add 제목 | done | list>'

${OBJECT_TASKS}

const command = process.argv[2]
const title = process.argv[3]

if (command === 'add' && title) {
  tasks.push({ title: title, done: false })
  const last = tasks[tasks.length - 1]
  console.log(\`추가: \${formatTask(last.title, last.done)}\`)
  console.log(\`할 일 \${tasks.length}개\`)
  console.log(\`마지막: \${formatTask(last.title, last.done)}\`)
} else if (command === 'done') {
  const first = tasks[0]
  first.done = true
  console.log(\`완료: \${formatTask(first.title, first.done)}\`)
  console.log(\`처음: \${formatTask(tasks[0].title, tasks[0].done)}\`)
} else if (command === 'list') {
  console.log(\`할 일 \${tasks.length}개\`)
  const first = tasks[0]
  const last = tasks[tasks.length - 1]
  console.log(\`처음: \${formatTask(first.title, first.done)}\`)
  console.log(\`마지막: \${formatTask(last.title, last.done)}\`)
} else {
  console.log(USAGE)
  process.exit(1)
}
`);
  assert.equal(result.passed, true, `정답이 막히면 판정이 과하다 — ${result.results.at(-1)?.detail}`);
});

test('ch03-s03: push 없이 개수만 맞춰 찍으면 통과하지 않는다', async () => {
  // 개수가 늘어난 것처럼 보이게 숫자만 더해 찍은 코드. 목록에는 아무것도 들어가지 않았다.
  //
  // 이건 파일 검사가 잡는다. s03 이 홀로 보장하는 것은 여기까지다 —
  // "push 는 했지만 엉뚱한 값을 넣었다"는 s03 검사만으로는 갈라내지 못하고,
  // 넣은 것을 목록에서 **다시 꺼내 보는** s06 보스 검사에서 걸린다(아래 s06 테스트).
  const result = await judge('ch03-s03', `${FORMAT_TASK}

const USAGE = '사용법: node app.mjs <add|done|list> [할 일 제목]'

const tasks = ['우유 사기', '빨래 개기']

const command = process.argv[2]
const title = process.argv[3]

if (command === 'add' && title) {
  console.log(\`추가: \${formatTask(title)}\`)
  console.log(\`할 일 \${tasks.length + 1}개\`)
} else if (command === 'list') {
  console.log(\`할 일 \${tasks.length}개\`)
  console.log(\`처음: \${formatTask(tasks[0])}\`)
  console.log(\`마지막: \${formatTask(tasks[tasks.length - 1])}\`)
} else {
  console.log(USAGE)
  process.exit(1)
}
`);
  assert.equal(result.passed, false, '개수 숫자만 맞춘 코드가 통과하면 push를 배우지 않고 넘어간다');
});

test('ch03-s05: 복사본을 바꾸면 통과하지 않는다', async () => {
  // 이 장이 겨냥하는 진짜 오개념. `.done = true` 를 제대로 썼으므로 파일 검사는 통과하지만,
  // 바꾼 것이 배열 안의 객체가 아니라 새로 만든 복사본이라 목록은 그대로다.
  // 반드시 **실행 검사** 에서 걸려야 한다 — 파일만 봐서는 구분할 수 없는 오답이다.
  const result = await judge('ch03-s05', `${FORMAT_TASK}

const USAGE = '사용법: node app.mjs <add 제목 | done | list>'

${OBJECT_TASKS}

const command = process.argv[2]
const title = process.argv[3]

if (command === 'done') {
  const first = { title: tasks[0].title, done: tasks[0].done }
  first.done = true
  console.log(\`완료: \${formatTask(first.title, first.done)}\`)
  console.log(\`처음: \${formatTask(tasks[0].title, tasks[0].done)}\`)
} else if (command === 'list') {
  console.log(\`할 일 \${tasks.length}개\`)
  console.log(\`처음: \${formatTask(tasks[0].title, tasks[0].done)}\`)
} else {
  console.log(USAGE)
  process.exit(1)
}
`);
  assert.equal(result.passed, false, '복사본을 바꾼 코드가 통과하면 이 스텝의 개념이 통째로 새어 나간다');
  assert.match(
    result.results.at(-1).label,
    /다시 꺼내도/,
    '목록에서 다시 꺼내 보는 실행 검사가 잡아야 한다 — 파일 검사만으로는 복사본인지 알 수 없다',
  );
});

test('ch03-s06: 넣은 값을 그대로 되찍으면 통과하지 않는다', async () => {
  // 목록에서 꺼내지 않고 받은 제목을 그대로 '마지막'으로 찍는다.
  // add 검사는 속아 넘어가더라도, 목록을 실제로 보는 list 검사에서 걸려야 한다.
  const result = await judge('ch03-s06', `${FORMAT_TASK}

const USAGE = '사용법: node app.mjs <add 제목 | done | list>'

${OBJECT_TASKS}

const command = process.argv[2]
const title = process.argv[3]

if (command === 'add' && title) {
  console.log(\`추가: \${formatTask(title)}\`)
  console.log(\`할 일 \${tasks.length + 1}개\`)
  console.log(\`마지막: \${formatTask(title)}\`)
} else if (command === 'done') {
  console.log(\`완료: \${formatTask('우유 사기', true)}\`)
  console.log(\`처음: \${formatTask('우유 사기', true)}\`)
} else if (command === 'list') {
  console.log('할 일 2개')
  console.log('처음: [ ] 우유 사기')
  console.log('마지막: [ ] 빨래 개기')
} else {
  console.log(USAGE)
  process.exit(1)
}
`);
  assert.equal(result.passed, false, '목록을 보지 않고 출력만 흉내 낸 코드가 통과하면 보스 스텝이 무의미해진다');
});

const RENDER = "const render = (task) => formatTask(task.title, task.done)";

test('ch04-s02: 번호 카운터를 반복문 안에 두면 통과하지 않는다', async () => {
  // 이 스텝이 겨냥하는 오개념 그대로. `let` 을 썼으므로 파일 검사는 통과하지만,
  // 블록 안에서 매 회전 새로 만들어져 번호가 전부 1로 찍힌다. 실행 검사만이 갈라낼 수 있다.
  const result = await judge('ch04-s02', `${FORMAT_TASK}

const USAGE = '사용법: node app.mjs <add 제목 | done | list>'

function printAll(items) {
  for (const task of items) {
    let index = 1
    console.log(\`\${index}. \${formatTask(task.title, task.done)}\`)
    index = index + 1
  }
}

${OBJECT_TASKS}

const command = process.argv[2]
const title = process.argv[3]

if (command === 'add' && title) {
  tasks.push({ title: title, done: false })
  console.log(\`추가: \${formatTask(title)}\`)
  printAll(tasks)
} else if (command === 'list') {
  console.log(\`할 일 \${tasks.length}개\`)
  printAll(tasks)
} else {
  console.log(USAGE)
  process.exit(1)
}
`);
  assert.equal(result.passed, false, '번호가 전부 1인 코드가 통과하면 블록 스코프를 배우지 않고 넘어간다');
  assert.match(
    result.results.at(-1).label,
    /번호가 1부터 이어진다/,
    '실행 검사가 잡아야 한다 — let 을 썼는지만 봐서는 어디에 뒀는지 알 수 없다',
  );
});

test('ch04-s05: 남은 개수를 세지 않고 전체 개수를 그대로 쓰면 통과하지 않는다', async () => {
  // filter 는 불렀지만 결과를 쓰지 않고 tasks.length 를 두 번 찍는다.
  const result = await judge('ch04-s05', `${FORMAT_TASK}

const USAGE = '사용법: node app.mjs <add 제목 | done | list>'

${RENDER}

function printAll(items) {
  const lines = items.map((task, i) => \`\${i + 1}. \${render(task)}\`)
  for (const line of lines) {
    console.log(line)
  }
}

${OBJECT_TASKS}

const command = process.argv[2]
const title = process.argv[3]

if (command === 'list') {
  const remaining = tasks.filter((task) => task.done === false)
  console.log(\`할 일 \${tasks.length}개 (남은 것 \${tasks.length}개)\`)
  printAll(tasks)
} else {
  console.log(USAGE)
  process.exit(1)
}
`);
  assert.equal(result.passed, false, '고른 결과를 쓰지 않는 코드가 통과하면 filter 를 배우지 않는다');
});

test('ch04-s06: 찾지 않고 무조건 첫 번째를 완료하면 통과하지 않는다', async () => {
  // 3장의 습관이 남은 코드. find 를 부르긴 하지만 결과를 버리고 tasks[0] 을 바꾼다.
  const result = await judge('ch04-s06', `${FORMAT_TASK}

const USAGE = '사용법: node app.mjs <add 제목 | done 제목 | list>'

${RENDER}

${OBJECT_TASKS}

const command = process.argv[2]
const title = process.argv[3]

if (command === 'done' && title) {
  const target = tasks.find((task) => task.title === title)
  tasks[0].done = true
  console.log(\`완료: \${render(tasks[0])}\`)
} else {
  console.log(USAGE)
  process.exit(1)
}
`);
  assert.equal(result.passed, false, '지목한 것과 다른 항목을 완료하는 코드가 통과하면 find 가 무의미해진다');
});

test('ch04-s07: 없는 제목을 성공으로 끝내면 통과하지 않는다', async () => {
  // 목록 출력은 모두 제대로 하지만, 못 찾은 경우를 실패로 알리지 않는다.
  const result = await judge('ch04-s07', `${FORMAT_TASK}

const USAGE = '사용법: node app.mjs <add 제목 | done 제목 | list>'

${RENDER}

function printAll(items) {
  const lines = items.map((task, i) => \`\${i + 1}. \${render(task)}\`)
  for (const line of lines) {
    console.log(line)
  }
}

${OBJECT_TASKS}

const command = process.argv[2]
const title = process.argv[3]

if (command === 'add' && title) {
  tasks.push({ title: title, done: false })
  console.log(\`추가: \${render(tasks[tasks.length - 1])}\`)
  printAll(tasks)
} else if (command === 'done' && title) {
  const target = tasks.find((task) => task.title === title)
  if (target) {
    target.done = true
    console.log(\`완료: \${render(target)}\`)
  }
  printAll(tasks)
} else if (command === 'list') {
  const remaining = tasks.filter((task) => task.done === false)
  console.log(\`할 일 \${tasks.length}개 (남은 것 \${remaining.length}개)\`)
  printAll(tasks)
} else {
  console.log(USAGE)
  process.exit(1)
}
`);
  assert.equal(result.passed, false, '없는 제목을 조용히 성공으로 끝내면 사용자가 오타를 알아채지 못한다');
});

// ── ch05: 판정이 stdout 문자열에서 `-e` 하네스로 넘어가는 장.
// 하네스는 콘텐츠 YAML 안에 있어 학습자가 무력화할 수 없다. 그 힘이 실제로 작동하는지 확인한다.

const GOOD_TASKS_MODULE = `const isPending = (task) => task.done === false

export function addTask(tasks, title) {
  tasks.push({ title: title, done: false })
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

test('대조군: ch05 모듈의 제대로 된 구현은 통과한다', async () => {
  const result = await judge('ch05-s04', { 'lib/tasks.mjs': GOOD_TASKS_MODULE });
  assert.equal(result.passed, true, `정답이 막히면 판정이 과하다 — ${result.results.at(-1)?.detail}`);
});

test('ch05-s01: 넘겨받은 목록을 두고 자기 배열에 넣으면 통과하지 않는다', async () => {
  // 모듈이 상태를 혼자 들고 있는 흔한 오답. 부른 쪽의 목록은 비어 있는 채로 남는다.
  const result = await judge('ch05-s01', {
    'lib/tasks.mjs': `const store = []

export function addTask(tasks, title) {
  store.push({ title: title, done: false })
  return store[store.length - 1]
}
`,
  });
  assert.equal(result.passed, false, '넘겨준 목록을 건드리지 않는 코드가 통과하면 안 된다');
});

test('ch05-s01: 넣은 것이 아니라 복사본을 돌려주면 통과하지 않는다', async () => {
  // 겉보기 값은 같지만 목록 안의 그 객체가 아니다. 돌려받아 고치면 목록에 반영되지 않는다.
  const result = await judge('ch05-s01', {
    'lib/tasks.mjs': `export function addTask(tasks, title) {
  tasks.push({ title: title, done: false })
  return { title: title, done: false }
}
`,
  });
  assert.equal(result.passed, false, '복사본을 돌려주면 부른 쪽이 목록을 고칠 수 없다');
});

test('ch05-s04: 지목한 것 대신 첫 번째를 완료하면 통과하지 않는다', async () => {
  const result = await judge('ch05-s04', {
    'lib/tasks.mjs': `const isPending = (task) => task.done === false

export function addTask(tasks, title) {
  tasks.push({ title: title, done: false })
  return tasks[tasks.length - 1]
}

export function completeTask(tasks, title) {
  tasks[0].done = true
  return tasks[0]
}

export function countPending(tasks) {
  return tasks.filter(isPending).length
}
`,
  });
  assert.equal(result.passed, false, '지목하지 않은 항목을 건드리는 코드가 통과하면 안 된다');
});

test('ch05-s04: 내부 도우미를 내보내면 통과하지 않는다', async () => {
  // 동작은 전부 맞지만 모듈 경계가 새어 나갔다.
  // 이 판정은 "가져오기가 실패해야 한다"는 뒤집힌 검사라, 실제로 도는지 확인해 둘 값어치가 있다.
  // 파일 검사(내보내지 않은 최상위 선언이 있다)는 통과하도록 다른 도우미를 하나 더 둔다.
  // 그래야 마지막 '가져올 수 없다' 검사가 실제로 돌고, 그것이 잡는지 확인할 수 있다.
  const leaked = GOOD_TASKS_MODULE.replace(
    'const isPending = (task) => task.done === false',
    'const PENDING = false\nexport const isPending = (task) => task.done === PENDING',
  );
  const result = await judge('ch05-s04', { 'lib/tasks.mjs': leaked });

  assert.equal(result.passed, false, '내보내지 않기로 한 것이 새어 나가면 모듈 경계가 무너진다');
  assert.match(
    result.results.at(-1).label,
    /밖에서 가져올 수 없다/,
    '경계를 보는 검사가 잡아야 한다 — 앞선 검사에서 걸리면 이 판정은 한 번도 돌지 않은 것이다',
  );
});

test('ch05-s04: 도우미를 function 선언으로 써도 통과한다', async () => {
  // 판정이 과하지 않은지 본다. 화살표만 인정하면 제대로 한 학습자를 막게 된다.
  const result = await judge('ch05-s04', {
    'lib/tasks.mjs': GOOD_TASKS_MODULE.replace(
      'const isPending = (task) => task.done === false',
      'function isPending(task) {\n  return task.done === false\n}',
    ),
  });
  assert.equal(result.passed, true, `표현 방식만 다른 정답이 막히면 안 된다 — ${result.results.at(-1)?.detail}`);
});

test('ch05-s05: 데이터 조작이 app.mjs 에 남아 있으면 통과하지 않는다', async () => {
  // 모듈을 가져오긴 했지만 list 는 여전히 직접 filter 한다. 화면 출력은 완전히 정상이다.
  const result = await judge('ch05-s05', {
    'lib/tasks.mjs': GOOD_TASKS_MODULE,
    'lib/format.mjs': `export default function formatTask(title, done = false) {
  if (done) {
    return \`[x] \${title}\`
  } else {
    return \`[ ] \${title}\`
  }
}
`,
    'app.mjs': `import { addTask, completeTask, countPending } from './lib/tasks.mjs'
import formatTask from './lib/format.mjs'

const USAGE = '사용법: node app.mjs <add 제목 | done 제목 | list>'

const render = (task) => formatTask(task.title, task.done)

function printAll(items) {
  const lines = items.map((task, i) => \`\${i + 1}. \${render(task)}\`)
  for (const line of lines) {
    console.log(line)
  }
}

const tasks = [
  { title: '우유 사기', done: false },
  { title: '빨래 개기', done: true },
]

const command = process.argv[2]
const title = process.argv[3]

if (command === 'add' && title) {
  const added = addTask(tasks, title)
  console.log(\`추가: \${render(added)}\`)
  printAll(tasks)
} else if (command === 'done' && title) {
  const target = completeTask(tasks, title)
  if (target) {
    console.log(\`완료: \${render(target)}\`)
    printAll(tasks)
  } else {
    console.log(\`그런 할 일이 없다: \${title}\`)
    process.exit(1)
  }
} else if (command === 'list') {
  const remaining = tasks.filter((task) => task.done === false)
  console.log(\`할 일 \${tasks.length}개 (남은 것 \${remaining.length}개)\`)
  printAll(tasks)
} else {
  console.log(USAGE)
  process.exit(1)
}
`,
  });
  assert.equal(result.passed, false, '화면이 맞아도 데이터 조작이 새어 나와 있으면 이 스텝의 목표를 못 이룬 것이다');
});

// ── ch06: 실패 처리. "던진다고 적었는가"가 아니라 "실제로 막는가"를 본다.

const ERRORS_MODULE = `export function invalidInput(message) {
  const error = new Error(message)
  error.name = 'InvalidInputError'
  return error
}
`;

const GUARDED_TASKS = `import { invalidInput } from './errors.mjs'

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

const FORMAT_MODULE = `export default function formatTask(title, done = false) {
  if (done) {
    return \`[x] \${title}\`
  } else {
    return \`[ ] \${title}\`
  }
}
`;

// ch06-s04 는 CLI 검사도 포함하므로, 앞 스텝들이 남겼을 파일까지 갖춰야 판정이 제대로 돈다.
// (누적 검증과 달리 이 하네스는 매번 빈 workspace 에서 시작한다.)
const APP_NAMED_CATCH = `import { addTask, completeTask, countPending } from './lib/tasks.mjs'
import formatTask from './lib/format.mjs'

const USAGE = '사용법: node app.mjs <add 제목 | done 제목 | list>'
const render = (task) => formatTask(task.title, task.done)

function printAll(items) {
  const lines = items.map((task, i) => \`\${i + 1}. \${render(task)}\`)
  for (const line of lines) {
    console.log(line)
  }
}

const tasks = [
  { title: '우유 사기', done: false },
  { title: '빨래 개기', done: true },
]

const command = process.argv[2]
const title = process.argv[3]

if (command === 'add') {
  try {
    const added = addTask(tasks, title)
    console.log(\`추가: \${render(added)}\`)
    printAll(tasks)
  } catch (error) {
    if (error.name !== 'InvalidInputError') {
      throw error
    }
    console.log(\`추가하지 못했다: \${error.message}\`)
    process.exit(1)
  }
} else if (command === 'done' && title) {
  const target = completeTask(tasks, title)
  if (target) {
    console.log(\`완료: \${render(target)}\`)
    printAll(tasks)
  } else {
    console.log(\`그런 할 일이 없다: \${title}\`)
    process.exit(1)
  }
} else if (command === 'list') {
  console.log(\`할 일 \${tasks.length}개 (남은 것 \${countPending(tasks)}개)\`)
  printAll(tasks)
} else {
  console.log(USAGE)
  process.exit(1)
}
`;

/** ch06-s04 판정에 필요한 파일 일습. tasks 모듈만 갈아 끼워 오답을 만든다. */
const withTasks = (tasksModule) => ({
  'lib/errors.mjs': ERRORS_MODULE,
  'lib/format.mjs': FORMAT_MODULE,
  'lib/tasks.mjs': tasksModule,
  'app.mjs': APP_NAMED_CATCH,
});

test('대조군: ch06 가드가 갖춰진 모듈은 통과한다', async () => {
  const result = await judge('ch06-s04', withTasks(GUARDED_TASKS));
  assert.equal(result.passed, true, `정답이 막히면 판정이 과하다 — ${result.results.at(-1)?.detail}`);
});

test('ch06-s01: 검사를 push 뒤에 두면 통과하지 않는다', async () => {
  // 던지기는 던진다. 그런데 이미 목록이 더러워진 뒤다.
  // 파일 검사(throw 가 있다)는 통과하므로 실행 검사만이 갈라낼 수 있다.
  const result = await judge('ch06-s01', {
    'lib/tasks.mjs': `const isPending = (task) => task.done === false

export function addTask(tasks, title) {
  tasks.push({ title: title, done: false })
  if (title === undefined || title.trim() === '') {
    throw new Error('할 일 제목이 비어 있다')
  }
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
`,
  });
  assert.equal(result.passed, false, '거부했는데 목록에 남는 코드가 통과하면 안 된다');
  assert.match(
    result.results.at(-1).label,
    /목록에 아무것도 남지 않는다/,
    '상태를 보는 실행 검사가 잡아야 한다 — throw 가 있는지만 봐서는 순서를 알 수 없다',
  );
});

test('ch06-s02: 실패했는데 추가 메시지까지 찍으면 통과하지 않는다', async () => {
  // try 로 감싸긴 했는데 감싼 범위가 좁아, 던지기 전에 "추가: " 가 먼저 찍힌다.
  const result = await judge('ch06-s02', {
    'lib/tasks.mjs': `export function addTask(tasks, title) {
  if (title === undefined || title.trim() === '') {
    throw new Error('할 일 제목이 비어 있다')
  }
  tasks.push({ title: title.trim(), done: false })
  return tasks[tasks.length - 1]
}

export function completeTask(tasks, title) {
  return tasks.find((task) => task.title === title)
}

export function countPending(tasks) {
  return tasks.filter((task) => task.done === false).length
}
`,
    'lib/format.mjs': `export default function formatTask(title, done = false) {
  return done ? \`[x] \${title}\` : \`[ ] \${title}\`
}
`,
    'app.mjs': `import { addTask, completeTask, countPending } from './lib/tasks.mjs'
import formatTask from './lib/format.mjs'

const USAGE = '사용법: node app.mjs <add 제목 | done 제목 | list>'
const render = (task) => formatTask(task.title, task.done)

const tasks = [
  { title: '우유 사기', done: false },
  { title: '빨래 개기', done: true },
]

const command = process.argv[2]
const title = process.argv[3]

if (command === 'add') {
  console.log('추가: 처리 중')
  try {
    addTask(tasks, title)
  } catch (error) {
    console.log(\`추가하지 못했다: \${error.message}\`)
    process.exit(1)
  }
} else {
  console.log(USAGE)
  process.exit(1)
}
`,
  });
  assert.equal(result.passed, false, '실패했는데 성공 메시지가 먼저 나가면 사용자가 헷갈린다');
});

test('ch06-s03: 모르는 실패까지 삼키면 통과하지 않는다', async () => {
  // catch 가 종류를 가리지 않는다. 이름 붙은 실패는 제대로 만들어 놓고도
  // app 쪽에서 전부 뭉뚱그리므로 진짜 버그가 숨는다.
  const result = await judge('ch06-s03', {
    'lib/errors.mjs': ERRORS_MODULE,
    'lib/tasks.mjs': `import { invalidInput } from './errors.mjs'

export function addTask(tasks, title) {
  if (title === undefined || title.trim() === '') {
    throw invalidInput('할 일 제목이 비어 있다')
  }
  tasks.push({ title: title.trim(), done: false })
  return tasks[tasks.length - 1]
}

export function completeTask(tasks, title) {
  return tasks.find((task) => task.title === title)
}

export function countPending(tasks) {
  return tasks.filter((task) => task.done === false).length
}
`,
    'app.mjs': `import { addTask } from './lib/tasks.mjs'

const command = process.argv[2]
const title = process.argv[3]
const tasks = []

if (command === 'add') {
  try {
    addTask(tasks, title)
    console.log('추가: 됐다')
  } catch (error) {
    console.log(\`추가하지 못했다: \${error.message}\`)
    process.exit(1)
  }
} else {
  console.log('사용법: node app.mjs <add 제목 | done 제목 | list>')
  process.exit(1)
}
`,
  });
  assert.equal(result.passed, false, '모르는 실패를 다시 던지지 않는 코드가 통과하면 안 된다');
});

test('ch06-s04: 가드가 addTask 에만 있으면 통과하지 않는다', async () => {
  const result = await judge('ch06-s04', withTasks(`import { invalidInput } from './errors.mjs'

const isPending = (task) => task.done === false

function requireTitle(title) {
  if (typeof title !== 'string' || title.trim() === '') {
    throw invalidInput('할 일 제목이 비어 있다')
  }
  return title.trim()
}

export function addTask(tasks, title) {
  const clean = requireTitle(title)
  tasks.push({ title: clean, done: false })
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
`));
  assert.equal(result.passed, false, '한 함수만 지키는 코드가 통과하면 나머지 구멍이 그대로 남는다');
  assert.match(
    result.results.at(-1).label,
    /목록 자리에 배열이 아닌 것/,
    'requireList 가 빠진 것을 첫 검사가 잡아야 한다',
  );
});

test('ch06-s04: 찾지 못한 것까지 던지면 통과하지 않는다', async () => {
  // 흔한 과잉 반응. '틀린 입력'과 '찾는 것이 없음'을 섞으면
  // 정상적인 흐름에까지 try/catch 가 번진다.
  const result = await judge('ch06-s04', withTasks(GUARDED_TASKS.replace(
    `  const target = tasks.find((task) => task.title === clean)
  if (target) {
    target.done = true
  }
  return target`,
    `  const target = tasks.find((task) => task.title === clean)
  if (target === undefined) {
    throw invalidInput('그런 할 일이 없다')
  }
  target.done = true
  return target`,
  )));
  assert.equal(result.passed, false, '정상 결과인 "못 찾음"을 예외로 만들면 안 된다');
  assert.match(
    result.results.at(-1).label,
    /찾지 못한 것은 실패가 아니다/,
    '두 가지를 가르는 검사가 잡아야 한다',
  );
});

test('ch06-s05: 스택 트레이스가 사용자에게 새어 나가면 통과하지 않는다', async () => {
  // done 가지를 try 로 감싸지 않았다. 화면에는 Node 가 찍는 스택이 그대로 나온다.
  const result = await judge('ch06-s05', {
    'lib/errors.mjs': ERRORS_MODULE,
    'lib/tasks.mjs': GUARDED_TASKS,
    'lib/format.mjs': `export default function formatTask(title, done = false) {
  if (done) {
    return \`[x] \${title}\`
  } else {
    return \`[ ] \${title}\`
  }
}
`,
    'app.mjs': `import { addTask, completeTask, countPending } from './lib/tasks.mjs'
import formatTask from './lib/format.mjs'

const USAGE = '사용법: node app.mjs <add 제목 | done 제목 | list>'
const render = (task) => formatTask(task.title, task.done)

function printAll(items) {
  const lines = items.map((task, i) => \`\${i + 1}. \${render(task)}\`)
  for (const line of lines) {
    console.log(line)
  }
}

const tasks = [
  { title: '우유 사기', done: false },
  { title: '빨래 개기', done: true },
]

const command = process.argv[2]
const title = process.argv[3]

if (command === 'add') {
  try {
    const added = addTask(tasks, title)
    console.log(\`추가: \${render(added)}\`)
    printAll(tasks)
  } catch (error) {
    if (error.name !== 'InvalidInputError') {
      throw error
    }
    console.log(\`추가하지 못했다: \${error.message}\`)
    process.exit(1)
  }
} else if (command === 'done') {
  const target = completeTask(tasks, title)
  if (target) {
    console.log(\`완료: \${render(target)}\`)
    printAll(tasks)
  } else {
    console.log(\`그런 할 일이 없다: \${title}\`)
    process.exit(1)
  }
} else if (command === 'list') {
  console.log(\`할 일 \${tasks.length}개 (남은 것 \${countPending(tasks)}개)\`)
  printAll(tasks)
} else {
  console.log(USAGE)
  process.exit(1)
}
`,
  });
  assert.equal(result.passed, false, '감싸지 않은 가지에서 스택이 새어 나가면 이 스텝의 목표를 못 이룬 것이다');
});

// ── ch07: 비동기와 영속. 화면이 아니라 파일이 증거다.

const GOOD_STORE = `import { readFile, writeFile } from 'node:fs/promises'
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

const withStore = (storeModule) => ({
  'lib/errors.mjs': ERRORS_MODULE,
  'lib/store.mjs': storeModule,
});

test('대조군: ch07 store 의 제대로 된 구현은 통과한다', async () => {
  const result = await judge('ch07-s04', withStore(GOOD_STORE));
  assert.equal(result.passed, true, `정답이 막히면 판정이 과하다 — ${result.results.at(-1)?.detail}`);
});

test('ch07-s01: 저장을 기다릴 수 없게 만들면 통과하지 않는다', async () => {
  // writeFile 을 부르기만 하고 그 Promise 를 돌려주지 않는다.
  // 파일은 결국 쓰이므로 내용만 보면 멀쩡해 보이지만, 부르는 쪽이 '언제 끝났는지' 알 수 없다.
  const result = await judge('ch07-s01', {
    'lib/store.mjs': `import { writeFile } from 'node:fs/promises'

const FILE = 'tasks.json'

export function saveTasks(tasks, file = FILE) {
  writeFile(file, JSON.stringify(tasks, null, 2))
}
`,
    'app.mjs': `import { saveTasks } from './lib/store.mjs'
console.log('추가: [ ] 장보기')
saveTasks([{ title: '장보기', done: false }]).then(() => {})
`,
  });
  assert.equal(result.passed, false, 'Promise 를 돌려주지 않으면 부르는 쪽이 저장 완료를 알 수 없다');
});

test('ch07-s03: 파일이 없을 때 터지면 통과하지 않는다', async () => {
  // ENOENT 를 걸러 내지 않았다. 이 프로그램을 처음 쓰는 사람이 시작조차 못 한다.
  const result = await judge('ch07-s03', withStore(`import { readFile, writeFile } from 'node:fs/promises'

const FILE = 'tasks.json'

export async function saveTasks(tasks, file = FILE) {
  await writeFile(file, JSON.stringify(tasks, null, 2))
}

export async function readTasks(file = FILE) {
  return JSON.parse(await readFile(file, 'utf8'))
}
`));
  assert.equal(result.passed, false, '첫 사용자가 벽을 만나는 구현이 통과하면 안 된다');
});

test('ch07-s03: 모든 실패를 빈 목록으로 삼키면 통과하지 않는다', async () => {
  // 반대 방향의 오답. ENOENT 만 골라야 하는데 무엇이 터지든 빈 목록으로 덮는다.
  // 이러면 망가진 파일이 조용히 '빈 목록'이 되어 학습자의 할 일이 통째로 사라진다.
  const result = await judge('ch07-s04', withStore(`import { readFile, writeFile } from 'node:fs/promises'
import { invalidInput } from './errors.mjs'

const FILE = 'tasks.json'

export async function saveTasks(tasks, file = FILE) {
  await writeFile(file, JSON.stringify(tasks, null, 2))
}

export async function readTasks(file = FILE) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return []
  }
}
`));
  assert.equal(result.passed, false, '망가진 파일을 빈 목록으로 덮으면 데이터가 조용히 사라진다');
});

test('ch07-s04: JSON 실패를 읽기 실패와 뭉쳐 두면 통과하지 않는다', async () => {
  // try 를 하나로 뭉쳤다. 망가진 파일도 ENOENT 검사에 걸리지 않아 원래 SyntaxError 가 그대로 나간다.
  const result = await judge('ch07-s04', withStore(`import { readFile, writeFile } from 'node:fs/promises'
import { invalidInput } from './errors.mjs'

const FILE = 'tasks.json'

export async function saveTasks(tasks, file = FILE) {
  await writeFile(file, JSON.stringify(tasks, null, 2))
}

export async function readTasks(file = FILE) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  }
}
`));
  assert.equal(result.passed, false, '망가진 파일이 이름 붙은 실패로 바뀌지 않으면 사용자가 이유를 모른다');
  assert.match(
    result.results.at(-1).label,
    /이름 붙은 실패/,
    '실패 종류를 보는 검사가 잡아야 한다',
  );
});

// ── ch08: 클래스와 캡슐화. "감췄다고 믿는데 열려 있는" 상태가 가장 위험하다.

const GOOD_TASK_STORE = `import { addTask, completeTask, countPending } from './tasks.mjs'

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

const withTaskStore = (storeModule) => ({
  'lib/errors.mjs': ERRORS_MODULE,
  'lib/tasks.mjs': GUARDED_TASKS,
  'lib/task-store.mjs': storeModule,
});

test('대조군: ch08 TaskStore 의 제대로 된 구현은 통과한다', async () => {
  const result = await judge('ch08-s05', withTaskStore(GOOD_TASK_STORE));
  assert.equal(result.passed, true, `정답이 막히면 판정이 과하다 — ${result.results.at(-1)?.detail}`);
});

test('ch08-s01: 목록을 모듈 최상위에 두면 통과하지 않는다', async () => {
  // 인스턴스마다 따로여야 할 것이 온 프로그램에 하나뿐이다.
  // 한 번만 찍어 내 쓰는 동안은 멀쩡해 보이므로, 두 개를 찍어 봐야 드러난다.
  const result = await judge('ch08-s01', withTaskStore(`const tasks = []

export class TaskStore {
  all() {
    return tasks
  }
}
`));
  assert.equal(result.passed, false, '모두가 목록 하나를 나눠 쓰면 시험용 목록조차 만들 수 없다');
  assert.match(
    result.results.at(-1).label,
    /자기 목록을 갖는다/,
    '두 개를 찍어 보는 실행 검사가 잡아야 한다',
  );
});

test('ch08-s04: 감춰 놓고 원본을 돌려주면 통과하지 않는다', async () => {
  // #tasks 로 감추기는 했다. 그런데 all() 이 원본을 그대로 내보내므로
  // store.all().push(...) 한 줄이면 규칙을 전부 우회할 수 있다.
  // 파일 검사로는 구분할 수 없는 오답이다 — 감춘 것처럼 보이기 때문이다.
  const result = await judge('ch08-s04', withTaskStore(
    GOOD_TASK_STORE.replace('return this.#tasks.slice()', 'return this.#tasks'),
  ));
  assert.equal(result.passed, false, '내보낸 것으로 안쪽을 바꿀 수 있으면 감춘 것이 아니다');
  assert.match(
    result.results.at(-1).label,
    /안쪽은 무사하다/,
    '복사본인지 보는 실행 검사가 잡아야 한다',
  );
});

test('ch08-s04: 목록을 그냥 공개 필드로 두면 통과하지 않는다', async () => {
  const result = await judge('ch08-s04', withTaskStore(`import { addTask, completeTask } from './tasks.mjs'

export class TaskStore {
  tasks

  constructor(tasks = []) {
    this.tasks = tasks
  }

  all() {
    return this.tasks.slice()
  }

  add(title) {
    return addTask(this.tasks, title)
  }

  complete(title) {
    return completeTask(this.tasks, title)
  }
}
`));
  assert.equal(result.passed, false, '밖에서 목록이 그대로 보이면 6장의 검사가 통째로 우회된다');
});

test('ch08-s05: 개수를 필드로 굳혀 두면 통과하지 않는다', async () => {
  // 생성 시점의 값을 필드에 박아 둔다. 처음에는 맞지만 추가·완료 뒤에는 거짓말이 된다.
  const result = await judge('ch08-s05', withTaskStore(`import { addTask, completeTask, countPending } from './tasks.mjs'

export class TaskStore {
  #tasks
  size
  pending

  constructor(tasks = []) {
    this.#tasks = tasks
    this.size = tasks.length
    this.pending = countPending(tasks)
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
`));
  assert.equal(result.passed, false, '한 번 굳힌 값은 목록이 바뀌는 순간 거짓말이 된다');
  assert.match(
    result.results.at(-1).label,
    /다시 계산된다/,
    '목록을 바꾼 뒤 다시 읽어 보는 검사가 잡아야 한다',
  );
});

// ── ch09: 테스트를 쓰는 장. 판정 장치(뮤테이션) 자체가 무는지 확인한다.
// 여기가 뚫리면 "테스트를 썼다"와 "그 테스트가 무언가를 지킨다"가 구별되지 않는다.

const FORMAT_MODULE_FULL = `export default function formatTask(title, done = false) {
  if (done) {
    return \`[x] \${title}\`
  } else {
    return \`[ ] \${title}\`
  }
}
`;

const REAL_FORMAT_TEST = `import test from 'node:test'
import assert from 'node:assert/strict'
import formatTask from '../lib/format.mjs'

test('아직 안 끝난 할 일은 [ ] 로 쓴다', () => {
  assert.equal(formatTask('우유 사기'), '[ ] 우유 사기')
})

test('끝낸 할 일은 [x] 로 쓴다', () => {
  assert.equal(formatTask('빨래 개기', true), '[x] 빨래 개기')
})
`;

test('대조군: ch09 진짜 테스트는 통과한다', async () => {
  const result = await judge('ch09-s01', {
    'lib/format.mjs': FORMAT_MODULE_FULL,
    'test/format.test.mjs': REAL_FORMAT_TEST,
  });
  assert.equal(result.passed, true, `정답이 막히면 판정이 과하다 — ${result.results.at(-1)?.detail}`);
});

test('ch09-s01: 아무것도 확인하지 않는 테스트는 통과하지 않는다', async () => {
  // 이 장이 겨냥하는 핵심 오답. node:test 도 쓰고 node --test 도 초록불이다.
  // 파일 검사와 실행 검사를 모두 통과하지만, 구현을 망가뜨려도 잡아내지 못한다.
  const result = await judge('ch09-s01', {
    'lib/format.mjs': FORMAT_MODULE_FULL,
    'test/format.test.mjs': `import test from 'node:test'
import assert from 'node:assert/strict'
import formatTask from '../lib/format.mjs'

test('formatTask 테스트', () => {
  assert.ok(true)
})
`,
  });
  assert.equal(result.passed, false, '때우기 테스트가 통과하면 이 장 전체가 무의미해진다');
  assert.match(
    result.results.at(-1).label,
    /망가뜨리면 테스트가 잡아낸다/,
    '뮤테이션 검사가 잡아야 한다 — node --test 초록불만으로는 구별할 수 없다',
  );
});

test('ch09-s01: 한쪽 경우만 확인하는 테스트도 통과하지 않는다', async () => {
  // 미완료만 확인하고 완료 표시는 보지 않는다. 때우기보다 그럴듯하지만 여전히 절반이 뚫려 있다.
  // 뮤테이션이 두 경우를 모두 뒤집으므로 미완료 쪽에서 걸린다 — 이 검사가 실제로 무는지 본다.
  const result = await judge('ch09-s01', {
    'lib/format.mjs': FORMAT_MODULE_FULL,
    'test/format.test.mjs': `import test from 'node:test'
import assert from 'node:assert/strict'
import formatTask from '../lib/format.mjs'

test('제목이 그대로 들어간다', () => {
  assert.match(formatTask('우유 사기'), /우유 사기/)
})
`,
  });
  assert.equal(result.passed, false, '표시 모양을 확인하지 않는 테스트가 통과하면 안 된다');
});

test('ch09-s03: 테스트가 진짜 목록 파일을 덮어쓰면 통과하지 않는다', async () => {
  // store 를 테스트하면서 기본 파일 이름을 그대로 쓴다.
  // node --test 는 초록불이고, 그러는 동안 학습자의 진짜 할 일이 지워진다.
  const result = await judge('ch09-s03', {
    'lib/errors.mjs': ERRORS_MODULE,
    'lib/store.mjs': GOOD_STORE,
    'test/store.test.mjs': `import test from 'node:test'
import assert from 'node:assert/strict'
import { readTasks, saveTasks } from '../lib/store.mjs'

const FILE = 'tasks.test.json'

test('저장한 것을 그대로 읽어 온다', async () => {
  const tasks = [{ title: '우유 사기', done: false }]
  await saveTasks(tasks)
  assert.deepEqual(await readTasks(), tasks)
})
`,
  });
  assert.equal(result.passed, false, '테스트가 진짜 데이터를 건드리면 통과가 아니다');
});

test('ch09-s03: 쓴 파일을 치우지 않으면 통과하지 않는다', async () => {
  const result = await judge('ch09-s03', {
    'lib/errors.mjs': ERRORS_MODULE,
    'lib/store.mjs': GOOD_STORE,
    // 전용 파일 이름도 쓰고 확인해야 할 것도 다 확인한다. 딱 하나, 치우고 나가지 않는다.
    // 그래야 앞 검사들을 통과해 뒷정리 검사가 실제로 도는지 볼 수 있다.
    'test/store.test.mjs': `import test from 'node:test'
import assert from 'node:assert/strict'
import { rm, writeFile } from 'node:fs/promises'
import { readTasks, saveTasks } from '../lib/store.mjs'

const FILE = 'tasks.test.json'

test('파일이 아직 없으면 빈 목록으로 시작한다', async () => {
  await rm(FILE, { force: true })
  assert.deepEqual(await readTasks(FILE), [])
})

test('저장한 것을 그대로 읽어 온다', async () => {
  const tasks = [{ title: '우유 사기', done: false }]
  await saveTasks(tasks, FILE)
  assert.deepEqual(await readTasks(FILE), tasks)
})

test('망가진 파일은 이름 붙은 실패로 알린다', async () => {
  await writeFile(FILE, '[{"title": "우유 사기",')
  await assert.rejects(() => readTasks(FILE), { name: 'InvalidInputError' })
})
`,
  });
  assert.equal(result.passed, false, '테스트가 쓰레기를 남기고 나가면 통과가 아니다');
  assert.match(
    result.results.at(-1).label,
    /치우고 나간다/,
    '뒷정리를 보는 검사가 잡아야 한다',
  );
});

// ── ch10: git. "커밋했다"는 말이 아니라 저장소 상태로 판정한다.
// 여기 오답들은 파일 내용만 보면 정답과 똑같다 — 저장소를 봐야만 갈라진다.

/** git 저장소를 갖춘 workspace 를 만든다. files 를 놓고 시키는 대로 커밋한다. */
async function judgeRepo(stepId, { files = {}, setup = async () => {} } = {}) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-git-'));
  const workspaceDir = path.join(rootDir, 'workspace');
  fs.mkdirSync(workspaceDir, { recursive: true });

  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(workspaceDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }

  const git = async (...args) => {
    const result = await runProcess(['git', ...args], { cwd: workspaceDir });
    return result;
  };
  await git('init', '-q', '-b', 'main');
  await git('config', 'user.name', 'learner');
  await git('config', 'user.email', 'learner@example.com');
  await setup(git, workspaceDir);

  const step = STEPS.get(stepId);
  assert.ok(step, `${stepId} 스텝이 콘텐츠에 없다`);
  try {
    return await verifyStep(step, { workspaceDir, rootDir });
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

const README_V1 = '# 할 일 관리 CLI\n\n바닐라 자바스크립트로 만든 명령줄 할 일 관리 도구.\n';
const GITIGNORE = 'tasks.json\ntasks.test.json\n';

test('대조군: ch10 제대로 커밋하면 통과한다', async () => {
  const result = await judgeRepo('ch10-s03', {
    files: {
      'README.md': README_V1,
      '.gitignore': GITIGNORE,
      'app.mjs': "console.log('사용법')\n",
      'test/x.test.mjs': "import test from 'node:test'\nimport assert from 'node:assert/strict'\ntest('x', () => assert.ok(true))\n",
    },
    setup: async (git) => {
      await git('add', '.');
      await git('commit', '-q', '-m', 'feat: 할 일 관리 CLI 첫 커밋');
    },
  });
  assert.equal(result.passed, true, `정답이 막히면 판정이 과하다 — ${result.results.at(-1)?.detail}`);
});

test('ch10-s02: .gitignore 를 적어 두기만 하고 이름이 어긋나면 통과하지 않는다', async () => {
  // 파일 검사(tasks.json 이라는 글자가 있다)는 통과한다.
  // 그런데 앞에 슬래시를 붙이는 식으로 잘못 적어 실제로는 걸러지지 않는 경우가 있다.
  const result = await judgeRepo('ch10-s02', {
    files: { '.gitignore': '# tasks.json 은 데이터다\n', 'tasks.json': '[]\n' },
  });
  assert.equal(result.passed, false, '주석으로만 적힌 것은 걸러 주지 않는다');
  assert.match(
    result.results.at(-1).label,
    /실제로 걸러진다/,
    'git 이 정말 무시하는지 보는 검사가 잡아야 한다',
  );
});

test('ch10-s03: 커밋하지 않고 파일만 만들어 두면 통과하지 않는다', async () => {
  const result = await judgeRepo('ch10-s03', {
    files: { 'README.md': README_V1, '.gitignore': GITIGNORE, 'app.mjs': "console.log('x')\n" },
  });
  assert.equal(result.passed, false, '파일만 있고 이력에 없으면 되돌아갈 지점이 없다');
});

test('ch10-s03: 데이터 파일까지 커밋해 버리면 통과하지 않는다', async () => {
  // .gitignore 없이 전부 담았다. 커밋도 있고 작업 트리도 깨끗해서 앞 검사들은 통과한다.
  const result = await judgeRepo('ch10-s03', {
    files: { 'README.md': README_V1, 'app.mjs': "console.log('x')\n", 'tasks.json': '[]\n' },
    setup: async (git) => {
      await git('add', '.');
      await git('commit', '-q', '-m', 'feat: 첫 커밋');
    },
  });
  assert.equal(result.passed, false, '데이터가 이력에 들어가면 통과가 아니다');
  assert.match(result.results.at(-1).label, /데이터 파일은 여전히 빠져 있다/);
});

test('ch10-s03: 메시지가 무엇을 했는지 알려 주지 않으면 통과하지 않는다', async () => {
  const result = await judgeRepo('ch10-s03', {
    files: { 'README.md': README_V1, '.gitignore': GITIGNORE, 'app.mjs': "console.log('x')\n" },
    setup: async (git) => {
      await git('add', '.');
      await git('commit', '-q', '-m', '수정');
    },
  });
  assert.equal(result.passed, false, "'수정' 같은 메시지는 아무것도 알려 주지 않는다");
});

test('ch10-s05: 충돌 표시를 지우기만 하고 한쪽을 버리면 통과하지 않는다', async () => {
  // 흔한 오답. 충돌 표시는 깨끗이 지웠고 커밋도 했지만 동료가 쓴 문장이 사라졌다.
  const result = await judgeRepo('ch10-s05', {
    files: {
      'README.md': '# 할 일 관리 CLI\n\nadd · done · list 세 명령을 지원한다.\n',
    },
    setup: async (git) => {
      await git('add', '.');
      await git('commit', '-q', '-m', 'docs: 지원하는 명령을 적는다');
    },
  });
  assert.equal(result.passed, false, '합친다는 것은 어느 하나를 버리는 것이 아니다');
  assert.match(result.results.at(-1).label, /동료가 쓴 내용이 살아 있다/);
});

// ── ch11: 디자인 패턴. 이름이 아니라 동작으로 판정하는지 확인한다.
// 여기 오답들은 전부 "패턴이라고 부를 만한 모양"을 갖추고 있다. 갈라내는 것은 동작뿐이다.

const GOOD_SORT = `import { invalidInput } from './errors.mjs'

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

test('대조군: ch11 전략 모듈의 제대로 된 구현은 통과한다', async () => {
  const result = await judge('ch11-s01', {
    'lib/errors.mjs': ERRORS_MODULE,
    'lib/sort.mjs': GOOD_SORT,
  });
  assert.equal(result.passed, true, `정답이 막히면 판정이 과하다 — ${result.results.at(-1)?.detail}`);
});

test('ch11-s01: SORTS 를 두고도 if 사슬로 고르면 통과하지 않는다', async () => {
  // 겉모습은 전략 패턴이다. 이름표 붙은 함수 목록도 있고 export 도 했다.
  // 그런데 고르는 함수가 여전히 방법을 알고 있어서, 새 전략을 더해도 쓰이지 않는다.
  const result = await judge('ch11-s01', {
    'lib/errors.mjs': ERRORS_MODULE,
    'lib/sort.mjs': `import { invalidInput } from './errors.mjs'

export const SORTS = {
  none: (tasks) => tasks.slice(),
  title: (tasks) => tasks.slice().sort((a, b) => a.title.localeCompare(b.title)),
  pending: (tasks) => tasks.slice().sort((a, b) => Number(a.done) - Number(b.done)),
}

export function sortTasks(tasks, how = 'none') {
  if (how === 'title') {
    return SORTS.title(tasks)
  } else if (how === 'pending') {
    return SORTS.pending(tasks)
  } else if (how === 'none') {
    return SORTS.none(tasks)
  }
  throw invalidInput(\`그런 정렬 방식이 없다: \${how}\`)
}
`,
  });
  assert.equal(result.passed, false, '이름만 전략이고 고르는 함수가 방법을 알고 있으면 통과가 아니다');
  assert.match(
    result.results.at(-1).label,
    /새 정렬을 더해도/,
    '새 전략을 더해 보는 검사가 잡아야 한다 — 나머지 검사는 전부 통과하는 오답이다',
  );
});

test('ch11-s02: 해지 함수를 돌려주지 않으면 통과하지 않는다', async () => {
  // 구독도 되고 통지도 온다. 해지만 안 된다 — 옵저버 패턴의 절반이 빠졌다.
  const result = await judge('ch11-s02', {
    'lib/errors.mjs': ERRORS_MODULE,
    'lib/tasks.mjs': GUARDED_TASKS,
    'lib/task-store.mjs': `import { addTask, completeTask, countPending } from './tasks.mjs'

export class TaskStore {
  #tasks
  #listeners = []

  constructor(tasks = []) {
    this.#tasks = tasks
  }

  on(event, handler) {
    this.#listeners.push({ event, handler })
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
`,
  });
  assert.equal(result.passed, false, '해지할 수 없는 구독은 옵저버 패턴이 아니다');
  assert.match(result.results.at(-1).label, /해지하면 통지가 멈춘다/);
});

test('ch11-s03: 얕은 복사로 찍어 두면 완료를 되돌리지 못한다', async () => {
  // 이 장에서 가장 걸려 넘어지기 쉬운 곳. 추가는 멀쩡히 되돌아가고 완료만 안 된다.
  // 배열 길이는 돌아오는데 객체 속 값은 이미 바뀐 뒤라서, 첫 검사는 통과해 버린다.
  const result = await judge('ch11-s03', {
    'lib/errors.mjs': ERRORS_MODULE,
    'lib/tasks.mjs': GUARDED_TASKS,
    'lib/task-store.mjs': GOOD_TASK_STORE.replace(
      `  all() {
    return this.#tasks.slice()
  }`,
      `  all() {
    return this.#tasks.slice()
  }

  restore(tasks) {
    this.#tasks = tasks.slice()
  }`,
    ),
    'lib/command.mjs': `import { invalidInput } from './errors.mjs'

export function command(store, label, action) {
  let snapshot = null

  return {
    label,
    run() {
      snapshot = store.all()
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
`,
  });
  assert.equal(result.passed, false, '완료를 되돌리지 못하는 명령은 되돌리기가 아니다');
  assert.match(
    result.results.at(-1).label,
    /완료도 되돌릴 수 있다/,
    '완료를 되돌려 보는 검사가 잡아야 한다 — 추가만 보면 멀쩡해 보인다',
  );
});

test('ch11-s05: 함수 안에 배열을 두면 하나를 나눠 쓰지 않는다', async () => {
  // 모양은 갖췄지만 부를 때마다 새 배열이 생겨, 어디서 불러 오든 서로 다른 것을 본다.
  const result = await judge('ch11-s05', {
    'lib/logger.mjs': `function store() {
  return []
}

export function log(message) {
  const entries = store()
  entries.push(message)
}

export function history() {
  return store()
}

export function clear() {
  store().length = 0
}
`,
  });
  assert.equal(result.passed, false, '나눠 쓰지 않는 기록은 아무 소용이 없다');
});

test('모든 edit 스텝의 fade.fill 에는 실제로 빈칸이 있다', () => {
  for (const chapter of loadChapters()) {
    for (const step of chapter.steps) {
      if (!step.fade) continue;
      assert.ok(
        step.fade.fill.includes('____'),
        `${step.id}: fill 단계에 빈칸이 없다 — 2단계가 1단계와 같아져 페이드가 무너진다`,
      );
      assert.ok(
        !step.fade.recall.includes('____'),
        `${step.id}: recall 단계에 코드 빈칸이 남아 있다 — 3단계는 목표 문장만 준다`,
      );
    }
  }
});

test('보스 스텝은 힌트도 페이드도 갖지 않는다', () => {
  for (const chapter of loadChapters()) {
    const bosses = chapter.steps.filter((step) => step.boss);
    for (const step of bosses) {
      assert.equal(step.hints, undefined, `${step.id}: 보스 스텝에 힌트가 있으면 복합 과제가 아니게 된다`);
      assert.equal(step.fade, undefined, `${step.id}: 보스 스텝에 페이드가 있으면 백지에서 꺼내는 훈련이 안 된다`);
    }
  }
});

test('한 챕터 안에서 같은 concept를 두 번 도입하지 않는다', () => {
  const seen = new Map();
  for (const chapter of loadChapters()) {
    for (const step of chapter.steps) {
      const previous = seen.get(step.concept);
      assert.equal(
        previous,
        undefined,
        `${step.id} 의 concept "${step.concept}" 는 ${previous} 에서 이미 도입했다 — 페이드 승강등이 엉킨다`,
      );
      seen.set(step.concept, step.id);
    }
  }
});
