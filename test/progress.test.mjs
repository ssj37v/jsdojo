import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyOutcome, initialConceptState, presentationFor } from '../dojo/fade.mjs';
import {
  dueCards,
  emptyProgress,
  loadProgress,
  recordStepResult,
  saveProgress,
  scheduleCard,
} from '../dojo/progress.mjs';

function tempFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-progress-')), 'progress.json');
}

test('페이드: 성공할 때마다 지원이 한 단계씩 걷힌다', () => {
  let state = initialConceptState();
  assert.equal(state.level, 'copy');

  state = applyOutcome(state, true);
  assert.equal(state.level, 'fill');

  state = applyOutcome(state, true);
  assert.equal(state.level, 'recall');

  state = applyOutcome(state, true);
  assert.equal(state.level, 'recall', '최상단에서 더 올라가지 않는다');
  assert.equal(state.seen, 3);
});

test('페이드: 연속 2회 실패하면 한 단계 되돌린다', () => {
  let state = { level: 'recall', successStreak: 0, failStreak: 0, seen: 2 };

  state = applyOutcome(state, false);
  assert.equal(state.level, 'recall', '한 번 실패로는 내리지 않는다');

  state = applyOutcome(state, false);
  assert.equal(state.level, 'fill');
  assert.equal(state.failStreak, 0, '강등 후 실패 카운터를 리셋한다');
});

test('페이드: copy에서는 더 내려가지 않는다', () => {
  let state = initialConceptState();
  state = applyOutcome(state, false);
  state = applyOutcome(state, false);
  state = applyOutcome(state, false);
  assert.equal(state.level, 'copy');
});

test('페이드: 성공이 실패 누적을 씻어낸다', () => {
  let state = { level: 'recall', successStreak: 0, failStreak: 1, seen: 1 };
  state = applyOutcome(state, true);
  assert.equal(state.failStreak, 0);
});

test('페이드: 보스 스텝은 숙련도와 무관하게 recall로 낸다', () => {
  const step = { boss: true, fade: { copy: 'C', fill: 'F', recall: 'R' } };
  assert.equal(presentationFor(step, { level: 'copy' }).body, 'R');

  const normal = { fade: { copy: 'C', fill: 'F', recall: 'R' } };
  assert.equal(presentationFor(normal, { level: 'copy' }).body, 'C');
  assert.equal(presentationFor({ verify: [] }, undefined), null);
});

test('진도: 저장하고 다시 읽으면 이어진다', () => {
  const file = tempFile();
  let progress = emptyProgress();
  progress = recordStepResult(progress, {
    chapterId: 'ch01',
    stepId: 'ch01-s01',
    concept: 'npm-basics',
    passed: true,
  });
  saveProgress(progress, file);

  const { progress: reloaded, recovered } = loadProgress(file);
  assert.equal(recovered, null);
  assert.equal(reloaded.cursor.stepId, 'ch01-s01');
  assert.deepEqual(reloaded.completedSteps, ['ch01-s01']);
  assert.equal(reloaded.concepts['npm-basics'].level, 'fill');
});

test('진도: 손상된 파일은 지우지 않고 백업한다', () => {
  const file = tempFile();
  fs.writeFileSync(file, '{ 이건 JSON이 아니다', 'utf8');

  const { progress, recovered } = loadProgress(file);
  assert.notEqual(recovered, null);
  assert.equal(progress.completedSteps.length, 0);

  const backups = fs.readdirSync(path.dirname(file)).filter((n) => n.includes('.corrupt-'));
  assert.equal(backups.length, 1, '손상된 진도는 백업되어야 한다');
});

test('진도: 스트릭은 성공에 늘고 실패에 끊긴다', () => {
  let progress = emptyProgress();
  const step = { chapterId: 'ch01', stepId: 'ch01-s01', concept: 'a', passed: true };

  progress = recordStepResult(progress, step);
  progress = recordStepResult(progress, { ...step, stepId: 'ch01-s02', concept: 'b' });
  assert.equal(progress.streak, 2);
  assert.equal(progress.bestStreak, 2);

  progress = recordStepResult(progress, { ...step, stepId: 'ch01-s03', concept: 'c', passed: false });
  assert.equal(progress.streak, 0);
  assert.equal(progress.bestStreak, 2, '최고 기록은 유지된다');
});

test('진도: 실패한 스텝은 완료 목록에 들어가지 않는다', () => {
  let progress = emptyProgress();
  progress = recordStepResult(progress, {
    chapterId: 'ch01',
    stepId: 'ch01-s01',
    concept: 'a',
    passed: false,
  });
  assert.deepEqual(progress.completedSteps, []);
});

test('간격 반복: 성공하면 간격이 늘고 실패하면 즉시 재출제한다', () => {
  const now = new Date('2026-07-30T00:00:00Z');
  let progress = emptyProgress();

  progress = scheduleCard(progress, 'ch01-s01', true, now);
  const first = new Date(progress.cards['ch01-s01'].nextReviewAt);
  assert.equal((first - now) / 86_400_000, 1);

  progress = scheduleCard(progress, 'ch01-s01', true, first);
  const second = new Date(progress.cards['ch01-s01'].nextReviewAt);
  assert.equal((second - first) / 86_400_000, 3);

  progress = scheduleCard(progress, 'ch01-s01', false, second);
  assert.equal(progress.cards['ch01-s01'].reps, 0);
  assert.equal(new Date(progress.cards['ch01-s01'].nextReviewAt).getTime(), second.getTime());
});

test('간격 반복: 만기 카드만, 아직 배우지 않은 카드는 빼고 고른다', () => {
  const now = new Date('2026-07-30T00:00:00Z');
  const cards = [{ id: 'ch01-s01' }, { id: 'ch01-s02' }, { id: 'ch01-s03' }];

  let progress = emptyProgress();
  progress.completedSteps = ['ch01-s01', 'ch01-s02'];
  progress = scheduleCard(progress, 'ch01-s01', true, new Date('2026-07-20T00:00:00Z')); // 이미 만기
  progress = scheduleCard(progress, 'ch01-s02', true, now); // 내일 만기

  const due = dueCards(progress, cards, { now, limit: 5 });
  assert.deepEqual(due.map((c) => c.id), ['ch01-s01'], '아직 안 배운 s03과 미래 만기인 s02는 제외');
});
