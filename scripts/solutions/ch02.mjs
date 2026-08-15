// lifecycle: ops
// ch02 각 스텝을 "학습자가 올바르게 해냈을 때"의 상태로 만드는 조작.
// app.mjs 한 파일이 스텝마다 자라므로, 각 항목은 그 시점의 전체 내용을 그대로 쓴다.
import { write } from './helpers.mjs';

// s03~s07이 공유하는 formatTask 본문. done 매개변수의 모양만 스텝마다 다르다.
const formatTask = (params) => `function formatTask(${params}) {
  if (done) {
    return \`[x] \${title}\`
  } else {
    return \`[ ] \${title}\`
  }
}`;

export default {
  'ch02-s01': (ws) => {
    write(ws, 'app.mjs', `function formatTask(title) {
  console.log(\`- \${title}\`)
}

formatTask('우유 사기')
formatTask('빨래 개기')
`);
  },

  'ch02-s02': (ws) => {
    write(ws, 'app.mjs', `function formatTask(title) {
  return \`- \${title}\`
}

console.log(formatTask('우유 사기'))
console.log(formatTask('빨래 개기'))
`);
  },

  'ch02-s03': (ws) => {
    write(ws, 'app.mjs', `${formatTask('title, done')}

console.log(formatTask('우유 사기', true))
console.log(formatTask('빨래 개기', false))
`);
  },

  'ch02-s04': (ws) => {
    write(ws, 'app.mjs', `${formatTask('title, done = false')}

console.log(formatTask('우유 사기', true))
console.log(formatTask('빨래 개기'))
`);
  },

  'ch02-s05': (ws) => {
    write(ws, 'app.mjs', `${formatTask('title, done = false')}

const title = process.argv[2]
console.log(formatTask(title))
`);
  },

  'ch02-s06': (ws) => {
    write(ws, 'app.mjs', `${formatTask('title, done = false')}

const USAGE = '사용법: node app.mjs <할 일 제목>'

const title = process.argv[2]
if (title) {
  console.log(formatTask(title))
} else {
  console.log(USAGE)
  process.exit(1)
}
`);
  },

  'ch02-s07': (ws) => {
    write(ws, 'app.mjs', `${formatTask('title, done = false')}

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
  },
};
