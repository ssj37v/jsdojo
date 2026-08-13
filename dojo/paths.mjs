// 경로 봉쇄. 학습자 파일을 읽고 쓰는 모든 코드는 여기를 통과해야 한다(R02).
import fs from 'node:fs';
import path from 'node:path';

/**
 * base 하위로만 해석되는 절대 경로를 돌려준다.
 * 상위 탈출(..), 절대 경로 주입, base 밖으로 나가는 심볼릭 링크를 거부한다.
 */
export function resolveInside(base, relative) {
  if (typeof relative !== 'string' || relative.length === 0) {
    throw new Error('경로가 비어 있다');
  }
  if (path.isAbsolute(relative)) {
    throw new Error(`절대 경로는 허용되지 않는다: ${relative}`);
  }

  const baseReal = realpathOrSelf(path.resolve(base));
  const target = path.resolve(baseReal, relative);
  if (!isInside(baseReal, target)) {
    throw new Error(`허용 범위를 벗어난 경로: ${relative}`);
  }

  // 존재하는 경로라면 심볼릭 링크를 펼친 뒤 다시 확인한다.
  const targetReal = realpathOrSelf(target);
  if (!isInside(baseReal, targetReal)) {
    throw new Error(`심볼릭 링크가 허용 범위를 벗어난다: ${relative}`);
  }
  return target;
}

export function isInside(base, target) {
  const relative = path.relative(base, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function realpathOrSelf(target) {
  try {
    return fs.realpathSync(target);
  } catch {
    return target;
  }
}
