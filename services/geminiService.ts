import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// 修改要点：
// 1. 更新了格式示例，去掉了示例中的 []
// 2. 增加了明确的禁止指令：不要在段落首尾添加方括号
const PROMPT_TEMPLATE = `附件是一个视频语音识别转成的文字，请分析其语言内容并按以下规则整理：

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
- **格式**：使用 Markdown 格式（如二级标题、粗体强调重点等）。
- **零废话**：**禁止**生成文章标题（H1）、开场白（如“好的，这是整理后的...”）、结语或任何解释性文字，**直接开始输出正文**。`;

/**
 * Processes subtitle text into a structured article using Gemini API.
 * Uses streaming to provide real-time updates to the UI.
 */
export async function* processSubtitleToArticleStream(text: string) {
  // Always use direct initialization with process.env.API_KEY as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.0-flash', // 继续推荐使用 gemini-2.0-flash 以获得最佳指令遵循效果
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