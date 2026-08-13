import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  deleteSnapshot,
  listSnapshots,
  makeSlotId,
  readSnapshot,
  restoreWorkspace,
  saveSnapshot,
} from '../dojo/snapshot.mjs';
import { emptyProgress, recordStepResult } from '../dojo/progress.mjs';

function makeDirs(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-save-'));
  const dirs = { savesDir: path.join(root, '.dojo', 'saves'), workspaceDir: path.join(root, 'workspace') };
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(dirs.workspaceDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }
  return dirs;
}

function progressAt(stepId) {
  return recordStepResult(emptyProgress(), {
    chapterId: 'ch01',
    stepId,
    concept: 'demo',
    passed: true,
  });
}

test('슬롯 id: 종류별로 규칙이 다르다', () => {
  assert.equal(makeSlotId({ kind: 'auto', stepId: 'ch01-s04' }), 'auto-ch01-s04');
  assert.equal(makeSlotId({ kind: 'preload' }), 'auto-preload');
  assert.match(makeSlotId({ kind: 'manual', now: new Date('2026-07-31T09:30:12Z') }), /^save-20260731-093012$/);
});

test('저장하면 진도와 코드가 함께 담긴다', () => {
  const dirs = makeDirs({ 'app/page.js': 'v1\n', 'package.json': '{}\n' });
  const meta = saveSnapshot({ progress: progressAt('ch01-s04'), chapterId: 'ch01', stepId: 'ch01-s04', kind: 'auto', dirs });

  assert.equal(meta.id, 'auto-ch01-s04');
  assert.equal(meta.hasWorkspace, true);
  assert.equal(meta.completedCount, 1);

  const slot = path.join(dirs.savesDir, 'auto-ch01-s04');
  assert.equal(fs.readFileSync(path.join(slot, 'workspace', 'app', 'page.js'), 'utf8'), 'v1\n');
  assert.deepEqual(readSnapshot('auto-ch01-s04', dirs).progress.completedSteps, ['ch01-s04']);
});

test('node_modules 같은 무거운 폴더는 담지 않는다', () => {
  const dirs = makeDirs({
    'app/page.js': 'v1\n',
    'node_modules/some-pkg/index.js': 'big\n',
    'dist/bundle.js': 'build\n',
    'app/node_modules/nested/x.js': 'nested\n',
  });
  saveSnapshot({ progress: emptyProgress(), kind: 'manual', dirs });

  const slot = path.join(dirs.savesDir, listSnapshots(dirs)[0].id, 'workspace');
  assert.ok(fs.existsSync(path.join(slot, 'app', 'page.js')));
  assert.equal(fs.existsSync(path.join(slot, 'node_modules')), false);
  assert.equal(fs.existsSync(path.join(slot, 'dist')), false);
  assert.equal(fs.existsSync(path.join(slot, 'app', 'node_modules')), false, '중첩된 것도 제외한다');
});

test('되돌리기: 코드가 그 시점으로 돌아간다', () => {
  const dirs = makeDirs({ 'app/page.js': 'v1\n' });
  saveSnapshot({ progress: progressAt('ch01-s04'), stepId: 'ch01-s04', kind: 'auto', dirs });

  fs.writeFileSync(path.join(dirs.workspaceDir, 'app', 'page.js'), 'v2 망가짐\n', 'utf8');
  fs.writeFileSync(path.join(dirs.workspaceDir, 'junk.js'), '나중에 만든 파일\n', 'utf8');

  assert.equal(restoreWorkspace('auto-ch01-s04', dirs).restored, true);
  assert.equal(fs.readFileSync(path.join(dirs.workspaceDir, 'app', 'page.js'), 'utf8'), 'v1\n');
  assert.equal(fs.existsSync(path.join(dirs.workspaceDir, 'junk.js')), false, '그 시점에 없던 파일은 사라진다');
});

test('되돌려도 node_modules는 지우지 않는다', () => {
  const dirs = makeDirs({ 'app/page.js': 'v1\n' });
  saveSnapshot({ progress: emptyProgress(), stepId: 'ch01-s04', kind: 'auto', dirs });

  fs.mkdirSync(path.join(dirs.workspaceDir, 'node_modules', 'react'), { recursive: true });
  fs.writeFileSync(path.join(dirs.workspaceDir, 'node_modules', 'react', 'index.js'), 'big\n', 'utf8');

  restoreWorkspace('auto-ch01-s04', dirs);
  assert.ok(
    fs.existsSync(path.join(dirs.workspaceDir, 'node_modules', 'react', 'index.js')),
    '재설치를 강요하지 않는다',
  );
});

