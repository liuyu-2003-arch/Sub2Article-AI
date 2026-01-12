import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// === 智能多语言 Prompt ===
// 核心改动：增加了对输入语言的判断逻辑
// 1. 英文 -> 英中对照
// 2. 中文 -> 纯中文整理

const BASE_PROMPT = `你是一个专业的视频字幕整理助手。请分析附件中的语音识别文字，并根据其语言类型按以下规则处理。

【处理逻辑】：
**第一步：识别语言**
判断输入文本的主要语言是中文还是英文（或其他外语）。

**第二步：根据语言执行不同任务**

🔵 **情况 A：如果是英文（或非中文外语）**
   1. **重组**：将破碎的字幕行合并为逻辑通顺的英文长段落。
   2. **翻译**：将整理后的英文段落翻译成地道的中文。
   3. **输出格式（英中对照）**：
      [英文段落]
      (空一行)
      [中文翻译段落]
      ...
   4. **要求**：一段英文对应一段中文，**严禁**使用列表符号（- 或 *）开头。

🔴 **情况 B：如果是中文**
   1. **重组**：将破碎的字幕行合并为逻辑通顺的中文长段落。
   2. **润色**：修正语音识别导致的错别字、谐音字，优化标点符号。
   3. **输出格式（纯中文）**：
      [中文段落]
      (空一行)
      [下一个中文段落]
      ...
   4. **要求**：直接输出整理好的中文文章，**不需要**翻译成英文，**严禁**使用列表符号。

**第三步：结尾要求（通用）**
当正文全部整理完毕后，必须在文末补充以下内容：
   ---
   ## 文章总结
   (列出 3-5 点核心内容摘要，使用中文)
   ---
   ## 关联阅读
   (推荐 3 个相关的延伸阅读话题或书籍)

**通用禁令**：
- **禁止**生成文章主标题（H1），直接开始正文。
- **禁止**添加开场白（如“好的，这是整理后的...”）。

【输入数据】：`;

const CONTINUE_PROMPT_TEMPLATE = `我正在整理视频字幕，之前的生成因为长度限制中断了。

【任务目标】：
请根据提供的【原始全文】和【已生成的结尾内容】，定位中断位置，并**紧接着**继续生成剩余部分。

【智能续写要求】：
1. **保持格式一致性**：
   - 如果上文是【英中对照】，请继续保持“英文+中文”的格式。
   - 如果上文是【纯中文】，请继续保持纯中文段落格式。
2. **禁止列表**：正文段落开头绝对不能有 - 或 *。
3. **检查结尾**：如果原文内容已全部处理完，**必须**在最后生成：
   ---
   ## 文章总结
   (3-5点总结)
   ---
   ## 关联阅读
   (3个相关话题)

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
    // 这里的提示词也要微调，适应双语或单语
    finalPrompt += `\n
【关于标题】：
系统已生成文件名/标题（H1）："${title}"。
**请按以下规则处理标题翻译（作为副标题 H2）**：
1. 如果原文是英文：请翻译成中文作为副标题输出。
2. 如果原文是中文：**不需要**输出副标题，直接开始正文。
3. 输出副标题后（如果有），请输出分隔线 "---"。

示例结构（英文源）：
## (中文翻译标题)
---
(正文...)

示例结构（中文源）：
(直接开始正文...)
`;
  } else {
    finalPrompt += `\n【注意】：直接开始整理正文内容。`;
  }

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.0-flash', // 建议保持使用 2.0 Flash 或 1.5 Flash
      contents: `${finalPrompt}\n\n待处理文字如下：\n---\n${text}`,
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