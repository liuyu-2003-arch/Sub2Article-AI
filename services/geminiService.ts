import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// === 核心 Prompt 修改 ===
// 1. 增加了“禁止使用列表符号”的指令
// 2. 增加了“文章总结”的生成指令
const BASE_PROMPT = `附件是一个视频语音识别转成的文字，请分析其语言内容并按以下规则整理：

1. **如果是英文（或中英双语）内容**：
   - **第一步（合并）**：首先将细碎的字幕行合并成逻辑完整、通顺的【英文段落】。
   - **第二步（翻译）**：将整理好的英文段落翻译成地道的【中文段落】。
   - **第三步（输出格式）**：请严格按照**“一段英文，一段中文”**的格式输出。
     * **正确格式示例**：

       Here is the content of the first English paragraph. It should be a complete logical section without any bullet points at the beginning.

       这是第一段英文对应的中文翻译内容。

       Here is the content of the second English paragraph.

       这是第二段英文对应的中文翻译内容。

   - **严禁（非常重要）**：英文和中文段落开头**绝对不要**添加圆点（•）、短横线（-）、星号（*）等列表符号，直接输出纯文本。
   - **完整性**：每一段英文后面**必须**紧跟其中文翻译，不得遗漏。

2. **如果是纯中文内容**：
   - 请整理成通顺的中文段落，修改错别字，优化标点，保持逻辑清晰。

3. **文章结尾要求**：
   - 在正文全部结束后，请输出一个分隔线 `---`。
   - 然后换行输出二级标题 `## 文章总结`。
   - 接着用中文列出 3-5 点文章的核心内容总结。

**通用极其重要规则**：
- **完整性**：不要删除任何核心信息，保持内容完整。
- **格式**：使用 Markdown 格式（如粗体强调重点等）。
- **零废话**：**禁止**添加任何开场白（如“好的...”），直接开始输出正文。`;

const CONTINUE_PROMPT_TEMPLATE = `我正在整理视频字幕，之前的生成因为长度限制中断了。

【任务目标】：
请根据提供的【原始全文】和【已生成的结尾内容】，定位中断位置，并**紧接着**继续生成剩余部分。

【格式要求】：
1. **严格保持**之前的格式（一段英文，一段中文）。
2. **严禁**使用列表符号（如 • 或 -）作为段落开头。
3. **严禁**重复已生成的内容。
4. 如果正文已经结束，请检查是否已生成“文章总结”；如果没有，请在末尾补充分隔线 `---` 和 `## 文章总结`。

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
  if (!process.env.API_KEY) {
    throw new Error("Missing API Key");
  }
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