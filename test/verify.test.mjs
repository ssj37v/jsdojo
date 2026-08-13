import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkFs } from '../dojo/verify/fs-check.mjs';
import { checkCmd } from '../dojo/verify/cmd-check.mjs';
import { checkGit } from '../dojo/verify/git-check.mjs';
import { planSpawn, runProcess } from '../dojo/verify/run-process.mjs';
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
