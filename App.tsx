
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
  LogIn
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { processSubtitleToArticleStream } from './services/geminiService';
import { uploadToR2 } from './services/r2Service';
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
  const [error, setError] = useState<string | null>(null);
  const [notionCopied, setNotionCopied] = useState<boolean>(false);
  const [progress, setProgress] = useState(0);
  
  // Email/Password Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authProcessing, setAuthProcessing] = useState(false);

  const outputEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Progress bar simulation
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
    if (!inputText.trim() || !user) return;
    
    setOutputText('');
    setStatus(AppStatus.LOADING);
    setError(null);
    setIsSaved(false);
    setIsSaving(false);
    
    try {
      const stream = processSubtitleToArticleStream(inputText);
      let fullText = '';
      for await (const chunk of stream) {
        fullText += chunk;
        setOutputText(fullText);
      }
      
      setStatus(AppStatus.SUCCESS);
      
      // Automatic R2 Backup
      if (fullText) {
        setIsSaving(true);
        try {
          await uploadToR2(fullText, user.id);
          setIsSaved(true);
        } catch (r2Error) {
          console.error("Auto-save to R2 failed", r2Error);
        } finally {
          setIsSaving(false);
        }
      }
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
    setIsSaved(false);
    setIsSaving(false);
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
    element.download = "整理后的文章.md";
    document.body.appendChild(element);
    element.click();
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
        alert('注册成功！请检查邮箱以确认（如果是开发模式则可直接登录）。');
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
            <a href="https://sub2.324893.xyz" className="flex items-center gap-2 group">
              <div className="gradient-bg p-2 rounded-lg shadow-md group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-slate-800 tracking-tight leading-none">Sub2Article AI</span>
                <span className="text-[10px] text-indigo-500 font-medium tracking-wide">sub2.324893.xyz</span>
              </div>
            </a>
          </div>
          
          <div className="flex items-center gap-4 md:gap-6">
            {user ? (
              <>
                {status !== AppStatus.IDLE && (
                  <button 
                    onClick={reset}
                    className="hidden sm:flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors text-sm font-medium"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    重新开始
                  </button>
                )}
                <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                  <div className="hidden md:flex flex-col items-end">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      {isAdmin && <Crown className="w-3 h-3 text-amber-500 fill-amber-500" />}
                      {user.email?.split('@')[0]}
                    </span>
                    <span className="text-[10px] text-slate-400">已登录</span>
                  </div>
                  <button 
                    onClick={logout}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="登出"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </>
            ) : (
              <a 
                href="https://324893.xyz" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hidden md:flex items-center gap-1.5 text-slate-400 hover:text-slate-600 transition-colors text-xs font-medium"
              >
                <Globe className="w-3.5 h-3.5" />
                324893.xyz
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-12">
        {!user ? (
          <div className="max-w-md mx-auto mt-12 space-y-8 animate-in fade-in zoom-in duration-500 pb-20">
            <div className="text-center space-y-3">
              <div className="inline-block gradient-bg p-4 rounded-3xl shadow-xl shadow-indigo-200 animate-float">
                <FileText className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">开启您的智能写作</h2>
              <p className="text-slate-500">登录以访问 AI 字幕整理工具，让您的视频内容化为精美文章</p>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 space-y-6">
              {/* Email Form First */}
              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div className="space-y-4">
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
                    <>
                      <UserPlus className="w-4 h-4" />
                      立即注册
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      登录账号
                    </>
                  )}
                </button>

                <div className="text-center">
                  <button 
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-xs text-indigo-500 font-semibold hover:underline"
                  >
                    {isSignUp ? "已有账号？立即登录" : "还没有账号？点击注册"}
                  </button>
                </div>
              </form>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-slate-400 font-medium">或快速登录</span>
                </div>
              </div>

              {/* Social Login Buttons Side-by-side */}
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={loginWithGoogle}
                  className="py-3 px-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-slate-300 transition-all font-bold text-slate-700 shadow-sm text-sm"
                >
                  <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                  Google
                </button>
                <button 
                  onClick={loginWithGithub}
                  className="py-3 px-4 bg-slate-900 text-white rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all font-bold shadow-lg shadow-slate-200 text-sm"
                >
                  <Github className="w-4 h-4" />
                  GitHub
                </button>
              </div>

              <div className="text-center text-[10px] text-slate-400 leading-relaxed px-4">
                点击登录即表示您同意我们的使用条款。您的数据将安全存储在 Supabase。
              </div>
            </div>
          </div>
        ) : status === AppStatus.IDLE ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold text-slate-900 flex items-center justify-center gap-3">
                <Sparkles className="w-8 h-8 text-indigo-500" />
                整理您的视频转录
              </h2>
              <p className="text-slate-500">将混乱的语音识别文本转化为优雅的结构化文章</p>
            </div>

            <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100/50 border border-slate-100 overflow-hidden">
              <div className="p-6 md:p-8 space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-indigo-500" />
                    粘贴文本或上传文件
                  </h3>
                  <label className="cursor-pointer bg-slate-50 hover:bg-indigo-50 border border-dashed border-slate-300 hover:border-indigo-400 text-slate-600 hover:text-indigo-600 px-6 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    选择文件 (.txt, .srt)
                    <input type="file" className="hidden" accept=".txt,.srt" onChange={handleFileUpload} />
                  </label>
                </div>

                <textarea
                  className="w-full h-64 p-5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 resize-none bg-slate-50/50 text-slate-700 leading-relaxed transition-all outline-none"
                  placeholder="在此粘贴您的字幕或视频转录内容..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />

                <button
                  onClick={handleProcess}
                  disabled={!inputText.trim()}
                  className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] ${
                    !inputText.trim()
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'gradient-bg text-white hover:shadow-xl hover:shadow-indigo-500/20'
                  }`}
                >
                  <Sparkles className="w-6 h-6" />
                  开始智能整理
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                  整理后的文章
                  {status === AppStatus.LOADING && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full animate-bounce">
                      <Zap className="w-3 h-3 fill-current" />
                      AI 创作中
                    </div>
                  )}
                  {status === AppStatus.SUCCESS && isSaved && (
                    <div className="flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full border border-emerald-100 animate-in fade-in duration-300">
                      <Check className="w-3 h-3" />
                      已自动同步 R2 云端
                    </div>
                  )}
                  {isSaving && (
                    <div className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full border border-blue-100">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      正在同步 R2...
                    </div>
                  )}
                </h2>
              </div>

              {outputText && (
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={copyForNotion}
                    className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-xl hover:bg-slate-800 transition-all text-sm font-bold shadow-md shadow-slate-200"
                  >
                    {notionCopied ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <div className="w-4 h-4 bg-white rounded-[3px] flex items-center justify-center">
                        <span className="text-black font-bold text-[10px]">N</span>
                      </div>
                    )}
                    {notionCopied ? '已复制' : '复制到 Notion'}
                  </button>
                  <button 
                    onClick={downloadResult}
                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-bold shadow-lg shadow-indigo-200"
                  >
                    <Download className="w-4 h-4" />
                    下载 MD
                  </button>
                </div>
              )}
            </div>

            <div className={`bg-white rounded-3xl shadow-xl border border-slate-100 min-h-[60vh] relative overflow-hidden ${
              status === AppStatus.ERROR ? 'border-red-200 bg-red-50/10' : ''
            }`}>
              {/* Progress Bar */}
              {status === AppStatus.LOADING && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100 z-20">
                  <div 
                    className="h-full gradient-bg transition-all duration-300 ease-out shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              <div className="p-8 md:p-12">
                {status === AppStatus.ERROR ? (
                  <div className="flex flex-col items-center justify-center h-full text-red-500 py-20 text-center gap-4">
                    <AlertCircle className="w-16 h-16" />
                    <div className="space-y-1">
                      <p className="text-xl font-bold">处理失败</p>
                      <p className="text-slate-600">{error}</p>
                    </div>
                    <button onClick={handleProcess} className="mt-4 text-indigo-600 font-bold hover:underline">
                      尝试重试
                    </button>
                  </div>
                ) : (
                  <article className="prose prose-lg prose-indigo max-w-none">
                    {outputText ? (
                      <div className="text-slate-800 leading-relaxed">
                        <ReactMarkdown>{outputText}</ReactMarkdown>
                        {status === AppStatus.LOADING && (
                          <div className="inline-flex items-center gap-1">
                            <span className="inline-block w-2 h-5 bg-indigo-500 animate-pulse align-middle" />
                            <span className="text-xs text-indigo-400 font-medium animate-pulse ml-2">Gemini 正在撰写更多内容...</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-6">
                        <div className="relative">
                          <RefreshCw className="w-16 h-16 animate-spin text-indigo-500/30" />
                          <Sparkles className="w-8 h-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 animate-pulse" />
                        </div>
                        <div className="space-y-2 text-center">
                          <p className="text-slate-600 font-semibold text-lg">正在唤醒 AI 助手</p>
                          <p className="text-slate-400 text-sm max-w-xs mx-auto">我们将为您重新组织段落、润色文字并生成精美的排版...</p>
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
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-xs text-slate-400 font-medium">
          <a href="https://324893.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition-colors flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" /> 主页: 324893.xyz
          </a>
          <div className="hidden md:block w-px h-3 bg-slate-200"></div>
          <p className="flex items-center gap-1.5">
            由 Google Gemini AI 驱动 · 智能分段 & 错别字纠正 · 自动同步 R2 云端
          </p>
          <div className="hidden md:block w-px h-3 bg-slate-200"></div>
          <a href="https://sub2.324893.xyz" className="hover:text-indigo-600 transition-colors flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" /> sub2.324893.xyz
          </a>
        </div>
      </footer>
    </div>
  );
};

export default App;
