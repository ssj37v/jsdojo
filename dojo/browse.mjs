// 지난 스텝 열람. 읽기만 한다 — 코드도 진도도 건드리지 않는다.
//
// 되돌리기(snapshot.mjs)와 목적이 다르다. 저 쪽은 "그 시점으로 돌아가기",
// 이 쪽은 "지금 상태를 유지한 채 지난 설명을 다시 보기"다.
import { style, indent } from './ui.mjs';

const RULE = '─'.repeat(64);

export function findStep(chapters, stepId) {
  for (const chapter of chapters) {
    const step = chapter.steps.find((candidate) => candidate.id === stepId);
    if (step) return { chapter, step, index: chapter.steps.indexOf(step) + 1 };
  }
  return null;
}

/** 통과한 스텝만 내용을 연다. 아직 안 푼 스텝의 정답을 미리 보면 학습이 무너진다. */
export function isRevealed(step, progress) {
  return progress.completedSteps.includes(step.id);
}

export function renderOutline(chapters, progress, chapterId = null) {
  const targets = chapterId ? chapters.filter((chapter) => chapter.id === chapterId) : chapters;
  if (targets.length === 0) return `\n${style.red(`  그런 챕터가 없다: ${chapterId}`)}\n`;

  const blocks = targets.map((chapter) => {
    const rows = chapter.steps.map((step, index) => {
      const done = progress.completedSteps.includes(step.id);
      const mark = done ? style.green('✔') : style.dim('·');
      const number = String(index + 1).padStart(2, ' ');
      const id = done ? style.bold(step.id) : style.dim(step.id);
      const tail = done ? style.dim(step.concept) : style.dim('(아직 잠김)');
      return `   ${mark} ${number}. ${id}  ${step.goal}  ${tail}`;
    });

    const done = chapter.steps.filter((step) => progress.completedSteps.includes(step.id)).length;
    return [
      `\n${style.bold(chapter.title)}  ${style.dim(`${done}/${chapter.steps.length}`)}`,
      style.dim(RULE),
      rows.join('\n'),
    ].join('\n');
  });

  return `${blocks.join('\n')}\n\n${style.dim('  자세히 보기:  npm run dojo -- --show <스텝id>')}\n`;
}

/**
 * 스텝 하나를 펼쳐 보여준다.
 * @param {boolean} revealed 통과한 스텝인가 (아니면 목표까지만 보여준다)
 * @param {object} [progress] 있으면 그때 학습자가 쓴 자기설명을 함께 보여준다
 */
export function renderStep({ chapter, step, index }, revealed, progress = null) {
  const lines = [
    '',
    style.blue(RULE),
    `${style.bold(`${chapter.title} · STEP ${index}/${chapter.steps.length}`)}  ${style.dim(step.id)}`,
    `${style.dim('개념')}  ${step.concept}`,
    `${style.dim('목표')}  ${step.goal}`,
    style.blue(RULE),
  ];

  if (!revealed) {
    lines.push(
      '',
      style.dim('  아직 통과하지 않은 스텝이라 내용이 잠겨 있다.'),
      style.dim('  먼저 직접 부딪혀 본 뒤에 읽어야 남는다.'),
      '',
    );
    return lines.join('\n');
  }

  lines.push('', indent(step.teach.trim(), '  '), '');

  if (step.predict) {
    lines.push(style.dim('  ── 예측 질문 ──'), indent(step.predict.question, '    '), '');
    lines.push(indent(style.dim(step.predict.reveal.trim()), '    '), '');
  }

  if (step.fade) {
    lines.push(style.dim('  ── 3단 제시 ──'));
    for (const [level, label] of [['copy', '따라치기'], ['fill', '빈칸'], ['recall', '백지']]) {
      lines.push(`    ${style.dim(label)}`, indent(style.cyan(step.fade[level].trimEnd()), '      '), '');
    }
  }

  if (step.hints) {
    lines.push(style.dim('  ── 힌트 ──'));
    step.hints.forEach((hint, order) => lines.push(`    ${style.dim(`${order + 1}.`)} ${hint}`));
    lines.push('');
  }

  lines.push(style.dim('  ── 통과 조건 ──'));
  for (const check of step.verify) lines.push(`    ${style.dim('·')} ${check.label}`);

  if (step.explain) {
    lines.push('', style.dim('  ── 자기설명 ──'), `    ${step.explain.question}`);
    const written = progress?.explanations?.[step.id];
    if (written) {
      lines.push(`    ${style.dim('그때 내가 쓴 것:')} ${written.answer}`);
    }
    lines.push(`    ${style.dim('모범 답안:')} ${step.explain.model_answer.trim().replace(/\n/g, ' ')}`);
  }

  if (step.review_card) {
    lines.push('', style.dim('  ── 복습 카드 ──'));
    lines.push(`    Q. ${step.review_card.front}`);
    lines.push(`    A. ${style.cyan(step.review_card.back)}`);
  }

  lines.push('');
  return lines.join('\n');
}

/** 학습 중 열람용 — 지금까지 통과한 스텝 목록. */
export function completedStepsOf(chapters, progress) {
  const found = [];
  for (const chapter of chapters) {
    for (const [index, step] of chapter.steps.entries()) {
      if (progress.completedSteps.includes(step.id)) found.push({ chapter, step, index: index + 1 });
    }
  }
  return found;
}

export function renderPicker(entries) {
  if (entries.length === 0) {
    return `\n${style.dim('  아직 통과한 스텝이 없다. 하나 끝내고 나면 여기서 다시 볼 수 있다.')}\n`;
  }
  const rows = entries.map(
    (entry, order) => `    ${style.bold(String(order + 1).padStart(2, ' '))}. ${entry.step.id}  ${entry.step.goal}`,
  );
  return `\n${style.bold('  지나온 스텝')}\n${rows.join('\n')}\n`;
}
