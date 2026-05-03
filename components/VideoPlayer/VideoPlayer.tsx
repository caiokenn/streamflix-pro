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
  const [resumePrompt, setResumePrompt] = useState<{show: boolean, time: number} | null>(null);
  const [subDelay, setSubDelay] = useState(0);
  const [subTab, setSubTab] = useState<'lang' | 'settings'>('lang');
  const [subConfig, setSubConfig] = useState({
    size: '1.2rem',
    color: '#ffffff',
    bg: 'rgba(0,0,0,0.75)',
    font: '"Inter", sans-serif'
  });
  const [status, setStatus] = useState({ peers: 0, speed: '0 KB/s', status: 'Iniciando P2P...' });
  const [hasLoadedProgress, setHasLoadedProgress] = useState(false);
  const [savedPosition, setSavedPosition] = useState(0);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTime = useRef<number>(0);
  
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

  // Monitoramento do servidor em tempo real
  useEffect(() => {
    if (!infoHash) return;
    
    let interval: NodeJS.Timeout;
    
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/status/${infoHash}`, { 
          cache: 'no-store'
        });
        
        if (res.ok) {
          const data = await res.json();
          const hasPeers = data.peers > 0;
          const isLowProgress = parseFloat(data.progress) < 5;
          
          setStatus({
            peers: data.peers || 0,
            speed: formatSpeed(data.speed),
            status: hasPeers ? `Baixando... ${data.progress}%` : 'Buscando Seeds...'
          });
          
          // Spinner se não houver peers ou progresso for muito baixo
          if (!hasPeers || isLowProgress) {
            setIsLoading(true);
          } else {
            setIsLoading(false);
          }
        }
      } catch (e: any) {
        console.log('Status check error:', e.message);
      }
    };
    
    // Primeiro check imediato
    checkStatus();
    
    // Depois a cada 5 segundos
    interval = setInterval(checkStatus, 5000);
    
    return () => clearInterval(interval);
  }, [infoHash]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => {
      setIsLoading(false);
      setIsPlaying(true);
    };
    
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
    };
  }, []);

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
      const currentTime = video.currentTime;
      setProgress((currentTime / duration) * 100);

      // Salvar a cada 10 segundos
      if (profile && Math.abs(currentTime - lastSaveTime.current) > 10) {
        lastSaveTime.current = currentTime;
        saveProgress(profile.id, tmdbId, mediaType, {
          position_seconds: Math.floor(currentTime),
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
      videoRef.current.currentTime = pct * duration;
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
    if (showEpisodes || showSubtitles) return;
    
    controlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  // Efeito para carregar progresso inicial
  useEffect(() => {
    if (profile && !hasLoadedProgress) {
      getProgress(profile.id, tmdbId, mediaType, season, episode).then(({ data }) => {
        const pos = data?.position_seconds || 0;
        setSavedPosition(pos);
        setHasLoadedProgress(true);
        
        if (pos > 10) {
          console.log('[PLAYER] Progresso encontrado:', pos);
          setResumePrompt({ show: true, time: pos });
        } else {
          if (videoRef.current && videoRef.current.readyState >= 1) {
            videoRef.current.play().catch(console.warn);
          }
        }
      });
    }
  }, [profile, tmdbId, mediaType, season, episode, hasLoadedProgress]);

  // Efeito para resetar o timeout quando menus abrem/fecham
  useEffect(() => {
    if (showEpisodes || showSubtitles) {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      setShowControls(true);
    } else {
      handleMouseMove();
    }
  }, [showEpisodes, showSubtitles]);

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
      {resumePrompt?.show && (
        <div className="sf-resume-prompt-overlay" style={{
          position: 'absolute', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.85)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <h2 style={{ color: 'white', marginBottom: '10px', fontSize: '1.8rem' }}>Continuar assistindo?</h2>
          <p style={{ color: '#aaa', marginBottom: '30px', fontSize: '1.1rem' }}>
            Você parou em {formatTime(resumePrompt.time)}
          </p>
          <div style={{ display: 'flex', gap: '15px' }}>
            <button onClick={() => {
              if (videoRef.current) {
                videoRef.current.currentTime = resumePrompt.time;
                videoRef.current.play();
              }
              setResumePrompt(null);
            }} style={{ padding: '12px 24px', background: '#e50914', color: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', border: 'none' }}>
              Retomar
            </button>
            <button onClick={() => {
              if (videoRef.current) {
                videoRef.current.currentTime = 0;
                videoRef.current.play();
              }
              setResumePrompt(null);
            }} style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', border: 'none' }}>
              Começar do Início
            </button>
          </div>
        </div>
      )}

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

      {isLoading && !videoError && (
        <div className="sf-loading-overlay">
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
          <div className="sf-loading-stats-badge">
            <div className="sf-dot"></div>
            <Wifi size={12} /> <span>{status.speed}</span>
            <span style={{ opacity: 0.3, margin: '0 6px' }}>|</span>
            <Users size={12} /> <span>{status.peers}</span>
          </div>
        </div>
      )}

      <video 
        ref={videoRef}
        key={infoHash}
        className="sf-video-element"
        src={`/api/stream/${infoHash}`}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
            // Se já carregamos o progresso e não há resume prompt (ou seja, posição <= 10), tocamos.
            if (hasLoadedProgress && savedPosition <= 10) {
              videoRef.current.play().catch(console.warn);
            }
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
      </video>

      <div className="sf-controls-overlay">
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

              <div className="sf-stats-badge">
                <div className="sf-dot"></div>
                <Wifi size={14} />
                <span>{status.speed}</span>
                <span style={{ opacity: 0.5 }}>|</span>
                <Users size={14} />
                <span>{status.peers}</span>
              </div>
            </div>

            <div className="sf-controls-right">
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