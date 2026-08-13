// lifecycle: ops
// ch01 각 스텝을 "학습자가 올바르게 해냈을 때"의 상태로 만드는 조작.
import { write } from './helpers.mjs';

export default {
  // node -v 는 도장을 돌리는 환경이면 이미 만족되어 있다.
  'ch01-s01': null,

  'ch01-s02': (ws) => {
    write(ws, 'hello.mjs', "console.log('안녕, 자바스크립트')\n");
  },

  'ch01-s03': (ws) => {
    write(ws, 'hello.mjs', "const name = '자바스크립트'\nconsole.log(`안녕, ${name}`)\n");
  },
};
