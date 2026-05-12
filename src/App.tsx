import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Volume2, 
  Loader2, 
  Sparkles, 
  Settings2, 
  Info,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowRight,
  RefreshCw,
  Waves,
  Download,
  Trash2,
  Copy,
  Check,
  Music,
  Clock,
  Type,
  User,
  Zap,
  Plus,
  History,
  Send,
  FileText,
  X,
  VolumeX,
  Database,
  Hash
} from 'lucide-react';
import toWav from 'audiobuffer-to-wav';

// Lazy load kokoro-js
let Kokoro: any = null;

const VOICES = [
  { id: 'af_heart', name: 'Heart', lang: 'EN (US)', gender: 'Female', description: 'Warm and professional' },
  { id: 'af_bella', name: 'Bella', lang: 'EN (US)', gender: 'Female', description: 'Soft and articulate' },
  { id: 'af_nicole', name: 'Nicole', lang: 'EN (US)', gender: 'Female', description: 'Bright and energetic' },
  { id: 'af_sarah', name: 'Sarah', lang: 'EN (US)', gender: 'Female', description: 'Clear and neutral' },
  { id: 'af_sky', name: 'Sky', lang: 'EN (US)', gender: 'Female', description: 'Friendly and youthful' },
  { id: 'am_adam', name: 'Adam', lang: 'EN (US)', gender: 'Male', description: 'Deep and resonant' },
  { id: 'am_michael', name: 'Michael', lang: 'EN (US)', gender: 'Male', description: 'Authoritative' },
  { id: 'bf_isabelle', name: 'Isabelle', lang: 'EN (GB)', gender: 'Female', description: 'British, polite' },
  { id: 'bm_george', name: 'George', lang: 'EN (GB)', gender: 'Male', description: 'British, sophisticated' },
];

const PRONUNCIATION_TIPS = [
  { title: 'Acronyms', description: 'Space out letters (U S A) or use periods (U.S.A.) for natural pacing.', icon: Type },
  { title: 'Pauses', description: 'Add extra commas (,,) or ellipses (...) for strategic dramatic pauses.', icon: Clock },
  { title: 'Emphasis', description: 'Use exclamation points (!) to increase pitch and energy in sentences.', icon: Zap },
  { title: 'Complex Words', description: 'Spell tricky names phonetically (e.g., "Kokoro" as "Co-core-o").', icon: Sparkles },
];

interface Production {
  id: string;
  text: string;
  fullText: string;
  voice: typeof VOICES[0];
  timestamp: number;
  blobUrl: string;
  duration: number;
}

