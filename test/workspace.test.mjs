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

test('막혔을 때 해결 방법을 알려 준다', () => {
  const busy = describeBlock({ reason: 'EBUSY', blockedPath: 'C:\\x\\workspace\\hello.mjs' });
  assert.match(busy, /EBUSY/);
  assert.match(busy, /hello\.mjs/);
  assert.match(busy, /node --watch/, '실행 중인 node를 끄라는 안내가 있어야 한다');

  const unknown = describeBlock({ reason: 'EACCES' });
  assert.match(unknown, /EACCES/);
});
