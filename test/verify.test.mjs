import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkFs } from '../dojo/verify/fs-check.mjs';
import { checkCmd } from '../dojo/verify/cmd-check.mjs';
import { checkGit } from '../dojo/verify/git-check.mjs';
import { cleanEnv, planSpawn, runProcess } from '../dojo/verify/run-process.mjs';
import { verifyStep } from '../dojo/verify/index.mjs';

function makeWorkspace(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-ws-'));
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(dir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }
  return { workspaceDir: dir, rootDir: dir };
}

async function git(ctx, args) {
  const result = await runProcess(['git', ...args], { cwd: ctx.workspaceDir });
  assert.equal(result.code, 0, `git ${args.join(' ')} 실패: ${result.output}`);
  return result.output;
}

async function makeRepo(files) {
  const ctx = makeWorkspace(files);
  await git(ctx, ['init', '-q', '-b', 'main']);
  await git(ctx, ['config', 'user.email', 'learner@example.com']);
  await git(ctx, ['config', 'user.name', 'learner']);
  return ctx;
}

test('fs 체크: 내용이 조건을 만족하면 통과한다', () => {
  const ctx = makeWorkspace({ 'src/app/page.jsx': "const [filter, setFilter] = useState('all')\n" });
  const result = checkFs({ type: 'fs', label: 'x', path: 'src/app/page.jsx', matches: ['useState\\('] }, ctx);
  assert.equal(result.passed, true);
});

test('fs 체크: 조건을 만족하지 못하면 실패한다', () => {
  const ctx = makeWorkspace({ 'src/app/page.jsx': 'const filter = "all"\n' });
  const result = checkFs({ type: 'fs', label: 'x', path: 'src/app/page.jsx', matches: ['useState\\('] }, ctx);
  assert.equal(result.passed, false);
});

test('fs 체크: 파일이 없으면 실패한다', () => {
  const ctx = makeWorkspace();
  const result = checkFs({ type: 'fs', label: 'x', path: 'missing.jsx' }, ctx);
  assert.equal(result.passed, false);
  assert.match(result.detail, /찾을 수 없다/);
});

test('fs 체크: not_matches로 남은 흔적을 잡는다', () => {
  const ctx = makeWorkspace({ 'a.js': '// TODO: 여기 고치기\nconst x = 1\n' });
  const result = checkFs({ type: 'fs', label: 'x', path: 'a.js', not_matches: ['TODO'] }, ctx);
  assert.equal(result.passed, false);
});

test('fs 체크: json_has로 의존성 추가를 확인한다', () => {
  const ctx = makeWorkspace({ 'package.json': JSON.stringify({ dependencies: { clsx: '^2.0.0' } }) });
  assert.equal(
    checkFs({ type: 'fs', label: 'x', path: 'package.json', json_has: ['dependencies.clsx'] }, ctx).passed,
    true,
  );
  assert.equal(
    checkFs({ type: 'fs', label: 'x', path: 'package.json', json_has: ['dependencies.react'] }, ctx).passed,
    false,
  );
});

test('fs 체크: workspace 밖으로 나가는 경로를 거부한다', () => {
  const ctx = makeWorkspace();
  const escaped = checkFs({ type: 'fs', label: 'x', path: '../../secrets.txt' }, ctx);
  assert.equal(escaped.passed, false);
  assert.match(escaped.detail, /허용 범위|경로를 확인할 수 없다/);

  const absolute = checkFs({ type: 'fs', label: 'x', path: path.join(os.tmpdir(), 'anything.txt') }, ctx);
  assert.equal(absolute.passed, false);
});

test('planSpawn: Windows에서 npm은 cmd.exe를 경유한다', () => {
  const plan = planSpawn(['npm', 'run', 'build']);
  if (process.platform === 'win32') {
    assert.equal(plan.file, 'cmd.exe');
    assert.deepEqual(plan.args, ['/d', '/s', '/c', 'npm run build']);
  } else {
    assert.equal(plan.file, 'npm');
  }
  assert.equal(planSpawn(['git', 'status']).file, 'git');
});

test('planSpawn: 셸 메타문자가 섞인 인자를 거부한다', () => {
  if (process.platform !== 'win32') return;
  assert.throws(() => planSpawn(['npm', 'run', 'build && del /f *']), /허용되지 않는 문자/);
});

test('cmd 체크: 실제 종료 코드로 판정한다', async () => {
  const ctx = makeWorkspace();
  const ok = await checkCmd({ type: 'cmd', label: 'node', run: [process.execPath, '-e', 'process.exit(0)'] }, ctx);
  assert.equal(ok.passed, true);

  const bad = await checkCmd({ type: 'cmd', label: 'node', run: [process.execPath, '-e', 'process.exit(3)'] }, ctx);
  assert.equal(bad.passed, false);
  assert.match(bad.detail, /종료 코드 3/);
});

