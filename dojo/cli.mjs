// 진입점. 인자 해석과 세션 조립만 한다. 판정·파일 조작은 하위 모듈에 맡긴다.
import fs from 'node:fs';
import { FAKE_REMOTE_DIR, PRELOAD_SLOT_ID, PROGRESS_FILE, ROOT, WORKSPACE_DIR } from './config.mjs';
import { describeBlock, measureWorkspace, removeWorkspace } from './workspace.mjs';
import { findStep, isRevealed, renderOutline, renderStep } from './browse.mjs';
import { collectReviewCards, loadChapters } from './content-loader.mjs';
import { loadProgress, saveProgress } from './progress.mjs';
import { closePrompt, confirm } from './prompt.mjs';
import { runWarmup } from './review.mjs';
import { runChapter } from './runner.mjs';
import { listSnapshots, readSnapshot, restoreWorkspace, saveSnapshot } from './snapshot.mjs';
import * as ui from './ui.mjs';

const USAGE = `
사용법: npm run dojo [-- 옵션]

  (옵션 없음)          이어서 학습한다
  --chapter <id>       특정 챕터로 간다 (예: --chapter ch01)
  --status             진도만 보고 끝낸다

  --outline [챕터id]   스텝 목차를 본다
  --show <스텝id>      지난 스텝을 다시 읽는다 (코드는 그대로 둔다)

  --saves              저장된 지점 목록
  --save [이름]        지금 상태를 저장한다 (진도 + workspace 코드)
  --load <이름>        저장된 지점으로 되돌아간다

  --reset              진도를 초기화한다 (workspace 폴더는 건드리지 않는다)
  --restart            workspace까지 지우고 1장부터 다시 시작한다 (지우기 전 자동 저장)
  --help               이 도움말
`;

function parseArgs(argv) {
  const options = {
    chapter: null, status: false, reset: false, help: false,
    saves: false, save: null, load: null, outline: null, show: null, restart: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--status') options.status = true;
    else if (arg === '--reset') options.reset = true;
    else if (arg === '--restart') options.restart = true;
    else if (arg === '--saves') options.saves = true;
    else if (arg === '--chapter') options.chapter = argv[++i] ?? null;
    else if (arg === '--show') options.show = argv[++i] ?? null;
    else if (arg === '--outline') {
      const next = argv[i + 1];
      options.outline = next && !next.startsWith('--') ? argv[++i] : '';
    }
    else if (arg === '--load') options.load = argv[++i] ?? null;
    else if (arg === '--save') {
      const next = argv[i + 1];
      options.save = next && !next.startsWith('--') ? argv[++i] : '';
    } else throw new Error(`알 수 없는 옵션: ${arg}`);
  }
  if (options.load === null && argv.includes('--load')) throw new Error('--load 에는 세이브 이름이 필요하다');
  return options;
}

function showStatus(progress, chapters) {
  const totalSteps = chapters.reduce((sum, chapter) => sum + chapter.steps.length, 0);
  ui.write(`\n  전체 진도  ${ui.progressBar(progress.completedSteps.length, totalSteps)}  ${progress.completedSteps.length}/${totalSteps}`);
  ui.write(`  최고 연속  ${progress.bestStreak}`);
  ui.write(`  진도 파일  ${PROGRESS_FILE}`);
  ui.write(`  작업 폴더  ${fs.existsSync(WORKSPACE_DIR) ? WORKSPACE_DIR : ui.style.dim('(아직 만들지 않았다)')}\n`);

  for (const chapter of chapters) {
    const done = chapter.steps.filter((step) => progress.completedSteps.includes(step.id)).length;
    const mark = done === chapter.steps.length ? ui.style.green('✔') : ui.style.dim('·');
    ui.write(`  ${mark} ${chapter.id}  ${chapter.title}  ${done}/${chapter.steps.length}`);
  }
  ui.write('');
}

