import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
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
import { processSubtitleToArticleStream, continueProcessingStream } from './services/geminiService';
import { AppStatus } from './types';

const App: React.FC = () => {
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [notionCopied, setNotionCopied] = useState<boolean>(false);
  const [progress, setProgress] = useState(0);

  const outputEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (status === AppStatus.LOADING || status === AppStatus.SUCCESS) {
      // 只有在非用户手动滚动时才自动滚动到底部（这里简化处理，总是滚动）
      outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [outputText, status]);

  const getLoadingMessage = (p: number) => {
    if (p < 25) return "AI 助手已就绪...";
    if (p < 50) return "解析语言逻辑中...";
    if (p < 75) return "内容重组与分段优化...";
    return "即将完成，准备润色输出...";
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
    setFileName(nameWithoutExt);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInputText(content);
    };
    reader.readAsText(file);
  };

  const handleProcess = async () => {
    if (!inputText.trim()) return;

    // 自动将文件名作为 H1 标题
    const initialText = fileName ? `# ${fileName}\n\n` : '';
    setOutputText(initialText);
    setStatus(AppStatus.LOADING);
    setError(null);

    try {
      // 传入 fileName 以便生成翻译副标题
      const stream = processSubtitleToArticleStream(inputText, fileName || '');
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

  const handleContinue = async () => {
    if (!inputText.trim() || !outputText) return;

    const preText = outputText;
    setStatus(AppStatus.LOADING);
    setError(null);

    try {
      // 调用续写服务
      const stream = continueProcessingStream(inputText, preText);
      let fullText = preText;

      // 添加换行，确保和上一段分开
      fullText += "\n\n";

      for await (const chunk of stream) {
        fullText += chunk;
        setOutputText(fullText);
      }

      setStatus(AppStatus.SUCCESS);
    } catch (err: any) {
      setError("续写失败: " + (err.message || "请重试"));
      // 保持 ERROR 状态，这样用户可以看到错误信息，但内容还保留着
      setStatus(AppStatus.ERROR);
    }
  };

  const reset = () => {
    setStatus(AppStatus.IDLE);
    setOutputText('');
    setFileName('');
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
    let downloadName = titleMatch ? titleMatch[1].trim() : (fileName || "整理后的文章");
    downloadName = downloadName.replace(/[\\/:*?"<>|]/g, "").substring(0, 100);

    element.download = `${downloadName}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 py-4 px-6 sticky top-0 z-50 transition-all">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2.5 group">
              <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-2 rounded-xl shadow-lg shadow-indigo-100 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">
                Sub2Article <span className="text-indigo-600">AI</span>
              </span>
            </a>
          </div>

          <div className="flex items-center gap-4">
            {status !== AppStatus.IDLE && (
              <button
                onClick={reset}
                className="text-slate-400 hover:text-red-500 transition-colors text-xs font-semibold flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> 重新开始
              </button>
            )}
            <div className="h-4 w-px bg-slate-100 hidden sm:block" />
            <a href="https://324893.xyz" target="_blank" className="text-slate-400 hover:text-indigo-600 transition-colors hidden sm:block">
              <Globe className="w-4 h-4" />
            </a>
          </div>
        </div>
        {status === AppStatus.LOADING && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-50 z-50">
            <div
              className="h-full gradient-bg transition-all duration-500 ease-out relative shadow-[0_0_12px_rgba(99,102,241,0.5)]"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute top-0 right-0 h-full w-24 bg-gradient-to-r from-transparent to-white/30 animate-pulse" />
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12 flex flex-col justify-start">
        {status === AppStatus.IDLE ? (
          <div className="space-y-10 animate-in fade-in zoom-in-95 duration-700">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold tracking-wide uppercase">
                <Zap className="w-3 h-3 fill-indigo-600" /> Powered by Gemini
              </div>
              <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
                让字幕变成 <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">优美文章</span>
              </h2>
              <p className="text-slate-500 text-lg max-w-2xl mx-auto">
                将视频转录的混乱文本一键转换为结构清晰、无错别字的 Markdown 文章。
              </p>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 p-2 overflow-hidden transition-all hover:shadow-indigo-100/40">
              <div className="bg-slate-50/50 rounded-[2rem] p-6 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600 rounded-lg text-white">
                      <FileText className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-slate-800">
                      输入您的转录文本
                    </h3>
                  </div>
                  <label className="group cursor-pointer bg-white hover:bg-indigo-600 border border-slate-200 hover:border-indigo-600 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm text-slate-600 hover:text-white">
                    <Upload className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5" /> 导入文件 (.txt, .srt)
                    <input type="file" className="hidden" accept=".txt,.srt" onChange={handleFileUpload} />
                  </label>
                </div>

                <div className="relative group">
                  <textarea
                    className="w-full h-56 p-6 rounded-2xl border-none focus:ring-0 resize-none bg-white text-slate-700 leading-relaxed transition-all outline-none text-base placeholder:text-slate-300"
                    placeholder="在此粘贴您的字幕内容，AI 会自动为您整理分段..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                  {fileName && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold border border-emerald-100 animate-in fade-in slide-in-from-top-2">
                      <Check className="w-3 h-3" />
                      {fileName}
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-focus-within:border-indigo-500/10 pointer-events-none transition-all" />
                </div>

                <button
                  onClick={handleProcess}
                  disabled={!inputText.trim()}
                  className={`group w-full py-4 rounded-2xl font-extrabold text-lg flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] ${!inputText.trim() ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'gradient-bg text-white hover:shadow-xl hover:shadow-indigo-500/30'}`}
                >
                  <Sparkles className={`w-5 h-5 ${inputText.trim() ? 'group-hover:animate-spin' : ''}`} />
                  开启智能整理
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
              {[
                { title: '智能分段', desc: '根据语义自动划分自然段落', icon: Brain },
                { title: '错别字纠正', desc: '自动修复语音识别常见的谐音错字', icon: Check },
                { title: '保持原意', desc: '不删减任何核心信息，保留原始内容', icon: Zap }
              ].map((feature, i) => (
                <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 flex flex-col items-center text-center space-y-2 hover:border-indigo-100 transition-colors">
                  <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 mb-2">
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">{feature.title}</h4>
                  <p className="text-slate-400 text-xs leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/50 backdrop-blur-sm p-3 rounded-2xl border border-slate-100/50">
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-800">
                  整理结果已生成
                </h2>
              </div>
              {outputText && (
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={copyForNotion} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all text-xs font-bold shadow-lg shadow-slate-200 group relative whitespace-nowrap">
                    {notionCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />}
                    {notionCopied ? '已复制全文' : '复制全文'}
                    {notionCopied && <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] py-1 px-2 rounded-md animate-bounce">Success!</div>}
                  </button>
                  <button onClick={downloadResult} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-xs font-bold shadow-lg shadow-indigo-100 whitespace-nowrap">
                    <Download className="w-3.5 h-3.5" /> 下载 Markdown
                  </button>
                </div>
              )}
            </div>

            <div className={`bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/20 border border-slate-100 min-h-[60vh] relative ${status === AppStatus.ERROR && !outputText ? 'border-red-200 bg-red-50/10' : ''}`}>
              <div className="p-8 md:p-14 lg:p-20">
                {status === AppStatus.ERROR && !outputText ? (
                  <div className="flex flex-col items-center justify-center h-full text-red-500 py-20 text-center space-y-6">
                    <div className="bg-red-50 p-4 rounded-full">
                      <AlertCircle className="w-12 h-12" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xl font-bold">处理遇到障碍</p>
                      <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">{error}</p>
                    </div>
                    <button onClick={handleProcess} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all text-sm">重新尝试</button>
                  </div>
                ) : (
                  <article className="prose prose-indigo max-w-none prose-h1:tracking-[0.1em] prose-h1:leading-normal prose-h1:text-center prose-h1:mb-12">
                    {outputText ? (
                      <div className="text-slate-700">
                        <ReactMarkdown>{outputText}</ReactMarkdown>
                        {status === AppStatus.LOADING && (
                          <div className="inline-flex items-center mt-6">
                            <span className="inline-block w-2 h-6 bg-indigo-500 animate-pulse align-middle" />
                            <span className="ml-3 text-indigo-400 text-xs font-bold animate-pulse">AI 正在深度创作...</span>
                          </div>
                        )}

                        {/* === “继续生成”按钮区域 === */}
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
                      <div className="flex flex-col items-center justify-center py-24 gap-10">
                        <div className="relative">
                          <div className="absolute -inset-8 bg-indigo-50 rounded-full animate-ping opacity-20" />
                          <div className="relative bg-white p-8 rounded-[2rem] shadow-2xl border border-slate-100 animate-float">
                            <Brain className="w-16 h-16 text-indigo-600" />
                          </div>
                        </div>

                        <div className="space-y-8 w-full max-w-sm">
                          <div className="text-center space-y-2">
                            <p className="text-slate-800 font-extrabold text-xl">
                              {getLoadingMessage(progress)}
                            </p>
                            <div className="flex items-center justify-center gap-1">
                              <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                              <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                              <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" />
                            </div>
                          </div>

                          <div className="space-y-5 px-6">
                            <div className="h-2.5 bg-slate-50 rounded-full w-full animate-pulse" />
                            <div className="h-2.5 bg-slate-50 rounded-full w-4/5 animate-pulse delay-75" />
                            <div className="h-2.5 bg-slate-50 rounded-full w-5/6 animate-pulse delay-150" />
                            <div className="h-2.5 bg-slate-50 rounded-full w-2/3 animate-pulse delay-200" />
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

      <footer className="py-10 px-6 border-t border-slate-50 mt-auto bg-white/40">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-[11px] text-slate-400 font-semibold tracking-wider uppercase">
             <div className="flex items-center gap-6">
               <a href="https://324893.xyz" target="_blank" className="hover:text-indigo-600 transition-all flex items-center gap-1.5 group">
                <Globe className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" /> 324893.xyz
              </a>
              <span className="w-1 h-1 bg-slate-200 rounded-full" />
              <p>Gemini Intelligence</p>
             </div>
             <p className="flex items-center gap-2 text-slate-300">
               智能字幕转文章 · 2025 · 让内容更有价值
             </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;