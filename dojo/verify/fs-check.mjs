// 파일 내용 기반 판정. 학습자의 자기신고가 아니라 디스크에 실제로 있는 것만 믿는다.
import fs from 'node:fs';
import { resolveInside } from '../paths.mjs';

export function checkFs(check, ctx) {
  const shouldExist = check.exists !== false;

  let absolute;
  try {
    absolute = resolveInside(ctx.workspaceDir, check.path);
  } catch (error) {
    return fail(`경로를 확인할 수 없다 — ${error.message}`);
  }

  const exists = fs.existsSync(absolute) && fs.statSync(absolute).isFile();
  if (!shouldExist) {
    return exists ? fail(`${check.path} 가 아직 남아 있다`) : pass(`${check.path} 없음 확인`);
  }
  if (!exists) return fail(`${check.path} 파일을 찾을 수 없다`);

  const content = fs.readFileSync(absolute, 'utf8');

  for (const pattern of check.matches ?? []) {
    if (!new RegExp(pattern, 'm').test(content)) {
      return fail(`${check.path} 에서 찾지 못했다: ${describe(pattern)}`);
    }
  }
  for (const pattern of check.not_matches ?? []) {
    if (new RegExp(pattern, 'm').test(content)) {
      return fail(`${check.path} 에 아직 남아 있다: ${describe(pattern)}`);
    }
  }

  if (check.json_has?.length) {
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      return fail(`${check.path} 가 올바른 JSON이 아니다 — ${error.message}`);
    }
    for (const dotted of check.json_has) {
      if (readDotted(parsed, dotted) === undefined) {
        return fail(`${check.path} 에 ${dotted} 항목이 없다`);
      }
    }
  }

  return pass(`${check.path} 확인`);
}

function readDotted(object, dotted) {
  return dotted.split('.').reduce((node, key) => (node == null ? undefined : node[key]), object);
}

function describe(pattern) {
  return `/${pattern}/`;
}

function pass(detail) {
  return { passed: true, detail };
}

function fail(detail) {
  return { passed: false, detail };
}
