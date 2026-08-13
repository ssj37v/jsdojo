// 학습 진도 영속. 학습자가 쌓은 기록은 잃으면 안 되므로 원자적 쓰기만 한다(R02).
import fs from 'node:fs';
import path from 'node:path';
import { DOJO_DIR, PROGRESS_FILE, SRS_INTERVAL_DAYS } from './config.mjs';
import { applyOutcome, initialConceptState } from './fade.mjs';

const SCHEMA_VERSION = 1;
const STEP_LOG_LIMIT = 500;
const DAY_MS = 86_400_000;

export function emptyProgress() {
  return {
    version: SCHEMA_VERSION,
    startedAt: new Date().toISOString(),
    cursor: { chapterId: null, stepId: null },
    completedSteps: [],
    streak: 0,
    bestStreak: 0,
    concepts: {},
    cards: {},
    explanations: {},
    setups: {},
    stepLog: [],
  };
}

/**
 * 연출된 상황을 적용했다고 표시한다.
 * 같은 스텝을 다시 밟아도 동료 커밋이 두 번 쌓이지 않게 하는 표식이다.
 * 세이브를 되돌리면 이 기록도 함께 돌아가므로 그때는 다시 연출된다.
 */
export function recordSetup(progress, stepId, now = new Date()) {
  return {
    ...progress,
    setups: { ...progress.setups, [stepId]: { at: now.toISOString() } },
  };
}

/**
 * 학습자가 쓴 자기설명을 남긴다. 나중에 그 스텝을 다시 볼 때 모범답안과 나란히 놓기 위해서다.
 * 통과 판정과는 무관하다.
 */
export function recordExplanation(progress, stepId, answer, now = new Date()) {
  return {
    ...progress,
    explanations: {
      ...progress.explanations,
      [stepId]: { answer, at: now.toISOString() },
    },
  };
}

/**
 * 진도를 읽는다. 손상된 파일은 지우지 않고 백업한 뒤 새로 시작한다.
 * @returns {{progress:object, recovered:string|null}}
 */
export function loadProgress(file = PROGRESS_FILE) {
  if (!fs.existsSync(file)) return { progress: emptyProgress(), recovered: null };

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed?.version !== SCHEMA_VERSION) throw new Error(`알 수 없는 진도 버전: ${parsed?.version}`);
    return { progress: { ...emptyProgress(), ...parsed }, recovered: null };
  } catch (error) {
    const backup = `${file}.corrupt-${Date.now()}`;
    fs.renameSync(file, backup);
    return { progress: emptyProgress(), recovered: `${backup} (${error.message})` };
  }
}

export function saveProgress(progress, file = PROGRESS_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(progress, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
  return file;
}

/** 스텝 결과를 반영한 새 진도를 돌려준다(입력을 변형하지 않는다). */
export function recordStepResult(progress, outcome) {
  const { chapterId, stepId, concept, passed, hintsUsed = 0, attempts = 1, now = new Date() } = outcome;

  const conceptState = applyOutcome(progress.concepts[concept] ?? initialConceptState(), passed);
  const streak = passed ? progress.streak + 1 : 0;
  const completedSteps = passed && !progress.completedSteps.includes(stepId)
    ? [...progress.completedSteps, stepId]
    : progress.completedSteps;

  const entry = {
    stepId,
    chapterId,
    concept,
    passed,
    attempts,
    hintsUsed,
    at: now.toISOString(),
  };

  return {
    ...progress,
    cursor: { chapterId, stepId },
    completedSteps,
    streak,
    bestStreak: Math.max(progress.bestStreak, streak),
    concepts: { ...progress.concepts, [concept]: conceptState },
    stepLog: [...progress.stepLog, entry].slice(-STEP_LOG_LIMIT),
  };
}

/** 인출 카드의 다음 복습 시점을 갱신한 새 진도를 돌려준다. */
export function scheduleCard(progress, cardId, passed, now = new Date()) {
  const previous = progress.cards[cardId] ?? { reps: 0 };
  const reps = passed ? previous.reps + 1 : 0;
  // reps 1회차 → 첫 간격(1일), 2회차 → 3일 … 인출에 성공할수록 간격이 벌어진다.
  const intervalDays = SRS_INTERVAL_DAYS[Math.min(reps - 1, SRS_INTERVAL_DAYS.length - 1)];
  // 틀린 카드는 첫 간격을 기다리지 않고 같은 세션 안에서 다시 만난다.
  const dueAt = passed ? new Date(now.getTime() + intervalDays * DAY_MS) : now;

  return {
    ...progress,
    cards: {
      ...progress.cards,
      [cardId]: { reps, lastResult: passed ? 'pass' : 'fail', nextReviewAt: dueAt.toISOString() },
    },
  };
}

/**
 * 지금 복습해야 할 카드를 고른다.
 * 한 번도 안 본 카드는 해당 스텝을 이미 통과한 경우에만 대상이 된다(선행 학습 금지).
 */
export function dueCards(progress, allCards, { now = new Date(), limit = 3 } = {}) {
  const due = allCards.filter((card) => {
    const record = progress.cards[card.id];
    if (!record) return progress.completedSteps.includes(card.id);
    return new Date(record.nextReviewAt) <= now;
  });

  // 오래 밀린 것부터. 새 카드는 뒤로 미룬다.
  due.sort((a, b) => dueTime(progress, a) - dueTime(progress, b));
  return due.slice(0, limit);
}

function dueTime(progress, card) {
  const record = progress.cards[card.id];
  return record ? new Date(record.nextReviewAt).getTime() : Number.MAX_SAFE_INTEGER;
}

export function progressFilePath(dir = DOJO_DIR) {
  return path.join(dir, 'progress.json');
}
