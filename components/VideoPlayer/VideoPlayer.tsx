'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize, Settings, Subtitles, Users, Wifi, Info
} from 'lucide-react';
import './VideoPlayer.css';
import { useAuth } from '@/contexts/AuthContext';
import { saveProgress, getProgress } from '@/lib/supabase';

const STREAMING_URL = process.env.NEXT_PUBLIC_STREAMING_URL || 'http://159.112.189.135:4000';

interface Subtitle {
  url: string;
  lang: string;
  label: string;
}

interface Props {
  src: string;
  title: string;
  infoHash: string;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  episodes?: any[];
  subtitles?: Subtitle[];
  posterUrl?: string | null;
  onEpisodeChange?: (epNum: number) => void;
  onBack: () => void;
}

const VideoPlayer: React.FC<Props> = ({ 
  src, title, infoHash, tmdbId, mediaType, season, episode, episodes, subtitles, posterUrl, onEpisodeChange, onBack 
}) => {
  const { profile } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [activeSubtitle, setActiveSubtitle] = useState<number | null>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const initialSeekRef = useRef<number | null>(null);
  const transcodeOffsetRef = useRef<number>(0);
  const savedPositionRef = useRef<number>(0);
  const [subDelay, setSubDelay] = useState(0);
  const [subTab, setSubTab] = useState<'lang' | 'settings'>('lang');
  const [subConfig, setSubConfig] = useState({
    size: '1.2rem',
    color: '#ffffff',
    bg: 'rgba(0,0,0,0.75)',
    font: '"Inter", sans-serif',
    bottom: '130px' // Média por padrão (subindo de 80px)
  });
  const [status, setStatus] = useState({ peers: 0, speed: '0 KB/s', status: 'Iniciando P2P...' });
  const [hasLoadedProgress, setHasLoadedProgress] = useState(false);
  const [savedPosition, setSavedPosition] = useState(0);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTime = useRef<number>(0);

  // --- Faixas de áudio ---
  interface AudioTrack { index: number; codec: string; language: string; channels: number; compatible: boolean; }
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState(0);
  const [isTranscoded, setIsTranscoded] = useState(false);
  const [transcodeSrc, setTranscodeSrc] = useState('');
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [probeStatus, setProbeStatus] = useState<'idle'|'probing'|'done'>('idle');

  // --- Legendas (sistema custom, sem depender de <track> CORS) ---
  interface Cue { start: number; end: number; text: string; }
  const parsedCues = useRef<Cue[]>([]);
  const [currentSubText, setCurrentSubText] = useState('');

  // Parser VTT/SRT simples
  const parseVTT = (text: string): Cue[] => {
    const cues: Cue[] = [];
    // Normalize carriage returns and remove BOM + optional WEBVTT header
    const clean = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/^\uFEFF/, '')
      .replace(/^WEBVTT[^\n]*\n/, '')
      .trim();
    
    const blocks = clean.split(/\n\s*\n+/);
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length === 0) continue;

      // Find timing line containing -->
      const tsLine = lines.find(line => line.includes('-->'));
      if (!tsLine) continue;

      const parts = tsLine.split('-->');
      if (parts.length < 2) continue;

      const startStr = (parts[0] || '').trim();
      const endPart = (parts[1] || '').trim();
      const endStr = endPart.split(/\s+/)[0] || '';

      const toSec = (s: string) => {
        const cleanS = s.replace(',', '.');
        const subParts = cleanS.split(':');
        if (subParts.length === 3) {
          const h = parseFloat(subParts[0] || '0');
          const m = parseFloat(subParts[1] || '0');
          const sDec = parseFloat(subParts[2] || '0');
          return h * 3600 + m * 60 + sDec;
        } else if (subParts.length === 2) {
          const m = parseFloat(subParts[0] || '0');
          const sDec = parseFloat(subParts[1] || '0');
          return m * 60 + sDec;
        } else {
          return parseFloat(cleanS) || 0;
        }
      };

      const start = toSec(startStr);
      const end = toSec(endStr);

      const tsIdx = lines.indexOf(tsLine);
      const textLines = lines.slice(tsIdx + 1);

      const textVal = textLines
        .join('\n')
        .replace(/<[^>]+>/g, '') // strip HTML/formatting tags
        .trim();

      if (textVal) {
        cues.push({ start, end, text: textVal });
      }
    }
    return cues.sort((a, b) => a.start - b.start);
  };

  // Carrega e parseia a legenda quando o índice ativo muda
  useEffect(() => {
    parsedCues.current = [];
    setCurrentSubText('');
    if (activeSubtitle === null || !subtitles || !subtitles[activeSubtitle]) return;
    const sub = subtitles[activeSubtitle];
    const proxyUrl = `/api/subtitles?url=${encodeURIComponent(sub.url)}`;
    fetch(proxyUrl, { cache: 'force-cache' })
      .then(r => r.text())
      .then(text => {
        parsedCues.current = parseVTT(text);
        console.log('[SUBS] Carregado', parsedCues.current.length, 'cues para', sub.label);
      })
      .catch(e => console.error('[SUBS] Erro ao carregar:', e.message));
  }, [activeSubtitle, subtitles]);

  // Sincroniza o texto da legenda com o currentTime do vídeo
  const syncSubtitleToTime = useCallback((currentTime: number) => {
    const t = currentTime + subDelay;
    const cue = parsedCues.current.find(c => t >= c.start && t <= c.end);
    const newText = cue ? cue.text : '';
    
    // Só atualiza o estado se o texto realmente mudou, evitando re-renders desnecessários a 60fps!
    setCurrentSubText(prev => prev !== newText ? newText : prev);
  }, [subDelay]);

  // Loop de alta precisão (requestAnimationFrame) para sincronização instantânea das legendas (60fps)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPlaying || activeSubtitle === null) return;

    let active = true;
    let frameId: number;

    const updateLoop = () => {
      if (!active) return;
      
      const absTime = transcodeOffsetRef.current + video.currentTime;
      syncSubtitleToTime(absTime);
      
      frameId = requestAnimationFrame(updateLoop);
    };

    frameId = requestAnimationFrame(updateLoop);

    return () => {
      active = false;
      cancelAnimationFrame(frameId);
    };
  }, [isPlaying, activeSubtitle, syncSubtitleToTime]);


  const formatSpeed = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  };

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isP2P = src.includes('/api/stream/');

  // Monitoramento do servidor em tempo real + pré-aquecimento (como o Stremio faz)
  useEffect(() => {
    if (!isP2P || !infoHash) {
      // Conexão direta premium (Real-Debrid, HTTP streams, etc)
      setStatus({
        peers: 0,
        speed: 'Premium ⚡',
        status: 'Conexão Direta de Alta Velocidade'
      });
      return;
    }
    
    // Pré-aquecimento: inicia a conexão P2P IMEDIATAMENTE ao abrir o player
    // (antes mesmo do vídeo começar a ser requisitado)
    fetch(`/api/status/${infoHash}`, { cache: 'no-store' }).catch(() => {});
    
    let interval: NodeJS.Timeout;
    
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/status/${infoHash}`, { 
          cache: 'no-store'
        });
        
        if (res.ok) {
          const data = await res.json();
          const hasPeers = data.peers > 0;
          
          setStatus({
            peers: data.peers || 0,
            speed: formatSpeed(data.speed),
            status: hasPeers ? `${data.peers} peers • ${data.progress}` : 'Buscando Seeds...'
          });
        }
      } catch (e: any) {
        console.log('Status check error:', e.message);
      }
    };
    
    // Primeiro check imediato
    checkStatus();
    
    // Depois a cada 4 segundos
    interval = setInterval(checkStatus, 4000);
    
    return () => clearInterval(interval);
  }, [infoHash, isP2P]);

  // --------------------------------------------------------
  // PROBE: detecta codecs e troca para stream transcoded
  // quando áudio não é compatível (EAC3/DTS/AC3 etc)
  // --------------------------------------------------------
  useEffect(() => {
    if (!isP2P || !infoHash) return;
    setProbeStatus('probing');

    const doProbe = async () => {
      // Aguarda o torrent estar pronto (máx 30s)
      for (let i = 0; i < 60; i++) {
        try {
          const r = await fetch(`/api/probe/${infoHash}`, { cache: 'no-store' });
          if (!r.ok) { await new Promise(res => setTimeout(res, 500)); continue; }
          const data = await r.json();
          if (!data.audioTracks) { await new Promise(res => setTimeout(res, 500)); continue; }

          setAudioTracks(data.audioTracks);

          // Encontra a melhor faixa: prefere Português, depois a primeira
          let bestTrack = 0;
          const ptTrack = data.audioTracks.findIndex((t: AudioTrack) =>
            t.language === 'por' || t.language === 'pt' || t.language === 'pb'
          );
          if (ptTrack >= 0) bestTrack = ptTrack;
          setSelectedAudioTrack(bestTrack);

          if (data.needsTranscode) {
            console.log('[AUDIO] Codec incompatível, usando transcode:', data.audioTracks.map((t: AudioTrack) => t.codec));
            setIsTranscoded(true);
            const startPos = savedPositionRef.current || 0;
            transcodeOffsetRef.current = startPos;
            setTranscodeSrc(`/api/transcode/${infoHash}?audioTrack=${bestTrack}&t=${startPos}`);
          }
          setProbeStatus('done');
          return;
        } catch { await new Promise(res => setTimeout(res, 500)); }
      }
      setProbeStatus('done'); // Timeout - usa stream original
    };

    doProbe();
  }, [infoHash, isP2P]);

  // Muda faixa de áudio: reinicia o stream transcoded na posição atual
  const switchAudioTrack = useCallback((trackIndex: number) => {
    const video = videoRef.current;
    if (!video) return;
    const absoluteTime = transcodeOffsetRef.current + (video.currentTime || 0);
    setSelectedAudioTrack(trackIndex);
    setShowAudioMenu(false);
    if (isTranscoded) {
      const newSrc = `/api/transcode/${infoHash}?audioTrack=${trackIndex}&t=${Math.floor(absoluteTime)}`;
      transcodeOffsetRef.current = Math.floor(absoluteTime);
      setTranscodeSrc(newSrc);
      video.src = newSrc;
      video.load();
      video.currentTime = 0; // fMP4 transcoded começa do tempo passado via ?t=
      video.play().catch(() => {});
    }
  }, [infoHash, isTranscoded]);




  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
    }
  }, [isPlaying]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) videoRef.current.volume = val;
    setVolume(val);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && duration > 0) {
      const absTime = transcodeOffsetRef.current + video.currentTime;
      setProgress((absTime / duration) * 100);
      syncSubtitleToTime(absTime);

      // Salvar a cada 10 segundos
      if (profile && Math.abs(absTime - lastSaveTime.current) > 10) {
        lastSaveTime.current = absTime;
        saveProgress(profile.id, tmdbId, mediaType, {
          position_seconds: Math.floor(absTime),
          duration_seconds: Math.floor(duration),
          status: 'watching',
          season_number: season || null,
          episode_number: episode || null
        });
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current && duration > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = x / rect.width;
      const targetTime = pct * duration;

      if (isTranscoded) {
        console.log('[PLAYER] Seeking in transcoded stream to:', targetTime);
        transcodeOffsetRef.current = Math.floor(targetTime);
        const newSrc = `/api/transcode/${infoHash}?audioTrack=${selectedAudioTrack}&t=${Math.floor(targetTime)}`;
        setTranscodeSrc(newSrc);
        videoRef.current.src = newSrc;
        videoRef.current.load();
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.currentTime = targetTime;
      }
    }
  };

  const toggleFullscreen = () => {
    const el = document.getElementById('sf-player-main');
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    
    // Não esconder se algum menu estiver aberto
    if (showEpisodes || showSubtitles || showAudioMenu) return;
    
    controlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  // Efeito para carregar progresso inicial e iniciar automaticamente
  useEffect(() => {
    if (profile && !hasLoadedProgress) {
      getProgress(profile.id, tmdbId, mediaType, season, episode).then(({ data }) => {
        const pos = data?.position_seconds || 0;
        setSavedPosition(pos);
        savedPositionRef.current = pos;
        setHasLoadedProgress(true);
        
        if (pos > 10) {
          console.log('[PLAYER] Retomando progresso automaticamente:', pos);
          initialSeekRef.current = pos;
          if (isTranscoded) {
            console.log('[PLAYER] Reiniciando transcode na posição salva:', pos);
            transcodeOffsetRef.current = pos;
            const newSrc = `/api/transcode/${infoHash}?audioTrack=${selectedAudioTrack}&t=${pos}`;
            setTranscodeSrc(newSrc);
            if (videoRef.current) {
              videoRef.current.src = newSrc;
              videoRef.current.load();
            }
          } else {
            if (videoRef.current) {
              videoRef.current.currentTime = pos;
            }
          }
        }
        
        if (videoRef.current) {
          videoRef.current.play().catch(console.warn);
        }
      });
    }
  }, [profile, tmdbId, mediaType, season, episode, hasLoadedProgress, isTranscoded, infoHash, selectedAudioTrack]);

  // Efeito para resetar o timeout quando menus abrem/fecham
  useEffect(() => {
    if (showEpisodes || showSubtitles || showAudioMenu) {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      setShowControls(true);
    } else {
      handleMouseMove();
    }
  }, [showEpisodes, showSubtitles, showAudioMenu]);

  return (
    <div 
      id="sf-player-main"
      className={`sf-player-container ${showControls ? 'controls-active' : ''}`}
      onMouseMove={handleMouseMove}
      style={{ 
        '--sub-size': subConfig.size,
        '--sub-color': subConfig.color,
        '--sub-bg': subConfig.bg,
        '--sub-font': subConfig.font
      } as React.CSSProperties}
      suppressHydrationWarning
    >

      {videoError && (
        <div className="sf-loading-overlay" style={{ background: 'rgba(0,0,0,0.9)', zIndex: 30 }}>
          <button 
            className="sf-back-button" 
            onClick={onBack}
            style={{ position: 'absolute', top: '20px', left: '40px', zIndex: 10 }}
          >
            <ArrowLeft size={24} />
          </button>
          <div style={{ textAlign: 'center', color: '#fff' }}>
            <div style={{ color: '#e50914', marginBottom: '20px' }}>
              <Info size={48} />
            </div>
            <h2 style={{ marginBottom: '10px' }}>Erro ao reproduzir o vídeo</h2>
            <p style={{ color: '#aaa', maxWidth: '400px', margin: '0 auto' }}>
              {videoError}
            </p>
            <button 
              onClick={onBack}
              style={{
                marginTop: '25px',
                padding: '10px 24px',
                background: '#e50914',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Voltar e Tentar Outro
            </button>
          </div>
        </div>
      )}

      {!videoError && (
        <div className={`sf-loading-overlay ${isLoading ? '' : 'sf-hidden'}`}>
          <button 
            className="sf-back-button" 
            onClick={onBack}
            style={{ position: 'absolute', top: '20px', left: '40px', zIndex: 10 }}
          >
            <ArrowLeft size={24} />
          </button>
          {posterUrl && (
            <div 
              className="sf-loading-backdrop" 
              style={{ backgroundImage: `url(${posterUrl})` }}
            />
          )}
          <div className="sf-loading-content">
            <div className="sf-loading-logo sf-pulse-logo">
              <span style={{ color: '#e50914' }}>Stream</span>
              <span style={{ color: '#ffffff' }}>Flix</span>
            </div>
          </div>
          {isP2P ? (
            <div className="sf-loading-stats-badge">
              <div className="sf-dot"></div>
              <Wifi size={12} /> <span>{status.speed}</span>
              <span style={{ opacity: 0.3, margin: '0 6px' }}>|</span>
              <Users size={12} /> <span>{status.peers}</span>
            </div>
          ) : (
            <div className="sf-loading-stats-badge" style={{ background: 'rgba(229, 9, 20, 0.25)', border: '1px solid rgba(229, 9, 20, 0.4)' }}>
              <div className="sf-dot" style={{ backgroundColor: '#e50914' }}></div>
              <Wifi size={12} style={{ color: '#e50914' }} /> <span style={{ color: '#fff', fontWeight: 'bold' }}>{status.speed}</span>
            </div>
          )}
        </div>
      )}

      <video 
        ref={videoRef}
        key={isTranscoded ? transcodeSrc : src}
        className="sf-video-element"
        src={isTranscoded && transcodeSrc ? transcodeSrc : src}
        onTimeUpdate={handleTimeUpdate}
        autoPlay
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onLoadStart={() => setIsLoading(true)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => {
          setIsLoading(false);
          setIsPlaying(true);
        }}
        onCanPlay={() => setIsLoading(false)}
        onCanPlayThrough={() => setIsLoading(false)}
        onSeeking={() => setIsLoading(true)}
        onSeeked={() => setIsLoading(false)}
        onLoadedData={() => setIsLoading(false)}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
            if (initialSeekRef.current !== null) {
              if (isTranscoded) {
                console.log('[PLAYER] Transcode já iniciado na posição salva, currentTime mantido em 0');
              } else {
                console.log('[PLAYER] Retomando para a posição salva:', initialSeekRef.current);
                videoRef.current.currentTime = initialSeekRef.current;
              }
              initialSeekRef.current = null;
            }
            videoRef.current.play().catch(console.warn);
          }
        }}
        onError={(e) => {
          const video = e.target as HTMLVideoElement;
          const errorMsg = video.error ? 
            `O formato deste vídeo não é suportado pelo navegador ou a fonte falhou (Erro ${video.error.code}).` : 
            'Erro desconhecido ao carregar o vídeo.';
          setVideoError(errorMsg);
          setIsLoading(false);
          console.error('[Video Error]', video.error);
        }}
        playsInline
        crossOrigin="anonymous"
        onClick={(e) => {
          if (showEpisodes || showSubtitles || showAudioMenu) {
            setShowEpisodes(false);
            setShowSubtitles(false);
            setShowAudioMenu(false);
          } else {
            togglePlay();
          }
        }}
        onDoubleClick={toggleFullscreen}
        style={{ cursor: showControls ? 'pointer' : 'none' }}
      >
        {subtitles?.map((sub, i) => (
          <track 
            key={`${infoHash}-${i}-${subDelay}`}
            src={`/api/subtitles?url=${encodeURIComponent(sub.url)}`} 
            kind="subtitles" 
            srcLang={sub.lang}
            label={sub.label} 
            default={i === activeSubtitle} 
          />
        ))}
        {/* Legendas como overlay CSS — não depende de CORS do <track> */}
        {currentSubText && activeSubtitle !== null && (
          <div
            style={{
              position: 'absolute',
              bottom: subConfig.bottom || '130px',
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              zIndex: 20,
              pointerEvents: 'none',
              maxWidth: '85%',
            }}
          >
            <span style={{
              display: 'inline-block',
              background: subConfig.bg,
              color: subConfig.color,
              fontFamily: subConfig.font,
              fontSize: subConfig.size,
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: '4px',
              lineHeight: 1.5,
              whiteSpace: 'pre-line',
              textShadow: '0 1px 3px rgba(0,0,0,0.9)',
            }}>
              {currentSubText}
            </span>
          </div>
        )}
      </video>

      <div 
        className="sf-controls-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowEpisodes(false);
            setShowSubtitles(false);
            setShowAudioMenu(false);
          }
        }}
      >
        <div className="sf-top-bar">
          <button className="sf-back-button" onClick={onBack}>
            <ArrowLeft size={24} />
          </button>
          <div className="sf-title-info">
            <h2>{title}</h2>
            {season && <p>Temporada {season} • Episódio {episode}</p>}
          </div>
        </div>

        {!isPlaying && !isLoading && (
          <div className="sf-center-play" onClick={togglePlay}>
            <Play size={40} fill="white" />
          </div>
        )}

        <div className="sf-bottom-bar">
          <div className="sf-seek-container" onClick={handleSeek}>
            <div className="sf-seek-progress" style={{ width: `${progress}%` }}>
              <div className="sf-seek-handle"></div>
            </div>
          </div>

          <div className="sf-main-controls">
            <div className="sf-controls-left">
              <button className="sf-control-btn" onClick={togglePlay}>
                {isPlaying ? <Pause size={28} fill="white" /> : <Play size={28} fill="white" />}
              </button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button className="sf-control-btn" onClick={() => setIsMuted(!isMuted)}>
                  {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                </button>
                <input 
                  type="range" 
                  min="0" max="1" step="0.1" 
                  value={volume} 
                  onChange={handleVolumeChange}
                  style={{ width: '80px', accentColor: '#e50914' }}
                />
              </div>

              {isP2P ? (
                <div className="sf-stats-badge">
                  <div className="sf-dot"></div>
                  <Wifi size={14} />
                  <span>{status.speed}</span>
                  <span style={{ opacity: 0.5 }}>|</span>
                  <Users size={14} />
                  <span>{status.peers}</span>
                </div>
              ) : (
                <div className="sf-stats-badge" style={{ background: 'rgba(229, 9, 20, 0.25)', border: '1px solid rgba(229, 9, 20, 0.4)' }}>
                  <div className="sf-dot" style={{ backgroundColor: '#e50914' }}></div>
                  <Wifi size={14} style={{ color: '#e50914' }} />
                  <span style={{ color: '#fff', fontWeight: 'bold' }}>{status.speed}</span>
                </div>
              )}
            </div>

            <div className="sf-controls-right">
              {/* Seletor de Faixa de Áudio */}
              {audioTracks.length > 1 && (
                <div style={{ position: 'relative' }}>
                  <button
                    className="sf-control-btn"
                    title="Faixa de Áudio"
                    onClick={(e) => { e.stopPropagation(); setShowAudioMenu(m => !m); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Volume2 size={22} />
                    <span style={{ fontSize: 11, fontWeight: 700, background: '#e50914', borderRadius: 4, padding: '1px 5px' }}>
                      {audioTracks[selectedAudioTrack]?.language?.toUpperCase() || 'A'}
                    </span>
                  </button>
                  {showAudioMenu && (
                    <div className="sf-subs-menu sf-modern-panel" style={{ bottom: 50, right: 0, minWidth: 160 }} onClick={e => e.stopPropagation()}>
                      <div className="sf-panel-header" style={{ padding: '10px 14px 8px', fontSize: 12, color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 }}>
                        Faixa de Áudio
                      </div>
                      <div className="sf-panel-content">
                        <div className="sf-subs-list">
                          {audioTracks.map((track, i) => (
                            <div
                              key={i}
                              className={`sf-sub-option ${selectedAudioTrack === i ? 'active' : ''}`}
                              onClick={() => switchAudioTrack(i)}
                            >
                              <span style={{ fontWeight: 600 }}>
                                {track.language === 'por' || track.language === 'pt' || track.language === 'pb' ? '🇧🇷 Português' :
                                 track.language === 'eng' || track.language === 'en' ? '🇺🇸 Inglês' :
                                 track.language === 'spa' || track.language === 'es' ? '🇪🇸 Espanhol' :
                                 track.language === 'und' ? `Faixa ${i + 1}` : track.language.toUpperCase()}
                              </span>
                              <span style={{ fontSize: 10, color: '#888', marginLeft: 6 }}>
                                {track.codec?.toUpperCase()} {track.channels > 0 ? `${track.channels}ch` : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {episodes && episodes.length > 0 && (

                <button className="sf-control-btn" onClick={() => setShowEpisodes(!showEpisodes)}>
                  <Settings size={24} />
                </button>
              )}
              
              <div style={{ position: 'relative' }}>
                <button 
                  className={`sf-control-btn ${activeSubtitle !== null ? 'active' : ''}`} 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSubtitles(!showSubtitles);
                  }}
                >
                  <Subtitles size={24} />
                </button>
                
                {showSubtitles && (
                  <div className="sf-subs-menu sf-modern-panel">
                    <div className="sf-panel-header">
                      <button 
                        className={subTab === 'lang' ? 'active' : ''} 
                        onClick={(e) => { e.stopPropagation(); setSubTab('lang'); }}
                      >
                        Idiomas
                      </button>
                      <button 
                        className={subTab === 'settings' ? 'active' : ''} 
                        onClick={(e) => { e.stopPropagation(); setSubTab('settings'); }}
                      >
                        Aparência
                      </button>
                    </div>

                    <div className="sf-panel-content">
                      {subTab === 'lang' && (
                        <div className="sf-subs-list">
                          {(!subtitles || subtitles.length === 0) ? (
                            <div className="sf-sub-option disabled" style={{ opacity: 0.5, cursor: 'default' }}>
                              Nenhuma legenda encontrada
                            </div>
                          ) : (
                            <>
                              <div 
                                className={`sf-sub-option ${activeSubtitle === null ? 'active' : ''}`}
                                onClick={() => {
                                  setActiveSubtitle(null);
                                  setShowSubtitles(false);
                                }}
                              >
                                Desativar
                              </div>
                              {subtitles.map((sub, i) => (
                                <div 
                                  key={i}
                                  className={`sf-sub-option ${activeSubtitle === i ? 'active' : ''}`}
                                  onClick={() => {
                                    setActiveSubtitle(i);
                                    setShowSubtitles(false);
                                  }}
                                >
                                  {sub.label}
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      )}

                      {subTab === 'settings' && (
                        <div className="sf-subs-settings">
                          <div className="sf-setting-group">
                            <label>Tamanho</label>
                            <div className="sf-setting-options">
                              <button className={subConfig.size === '1rem' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setSubConfig({...subConfig, size: '1rem'}) }}>P</button>
                              <button className={subConfig.size === '1.2rem' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setSubConfig({...subConfig, size: '1.2rem'}) }}>M</button>
                              <button className={subConfig.size === '1.5rem' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setSubConfig({...subConfig, size: '1.5rem'}) }}>G</button>
                              <button className={subConfig.size === '2rem' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setSubConfig({...subConfig, size: '2rem'}) }}>GG</button>
                            </div>
                          </div>

                          <div className="sf-setting-group">
                            <label>Cor do Texto</label>
                            <div className="sf-setting-colors">
                              <button style={{ background: '#ffffff' }} className={subConfig.color === '#ffffff' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setSubConfig({...subConfig, color: '#ffffff'}) }}></button>
                              <button style={{ background: '#f5c518' }} className={subConfig.color === '#f5c518' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setSubConfig({...subConfig, color: '#f5c518'}) }}></button>
                              <button style={{ background: '#e50914' }} className={subConfig.color === '#e50914' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setSubConfig({...subConfig, color: '#e50914'}) }}></button>
                              <button style={{ background: '#4ade80' }} className={subConfig.color === '#4ade80' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setSubConfig({...subConfig, color: '#4ade80'}) }}></button>
                              <button style={{ background: '#60a5fa' }} className={subConfig.color === '#60a5fa' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setSubConfig({...subConfig, color: '#60a5fa'}) }}></button>
                            </div>
                          </div>

                          <div className="sf-setting-group">
                            <label>Fundo</label>
                            <div className="sf-setting-options">
                              <button className={subConfig.bg === 'transparent' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setSubConfig({...subConfig, bg: 'transparent'}) }}>Nenhum</button>
                              <button className={subConfig.bg === 'rgba(0,0,0,0.5)' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setSubConfig({...subConfig, bg: 'rgba(0,0,0,0.5)'}) }}>Suave</button>
                              <button className={subConfig.bg === 'rgba(0,0,0,0.75)' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setSubConfig({...subConfig, bg: 'rgba(0,0,0,0.75)'}) }}>Escuro</button>
                            </div>
                          </div>

                          <div className="sf-setting-group">
                            <label>Fonte</label>
                            <div className="sf-setting-options">
                              <button style={{ fontFamily: '"Inter", sans-serif' }} className={subConfig.font.includes('Inter') ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setSubConfig({...subConfig, font: '"Inter", sans-serif'}) }}>Inter</button>
                              <button style={{ fontFamily: 'Georgia, serif' }} className={subConfig.font.includes('Georgia') ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setSubConfig({...subConfig, font: 'Georgia, serif'}) }}>Serif</button>
                              <button style={{ fontFamily: 'Courier New, monospace' }} className={subConfig.font.includes('Courier') ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setSubConfig({...subConfig, font: 'Courier New, monospace'}) }}>Mono</button>
                            </div>
                          </div>

                          <div className="sf-setting-group">
                            <label>Altura</label>
                            <div className="sf-setting-options">
                              <button className={subConfig.bottom === '80px' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setSubConfig({...subConfig, bottom: '80px'}) }}>Baixa</button>
                              <button className={subConfig.bottom === '130px' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setSubConfig({...subConfig, bottom: '130px'}) }}>Média</button>
                              <button className={subConfig.bottom === '180px' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setSubConfig({...subConfig, bottom: '180px'}) }}>Alta</button>
                              <button className={subConfig.bottom === '230px' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setSubConfig({...subConfig, bottom: '230px'}) }}>M. Alta</button>
                            </div>
                          </div>

                          <div className="sf-subs-divider" style={{ margin: '15px 0 10px 0' }}></div>
                          <div className="sf-subs-sync">
                            <span className="sf-sync-label">Sincronia</span>
                            <div className="sf-sync-controls">
                              <button onClick={(e) => { e.stopPropagation(); setSubDelay(d => d - 0.5); }}>-0.5s</button>
                              <span className="sf-sync-value">{subDelay > 0 ? '+' : ''}{subDelay}s</span>
                              <button onClick={(e) => { e.stopPropagation(); setSubDelay(d => d + 0.5); }}>+0.5s</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button className="sf-control-btn" onClick={toggleFullscreen}>
                <Maximize size={24} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showEpisodes && episodes && (
        <div className="sf-episodes-sidebar">
          <div className="sf-sidebar-header">
            <h3>Episódios</h3>
            <button onClick={() => setShowEpisodes(false)}>×</button>
          </div>
          <div className="sf-episodes-list">
            {episodes.map((ep) => (
              <div 
                key={ep.id} 
                className={`sf-episode-item ${episode === ep.episode_number ? 'active' : ''}`}
                onClick={() => {
                  onEpisodeChange?.(ep.episode_number);
                  setShowEpisodes(false);
                  setIsLoading(true);
                }}
              >
                <span className="sf-ep-num">{ep.episode_number}</span>
                <span className="sf-ep-title">{ep.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;