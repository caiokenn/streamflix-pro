'use client';
import { useState, useEffect, useRef, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAlternativeVideoSources, getTVDetails, getMovieDetails, getTitle, getTVSeasonDetails, getPosterUrl } from '@/lib/tmdb';
import { useAuth } from '@/contexts/AuthContext';
import { useProgress } from '@/contexts/ProgressContext';
import { LayoutList, Clock, X, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import BackButton from '@/components/BackButton/BackButton';
import styles from './page.module.css';

function WatchContent({ type, id }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const { updateProgress } = useProgress();

  const season = parseInt(searchParams.get('s') || '1');
  const episode = parseInt(searchParams.get('e') || '1');

  const [content, setContent] = useState(null);
  const [currentSource, setCurrentSource] = useState(0);
  const [sources, setSources] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [savedTime, setSavedTime] = useState(0);
  const activeTimeRef = useRef(0);
  const iframeRef = useRef(null);
  const progressTimer = useRef(null);

  const isTV = type === 'tv';

  // 1. Carregar Detalhes e Progresso Salvo
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await (isTV ? getTVDetails(id) : getMovieDetails(id));
        setContent(data);

        if (profile) {
          try {
            const progressRes = await import('@/lib/supabase').then(m => 
              m.getProgress(profile.id, id, type, isTV ? season : null, isTV ? episode : null)
            );
            if (progressRes.data) {
              setSavedTime(progressRes.data.position_seconds);
              activeTimeRef.current = progressRes.data.position_seconds;
            }
          } catch (pErr) {
            console.error('Erro ao buscar progresso:', pErr);
          }
        }

        if (isTV && data.seasons) {
          const validSeasons = data.seasons.filter(s => s.season_number > 0);
          setSeasons(validSeasons);
          
          // Fetch actual episodes for the current season
          try {
            const seasonData = await getTVSeasonDetails(id, season);
            if (seasonData && seasonData.episodes) {
              setEpisodes(seasonData.episodes);
            }
          } catch (sErr) {
            console.error('Erro ao buscar episódios da temporada:', sErr);
            // Fallback to simple list if fetch fails
            const currentSeason = validSeasons.find(s => s.season_number === season);
            if (currentSeason) {
              const eps = Array.from({ length: currentSeason.episode_count }, (_, i) => ({
                episode_number: i + 1,
                name: `Episódio ${i + 1}`,
              }));
              setEpisodes(eps);
            }
          }
        }

        const srcs = getAlternativeVideoSources(type, id, isTV ? season : null, isTV ? episode : null);
        setSources(srcs);
      } catch (err) {
        console.error('Erro ao carregar conteúdo:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, type, season, episode, isTV, profile]);

  // 2. Rastrear Tempo Ativo e Salvar no Contexto Global
  useEffect(() => {
    if (!user || !profile || !content) return;

    const duration = content.runtime ? content.runtime * 60 : (isTV ? 2400 : 0);

    const saveCurrentProgress = async () => {
      if (!content) return;
      const isCompleted = activeTimeRef.current >= duration * 0.9;
      const title = content.title || content.name;
      
      await updateProgress(parseInt(id), type, {
        position_seconds: activeTimeRef.current,
        duration_seconds: duration,
        season_number: isTV ? season : null,
        episode_number: isTV ? episode : null,
        status: isCompleted ? 'completed' : 'watching',
        title: title,
        poster_path: content.poster_path
      });
    };

    const ticker = setInterval(() => {
      if (document.visibilityState === 'visible') {
        activeTimeRef.current += 1;
      }
    }, 1000);

    progressTimer.current = setInterval(saveCurrentProgress, 15000);

    const handleBeforeUnload = () => {
      saveCurrentProgress();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(ticker);
      clearInterval(progressTimer.current);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      saveCurrentProgress();
    };
  }, [user, profile, content, id, type, season, episode, isTV, updateProgress]);

  function navigateEpisode(s, e) {
    router.push(`/watch/${type}/${id}?s=${s}&e=${e}`);
  }

  const title = content ? getTitle(content) : 'Carregando...';
  const embedUrl = sources[currentSource]?.url || '';

  return (
    <div className={styles.watchPage}>
      <div className={styles.playerHeader}>
        <div className={styles.headerTop}>
          <BackButton />

          <div className={styles.sourceSelector}>
            <div className={styles.serversLabel}>
              <span>Servers</span>
              <div className={styles.menuIcon}>
                <div className={styles.bar} />
                <div className={styles.bar} />
                <div className={styles.bar} />
              </div>
            </div>
            <div className={styles.sourceButtons}>
              {sources.map((src, i) => (
                <button
                  key={i}
                  className={`${styles.sourceBtn} ${i === currentSource ? styles.sourceBtnActive : ''}`}
                  onClick={() => setCurrentSource(i)}
                >
                  <Play size={14} fill="currentColor" />
                  <span>{src.name}</span>
                </button>
              ))}
            </div>
          </div>

          {isTV && (
            <button className={`${styles.episodesToggle} ${sidebarOpen ? styles.active : ''}`} onClick={() => setSidebarOpen(!sidebarOpen)}>
              <LayoutList size={18} />
              <span>Episódios</span>
            </button>
          )}
        </div>
      </div>

      <div className={`${styles.playerArea} ${sidebarOpen ? styles.withSidebar : ''}`}>
        <div className={styles.playerWrapper}>
          {loading ? (
            <div className={styles.playerLoading}>
              <div className={styles.loadingSpinner} />
              <p>Carregando player...</p>
            </div>
          ) : (
            <>
              <iframe
                ref={iframeRef}
                src={embedUrl}
                className={styles.player}
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="origin"
                title={title}
              />
              
              {savedTime > 60 && (
                <div className={styles.resumeOverlay}>
                  <div className={styles.resumeToast}>
                    <div className={styles.resumeIcon}>
                      <Clock size={20} />
                    </div>
                    <div className={styles.resumeInfo}>
                      <p>Você parou em <strong>{Math.floor(savedTime / 60)}:{(savedTime % 60).toString().padStart(2, '0')}</strong></p>
                      <span>Avance o player manualmente para retomar de onde parou.</span>
                    </div>
                    <button className={styles.resumeClose} onClick={() => setSavedTime(0)}>
                      <X size={18} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {isTV && sidebarOpen && (
          <div className={styles.episodesSidebar}>
            <div className={styles.sidebarHeader}>
              <h3>Episódios</h3>
              <select
                className={styles.seasonSelect}
                value={season}
                onChange={e => navigateEpisode(parseInt(e.target.value), 1)}
              >
                {seasons.map(s => (
                  <option key={s.id} value={s.season_number}>Temporada {s.season_number}</option>
                ))}
              </select>
            </div>
            <div className={styles.episodesList}>
              {episodes.map(ep => (
                <button
                  key={ep.episode_number}
                  className={`${styles.episodeItem} ${ep.episode_number === episode ? styles.episodeActive : ''}`}
                  onClick={() => { navigateEpisode(season, ep.episode_number); setSidebarOpen(false); }}
                >
                  <div className={styles.epThumbWrapper}>
                    <img 
                      src={ep.still_path ? getPosterUrl(ep.still_path, 'w300') : '/placeholder-backdrop.jpg'} 
                      alt={ep.name} 
                      className={styles.epThumb}
                    />
                    {ep.episode_number === episode && (
                      <div className={styles.epPlayingOverlay}>
                        <Play size={20} fill="#fff" />
                      </div>
                    )}
                  </div>
                  <div className={styles.epInfo}>
                    <span className={styles.epNum}>Episódio {ep.episode_number}</span>
                    <span className={styles.epTitle}>{ep.name || `Episódio ${ep.episode_number}`}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {content && (
        <div className={styles.belowPlayer}>
          <div className={styles.belowContainer}>
            <div className={styles.contentInfo}>
              <h2 className={styles.contentTitle}>{title}</h2>
              {isTV && <p className={styles.episodeInfo}>Temporada {season} • Episódio {episode}</p>}
              {content.overview && <p className={styles.contentOverview}>{content.overview}</p>}
            </div>
            {isTV && (
              <div className={styles.epNav}>
                {episode > 1 && (
                  <button className="btn btn-secondary" onClick={() => navigateEpisode(season, episode - 1)}>
                    <ChevronLeft size={16} />
                    <span>Anterior</span>
                  </button>
                )}
                <button className="btn btn-primary" onClick={() => navigateEpisode(season, episode + 1)}>
                  <span>Próximo</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function WatchPage({ params }) {
  const { type, id } = use(params);
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'var(--text-muted)' }}>
        <div style={{ width: 48, height: 48, border: '3px solid #222', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p>Carregando player...</p>
      </div>
    }>
      <WatchContent type={type} id={id} />
    </Suspense>
  );
}
