import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// ... (保留之前的 PROMPT_TEMPLATE 代码不变) ...
// 请确保 PROMPT_TEMPLATE 保持上一轮修改后的样子（不带方括号的版本）

// === 新增：续写专用的 Prompt 模板 ===
const CONTINUE_PROMPT_TEMPLATE = `我正在整理视频字幕，之前的生成因为长度限制中断了。

【任务目标】：
请根据提供的【原始全文】和【已生成的结尾内容】，定位中断位置，并**紧接着**继续生成剩余部分。

【格式要求】：
1. **严格保持**之前的格式（一段英文，一段中文）。
2. **严禁**重复已生成的内容。
3. **严禁**添加任何开场白（如“接上文...”），直接输出接续的正文。
4. 英文段落首尾**不要**加方括号。

【输入数据】：`;

/**
 * 现有的处理函数 (保持不变)
 */
export async function* processSubtitleToArticleStream(text: string) {
  // ... (保持原有的代码不变)
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.0-flash',
      contents: `${PROMPT_TEMPLATE}\n\n待处理文字如下：\n---\n${text}`,
      config: {
        temperature: 0.1,
        topP: 0.95,
        topK: 40,
      },
    });

    for await (const chunk of responseStream) {
      const part = chunk as GenerateContentResponse;
      yield part.text || "";
    }
  } catch (error) {
    console.error("Gemini processing error:", error);
    throw error;
  }
}

/**
 * === 新增：续写处理函数 ===
 */
export async function* continueProcessingStream(originalText: string, currentOutput: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // 截取已生成内容的最后 500 个字符作为“定位锚点”
  const lastPart = currentOutput.slice(-500);

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
      yield part.text || "";
    }
  } catch (error) {
    console.error("Gemini continue error:", error);
    throw error;
  }
}