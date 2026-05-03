'use client';
import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Play, ChevronLeft, Signal, Monitor, HardDrive, Info, Users } from 'lucide-react';
import VideoPlayer from '@/components/VideoPlayer/VideoPlayer';

export default function WatchPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const { type, id } = params; 

  const [movieData, setMovieData] = useState(null);
  const [imdbId, setImdbId] = useState(null);
  const [torrents, setTorrents] = useState([]);
  const [selectedTorrent, setSelectedTorrent] = useState(null);
  const [torrentPeers, setTorrentPeers] = useState({});
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [episodes, setEpisodes] = useState([]);
  const [subtitles, setSubtitles] = useState([]);

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_TMDB_BASE_URL}/${type}/${id}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&append_to_response=videos`);
        const data = await res.json();
        setMovieData(data);
        if (type === 'tv') fetchEpisodes(1);
        
        // Ponte TMDB -> IMDB
        const extRes = await fetch(`${process.env.NEXT_PUBLIC_TMDB_BASE_URL}/${type}/${id}/external_ids?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`);
        const extData = await extRes.json();
        if (extData.imdb_id) {
          console.log(`ID Traduzido: ${id} -> ${extData.imdb_id}`);
          setImdbId(extData.imdb_id);
        }
      } catch (err) {
        console.error("Erro ao buscar metadados:", err);
      }
    };
    fetchMeta();
  }, [type, id]);

  const fetchEpisodes = async (s) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_TMDB_BASE_URL}/tv/${id}/season/${s}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`);
      const data = await res.json();
      setEpisodes(data.episodes || []);
    } catch (err) {
      console.error("Erro ao buscar episódios:", err);
    }
  };

  useEffect(() => {
    const fetchTorrents = async () => {
      if (!imdbId) return;
      setLoading(true);

      // URL do Torrentio configurada para priorizar Português e Inglês
      let url = `https://torrentio.strem.fun/providers=yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,torrent9,horriblesubs,nyaasi,megel33,tokyotosho,sukebei|language=portuguese,english/stream/`;
      url += type === 'movie' ? `movie/${imdbId}.json` : `series/${imdbId}:${season}:${episode}.json`;

      try {
        const res = await fetch(url);
        const data = await res.json();
        const streams = data.streams || [];
        setTorrents(streams);
        
        // Buscar peers de cada torrent em background
        const peersPromises = streams.slice(0, 10).map(async (torrent) => {
          try {
            const peerRes = await fetch(`/api/status/${torrent.infoHash}`, { 
              cache: 'no-store',
              signal: AbortSignal.timeout(5000)
            });
            if (peerRes.ok) {
              const peerData = await peerRes.json();
              return { hash: torrent.infoHash, peers: peerData.peers || 0, status: peerData.status };
            }
          } catch (e) {}
          return { hash: torrent.infoHash, peers: 0, status: 'unknown' };
        });
        
        const peersResults = await Promise.all(peersPromises);
        const peersMap = {};
        peersResults.forEach(p => { peersMap[p.hash] = p.peers; });
        setTorrentPeers(peersMap);
      } catch (err) {
        console.error("Erro ao buscar torrents:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTorrents();
  }, [imdbId, type, season, episode]);

  useEffect(() => {
    const fetchSubtitles = async () => {
      if (!imdbId) return;

      const mediaType = type === 'tv' ? 'series' : type;
      const idStr = type === 'movie' ? `${imdbId}` : `${imdbId}:${season}:${episode}`;
      
      const STREAMING_URL = process.env.NEXT_PUBLIC_STREAMING_URL || 'http://159.112.189.135:4000';
      const proxyUrl = `/api/subtitles/search?type=${mediaType}&id=${idStr}`;

      try {
        console.log(`Buscando legendas via proxy: ${proxyUrl}`);
        const res = await fetch(proxyUrl);
        
        if (!res.ok) {
          const text = await res.text();
          console.error(`Erro no Proxy (${res.status}):`, text.substring(0, 100));
          setSubtitles([]);
          return;
        }

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await res.text();
          console.error("O servidor não retornou JSON. Resposta:", text.substring(0, 100));
          setSubtitles([]);
          return;
        }

        const data = await res.json();
        const subs = data.subtitles || [];
        console.log(`Legendas brutas encontradas (${subs.length}):`, subs);
        
        if (subs.length > 0) {
          const formattedSubs = subs.map(s => {
            const l = (s.lang || '').toLowerCase();
            const isPt = l.includes('por') || l.includes('pob') || l.includes('pt');
            const isEng = l.includes('eng') || l.includes('en');
            
            return {
              url: s.url,
              lang: isPt ? 'pt' : (isEng ? 'en' : l.substring(0, 3)),
              label: isPt ? 'Português' : (isEng ? 'Inglês' : s.lang || 'Outro')
            };
          });
            
          if (formattedSubs.length > 0) {
            // Sort to put Portuguese first
            formattedSubs.sort((a, b) => {
              if (a.lang === 'pt' && b.lang !== 'pt') return -1;
              if (a.lang !== 'pt' && b.lang === 'pt') return 1;
              return 0;
            });
            setSubtitles(formattedSubs);
            return;
          }
        }
      } catch (err) {
        console.error(`Erro ao buscar legendas via proxy:`, err);
      }
      
      setSubtitles([]);
    };
    fetchSubtitles();
  }, [imdbId, type, season, episode]);

  const formatTitle = (title) => {
    if (!title) return "";
    return title.split('\n')[0].replace(/\./g, ' ').replace(/\[.*?\]/g, '').trim();
  };

  // LÓGICA DE PARSE INTELIGENTE
  const parseTorrent = (t) => {
    const title = t.title.toLowerCase();
    const info = {
      resolution: 'SD',
      audio: 'Legendado',
      codec: '',
      language: 'PT-BR',
      is4K: title.includes('4k') || title.includes('2160p'),
      is1080p: title.includes('1080p'),
      is720p: title.includes('720p'),
      isSD: title.includes('480p') || title.includes('360p') || !title.includes('1080p') && !title.includes('720p'),
      isDual: title.includes('dual') || title.includes('multi') || title.includes('dublado') || title.includes('dual-audio'),
      isPT: title.includes('portugues') || title.includes('pt-br') || title.includes('ptbr') || title.includes('dublado') || title.includes('dub') || title.includes('pob'),
      isBR: title.includes(' br ') || title.includes('brazilian') || title.includes('[br]'),
      isENG: title.includes('english') || title.includes('eng') || title.includes('sub'),
      isES: title.includes('espanol') || title.includes('spanish') || title.includes('latino'),
      isHEVC: title.includes('hevc') || title.includes('x265') || title.includes('10bit'),
      // Prioridade: 4K > 1080p > 720p > SD
      qualityScore: (title.includes('4k') || title.includes('2160p')) ? 40 : 
                     title.includes('1080p') ? 30 : 
                     title.includes('720p') ? 20 : 5
    };

    if (info.is4K) info.resolution = '4K';
    else if (info.is1080p) info.resolution = '1080p';
    else if (info.is720p) info.resolution = '720p';
    else if (info.isSD) info.resolution = '480p';

    if (info.isDual) {
      info.audio = 'Dual Áudio';
      info.language = 'PT-BR + EN';
    } else if (info.isPT || info.isBR) {
      info.audio = 'Dublado';
      info.language = 'PT-BR';
    } else if (info.isENG) {
      info.audio = 'Legendado';
      info.language = 'EN';
    } else if (info.isES) {
      info.audio = 'Legendado';
      info.language = 'ES';
    } else {
      info.audio = 'Legendado';
      info.language = 'Internacional';
    }

    if (info.isHEVC) info.codec = 'HEVC';

    return info;
  };

  // FILTRO: Só mostrar 720p ou superior (alta qualidade)
  const qualityTorrents = torrents.filter(t => {
    const info = parseTorrent(t);
    return info.qualityScore >= 20; // 720p ou melhor
  });

  // UI DE SELEÇÃO DE FONTES (INTELIGENTE)
  if (!selectedTorrent) {
    return (
      <div style={{ minHeight: '100vh', background: '#050505', color: '#fff', padding: '60px 20px', fontFamily: 'Inter, sans-serif' }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', border: 'none', padding: '10px 20px', borderRadius: '30px', color: '#fff', cursor: 'pointer', marginBottom: '40px', transition: '0.3s' }}>
          <ChevronLeft size={20} /> Voltar
        </button>

        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <header style={{ marginBottom: '50px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
              <span style={{ background: '#00d1b2', color: '#000', padding: '4px 12px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase' }}>Alta Qualidade</span>
              <h1 style={{ fontSize: '3rem', fontWeight: 900, margin: 0 }}>{movieData?.title || movieData?.name}</h1>
            </div>
            <p style={{ color: '#888', fontSize: '1.1rem', maxWidth: '700px' }}>
              Encontrados {qualityTorrents.length} links em alta qualidade (720p ou superior). Verificando velocidade...
            </p>
          </header>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginTop: '100px' }}>
              <div className="loader" style={{ width: '60px', height: '60px', border: '4px solid rgba(255,255,255,0.05)', borderTopColor: '#e50914', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: '1.1rem', fontWeight: 500, color: '#e50914' }}>Analisando enxame de torrents...</p>
            </div>
          ) : qualityTorrents.length > 0 ? (
            <div style={{ display: 'grid', gap: '15px' }}>
              {qualityTorrents
                .sort((a, b) => {
                  const infoA = parseTorrent(a);
                  const infoB = parseTorrent(b);
                  // Pontuação: 4K (100) + Dublado (50) + 1080p (20)
                  const scoreA = (infoA.is4K ? 100 : 0) + (infoA.isPT ? 50 : 0) + (infoA.is1080p ? 20 : 0);
                  const scoreB = (infoB.is4K ? 100 : 0) + (infoB.isPT ? 50 : 0) + (infoB.is1080p ? 20 : 0);
                  return scoreB - scoreA;
                })
                .map((t, i) => {
                  const info = parseTorrent(t);
                return (
                  <div 
                    key={i}
                    onClick={() => setSelectedTorrent(t)}
                    style={{ 
                      background: 'rgba(255,255,255,0.02)', 
                      border: '1px solid rgba(255,255,255,0.05)',
                      padding: '25px',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      e.currentTarget.style.borderColor = '#e50914';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '25px', flex: 1 }}>
                      <div style={{ 
                        background: info.is4K ? 'linear-gradient(45deg, #e50914, #ff4d4d)' : '#1a1a1a', 
                        width: '60px', height: '60px', borderRadius: '14px', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: info.is4K ? '0 10px 20px rgba(229, 9, 20, 0.3)' : 'none'
                      }}>
                        <Play fill="#fff" size={24} />
                      </div>
                      
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>{formatTitle(t.title)}</h3>
                          {info.isHEVC && <span style={{ background: '#9333ea', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 900 }}>HEVC</span>}
                          {info.isDual && <span style={{ background: '#f59e0b', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 900 }}>DUAL</span>}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <span style={{ 
                            background: info.is4K ? 'linear-gradient(45deg, #e50914, #ff4d4d)' : '#1a1a1a', 
                            color: '#fff',
                            padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 800,
                            boxShadow: info.is4K ? '0 4px 12px rgba(229, 9, 20, 0.4)' : 'none'
                          }}>
                            {info.resolution}
                          </span>
                          <span style={{ 
                            background: info.language.includes('PT') ? 'linear-gradient(45deg, #00d1b2, #10b981)' : '#374151', 
                            color: '#fff',
                            padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 
                          }}>
                            {info.language}
                          </span>
                          <span style={{ 
                            background: 'rgba(59, 130, 246, 0.2)', 
                            color: '#60a5fa',
                            padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 
                          }}>
                            {info.audio}
                          </span>
                          <span style={{ color: '#6b7280', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <HardDrive size={12} /> {t.title.match(/💾 ([\d\.]+ [GMB]+)/)?.[1] || '---'}
                          </span>
                          {torrentPeers[t.infoHash] > 0 && (
                            <span style={{ 
                              background: torrentPeers[t.infoHash] > 10 ? 'linear-gradient(45deg, #10b981, #34d399)' : 
                                         torrentPeers[t.infoHash] > 5 ? 'linear-gradient(45deg, #f59e0b, #fbbf24)' : 
                                         'linear-gradient(45deg, #6b7280, #9ca3af)', 
                              color: '#fff',
                              padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                              display: 'flex', alignItems: 'center', gap: '4px'
                            }}>
                              <Users size={10} /> {torrentPeers[t.infoHash]}
                            </span>
                          )}
                          <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>• {t.name}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="play-btn-circle" style={{ 
                      width: '45px', height: '45px', borderRadius: '50%', 
                      border: '2px solid rgba(255,255,255,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: '0.3s'
                    }}>
                      <ChevronLeft style={{ transform: 'rotate(180deg)' }} size={20} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginTop: '100px', color: '#888' }}>
              <Info size={64} style={{ marginBottom: '20px', opacity: 0.2 }} />
              <p style={{ fontSize: '1.2rem' }}>Nenhuma fonte em alta qualidade (720p+) disponível para este conteúdo.</p>
            </div>
          )}
        </div>
        <style jsx>{` 
          @keyframes spin { to { transform: rotate(360deg); } } 
          .play-btn-circle:hover { background: #e50914; border-color: #e50914; }
        `}</style>
      </div>
    );
  }

  // PLAYER RENDERIZADO APÓS SELEÇÃO
  const API = process.env.NEXT_PUBLIC_STREAMING_URL || 'http://147.15.92.17:80';

  return (
    <main style={{ backgroundColor: '#000', width: '100vw', height: '100vh' }} suppressHydrationWarning>
      <VideoPlayer 
        src={`/api/stream/${selectedTorrent.infoHash}`}
        title={movieData?.title || movieData?.name}
        posterUrl={movieData?.backdrop_path ? `https://image.tmdb.org/t/p/original${movieData.backdrop_path}` : null}
        infoHash={selectedTorrent.infoHash}
        tmdbId={parseInt(id)}
        mediaType={type}
        season={season}
        episode={episode}
        episodes={episodes}
        subtitles={subtitles}
        onEpisodeChange={(epNum) => {
          const url = `/watch/${type}/${id}?s=${season}&e=${epNum}`;
          router.push(url);
        }}
        onBack={() => setSelectedTorrent(null)}
      />
    </main>
  );
}
