import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// === 增强版 Prompt ===
// 核心改动：
// 1. 引入 "Block" 概念，强迫 AI 将内容视为一个个独立的块来处理，防止格式跑偏。
// 2. 增加了 Negative Constraints (负向约束) 来禁止列表符号。
// 3. 明确了“结尾信号”，确保总结一定会出现。

const BASE_PROMPT = `你是一个专业的字幕整理与翻译助手。你的任务是将杂乱的语音识别文本重组为一篇格式完美的【英中对照】文章。

【处理流程】：
1. **重组（Rephrase）**：将细碎的字幕行合并成逻辑通顺、语义完整的**长段落**。不要逐句翻译，要按“自然段”处理。
2. **翻译（Translate）**：将合并后的英文段落翻译成地道的中文段落。
3. **输出（Output）**：严格按照下面的格式输出。

【严格的输出格式规范】：
- **格式结构**：
  [英文自然段文本]
  (空一行)
  [对应的中文翻译自然段]
  (空一行)
  [下一个英文自然段文本]
  ...

- **禁止事项**：
  ❌ **严禁**使用任何列表符号（如 -、*、•、1. 等）作为段落开头。
  ❌ **严禁**只输出英文不输出中文，必须成对出现。
  ❌ **严禁**使用方括号 [] 包裹内容。

- **结尾要求**：
  当所有正文内容处理完毕后，必须：
  1. 输出一个分隔线：---
  2. 输出二级标题：## 文章总结
  3. 用中文列出 3-5 点核心内容摘要（此处可以使用列表符号）。

【示例】：
The longest study on happiness has shown that deep relationships are key to our well-being. It's not about money or fame, but about the connections we build.

这项关于幸福的最长研究表明，深厚的人际关系是我们幸福的关键。这与金钱或名声无关，而在于我们建立的联系。

(Next paragraph...)
`;

const CONTINUE_PROMPT_TEMPLATE = `我正在整理视频字幕，之前的生成因为长度限制中断了。

【任务目标】：
请根据提供的【原始全文】和【已生成的结尾内容】，定位中断位置，并**紧接着**继续生成剩余部分。

【强制约束】：
1. **保持格式**：继续按照“一段英文（无列表符）、空行、一段中文（无列表符）”的格式输出。
2. **禁止列表**：正文段落开头绝对不能有 - 或 *。
3. **检查结尾**：如果原文内容已全部处理完，**必须**在最后生成：
   ---
   ## 文章总结
   (3-5点总结内容)

【输入数据】：`;

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
  if (title) {
    finalPrompt += `\n
【标题任务】：
文章开头请先输出一级标题的中文翻译，使用二级标题格式 (## )，例如：
## ${title} (中文翻译)

然后直接开始正文整理。
`;
  } else {
    finalPrompt += `\n【注意】：直接开始整理正文内容。`;
  }

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.0-flash',
      contents: `${finalPrompt}\n\n待处理文字如下：\n---\n${text}`,
      config: {
        temperature: 0.1, // 低温度保持格式稳定
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

  // 截取更多上下文以确保格式连贯，但不要太长以免占用 token
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