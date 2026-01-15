import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Check, AlertCircle, Sparkles, Zap, Globe, FileText, Trash2, Copy, Loader2, ArrowRight, Save, Share2, Plus, Calendar
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { processSubtitleToArticleStream, continueProcessingStream } from './services/geminiService';
import { uploadToR2, listArticles, getArticleContent, deleteArticle } from './services/r2Service';
import { AppStatus } from './types';

// === 新增辅助函数：处理显示逻辑 ===
// 目的：从混乱的文件名中提取干净的英文标题、中文副标题、以及格式化日期
const extractDisplayInfo = (key: string, lastModified: Date) => {
  // 1. 去除路径前缀 (articles/xxx/ or articles/)
  let cleanName = key.split('/').pop() || '';
  cleanName = cleanName.replace('.md', '');

  let displayTitle = "";
  let displaySubTitle = ""; // 尝试找回中文部分

  // === 识别文件名格式 ===

  // 情况 A: 新格式 (Title_Here_20260116120000) - 时间戳在后
  const newFormatMatch = cleanName.match(/^(.*)_(\d{14})$/);

  // 情况 B: 旧格式 (2026-01-11T..._Title) - 时间戳在前
  const oldFormatMatch = cleanName.match(/^\d{4}-\d{2}-\d{2}T[\d-]+\w+_(.*)$/);

  if (newFormatMatch) {
     // 新格式：文件名本身就是纯英文标题
     displayTitle = newFormatMatch[1].replace(/_/g, ' ');
  } else if (oldFormatMatch) {
     // 旧格式：文件名可能包含 "English_Text_中文内容"
     let rawTitle = oldFormatMatch[1];
     rawTitle = rawTitle.replace(/_/g, ' ');

     // 尝试分离中文和英文
     const chineseIndex = rawTitle.search(/[\u4e00-\u9fa5]/);
     if (chineseIndex > 0) {
        displayTitle = rawTitle.substring(0, chineseIndex).trim();
        displaySubTitle = rawTitle.substring(chineseIndex).trim();
     } else {
        displayTitle = rawTitle;
     }
  } else {
     // 无法识别的格式，直接去下划线显示
     displayTitle = cleanName.replace(/_/g, ' ');
  }

  return {
    title: displayTitle,
    subTitle: displaySubTitle,
    date: lastModified.toLocaleDateString() + ' ' + lastModified.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
  };
};


