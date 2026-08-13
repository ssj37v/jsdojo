// 3단 페이드 상태기계. 같은 개념이 재등장할 때마다 지원(worked example)을 한 단계씩 걷는다.
// copy(전체 코드) → fill(빈칸) → recall(목표만). 연속 실패는 학습자를 좌절 구간에 두지 않도록 되돌린다.
import { FADE } from './config.mjs';

export const LEVELS = FADE.levels;

export function initialConceptState() {
  return { level: LEVELS[0], successStreak: 0, failStreak: 0, seen: 0 };
}

/** 이번 등장에서 학습자에게 보여줄 지원 수준. */
export function levelFor(conceptState) {
  return conceptState?.level ?? LEVELS[0];
}

/**
 * 스텝 결과를 반영한 다음 개념 상태를 돌려준다(입력을 변형하지 않는다).
 * @param {object} state initialConceptState 형태
 * @param {boolean} passed 이 등장에서 통과했는가
 */
export function applyOutcome(state, passed) {
  const current = { ...initialConceptState(), ...state };
  const index = Math.max(0, LEVELS.indexOf(current.level));

  if (passed) {
    const successStreak = current.successStreak + 1;
    const promote = successStreak >= FADE.promoteAfterSuccesses && index < LEVELS.length - 1;
    return {
      level: promote ? LEVELS[index + 1] : current.level,
      successStreak: promote ? 0 : successStreak,
      failStreak: 0,
      seen: current.seen + 1,
    };
  }

  const failStreak = current.failStreak + 1;
  const demote = failStreak >= FADE.demoteAfterFailures && index > 0;
  return {
    level: demote ? LEVELS[index - 1] : current.level,
    successStreak: 0,
    failStreak: demote ? 0 : failStreak,
    seen: current.seen + 1,
  };
}

/**
 * 이번에 제시할 본문을 고른다. fade 블록이 없는 스텝(명령 실행형)은 null을 돌려준다.
 * 보스 스텝은 지원 없이 항상 recall로 낸다.
 */
export function presentationFor(step, conceptState) {
  if (!step.fade) return null;
  const level = step.boss ? 'recall' : levelFor(conceptState);
  return { level, body: step.fade[level] };
}
