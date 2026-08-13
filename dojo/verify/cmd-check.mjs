// 실제 종료 코드 기반 판정. "빌드가 된다"는 주장은 빌드를 돌려서만 확인한다.
import { runProcess } from './run-process.mjs';

export async function checkCmd(check, ctx) {
  const cwd = check.cwd === 'root' ? ctx.rootDir : ctx.workspaceDir;
  const expectedExit = check.expect_exit ?? 0;
  const shown = check.run.join(' ');

  const result = await runProcess(check.run, { cwd });

  if (result.error) return fail(`\`${shown}\` 를 실행하지 못했다 — ${result.error}`, result.output);
  if (result.timedOut) return fail(`\`${shown}\` 가 시간 안에 끝나지 않았다`, result.output);
  if (result.code !== expectedExit) {
    return fail(`\`${shown}\` 종료 코드 ${result.code} (기대값 ${expectedExit})`, result.output);
  }
  if (check.expect_output && !new RegExp(check.expect_output, 'm').test(result.output)) {
    return fail(`\`${shown}\` 출력에서 찾지 못했다: /${check.expect_output}/`, result.output);
  }
  if (check.reject_output && new RegExp(check.reject_output, 'm').test(result.output)) {
    return fail(`\`${shown}\` 출력에 아직 남아 있다: /${check.reject_output}/`, result.output);
  }

  return { passed: true, detail: `\`${shown}\` 통과`, output: result.output };
}

function fail(detail, output) {
  return { passed: false, detail, output };
}
