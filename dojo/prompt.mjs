// 학습자 입력 수집. 한 세션 동안 readline 인터페이스 하나만 유지한다.
//
// 도착한 줄을 큐에 쌓아 두고 하나씩 꺼내 쓴다. readline.question 은 대기 중인 질문이 없을 때
// 들어온 줄을 버리기 때문에, 파이프로 여러 줄을 한 번에 넣으면 두 번째부터 사라진다.
// 큐를 쓰면 사람이 치든 스크립트가 넣든 순서대로 소비되어 대화 흐름을 자동 검증할 수 있다.
import readline from 'node:readline';
import { style } from './ui.mjs';

let sharedInterface = null;
let pendingLines = [];
let waiters = [];
let inputClosed = false;

function getInterface() {
  if (sharedInterface) return sharedInterface;

  sharedInterface = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  sharedInterface.on('line', (line) => {
    const waiter = waiters.shift();
    if (waiter) waiter(line);
    else pendingLines.push(line);
  });
  sharedInterface.on('close', () => {
    inputClosed = true;
    for (const waiter of waiters) waiter('');
    waiters = [];
  });
  return sharedInterface;
}

function nextLine() {
  getInterface();
  if (pendingLines.length > 0) return Promise.resolve(pendingLines.shift());
  if (inputClosed) return Promise.resolve('');
  return new Promise((resolve) => waiters.push(resolve));
}

/** 더 읽을 입력이 없는가. 파이프 입력이 끝났을 때 무한 대기를 피하는 데 쓴다. */
export function isInputClosed() {
  return inputClosed && pendingLines.length === 0;
}

export function closePrompt() {
  sharedInterface?.close();
  sharedInterface = null;
  pendingLines = [];
  waiters = [];
}

export async function ask(question) {
  process.stdout.write(`${question} `);
  const answer = await nextLine();
  process.stdout.write('\n');
  return answer.trim();
}

/**
 * 학습자가 작업을 마칠 때까지 기다린다.
 * @returns {Promise<'check'|'hint'|'save'|'browse'|'skip'|'quit'>}
 */
export async function waitForAction({ hintAvailable }) {
  const options = [
    `${style.bold('Enter')} 검사`,
    hintAvailable ? `${style.bold('h')} 힌트` : style.dim('h 힌트(잠김)'),
    `${style.bold('b')} 지난 스텝`,
    `${style.bold('w')} 저장`,
    `${style.bold('s')} 건너뛰기`,
    `${style.bold('q')} 종료`,
  ];
  const answer = (await ask(`\n  ${options.join('   ')}\n  >`)).toLowerCase();

  // 입력이 끝났는데 계속 기다리면 검사 실패 → 재시도 루프에 갇힌다.
  if (isInputClosed() && answer === '') return 'quit';

  if (answer === '') return 'check';
  if (answer === 'h') return 'hint';
  if (answer === 'b') return 'browse';
  if (answer === 'w') return 'save';
  if (answer === 's') return 'skip';
  if (answer === 'q') return 'quit';
  return 'check';
}

export async function confirm(question) {
  const answer = (await ask(`${question} ${style.dim('(y/N)')}`)).toLowerCase();
  return answer === 'y' || answer === 'yes';
}
