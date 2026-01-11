import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// 修改了提示词模板，增加了对英文和双语内容的特定处理指令
const PROMPT_TEMPLATE = `附件是一个视频语音识别转成的文字，请分析其语言内容并按以下规则整理：

1. **如果是纯英文内容**：
   请整理成【英中对照】的文章格式。
   - 将内容合理分段。
   - 每一段先输出整理后的【英文原文】，紧接着换行输出对应的【中文翻译】。
   - 确保翻译准确、通顺。

2. **如果是中英双语混合内容**：
   请整理成【英中对照】的文章格式。
   - 识别对应的英文和中文部分，对应排列，一段英文后接一段中文。

3. **如果是纯中文内容**：
   请整理成通顺的中文段落，修改错别字，优化标点，保持逻辑清晰。

**通用要求**：
- **不要删除**任何核心文字或信息，保持内容完整。
- 请使用 Markdown 格式输出（例如：使用合适的二级标题、粗体强调重点、列表等），使生成的文章结构清晰且易于阅读。
- **禁止**生成任何文章主标题（H1）或题目，因为题目已由系统自动提供。
- **禁止**包含任何开场白、介绍语（如“以下是整理后的内容...”）、结语或任何解释性文字，直接输出正文。`;

/**
 * Processes subtitle text into a structured article using Gemini API.
 * Uses streaming to provide real-time updates to the UI.
 */
export async function* processSubtitleToArticleStream(text: string) {
  // Always use direct initialization with process.env.API_KEY as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.0-flash', // 建议升级模型版本以获得更好的指令遵循能力，原代码为 gemini-3-flash-preview 可能不稳定或不可用，建议用 gemini-2.0-flash 或 gemini-1.5-flash
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