function pickChapter(chapters, progress, requestedId) {
  if (requestedId) {
    const found = chapters.find((chapter) => chapter.id === requestedId);
    if (!found) throw new Error(`그런 챕터가 없다: ${requestedId}`);
    return found;
  }
  // 아직 다 끝내지 않은 첫 챕터부터 이어간다.
  return (
    chapters.find((chapter) => chapter.steps.some((step) => !progress.completedSteps.includes(step.id))) ??
    chapters.at(-1)
  );
}

/**
 * workspace까지 지우고 1장부터 다시 시작한다.
 * 지우기 전에 자동으로 저장하므로, 마음이 바뀌면 --load 로 되살릴 수 있다.
 */
async function restart(progress) {
  const size = measureWorkspace();

  ui.write(ui.noteBox('처음부터 다시 시작한다. 아래가 사라진다.'));
  ui.write(
    ui.noteBox(
      [
        size.exists
          ? `${WORKSPACE_DIR}\n  → 파일 ${size.files.toLocaleString()}개, ${(size.bytes / 1024 / 1024).toFixed(0)} MB`
          : `${WORKSPACE_DIR} (아직 없다)`,
        `${PROGRESS_FILE}\n  → 통과한 스텝 ${progress.completedSteps.length}개`,
        `${FAKE_REMOTE_DIR} (7장 연습용 원격)`,
      ].join('\n\n'),
    ),
  );
  ui.write(ui.noteBox('지우기 전에 지금 상태를 세이브로 남긴다. 마음이 바뀌면 되살릴 수 있다.'));

  if (!(await confirm('  정말 처음부터 시작할까?'))) {
    ui.write(ui.noteBox('취소했다. 아무것도 지우지 않았다.'));
    return 0;
  }

  const backup = saveSnapshot({
    progress,
    chapterId: progress.cursor.chapterId,
    stepId: progress.cursor.stepId,
    label: '초기화 직전',
    kind: 'manual',
  });
  ui.write(ui.passBox(`저장했다 — ${backup.id} (되살리려면 --load ${backup.id})`));

  if (size.exists) ui.write(ui.noteBox('workspace를 지우는 중… 파일이 많으면 시간이 걸린다.'));
  const result = removeWorkspace();

  if (!result.removed) {
    ui.write(ui.failBox('workspace를 다 지우지 못했다.'));
    ui.write(ui.noteBox(describeBlock(result)));
    ui.write(ui.noteBox('진도는 그대로 두었다. 위 항목을 확인한 뒤 다시 --restart 를 실행한다.'));
    return 1;
  }

  if (fs.existsSync(PROGRESS_FILE)) fs.rmSync(PROGRESS_FILE);
  fs.rmSync(FAKE_REMOTE_DIR, { recursive: true, force: true });

  ui.write(ui.passBox('처음 상태로 되돌렸다.'));
  ui.write(ui.noteBox(`npm run dojo 를 실행하면 1장부터 시작한다.\n되살리려면  npm run dojo -- --load ${backup.id}`));
  return 0;
}

