import readline from 'readline';
import { makeChain, CHUNK } from "./handler/chain.mjs";
import { log, color, _log } from './utils/logging.mjs';

/*
EDIT ./node_modules/langchain/dist/memory/base.js line 13-16 => return inputValues[keys[0]];
*/

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
  if (!line) return;
  const res = await chain.call({
    question: line
  });
  _log(`${color.bright}${color.green}${res.text.replace(/<\/\w+>$/, '')}${color.reset}\n`);
  _log(res.sourceDocuments.map(s=>`-----------\n${s.pageContent}\n${s?.metadata?.source?.split('/')?.slice(-1)[0]}@l${s?.metadata?.loc?.lines?.from}-${s?.metadata?.loc?.lines?.to}\n\n`))
  return;
});