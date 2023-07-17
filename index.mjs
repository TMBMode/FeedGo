import readline from 'readline';
import { makeChain, CHUNK } from "./handler/chain.mjs";
import { color } from './utils/logging.mjs';

process.env.OPENAI_API_KEY || (
  console.log('No API key given') ||
  process.exit()
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: ''
}),
input = (q) =>
  new Promise((resolve) => {
    rl.question(q, (a) => {
      resolve(a);
    });
  }
);

const name = await input('config > ');
const chain = await makeChain(name, CHUNK.tiny);

rl.on('line', async (line) => {
  line = line.trim();
  if (!line) return;
  const res = await chain.call({
    question: line
  });
  console.log(`${color.bright}${color.green}${res.text.replace(/<\/\w+>$/, '')}${color.reset}\n`);
  return;
});