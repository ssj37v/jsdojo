// lifecycle: ops
// ch10 각 스텝을 "학습자가 올바르게 해냈을 때"의 상태로 만드는 조작.
// workspace 를 git 저장소로 만들고, 원격에 올리고, 동료 변경과 합친다.
import { commitAll, git, read, write } from './helpers.mjs';
import { runProcess } from '../../dojo/verify/run-process.mjs';

const README_MINE = `# 할 일 관리 CLI

파일에 저장되는 명령줄 할 일 관리 도구. add · done · list 세 명령을 지원한다.
`;

// 충돌을 해소한 모습. 어느 한쪽을 버리지 않고 둘을 합친다.
const README_MERGED = `# 할 일 관리 CLI

Node 표준 기능만으로 만든 명령줄 할 일 관리 도구. 의존성이 없다.
add · done · list 세 명령을 지원한다.
`;

export default {
  'ch10-s01': async (ws) => {
    await git(ws, ['init', '-q', '-b', 'main']);
    // 연습용 저장소에만 지정한다. --global 은 쓰지 않는다.
    await git(ws, ['config', 'user.name', 'learner']);
    await git(ws, ['config', 'user.email', 'learner@example.com']);
  },

  'ch10-s02': (ws) => {
    write(ws, '.gitignore', `# 내 할 일 목록 — 코드가 아니라 데이터다
tasks.json

# 테스트가 잠깐 쓰고 지우는 파일
tasks.test.json
`);
  },

  'ch10-s03': async (ws) => {
    write(ws, 'README.md', `# 할 일 관리 CLI

바닐라 자바스크립트로 만든 명령줄 할 일 관리 도구.
`);
    await commitAll(ws, 'feat: 할 일 관리 CLI 첫 커밋');
  },

  'ch10-s04': async (ws) => {
    await git(ws, ['push', '-q', '-u', 'origin', 'main']);
  },

  // 동료가 먼저 올려 둔 상태(teammate_push)에서 시작한다.
  'ch10-s05': async (ws) => {
    write(ws, 'README.md', README_MINE);
    await commitAll(ws, 'docs: 지원하는 명령을 적는다');

    // 같은 줄을 서로 다르게 고쳤으므로 여기서 충돌이 난다. 실패가 정상이다.
    const pull = await runProcess(['git', 'pull', '--no-rebase', '--no-edit', 'origin', 'main'], { cwd: ws });
    if (pull.code === 0) {
      throw new Error('충돌이 나야 하는데 그냥 합쳐졌다 — 상황 연출이나 시작 내용이 어긋났다');
    }
    if (!read(ws, 'README.md').includes('<<<<<<<')) {
      throw new Error('충돌 표시가 없다 — teammate_push 가 같은 줄을 건드리지 않았다');
    }

    write(ws, 'README.md', README_MERGED);
    await git(ws, ['add', 'README.md']);
    await git(ws, ['commit', '-q', '--no-edit']);
    await git(ws, ['push', '-q', 'origin', 'main']);
  },

  'ch10-s06': async (ws) => {
    await git(ws, ['switch', '-q', '-c', 'fix-usage']);

    const before = read(ws, 'app.mjs');
    const after = before.replace(
      "const USAGE = '사용법: node app.mjs <add 제목 | done 제목 | list>'",
      "const USAGE = '사용법: node app.mjs <add 제목 | done 제목 | list>   (예: node app.mjs add \"우유 사기\")'",
    );
    if (before === after) throw new Error('app.mjs 의 USAGE 문구를 찾지 못했다');
    write(ws, 'app.mjs', after);

    await commitAll(ws, 'docs: 사용법에 예시를 덧붙인다');

    await git(ws, ['switch', '-q', 'main']);
    await git(ws, ['merge', '-q', '--no-edit', 'fix-usage']);
    await git(ws, ['push', '-q', 'origin', 'main']);
  },
};
