// 스텝 루프. 제시 → 학습자 작업 → 실제 검증 → 피드백의 순서를 지킨다.
import { completedStepsOf, renderPicker, renderStep } from './browse.mjs';
import { FAKE_REMOTE_DIR, HINT, ROOT, WORKSPACE_DIR } from './config.mjs';
import { hasAttempt, missingKeywords } from './explain.mjs';
import { runScenario } from './scenario.mjs';
import { presentationFor } from './fade.mjs';
import { recordExplanation, recordSetup, recordStepResult, scheduleCard } from './progress.mjs';
import { ask, waitForAction } from './prompt.mjs';
import { saveSnapshot } from './snapshot.mjs';
import { verifyStep } from './verify/index.mjs';
import * as ui from './ui.mjs';

/** 힌트는 충분히 헤맨 뒤에만 열린다. 즉답 힌트는 학습을 파괴한다. */
export function isHintUnlocked({ startedAt, failures, now = Date.now() }) {
  return failures >= HINT.unlockAfterFailures || now - startedAt >= HINT.unlockAfterMs;
}

/**
 * 챕터 하나를 끝까지 진행한다.
 * @returns {Promise<{progress:object, quit:boolean, stats:object}>}
 */
export async function runChapter(chapter, progress, context = {}) {
  const stats = { total: chapter.steps.length, passed: 0, skipped: 0, hintsUsed: 0 };
  let current = progress;

  ui.write(ui.chapterHeader(chapter, { completed: countCompleted(chapter, current), total: chapter.steps.length }));

  for (const [index, step] of chapter.steps.entries()) {
    if (current.completedSteps.includes(step.id)) {
      stats.passed += 1;
      continue;
    }

    const outcome = await runStep(step, current, {
      ...context,
      index: index + 1,
      total: chapter.steps.length,
    });

    current = outcome.progress;
    stats.hintsUsed += outcome.hintsUsed;
    if (outcome.status === 'passed') stats.passed += 1;
    if (outcome.status === 'skipped') stats.skipped += 1;
    if (outcome.status === 'quit') return { progress: current, quit: true, stats };
  }

  stats.bestStreak = current.bestStreak;
  ui.write(ui.chapterSummary(chapter, stats));
  return { progress: current, quit: false, stats };
}

async function runStep(step, progress, context) {
  const conceptState = progress.concepts[step.concept];
  const presentation = presentationFor(step, conceptState);

  ui.write(ui.stepHeader(step, { index: context.index, total: context.total, streak: progress.streak, level: presentation?.level }));

  progress = await applySetup(step, progress, context);
  ui.write(ui.teachBlock(step.teach));

  if (step.predict) await runPrediction(step.predict);
  if (presentation) ui.write(ui.codeBlock(presentation.body, presentation.level));
  if (step.boss) ui.write(ui.noteBox('보스 스테이지 — 힌트 없이 지금까지 배운 것만으로 해낸다.'));

  const startedAt = Date.now();
  let failures = 0;
  let hintsShown = 0;
  let attempts = 0;

  for (;;) {
    const hintsAvailable = !step.boss && Boolean(step.hints) && hintsShown < (step.hints?.length ?? 0);
    const action = await waitForAction({
      hintAvailable: hintsAvailable && isHintUnlocked({ startedAt, failures }),
    });

    if (action === 'quit') {
      return { status: 'quit', progress, hintsUsed: hintsShown };
    }

    if (action === 'skip') {
      ui.write(ui.noteBox('건너뛴다. 나중에 복습 카드로 다시 만난다.'));
      return { status: 'skipped', progress, hintsUsed: hintsShown };
    }

    if (action === 'save') {
      await saveManually(progress, step, context);
      continue;
    }

    if (action === 'browse') {
      await browsePastSteps(progress, context);
      continue;
    }

    if (action === 'hint') {
      if (!hintsAvailable) {
        ui.write(ui.noteBox('힌트가 더 없다. 지금까지 나온 단서로 한 번 더 시도한다.'));
        continue;
      }
      if (!isHintUnlocked({ startedAt, failures })) {
        ui.write(ui.noteBox('아직 잠겨 있다. 먼저 스스로 한 번 시도해 본다 — 실패한 시도가 다음 설명을 훨씬 잘 붙게 만든다.'));
        continue;
      }
      ui.write(ui.hintBox(step.hints[hintsShown], hintsShown + 1, step.hints.length));
      hintsShown += 1;
      continue;
    }

    attempts += 1;
    ui.write(ui.noteBox('검사 중…'));
    const result = await verifyStep(step, context);
    ui.write(ui.checkReport(result.results));

    const lastOutput = result.results.at(-1)?.output;
    if (lastOutput) ui.write(ui.commandOutput(lastOutput));

    if (result.passed) {
      ui.write(ui.passBox(`통과 — ${step.goal}`));
      let updated = recordStepResult(progress, {
        chapterId: context.chapterId ?? step.id.split('-')[0],
        stepId: step.id,
        concept: step.concept,
        passed: true,
        hintsUsed: hintsShown,
        attempts,
      });
      if (step.review_card) updated = scheduleCard(updated, step.id, true);
      if (step.explain) {
        const written = await collectSelfExplanation(step.explain);
        if (written) updated = recordExplanation(updated, step.id, written);
      }

      // 통과한 시점을 체크포인트로 남긴다. 언제든 이 지점으로 되돌아올 수 있다.
      checkpoint(updated, step, context);
      return { status: 'passed', progress: updated, hintsUsed: hintsShown };
    }

    failures += 1;
    ui.write(ui.failBox('아직이다. 위에 실패한 검사 하나만 먼저 해결한다.'));
    // 실패는 페이드 강등 판단에 쓰이므로 그때그때 기록한다.
    progress = recordStepResult(progress, {
      chapterId: context.chapterId ?? step.id.split('-')[0],
      stepId: step.id,
      concept: step.concept,
      passed: false,
      hintsUsed: hintsShown,
      attempts,
    });
  }
}

