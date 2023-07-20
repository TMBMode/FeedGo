import { PromptTemplate } from "langchain/prompts";
import { BaseChain, LLMChain, loadQAChain } from "langchain/chains";
const question_generator_template = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`;
export class CRChain extends BaseChain {
    get inputKeys() {
        return [this.inputKey, this.chatHistoryKey];
    }
    get outputKeys() {
        return this.combineDocumentsChain.outputKeys.concat(this.returnSourceDocuments ? ["sourceDocuments"] : []);
    }
    constructor(fields) {
        super(fields);
        Object.defineProperty(this, "inputKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "question"
        });
        Object.defineProperty(this, "chatHistoryKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "chat_history"
        });
        Object.defineProperty(this, "retriever", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "combineDocumentsChain", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "questionGeneratorChain", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "returnSourceDocuments", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        this.retriever = fields.retriever;
        this.combineDocumentsChain = fields.combineDocumentsChain;
        this.questionGeneratorChain = fields.questionGeneratorChain;
        this.inputKey = fields.inputKey ?? this.inputKey;
        this.returnSourceDocuments =
            fields.returnSourceDocuments ?? this.returnSourceDocuments;
        this.historyKey = fields.historyKey;
    }
    getChatHistoryString(chatHistory) {
        if (chatHistory.length === 0) return '无';
        if (Array.isArray(chatHistory)) {
            return chatHistory
                .map((chatMessage) => {
                if (chatMessage._getType() === "human") {
                    return `${this.historyKey.human}${chatMessage.text}`;
                }
                else if (chatMessage._getType() === "ai") {
                    return `${this.historyKey.bot}${chatMessage.text}`;
                }
                else {
                    return `${chatMessage.text}`;
                }
            })
                .join("\n");
        }
        return chatHistory
            .replace(/^AI: /gm, this.historyKey.bot)
            .replace(/^Human: /gm, this.historyKey.human)
            .replace(/^System: /gm, this.historyKey.system)
        ;
    }
    /** @ignore */
    async _call(values, runManager) {
        if (!(this.inputKey in values)) {
            throw new Error(`Question key ${this.inputKey} not found.`);
        }
        if (!(this.chatHistoryKey in values)) {
            throw new Error(`Chat history key ${this.chatHistoryKey} not found.`);
        }
        const question = values[this.inputKey];
        const chatHistory = this.getChatHistoryString(values[this.chatHistoryKey]);
        let newQuestion = question;
        if (chatHistory.length > 0) {
            const result = await this.questionGeneratorChain.call({
                question,
                chat_history: chatHistory,
            }, runManager?.getChild("question_generator"));
            const keys = Object.keys(result);
            if (keys.length === 1) {
                newQuestion = result[keys[0]].replace(/<\/\w+>$/, '');
            }
            else {
                throw new Error("Return from llm chain has multiple values, only single values supported.");
            }
        }
        const docs = await this.retriever.getRelevantDocuments(newQuestion);
        const inputs = {
            question: newQuestion,
            input_documents: docs,
            chat_history: chatHistory,
        };
        const result = await this.combineDocumentsChain.call(inputs, runManager?.getChild("combine_documents"));
        if (this.returnSourceDocuments) {
            return {
                ...result,
                sourceDocuments: docs,
                newQuestion
            };
        }
        return result;
    }
    _chainType() {
        return "conversational_retrieval_chain";
    }
    static async deserialize(_data, _values) {
        throw new Error("Not implemented.");
    }
    serialize() {
        throw new Error("Not implemented.");
    }
    static fromLLM(llm, retriever, options = {}) {
        const { questionGeneratorTemplate, qaTemplate, qaChainOptions = {
            type: "stuff",
            prompt: qaTemplate
                ? PromptTemplate.fromTemplate(qaTemplate)
                : undefined,
        }, questionGeneratorChainOptions, verbose, historyKey = {
            bot: '智能助手：',
            human: '用户：',
            system: '系统：',
        }, ...rest } = options;
        const qaChain = loadQAChain(llm, qaChainOptions);
        const questionGeneratorChainPrompt = PromptTemplate.fromTemplate(questionGeneratorChainOptions?.template ??
            questionGeneratorTemplate ??
            question_generator_template);
        const questionGeneratorChain = new LLMChain({
            prompt: questionGeneratorChainPrompt,
            llm: questionGeneratorChainOptions?.llm ?? llm,
            verbose,
        });
        const instance = new this({
            retriever,
            combineDocumentsChain: qaChain,
            questionGeneratorChain,
            verbose,
            historyKey,
            ...rest,
        });
        return instance;
    }
}
