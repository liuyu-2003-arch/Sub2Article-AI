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
  PlayCircle,
  Loader2
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
  const [processStatus, setProcessStatus] = useState<string>('');
  const [isStreamFinished, setIsStreamFinished] = useState<boolean>(false);

  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === AppStatus.LOADING || status === AppStatus.SUCCESS) {
      outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [outputText, status]);

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

    const initialText = fileName ? `# ${fileName}\n\n` : '';
    setOutputText(initialText);
    setStatus(AppStatus.LOADING);
    setProcessStatus("连接 AI 中...");
    setIsStreamFinished(false);
    setError(null);

    try {
      const stream = processSubtitleToArticleStream(inputText, fileName || '');
      let fullText = initialText;
      let hasReceivedFirstChunk = false;

      for await (const chunk of stream) {
        if (!hasReceivedFirstChunk && chunk.text) {
            hasReceivedFirstChunk = true;
            setProcessStatus("正在生成...");
        }
        fullText += chunk.text;
        setOutputText(fullText);
        if (chunk.isComplete) setIsStreamFinished(true);
      }

      setStatus(AppStatus.SUCCESS);
      setProcessStatus("完成");
    } catch (err: any) {
      setError(err.message || "处理过程中发生错误，请稍后重试。");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleContinue = async () => {
    if (!inputText.trim() || !outputText) return;
    const preText = outputText;
    setStatus(AppStatus.LOADING);
    setProcessStatus("正在续写...");
    setError(null);

    try {
      const stream = continueProcessingStream(inputText, preText);
      let fullText = preText + "\n\n";
      let hasReceivedFirstChunk = false;

      for await (const chunk of stream) {
        if (!hasReceivedFirstChunk && chunk.text) {
            hasReceivedFirstChunk = true;
            setProcessStatus("正在生成...");
        }
        fullText += chunk.text;
        setOutputText(fullText);
        if (chunk.isComplete) setIsStreamFinished(true);
      }
      setStatus(AppStatus.SUCCESS);
      setProcessStatus("完成");
    } catch (err: any) {
      setError("续写失败: " + (err.message || "请重试"));
      setStatus(AppStatus.ERROR);
    }
  };

  const reset = () => {
    setStatus(AppStatus.IDLE);
    setOutputText('');
    setFileName('');
    setError(null);
    setProcessStatus('');
    setIsStreamFinished(false);
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
      {/* 顶部固定 Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-100 py-3 px-4 md:px-6 sticky top-0 z-50 transition-all">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          {/* Logo 区域 */}
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2 group">
              <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-1.5 rounded-lg shadow-md shadow-indigo-100 group-hover:scale-105 transition-all duration-300">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight hidden sm:inline">
                Sub2Article <span className="text-indigo-600">AI</span>
              </span>
            </a>
          </div>

          {/* 右侧控制区：包含进度、按钮等 */}
          <div className="flex items-center gap-3">
            {/* 仅在非 IDLE 状态显示操作按钮 */}
            {status !== AppStatus.IDLE && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">

                {/* 状态文字显示 */}
                <div className="hidden md:flex items-center gap-2 mr-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
                  {status === AppStatus.LOADING ? (
                    <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  )}
                  <span className="text-xs font-semibold text-slate-600">
                    {processStatus}
                  </span>
                </div>

                {/* 复制按钮 */}
                {outputText && (
                  <>
                    <button
                      onClick={copyForNotion}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all text-xs font-bold border border-transparent hover:border-indigo-100"
                    >
                      {notionCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {notionCopied ? '已复制' : '复制'}
                    </button>

                    <button
                      onClick={downloadResult}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all text-xs font-bold border border-transparent hover:border-indigo-100"
                    >
                      <Download className="w-3.5 h-3.5" />
                      下载
                    </button>
                  </>
                )}

                {/* 分隔线 */}
                <div className="h-4 w-px bg-slate-200 mx-1" />

                {/* 重新开始按钮 */}
                <button
                  onClick={reset}
                  className="text-slate-400 hover:text-red-500 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-all text-xs font-semibold flex items-center gap-1.5"
                  title="重新开始"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">重新开始</span>
                </button>
              </div>
            )}

            {/* 外部链接 (在 IDLE 状态下显示，处理中隐藏以节省空间) */}
            {status === AppStatus.IDLE && (
              <a href="https://324893.xyz" target="_blank" className="text-slate-400 hover:text-indigo-600 transition-colors">
                <Globe className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col justify-start">
        {status === AppStatus.IDLE ? (
          // === IDLE 状态的 UI (上传界面) ===
          <div className="space-y-10 animate-in fade-in zoom-in-95 duration-700 mt-8">
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
          // === 处理中 / 完成后的 UI (文章展示) ===
          <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-700">
            {/* 这里的旧工具栏代码已移除，现在控制都在 Header */}

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
                            <span className="ml-3 text-indigo-400 text-xs font-bold animate-pulse">{processStatus}</span>
                          </div>
                        )}

                        {/* 继续生成按钮 */}
                        {status !== AppStatus.LOADING && !isStreamFinished && (
                          <div className="mt-12 pt-8 border-t border-dashed border-slate-200 flex justify-center">
                            <button
                              onClick={handleContinue}
                              className="group flex items-center gap-2 px-6 py-3 bg-white border-2 border-indigo-100 text-indigo-600 rounded-full font-bold hover:bg-indigo-50 hover:border-indigo-200 hover:scale-105 transition-all shadow-sm"
                            >
                              <PlayCircle className="w-5 h-5" />
                              文章似乎未完？点击继续生成
                              <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        )}

                        {/* 结束标记 */}
                        {isStreamFinished && (
                           <div className="mt-12 py-4 flex justify-center text-slate-300">
                             <div className="w-1.5 h-1.5 rounded-full bg-slate-200 mx-1"></div>
                             <div className="w-1.5 h-1.5 rounded-full bg-slate-200 mx-1"></div>
                             <div className="w-1.5 h-1.5 rounded-full bg-slate-200 mx-1"></div>
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

                        <div className="space-y-4 w-full max-w-sm text-center">
                            <p className="text-slate-800 font-extrabold text-xl animate-pulse">
                              {processStatus}
                            </p>
                            <div className="flex items-center justify-center gap-1">
                              <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                              <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                              <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" />
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