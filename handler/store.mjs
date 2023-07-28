import fs from 'fs';
import path from 'path';
import { FaissStore } from 'langchain/vectorstores/faiss';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { _log, log } from '../utils/logging.mjs';
import { ask } from '../utils/input.mjs';

export const CHUNK = {
  tiny: {
    chunkSize: 80,
    chunkOverlap: 16
  },
  small: {
    chunkSize: 320,
    chunkOverlap: 64
  },
  medium: {
    chunkSize: 800,
    chunkOverlap: 160
  },
  large: {
    chunkSize: 1440,
    chunkOverlap: 288
  },
  huge: {
    chunkSize: 3200,
    chunkOverlap: 640
  }
};
const AVAILABLE_CHUNKS = ['tiny', 'small', 'medium', 'large', 'huge'];

const DATA_BASEPATH = process.env.DATA_BASEPATH ?? 'data';
const STORE_BASEPATH = process.env.STORE_BASEPATH ?? 'vstores';

export class Store {
  constructor({name, chunk}) {
    this.name = name;
    this.dataPath = `${DATA_BASEPATH}/${name}`;
    this.storePath = `${STORE_BASEPATH}/${name}`;
    this.chunkConf = chunk ?? CHUNK.medium;
    this.vectorStore = null;
  }
  // load data to vectorStore
  async load() {
    if (await this.resume()) return this.vectorStore;
    if (!fs.existsSync(this.dataPath)) {
      log.error(`${this.dataPath} doesn't exist`);
      return null;
    }
    log.debug(`Loading documents from ${this.dataPath} ...`);
    const loader = new DirectoryLoader(
      this.dataPath, {
        '.txt': (path) => new TextLoader(path)
      }
    );
    const docs = await loader.load();
    const data = await (
      new RecursiveCharacterTextSplitter(this.chunkConf)
        .splitDocuments(docs)
    );
    log.debug('Finished parsing documents, embedding...');
    const store = await FaissStore.fromDocuments(
      data,
      new OpenAIEmbeddings()
    );
    log.debug('Vector store build done, saving...');
    this.vectorStore = store;
    await this.save();
    log.notice(`Vector store '${this.name}' create done`);
    return store;
  }
  // save base to STORE
  async save() {
    log.debug(`Saving vector store to ${this.storePath} ...`);
    return await this.vectorStore.save(this.storePath);
  }
  // try to resume base from STORE
  async resume() {
    if (!fs.existsSync(this.storePath)) return false;
    log.debug(`Resuming vector store from ${this.storePath} ...`);
    try {
      this.vectorStore = await FaissStore.load(
        this.storePath,
        new OpenAIEmbeddings()
      );
      log.notice(`Vector store '${this.name}' resumed`);
      return true;
    } catch {
      return false;
    }
  }
  // get prompt
  async getPrompt() {
    const promptPath = path.join(this.storePath,'prompt.conf');
    if (!fs.existsSync(promptPath)) {
      log.warn(`${promptPath} doesn't exist, using default`);
      return null;
    }
    const data = fs.readFileSync(promptPath);
    return data.toString().trim();
  }
  // get bot name
  async getName() {
    const namePath = path.join(this.storePath,'name.conf');
    if (!fs.existsSync(namePath)) {
      log.warn(`${namePath} doesn't exist, using default`);
      return null;
    }
    const data = fs.readFileSync(namePath);
    return data.toString().trim();
  }
}

// manual load all datasets
export const loadAll = async () => {
  const datasets = fs.readdirSync(DATA_BASEPATH)
    .filter((fileName) => fs.statSync(path.join(DATA_BASEPATH,fileName)).isDirectory())
    .filter((data) => {
      if (fs.existsSync(path.join(STORE_BASEPATH,data))) {
        log.info(`Store ${data} exists`);
        return false;
      } return true;
    }
  );
  if (!datasets.length) return log.info('Nothing to load');
  for (let data of datasets) {
    // ask for chunk size
    let chunkSize = null;
    while (!chunkSize) {
      chunkSize = await ask(
        `Chunk size for '${data}'`,
        `[${AVAILABLE_CHUNKS.join('/')}]`,
        'small'
      );
      if (!AVAILABLE_CHUNKS.includes(chunkSize)) {
        _log('Invalid chunk size');
        chunkSize = null;
      }
    }
    await new Store({data, chunkSize}).load();
  }
  return log.notice('Datasets loaded');
}

// get available stores
export const getStores = async () => {
  return fs.readdirSync(STORE_BASEPATH).filter(
    (fileName) => fs.statSync(path.join(STORE_BASEPATH,fileName)).isDirectory()
  );
}

// get available datasets
export const getDatasets = async () => {
  return fs.readdirSync(DATA_BASEPATH).filter(
    (fileName) => fs.statSync(path.join(DATA_BASEPATH,fileName)).isDirectory()
  );
}

// handle upload
export const saveData = async ({ name, files }) => {
  const dataPath = path.join(DATA_BASEPATH,name);
  if (fs.existsSync(dataPath)) {
    return {
      ok: false,
      code: 409,
      msg: `conf named '${name}' already exists`
    }
  }
  if (!files?.[0]) {
    return {
      ok: false,
      code: 400,
      msg: 'invalid files'
    }
  }
  for (let file of files) {
    const { fileName, content } = file;
    fs.writeFileSync(path.join(dataPath,fileName), content);
  }
  return {
    ok: true,
    code: 201,
    msg: `saved upload dataset ${name}`
  }
}