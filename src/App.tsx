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
  
  const modelRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize model
  const initModel = async () => {
    if (status === 'loading_model' || status === 'ready') return;
    
    setStatus('loading_model');
    setProgress(0);
    
    try {
      if (!Kokoro) {
        const module: any = await import('kokoro-js');
        Kokoro = module.Kokoro;
      }

      modelRef.current = await Kokoro.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
        dtype: "q8",
        device: "wasm",
        progress_callback: (p: any) => {
          if (p.status === 'progress') {
            setProgress(p.progress * 100);
          }
        }
      });
      
      setStatus('ready');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage('Neural engine failure. Check connectivity.');
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
      setText(''); // Clear input
      
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
      
      const audio = new Audio(blobUrl);
      audio.play();
      
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
    <div className="flex h-screen bg-[#050505] text-[#efefef] font-sans overflow-hidden selection:bg-blue-500/30">
      
      {/* Workstation Grid Background */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
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
            className="border-r border-white-[0.05] bg-[#0A0A0A] flex flex-col shrink-0 overflow-hidden relative z-40 transition-shadow duration-500"
          >
            <div className="p-4 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-8 px-2 py-2">
                <div className="w-9 h-9 rounded-md bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/10">
                  <Waves className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-black tracking-[0.2em] uppercase">Kokoro<span className="text-blue-500">.Studio</span></span>
                  <span className="text-[8px] text-gray-600 font-mono tracking-widest uppercase opacity-60">PRO_SUITE_V2.5.4</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1">
                <div className="space-y-3">
                  <h3 className="px-2 text-[9px] font-bold text-gray-700 uppercase tracking-[0.4em] flex items-center gap-2">
                    <Hash className="w-3 h-3 opacity-50" />
                    Asset Buffer
                  </h3>
                  <div className="space-y-1">
                    {productions.map((p) => (
                      <motion.div
                        layout
                        key={p.id}
                        className="w-full group relative"
                      >
                        <button
                          onClick={() => new Audio(p.blobUrl).play()}
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
                  <h3 className="px-2 text-[9px] font-bold text-gray-700 uppercase tracking-[0.4em] flex items-center gap-2">
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
      <main className="flex-1 flex flex-col relative overflow-hidden bg-black ring-1 ring-white/5">
        
        {/* Toggle Sidebar Button */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute top-4 left-4 z-50 p-2.5 rounded-md bg-white/[0.02] border border-white-[0.05] text-gray-600 hover:text-white transition-all backdrop-blur-xl hover:bg-white/[0.05]"
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

            <div className="space-y-6">
              {[...productions].reverse().map((p) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group relative bg-[#0C0C0C] border border-white/5 rounded-lg overflow-hidden hover:border-blue-500/20 transition-all duration-300 shadow-lg"
                >
                  <div className="p-6 md:p-8 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-md bg-blue-600/10 text-blue-500 flex items-center justify-center border border-blue-500/10 transition-transform">
                          <Music className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-200 tracking-[0.2em] uppercase">{p.voice.name}</p>
                          <p className="text-[8px] font-mono text-gray-700 tracking-widest mt-1 uppercase">BLOCK_ID: {p.id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a 
                          href={p.blobUrl} 
                          download={`${p.id}.wav`}
                          className="p-2 rounded-md bg-white/[0.02] border border-white-[0.05] text-gray-600 hover:text-white hover:bg-white/10 transition-all"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                    
                    <div className="p-5 border-l-2 border-blue-600/30 bg-white/[0.01] text-lg font-medium leading-relaxed text-gray-400 font-mono">
                      {p.fullText}
                    </div>

                    <div className="pt-2 flex items-center gap-4">
                      <button 
                        onClick={() => new Audio(p.blobUrl).play()}
                        className="flex items-center gap-3 px-5 py-2.5 rounded-md bg-white text-black text-[9px] font-black tracking-widest uppercase hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        AUDIT TRACK
                      </button>
                      <div className="flex-1 h-px bg-white/[0.05]" />
                      <div className="flex gap-4 text-[8px] font-mono text-gray-600 uppercase tracking-tighter">
                        <span>Tempo: {speed}X</span>
                        <span>Length: {p.duration.toFixed(2)}S</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
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

        {/* Global Prompt Workstation */}
        <div className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-4xl z-50 px-4 md:px-0">
          <div className="bg-[#111111] border border-white/10 rounded-lg shadow-2xl overflow-hidden focus-within:border-blue-500/50 transition-all duration-300">
            
            <div className="flex flex-col">
              <textarea 
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="PROMPT_INPUT >>"
                className="w-full bg-transparent border-none resize-none px-6 py-5 md:py-6 pr-16 text-lg font-mono placeholder:text-gray-800 focus:ring-0 max-h-[300px] custom-scrollbar"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleProduce();
                  }
                }}
                style={{ height: 'auto', minHeight: '60px' }}
              />

              <div className="h-14 border-t border-white/[0.05] bg-white/[0.01] flex items-center justify-between px-4 md:px-6">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".txt" />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 md:p-2.5 rounded-md text-gray-700 hover:text-white hover:bg-white/[0.05] transition-all"
                    title="Import Text"
                  >
                    <Plus className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                  
                  <div className="h-5 w-px bg-white/[0.05] mx-1" />

                  <div className="relative">
                    <button 
                      onClick={() => setShowVoicePicker(!showVoicePicker)}
                      className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-md text-[9px] font-black tracking-tight uppercase transition-all ${showVoicePicker ? 'bg-blue-600 text-white' : 'bg-white/[0.02] border border-white-[0.05] text-gray-600 hover:text-white hover:bg-white/5'}`}
                    >
                      <User className="w-3 md:w-3.5 h-3 md:h-3.5" />
                      <span className="hidden sm:inline">{selectedVoice.name}</span>
                      <ChevronRight className={`w-3 h-3 transition-transform ${showVoicePicker ? '-rotate-90' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {showVoicePicker && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.98 }}
                          animate={{ opacity: 1, y: -10, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.98 }}
                          className="absolute bottom-full left-0 mb-2 w-[260px] bg-[#0A0A0A] border border-white/10 rounded-lg shadow-2xl p-1.5 z-[100] origin-bottom-left"
                        >
                          <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-1">
                            {VOICES.map((v) => (
                              <div key={v.id} className="flex items-center gap-1 group/v">
                                <button
                                  onClick={() => { setVoiceId(v.id); setShowVoicePicker(false); }}
                                  className={`flex-1 text-left px-3 py-2.5 rounded-md transition-all flex items-center justify-between ${v.id === voiceId ? 'bg-blue-600/10 text-white' : 'hover:bg-white/[0.03] text-gray-600 hover:text-gray-200'}`}
                                >
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold tracking-tight uppercase">{v.name}</span>
                                    <span className="text-[8px] opacity-40 font-mono tracking-widest uppercase">{v.lang}</span>
                                  </div>
                                  {v.id === voiceId && <Check className="w-3 h-3 text-blue-500" />}
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); playSample(v.id, v.name); }}
                                  className={`p-2 rounded-md transition-all ${sampleVoiceId === v.id ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-gray-800 hover:text-white'}`}
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

                <button 
                  onClick={handleProduce}
                  disabled={status === 'generating' || !text.trim() || status === 'loading_model'}
                  className={`h-9 md:h-10 px-4 md:px-6 rounded-md text-[9px] font-black tracking-widest uppercase flex items-center gap-2.5 transition-all ${!text.trim() || status !== 'ready' ? 'bg-white/[0.02] text-gray-800 cursor-not-allowed' : 'bg-white text-black hover:bg-blue-600 hover:text-white active:scale-95'}`}
                >
                  {status === 'generating' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  <span className="hidden sm:inline">{status === 'generating' ? 'Rendering' : 'Produce'}</span>
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
          color: rgba(255,255,255,0.03);
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }
      `}</style>
    </div>
  );
}



