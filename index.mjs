import readline from 'readline';
import { makeChain, CHUNK } from "./handler/chain.mjs";

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
const chain = await makeChain(name, CHUNK.small);

rl.on('line', async (line) => {
  line = line.trim();
  const res = await chain.call({
    question: line
  });
  console.log(res);
  return;
});