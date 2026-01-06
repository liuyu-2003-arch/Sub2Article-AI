
import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  Download,
  ArrowLeft,
  Sparkles,
  Zap,
  Globe,
  ExternalLink,
  Github,
  LogOut,
  Crown,
  Mail,
  Lock,
  UserPlus,
  ArrowRight,
  LogIn,
  History,
  Trash2,
  ChevronRight,
  X,
  PenTool,
  Brain,
  Cloud,
  CloudOff,
  CloudUpload
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { processSubtitleToArticleStream } from './services/geminiService';
import { uploadToR2, listArticles, getArticleContent, deleteArticle } from './services/r2Service';
import { AppStatus } from './types';
import { supabase } from './supabaseClient';
import { User } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notionCopied, setNotionCopied] = useState<boolean>(false);
  const [progress, setProgress] = useState(0);
  
  // History State
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Email/Password Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authProcessing, setAuthProcessing] = useState(false);

  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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
      outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [outputText, status]);

  const getLoadingMessage = (p: number) => {
    if (p < 25) return "正在唤醒 AI 助手...";
    if (p < 50) return "正在分析视频转录结构...";
    if (p < 75) return "正在智能分段与润色...";
    return "即将完成，正在导出...";
  };

  const fetchHistory = async () => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const items = await listArticles(user.id);
      const sorted = items.sort((a: any, b: any) => 
        (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0)
      );
      setHistoryList(sorted);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (showHistory && user) {
      fetchHistory();
    }
  }, [showHistory, user]);

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

  const handleManualSync = async () => {
    if (!outputText || !user || isSaving) return;
    setIsSaving(true);
    setSaveError(false);
    try {
      await uploadToR2(outputText, user.id);
      setIsSaved(true);
      if (showHistory) fetchHistory();
    } catch (r2Error) {
      console.error("Manual sync to R2 failed", r2Error);
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleProcess = async () => {
    if (!inputText.trim() || !user) return;
    
    setOutputText('');
    setStatus(AppStatus.LOADING);
    setError(null);
    setIsSaved(false);
    setIsSaving(false);
    setSaveError(false);
    
    try {
      const stream = processSubtitleToArticleStream(inputText);
      let fullText = '';
      for await (const chunk of stream) {
        fullText += chunk;
        setOutputText(fullText);
      }
      
      setStatus(AppStatus.SUCCESS);
      
      if (fullText) {
        setIsSaving(true);
        try {
          await uploadToR2(fullText, user.id);
          setIsSaved(true);
          if (showHistory) fetchHistory();
        } catch (r2Error) {
          console.error("Auto-save to R2 failed", r2Error);
          setSaveError(true);
        } finally {
          setIsSaving(false);
        }
      }
    } catch (err: any) {
      setError(err.message || "处理过程中发生错误，请稍后重试。");
      setStatus(AppStatus.ERROR);
    }
  };

  const loadFromHistory = async (key: string) => {
    setStatus(AppStatus.LOADING);
    setShowHistory(false);
    setError(null);
    setSaveError(false);
    try {
      const content = await getArticleContent(key);
      setOutputText(content);
      setStatus(AppStatus.SUCCESS);
      setIsSaved(true);
    } catch (err) {
      setError("无法加载文章内容");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleDeleteHistory = async (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    if (!confirm("确定要删除这篇文章吗？")) return;
    try {
      await deleteArticle(key);
      setHistoryList(prev => prev.filter(item => item.Key !== key));
    } catch (err) {
      alert("删除失败");
    }
  };

  const reset = () => {
    setStatus(AppStatus.IDLE);
    setOutputText('');
    setError(null);
    setProgress(0);
    setIsSaved(false);
    setIsSaving(false);
    setSaveError(false);
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

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  const loginWithGithub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin }
    });
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthProcessing(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('注册成功！请检查邮箱以确认。');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthProcessing(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    reset();
  };

  const formatKeyName = (key: string) => {
    const parts = key.split('/');
    const fileName = parts[parts.length - 1];
    return fileName.replace('.md', '').replace(/-/g, ':').replace(/^(\d{4}):(\d{2}):(\d{2}):/, '$1-$2-$3 ');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const isAdmin = user?.email === 'jemchmi@gmail.com';

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
          
          <div className="flex items-center gap-3 md:gap-6">
            {user && (
              <>
                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className={`p-2 rounded-xl transition-all flex items-center gap-2 text-sm font-medium ${showHistory ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <History className="w-5 h-5" />
                  <span className="hidden sm:inline">历史记录</span>
                </button>
                <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>
              </>
            )}
            {user && (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    {isAdmin && <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                    {user.email?.split('@')[0]}
                  </span>
                </div>
                <button 
                  onClick={logout}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Progress Bar moved to page top, right below sticky header */}
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
        {showHistory && user && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/20 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-500" />
                  保存的文章
                </h3>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {historyLoading ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                    <p className="text-sm font-medium">加载中...</p>
                  </div>
                ) : historyList.length === 0 ? (
                  <div className="text-center py-20 text-slate-400 space-y-3">
                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                      <FileText className="w-8 h-8 opacity-20" />
                    </div>
                    <p className="text-sm">暂无历史文章</p>
                  </div>
                ) : (
                  historyList.map((item) => (
                    <div 
                      key={item.Key}
                      onClick={() => loadFromHistory(item.Key)}
                      className="group p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 transition-all cursor-pointer relative"
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-700 truncate">
                            {formatKeyName(item.Key)}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">
                            {(item.Size / 1024).toFixed(2)} KB · Markdown
                          </p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => handleDeleteHistory(e, item.Key)}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <div className="p-1.5 text-indigo-500">
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-6 border-t border-slate-100 bg-slate-50/30 text-center">
                <p className="text-[10px] text-slate-400">文章已安全存储在 Cloudflare R2</p>
              </div>
            </div>
            <div className="flex-1" onClick={() => setShowHistory(false)}></div>
          </div>
        )}

        {!user ? (
          <div className="max-w-md mx-auto space-y-6 animate-in fade-in zoom-in duration-500 pb-10">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">开启您的智能写作</h2>
              <p className="text-slate-500 text-sm">登录以访问 AI 字幕整理工具，让您的视频内容化为精美文章</p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 space-y-6">
              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="email" 
                      placeholder="邮箱地址" 
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="password" 
                      placeholder="密码" 
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
                    />
                  </div>
                </div>

                {authError && (
                  <div className="p-3 bg-red-50 text-red-500 text-xs rounded-xl flex items-center gap-2 border border-red-100">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {authError}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={authProcessing}
                  className="w-full py-3 rounded-xl gradient-bg text-white font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-indigo-200 transition-all disabled:opacity-50"
                >
                  {authProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : isSignUp ? (
                    <><UserPlus className="w-4 h-4" />立即注册</>
                  ) : (
                    <><LogIn className="w-4 h-4" />登录账号</>
                  )}
                </button>

                <div className="text-center">
                  <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-xs text-indigo-500 font-semibold hover:underline">
                    {isSignUp ? "已有账号？立即登录" : "还没有账号？点击注册"}
                  </button>
                </div>
              </form>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-white px-3 text-slate-400 font-medium">或快速登录</span></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={loginWithGoogle} className="py-2.5 px-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-slate-300 transition-all font-bold text-slate-700 shadow-sm text-xs">
                  <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" /> Google
                </button>
                <button onClick={loginWithGithub} className="py-2.5 px-4 bg-slate-900 text-white rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all font-bold shadow-lg shadow-slate-200 text-xs">
                  <Github className="w-4 h-4" /> GitHub
                </button>
              </div>
            </div>
          </div>
        ) : status === AppStatus.IDLE ? (
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
                {/* R2 Sync Status Indicators */}
                {status === AppStatus.SUCCESS && (
                  <div className="flex items-center gap-2">
                    {isSaving ? (
                      <div className="flex items-center gap-1.5 text-indigo-500 text-[10px] font-bold px-2 py-0.5 bg-indigo-50 rounded-md border border-indigo-100">
                        <CloudUpload className="w-3 h-3 animate-bounce" /> 正在同步至 R2 云端...
                      </div>
                    ) : isSaved ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-bold px-2 py-0.5 bg-emerald-50 rounded-md border border-emerald-100 animate-in fade-in zoom-in duration-300">
                        <Cloud className="w-3 h-3" /> 已保存在 R2 云端
                      </div>
                    ) : saveError ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-red-500 text-[10px] font-bold px-2 py-0.5 bg-red-50 rounded-md border border-red-100">
                          <CloudOff className="w-3 h-3" /> 同步 R2 失败
                        </div>
                        <button 
                          onClick={handleManualSync}
                          className="text-[10px] font-bold text-indigo-500 hover:underline flex items-center gap-1"
                        >
                          <RefreshCw className="w-2.5 h-2.5" /> 立即重试
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              {outputText && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={copyForNotion} className="flex items-center gap-2 px-4 py-1.5 bg-black text-white rounded-xl hover:bg-slate-800 transition-all text-xs font-bold shadow-md shadow-slate-200">
                    {notionCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <div className="w-3 h-3 bg-white rounded-[2px] flex items-center justify-center"><span className="text-black font-bold text-[8px]">N</span></div>}
                    {notionCopied ? '已复制' : '复制到 Notion'}
                  </button>
                  <button onClick={downloadResult} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-xs font-bold shadow-lg shadow-indigo-200">
                    <Download className="w-3.5 h-3.5" /> 下载 MD
                  </button>
                </div>
              )}
            </div>

            <div className={`bg-white rounded-3xl shadow-xl border border-slate-100 min-h-[50vh] relative overflow-hidden ${status === AppStatus.ERROR ? 'border-red-200 bg-red-50/10' : ''}`}>
              {/* Progress bar was here, moved to Header */}
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
                          
                          {/* Skeleton animation for text blocks */}
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
            <Sparkles className="w-3 h-3 text-indigo-400" /> 由 Google Gemini AI 驱动 · 智能分段 & 错别字纠正 · 自动同步 R2 云端
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
