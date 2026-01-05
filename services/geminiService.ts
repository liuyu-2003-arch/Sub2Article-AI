
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const PROMPT_TEMPLATE = `附件是一个视频语音识别转成的文字，帮我整理成段落，修改部分错别字，但是不要删除任何文字。【注意要整理成段落】
请使用 Markdown 格式输出（例如：使用合适的标题、粗体强调重点、列表等），使生成的文章结构清晰且易于阅读。

【极其重要】：直接输出整理后的正文内容。禁止包含任何开场白、介绍语（如“以下是整理后的内容...”）、结语或任何解释性文字。`;

/**
 * Processes subtitle text into a structured article using Gemini API.
 * Uses streaming to provide real-time updates to the UI.
 */
export async function* processSubtitleToArticleStream(text: string) {
  // Always use direct initialization with process.env.API_KEY as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: `${PROMPT_TEMPLATE}\n\n待处理文字如下：\n---\n${text}`,
      config: {
        temperature: 0.1,
        topP: 0.95,
        topK: 40,
      },
    });

    for await (const chunk of responseStream) {
      // Accessing .text property directly as it is a getter, not a method
      const part = chunk as GenerateContentResponse;
      yield part.text || "";
    }
  } catch (error) {
    console.error("Gemini processing error:", error);
    throw error;
  }
}