export default function App() {
  const [text, setText] = useState('');
  const [voiceId, setVoiceId] = useState(VOICES[0].id);
  const [speed, setSpeed] = useState(1.0);
  const [status, setStatus] = useState<'idle' | 'loading_model' | 'ready' | 'generating' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [productions, setProductions] = useState<Production[]>([]);
  const [sampleVoiceId, setSampleVoiceId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);
  const [bootLogs, setBootLogs] = useState<string[]>(['INITIALIZING_KERNEL_0.3.4...']);
  
  const modelRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const addLog = (log: string) => {
    setBootLogs(prev => [...prev.slice(-4), `> ${log}`]);
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

  const stopAudio = () => {
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      setActiveAudio(null);
    }
  };

  const playAudio = (url: string) => {
    stopAudio();
    const audio = new Audio(url);
    audio.onended = () => setActiveAudio(null);
    audio.play();
    setActiveAudio(audio);
  };

  // Initialize model
  const initModel = async () => {
    if (status === 'loading_model' || status === 'ready') return;
    
    setStatus('loading_model');
    setProgress(0);
    addLog('SEARCHING_LOCAL_CACHE...');
    
    try {
      if (!Kokoro) {
        addLog('IMPORTING_KOKORO_RUNTIME...');
        const module: any = await import('kokoro-js');
        Kokoro = module.Kokoro;
      }

      addLog('SYNCING_ONNX_82M_ENGINE_Q8...');
      modelRef.current = await Kokoro.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p: any) => {
          if (p.status === 'progress') {
            setProgress(p.progress * 100);
            if (p.progress > 0.1 && p.progress < 0.12) addLog('DOWNLOADING_WEIGHT_TENSORS...');
            if (p.progress > 0.5 && p.progress < 0.52) addLog('ALLOCATING_WASM_PAGES...');
            if (p.progress > 0.9 && p.progress < 0.92) addLog('VERIFYING_CHECKSUM...');
          }
        }
      });
      
      addLog('ENGINE_READY_V1.0');
      setTimeout(() => setStatus('ready'), 500);
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage('Neural engine failure. Check connectivity.');
      addLog('EXCEPTION: KERNEL_HALT');
    }
  };

  useEffect(() => {
    initModel();
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [productions, status]);

  const handleProduce = async () => {
    if (!modelRef.current || !text.trim() || status === 'generating') return;
    
    setStatus('generating');
    
    try {
      const currentText = text;
      
      const result = await modelRef.current.generate(currentText, { 
        voice: voiceId,
        speed: speed
      });
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const buffer = audioContextRef.current.createBuffer(
        1, 
        result.audio.length, 
        result.sampling_rate
      );
      buffer.getChannelData(0).set(result.audio);
      
      const wav = toWav(buffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const blobUrl = URL.createObjectURL(blob);
      
      const selectedVoice = VOICES.find(v => v.id === voiceId)!;
      
      const newProduction: Production = {
        id: Math.random().toString(36).substr(2, 9),
        text: currentText.substring(0, 60) + (currentText.length > 60 ? '...' : ''),
        fullText: currentText,
        voice: selectedVoice,
        timestamp: Date.now(),
        blobUrl: blobUrl,
        duration: result.audio.length / result.sampling_rate
      };
      
      setProductions(prev => [newProduction, ...prev]);
      setStatus('ready');
      setText(''); // Clear input only on success
      
      playAudio(blobUrl);
      
    } catch (err) {
      console.error(err);
      setStatus('ready');
      setErrorMessage('Synthesis failed. Text may be too long.');
    }
  };

  const playSample = async (vId: string, name: string) => {
    if (!modelRef.current || status === 'loading_model' || sampleVoiceId) return;
    
    if (status === 'idle' || status === 'error') {
      await initModel();
    }

    setSampleVoiceId(vId);
    
    try {
      const sampleText = `Hello, I'm ${name}. This is my digital voice profile.`;
      const result = await modelRef.current.generate(sampleText, { 
        voice: vId,
        speed: 1.0
      });
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const buffer = audioContextRef.current.createBuffer(
        1, 
        result.audio.length, 
        result.sampling_rate
      );
      buffer.getChannelData(0).set(result.audio);
      
      const wav = toWav(buffer);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const blobUrl = URL.createObjectURL(blob);
      
      const audio = new Audio(blobUrl);
      audio.onended = () => {
        setSampleVoiceId(null);
        URL.revokeObjectURL(blobUrl);
      };
      audio.play();
    } catch (err) {
      console.error(err);
      setSampleVoiceId(null);
    }
  };

  const deleteProduction = (id: string) => {
    setProductions(prev => {
      const p = prev.find(item => item.id === id);
      if (p) URL.revokeObjectURL(p.blobUrl);
      return prev.filter(item => item.id !== id);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setText(content);
    };
    reader.readAsText(file);
  };

  const selectedVoice = VOICES.find(v => v.id === voiceId)!;

  return (
    <div className="flex h-screen bg-[#0d1117] text-[#c9d1d9] font-sans overflow-hidden selection:bg-blue-500/30">
      
      <AnimatePresence mode="wait">
        {(status === 'loading_model' || status === 'idle' || status === 'error') ? (
          <motion.div 
            key="setup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="fixed inset-0 z-[100] bg-[#0d1117] flex items-center justify-center p-6"
          >
            {/* Workstation Grid Background */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            
            <div className="w-full max-w-xl relative">
              {/* Glow effects */}
              <div className="absolute -top-32 -left-32 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full" />
              <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-green-600/10 blur-[100px] rounded-full" />

              <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-2xl">
                {/* Window Header */}
                <div className="px-4 py-3 border-b border-[#30363d] bg-[#0d1117] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/20" />
                  </div>
                  <span className="text-[10px] font-mono text-[#8b949e] uppercase tracking-widest">Kokoro_Initialization_Kernel_v1.0</span>
                </div>

                <div className="p-8 space-y-8">
                  <div className="flex items-center gap-6">
                    <div className={`w-16 h-16 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${status === 'error' ? 'bg-red-500/10 border-red-500/20' : 'bg-[#238636]/10 border-[#238636]/20'}`}>
                      <Database className={`w-8 h-8 ${status === 'error' ? 'text-red-500' : 'text-[#3fb950]'} ${status === 'loading_model' ? 'animate-pulse' : ''}`} />
                    </div>
                    <div className="flex-1">
                      <h1 className="text-xl font-black text-white uppercase tracking-tighter mb-1">
                        {status === 'error' ? 'Initialization Failed' : 'Synchronizing Neural Engine'}
                      </h1>
                      <p className="text-xs text-[#8b949e] font-mono uppercase tracking-widest">ONNX_COMMUNITY / KOKORO_82M_V1.0</p>
                    </div>
                  </div>

                  {status === 'error' ? (
                    <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg space-y-4">
                      <p className="text-[11px] text-red-400 font-mono text-center uppercase tracking-wider">{errorMessage}</p>
                      <button 
                        onClick={() => initModel()}
                        className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase tracking-widest transition-colors rounded"
                      >
                        Retry Sync
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-[#c9d1d9] uppercase tracking-wider">Download Progress</span>
                          <p className="text-[9px] text-[#8b949e] font-mono uppercase">Status: {progress >= 100 ? 'OPTIMIZING' : 'FETCHING_RESOURCES'}</p>
                        </div>
                        <span className="text-2xl font-black text-[#58a6ff] font-mono">{progress.toFixed(1)}%</span>
                      </div>

                      <div className="h-3 bg-[#21262d] rounded-full overflow-hidden p-0.5 border border-[#30363d]">
                        <motion.div 
                          className="h-full bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                        />
                      </div>
                    </div>
                  )}


                  {/* Terminal Logs */}
                  <div className="bg-black/40 border border-[#30363d] rounded-lg p-4 font-mono text-[10px] space-y-1.5 h-32 overflow-hidden">
                    {bootLogs.map((log, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: i === bootLogs.length - 1 ? 1 : 0.4, x: 0 }}
                        className={i === bootLogs.length - 1 ? 'text-[#3fb950]' : 'text-[#8b949e]'}
                      >
                        {log}
                      </motion.div>
                    ))}
                    {status === 'loading_model' && (
                      <motion.div 
                        animate={{ opacity: [0, 1] }} 
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        className="w-1.5 h-3 bg-[#3fb950] inline-block ml-1 align-middle"
                      />
                    )}
                  </div>
                </div>

                <div className="px-8 py-4 bg-[#0d1117] border-t border-[#30363d] flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 text-[#3fb950] animate-spin" />
                    <span className="text-[8px] font-mono text-[#8b949e] uppercase tracking-[0.2em]">Local_Thread_Active</span>
                  </div>
                  <span className="text-[8px] font-mono text-[#484f58] uppercase">Secure Port 3000 // AES-256</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="workspace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex w-full h-full"
          >
            {/* Workstation Grid Background */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.02]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            
            <div className="fixed inset-0 pointer-events-none opacity-10">
              <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full animate-pulse" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full animate-pulse delay-700" />
            </div>

            {/* Sidebar */}
            <AnimatePresence initial={false}>
              {isSidebarOpen && (
                <motion.aside 
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 300, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="border-r border-[#30363d] bg-[#010409] flex flex-col shrink-0 overflow-hidden relative z-40 transition-shadow duration-500"
                >
                  <div className="p-4 flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-8 px-2 py-2">
                      <div className="w-9 h-9 rounded-md bg-[#238636] flex items-center justify-center shadow-lg shadow-green-900/20">
                        <Waves className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black tracking-[0.2em] uppercase">Kokoro<span className="text-[#3fb950]">.Craft</span></span>
                        <span className="text-[8px] text-[#8b949e] font-mono tracking-widest uppercase opacity-60">STABLE_V2.5.4</span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1">
                      <div className="space-y-3">
                        <h3 className="px-2 text-[9px] font-bold text-[#8b949e] uppercase tracking-[0.4em] flex items-center gap-2">
                          <Hash className="w-3 h-3 opacity-50" />
                          Sessions
                        </h3>
                        <div className="space-y-1">
                          {productions.map((p) => (
                            <motion.div
                              layout
                              key={p.id}
                              className="w-full group relative"
                            >
                              <button
                                onClick={() => playAudio(p.blobUrl)}
                                className="w-full text-left p-3 rounded-md bg-white/[0.01] border border-white/5 hover:bg-white/[0.03] hover:border-blue-500/30 group flex items-center gap-3 transition-all duration-200"
                              >
                                <div className="w-8 h-8 rounded-sm bg-blue-500/5 text-blue-500/50 flex items-center justify-center shrink-0 group-hover:text-blue-500 group-hover:bg-blue-500/10 transition-colors">
                                  <Play className="w-3 h-3 fill-current" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-bold text-gray-300 truncate leading-relaxed tracking-tight">{p.text}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[8px] text-gray-600 font-mono uppercase tracking-tighter">{p.duration.toFixed(1)}s</span>
                                    <span className="text-[8px] text-gray-700">|</span>
                                    <span className="text-[8px] text-gray-600 font-mono uppercase tracking-tighter truncate">{p.voice.name}</span>
                                  </div>
                                </div>
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); deleteProduction(p.id); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 rounded-sm hover:bg-red-500/10 text-gray-700 hover:text-red-500 transition-all z-10"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </motion.div>
                          ))}
                          {productions.length === 0 && (
                            <div className="px-4 py-8 text-center border border-dashed border-white/5 rounded-lg opacity-20">
                              <History className="w-5 h-5 mx-auto mb-2 text-gray-600" />
                              <p className="text-[8px] text-gray-500 font-mono tracking-widest uppercase">Buffer Clear</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/[0.05] space-y-4">
                        <h3 className="px-2 text-[9px] font-bold text-[#8b949e] uppercase tracking-[0.4em] flex items-center gap-2">
                          <Settings2 className="w-3 h-3 opacity-50" />
                          Parameters
                        </h3>
                        <div className="bg-white/[0.01] rounded-lg p-4 space-y-5 border border-white/5">
                          <div className="space-y-3">
                            <div className="flex justify-between items-center text-[9px] font-mono uppercase tracking-widest">
                              <span className="text-gray-600">Tempo (Speed)</span>
                              <span className="text-blue-500 border border-blue-500/20 px-1.5 py-0.5 bg-blue-500/5">{speed.toFixed(2)}x</span>
                            </div>
                            <input 
                              type="range" min="0.5" max="2.0" step="0.1" value={speed}
                              onChange={(e) => setSpeed(parseFloat(e.target.value))}
                              className="w-full accent-blue-600 bg-white/5 h-1 rounded-none appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-[7px] font-mono text-gray-700 px-0.5 uppercase tracking-tighter">
                              <span>Lento</span>
                              <span>Presto</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/[0.05] space-y-4">
                        <h3 className="px-2 text-[9px] font-bold text-[#8b949e] uppercase tracking-[0.4em] flex items-center gap-2">
                          <Info className="w-3 h-3 opacity-50" />
                          Pronunciation
                        </h3>
                        <div className="space-y-2">
                          {PRONUNCIATION_TIPS.map((tip, i) => (
                            <div key={i} className="p-3 rounded-lg bg-white/[0.01] border border-white/5 hover:border-white/10 transition-colors group">
                              <div className="flex items-center gap-2 mb-1.5">
                                <tip.icon className="w-3 h-3 text-[#58a6ff] opacity-70" />
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{tip.title}</span>
                              </div>
                              <p className="text-[11px] text-[#8b949e] leading-relaxed font-sans opacity-70 group-hover:opacity-100 transition-opacity">
                                {tip.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-white/[0.05]">
                      <div className={`p-3 rounded-md border transition-all duration-300 ${status === 'ready' ? 'bg-green-500/5 border-green-500/10 text-green-400' : 'bg-blue-500/5 border-blue-500/10 text-blue-400'}`}>
                        <div className="flex items-center gap-3">
                          <Database className={`w-3.5 h-3.5 ${status === 'loading_model' ? 'animate-spin' : ''}`} />
                          <div className="flex-1">
                            <p className="text-[9px] font-black uppercase tracking-[0.25em]">{status === 'loading_model' ? 'Kernel_Sync' : 'Engine_Active'}</p>
                            {status === 'loading_model' && (
                              <div className="w-full h-1 bg-white/5 rounded-none mt-1.5 overflow-hidden">
                                <motion.div 
                                  className="h-full bg-blue-500" 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.aside>
              )}
            </AnimatePresence>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col relative overflow-hidden bg-[#0d1117] ring-1 ring-[#30363d]">
              
              {/* Toggle Sidebar Button */}
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="absolute top-4 left-4 z-50 p-2.5 rounded-lg bg-[#21262d] border border-[#30363d] text-[#8b949e] hover:text-white transition-all hover:bg-[#30363d]"
              >
                <History className={`w-4 h-4 transition-transform duration-500 ${isSidebarOpen ? '-rotate-180' : ''}`} />
              </button>

              {/* Studio Canvas */}
              <div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar pt-20 pb-48">
                <div className="max-w-4xl mx-auto w-full">
                  <AnimatePresence>
                    {productions.length === 0 && status !== 'generating' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="py-32 text-center space-y-6"
                      >
                        <div className="inline-flex p-6 rounded-lg bg-white/[0.01] border border-white/5 relative overflow-hidden group">
                          <Zap className="w-12 h-12 text-gray-800 group-hover:text-blue-500 transition-colors relative z-10" />
                          <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="space-y-2">
                          <h2 className="text-2xl font-bold tracking-tight text-white uppercase">Neural Production Suite</h2>
                          <p className="text-gray-600 max-w-sm mx-auto text-sm font-medium leading-relaxed">System operational. Input text below to begin high-fidelity neural synthesis.</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-12">
                    {[...productions].reverse().map((p) => (
                      <div key={p.id} className="space-y-4">
                        {/* User Message (The Prompt) */}
                        <div className="flex justify-end">
                          <motion.div 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="max-w-[80%] bg-[#1c2128] border border-[#30363D] rounded-lg px-4 py-3 text-sm text-[#c9d1d9] shadow-sm relative group"
                          >
                            <p className="whitespace-pre-wrap">{p.fullText}</p>
                            <button 
                              className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 text-[#8b949e] hover:text-white transition-opacity"
                              onClick={() => setText(p.fullText)}
                              title="Edit as new prompt"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </motion.div>
                        </div>

                        {/* Assistant Message (The Synthesis Result) */}
                        <div className="flex justify-start">
                          <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="max-w-[95%] w-full flex items-start gap-3"
                          >
                            <div className="w-8 h-8 rounded-md bg-[#238636]/10 border border-[#238636]/20 flex items-center justify-center shrink-0 mt-1">
                              <Waves className="w-4 h-4 text-[#238636]" />
                            </div>
                            
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] font-bold text-[#c9d1d9] uppercase tracking-wider">{p.voice.name}</span>
                                <span className="text-[10px] text-[#8b949e] font-mono tracking-tighter uppercase opacity-50">SYNCED {new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>

                              <div className="bg-[#0D1117] border border-[#30363D] rounded-lg overflow-hidden group">
                                <div className="p-4 border-b border-[#30363D] flex items-center justify-between bg-[#161b22]/50">
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={() => playAudio(p.blobUrl)}
                                      className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#238636] text-white text-[10px] font-bold uppercase hover:bg-[#2ea043] transition-colors"
                                    >
                                      <Play className="w-3 h-3 fill-current" />
                                      Play Audio
                                    </button>
                                    <span className="text-[10px] font-mono text-[#8b949e]">{p.duration.toFixed(2)}s</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <a 
                                      href={p.blobUrl} 
                                      download={`${p.id}.wav`}
                                      className="p-1.5 rounded-md hover:bg-[#21262d] text-[#8b949e] hover:text-white transition-all"
                                    >
                                      <Download className="w-4 h-4" />
                                    </a>
                                    <button 
                                      onClick={() => deleteProduction(p.id)}
                                      className="p-1.5 rounded-md hover:bg-red-500/10 text-[#8b949e] hover:text-red-400 transition-all"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                
                                <div className="p-4 text-sm text-[#8b949e] font-mono whitespace-pre-wrap leading-relaxed italic opacity-80 bg-black/20">
                                  Neural sequence generated successfully. Execution ID: {p.id.toUpperCase()}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        </div>
                      </div>
                    ))}

                    {status === 'generating' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/[0.01] border border-dashed border-blue-500/30 rounded-lg p-10 flex flex-col items-center justify-center gap-4"
                      >
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                        <div className="text-center">
                          <p className="text-[9px] font-black text-blue-500 tracking-[0.4em] uppercase">Processing Signal</p>
                          <p className="text-[8px] text-gray-700 font-mono mt-1 uppercase tracking-widest">Render_Active</p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                  <div ref={messagesEndRef} className="h-1" />
                </div>
              </div>

              {/* Workstation Prompt Bar */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-4xl z-50 px-4 md:px-0">
                <div className="bg-[#0D1117] border border-[#30363D] rounded-lg shadow-2xl overflow-hidden focus-within:border-[#444c56] transition-all duration-200">
                  
                  <div className="flex flex-col">
                    <textarea 
                      ref={textareaRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Type text for synthesis..."
                      className="w-full bg-transparent border-none resize-none px-5 py-4 text-sm font-sans placeholder:text-[#484f58] focus:ring-0 max-h-[300px] custom-scrollbar scroll-smooth"
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleProduce();
                        }
                      }}
                      style={{ height: 'auto', minHeight: '60px' }}
                    />

                    <div className="h-12 border-t border-[#30363D] bg-[#0d1117] flex items-center justify-between px-3">
                      <div className="flex items-center gap-1.5">
                        {/* Left Action Group */}
                        <button className="p-2 rounded-md text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-colors">
                          <History className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-md text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-colors">
                          <FileText className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2 rounded-md text-[#8b949e] hover:text-white hover:bg-[#21262d] transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".txt" />
                        </button>
                        
                        <div className="h-4 w-px bg-[#30363D] mx-1" />

                        {/* Voice Selector (Styled like Model Selector) */}
                        <div className="relative">
                          <button 
                            onClick={() => setShowVoicePicker(!showVoicePicker)}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium text-[#c9d1d9] hover:bg-[#21262d] transition-all border border-transparent ${showVoicePicker ? 'bg-[#21262d]' : ''}`}
                          >
                            <User className="w-3.5 h-3.5 text-[#8b949e]" />
                            <span className="max-w-[100px] truncate">{selectedVoice.name}</span>
                            <ChevronDown className={`w-3 h-3 text-[#8b949e] transition-transform ${showVoicePicker ? 'rotate-180' : ''}`} />
                          </button>

                          <AnimatePresence>
                            {showVoicePicker && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: -8 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute bottom-full left-0 mb-2 w-[240px] bg-[#161b22] border border-[#30363D] rounded-lg shadow-2xl p-1 z-[100] origin-bottom-left"
                              >
                                <div className="max-h-[250px] overflow-y-auto custom-scrollbar space-y-0.5">
                                  <div className="px-3 py-2 text-[10px] font-bold text-[#8b949e] uppercase tracking-wider">Voice Profiles</div>
                                  {VOICES.map((v) => (
                                    <div key={v.id} className="flex items-center gap-1 group/v">
                                      <button
                                        onClick={() => { setVoiceId(v.id); setShowVoicePicker(false); }}
                                        className={`flex-1 text-left px-3 py-2 rounded-md transition-all flex items-center justify-between ${v.id === voiceId ? 'bg-[#1f6feb]/10 text-[#58a6ff]' : 'hover:bg-[#21262d] text-[#c9d1d9] hover:text-white'}`}
                                      >
                                        <div className="flex flex-col">
                                          <span className="text-xs font-medium">{v.name}</span>
                                          <span className="text-[9px] text-[#8b949e] uppercase font-mono">{v.lang}</span>
                                        </div>
                                        {v.id === voiceId && <Check className="w-3.5 h-3.5" />}
                                      </button>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); playSample(v.id, v.name); }}
                                        className={`p-2 rounded-md mr-1 ${sampleVoiceId === v.id ? 'bg-[#238636] text-white' : 'hover:bg-[#21262d] text-[#8b949e] hover:text-[#c9d1d9]'}`}
                                        disabled={sampleVoiceId !== null}
                                      >
                                        {sampleVoiceId === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* Right Action Button */}
                      <button 
                        onClick={handleProduce}
                        disabled={status === 'generating' || !text.trim() || status === 'loading_model'}
                        className={`flex items-center justify-center w-8 h-8 rounded-md transition-all ${
                          !text.trim() || status !== 'ready' 
                            ? 'text-[#484f58] cursor-not-allowed' 
                            : 'text-white bg-[#238636] hover:bg-[#2ea043]'
                        }`}
                      >
                        {status === 'generating' ? (
                          <div className="w-3 h-3 bg-white rounded-sm animate-pulse" />
                        ) : (
                          <ArrowUp className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Console Exception Alert */}
              <AnimatePresence>
                {errorMessage && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="fixed top-6 right-6 p-4 rounded-md bg-red-600 text-white z-[1000] flex items-start gap-4 max-w-sm shadow-xl"
                  >
                    <VolumeX className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <h4 className="text-[9px] font-black uppercase tracking-[0.2em]">IO_ERROR</h4>
                      <p className="text-xs font-bold leading-tight">{errorMessage}</p>
                    </div>
                    <button onClick={() => setErrorMessage('')} className="opacity-60 hover:opacity-100 transition-opacity">
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

            </main>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 3px;
          height: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 0px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        textarea::placeholder {
          color: #484f58;
          font-weight: 500;
          text-transform: none;
          letter-spacing: normal;
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
}



