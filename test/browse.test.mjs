import test from 'node:test';
import assert from 'node:assert/strict';
import {
  completedStepsOf,
  findStep,
  isRevealed,
  renderOutline,
  renderPicker,
  renderStep,
} from '../dojo/browse.mjs';
import { emptyProgress } from '../dojo/progress.mjs';

const CHAPTERS = [
  {
    id: 'ch01',
    title: '1장',
    steps: [
      {
        id: 'ch01-s01',
        concept: 'npm-basics',
        goal: 'npm을 확인한다',
        teach: 'npm은 패키지 관리자다.',
        hints: ['관찰', '위치', 'npm -v 를 친다'],
        fade: { copy: 'npm -v', fill: '____ -v', recall: '버전을 확인한다' },
        verify: [{ type: 'cmd', label: 'npm이 있다', run: ['npm', '-v'] }],
        review_card: { front: '패키지 관리자는?', back: 'npm' },
      },
      {
        id: 'ch01-s02',
        concept: 'secret-answer',
        goal: '아직 안 푼 스텝',
        teach: '여기에는 아직 보면 안 되는 설명이 있다.',
        hints: ['힌트하나', '힌트둘', 'SPOILER_ANSWER_CODE'],
        fade: { copy: 'SPOILER_ANSWER_CODE', fill: '____', recall: '해내라' },
        verify: [{ type: 'fs', label: '파일이 있다', path: 'a.js' }],
      },
    ],
  },
];

function progressWith(completed) {
  return { ...emptyProgress(), completedSteps: completed };
}

test('스텝을 id로 찾는다', () => {
  const found = findStep(CHAPTERS, 'ch01-s02');
  assert.equal(found.step.concept, 'secret-answer');
  assert.equal(found.index, 2);
  assert.equal(findStep(CHAPTERS, 'ch99-s01'), null);
});

test('통과한 스텝만 열린다', () => {
  const progress = progressWith(['ch01-s01']);
  assert.equal(isRevealed(CHAPTERS[0].steps[0], progress), true);
  assert.equal(isRevealed(CHAPTERS[0].steps[1], progress), false);
});

test('목차는 통과 여부를 구분하고 안 푼 스텝의 개념을 감춘다', () => {
  const outline = renderOutline(CHAPTERS, progressWith(['ch01-s01']));
  assert.match(outline, /ch01-s01/);
  assert.match(outline, /npm-basics/);
  assert.match(outline, /아직 잠김/);
  assert.doesNotMatch(outline, /secret-answer/, '안 푼 스텝의 개념까지 흘리지 않는다');
});

test('목차: 없는 챕터를 요구하면 알려준다', () => {
  assert.match(renderOutline(CHAPTERS, emptyProgress(), 'ch99'), /그런 챕터가 없다/);
});

test('열람: 통과한 스텝은 설명·힌트·정답·복습카드를 모두 보여준다', () => {
  const view = renderStep(findStep(CHAPTERS, 'ch01-s01'), true);
  assert.match(view, /npm은 패키지 관리자다/);
  assert.match(view, /npm -v 를 친다/);
  assert.match(view, /따라치기/);
  assert.match(view, /패키지 관리자는\?/);
  assert.match(view, /통과 조건/);
});

test('스포일러 회귀: 통과하지 않은 스텝의 정답과 힌트는 새어 나가지 않는다', () => {
  const view = renderStep(findStep(CHAPTERS, 'ch01-s02'), false);

  assert.match(view, /아직 안 푼 스텝/, '목표는 보여준다');
  assert.match(view, /잠겨 있다/);
  assert.doesNotMatch(view, /SPOILER_ANSWER_CODE/, '정답 코드가 보이면 안 된다');
  assert.doesNotMatch(view, /힌트하나/, '힌트가 보이면 안 된다');
  assert.doesNotMatch(view, /보면 안 되는 설명/, '설명도 아직 보여주지 않는다');
});

test('열람 목록은 통과한 스텝만 담는다', () => {
  const entries = completedStepsOf(CHAPTERS, progressWith(['ch01-s01']));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].step.id, 'ch01-s01');
  assert.match(renderPicker(entries), /ch01-s01/);
  assert.match(renderPicker([]), /아직 통과한 스텝이 없다/);
});