const App: React.FC = () => {
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [notionCopied, setNotionCopied] = useState<boolean>(false);
  const [linkCopied, setLinkCopied] = useState<boolean>(false);
  const [processStatus, setProcessStatus] = useState<string>('');
  const [progress, setProgress] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentArticleKey, setCurrentArticleKey] = useState<string | null>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadHistory();

    const checkUrlForArticle = async () => {
      const params = new URLSearchParams(window.location.search);
      let articleId = params.get('id');

      if (articleId) {
        // === 核心修复：URL 解析 ===
        // 如果 URL 是 ?id=My_Life_2026.html，我们需要找到 articles/My_Life_2026.md
        if (!articleId.startsWith('articles/')) {
            const realKey = articleId.replace(/\.html$/, '.md');
            articleId = `articles/${realKey}`;
        }

        setStatus(AppStatus.LOADING);
        setProcessStatus("正在从云端加载文章...");
        try {
          const content = await getArticleContent(articleId);
          if (content) {
            setOutputText(content);
            setCurrentArticleKey(articleId);

            // 解析标题用于页面 title 显示
            const info = extractDisplayInfo(articleId, new Date());
            setFileName(info.title);

            setStatus(AppStatus.SUCCESS);
            setProcessStatus("加载完成");
            window.scrollTo(0, 0);
          } else {
            throw new Error("未找到文章内容");
          }
        } catch (e) {
          console.error(e);
          setError("无法加载该文章，可能链接已失效或被删除。");
          setStatus(AppStatus.ERROR);
        }
      }
    };
    checkUrlForArticle();
  }, []);

  // === 核心修复：生成短链接 ===
  const updateUrlWithId = (key: string | null) => {
    if (key) {
      // Input: articles/My_Title_Timestamp.md
      // Output: My_Title_Timestamp.html
      const shortName = key.split('/').pop()?.replace('.md', '') || 'article';
      const shortUrlParam = `${shortName}.html`;

      const newUrl = `${window.location.pathname}?id=${encodeURIComponent(shortUrlParam)}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    } else {
      const newUrl = window.location.pathname;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
  };

  // ... 进度条逻辑保持不变 ...
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
    if (status === AppStatus.LOADING) {
      outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [outputText, status]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const userId = localStorage.getItem('sub2article_user_id') || 'default_user';
      const list = await listArticles(userId);
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
    let nameClean = file.name.replace(/\.[^.]+$/, "").replace(/\.(en|zh|zh-CN|us|uk|jp|kr)$/i, "");
    setFileName(nameClean);
    const reader = new FileReader();
    reader.onload = (event) => setInputText((event.target?.result as string) || "");
    reader.readAsText(file);
  };

  const handleProcess = async () => {
    if (!inputText.trim()) return;
    const initialText = fileName ? `# ${fileName}\n` : '';
    setOutputText(initialText);
    setStatus(AppStatus.LOADING);
    setProcessStatus("准备开始...");
    setError(null);
    setSaveSuccess(false);
    setCurrentArticleKey(null);
    updateUrlWithId(null);

    try {
      let currentFullText = initialText;
      let isFullyComplete = false;
      let loopCount = 0;
      let stream = processSubtitleToArticleStream(inputText, fileName || '');

      while (!isFullyComplete && loopCount < 15) {
        loopCount++;
        let hasReceivedChunk = false;
        for await (const chunk of stream) {
          if (!hasReceivedChunk && chunk.text) { hasReceivedChunk = true; setProcessStatus("正在生成"); }
          currentFullText += chunk.text;
          setOutputText(currentFullText);
          isFullyComplete = chunk.isComplete;
        }
        if (!isFullyComplete) {
           if (loopCount >= 15) break;
           setProcessStatus("自动续写中...");
           currentFullText += "\n\n";
           stream = continueProcessingStream(inputText, currentFullText);
        }
      }

      setStatus(AppStatus.SUCCESS);
      setProcessStatus("整理完成");
      await performAutoSave(currentFullText);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "处理错误");
      setStatus(AppStatus.ERROR);
    }
  };

  const performAutoSave = async (textToSave: string) => {
    setIsSaving(true);
    try {
      // 1. 提取 H1 (通常是英文标题)
      const h1Match = textToSave.match(/^#\s+(.+)$/m);
      const h1 = h1Match ? h1Match[1].trim().replace(/[*_~`]/g, '') : '';

      // 2. 提取 H2 (通常是中文标题) - 这里提取出来为了组合完整 Title 给 R2 Service
      const h2Match = textToSave.match(/^##\s*(.+)$/m);
      const h2 = h2Match ? h2Match[1].trim().replace(/[*_~`]/g, '') : '';

      // 组合：R2Service 会自动只保留英文部分做文件名，但我们传入全名以防万一
      let fullTitle = h1 || fileName || "Untitled";
      if (h1 && h2) fullTitle = `${h1} ${h2}`;

      const userId = localStorage.getItem('sub2article_user_id') || 'default_user';

      // 保存
      const savedKey = await uploadToR2(textToSave, fullTitle, userId);

      setCurrentArticleKey(savedKey);
      updateUrlWithId(savedKey); // 更新为 .html 短链接
      setSaveSuccess(true);
      loadHistory();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error("Auto save failed:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSave = async () => { if (outputText) await performAutoSave(outputText); };

  const handleLoadArticle = async (key: string) => {
    try {
      setStatus(AppStatus.LOADING);
      setProcessStatus("正在加载...");
      const content = await getArticleContent(key);
      setOutputText(content);
      setCurrentArticleKey(key);
      updateUrlWithId(key); // 点击历史记录也变为短链接

      const info = extractDisplayInfo(key, new Date());
      setFileName(info.title);

      setStatus(AppStatus.SUCCESS);
      setProcessStatus("加载完成");
      window.scrollTo(0, 0);
    } catch (e) {
      setError("加载文章失败");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleShare = () => {
    if (!currentArticleKey) { alert("请先保存"); return; }
    navigator.clipboard.writeText(window.location.href).then(() => {
        setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  const handleDeleteArticle = async (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    if (confirm("确定要删除吗？")) {
      await deleteArticle(key);
      if (key === currentArticleKey) { reset(); }
      loadHistory();
    }
  };

  const reset = () => {
    setStatus(AppStatus.IDLE); setViewMode('list'); setOutputText(''); setFileName(''); setError(null);
    setProcessStatus(''); setProgress(0); setSaveSuccess(false); setCurrentArticleKey(null);
    updateUrlWithId(null); loadHistory();
  };

  const goCreate = () => {
      setStatus(AppStatus.IDLE); setViewMode('create'); setOutputText(''); setFileName(''); updateUrlWithId(null);
  };

  const copyForNotion = () => {
    navigator.clipboard.writeText(outputText).then(() => {
      setNotionCopied(true); setTimeout(() => setNotionCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-slate-200 selection:text-slate-900">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200 py-3 px-4 md:px-6 sticky top-0 z-50 transition-all">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={reset} className="flex items-center gap-2 group">
              <div className="bg-slate-900 p-1.5 rounded-lg shadow-sm group-hover:scale-105 transition-all duration-300">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900 tracking-tight font-['Inter'] hidden sm:inline">
                Sub2Article <span className="text-slate-500 font-medium">AI</span>
              </span>
            </button>
          </div>
          <div className="flex items-center gap-3">
             {viewMode === 'list' && status === AppStatus.IDLE && (
                <button onClick={goCreate} className="bg-slate-900 text-white hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-all text-xs font-bold flex items-center gap-1.5 font-['Inter'] shadow-sm">
                  <Plus className="w-4 h-4" /> <span className="hidden sm:inline">添加文章</span>
                </button>
             )}
            {status !== AppStatus.IDLE && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                {outputText && (
                  <>
                    {currentArticleKey && (
                      <button onClick={handleShare} className="flex items-center gap-1.5 px-3 py-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all text-xs font-bold border border-transparent font-['Inter']">
                        {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                        {linkCopied ? '链接已复制' : '分享'}
                      </button>
                    )}
                    {!currentArticleKey && (
                      <button onClick={handleManualSave} disabled={isSaving || saveSuccess} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-bold border border-transparent font-['Inter'] ${saveSuccess ? 'text-emerald-600 bg-emerald-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saveSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                        {saveSuccess ? '已保存' : '保存'}
                      </button>
                    )}
                    <button onClick={copyForNotion} className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all text-xs font-bold border border-transparent font-['Inter']">
                      {notionCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {notionCopied ? '已复制' : '复制'}
                    </button>
                  </>
                )}
                <div className="h-4 w-px bg-slate-200 mx-1" />
                <button onClick={reset} className="text-slate-400 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-all text-xs font-semibold flex items-center gap-1.5 font-['Inter']">
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" /> <span className="hidden sm:inline">返回列表</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 flex flex-col justify-start">
        {status === AppStatus.IDLE ? (
          <>
            {viewMode === 'list' && (
               <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500 mt-4">
                  {isLoadingHistory ? (
                    <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
                  ) : historyList.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-slate-200">
                      <h3 className="text-lg font-bold text-slate-700 font-['Inter']">暂无文章</h3>
                      <button onClick={goCreate} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors inline-flex items-center gap-2 mt-4">
                        <Plus className="w-4 h-4" /> 开始第一篇创作
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {historyList.map((item) => {
                        // === 核心逻辑：渲染列表卡片 ===
                        const info = extractDisplayInfo(item.Key, item.LastModified);

                        return (
                          <div
                            key={item.Key}
                            onClick={() => handleLoadArticle(item.Key)}
                            className="group bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-slate-200 transition-all cursor-pointer relative flex flex-col justify-start"
                          >
                             <div className="flex-1 min-w-0 pr-8">
                               {/* 英文主标题 */}
                               <h3 className="text-xl font-bold text-slate-900 mb-1 font-['Playfair_Display'] leading-tight group-hover:text-indigo-600 transition-colors line-clamp-2">
                                 {info.title}
                               </h3>

                               {/* 中文副标题（如果有） */}
                               {info.subTitle && (
                                 <p className="text-base text-slate-500 font-['Noto_Sans_SC'] mt-1 line-clamp-1">
                                   {info.subTitle}
                                 </p>
                               )}

                               <div className="flex items-center gap-2 text-xs text-slate-400 font-['Inter'] mt-3">
                                 <Calendar className="w-3.5 h-3.5" />
                                 <span>{info.date}</span>
                               </div>
                             </div>

                             <button
                                onClick={(e) => handleDeleteArticle(e, item.Key)}
                                className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="删除"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
               </div>
            )}
            {/* Create Mode */}
            {viewMode === 'create' && (
              <div className="animate-in fade-in zoom-in-95 duration-700 mt-4">
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 p-2 overflow-hidden transition-all hover:shadow-2xl hover:shadow-slate-200/80">
                  <div className="bg-slate-50 rounded-xl p-8 space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-900 rounded-lg text-white"><FileText className="w-4 h-4" /></div>
                        <h3 className="font-bold text-slate-800 font-['Inter']">输入转录文本</h3>
                      </div>
                      <label className="group cursor-pointer bg-white hover:bg-slate-900 border border-slate-200 hover:border-slate-900 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm text-slate-600 hover:text-white font-['Inter']">
                        <Upload className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5" /> 导入文件
                        <input type="file" className="hidden" accept=".txt,.srt" onChange={handleFileUpload} />
                      </label>
                    </div>
                    <div className="relative group">
                      <textarea
                        className="w-full h-64 p-6 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-0 resize-none bg-white text-slate-700 leading-relaxed transition-all outline-none text-base placeholder:text-slate-300 font-['Merriweather']"
                        placeholder="在此粘贴您的字幕内容..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                      />
                      {fileName && (
                        <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-100 animate-in fade-in slide-in-from-top-2 font-['Inter']"><Check className="w-3 h-3" /> {fileName}</div>
                      )}
                    </div>
                    <button onClick={handleProcess} disabled={!inputText.trim()} className={`group w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all transform active:scale-[0.99] font-['Inter'] ${!inputText.trim() ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20'}`}>
                      <Sparkles className={`w-4 h-4 ${inputText.trim() ? 'group-hover:animate-spin' : ''}`} /> 开启智能整理 <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="animate-in slide-in-from-bottom-4 duration-700">
            <div className={`bg-white min-h-[80vh] relative p-8 md:p-16 lg:px-24 border border-slate-100 shadow-sm ${status === AppStatus.ERROR && !outputText ? 'bg-red-50/10' : ''}`}>
              <div>
                {status === AppStatus.ERROR && !outputText ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                    <div className="bg-red-50 p-4 rounded-full text-red-500"><AlertCircle className="w-10 h-10" /></div>
                    <div className="space-y-2 font-['Inter']">
                      <p className="text-lg font-bold text-slate-900">处理遇到障碍</p>
                      <p className="text-slate-500 text-sm max-w-xs mx-auto">{error}</p>
                    </div>
                    <button onClick={handleProcess} className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all text-sm font-['Inter']">重新尝试</button>
                  </div>
                ) : (
                  <article className="prose prose-stone max-w-none prose-lg prose-headings:font-['Playfair_Display'] prose-headings:font-bold prose-headings:text-slate-900 prose-h1:text-4xl prose-h1:leading-tight prose-h1:mb-2 prose-h1:text-left prose-h2:text-2xl prose-h2:mt-1 prose-h2:mb-8 prose-h2:text-left prose-h2:text-slate-500 prose-h2:font-normal prose-hr:my-10 prose-hr:border-slate-200 prose-p:font-['Merriweather'] prose-p:text-slate-800 prose-p:leading-loose prose-p:mb-6 prose-strong:font-bold prose-strong:text-slate-900">
                    {outputText ? (
                      <div><ReactMarkdown>{outputText}</ReactMarkdown>{status === AppStatus.LOADING && (<div className="flex items-center gap-3 mt-8 opacity-60"><span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span><span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span><span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span><span className="text-sm font-['Inter'] text-slate-500 italic ml-2">Writing...</span></div>)}</div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-32 gap-8 opacity-50"><div className="w-16 h-1 bg-slate-200 rounded-full animate-pulse"></div><div className="space-y-4 w-full max-w-md text-center"><p className="font-['Playfair_Display'] text-2xl text-slate-400 italic">Thinking...</p></div></div>
                    )}
                    <div ref={outputEndRef} />
                  </article>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-200 mt-auto bg-white font-['Inter']">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
             <div className="flex items-center gap-4 text-sm text-slate-500">
               <span className="font-bold text-slate-900">Sub2Article AI</span><span className="w-px h-3 bg-slate-300"></span>
               <a href="https://324893.xyz" target="_blank" className="flex items-center gap-2 hover:text-indigo-600 transition-colors"><Globe className="w-4 h-4" /> <span className="hidden sm:inline">324893.xyz</span></a>
             </div>
             <div className="flex items-center gap-4"><div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold tracking-wide uppercase"><Zap className="w-3 h-3 fill-slate-700" /> Powered by Gemini</div></div>
          </div>
      </footer>
    </div>
  );
};

export default App;