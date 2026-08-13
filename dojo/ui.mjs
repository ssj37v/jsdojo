// 터미널 렌더 전담. 문자열을 만들기만 하고 파일·git·판정에는 관여하지 않는다.
const COLOR_ENABLED = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

const CODES = {
  reset: '[0m',
  bold: '[1m',
  dim: '[2m',
  red: '[31m',
  green: '[32m',
  yellow: '[33m',
  blue: '[34m',
  magenta: '[35m',
  cyan: '[36m',
};

function paint(code, text) {
  return COLOR_ENABLED ? `${CODES[code]}${text}${CODES.reset}` : text;
}

export const style = {
  bold: (t) => paint('bold', t),
  dim: (t) => paint('dim', t),
  red: (t) => paint('red', t),
  green: (t) => paint('green', t),
  yellow: (t) => paint('yellow', t),
  blue: (t) => paint('blue', t),
  magenta: (t) => paint('magenta', t),
  cyan: (t) => paint('cyan', t),
};

const RULE = '─'.repeat(64);

export function write(text = '') {
  process.stdout.write(`${text}\n`);
}

export function banner() {
  return [
    '',
    style.cyan(style.bold('  JS DOJO')),
    style.dim('  자바스크립트를 기초부터 설계까지 손으로 익히는 도장'),
    '',
  ].join('\n');
}

export function chapterHeader(chapter, { completed, total }) {
  return [
    '',
    style.blue(RULE),
    `${style.bold(chapter.title)}  ${style.dim(`(${chapter.id})`)}`,
    style.dim(`목표: ${chapter.goal}`),
    style.dim(`진도: ${progressBar(completed, total)}  ${completed}/${total}`),
    style.blue(RULE),
    chapter.intro ? `\n${chapter.intro.trim()}\n` : '',
  ].join('\n');
}

export function progressBar(done, total, width = 20) {
  const filled = total === 0 ? 0 : Math.round((done / total) * width);
  return `${'█'.repeat(filled)}${style.dim('░'.repeat(width - filled))}`;
}

export function stepHeader(step, { index, total, streak, level }) {
  const tags = [];
  if (step.boss) tags.push(style.magenta('BOSS'));
  if (level) tags.push(style.dim(LEVEL_LABEL[level] ?? level));
  if (streak >= 2) tags.push(style.yellow(`🔥 연속 ${streak}`));

  const heading = [`${style.bold(`STEP ${index}/${total}`)}`, step.goal, ...tags].join('  ');
  return ['', heading, style.dim(RULE)].join('\n');
}

const LEVEL_LABEL = {
  copy: '따라치기',
  fill: '빈칸 채우기',
  recall: '백지에서',
};

export function teachBlock(text) {
  return `\n${indent(text.trim(), '  ')}\n`;
}

export function codeBlock(body, level) {
  const heading = level ? style.dim(`  ── ${LEVEL_LABEL[level] ?? level} ──`) : '';
  return [heading, indent(style.cyan(body.trimEnd()), '    '), ''].filter(Boolean).join('\n');
}

export function checkReport(results) {
  const lines = results.map((result) => {
    const mark = result.passed ? style.green('✔') : style.red('✘');
    const detail = result.passed ? style.dim(result.detail ?? '') : style.red(result.detail ?? '');
    return `  ${mark} ${result.label}\n    ${detail.split('\n').join('\n    ')}`;
  });
  return `\n${lines.join('\n')}\n`;
}

export function commandOutput(output) {
  if (!output?.trim()) return '';
  const trimmed = output.trim().split('\n').slice(-12).join('\n');
  return `${style.dim('  ── 실행 출력 (마지막 12줄) ──')}\n${indent(style.dim(trimmed), '    ')}\n`;
}

export function hintBox(hint, index, total) {
  return `\n${style.yellow(`  힌트 ${index}/${total}`)}  ${hint}\n`;
}

/** 학습자가 하지 않은 일이 저장소에 일어났을 때 알리는 상자. 몰래 바꾸지 않는다. */
export function eventBox(message) {
  return [
    '',
    style.magenta('  ┌─ 상황 발생 ─────────────────────────────────'),
    indent(style.magenta(message.trim()), '  │ '),
    style.magenta('  └────────────────────────────────────────────'),
    '',
  ].join('\n');
}

export function modelAnswer(text) {
  return `\n${style.dim('  ── 모범 답안 ──')}\n${indent(text.trim(), '  ')}\n`;
}

export function passBox(message) {
  return `\n${style.green(`  ✔ ${message}`)}\n`;
}

export function failBox(message) {
  return `\n${style.red(`  ✘ ${message}`)}\n`;
}

export function noteBox(message) {
  return `\n${style.dim(indent(message.trim(), '  '))}\n`;
}

export function cardFront(card, index, total) {
  return [
    '',
    style.yellow(`  복습 ${index}/${total}`),
    `  ${style.bold(card.front)}`,
    '',
  ].join('\n');
}

export function savesList(slots) {
  if (slots.length === 0) {
    return `\n${style.dim('  아직 저장된 지점이 없다. 스텝을 하나 통과하면 자동으로 생긴다.')}\n`;
  }

  const rows = slots.map((slot) => {
    const when = new Date(slot.createdAt).toLocaleString('ko-KR', { hour12: false });
    const kind = { auto: '자동', manual: '수동', preload: '직전' }[slot.kind] ?? slot.kind;
    const code = slot.hasWorkspace ? '' : style.dim('  (코드 없음)');
    return [
      `  ${style.bold(slot.id.padEnd(22))} ${style.dim(kind)}  ${slot.label}${code}`,
      `  ${' '.repeat(22)} ${style.dim(`${when}  ·  통과한 스텝 ${slot.completedCount}개`)}`,
    ].join('\n');
  });

  return `\n${style.bold('  저장된 지점')}\n\n${rows.join('\n\n')}\n\n${style.dim('  불러오기:  npm run dojo -- --load <이름>')}\n`;
}

export function chapterSummary(chapter, stats) {
  return [
    '',
    style.blue(RULE),
    style.bold(`  ${chapter.title} 완료`),
    `  통과한 스텝 ${stats.passed}/${stats.total}   최고 연속 ${stats.bestStreak}   쓴 힌트 ${stats.hintsUsed}개`,
    style.dim('  다음 실행 때 복습 카드로 다시 만난다. 간격을 두고 떠올릴수록 오래 남는다.'),
    style.blue(RULE),
    '',
  ].join('\n');
}

export function indent(text, prefix) {
  return text
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
}
