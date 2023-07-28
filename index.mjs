import express from 'express';
import { makeChain, CHUNK } from "./handler/chain.mjs";
import { log, color, _log } from './utils/logging.mjs';
import { sumPageNum } from './utils/functions.mjs';
import { getDatasets, getStores, saveData } from './handler/store.mjs';
import { loadAll } from './handler/store.mjs';

/*
EDIT ./node_modules/langchain/dist/memory/base.js line 13-16 => return inputValues[keys[0]];
*/

process.env.OPENAI_API_KEY || (
  console.log('No API key given') ||
  process.exit()
);
const PORT = process.env.PORT || 7723;

const app = express();
const chains = [];

app.use(express.json());

app.get('/list/stores', async (req, res) => {
  const stores = await getStores();
  log.info(`Get stores: ${JSON.stringify(stores)}`);
  return res.status(200).send(JSON.stringify(stores));
});

app.get('/list/datasets', async (req, res) => {
  const datasets = await getDatasets();
  log.info(`Get datasets: ${JSON.stringify(datasets)}`);
  return res.status(200).send(JSON.stringify(datasets));
});

app.post('/upload/dataset', async (req, res) => {
  const { name, files } = req.body;
  log.debug(`Upload request for '${name}'`);
  const result = await saveData({name, files});
  if (result.ok) {
    log.notice(`Dataset uploaded for '${name}'`);
    return res.status(201).send(JSON.stringify({message: 'OK'}));
  }
  log.warn(`Dataset upload for '${name}' failed: ${JSON.stringify(result)}`);
  if (result.code === 409) {
    return res.status(409).send(JSON.stringify({message: 'Conflict'}));
  }
  return res.status(500).send(JSON.stringify({message: 'Error'}));
});

app.post('/create', async (req, res) => {
  const { uid, name } = req.body;
  log.info(`Create #${uid} '${name}'`);
  if (chains[uid]) return res.status(200).send(JSON.stringify({message: 'Found'}));
  chains[uid] = await makeChain({name, chunk: CHUNK.small});
  if (chains[uid]) return res.status(201).send(JSON.stringify({message: 'Created'}));
  return res.status(500).send(JSON.stringify({message: 'Error'}));
});

app.post('/complete', async (req, res) => {
  const { uid, text } = req.body;
  log.info(`Complete #${uid} '${text}'`);
  if (!chains[uid]) return res.status(404).send(JSON.stringify({message: 'Not Found'}));
  const data = await chains[uid].call({
    question: text
  });
  return res.status(200).send(JSON.stringify({
    text: data.text?.replace(/<\/\w+>$/, ''),
    sources: data.sourceDocuments?.map((src) => ({
      text: src.pageContent,
      location:
        `${src.metadata?.source?.replaceAll('\\','/')?.split('/')?.slice(-1)[0]}, ` +
        `${sumPageNum(src.metadata?.loc?.lines?.from, src.metadata?.loc?.lines?.to)}`,
    })),
    summarize: data.newQuestion
  }));
});

app.listen(PORT, () => {
  log.notice(`FeedGo API listening on port ${PORT}, ready to se${
    'r'.repeat(max(parseInt(parseInt(`${PORT}`)/1000), 20))
  }ve!`);
});

if (process.env.LOADALL) loadAll();