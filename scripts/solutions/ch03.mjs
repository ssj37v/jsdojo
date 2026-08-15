// lifecycle: ops
// ch03 각 스텝을 "학습자가 올바르게 해냈을 때"의 상태로 만드는 조작.
// ch02가 남긴 app.mjs 를 이어받아 배열·객체를 얹는다.
import { write } from './helpers.mjs';

const FORMAT_TASK = `function formatTask(title, done = false) {
  if (done) {
    return \`[x] \${title}\`
  } else {
    return \`[ ] \${title}\`
  }
}`;

// s01~s03: 목록은 아직 문자열 배열이다.
const stringTasks = "const tasks = ['우유 사기', '빨래 개기']";

// s04~: 제목과 완료 여부를 함께 지닌 객체 배열.
const objectTasks = `const tasks = [
  { title: '우유 사기', done: false },
  { title: '빨래 개기', done: true },
]`;

const app = ({ tasks, usage, branches }) => `${FORMAT_TASK}

const USAGE = '${usage}'

${tasks}

const command = process.argv[2]
const title = process.argv[3]

${branches}
`;

export default {
  'ch03-s01': (ws) => {
    write(ws, 'app.mjs', app({
      tasks: stringTasks,
      usage: '사용법: node app.mjs <add|done|list> [할 일 제목]',
      branches: `if (command === 'add' && title) {
  console.log(\`추가: \${formatTask(title)}\`)
} else if (command === 'done' && title) {
  console.log(\`완료: \${formatTask(title, true)}\`)
} else if (command === 'list') {
  console.log(\`할 일 \${tasks.length}개\`)
} else {
  console.log(USAGE)
  process.exit(1)
}`,
    }));
  },

  'ch03-s02': (ws) => {
    write(ws, 'app.mjs', app({
      tasks: stringTasks,
      usage: '사용법: node app.mjs <add|done|list> [할 일 제목]',
      branches: `if (command === 'add' && title) {
  console.log(\`추가: \${formatTask(title)}\`)
} else if (command === 'done' && title) {
  console.log(\`완료: \${formatTask(title, true)}\`)
} else if (command === 'list') {
  console.log(\`할 일 \${tasks.length}개\`)
  console.log(\`처음: \${formatTask(tasks[0])}\`)
  console.log(\`마지막: \${formatTask(tasks[tasks.length - 1])}\`)
} else {
  console.log(USAGE)
  process.exit(1)
}`,
    }));
  },

  'ch03-s03': (ws) => {
    write(ws, 'app.mjs', app({
      tasks: stringTasks,
      usage: '사용법: node app.mjs <add|done|list> [할 일 제목]',
      branches: `if (command === 'add' && title) {
  tasks.push(title)
  console.log(\`추가: \${formatTask(title)}\`)
  console.log(\`할 일 \${tasks.length}개\`)
} else if (command === 'done' && title) {
  console.log(\`완료: \${formatTask(title, true)}\`)
} else if (command === 'list') {
  console.log(\`할 일 \${tasks.length}개\`)
  console.log(\`처음: \${formatTask(tasks[0])}\`)
  console.log(\`마지막: \${formatTask(tasks[tasks.length - 1])}\`)
} else {
  console.log(USAGE)
  process.exit(1)
}`,
    }));
  },

  'ch03-s04': (ws) => {
    write(ws, 'app.mjs', app({
      tasks: objectTasks,
      usage: '사용법: node app.mjs <add|done|list> [할 일 제목]',
      branches: `if (command === 'add' && title) {
  tasks.push({ title: title, done: false })
  console.log(\`추가: \${formatTask(title)}\`)
  console.log(\`할 일 \${tasks.length}개\`)
} else if (command === 'done' && title) {
  console.log(\`완료: \${formatTask(title, true)}\`)
} else if (command === 'list') {
  console.log(\`할 일 \${tasks.length}개\`)
  const first = tasks[0]
  const last = tasks[tasks.length - 1]
  console.log(\`처음: \${formatTask(first.title, first.done)}\`)
  console.log(\`마지막: \${formatTask(last.title, last.done)}\`)
} else {
  console.log(USAGE)
  process.exit(1)
}`,
    }));
  },

  'ch03-s05': (ws) => {
    write(ws, 'app.mjs', app({
      tasks: objectTasks,
      usage: '사용법: node app.mjs <add 제목 | done | list>',
      branches: `if (command === 'add' && title) {
  tasks.push({ title: title, done: false })
  console.log(\`추가: \${formatTask(title)}\`)
  console.log(\`할 일 \${tasks.length}개\`)
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
}`,
    }));
  },

  'ch03-s06': (ws) => {
    write(ws, 'app.mjs', app({
      tasks: objectTasks,
      usage: '사용법: node app.mjs <add 제목 | done | list>',
      branches: `if (command === 'add' && title) {
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
}`,
    }));
  },
};