test('git 이력도 함께 담기고 되돌아온다', () => {
  const dirs = makeDirs({ 'app/page.js': 'v1\n', '.git/HEAD': 'ref: refs/heads/main\n' });
  saveSnapshot({ progress: emptyProgress(), stepId: 'ch01-s08', kind: 'auto', dirs });

  fs.rmSync(path.join(dirs.workspaceDir, '.git'), { recursive: true, force: true });
  restoreWorkspace('auto-ch01-s08', dirs);

  assert.equal(fs.readFileSync(path.join(dirs.workspaceDir, '.git', 'HEAD'), 'utf8'), 'ref: refs/heads/main\n');
});

test('같은 자동 슬롯을 다시 저장하면 덮어쓴다', () => {
  const dirs = makeDirs({ 'a.txt': '1\n' });
  saveSnapshot({ progress: emptyProgress(), stepId: 'ch01-s04', kind: 'auto', dirs });

  fs.writeFileSync(path.join(dirs.workspaceDir, 'a.txt'), '2\n', 'utf8');
  saveSnapshot({ progress: emptyProgress(), stepId: 'ch01-s04', kind: 'auto', dirs });

  assert.equal(listSnapshots(dirs).length, 1, '스텝마다 슬롯 하나만 유지된다');
  const slot = path.join(dirs.savesDir, 'auto-ch01-s04', 'workspace', 'a.txt');
  assert.equal(fs.readFileSync(slot, 'utf8'), '2\n');
});

test('목록은 최신순이고 깨진 슬롯은 건너뛴다', () => {
  const dirs = makeDirs({ 'a.txt': '1\n' });
  saveSnapshot({ progress: emptyProgress(), stepId: 'ch01-s01', kind: 'auto', now: new Date('2026-07-31T01:00:00Z'), dirs });
  saveSnapshot({ progress: emptyProgress(), stepId: 'ch01-s02', kind: 'auto', now: new Date('2026-07-31T02:00:00Z'), dirs });

  fs.mkdirSync(path.join(dirs.savesDir, 'broken-slot'), { recursive: true });

  const slots = listSnapshots(dirs);
  assert.deepEqual(slots.map((s) => s.id), ['auto-ch01-s02', 'auto-ch01-s01']);
});

test('workspace가 아직 없어도 저장된다', () => {
  const dirs = makeDirs();
  const meta = saveSnapshot({ progress: emptyProgress(), kind: 'manual', dirs });
  assert.equal(meta.hasWorkspace, false);
  assert.equal(restoreWorkspace(meta.id, dirs).restored, false);
});

test('슬롯 이름으로 경로를 벗어날 수 없다', () => {
  const dirs = makeDirs({ 'a.txt': '1\n' });
  for (const evil of ['../escape', '..\\escape', '/etc/passwd', 'a/b']) {
    assert.throws(() => readSnapshot(evil, dirs), /쓸 수 없는 슬롯 이름|범위를 벗어난다/);
  }
});

test('없는 슬롯을 읽으면 명확히 실패한다', () => {
  const dirs = makeDirs();
  assert.throws(() => readSnapshot('auto-ch01-s99', dirs), /그런 세이브가 없다/);
});

test('삭제하면 목록에서 사라진다', () => {
  const dirs = makeDirs({ 'a.txt': '1\n' });
  saveSnapshot({ progress: emptyProgress(), stepId: 'ch01-s01', kind: 'auto', dirs });
  deleteSnapshot('auto-ch01-s01', dirs);
  assert.equal(listSnapshots(dirs).length, 0);
});

test('수동 슬롯은 상한을 넘으면 오래된 것부터 정리된다', () => {
  const dirs = makeDirs({ 'a.txt': '1\n' });
  for (let i = 0; i < 23; i += 1) {
    const now = new Date(Date.UTC(2026, 6, 31, 0, 0, i));
    saveSnapshot({ progress: emptyProgress(), kind: 'manual', now, dirs });
  }
  const manual = listSnapshots(dirs).filter((s) => s.kind === 'manual');
  assert.equal(manual.length, 20);
  assert.equal(manual.at(-1).createdAt, new Date(Date.UTC(2026, 6, 31, 0, 0, 3)).toISOString());
});
