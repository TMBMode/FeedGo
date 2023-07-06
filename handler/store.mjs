import fs from 'fs';
import { FaissStore } from 'langchain/vectorstores/faiss';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { log } from '../utils/logging.mjs';

export const CHUNK = {
  tiny: {
    chunkSize: 100,
    chunkOverlap: 20
  },
  small: {
    chunkSize: 400,
    chunkOverlap: 80
  },
  medium: {
    chunkSize: 1000,
    chunkOverlap: 200
  },
  large: {
    chunkSize: 1800,
    chunkOverlap: 360
  },
  huge: {
    chunkSize: 4000,
    chunkOverlap: 800
  }
};

const DATA_BASE_PATH = process.env.DATA_BASE_PATH ?? 'data';
const STORE_BASE_PATH = process.env.STORE_BASE_PATH ?? 'vstores';

export class Store {
  constructor(name, chunk) {
    this.dataPath = `${DATA_BASE_PATH}/${name}`;
    this.storePath = `${STORE_BASE_PATH}/${name}`;
    this.chunkConf = chunk ?? CHUNK.medium;
    this.vectorStore = null;
  }
  async load() {
    if (await this.resume()) return this.vectorStore;
    if (!fs.existsSync(this.dataPath)) {
      log.error(`${this.dataPath} doesn't exist`);
      return null;
    }
    log.debug(`Load documents from ${this.dataPath}`);
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
    log.debug('Finish parsing documents, post embedding requests');
    const store = await FaissStore.fromDocuments(
      data,
      new OpenAIEmbeddings()
    );
    log.debug('Vector store build done');
    await this.save();
    return this.vectorStore = store;
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
      return true;
    } catch {
      return false;
    }
  }
}



export const run = async () => {
  console.log('start');
  const vectorStore = await FaissStore.fromTexts(
    ["Hello world", "Bye bye", "hello nice world", "holy shit", "damn it!"],
    [{ id: 2 }, { id: 1 }, { id: 3 }],
    new OpenAIEmbeddings()
  );
  console.log('saving');
  await vectorStore.save('data');
  console.log('search');
  const resultOne = await vectorStore.similaritySearch("fuck", 3);
  console.log(resultOne);
};

//run();
//FaissStore.load('idk',new OpenAIEmbeddings());