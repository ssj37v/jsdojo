import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SCENARIOS, runScenario } from '../dojo/scenario.mjs';
import { emptyProgress, recordSetup } from '../dojo/progress.mjs';
import { runProcess } from '../dojo/verify/run-process.mjs';

async function git(cwd, args) {
  const result = await runProcess(['git', ...args], { cwd });
  assert.equal(result.code, 0, `git ${args.join(' ')} 실패: ${result.output}`);
  return result.output;
}

async function makeDojo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-setup-'));
  const workspaceDir = path.join(root, 'workspace');
  const remoteDir = path.join(root, '.dojo', 'remote.git');
  fs.mkdirSync(workspaceDir, { recursive: true });

  fs.writeFileSync(path.join(workspaceDir, 'app.js'), 'console.log("v1")\n', 'utf8');
  await git(workspaceDir, ['init', '-q', '-b', 'main']);
  await git(workspaceDir, ['config', 'user.name', 'learner']);
  await git(workspaceDir, ['config', 'user.email', 'learner@example.com']);
  await git(workspaceDir, ['add', '.']);
  await git(workspaceDir, ['commit', '-q', '-m', 'chore: 첫 커밋']);

  return { workspaceDir, remoteDir, baseDir: root };
}

test('콘텐츠가 부를 수 있는 상황 이름이 스키마와 일치한다', () => {
  const schema = JSON.parse(fs.readFileSync(new URL('../content/schema.json', import.meta.url), 'utf8'));
  const allowed = schema.$defs.setup.properties.scenario.enum;
  assert.deepEqual(allowed.sort(), Object.keys(SCENARIOS).sort(), '스키마와 구현이 어긋나면 콘텐츠가 깨진다');
});

test('알 수 없는 상황은 거부한다', async () => {
  const context = await makeDojo();
  await assert.rejects(() => runScenario('drop_database', context, {}), /알 수 없는 상황/);
});

test('ensure_remote: 원격을 만들고 origin으로 등록한다', async () => {
  const context = await makeDojo();
  await runScenario('ensure_remote', context, {});

  const url = await git(context.workspaceDir, ['remote', 'get-url', 'origin']);
  assert.equal(path.resolve(url.trim()), path.resolve(context.remoteDir));
});

test('teammate_push: 동료 커밋이 원격에만 쌓인다', async () => {
  const context = await makeDojo();
  await runScenario('teammate_push', context, {
    file: 'app.js',
    content: 'console.log("mina")\n',
    message: 'fix: 동료가 고침',
  });

  const local = await git(context.workspaceDir, ['log', '--oneline']);
  assert.doesNotMatch(local, /동료가 고침/, '로컬에는 아직 없어야 학습자가 pull을 배운다');

  await git(context.workspaceDir, ['fetch', '-q', 'origin']);
  const remote = await git(context.workspaceDir, ['log', '--oneline', 'origin/main']);
  assert.match(remote, /동료가 고침/);
});

test('teammate_push: 같은 줄을 건드리면 실제로 충돌이 난다', async () => {
  const context = await makeDojo();
  await runScenario('teammate_push', context, {
    file: 'app.js',
    content: 'console.log("mina")\n',
    message: 'fix: 동료가 고침',
  });

  fs.writeFileSync(path.join(context.workspaceDir, 'app.js'), 'console.log("learner v2")\n', 'utf8');
  await git(context.workspaceDir, ['commit', '-qam', 'feat: 내 변경']);

  const pull = await runProcess(['git', 'pull', '--no-rebase', '--no-edit', 'origin', 'main'], {
    cwd: context.workspaceDir,
  });
  assert.notEqual(pull.code, 0, '충돌 상황이 실제로 재현되어야 한다');
  assert.match(pull.output, /conflict|충돌/i);

  const content = fs.readFileSync(path.join(context.workspaceDir, 'app.js'), 'utf8');
  assert.match(content, /<<<<<<</, '충돌 마커가 남아 학습자가 직접 해소하게 된다');
});

test('같은 스텝의 상황은 한 번만 적용된 것으로 기록된다', () => {
  let progress = emptyProgress();
  assert.equal(Boolean(progress.setups['ch07-s02']), false);

  progress = recordSetup(progress, 'ch07-s02');
  assert.ok(progress.setups['ch07-s02'].at);

  // 세이브를 되돌리면 이 기록도 함께 돌아가므로 그때는 다시 연출된다.
  const rolledBack = emptyProgress();
  assert.equal(Boolean(rolledBack.setups['ch07-s02']), false);
});
