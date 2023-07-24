import express from 'express';
import { makeChain, CHUNK } from "./handler/chain.mjs";
import { log, color, _log } from './utils/logging.mjs';

/*
EDIT ./node_modules/langchain/dist/memory/base.js line 13-16 => return inputValues[keys[0]];
*/

process.env.OPENAI_API_KEY || (
  console.log('No API key given') ||
  process.exit()
);

const app = express();
const chains = [];

app.post('/create', async (req, res) => {
  const { uid, name, chunkSize } = JSON.parse(req.body);
  if (chains[uid]) return res.status(200).send('found');
  chains[uid] = await makeChain(name, CHUNK[chunkSize ?? 'small']);
  return res.status.send('created');
});

app.post('/complete', async (req, res) => {
  const { uid, text } = JSON.parse(req.body);
  if (!chains[uid]) return res.status(404).send('not found');
  const data = await chains[uid].call({
    question: text
  });
  return res.status(200).send(JSON.stringify({
    text: data.text?.replace(/<\/\w+>$/, ''),
    sources: data.sourceDocuments?.map((src) => ({
      text: src.pageContent,
      location:
        `${src.metadata?.source?.split('/')?.slice(-1)[0]}, ` +
        `${sumPageNum(src.metadata?.loc?.lines?.from, src.metadata?.loc?.lines?.to)}`,
    })),
    summarize: data.newQuestion
  }));
});

app.listen('7723', () => {
  log.notice('FeedGo API listening on port 7723, ready to serve!');
});