/**
 * 스텝이 요구하는 상황을 연출한다(동료의 push 같은 것).
 * 학습자 저장소를 건드리므로 무슨 일이 벌어졌는지 반드시 알리고, 스텝당 한 번만 적용한다.
 */
async function applySetup(step, progress, context) {
  if (!step.setup || progress.setups[step.id]) return progress;

  try {
    await runScenario(step.setup.scenario, {
      workspaceDir: context.workspaceDir ?? WORKSPACE_DIR,
      remoteDir: context.remoteDir ?? FAKE_REMOTE_DIR,
      baseDir: context.rootDir ?? ROOT,
    }, step.setup);
  } catch (error) {
    ui.write(ui.failBox(`상황을 준비하지 못했다: ${error.message}`));
    ui.write(ui.noteBox('이 스텝은 그 상황을 전제로 하므로, 원인을 해결한 뒤 다시 시도한다.'));
    return progress;
  }

  ui.write(ui.eventBox(step.setup.announce));
  return recordSetup(progress, step.id);
}

/** 지나온 스텝을 다시 읽는다. 코드도 진도도 건드리지 않고 제자리로 돌아온다. */
async function browsePastSteps(progress, context) {
  const entries = completedStepsOf(context.chapters ?? [], progress);
  ui.write(renderPicker(entries));
  if (entries.length === 0) return;

  const answer = await ask('  번호를 고른다 (그냥 Enter면 돌아가기):');
  const picked = entries[Number.parseInt(answer, 10) - 1];
  if (!picked) return;

  ui.write(renderStep(picked, true, progress));
  await ask('  Enter를 누르면 하던 곳으로 돌아간다.');
}

/** 스텝 통과 자동 체크포인트. 실패해도 학습을 막지 않는다. */
function checkpoint(progress, step, context) {
  try {
    saveSnapshot({
      progress,
      chapterId: context.chapterId ?? step.id.split('-')[0],
      stepId: step.id,
      kind: 'auto',
      dirs: context.dirs,
    });
    ui.write(ui.noteBox(`체크포인트 저장됨 — 되돌아오려면  npm run dojo -- --load auto-${step.id}`));
  } catch (error) {
    ui.write(ui.noteBox(`체크포인트를 저장하지 못했다 (학습은 계속된다): ${error.message}`));
  }
}

async function saveManually(progress, step, context) {
  const label = await ask('  이 저장에 붙일 이름 (그냥 Enter면 시각으로):');
  try {
    const meta = saveSnapshot({
      progress,
      chapterId: context.chapterId ?? step.id.split('-')[0],
      stepId: step.id,
      label,
      kind: 'manual',
      dirs: context.dirs,
    });
    ui.write(ui.passBox(`저장했다 — ${meta.id} (${meta.label})`));
  } catch (error) {
    ui.write(ui.failBox(`저장하지 못했다: ${error.message}`));
  }
}

async function runPrediction(predict) {
  ui.write(ui.noteBox(`먼저 예측해 본다 — ${predict.question}`));
  const guess = await ask('  예측:');
  const hit = guess !== '' && new RegExp(predict.answer_pattern, 'i').test(guess);

  ui.write(hit ? ui.passBox('예측이 맞았다') : ui.failBox('예측이 빗나갔다'));
  ui.write(ui.noteBox(predict.reveal));
  if (!hit && guess !== '') {
    ui.write(ui.noteBox('빗나간 예측을 방금 교정했다. 이 순간이 그냥 읽는 것보다 훨씬 오래 남는다.'));
  }
}

/**
 * 자기설명을 받고 모범답안과 대조한다. 통과 여부에는 영향을 주지 않는다.
 * @returns {Promise<string>} 학습자가 쓴 설명 (진도에 기록해 나중에 다시 볼 수 있게 한다)
 */
async function collectSelfExplanation(explain) {
  ui.write(ui.noteBox(explain.question));
  const answer = await ask('  설명:');

  if (!hasAttempt(answer)) {
    ui.write(ui.noteBox('건너뛴다. 다음엔 틀려도 좋으니 한 줄 적어 보는 편이 남는다.'));
    return '';
  }

  ui.write(ui.modelAnswer(explain.model_answer));

  const missing = missingKeywords(answer, explain.keywords);
  if (missing.length === 0) {
    ui.write(ui.passBox('짚어야 할 것을 모두 짚었다.'));
  } else {
    for (const keyword of missing) {
      ui.write(ui.noteBox(`· "${keyword.term}"는 언급되지 않았다 — ${keyword.nudge}`));
    }
  }

  return answer;
}

function countCompleted(chapter, progress) {
  return chapter.steps.filter((step) => progress.completedSteps.includes(step.id)).length;
}
