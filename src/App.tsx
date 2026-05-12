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
  Zap
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
  const [isCopied, setIsCopied] = useState(false);
  const [sampleVoiceId, setSampleVoiceId] = useState<string | null>(null);
  
  const modelRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize model
  const initModel = async () => {
    if (status === 'loading_model' || status === 'ready') return;
    
    setStatus('loading_model');
    setProgress(0);
    
    try {
      if (!Kokoro) {
        const module = await import('kokoro-js');
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
      setErrorMessage('Failed to load the neural engine. Please check your connection.');
    }
  };

  const handleProduce = async () => {
    if (!modelRef.current || !text.trim()) return;
    
    setStatus('generating');
    
    try {
      const result = await modelRef.current.generate(text, { 
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
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
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
      setErrorMessage('Generation failed. Try a shorter text or check settings.');
    }
  };

  const playSample = async (vId: string, name: string) => {
    if (!modelRef.current || status === 'loading_model' || sampleVoiceId) return;
    
    // Auto-init if not ready and clicked sample
    if (status === 'idle' || status === 'error') {
      await initModel();
    }

    setSampleVoiceId(vId);
    
    try {
      const sampleText = `Hello, I am ${name}. This is how I sound.`;
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#080808] text-[#e5e5e5] font-sans selection:bg-blue-500/30">
      {/* Mesh Gradient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-600/20 blur-[140px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/20 blur-[140px] rounded-full animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 flex flex-col h-screen overflow-hidden">
        
        {/* Navigation Bar */}
        <nav className="h-16 border-b border-white/5 bg-black/40 backdrop-blur-xl flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Zap className="w-5 h-5 text-white fill-white/20" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight">KOKORO <span className="text-blue-500">VOICE CRAFT</span></span>
              <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Studio v2.4</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-gray-400">
              <div className={`w-1.5 h-1.5 rounded-full ${status === 'ready' ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
              {status === 'ready' ? 'ENGINE STANDBY' : status === 'loading_model' ? 'ENGINE DOWNLOADING' : 'ENGINE OFFLINE'}
            </div>
            <button className="text-gray-400 hover:text-white transition-colors">
              <Settings2 className="w-5 h-5" />
            </button>
          </div>
        </nav>

        {/* Main Workspace */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          
          {/* Sidebar: Voice Controls */}
          <aside className="w-full lg:w-[400px] border-r border-white/5 bg-black/20 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
            <div className="p-6 space-y-8">
              
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <User className="w-3 h-3" />
                    Voice Profile
                  </h2>
                  <span className="text-[10px] text-blue-500 font-mono">{VOICES.length} Available</span>
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  {VOICES.map((v) => (
                    <div 
                      key={v.id}
                      className={`group relative flex items-center p-1 rounded-2xl border transition-all duration-300 ${
                        voiceId === v.id 
                          ? 'bg-blue-600/10 border-blue-500/50 shadow-inner' 
                          : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      <button
                        onClick={() => setVoiceId(v.id)}
                        className="flex-1 flex flex-col items-start p-3 text-left focus:outline-none"
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className={`text-sm font-semibold ${voiceId === v.id ? 'text-blue-400' : 'text-gray-200'}`}>{v.name}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 font-mono text-gray-500 group-hover:text-gray-400">{v.lang}</span>
                          </div>
                        </div>
                        <p className="text-[11px] text-gray-500 font-medium line-clamp-1">{v.description}</p>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playSample(v.id, v.name);
                        }}
                        disabled={sampleVoiceId !== null}
                        className={`mr-3 p-2.5 rounded-xl transition-all duration-300 ${
                          sampleVoiceId === v.id
                            ? 'bg-blue-500 text-white animate-pulse'
                            : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'
                        } disabled:opacity-30`}
                        title="Play Sample"
                      >
                        {sampleVoiceId === v.id ? (
                          <div className="flex gap-0.5 items-end">
                            <div className="w-0.5 h-3 bg-current rounded-full animate-bounce" />
                            <div className="w-0.5 h-4 bg-current rounded-full animate-bounce delay-75" />
                            <div className="w-0.5 h-2 bg-current rounded-full animate-bounce delay-150" />
                          </div>
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                      
                      {voiceId === v.id && (
                        <motion.div 
                          layoutId="sidebar-active"
                          className="absolute inset-0 border-2 border-blue-500/40 rounded-2xl pointer-events-none"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Speed Control */}
              <div className="space-y-4 pt-6 border-t border-white/5">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Sparkles className="w-3 h-3" />
                    Synthesis Settings
                  </h2>
                </div>
                <div className="space-y-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Playback Speed</span>
                      <span className="font-mono text-blue-400">{speed.toFixed(2)}x</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="2.0" 
                      step="0.1" 
                      value={speed}
                      onChange={(e) => setSpeed(parseFloat(e.target.value))}
                      className="w-full accent-blue-500 opacity-80 hover:opacity-100 transition-opacity"
                    />
                  </div>
                </div>
              </div>

            </div>
          </aside>

          {/* Editor & Script Area */}
          <main className="flex-1 flex flex-col min-w-0 bg-black/40 relative">
            
            {/* Toolbar */}
            <div className="h-10 border-b border-white/5 flex items-center justify-between px-6 bg-black/20 shrink-0">
              <div className="flex items-center gap-4 text-[10px] text-gray-500 font-mono tracking-widest uppercase">
                <Type className="w-3 h-3" />
                Script Monitor
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={copyToClipboard}
                  className="flex items-center gap-1 text-[10px] font-mono text-gray-500 hover:text-white transition-colors uppercase tracking-widest"
                >
                  {isCopied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  {isCopied ? 'COPIED' : 'COPY SCRIPT'}
                </button>
              </div>
            </div>

            {/* Script Input Container */}
            <div className="flex-1 relative overflow-hidden">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your text here to begin production..."
                className="w-full h-full p-12 bg-transparent text-2xl lg:text-3xl font-light text-white placeholder:text-white/10 leading-relaxed focus:ring-0 border-none resize-none custom-scrollbar"
                spellCheck={false}
              />
              
              {/* Floating Bottom Bar (Centering using flex in container is safer) */}
              <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none">
                <div className="pointer-events-auto">
                  {status === 'idle' || status === 'error' ? (
                    <button
                      onClick={initModel}
                      className="group px-8 py-5 rounded-full bg-white text-black font-bold flex items-center gap-3 shadow-2xl shadow-white/10 hover:bg-blue-500 hover:text-white transition-all duration-500 active:scale-95"
                    >
                      <RefreshCw className={`w-5 h-5 ${status === 'loading_model' ? 'animate-spin' : ''}`} />
                      {status === 'loading_model' ? `BOOTING ENGINE ${Math.round(progress)}%` : 'INITIATE NEURAL STUDIO'}
                    </button>
                  ) : (
                    <button
                      onClick={handleProduce}
                      disabled={status === 'generating' || !text.trim()}
                      className="group px-10 py-5 rounded-full bg-blue-600 text-white font-bold flex items-center gap-4 shadow-2xl shadow-blue-600/30 hover:bg-blue-500 hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:grayscale disabled:scale-100"
                    >
                      {status === 'generating' ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          PRODUCING MASTER...
                        </>
                      ) : (
                        <>
                          <Play className="w-6 h-6 fill-white" />
                          GENERATE AUDIO
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Productions History / Footer Panel */}
            <div className="h-[300px] border-t border-white/5 bg-black/60 backdrop-blur-3xl flex flex-col shrink-0">
              <div className="h-10 border-b border-white/5 flex items-center justify-between px-6 text-[10px] text-gray-500 font-mono tracking-widest shrink-0">
                <div className="flex items-center gap-2">
                  <Music className="w-3 h-3" />
                  PRODUCTION HISTORY
                </div>
                <div>{productions.length} TRACKS IN SESSION</div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                <AnimatePresence initial={false}>
                  {productions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 space-y-2">
                      <Waves className="w-10 h-10" />
                      <span className="text-[10px] font-mono tracking-widest">NO OUTPUT DETECTED</span>
                    </div>
                  ) : (
                    productions.map((p) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="group flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 transition-all"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <button 
                            onClick={() => new Audio(p.blobUrl).play()}
                            className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all"
                          >
                            <Play className="w-4 h-4 fill-current" />
                          </button>
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-200 truncate pr-4 italic">"{p.text}"</div>
                            <div className="flex items-center gap-3 text-[10px] text-gray-500 font-mono uppercase">
                              <span className="flex items-center gap-1"><User className="w-2.5 h-2.5" /> {p.voice.name}</span>
                              <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {p.duration.toFixed(1)}s</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 pr-2">
                          <a 
                            href={p.blobUrl} 
                            download={`kokoro-production-${p.id}.wav`}
                            className="p-2 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                            title="Download WAV"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          <button 
                            onClick={() => deleteProduction(p.id)}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-all focus:outline-none"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>

          </main>
        </div>

        {/* Status Error Notification */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-12 right-12 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-4 shadow-2xl backdrop-blur-xl z-[100]"
            >
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold uppercase tracking-widest text-[10px]">Production Error</p>
                <p className="opacity-80">{errorMessage}</p>
              </div>
              <button onClick={() => setErrorMessage('')} className="p-1 hover:text-white transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}


