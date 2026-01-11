import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// 基础 Prompt
const BASE_PROMPT = `附件是一个视频语音识别转成的文字，请分析其语言内容并按以下规则整理：

1. **如果是英文（或中英双语）内容**：
   - **第一步（合并）**：首先将细碎的字幕行合并成逻辑完整、通顺的【英文段落】。
   - **第二步（翻译）**：将整理好的英文段落翻译成地道的【中文段落】。
   - **第三步（输出格式）**：请严格按照**“一段英文，一段中文”**的格式输出。
     * **正确格式示例**（注意：直接输出文字，不要加任何括号）：

       Here is the content of the first English paragraph. It should be a complete logical section.

       这是第一段英文对应的中文翻译内容。

       Here is the content of the second English paragraph.

       这是第二段英文对应的中文翻译内容。

   - **严禁**：不要一句英文一句中文地穿插，必须是以“自然段”为单位进行对照。
   - **严禁**：英文段落首尾**绝对不要**添加方括号 [] 或其他标记符号。

2. **如果是纯中文内容**：
   - 请整理成通顺的中文段落，修改错别字，优化标点，保持逻辑清晰。

**通用极其重要规则**：
- **完整性**：不要删除任何核心信息，保持内容完整。
- **格式**：使用 Markdown 格式（如粗体强调重点等）。
- **零废话**：**禁止**添加任何开场白（如“好的...”）或结语。`;

const CONTINUE_PROMPT_TEMPLATE = `我正在整理视频字幕，之前的生成因为长度限制中断了。

【任务目标】：
请根据提供的【原始全文】和【已生成的结尾内容】，定位中断位置，并**紧接着**继续生成剩余部分。

【格式要求】：
1. **严格保持**之前的格式（一段英文，一段中文）。
2. **严禁**重复已生成的内容。
3. **严禁**添加任何开场白，直接输出接续的正文。
4. 英文段落首尾**不要**加方括号。

【输入数据】：`;

export interface StreamUpdate {
  text: string;
  isComplete: boolean;
}

/**
 * 处理字幕的主函数
 */
export async function* processSubtitleToArticleStream(text: string, title: string = ''): AsyncGenerator<StreamUpdate> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  let finalPrompt = BASE_PROMPT;
  if (title) {
    // === 修改核心逻辑：明确要求输出翻译结果，而不是拼接字符串 ===
    finalPrompt += `\n
【关于标题处理】：
系统已自动生成了英文主标题（H1）："${title}"
**你的任务是**：
将该英文标题翻译成中文，并直接作为 **二级标题 (##)** 输出在正文最开始。
示例输出结构：
## [这里直接输出中文翻译结果]

[正文开始...]
`;
  } else {
    finalPrompt += `\n【注意】：直接开始整理正文内容，无需生成主标题。`;
  }

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.0-flash',
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const lastPart = currentOutput.slice(-800);

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