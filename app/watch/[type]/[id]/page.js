'use client';
import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Play, ChevronLeft, Signal, Monitor, HardDrive, Info, Users } from 'lucide-react';
import VideoPlayer from '@/components/VideoPlayer/VideoPlayer';
import { useAuth } from '@/contexts/AuthContext';

export default function WatchPage({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const { type, id } = params; 
  const { profile } = useAuth();

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
        let foundImdbId = data.imdb_id || null;
        try {
          const extRes = await fetch(`${process.env.NEXT_PUBLIC_TMDB_BASE_URL}/${type}/${id}/external_ids?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`);
          const extData = await extRes.json();
          if (extData.imdb_id) {
            foundImdbId = extData.imdb_id;
          }
        } catch (extErr) {
          console.warn("Erro ao buscar external_ids, tentando usar id do filme se houver:", extErr);
        }

        if (foundImdbId) {
          console.log(`ID Traduzido: ${id} -> ${foundImdbId}`);
          setImdbId(foundImdbId);
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

      // URL do Torrentio dinâmica baseada nas preferências do usuário ou default
      const DEFAULT_TORRENTIO_MANIFEST = "https://torrentio.strem.fun/providers=yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,torrent9,horriblesubs,nyaasi,megel33,tokyotosho,sukebei|language=portuguese,english/manifest.json";
      let manifestUrl = profile?.video_preferences?.addon;
      
      // Validação crítica: Garante que o addon seja uma URL válida, caso contrário usa o fallback padrão
      if (!manifestUrl || typeof manifestUrl !== "string" || !manifestUrl.trim().toLowerCase().startsWith("http")) {
        manifestUrl = process.env.NEXT_PUBLIC_TORRENTIO_MANIFEST_URL || DEFAULT_TORRENTIO_MANIFEST;
      }
      
      // Normalização da URL do addon para pegar o endpoint de stream
      let streamBaseUrl = manifestUrl;
      if (streamBaseUrl.endsWith('/manifest.json')) {
        streamBaseUrl = streamBaseUrl.replace('/manifest.json', '/stream/');
      } else if (!streamBaseUrl.endsWith('/stream/')) {
        if (streamBaseUrl.endsWith('/')) {
          streamBaseUrl += 'stream/';
        } else {
          streamBaseUrl += '/stream/';
        }
      }
      if (!streamBaseUrl.endsWith('/')) {
        streamBaseUrl += '/';
      }

      let url = `${streamBaseUrl}${type === 'movie' ? `movie/${imdbId}.json` : `series/${imdbId}:${season}:${episode}.json`}`;
      console.log("Buscando fontes via addon Stremio:", url);

      try {
        const res = await fetch(url);
        const data = await res.json();
        const streams = data.streams || [];
        setTorrents(streams);
        
        // Buscar peers de cada torrent em background (apenas se for P2P/torrent normal que tenha infoHash)
        const peersPromises = streams.slice(0, 10).map(async (torrent) => {
          if (!torrent.infoHash) return { hash: 'direct', peers: 0, status: 'ready' };
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
        peersResults.forEach(p => { 
          if (p.hash !== 'direct') peersMap[p.hash] = p.peers; 
        });
        setTorrentPeers(peersMap);
      } catch (err) {
        console.error("Erro ao buscar torrents:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTorrents();
  }, [imdbId, type, season, episode, profile]);

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

  // LÓGICA DE PARSE INTELIGENTE DE TORRENTS/STREAMS STREMIO
  const parseTorrent = (t) => {
    const title = (t.title || '').toLowerCase();
    const name = (t.name || '').toLowerCase();
    const combined = `${title}\n${name}`;
    
    // Extração de tamanho
    const sizeMatch = title.match(/💾\s*([\d\.]+\s*[GMB]+)/i) || combined.match(/([\d\.]+\s*gb|[\d\.]+\s*mb)/i);
    const size = sizeMatch ? sizeMatch[1] : '---';

    // Extração de seeders e leechers das informações retornadas pelo Torrentio
    // Formatos comuns: 👤 X 👥 Y ou 👤 X ou Seeders: X / Leechers: Y
    const seedersMatch = title.match(/👤\s*(\d+)/) || combined.match(/seeders:\s*(\d+)/i);
    const leechersMatch = title.match(/👥\s*(\d+)/) || combined.match(/leechers:\s*(\d+)/i);
    const seeders = seedersMatch ? parseInt(seedersMatch[1]) : 0;
    const leechers = leechersMatch ? parseInt(leechersMatch[1]) : 0;

    const info = {
      size,
      seeders,
      leechers,
      resolution: 'SD',
      audio: 'Legendado',
      codec: '',
      language: 'PT-BR',
      is4K: combined.includes('4k') || combined.includes('2160p') || combined.includes('uhd'),
      is1080p: combined.includes('1080p') || combined.includes('fhd'),
      is720p: combined.includes('720p') || combined.includes('hd'),
      isSD: !combined.includes('1080p') && !combined.includes('720p') && !combined.includes('4k') && !combined.includes('2160p'),
      isDual: combined.includes('dual') || combined.includes('multi') || combined.includes('dublado') || combined.includes('dual-audio') || combined.includes('multi-audio'),
      isPT: combined.includes('portugues') || combined.includes('pt-br') || combined.includes('ptbr') || combined.includes('dublado') || combined.includes('dub') || combined.includes('pob') || combined.includes('brazilian') || combined.includes('pt-pt'),
      isBR: combined.includes(' br ') || combined.includes('brazilian') || combined.includes('[br]'),
      isENG: combined.includes('english') || combined.includes('eng') || combined.includes('sub') || combined.includes('en-us'),
      isES: combined.includes('espanol') || combined.includes('spanish') || combined.includes('latino'),
      isHEVC: combined.includes('hevc') || combined.includes('x265') || combined.includes('10bit'),
    };

    // Resolução amigável e pontuação
    if (info.is4K) {
      info.resolution = '4K';
      info.qualityScore = 40;
    } else if (info.is1080p) {
      info.resolution = '1080p';
      info.qualityScore = 30;
    } else if (info.is720p) {
      info.resolution = '720p';
      info.qualityScore = 20;
    } else {
      info.resolution = '480p';
      info.qualityScore = 5;
    }

    // Classificação de áudio e idiomas
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

  // FILTRO: Só mostrar 720p ou superior (alta qualidade) por padrão
  const qualityTorrents = torrents.filter(t => {
    const info = parseTorrent(t);
    return info.qualityScore >= 20; // 720p ou melhor
  });

  // Se não houver nenhum link de alta qualidade, mostramos todos os links como fallback para não deixar a tela vazia
  const displayedTorrents = qualityTorrents.length > 0 ? qualityTorrents : torrents;
  const isUsingFallback = qualityTorrents.length === 0 && torrents.length > 0;

  // UI DE SELEÇÃO DE FONTES (INTELIGENTE)
  if (!selectedTorrent) {
    return (
      <div style={{ minHeight: '100vh', background: '#050505', color: '#fff', padding: '60px 20px', fontFamily: 'Inter, sans-serif' }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', border: 'none', padding: '10px 20px', borderRadius: '30px', color: '#fff', cursor: 'pointer', marginBottom: '40px', transition: '0.3s' }}>
          <ChevronLeft size={20} /> Voltar
        </button>

        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <header className="page-header" style={{ marginBottom: '50px' }}>
            <div className="title-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
              <span className="quality-badge" style={{ background: isUsingFallback ? '#fbbf24' : '#00d1b2', color: '#000', padding: '4px 12px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase' }}>
                {isUsingFallback ? 'Qualidade Padrão' : 'Alta Qualidade'}
              </span>
              <h1 className="page-title" style={{ fontWeight: 900, margin: 0 }}>{movieData?.title || movieData?.name}</h1>
            </div>
            <p style={{ color: '#888', fontSize: '1.1rem', maxWidth: '700px' }}>
              {isUsingFallback 
                ? 'Nenhum link em HD/4K foi encontrado. Exibindo todos os links disponíveis.'
                : `Encontrados ${displayedTorrents.length} links de alta qualidade para assistir.`
              }
            </p>
          </header>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginTop: '100px' }}>
              <div className="loader" style={{ width: '60px', height: '60px', border: '4px solid rgba(255,255,255,0.05)', borderTopColor: '#e50914', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: '1.1rem', fontWeight: 500, color: '#e50914' }}>Analisando enxame de torrents...</p>
            </div>
          ) : displayedTorrents.length > 0 ? (
            <div style={{ display: 'grid', gap: '15px' }}>
              {displayedTorrents
                .sort((a, b) => {
                  const infoA = parseTorrent(a);
                  const infoB = parseTorrent(b);
                  
                  // Mescla os seeders reais com o torrentPeers local se disponível
                  const seedersA = torrentPeers[a.infoHash] || infoA.seeders;
                  const seedersB = torrentPeers[b.infoHash] || infoB.seeders;

                  // 1. Pontuação de Velocidade baseada nos Seeders (Fator Principal: mais rápidos)
                  const speedScoreA = (seedersA * 2) + (
                    seedersA >= 100 ? 600 :
                    seedersA >= 50 ? 400 :
                    seedersA >= 20 ? 200 :
                    seedersA >= 5 ? 50 : 0
                  );
                  const speedScoreB = (seedersB * 2) + (
                    seedersB >= 100 ? 600 :
                    seedersB >= 50 ? 400 :
                    seedersB >= 20 ? 200 :
                    seedersB >= 5 ? 50 : 0
                  );

                  // 2. Pontuação de Resolução/Qualidade
                  const qualityScoreA = (infoA.is4K ? 300 : 0) + (infoA.is1080p ? 150 : 0) + (infoA.is720p ? 50 : 0);
                  const qualityScoreB = (infoB.is4K ? 300 : 0) + (infoB.is1080p ? 150 : 0) + (infoB.is720p ? 50 : 0);

                  // 3. Preferência de Idioma do Usuário (Dublado / Legendado)
                  const userPrefDub = profile?.video_preferences?.isDub;
                  let langScoreA = 0;
                  let langScoreB = 0;

                  if (userPrefDub === true) {
                    langScoreA = infoA.isPT ? 250 : 0;
                    langScoreB = infoB.isPT ? 250 : 0;
                  } else if (userPrefDub === false) {
                    langScoreA = infoA.isENG ? 250 : 0;
                    langScoreB = infoB.isENG ? 250 : 0;
                  } else {
                    // Sem preferência explícita, prioriza Dublado (PT) por padrão no mercado brasileiro
                    langScoreA = infoA.isPT ? 150 : 0;
                    langScoreB = infoB.isPT ? 150 : 0;
                  }

                  const scoreA = speedScoreA + qualityScoreA + langScoreA;
                  const scoreB = speedScoreB + qualityScoreB + langScoreB;

                  return scoreB - scoreA;
                })
                .map((t, i) => {
                  const info = parseTorrent(t);
                  
                  // Mescla os seeders do Torrentio com os atualizados localmente se houver
                  const activeSeeders = torrentPeers[t.infoHash] || info.seeders;

                  return (
                    <div 
                      key={i}
                      className="torrent-card"
                      onClick={() => setSelectedTorrent(t)}
                      style={{ 
                        background: 'rgba(255,255,255,0.02)', 
                        border: '1px solid rgba(255,255,255,0.05)',
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
                      <div className="torrent-card-left" style={{ display: 'flex', flex: 1 }}>
                        <div style={{ 
                          background: info.is4K ? 'linear-gradient(45deg, #e50914, #ff4d4d)' : '#1a1a1a', 
                          width: '60px', height: '60px', borderRadius: '14px', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: info.is4K ? '0 10px 20px rgba(229, 9, 20, 0.3)' : 'none'
                        }}>
                          <Play fill="#fff" size={24} />
                        </div>
                        
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                            <h3 className="torrent-title" style={{ fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatTitle(t.title)}</h3>
                            {info.isHEVC && <span style={{ background: '#9333ea', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 900 }}>HEVC</span>}
                            {info.isDual && <span style={{ background: '#f59e0b', color: '#000', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 900 }}>DUAL</span>}
                          </div>
                          
                          <div className="torrent-badges" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
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
                              <HardDrive size={12} /> {info.size}
                            </span>
                            {activeSeeders > 0 && (
                              <span style={{ 
                                background: activeSeeders > 50 ? 'linear-gradient(45deg, #10b981, #34d399)' : 
                                           activeSeeders > 10 ? 'linear-gradient(45deg, #f59e0b, #fbbf24)' : 
                                           'linear-gradient(45deg, #6b7280, #9ca3af)', 
                                color: '#fff',
                                padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                                display: 'flex', alignItems: 'center', gap: '4px'
                              }}>
                                <Users size={10} /> {activeSeeders}
                              </span>
                            )}
                            <span className="torrent-filename" style={{ color: '#6b7280', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>• {t.name}</span>
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
              <p style={{ fontSize: '1.2rem' }}>Nenhuma fonte disponível para este conteúdo.</p>
            </div>
          )}
        </div>
        <style jsx>{` 
          @keyframes spin { to { transform: rotate(360deg); } } 
          .play-btn-circle:hover { background: #e50914; border-color: #e50914; }
          
          /* Desktop Defaults */
          .page-title { font-size: 3rem; }
          .torrent-card { padding: 25px; }
          .torrent-card-left { align-items: center; gap: 25px; }
          .torrent-title { font-size: 1.2rem; }
          .play-btn-circle { flex-shrink: 0; }

          /* Mobile Responsive */
          @media (max-width: 768px) {
            .page-header { margin-bottom: 30px !important; }
            .title-wrapper { flex-direction: column; align-items: flex-start !important; }
            .page-title { font-size: 2rem; line-height: 1.1; }
            
            .torrent-card { padding: 15px; }
            .torrent-card-left { gap: 15px; }
            .torrent-title { font-size: 1rem; white-space: normal !important; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
            
            .play-btn-circle { width: 35px !important; height: 35px !important; }
            
            .torrent-filename { display: none !important; } /* Hide filename on mobile */
          }
        `}</style>
      </div>
    );
  }

  // PLAYER RENDERIZADO APÓS SELEÇÃO
  // Se o stream possuir uma URL direta (ex: Real-Debrid / links directos), tocamos diretamente
  // Caso contrário, passamos pela rota de proxy local de streaming WebTorrent
  const streamSource = selectedTorrent.url || `/api/stream/${selectedTorrent.infoHash}`;

  return (
    <main style={{ backgroundColor: '#000', width: '100vw', height: '100vh' }} suppressHydrationWarning>
      <VideoPlayer 
        src={streamSource}
        title={movieData?.title || movieData?.name}
        posterUrl={movieData?.backdrop_path ? `https://image.tmdb.org/t/p/original${movieData.backdrop_path}` : null}
        infoHash={selectedTorrent.infoHash || ''}
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
