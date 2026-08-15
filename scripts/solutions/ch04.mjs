// lifecycle: ops
// ch04 각 스텝을 "학습자가 올바르게 해냈을 때"의 상태로 만드는 조작.
// ch03이 남긴 객체 배열 위에 순회·변환·선택을 얹는다.
import { write } from './helpers.mjs';

const FORMAT_TASK = `function formatTask(title, done = false) {
  if (done) {
    return \`[x] \${title}\`
  } else {
    return \`[ ] \${title}\`
  }
}`;

const TASKS = `const tasks = [
  { title: '우유 사기', done: false },
  { title: '빨래 개기', done: true },
]`;

// 목록 전체를 찍는 함수. 스텝마다 안쪽 구현만 달라진다.
const PRINT_ALL = {
  // s01: for...of 로 하나씩
  plain: `function printAll(items) {
  for (const task of items) {
    console.log(formatTask(task.title, task.done))
  }
}`,
  // s02: 반복문 밖의 let 카운터로 번호를 붙인다
  counted: `function printAll(items) {
  let index = 1
  for (const task of items) {
    console.log(\`\${index}. \${formatTask(task.title, task.done)}\`)
    index = index + 1
  }
}`,
  // s03: 반복되는 표현을 화살표 함수로 뽑았다
  rendered: `const render = (task) => formatTask(task.title, task.done)

function printAll(items) {
  let index = 1
  for (const task of items) {
    console.log(\`\${index}. \${render(task)}\`)
    index = index + 1
  }
}`,
  // s04~: map 이 자리 번호를 준다. 손으로 세던 카운터가 사라졌다
  mapped: `const render = (task) => formatTask(task.title, task.done)

function printAll(items) {
  const lines = items.map((task, i) => \`\${i + 1}. \${render(task)}\`)
  for (const line of lines) {
    console.log(line)
  }
}`,
};

// done 가지. s06 에서 "첫 번째 고정"이 "제목으로 찾기"로 바뀐다.
const DONE_FIRST = `} else if (command === 'done') {
  const first = tasks[0]
  first.done = true
  console.log(\`완료: \${formatTask(first.title, first.done)}\`)
  console.log(\`처음: \${formatTask(tasks[0].title, tasks[0].done)}\`)`;

const DONE_FOUND = `} else if (command === 'done' && title) {
  const target = tasks.find((task) => task.title === title)
  if (target) {
    target.done = true
    console.log(\`완료: \${render(target)}\`)
  } else {
    console.log(\`그런 할 일이 없다: \${title}\`)
    process.exit(1)
  }`;

const app = ({ printAll, usage, add, done, list }) => `${FORMAT_TASK}

const USAGE = '${usage}'

${printAll}

${TASKS}

const command = process.argv[2]
const title = process.argv[3]

if (command === 'add' && title) {
${add}
${done}
} else if (command === 'list') {
${list}
} else {
  console.log(USAGE)
  process.exit(1)
}
`;

const USAGE_FIRST = '사용법: node app.mjs <add 제목 | done | list>';
const USAGE_FOUND = '사용법: node app.mjs <add 제목 | done 제목 | list>';

const ADD_PLAIN = `  tasks.push({ title: title, done: false })
  console.log(\`추가: \${formatTask(title)}\`)
  printAll(tasks)`;

const LIST_PLAIN = `  console.log(\`할 일 \${tasks.length}개\`)
  printAll(tasks)`;

const LIST_REMAINING = `  const remaining = tasks.filter((task) => task.done === false)
  console.log(\`할 일 \${tasks.length}개 (남은 것 \${remaining.length}개)\`)
  printAll(tasks)`;

export default {
  'ch04-s01': (ws) => {
    write(ws, 'app.mjs', app({
      printAll: PRINT_ALL.plain,
      usage: USAGE_FIRST,
      add: ADD_PLAIN,
      done: DONE_FIRST,
      list: LIST_PLAIN,
    }));
  },

  'ch04-s02': (ws) => {
    write(ws, 'app.mjs', app({
      printAll: PRINT_ALL.counted,
      usage: USAGE_FIRST,
      add: ADD_PLAIN,
      done: DONE_FIRST,
      list: LIST_PLAIN,
    }));
  },

  'ch04-s03': (ws) => {
    write(ws, 'app.mjs', app({
      printAll: PRINT_ALL.rendered,
      usage: USAGE_FIRST,
      add: ADD_PLAIN,
      done: DONE_FIRST,
      list: LIST_PLAIN,
    }));
  },

  'ch04-s04': (ws) => {
    write(ws, 'app.mjs', app({
      printAll: PRINT_ALL.mapped,
      usage: USAGE_FIRST,
      add: ADD_PLAIN,
      done: DONE_FIRST,
      list: LIST_PLAIN,
    }));
  },

  'ch04-s05': (ws) => {
    write(ws, 'app.mjs', app({
      printAll: PRINT_ALL.mapped,
      usage: USAGE_FIRST,
      add: ADD_PLAIN,
      done: DONE_FIRST,
      list: LIST_REMAINING,
    }));
  },

  'ch04-s06': (ws) => {
    write(ws, 'app.mjs', app({
      printAll: PRINT_ALL.mapped,
      usage: USAGE_FOUND,
      add: ADD_PLAIN,
      done: DONE_FOUND,
      list: LIST_REMAINING,
    }));
  },

  // 보스: 세 명령 모두 마지막에 바뀐 목록 전체를 보여 준다.
  'ch04-s07': (ws) => {
    write(ws, 'app.mjs', app({
      printAll: PRINT_ALL.mapped,
      usage: USAGE_FOUND,
      add: `  tasks.push({ title: title, done: false })
  console.log(\`추가: \${render(tasks[tasks.length - 1])}\`)
  printAll(tasks)`,
      done: `} else if (command === 'done' && title) {
  const target = tasks.find((task) => task.title === title)
  if (target) {
    target.done = true
    console.log(\`완료: \${render(target)}\`)
    printAll(tasks)
  } else {
    console.log(\`그런 할 일이 없다: \${title}\`)
    process.exit(1)
  }`,
      list: LIST_REMAINING,
    }));
  },
};
