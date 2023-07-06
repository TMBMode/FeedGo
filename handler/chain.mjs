import { OpenAI } from 'langchain/llms/openai';
import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { BufferMemory } from "langchain/memory";
import { Store, CHUNK } from './store.mjs';
export { CHUNK };

const CONDENSE_PROMPT = '' + 
`Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.
Use the same language as the conversation.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`;

const QA_PROMPT = '' + 
`You are a helpful AI assistant. Use the following pieces of context to answer the question at the end.
The AI uses the same language as the human.
If the AI doesn't know how to respond, the AI says that the AI doesn't know. DO NOT try to make up an answer.

{context}

Question: {question}
Helpful answer:`;

export const makeChain = async (name, chunk) => {
  const model = new OpenAI({
    temperature: 0.5,
    modelName: 'gpt-3.5-turbo',
  });
  const store = new Store(name, chunk);
  const vectorStore = await store.load();
  if (!vectorStore) return;
  return ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorStore.asRetriever(),
    {
      memory: new BufferMemory({
        memoryKey: "chat_history",
      }),
      qaTemplate: QA_PROMPT,
      questionGeneratorTemplate: CONDENSE_PROMPT,
      returnSourceDocuments: false
    },
  );
};