test('cmd 체크: 물려받은 NODE_TEST_CONTEXT 때문에 학습자 테스트가 건너뛰어지지 않는다', async () => {
  // node --test 는 이 변수가 있으면 "중첩 실행"으로 보고 파일을 하나도 돌리지 않은 채 0으로 끝난다.
  // 판정이 그것을 통과로 읽으면, 실패하는 테스트를 가진 학습자가 통과해 버린다(거짓 통과).
  // 이 테스트 자체가 node --test 안에서 도므로 그 환경이 그대로 재현된다.
  assert.ok(process.env.NODE_TEST_CONTEXT, '이 회귀 테스트는 node --test 안에서 돌아야 의미가 있다');

  const ctx = makeWorkspace();
  fs.mkdirSync(path.join(ctx.workspaceDir, 'test'), { recursive: true });
  fs.writeFileSync(
    path.join(ctx.workspaceDir, 'test', 'failing.test.mjs'),
    "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('일부러 실패', () => { assert.equal(1, 2) });\n",
    'utf8',
  );

  const result = await checkCmd({ type: 'cmd', label: 'node --test', run: [process.execPath, '--test'] }, ctx);
  assert.equal(result.passed, false, '실패하는 테스트가 있는데 통과로 판정됐다 — 테스트가 건너뛰어졌다');
});

test('cleanEnv: 판정을 왜곡하는 환경 변수를 걷어 낸다', () => {
  const env = cleanEnv({ PATH: '/usr/bin', NODE_TEST_CONTEXT: 'child-v8', KEEP_ME: 'yes' });
  assert.equal(env.NODE_TEST_CONTEXT, undefined);
  assert.equal(env.KEEP_ME, 'yes', '관계없는 변수까지 지우면 학습자 환경이 달라진다');
  assert.equal(env.NO_COLOR, '1');
});

test('cmd 체크: 존재하지 않는 명령은 실패로 보고하고 throw하지 않는다', async () => {
  const ctx = makeWorkspace();
  const result = await checkCmd({ type: 'cmd', label: 'x', run: ['definitely-not-a-real-command-xyz'] }, ctx);
  assert.equal(result.passed, false);
});

test('cmd 체크: 출력 패턴을 검사한다', async () => {
  const ctx = makeWorkspace();
  const script = 'console.log("build ok")';
  assert.equal(
    (await checkCmd({ type: 'cmd', label: 'x', run: [process.execPath, '-e', script], expect_output: 'build ok' }, ctx))
      .passed,
    true,
  );
  assert.equal(
    (await checkCmd({ type: 'cmd', label: 'x', run: [process.execPath, '-e', script], reject_output: 'build ok' }, ctx))
      .passed,
    false,
  );
});

test('git 체크: 저장소·커밋·작업트리 상태를 실제로 읽는다', async () => {
  const ctx = await makeRepo({ 'a.txt': 'hello\n' });

  assert.equal((await checkGit({ assert: 'repo_exists' }, ctx)).passed, true);
  assert.equal((await checkGit({ assert: 'has_commit' }, ctx)).passed, false);
  assert.equal((await checkGit({ assert: 'clean_worktree' }, ctx)).passed, false);

  await git(ctx, ['add', 'a.txt']);
  await git(ctx, ['commit', '-q', '-m', 'first commit']);

  assert.equal((await checkGit({ assert: 'has_commit' }, ctx)).passed, true);
  assert.equal((await checkGit({ assert: 'clean_worktree' }, ctx)).passed, true);
  assert.equal((await checkGit({ assert: 'branch_is', value: 'main' }, ctx)).passed, true);
  assert.equal((await checkGit({ assert: 'branch_is', value: 'develop' }, ctx)).passed, false);
  assert.equal((await checkGit({ assert: 'tracked', value: 'a.txt' }, ctx)).passed, true);
  assert.equal((await checkGit({ assert: 'tracked', value: 'b.txt' }, ctx)).passed, false);
  assert.equal((await checkGit({ assert: 'commit_message_matches', value: '^first' }, ctx)).passed, true);
  assert.equal((await checkGit({ assert: 'commit_message_matches', value: '^second' }, ctx)).passed, false);
});

test('git 체크: 커밋이 하나도 없어도 브랜치 이름을 읽는다', async () => {
  // git init 직후에는 HEAD 가 아직 어떤 커밋도 가리키지 않는다(unborn).
  // 예전에는 여기서 git 오류문이 브랜치 이름인 양 학습자 화면에 나왔다.
  const ctx = await makeRepo({ 'a.txt': 'x' });

  const ok = await checkGit({ assert: 'branch_is', value: 'main' }, ctx);
  assert.equal(ok.passed, true, '첫 커밋 전에도 브랜치 이름은 알 수 있다');

  const bad = await checkGit({ assert: 'branch_is', value: 'master' }, ctx);
  assert.equal(bad.passed, false);
  assert.doesNotMatch(bad.detail, /fatal|ambiguous/, 'git 오류문이 학습자에게 그대로 나가면 안 된다');
  assert.match(bad.detail, /main/);
});

