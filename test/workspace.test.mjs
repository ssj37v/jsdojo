import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describeBlock, measureWorkspace, removeWorkspace } from '../dojo/workspace.mjs';

function makeDojo(files = {}) {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-ws-rm-'));
  const workspaceDir = path.join(baseDir, 'workspace');
  fs.mkdirSync(workspaceDir, { recursive: true });
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(workspaceDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }
  return { baseDir, workspaceDir };
}

test('workspace를 통째로 지운다', () => {
  const { baseDir, workspaceDir } = makeDojo({
    'app/page.js': 'x',
    'node_modules/react/index.js': 'big',
  });

  const result = removeWorkspace({ workspaceDir, baseDir });
  assert.equal(result.removed, true);
  assert.equal(result.existed, true);
  assert.equal(fs.existsSync(workspaceDir), false);
  assert.equal(fs.existsSync(baseDir), true, '도장 폴더까지 지우면 안 된다');
});

test('이미 없으면 지운 것으로 본다', () => {
  const { baseDir } = makeDojo();
  const workspaceDir = path.join(baseDir, 'workspace');
  fs.rmSync(workspaceDir, { recursive: true });

  const result = removeWorkspace({ workspaceDir, baseDir });
  assert.equal(result.removed, true);
  assert.equal(result.existed, false);
});

test('도장 폴더 밖은 지우지 않는다', () => {
  const { baseDir } = makeDojo();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-outside-'));
  const outsideWorkspace = path.join(outside, 'workspace');
  fs.mkdirSync(outsideWorkspace);

  assert.throws(() => removeWorkspace({ workspaceDir: outsideWorkspace, baseDir }), /범위가 아니다/);
  assert.equal(fs.existsSync(outsideWorkspace), true, '거부했으면 그대로 남아 있어야 한다');
});

test('도장 폴더 자체를 지우려 하면 거부한다', () => {
  const { baseDir } = makeDojo();
  assert.throws(() => removeWorkspace({ workspaceDir: baseDir, baseDir }), /범위가 아니다/);
  assert.equal(fs.existsSync(baseDir), true);
});

test('workspace가 아닌 폴더 이름은 거부한다', () => {
  const { baseDir } = makeDojo();
  const other = path.join(baseDir, 'content');
  fs.mkdirSync(other);

  assert.throws(() => removeWorkspace({ workspaceDir: other, baseDir }), /workspace 폴더가 아니다/);
  assert.equal(fs.existsSync(other), true, '엉뚱한 폴더가 지워지면 안 된다');
});

test('상위로 탈출하는 경로를 거부한다', () => {
  const { baseDir } = makeDojo();
  const escaped = path.join(baseDir, '..', 'workspace');
  assert.throws(() => removeWorkspace({ workspaceDir: escaped, baseDir }), /범위가 아니다/);
});

test('규모를 미리 잰다', () => {
  const { baseDir, workspaceDir } = makeDojo({
    'a.js': '12345',
    'sub/b.js': '123',
  });

  const size = measureWorkspace({ workspaceDir });
  assert.equal(size.exists, true);
  assert.equal(size.files, 2);
  assert.equal(size.bytes, 8);

  removeWorkspace({ workspaceDir, baseDir });
  assert.deepEqual(measureWorkspace({ workspaceDir }), { exists: false, files: 0, bytes: 0 });
});

// 이 프로젝트에서 제일 위험한 실패는 "지우다 만" 상태다.
// 코드 절반이 사라졌는데 진도가 온전히 남으면, 학습자는 하지 않은 일이 통과된 채로 이어 간다.
// 그래서 지우기가 막힐 때는 반드시 한 파일도 건드리지 않은 상태여야 한다.
test('지우다 막히면 파일이 하나도 사라지지 않는다', { skip: process.platform !== 'win32' && '핸들 잠금 재현은 Windows에서만 의미가 있다' }, () => {
  const { baseDir, workspaceDir } = makeDojo({
    'hello.mjs': "console.log('x')",
    'src/deep/nested.mjs': 'export default 1',
    '.git/HEAD': 'ref: refs/heads/main',
  });
  const before = measureWorkspace({ workspaceDir });
  const cwdBefore = process.cwd();

  // 어떤 프로세스가 workspace 안을 현재 폴더로 잡고 있는 상황 — 실제로 가장 흔한 실패 원인이다.
  process.chdir(path.join(workspaceDir, 'src'));
  try {
    const result = removeWorkspace({ workspaceDir, baseDir });

    assert.equal(result.removed, false, '막혔으면 지웠다고 보고하면 안 된다');
    assert.equal(fs.existsSync(workspaceDir), true, 'workspace 폴더가 그대로 있어야 한다');
    assert.deepEqual(
      measureWorkspace({ workspaceDir }),
      before,
      '막혔는데 파일이 줄었다 — 부분 삭제가 일어났다',
    );
    assert.equal(fs.readFileSync(path.join(workspaceDir, '.git', 'HEAD'), 'utf8'), 'ref: refs/heads/main');
  } finally {
    process.chdir(cwdBefore);
  }
});

test('옆으로 옮긴 뒤 지우므로 잔해가 남지 않는다', () => {
  const { baseDir, workspaceDir } = makeDojo({ 'hello.mjs': "console.log('x')" });

  const result = removeWorkspace({ workspaceDir, baseDir });

  assert.equal(result.removed, true);
  assert.equal(result.residuePath, undefined, '깨끗이 지워졌으면 잔해 경로를 보고하지 않는다');
  const leftovers = fs.readdirSync(baseDir).filter((name) => name.startsWith('workspace'));
  assert.deepEqual(leftovers, [], `옮겨 놓은 폴더가 남았다: ${leftovers.join(', ')}`);
});

test('막혔을 때 해결 방법을 알려 준다', () => {
  const busy = describeBlock({ reason: 'EBUSY', blockedPath: 'C:\\x\\workspace\\hello.mjs' });
  assert.match(busy, /EBUSY/);
  assert.match(busy, /hello\.mjs/);
  assert.match(busy, /node --watch/, '실행 중인 node를 끄라는 안내가 있어야 한다');

  const unknown = describeBlock({ reason: 'EACCES' });
  assert.match(unknown, /EACCES/);
});
