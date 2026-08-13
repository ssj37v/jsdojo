import test from 'node:test';
import assert from 'node:assert/strict';
import { hasAttempt, missingKeywords } from '../dojo/explain.mjs';
import { emptyProgress, recordExplanation } from '../dojo/progress.mjs';
import { findStep, renderStep } from '../dojo/browse.mjs';

const KEYWORDS = [
  { term: '개발 서버', nudge: '누가 감지하는지 본다' },
  { term: '감지', nudge: '저장을 누가 알아채는가' },
];

test('언급하지 않은 핵심어만 짚는다', () => {
  const answer = '개발 서버가 파일 변경을 감지해서 바꿔준다';
  assert.deepEqual(missingKeywords(answer, KEYWORDS), []);
});

test('빠진 핵심어를 찾아낸다', () => {
  const missing = missingKeywords('리액트가 알아서 다시 그려줘서', KEYWORDS);
  assert.deepEqual(missing.map((k) => k.term), ['개발 서버', '감지']);
});

test('공백 차이는 무시한다', () => {
  assert.deepEqual(missingKeywords('개발서버가 감지한다', KEYWORDS), []);
});

test('빈 답은 전부 빠진 것으로 본다', () => {
  assert.equal(missingKeywords('   ', KEYWORDS).length, 2);
  assert.equal(hasAttempt('   '), false);
  assert.equal(hasAttempt('무언가 썼다'), true);
});

test('핵심어가 없는 스텝은 짚을 것도 없다', () => {
  assert.deepEqual(missingKeywords('아무 말', undefined), []);
});

test('자기설명은 진도에 기록된다', () => {
  const progress = recordExplanation(emptyProgress(), 'ch01-s04', '개발 서버가 감지한다');
  assert.equal(progress.explanations['ch01-s04'].answer, '개발 서버가 감지한다');
  assert.ok(progress.explanations['ch01-s04'].at);
});

test('열람할 때 내가 쓴 설명과 모범답안이 함께 보인다', () => {
  const chapters = [
    {
      id: 'ch01',
      title: '1장',
      steps: [
        {
          id: 'ch01-s04',
          concept: 'jsx-edit',
          goal: '제목을 바꾼다',
          teach: '설명',
          verify: [{ type: 'fs', label: 'x', path: 'a.js' }],
          explain: { question: '왜 바뀌었나?', model_answer: '개발 서버가 감지해 갈아끼운다' },
        },
      ],
    },
  ];
  let progress = { ...emptyProgress(), completedSteps: ['ch01-s04'] };
  progress = recordExplanation(progress, 'ch01-s04', '리액트가 알아서');

  const view = renderStep(findStep(chapters, 'ch01-s04'), true, progress);
  assert.match(view, /그때 내가 쓴 것.*리액트가 알아서/);
  assert.match(view, /모범 답안.*개발 서버가 감지해 갈아끼운다/);
});

test('실제 콘텐츠의 모범답안은 힌트를 그대로 베끼지 않는다', async () => {
  const { loadChapters } = await import('../dojo/content-loader.mjs');
  for (const chapter of loadChapters()) {
    for (const step of chapter.steps) {
      if (!step.explain) continue;
      assert.ok(step.explain.model_answer.trim().length > 20, `${step.id}: 모범답안이 너무 짧다`);
      for (const keyword of step.explain.keywords ?? []) {
        assert.ok(keyword.nudge.trim().length > 0, `${step.id}: nudge가 비었다`);
      }
    }
  }
});