test('git 체크: 저장소가 아니면 repo_exists가 실패한다', async () => {
  const ctx = makeWorkspace({ 'a.txt': 'x' });
  assert.equal((await checkGit({ assert: 'repo_exists' }, ctx)).passed, false);
});

test('false pass 회귀: 부모 폴더의 저장소를 workspace의 것으로 착각하지 않는다', async () => {
  // 실제 배치를 그대로 재현한다 — 도장 저장소 안에 아직 git init 하지 않은 workspace가 있다.
  const parent = await makeRepo({ 'dojo.txt': 'engine\n' });
  await git(parent, ['add', '.']);
  await git(parent, ['commit', '-q', '-m', 'chore: 도장 저장소 커밋']);

  const workspaceDir = path.join(parent.workspaceDir, 'workspace');
  fs.mkdirSync(workspaceDir);
  fs.writeFileSync(path.join(workspaceDir, 'page.js'), 'export default function Home() {}\n', 'utf8');
  const ctx = { workspaceDir, rootDir: parent.workspaceDir };

  // git init 전에는 어떤 git 검사도 통과해서는 안 된다.
  for (const check of [
    { assert: 'repo_exists' },
    { assert: 'has_commit' },
    { assert: 'clean_worktree' },
    { assert: 'branch_is', value: 'main' },
    { assert: 'tracked', value: 'page.js' },
    { assert: 'commit_message_matches', value: '.' },
  ]) {
    const result = await checkGit(check, ctx);
    assert.equal(result.passed, false, `${check.assert} 가 부모 저장소를 보고 통과했다`);
  }

  // workspace에서 직접 git init을 하면 그때부터 통과한다.
  await git(ctx, ['init', '-q', '-b', 'main']);
  assert.equal((await checkGit({ assert: 'repo_exists' }, ctx)).passed, true);
  assert.equal((await checkGit({ assert: 'has_commit' }, ctx)).passed, false, '커밋은 아직 없다');
});

test('git 체크: .gitignore 등록을 확인한다', async () => {
  const ctx = await makeRepo({ '.gitignore': 'node_modules/\n', 'node_modules/x.js': '1' });
  assert.equal((await checkGit({ assert: 'ignored', value: 'node_modules/x.js' }, ctx)).passed, true);
  assert.equal((await checkGit({ assert: 'ignored', value: '.gitignore' }, ctx)).passed, false);
});

test('verifyStep: 모든 검사를 통과해야 통과다', async () => {
  const ctx = makeWorkspace({ 'a.js': 'const x = 1\n' });
  const step = {
    verify: [
      { type: 'fs', label: '파일 수정', path: 'a.js', matches: ['const x'] },
      { type: 'cmd', label: '실행', run: [process.execPath, '-e', 'process.exit(0)'] },
    ],
  };
  const result = await verifyStep(step, ctx);
  assert.equal(result.passed, true);
  assert.equal(result.results.length, 2);
});

test('verifyStep: 첫 실패에서 멈추고 뒤 검사는 돌리지 않는다', async () => {
  const ctx = makeWorkspace();
  const step = {
    verify: [
      { type: 'fs', label: '없는 파일', path: 'missing.js' },
      { type: 'cmd', label: '실행되면 안 됨', run: [process.execPath, '-e', 'process.exit(0)'] },
    ],
  };
  const result = await verifyStep(step, ctx);
  assert.equal(result.passed, false);
  assert.equal(result.results.length, 1);
});

test('우회 회귀: 정답 문자열만 베끼고 코드가 깨지면 통과하지 않는다', async () => {
  // 학습자가 검사 문자열만 주석으로 흉내 내고 실제 코드는 문법 오류인 상황
  const ctx = makeWorkspace({ 'a.js': '// useState(  <- 검사를 속이려는 주석\nconst broken = (\n' });
  const step = {
    verify: [
      { type: 'fs', label: '패턴', path: 'a.js', matches: ['useState\\('] },
      { type: 'cmd', label: '문법 검사', run: [process.execPath, '--check', 'a.js'] },
    ],
  };
  const result = await verifyStep(step, ctx);
  assert.equal(result.passed, false, '문자열만 베낀 우회가 통과해서는 안 된다');
  assert.equal(result.results.at(-1).label, '문법 검사');
});

test('우회 회귀: 커밋했다고 주장해도 커밋이 없으면 실패한다', async () => {
  const ctx = await makeRepo({ 'a.txt': 'x' });
  const step = { verify: [{ type: 'git', label: '커밋 확인', assert: 'has_commit' }] };
  assert.equal((await verifyStep(step, ctx)).passed, false);
});
