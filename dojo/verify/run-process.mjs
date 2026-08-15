// 외부 명령 실행 어댑터. 플랫폼 차이를 여기서만 흡수한다(상위 계층은 argv만 안다).
import { spawn } from 'node:child_process';
import { CMD_LIMITS } from '../config.mjs';

// Windows에서 이들은 실행 파일이 아니라 .cmd shim이라 직접 spawn되지 않는다.
const WINDOWS_SHIMS = new Set(['npm', 'npx', 'yarn', 'pnpm']);

// cmd.exe를 경유할 때 인자에 섞이면 안 되는 문자. 콘텐츠 오작성으로 인한 사고를 막는다.
const SHELL_METACHARACTERS = /[&|<>^"%\r\n]/;

/**
 * 고정 argv를 실행하고 종료 코드와 출력을 돌려준다. 절대 throw하지 않는다.
 * @returns {Promise<{code:number|null, output:string, timedOut:boolean, error:string|null}>}
 */
export function runProcess(argv, options = {}) {
  const { cwd, timeoutMs = CMD_LIMITS.timeoutMs, maxOutputBytes = CMD_LIMITS.maxOutputBytes } = options;

  let spawnPlan;
  try {
    spawnPlan = planSpawn(argv);
  } catch (error) {
    return Promise.resolve({ code: null, output: '', timedOut: false, error: error.message });
  }

  return new Promise((resolve) => {
    const child = spawn(spawnPlan.file, spawnPlan.args, {
      cwd,
      windowsHide: true,
      env: cleanEnv(),
    });

    let output = '';
    let truncated = false;
    const collect = (chunk) => {
      if (truncated) return;
      output += chunk;
      if (output.length > maxOutputBytes) {
        output = `${output.slice(0, maxOutputBytes)}\n…(출력이 잘렸다)`;
        truncated = true;
      }
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ code: null, output, timedOut, error: `${error.code ?? error.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, output, timedOut, error: null });
    });
  });
}

/**
 * 판정용 자식 프로세스의 환경. 물려받은 것 중 판정을 왜곡하는 것을 걷어 낸다.
 *
 * `NODE_TEST_CONTEXT` 가 있으면 `node --test` 는 중첩 실행으로 보고 **파일을 하나도 돌리지 않은 채
 * 종료 코드 0으로 끝난다.** 판정이 그것을 통과로 읽으면 아무 테스트도 없이 통과하는 길이 열린다.
 * 도장이 테스트 러너 안에서 돌아가는 경우(회귀 테스트)에도 학습자 환경과 같은 조건이어야 한다.
 */
export function cleanEnv(source = process.env) {
  const env = { ...source, NO_COLOR: '1', FORCE_COLOR: '0' };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

/** argv를 이 플랫폼에서 실제로 실행 가능한 형태로 바꾼다. */
export function planSpawn(argv) {
  if (!Array.isArray(argv) || argv.length === 0) throw new Error('실행할 명령이 없다');
  for (const part of argv) {
    if (typeof part !== 'string') throw new Error('명령 인자는 문자열이어야 한다');
  }

  const [command, ...args] = argv;
  if (process.platform !== 'win32' || !WINDOWS_SHIMS.has(command)) {
    return { file: command, args };
  }

  // cmd.exe /d /s /c 로 shim을 실행한다. shell:true는 인자를 이스케이프하지 않아 쓰지 않는다.
  for (const part of argv) {
    if (SHELL_METACHARACTERS.test(part)) {
      throw new Error(`명령 인자에 허용되지 않는 문자가 있다: ${part}`);
    }
  }
  const line = argv.map((part) => (part.includes(' ') ? `"${part}"` : part)).join(' ');
  return { file: 'cmd.exe', args: ['/d', '/s', '/c', line] };
}