/** 저장 지점으로 되돌린다. 되돌리기 전 상태는 auto-preload 슬롯에 남긴다. */
async function loadSave(id, currentProgress) {
  const { meta, progress: restored } = readSnapshot(id);
  const when = new Date(meta.createdAt).toLocaleString('ko-KR', { hour12: false });

  ui.write(ui.noteBox(`불러올 지점: ${meta.id} — ${meta.label}\n저장 시각: ${when}\n통과한 스텝: ${meta.completedCount}개`));
  ui.write(ui.noteBox(
    meta.hasWorkspace
      ? `${WORKSPACE_DIR} 의 파일이 이 시점 상태로 덮어씌워진다. (node_modules 는 그대로 둔다)`
      : '이 지점에는 코드가 없다. 진도만 되돌린다.',
  ));

  if (!(await confirm('  되돌릴까?'))) {
    ui.write(ui.noteBox('취소했다.'));
    return 0;
  }

  // 잘못 불러왔을 때 한 번은 돌아올 수 있게 지금 상태를 먼저 남긴다.
  saveSnapshot({
    progress: currentProgress,
    chapterId: currentProgress.cursor.chapterId,
    stepId: currentProgress.cursor.stepId,
    kind: 'preload',
  });

  const { restored: workspaceRestored } = restoreWorkspace(id);
  saveProgress(restored);

  ui.write(ui.passBox(`${meta.id} 시점으로 되돌아왔다.`));
  if (workspaceRestored) {
    ui.write(ui.noteBox('workspace 에 package.json 과 의존성이 있었다면 npm install 을 한 번 실행한다.'));
  }
  ui.write(ui.noteBox(`되돌리기 직전 상태는 ${PRELOAD_SLOT_ID} 에 남겨 두었다.`));
  return 0;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    ui.write(USAGE);
    return 0;
  }

  const chapters = loadChapters();
  const cards = collectReviewCards(chapters);
  const { progress: loaded, recovered } = loadProgress();
  let progress = loaded;

  ui.write(ui.banner());
  if (recovered) {
    ui.write(ui.failBox(`진도 파일을 읽지 못해 백업했다: ${recovered}`));
    ui.write(ui.noteBox('진도는 새로 시작하지만 workspace 폴더와 git 이력은 그대로다.'));
  }

  if (options.status) {
    showStatus(progress, chapters);
    return 0;
  }

  if (options.outline !== null) {
    ui.write(renderOutline(chapters, progress, options.outline || null));
    return 0;
  }

  if (options.show) {
    const found = findStep(chapters, options.show);
    if (!found) {
      ui.write(ui.failBox(`그런 스텝이 없다: ${options.show}`));
      ui.write(ui.noteBox('목차를 보려면  npm run dojo -- --outline'));
      return 1;
    }
    ui.write(renderStep(found, isRevealed(found.step, progress), progress));
    return 0;
  }

  if (options.saves) {
    ui.write(ui.savesList(listSnapshots()));
    return 0;
  }

  if (options.save !== null) {
    const meta = saveSnapshot({
      progress,
      chapterId: progress.cursor.chapterId,
      stepId: progress.cursor.stepId,
      label: options.save,
      kind: 'manual',
    });
    ui.write(ui.passBox(`저장했다 — ${meta.id} (${meta.label})`));
    ui.write(ui.noteBox(`되돌아오려면  npm run dojo -- --load ${meta.id}`));
    return 0;
  }

  if (options.load) {
    return loadSave(options.load, progress);
  }

  if (options.restart) {
    return restart(progress);
  }

  if (options.reset) {
    ui.write(ui.noteBox(`초기화 대상은 진도 기록뿐이다: ${PROGRESS_FILE}`));
    ui.write(ui.noteBox(`${WORKSPACE_DIR} 의 코드와 git 이력은 지우지 않는다.`));
    if (!(await confirm('  진도를 초기화할까?'))) {
      ui.write(ui.noteBox('취소했다.'));
      return 0;
    }
    if (fs.existsSync(PROGRESS_FILE)) fs.rmSync(PROGRESS_FILE);
    ui.write(ui.passBox('진도를 초기화했다.'));
    return 0;
  }

  const chapter = pickChapter(chapters, progress, options.chapter);

  progress = await runWarmup(progress, cards);
  saveProgress(progress);

  const result = await runChapter(chapter, progress, {
    rootDir: ROOT,
    workspaceDir: WORKSPACE_DIR,
    chapterId: chapter.id,
    chapters,
  });
  saveProgress(result.progress);

  if (result.quit) ui.write(ui.noteBox('여기까지 저장했다. 다음에 이어서 하면 된다.'));
  return 0;
}

main()
  .then((code) => {
    closePrompt();
    process.exit(code);
  })
  .catch((error) => {
    closePrompt();
    ui.write(ui.failBox(error.message));
    process.exit(1);
  });
