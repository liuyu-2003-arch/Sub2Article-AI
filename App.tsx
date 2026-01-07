
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
  Brain
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { processSubtitleToArticleStream } from './services/geminiService';
import { AppStatus } from './types';

const App: React.FC = () => {
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [notionCopied, setNotionCopied] = useState<boolean>(false);
  const [progress, setProgress] = useState(0);

  const outputEndRef = useRef<HTMLDivElement>(null);

  // 模拟进度条逻辑
  useEffect(() => {
    let interval: number;
    if (status === AppStatus.LOADING) {
      setProgress(0);
      interval = window.setInterval(() => {
        setProgress(prev => {
          if (prev < 90) return prev + Math.random() * 5;
          return prev;
        });
      }, 300);
    } else if (status === AppStatus.SUCCESS) {
      setProgress(100);
    }
    return () => clearInterval(interval);
  }, [status]);

  // 自动滚动到底部
  useEffect(() => {
    if (status === AppStatus.LOADING || status === AppStatus.SUCCESS) {
      outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [outputText, status]);

  const getLoadingMessage = (p: number) => {
    if (p < 25) return "正在唤醒 AI 助手...";
    if (p < 50) return "正在分析视频转录结构...";
    if (p < 75) return "正在智能分段与润色...";
    return "即将完成，正在导出...";
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInputText(content);
    };
    reader.readAsText(file);
  };

  const handleProcess = async () => {
    if (!inputText.trim()) return;
    
    setOutputText('');
    setStatus(AppStatus.LOADING);
    setError(null);
    
    try {
      const stream = processSubtitleToArticleStream(inputText);
      let fullText = '';
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

  const reset = () => {
    setStatus(AppStatus.IDLE);
    setOutputText('');
    setError(null);
    setProgress(0);
  };

  const copyForNotion = () => {
    navigator.clipboard.writeText(outputText).then(() => {
      setNotionCopied(true);
      setTimeout(() => setNotionCopied(false), 2000);
    });
  };

  const downloadResult = () => {
    const element = document.createElement("a");
    const file = new Blob([outputText], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    const titleMatch = outputText.match(/^#+\s+(.*)/m);
    let fileName = titleMatch ? titleMatch[1].trim() : "整理后的文章";
    fileName = fileName.replace(/[\\/:*?"<>|]/g, "").substring(0, 100);
    element.download = `${fileName || "整理后的文章"}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 py-4 px-6 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-3 group">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-indigo-200 group-hover:rotate-6 transition-all duration-300">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-indigo-600 tracking-tight">
                Sub2Article AI
              </span>
            </a>
          </div>
          
          <div className="flex items-center gap-3">
             <button 
              onClick={reset}
              className="text-slate-400 hover:text-indigo-600 transition-colors text-xs font-bold"
            >
              重新开始
            </button>
          </div>
        </div>
        {status === AppStatus.LOADING && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-100 z-50">
            <div 
              className="h-full gradient-bg transition-all duration-500 ease-out relative shadow-[0_0_8px_rgba(99,102,241,0.6)]" 
              style={{ width: `${progress}%` }} 
            >
              <div className="absolute top-0 right-0 h-full w-20 bg-gradient-to-r from-transparent to-white/40 animate-pulse" />
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:py-6 md:px-12 relative flex flex-col justify-center">
        {status === AppStatus.IDLE ? (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center space-y-1">
              <h2 className="text-3xl font-extrabold text-slate-900 flex items-center justify-center gap-3">
                <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" /> 整理您的视频转录
              </h2>
              <p className="text-slate-500 text-sm">将混乱的语音识别文本转化为优雅的结构化文章</p>
            </div>

            <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100/50 border border-slate-100 overflow-hidden max-w-3xl mx-auto">
              <div className="p-6 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-indigo-500" /> 粘贴文本或上传文件
                  </h3>
                  <label className="cursor-pointer bg-slate-50 hover:bg-indigo-50 border border-dashed border-slate-300 hover:border-indigo-400 text-slate-600 hover:text-indigo-600 px-4 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5" /> 选择文件 (.txt, .srt)
                    <input type="file" className="hidden" accept=".txt,.srt" onChange={handleFileUpload} />
                  </label>
                </div>
                <textarea
                  className="w-full h-48 p-5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 resize-none bg-slate-50/50 text-slate-700 leading-relaxed transition-all outline-none text-sm"
                  placeholder="在此粘贴您的字幕或视频转录内容..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
                <button
                  onClick={handleProcess}
                  disabled={!inputText.trim()}
                  className={`w-full py-3.5 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] ${!inputText.trim() ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'gradient-bg text-white hover:shadow-xl hover:shadow-indigo-500/20'}`}
                >
                  <Sparkles className="w-5 h-5" /> 开始智能整理
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div className="flex-1 flex flex-col gap-1">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                  整理后的文章
                </h2>
              </div>
              {outputText && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button onClick={copyForNotion} className="flex items-center gap-2 px-4 py-1.5 bg-black text-white rounded-xl hover:bg-slate-800 transition-all text-xs font-bold shadow-md shadow-slate-200 group">
                      {notionCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <div className="w-3 h-3 bg-white rounded-[2px] flex items-center justify-center transition-transform group-active:scale-90"><span className="text-black font-bold text-[8px]">N</span></div>}
                      {notionCopied ? '已复制' : '复制到 Notion'}
                    </button>
                    <button onClick={downloadResult} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-xs font-bold shadow-lg shadow-indigo-200">
                      <Download className="w-3.5 h-3.5" /> 下载 MD
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className={`bg-white rounded-3xl shadow-xl border border-slate-100 min-h-[50vh] relative overflow-hidden ${status === AppStatus.ERROR ? 'border-red-200 bg-red-50/10' : ''}`}>
              <div className="p-6 md:p-10">
                {status === AppStatus.ERROR ? (
                  <div className="flex flex-col items-center justify-center h-full text-red-500 py-10 text-center gap-4">
                    <AlertCircle className="w-12 h-12" />
                    <div className="space-y-1">
                      <p className="text-lg font-bold">处理失败</p>
                      <p className="text-slate-600 text-sm">{error}</p>
                    </div>
                    <button onClick={handleProcess} className="mt-2 text-indigo-600 font-bold hover:underline text-sm">尝试重试</button>
                  </div>
                ) : (
                  <article className="prose prose-sm md:prose-base prose-indigo max-w-none">
                    {outputText ? (
                      <div className="text-slate-800 leading-relaxed">
                        <ReactMarkdown>{outputText}</ReactMarkdown>
                        {status === AppStatus.LOADING && (
                          <div className="inline-flex items-center gap-1">
                            <span className="inline-block w-2 h-5 bg-indigo-500 animate-pulse align-middle" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-8">
                        <div className="relative">
                          <div className="absolute -inset-4 bg-indigo-100/50 rounded-full animate-ping opacity-25" />
                          <div className="relative bg-white p-6 rounded-3xl shadow-2xl border border-slate-100 animate-float">
                            <Brain className="w-12 h-12 text-indigo-600" />
                          </div>
                        </div>
                        
                        <div className="space-y-6 w-full max-w-sm">
                          <div className="text-center space-y-2">
                            <p className="text-slate-700 font-bold text-lg">
                              {getLoadingMessage(progress)}
                            </p>
                            <p className="text-slate-400 text-xs font-medium">正在利用 Gemini 智能推理能力...</p>
                          </div>
                          
                          <div className="space-y-4 opacity-40">
                            <div className="h-4 bg-slate-100 rounded-full w-3/4 animate-pulse" style={{ animationDelay: '0ms' }} />
                            <div className="h-4 bg-slate-100 rounded-full w-full animate-pulse" style={{ animationDelay: '200ms' }} />
                            <div className="h-4 bg-slate-100 rounded-full w-5/6 animate-pulse" style={{ animationDelay: '400ms' }} />
                            <div className="h-4 bg-slate-100 rounded-full w-2/3 animate-pulse" style={{ animationDelay: '600ms' }} />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={outputEndRef} />
                  </article>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-6 px-6 border-t border-slate-100 mt-auto bg-white/50">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-center gap-3 md:gap-8 text-[11px] text-slate-400 font-medium">
          <a href="https://324893.xyz" target="_blank" className="hover:text-indigo-600 transition-colors flex items-center gap-1.5 group">
            <Globe className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" /> 官方主页: 324893.xyz
          </a>
          <div className="hidden md:block w-px h-3 bg-slate-200"></div>
          <p className="flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-indigo-400" /> 由 Google Gemini AI 驱动 · 智能分段 & 错别字纠正
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
