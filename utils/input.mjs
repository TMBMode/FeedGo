import readline from 'readline';
import { color } from './logging.mjs';

export const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: ''
});

export const input = (q) =>
  new Promise((resolve) => {
    rl.question(q, (a) => {
      resolve(a);
    });
  }
);

export const ask = async (q, p = '', d = undefined) => {
  let a = undefined;
  while (a === undefined) {
    a = (await input(
      `${color.bright}${color.cyan}${q}${color.reset}${(p||d)?' ':''}` +
      `${color.cyan}${p}${d?`(${d})`:''}: ${color.reset}`
    )) || d;
  }
  return a;
};
