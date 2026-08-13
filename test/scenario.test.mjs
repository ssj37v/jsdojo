import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureFakeRemote, resetFakeRemote, teammatePush } from '../dojo/scenario.mjs';
import { runProcess } from '../dojo/verify/run-process.mjs';

async function git(cwd, args) {
  const result = await runProcess(['git', ...args], { cwd });
  assert.equal(result.code, 0, `git ${args.join(' ')} 실패: ${result.output}`);
  return result.output;
}

/** 학습자 workspace와 .dojo 를 갖춘 가짜 도장 폴더를 만든다. */
async function makeDojo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-scenario-'));
  const workspaceDir = path.join(root, 'workspace');
  const dojoDir = path.join(root, '.dojo');
  const remoteDir = path.join(dojoDir, 'remote.git');
  fs.mkdirSync(workspaceDir, { recursive: true });
  fs.mkdirSync(dojoDir, { recursive: true });

  fs.writeFileSync(path.join(workspaceDir, 'app.js'), 'console.log("learner")\n', 'utf8');
  await git(workspaceDir, ['init', '-q', '-b', 'main']);
  await git(workspaceDir, ['config', 'user.name', 'learner']);
  await git(workspaceDir, ['config', 'user.email', 'learner@example.com']);
  await git(workspaceDir, ['add', '.']);
  await git(workspaceDir, ['commit', '-q', '-m', 'chore: 첫 커밋']);

  return { root, workspaceDir, remoteDir, baseDir: root };
}

test('가짜 원격을 만들고 origin으로 등록한다', async () => {
  const { workspaceDir, remoteDir, baseDir } = await makeDojo();
  await ensureFakeRemote({ workspaceDir, remoteDir, baseDir });

  assert.ok(fs.existsSync(path.join(remoteDir, 'HEAD')), 'bare 저장소가 만들어져야 한다');
  const url = await git(workspaceDir, ['remote', 'get-url', 'origin']);
  assert.equal(path.resolve(url.trim()), path.resolve(remoteDir));
});

test('두 번 호출해도 안전하다', async () => {
  const { workspaceDir, remoteDir, baseDir } = await makeDojo();
  await ensureFakeRemote({ workspaceDir, remoteDir, baseDir });
  await ensureFakeRemote({ workspaceDir, remoteDir, baseDir });
  const url = await git(workspaceDir, ['remote', 'get-url', 'origin']);
  assert.equal(path.resolve(url.trim()), path.resolve(remoteDir));
});

test('동료 push 시나리오: 학습자는 pull 없이 push할 수 없게 된다', async () => {
  const { workspaceDir, remoteDir, baseDir } = await makeDojo();

  const result = await teammatePush({
    workspaceDir,
    remoteDir,
    baseDir,
    file: 'app.js',
    content: 'console.log("mina")\n',
    message: 'fix: 로그 문구 수정',
  });
  assert.equal(result.branch, 'main');

  // 학습자가 같은 파일을 고쳐 커밋한다.
  fs.writeFileSync(path.join(workspaceDir, 'app.js'), 'console.log("learner v2")\n', 'utf8');
  await git(workspaceDir, ['add', '.']);
  await git(workspaceDir, ['commit', '-q', '-m', 'feat: 내 변경']);

  const push = await runProcess(['git', 'push', 'origin', 'main'], { cwd: workspaceDir });
  assert.notEqual(push.code, 0, '동료 커밋이 앞서 있으므로 그냥 push되면 안 된다');

  // pull로 상황을 해소할 수 있어야 한다(여기서는 충돌이 나는 것까지 확인).
  const pull = await runProcess(['git', 'pull', '--rebase', 'origin', 'main'], { cwd: workspaceDir });
  assert.match(`${pull.output}`, /conflict|충돌/i);
});

test('동료 커밋 작성자는 학습자와 구분된다', async () => {
  const { workspaceDir, remoteDir, baseDir } = await makeDojo();
  await teammatePush({
    workspaceDir,
    remoteDir,
    baseDir,
    file: 'notes.md',
    content: '# 회의록\n',
    message: 'docs: 회의록 추가',
  });

  await git(workspaceDir, ['fetch', '-q', 'origin']);
  const log = await git(workspaceDir, ['log', '-1', '--pretty=%an %s', 'origin/main']);
  assert.match(log, /Mina/);
  assert.match(log, /docs: 회의록 추가/);
});

test('원격 리셋은 원격만 지우고 학습자 커밋 이력은 남긴다', async () => {
  const { workspaceDir, remoteDir, baseDir } = await makeDojo();
  await teammatePush({
    workspaceDir,
    remoteDir,
    baseDir,
    file: 'x.md',
    content: 'x\n',
    message: 'docs: x',
  });

  await resetFakeRemote({ workspaceDir, remoteDir, baseDir });

  const branches = await runProcess(['git', 'branch', '-r'], { cwd: remoteDir });
  assert.equal(branches.output.trim(), '', '리셋된 원격은 비어 있어야 한다');

  const log = await git(workspaceDir, ['log', '--oneline']);
  assert.match(log, /첫 커밋/, '학습자 커밋 이력은 그대로여야 한다');
  assert.ok(fs.existsSync(path.join(workspaceDir, 'app.js')));
});

test('도장 폴더 밖은 건드리지 않는다', async () => {
  const { workspaceDir } = await makeDojo();
  const outside = path.join(os.tmpdir(), 'definitely-outside-remote.git');
  await assert.rejects(
    () => ensureFakeRemote({ workspaceDir, remoteDir: outside }),
    /관리 범위 밖/,
  );
});
