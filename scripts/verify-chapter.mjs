// lifecycle: ops
// 챕터를 실제 Next.js 프로젝트 위에서 끝까지 돌려 본다.
// "정답을 적용하면 통과하고, 하지 않으면 통과하지 않는다"를 사람 손 없이 확인하는 것이 목적이다.
//
//   node scripts/verify-chapter.mjs              # 전 챕터 누적 검증
//   node scripts/verify-chapter.mjs ch02         # ch01부터 ch02까지 (챕터는 누적된다)
//   node scripts/verify-chapter.mjs ch02 --keep  # 작업 폴더를 남긴다
//
// 대화형 CLI를 거치지 않고 verifyStep만 직접 호출하므로 입력 없이 끝까지 돈다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadChapters } from '../dojo/content-loader.mjs';
import { runScenario } from '../dojo/scenario.mjs';
import { verifyStep } from '../dojo/verify/index.mjs';
import { runProcess } from '../dojo/verify/run-process.mjs';
import SOLUTIONS from './solutions/index.mjs';

const args = process.argv.slice(2);
const KEEP = args.includes('--keep');
const UNTIL = args.find((arg) => /^ch[0-9]{2}$/.test(arg)) ?? null;

/**
 * 실제 배치를 그대로 재현한다 — 도장 자체가 git 저장소이고 workspace는 그 안에 있다.
 * 이 조건이 없으면 git 검사가 부모 저장소를 올려다보는 false pass를 놓친다.
 */
async function makeDojoRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dojo-verify-'));
  fs.writeFileSync(path.join(root, 'engine.txt'), 'dojo engine\n', 'utf8');
  await runProcess(['git', 'init', '-q', '-b', 'main'], { cwd: root });
  await runProcess(['git', 'config', 'user.name', 'dojo'], { cwd: root });
  await runProcess(['git', 'config', 'user.email', 'dojo@example.com'], { cwd: root });
  await runProcess(['git', 'add', '.'], { cwd: root });
  await runProcess(['git', 'commit', '-q', '-m', 'chore: 도장 저장소'], { cwd: root });
  return root;
}

async function verifyChapter(chapter, ctx, failures) {
  console.log(`\n═══ ${chapter.id}  ${chapter.title} ═══\n`);

  for (const step of chapter.steps) {
    const solution = SOLUTIONS[step.id];
    process.stdout.write(`${step.id}  ${step.goal}\n`);

    // 학습 중과 같은 상황을 연출해야 검증도 같은 조건에서 돈다.
    if (step.setup) {
      await runScenario(step.setup.scenario, {
        workspaceDir: ctx.workspaceDir,
        remoteDir: path.join(ctx.rootDir, '.dojo', 'remote.git'),
        baseDir: ctx.rootDir,
      }, step.setup);
      console.log(`   ⚑ 상황 연출: ${step.setup.scenario}`);
    }

    // 외부 계정·네트워크가 필요한 스텝은 자동으로 확인할 수 없다. 숨기지 않고 드러낸다.
    if (step.external) {
      console.log('   ⤳ 외부 서비스 필요 — 자동 검증 대상 아님 (학습자 환경에서는 검증된다)\n');
      continue;
    }

    if (solution === undefined) {
      failures.push(`${step.id}: 정답 조작이 등록되지 않았다 (scripts/solutions/${chapter.id}.mjs)`);
      console.log('   ✘ 정답 미등록 — 이 스텝은 검증되지 않는다\n');
      continue;
    }

    // 정답을 적용하기 전에는 통과하면 안 된다(사전 조건이 이미 만족된 스텝은 null로 둔다).
    if (solution) {
      const before = await verifyStep(step, ctx);
      if (before.passed) {
        failures.push(`${step.id}: 아무것도 하지 않았는데 통과했다 (검증이 헐겁다)`);
        console.log('   ✘ 사전 통과 — 검증이 헐겁다');
      } else {
        console.log(`   · 미이행 상태에서 실패 확인 (${before.results.at(-1)?.label})`);
      }
      await solution(ctx.workspaceDir, ctx.rootDir);
    }

    const after = await verifyStep(step, ctx);
    if (after.passed) {
      console.log('   ✔ 정답 적용 후 통과\n');
    } else {
      failures.push(`${step.id}: 정답을 적용했는데 통과하지 못했다 — ${after.results.at(-1)?.detail}`);
      console.log(`   ✘ 정답 적용 후에도 실패 — ${after.results.at(-1)?.detail}\n`);
      return false;
    }
  }
  return true;
}

async function main() {
  const all = loadChapters();
  const chapters = UNTIL ? all.filter((chapter) => chapter.id <= UNTIL) : all;
  if (chapters.length === 0) throw new Error(`그런 챕터가 없다: ${UNTIL}`);

  const root = await makeDojoRoot();
  const ctx = { rootDir: root, workspaceDir: path.join(root, 'workspace') };

  console.log(`작업 폴더: ${root} (git 저장소 안에서 검증한다)`);
  console.log(`대상: ${chapters.map((c) => c.id).join(' → ')}  — 챕터는 앞 챕터 결과 위에 누적된다`);

  const failures = [];
  for (const chapter of chapters) {
    const ok = await verifyChapter(chapter, ctx, failures);
    if (!ok) break;
  }

  if (!KEEP) fs.rmSync(root, { recursive: true, force: true });
  else console.log(`--keep: ${root} 를 남겨 둔다`);

  if (failures.length > 0) {
    console.log('\n실패:');
    for (const line of failures) console.log(`  - ${line}`);
    process.exit(1);
  }
  console.log('\n모든 스텝이 정답에서 통과하고, 미이행 상태에서 통과하지 않는다.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
