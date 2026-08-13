import test from 'node:test';
import assert from 'node:assert/strict';
import { isHintUnlocked } from '../dojo/runner.mjs';
import { gradeCard } from '../dojo/review.mjs';
import { HINT } from '../dojo/config.mjs';

test('힌트: 시도도 시간도 없이는 열리지 않는다', () => {
  const startedAt = 1_000_000;
  assert.equal(isHintUnlocked({ startedAt, failures: 0, now: startedAt + 1_000 }), false);
});

test('힌트: 한 번 실패하면 바로 열린다', () => {
  const startedAt = 1_000_000;
  assert.equal(isHintUnlocked({ startedAt, failures: 1, now: startedAt + 1_000 }), true);
});

test('힌트: 충분히 헤매면 실패 없이도 열린다', () => {
  const startedAt = 1_000_000;
  assert.equal(isHintUnlocked({ startedAt, failures: 0, now: startedAt + HINT.unlockAfterMs }), true);
});

test('복습 채점: 정규식이 있으면 그것으로 판정한다', () => {
  const card = { front: '상태 훅은?', back: 'useState', answer_pattern: 'usestate' };
  assert.equal(gradeCard(card, 'useState'), true);
  assert.equal(gradeCard(card, 'USESTATE'), true);
  assert.equal(gradeCard(card, 'useEffect'), false);
});

test('복습 채점: 빈 답은 통과가 아니다', () => {
  assert.equal(gradeCard({ back: 'useState' }, '   '), false);
});

test('복습 채점: 정규식이 없으면 핵심어 포함으로 느슨하게 본다', () => {
  const card = { back: 'useState' };
  assert.equal(gradeCard(card, '  use state  '), true, '공백 차이는 무시한다');
  assert.equal(gradeCard(card, 'useState 훅을 쓴다'), true);
  assert.equal(gradeCard(card, 'props'), false);
});
