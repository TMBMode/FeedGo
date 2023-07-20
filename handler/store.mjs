import fs from 'fs';
import { FaissStore } from 'langchain/vectorstores/faiss';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { log } from '../utils/logging.mjs';

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

const DATA_BASEPATH = process.env.DATA_BASEPATH ?? 'data';
const STORE_BASEPATH = process.env.STORE_BASEPATH ?? 'vstores';

export class Store {
  constructor({name, chunk}) {
    this.dataPath = `${DATA_BASEPATH}/${name}`;
    this.storePath = `${STORE_BASEPATH}/${name}`;
    this.chunkConf = chunk ?? CHUNK.medium;
    this.vectorStore = null;
  }
  async load() {
    if (await this.resume()) return this.vectorStore;
    if (!fs.existsSync(this.dataPath)) {
      log.error(`${this.dataPath} doesn't exist`);
      return null;
    }
    log.debug(`Loading documents from ${this.dataPath}`);
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
    log.debug('Vector store build done');
    this.vectorStore = store;
    await this.save();
    log.notice('Vector store create done');
    return store;
  }
  async save() {
    log.debug(`Save vector store to ${this.storePath}`);
    return await this.vectorStore.save(this.storePath);
  }
  async resume() {
    if (!fs.existsSync(this.storePath)) return false;
    log.debug(`Resume vector store from ${this.storePath}`);
    try {
      this.vectorStore = await FaissStore.load(
        this.storePath,
        new OpenAIEmbeddings()
      );
      log.notice('Vector store resumed');
      return true;
    } catch {
      return false;
    }
  }
  async getPrompt() {
    if (!fs.existsSync(`${this.dataPath}/preset.conf`)) {
      log.warn(`Conf file for ${this.dataPath} doesn't exist, using default`);
      return '';
    }
    const data = fs.readFileSync(`${this.dataPath}/preset.conf`);
    return data.toString().trim();
  }
}