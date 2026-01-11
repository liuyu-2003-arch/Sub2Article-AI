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
  Loader2,
  ArrowRight,
  Save,       // 新增图标
  History,    // 新增图标
  X,          // 新增图标
  File        // 新增图标
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { processSubtitleToArticleStream, continueProcessingStream } from './services/geminiService';
// 引入 R2 服务
import { uploadToR2, listArticles, getArticleContent, deleteArticle } from './services/r2Service';
import { AppStatus } from './types';

const App: React.FC = () => {
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [notionCopied, setNotionCopied] = useState<boolean>(false);
  const [processStatus, setProcessStatus] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);

  // R2 相关状态
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let interval: number;
    if (status === AppStatus.LOADING) {
      setProgress(0);
      interval = window.setInterval(() => {
        setProgress(prev => {
          if (prev < 60) return prev + Math.random() * 3;
          if (prev < 90) return prev + Math.random() * 1;
          if (prev < 99) return prev + 0.1;
          return prev;
        });
      }, 500);
    } else if (status === AppStatus.SUCCESS) {
      setProgress(100);
    }
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (status === AppStatus.LOADING || status === AppStatus.SUCCESS) {
      outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [outputText, status]);

  // 加载历史文章列表
  useEffect(() => {
    if (showHistory) {
      loadHistory();
    }
  }, [showHistory]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const list = await listArticles();
      setHistoryList(list);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let nameClean = file.name.replace(/\.[^.]+$/, "");
    nameClean = nameClean.replace(/\.(en|zh|zh-CN|us|uk|jp|kr)$/i, "");

    setFileName(nameClean);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInputText(content || "");
    };
    reader.readAsText(file);
  };

  const handleProcess = async () => {
    if (!inputText.trim()) return;

    const initialText = fileName ? `# ${fileName}\n` : '';
    setOutputText(initialText);
    setStatus(AppStatus.LOADING);
    setProcessStatus("准备开始...");
    setError(null);
    setSaveSuccess(false); // 重置保存状态

    try {
      let currentFullText = initialText;
      let isFullyComplete = false;
      let loopCount = 0;
      const MAX_LOOPS = 15;

      let stream = processSubtitleToArticleStream(inputText, fileName || '');

      while (!isFullyComplete && loopCount < MAX_LOOPS) {
        loopCount++;
        let hasReceivedChunk = false;

        for await (const chunk of stream) {
          if (!hasReceivedChunk && chunk.text) {
             hasReceivedChunk = true;
             setProcessStatus("正在生成");
          }
          currentFullText += chunk.text;
          setOutputText(currentFullText);

          isFullyComplete = chunk.isComplete;
        }

        if (!isFullyComplete) {
           if (loopCount >= MAX_LOOPS) {
             console.warn("达到最大续写次数，强制停止");
             break;
           }
           setProcessStatus("内容较长，自动续写中");
           currentFullText += "\n\n";
           stream = continueProcessingStream(inputText, currentFullText);
        }
      }

      setStatus(AppStatus.SUCCESS);
      setProcessStatus("整理完成");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "处理过程中发生错误，请稍后重试。");
      setStatus(AppStatus.ERROR);
    }
  };

  // 保存到 R2
  const handleSaveToCloud = async () => {
    if (!outputText) return;
    setIsSaving(true);
    try {
      // 提取标题作为文件名的一部分，如果没找到标题则用 "Untitled"
      const titleMatch = outputText.match(/^#+\s+(.*)/m);
      const title = titleMatch ? titleMatch[1].trim() : (fileName || "Untitled");

      await uploadToR2(outputText, title);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      alert("保存失败，请检查 R2 配置");
    } finally {
      setIsSaving(false);
    }
  };

  // 加载选中的历史文章
  const handleLoadArticle = async (key: string) => {
    try {
      setStatus(AppStatus.LOADING);
      setProcessStatus("正在加载文章...");
      setShowHistory(false); // 关闭侧边栏

      const content = await getArticleContent(key);
      setOutputText(content);

      // 尝试从文件名恢复简单的标题显示
      const simpleName = key.split('_').pop()?.replace('.md', '') || 'Imported Article';
      setFileName(simpleName);

      setStatus(AppStatus.SUCCESS);
      setProcessStatus("加载完成");
    } catch (e) {
      setError("加载文章失败");
      setStatus(AppStatus.ERROR);
    }
  };

  // 删除文章
  const handleDeleteArticle = async (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    if (confirm("确定要删除这篇文章吗？")) {
      await deleteArticle(key);
      loadHistory(); // 刷新列表
    }
  };

  const reset = () => {
    setStatus(AppStatus.IDLE);
    setOutputText('');
    setFileName('');
    setError(null);
    setProcessStatus('');
    setProgress(0);
    setSaveSuccess(false);
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
    <div className="min-h-screen flex flex-col selection:bg-slate-200 selection:text-slate-900">
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200 py-3 px-4 md:px-6 sticky top-0 z-50 transition-all">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2 group">
              <div className="bg-slate-900 p-1.5 rounded-lg shadow-sm group-hover:scale-105 transition-all duration-300">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight font-['Inter'] hidden sm:inline">
                Sub2Article <span className="text-slate-500 font-medium">AI</span>
              </span>
            </a>
          </div>

          <div className="flex items-center gap-3">
             {/* 历史文章按钮 */}
             <button
                onClick={() => setShowHistory(true)}
                className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-all text-xs font-bold flex items-center gap-1.5 font-['Inter']"
              >
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">我的文章</span>
              </button>

            {status !== AppStatus.IDLE && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">

                <div className="hidden md:flex items-center gap-2 mr-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
                  {status === AppStatus.LOADING ? (
                    <Loader2 className="w-3.5 h-3.5 text-slate-600 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span className="text-xs font-semibold text-slate-600 tabular-nums font-['Inter']">
                    {status === AppStatus.LOADING
                      ? `${processStatus} ${Math.floor(progress)}%`
                      : processStatus}
                  </span>
                </div>

                {outputText && (
                  <>
                     {/* 保存到云端按钮 */}
                    <button
                      onClick={handleSaveToCloud}
                      disabled={isSaving || saveSuccess}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-bold border border-transparent font-['Inter'] ${saveSuccess ? 'text-emerald-600 bg-emerald-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                    >
                      {isSaving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : saveSuccess ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      {saveSuccess ? '已保存' : '保存'}
                    </button>

                    <button
                      onClick={copyForNotion}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all text-xs font-bold border border-transparent font-['Inter']"
                    >
                      {notionCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {notionCopied ? '已复制' : '复制'}
                    </button>

                    <button
                      onClick={downloadResult}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all text-xs font-bold border border-transparent font-['Inter']"
                    >
                      <Download className="w-3.5 h-3.5" />
                      下载
                    </button>
                  </>
                )}

                <div className="h-4 w-px bg-slate-200 mx-1" />

                <button
                  onClick={reset}
                  className="text-slate-400 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-all text-xs font-semibold flex items-center gap-1.5 font-['Inter']"
                  title="重新开始"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">重新开始</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col justify-start">
        {status === AppStatus.IDLE ? (
          <div className="space-y-10 animate-in fade-in zoom-in-95 duration-700 mt-8">
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight sm:text-6xl font-['Playfair_Display']">
                Turn Subtitles into <br/>
                <span className="text-slate-500 italic">Beautiful Articles</span>
              </h2>
              <p className="text-slate-500 text-lg max-w-2xl mx-auto font-['Merriweather'] leading-relaxed">
                将视频转录的混乱文本一键转换为结构清晰、排版优雅的中英对照文章。
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 p-2 overflow-hidden transition-all hover:shadow-2xl hover:shadow-slate-200/80">
              <div className="bg-slate-50 rounded-xl p-8 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-900 rounded-lg text-white">
                      <FileText className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-slate-800 font-['Inter']">
                      输入您的转录文本
                    </h3>
                  </div>
                  <label className="group cursor-pointer bg-white hover:bg-slate-900 border border-slate-200 hover:border-slate-900 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm text-slate-600 hover:text-white font-['Inter']">
                    <Upload className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5" /> 导入文件
                    <input type="file" className="hidden" accept=".txt,.srt" onChange={handleFileUpload} />
                  </label>
                </div>

                <div className="relative group">
                  <textarea
                    className="w-full h-56 p-6 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-0 resize-none bg-white text-slate-700 leading-relaxed transition-all outline-none text-base placeholder:text-slate-300 font-['Merriweather']"
                    placeholder="在此粘贴您的字幕内容..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                  {fileName && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-100 animate-in fade-in slide-in-from-top-2 font-['Inter']">
                      <Check className="w-3 h-3" />
                      {fileName}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleProcess}
                  disabled={!inputText.trim()}
                  className={`group w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all transform active:scale-[0.99] font-['Inter'] ${!inputText.trim() ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20'}`}
                >
                  <Sparkles className={`w-4 h-4 ${inputText.trim() ? 'group-hover:animate-spin' : ''}`} />
                  开启智能整理
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 font-['Inter']">
              {[
                { title: '智能分段', desc: '根据语义自动划分自然段落', icon: Brain },
                { title: '双语对照', desc: '英文段落与中文翻译一一对应', icon: Globe },
                { title: '保持原意', desc: '不删减任何核心信息', icon: Zap }
              ].map((feature, i) => (
                <div key={i} className="p-5 rounded-2xl border border-transparent hover:border-slate-200 flex flex-col items-center text-center space-y-2 hover:bg-white transition-all">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-600 mb-2">
                    <feature.icon className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">{feature.title}</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom-4 duration-700">
            <div className={`bg-white min-h-[80vh] relative p-8 md:p-16 lg:px-24 border border-slate-100 shadow-sm ${status === AppStatus.ERROR && !outputText ? 'bg-red-50/10' : ''}`}>
              <div>
                {status === AppStatus.ERROR && !outputText ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                    <div className="bg-red-50 p-4 rounded-full text-red-500">
                      <AlertCircle className="w-10 h-10" />
                    </div>
                    <div className="space-y-2 font-['Inter']">
                      <p className="text-lg font-bold text-slate-900">处理遇到障碍</p>
                      <p className="text-slate-500 text-sm max-w-xs mx-auto">{error}</p>
                    </div>
                    <button onClick={handleProcess} className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-all text-sm font-['Inter']">重新尝试</button>
                  </div>
                ) : (
                  <article className="
                    prose prose-stone max-w-none
                    prose-lg
                    prose-headings:font-['Playfair_Display'] prose-headings:font-bold prose-headings:text-slate-900

                    prose-h1:text-4xl prose-h1:leading-tight prose-h1:mb-2 prose-h1:text-left

                    prose-h2:text-2xl prose-h2:mt-1 prose-h2:mb-8 prose-h2:text-left prose-h2:text-slate-500 prose-h2:font-normal

                    prose-hr:my-10 prose-hr:border-slate-200

                    prose-p:font-['Merriweather'] prose-p:text-slate-800 prose-p:leading-loose prose-p:mb-6
                    prose-strong:font-bold prose-strong:text-slate-900
                  ">
                    {outputText ? (
                      <div>
                        <ReactMarkdown>{outputText}</ReactMarkdown>
                        {status === AppStatus.LOADING && (
                          <div className="flex items-center gap-3 mt-8 opacity-60">
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                            <span className="text-sm font-['Inter'] text-slate-500 italic ml-2">Writing...</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-32 gap-8 opacity-50">
                         <div className="w-16 h-1 bg-slate-200 rounded-full animate-pulse"></div>
                         <div className="space-y-4 w-full max-w-md text-center">
                            <p className="font-['Playfair_Display'] text-2xl text-slate-400 italic">
                              Thinking...
                            </p>
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

      {/* 历史文章侧边栏 (Drawer) */}
      {showHistory && (
        <div className="fixed inset-0 z-[60] flex justify-end">
           {/* 遮罩 */}
           <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowHistory(false)} />

           {/* 侧边栏内容 */}
           <div className="relative w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col animate-in slide-in-from-right duration-300">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold font-['Playfair_Display'] text-slate-900">我的文章</h3>
               <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                 <X className="w-5 h-5" />
               </button>
             </div>

             <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {isLoadingHistory ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : historyList.length === 0 ? (
                  <div className="text-center py-20 text-slate-400 font-['Inter']">
                    <p>暂无保存的文章</p>
                    <p className="text-xs mt-2">点击“保存”按钮将文章存到云端</p>
                  </div>
                ) : (
                  historyList.map((item) => {
                    // 解析文件名显示
                    const displayName = item.Key.split('_').slice(1).join('_').replace('.md', '') || '无标题文章';
                    const date = new Date(item.LastModified).toLocaleDateString();

                    return (
                      <div key={item.Key}
                           onClick={() => handleLoadArticle(item.Key)}
                           className="group p-4 border border-slate-100 rounded-xl hover:border-slate-300 hover:bg-slate-50 cursor-pointer transition-all flex justify-between items-start"
                      >
                         <div className="flex items-start gap-3 overflow-hidden">
                           <div className="mt-1 p-2 bg-white border border-slate-100 rounded-lg text-slate-500 group-hover:text-slate-900 group-hover:border-slate-300 transition-colors">
                             <File className="w-4 h-4" />
                           </div>
                           <div className="flex-1 min-w-0">
                             <h4 className="font-bold text-slate-800 text-sm truncate pr-2 font-['Inter'] group-hover:text-indigo-600 transition-colors">{displayName}</h4>
                             <p className="text-xs text-slate-400 mt-1">{date}</p>
                           </div>
                         </div>
                         <button
                            onClick={(e) => handleDeleteArticle(e, item.Key)}
                            className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="删除"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                    )
                  })
                )}
             </div>
           </div>
        </div>
      )}

      <footer className="py-8 px-6 border-t border-slate-200 mt-auto bg-white font-['Inter']">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
             <div className="flex items-center gap-4 text-sm text-slate-500">
               <span className="font-bold text-slate-900">Sub2Article AI</span>
               <span className="w-px h-3 bg-slate-300"></span>
               <a href="https://324893.xyz" target="_blank" className="flex items-center gap-2 hover:text-indigo-600 transition-colors">
                  <Globe className="w-4 h-4" />
                  <span className="hidden sm:inline">324893.xyz</span>
               </a>
             </div>

             <div className="flex items-center gap-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold tracking-wide uppercase">
                  <Zap className="w-3 h-3 fill-slate-700" /> Powered by Gemini
                </div>
             </div>
          </div>
      </footer>
    </div>
  );
};

export default App;