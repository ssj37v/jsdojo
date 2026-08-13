// 워밍업 인출 세션. 재읽기가 아니라 "떠올리기"로 챕터를 시작한다.
import { dueCards, scheduleCard } from './progress.mjs';
import { WARMUP_CARD_COUNT } from './config.mjs';
import { ask } from './prompt.mjs';
import { cardFront, noteBox, passBox, style, write } from './ui.mjs';

/**
 * 만기된 인출 카드를 출제하고 채점 결과를 진도에 반영한다.
 * @returns {Promise<object>} 갱신된 진도
 */
export async function runWarmup(progress, allCards, { now = new Date(), limit = WARMUP_CARD_COUNT } = {}) {
  const due = dueCards(progress, allCards, { now, limit });
  if (due.length === 0) return progress;

  write(`\n${style.bold('  워밍업 — 지난 것부터 떠올린다')}`);
  write(style.dim('  보기 전에 먼저 답해 본다. 떠올리는 행위 자체가 기억을 굳힌다.'));

  let updated = progress;
  for (const [index, card] of due.entries()) {
    write(cardFront(card, index + 1, due.length));
    const answer = await ask('  답:');

    const passed = gradeCard(card, answer);
    write(passed ? passBox('맞다') : noteBox(`정답: ${card.back}`));
    if (!passed && answer) write(noteBox('틀린 것을 방금 정면으로 봤다. 이런 교정이 가장 오래 남는다.'));

    updated = scheduleCard(updated, card.id, passed, now);
  }

  return updated;
}

/** 정규식이 있으면 자동 채점, 없으면 핵심어 포함 여부로 느슨하게 본다. */
export function gradeCard(card, answer) {
  const normalized = answer.trim();
  if (normalized === '') return false;
  if (card.answer_pattern) return new RegExp(card.answer_pattern, 'i').test(normalized);
  return normalize(normalized).includes(normalize(card.back)) || normalize(card.back).includes(normalize(normalized));
}

function normalize(text) {
  return text.toLowerCase().replace(/\s+/g, '');
}
