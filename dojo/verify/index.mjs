// 판정 진입점. 스텝의 verify 선언을 순서대로 돌리고 결과를 모은다.
import { checkFs } from './fs-check.mjs';
import { checkCmd } from './cmd-check.mjs';
import { checkGit } from './git-check.mjs';
import { ROOT, WORKSPACE_DIR } from '../config.mjs';

const HANDLERS = {
  fs: checkFs,
  cmd: checkCmd,
  git: checkGit,
};

/**
 * 스텝을 판정한다. 첫 실패에서 멈춰 학습자에게 한 번에 하나씩만 고치게 한다.
 * @returns {Promise<{passed:boolean, results:Array<{label:string,passed:boolean,detail:string,output?:string}>}>}
 */
export async function verifyStep(step, context = {}) {
  const ctx = {
    workspaceDir: context.workspaceDir ?? WORKSPACE_DIR,
    rootDir: context.rootDir ?? ROOT,
  };

  const results = [];
  for (const check of step.verify) {
    const handler = HANDLERS[check.type];
    if (!handler) {
      results.push({ label: check.label ?? check.type, passed: false, detail: `알 수 없는 검사 종류: ${check.type}` });
      break;
    }

    let outcome;
    try {
      outcome = await handler(check, ctx);
    } catch (error) {
      outcome = { passed: false, detail: `검사 중 오류 — ${error.message}` };
    }

    results.push({ label: check.label, ...outcome });
    if (!outcome.passed) break;
  }

  return { passed: results.length > 0 && results.every((r) => r.passed), results };
}
