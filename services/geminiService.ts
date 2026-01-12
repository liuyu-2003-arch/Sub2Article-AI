import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// === 优化后的 Prompt：更直接、兼容 SRT 格式 ===
const BASE_PROMPT = `你是一个专业的文章整理專家。下方提供的是一段包含时间轴的字幕文本（SRT格式）。
请忽略所有时间轴（如 00:00:01,366）和行号，直接提取核心内容并整理成一篇通顺的文章。

【根据语言类型执行不同策略】：

**情况 1：如果是英文内容**
请按“英中对照”格式输出：
1. 将破碎的英文句子合并为完整的段落。
2. 在每段英文下方直接附上中文翻译。
3. 格式要求：[英文段落] (换行) [中文翻译]

**情况 2：如果是中文内容（重要！）**
请直接整理为一篇高质量的中文文章：
1. **合并段落**：将短句合并为逻辑通顺的长自然段。
2. **文字润色**：修正语音识别的错别字（如谐音错字）、去除口语废话（如“那个”、“呃”），优化标点符号。
3. **格式要求**：直接输出整理好的中文段落，**不需要**翻译成英文，**严禁**包含时间轴。

【结尾要求】：
全文结束后，必须输出：
---
## 文章总结
(3-5点核心摘要)
---
## 关联阅读
(3个相关话题推荐)

【严禁事项】：
- 严禁输出 "好的，我来整理..." 之类的废话，直接开始输出正文。
- 严禁使用列表符号（- 或 *）作为正文段落开头。

【待处理文本】：`;

const CONTINUE_PROMPT_TEMPLATE = `我正在整理视频字幕，之前的生成因為長度限制中斷了。

【任务目標】：
請根據提供的【原始全文】和【已生成的結尾內容】，定位中斷位置，並**緊接著**繼續生成剩餘部分。

【格式要求】：
1. 如果上文是中文，請繼續輸出**純中文段落**。
2. 如果上文是英中對照，請繼續保持**英中對照**格式。
3. **嚴禁**重復已生成的內容。
4. 如果原文內容已全部處理完，**必須**在最後生成「文章總結」和「關聯閱讀」。

【輸入數據】：`;

export interface StreamUpdate {
  text: string;
  isComplete: boolean;
}

/**
 * 处理字幕的主函数
 */
export async function* processSubtitleToArticleStream(text: string, title: string = ''): AsyncGenerator<StreamUpdate> {
  if (!process.env.API_KEY) {
    throw new Error("Missing API Key");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  let finalPrompt = BASE_PROMPT;

  // 对于标题的处理，也做简化，防止干扰正文生成
  if (title) {
    finalPrompt += `\n
【关于标题】：
文件原名是："${title}"
如果原名是英文，请在文章开头翻译为中文副标题（## 格式）；
如果原名已经是中文，则**忽略此步骤**，直接开始整理正文。
`;
  }

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.0-flash',
      contents: `${finalPrompt}\n\n${text}`, // 直接拼接文本，减少层级
      config: {
        temperature: 0.1, // 保持低温，确保只会做整理，不会乱发挥
        topP: 0.95,
        topK: 40,
      },
    });

    for await (const chunk of responseStream) {
      const part = chunk as GenerateContentResponse;
      const textChunk = part.text || "";
      const finishReason = part.candidates?.[0]?.finishReason;
      const isComplete = finishReason === 'STOP';

      yield { text: textChunk, isComplete };
    }
  } catch (error) {
    console.error("Gemini processing error:", error);
    throw error;
  }
}

/**
 * 续写处理函数
 */
export async function* continueProcessingStream(originalText: string, currentOutput: string): AsyncGenerator<StreamUpdate> {
  if (!process.env.API_KEY) {
    throw new Error("Missing API Key");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const lastPart = currentOutput.slice(-1000);

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.0-flash',
      contents: `${CONTINUE_PROMPT_TEMPLATE}

【已生成的结尾内容（请从此内容之后紧接着开始）】：
...${lastPart}

【原始全文】：
${originalText}`,
      config: {
        temperature: 0.1,
        topP: 0.95,
        topK: 40,
      },
    });

    for await (const chunk of responseStream) {
      const part = chunk as GenerateContentResponse;
      const textChunk = part.text || "";
      const finishReason = part.candidates?.[0]?.finishReason;
      const isComplete = finishReason === 'STOP';

      yield { text: textChunk, isComplete };
    }
  } catch (error) {
    console.error("Gemini continue error:", error);
    throw error;
  }
}