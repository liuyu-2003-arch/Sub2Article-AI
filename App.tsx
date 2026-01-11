import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  Download,
  Sparkles,
  Zap,
  Globe,
  Brain,
  FileText,
  Trash2,
  Copy,
  ChevronRight,
  ArrowRight,
  PlayCircle // 新增图标
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
// 引入新的 continueProcessingStream 函数
import { processSubtitleToArticleStream, continueProcessingStream } from './services/geminiService';
import { AppStatus } from './types';

const App: React.FC = () => {
  // ... (状态变量保持不变)
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [notionCopied, setNotionCopied] = useState<boolean>(false);
  const [progress, setProgress] = useState(0);

  const outputEndRef = useRef<HTMLDivElement>(null);

  // ... (useEffect 和其他辅助函数保持不变) ...

  const handleProcess = async () => {
    // ... (保持不变) ...
    if (!inputText.trim()) return;
    
    const initialText = fileName ? `# ${fileName}\n\n` : '';
    setOutputText(initialText);
    setStatus(AppStatus.LOADING);
    setError(null);
    
    try {
      const stream = processSubtitleToArticleStream(inputText);
      let fullText = initialText;
      for await (const chunk of stream) {
        fullText += chunk;
        setOutputText(fullText);
      }
      
      setStatus(AppStatus.SUCCESS);
    } catch (err: any) {
      setError(err.message || "处理过程中发生错误，请稍后重试。");
      setStatus(AppStatus.ERROR);
    }
  };

  // === 新增：处理“继续生成”的逻辑 ===
  const handleContinue = async () => {
    if (!inputText.trim() || !outputText) return;

    // 保持状态为 SUCCESS 或 LOADING 都可以，这里用 LOADING 触发动画
    const preText = outputText; 
    setStatus(AppStatus.LOADING);
    setError(null);

    try {
      // 调用续写服务
      const stream = continueProcessingStream(inputText, preText);
      let fullText = preText; // 从现有文本开始累加
      
      // 添加两个换行，确保和上一段分开
      fullText += "\n\n"; 
      
      for await (const chunk of stream) {
        fullText += chunk;
        setOutputText(fullText);
      }
      
      setStatus(AppStatus.SUCCESS);
    } catch (err: any) {
      setError("续写失败: " + (err.message || "请重试"));
      setStatus(AppStatus.ERROR); // 这里即使出错，用户也可以再次点击继续
    }
  };

  // ... (reset, copyForNotion, downloadResult 等函数保持不变) ...

  return (
    <div className="min-h-screen flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header 保持不变 */}
      <header className="...">
         {/* ... */}
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12 flex flex-col justify-start">
        {status === AppStatus.IDLE ? (
           // ... (IDLE 状态的 UI 保持不变) ...
           <div className="...">...</div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-700">
            {/* 顶部工具栏保持不变 */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/50 backdrop-blur-sm p-3 rounded-2xl border border-slate-100/50">
               {/* ... */}
            </div>

            <div className={`bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/20 border border-slate-100 min-h-[60vh] relative ${status === AppStatus.ERROR ? 'border-red-200 bg-red-50/10' : ''}`}>
              <div className="p-8 md:p-14 lg:p-20">
                {status === AppStatus.ERROR && !outputText ? (
                   // 如果还没生成任何内容就报错，显示原来的错误页
                  <div className="...">...</div>
                ) : (
                  <article className="prose prose-indigo max-w-none prose-h1:tracking-[0.1em] prose-h1:leading-normal prose-h1:text-center prose-h1:mb-12">
                    {outputText ? (
                      <div className="text-slate-700">
                        <ReactMarkdown>{outputText}</ReactMarkdown>
                        {status === AppStatus.LOADING && (
                          <div className="inline-flex items-center mt-6">
                            <span className="inline-block w-2 h-6 bg-indigo-500 animate-pulse align-middle" />
                            <span className="ml-3 text-indigo-400 text-xs font-bold animate-pulse">AI 正在思考中...</span>
                          </div>
                        )}
                        
                        {/* === 新增：在文章底部显示“继续生成”按钮 === */}
                        {status !== AppStatus.LOADING && (
                          <div className="mt-12 pt-8 border-t border-dashed border-slate-200 flex justify-center">
                            <button 
                              onClick={handleContinue}
                              className="group flex items-center gap-2 px-6 py-3 bg-white border-2 border-indigo-100 text-indigo-600 rounded-full font-bold hover:bg-indigo-50 hover:border-indigo-200 hover:scale-105 transition-all shadow-sm"
                            >
                              <PlayCircle className="w-5 h-5" />
                              文章未完？点击继续生成
                              <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        )}

                      </div>
                    ) : (
                      // Loading 状态的占位符保持不变
                      <div className="...">...</div>
                    )}
                    <div ref={outputEndRef} />
                  </article>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer 保持不变 */}
      <footer className="...">...</footer>
    </div>
  );
};

export default App;