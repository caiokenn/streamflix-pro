'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useProgress } from '@/contexts/ProgressContext';
import { createClient } from '@/lib/supabase/client';
import { getPosterUrl, getMovieDetails, getTVDetails } from '@/lib/tmdb';
import ContentCard from '@/components/ContentCard/ContentCard';
import { useToast } from '@/components/Toast/Toast';
import { Bookmark, History as HistoryIcon, LayoutGrid, List as ListIcon, Trash2, X, Clapperboard, Tv } from 'lucide-react';
import styles from './page.module.css';

import { Suspense } from 'react';

export default function WatchlistPage() {
  return (
    <Suspense fallback={null}>
      <WatchlistContent />
    </Suspense>
  );
}

function WatchlistContent() {
  const { user, profile, loading: authLoading } = useAuth();
  const { progressMap, loading: progressLoading, removeProgress } = useProgress();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  
  const initialTab = searchParams.get('tab') === 'history' ? 'history' : 'watchlist';
  const [activeTab, setActiveTab] = useState(initialTab); 
  
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'history') setActiveTab('history');
    else setActiveTab('watchlist');
  }, [searchParams]);

  const [watchlistItems, setWatchlistItems] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const tabsRef = useRef({});

  // Efeito para o indicador dos tabs
  useEffect(() => {
    const activeEl = tabsRef.current[activeTab];
    if (activeEl) {
      setIndicatorStyle({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth
      });
    }
  }, [activeTab]);

  // Carregar Watchlist
  useEffect(() => {
    if (authLoading || !profile?.id) return;

    async function loadWatchlist() {
      if (activeTab !== 'watchlist') return;
      setFetching(true);
      const supabase = createClient();
      try {
        const { data, error } = await supabase
          .from('watchlist')
          .select('*')
          .eq('profile_id', profile.id)
          .order('added_at', { ascending: false });

        if (error) throw error;

        const resolved = await Promise.all(
          (data || []).map(async (item) => {
            try {
              const details = item.media_type === 'movie'
                ? await getMovieDetails(item.tmdb_id)
                : await getTVDetails(item.tmdb_id);
              return {
                ...item,
                title: details?.title || details?.name || 'Sem título',
                poster_path: details?.poster_path,
                vote_average: details?.vote_average || 0,
                release_year: (details?.release_date || details?.first_air_date)?.split('-')[0] || '',
                overview: details?.overview || '',
                is_anime: item.media_type === 'tv' && details?.origin_country?.includes('JP') && details?.genres?.some(g => g.id === 16),
              };
            } catch {
              return { ...item, title: 'Conteúdo indisponível' };
            }
          })
        );
        setWatchlistItems(resolved);
      } catch (err) {
        console.error('Watchlist error:', err);
      } finally {
        setFetching(false);
      }
    }

    loadWatchlist();
  }, [authLoading, profile?.id, activeTab]);

  // Carregar Histórico
  useEffect(() => {
    if (authLoading || progressLoading || !profile?.id) return;

    async function loadHistory() {
      if (activeTab !== 'history') return;
      setFetching(true);
      try {
        const historyData = Object.values(progressMap)
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

        const resolved = await Promise.all(
          historyData.slice(0, 60).map(async (item) => {
            // Garantir que temos ID e media_type
            const id = item.tmdb_id || item.id;
            // Se media_type não existir, tentamos inferir ou usamos do item
            const type = item.media_type || (item.season_number ? 'tv' : 'movie');

            if (!id) return null;

            try {
              // Se já temos o básico, mas falta id, complementamos
              let baseItem = { ...item, id, media_type: type };
              
              // Se não temos poster ou título, buscamos no TMDB
              if (!baseItem.title || !baseItem.poster_path) {
                const details = type === 'movie'
                  ? await getMovieDetails(id)
                  : await getTVDetails(id);
                // Mesclamos priorizando os detalhes do TMDB para metadados, 
                // mas mantendo o progresso e info de episódio do baseItem
                return { ...baseItem, ...details, id }; 
              }
              
              return baseItem;
            } catch (err) {
              console.error(`Erro ao carregar detalhes para ${type} ${id}:`, err);
              return { ...item, id };
            }
          })
        );
        
        // Filtrar itens que falharam miseravelmente
        setHistoryItems(resolved.filter(i => i && i.id));
      } catch (err) {
        console.error('History error:', err);
      } finally {
        setFetching(false);
      }
    }

    loadHistory();
  }, [authLoading, progressLoading, profile?.id, activeTab, progressMap]);

  async function handleRemoveFromWatchlist(tmdbId, mediaType, itemTitle) {
    const supabase = createClient();
    await supabase
      .from('watchlist')
      .delete()
      .eq('profile_id', profile.id)
      .eq('tmdb_id', tmdbId)
      .eq('media_type', mediaType);
    setWatchlistItems(prev => prev.filter(i => !(i.tmdb_id === tmdbId && i.media_type === mediaType)));
    toast?.addToast(`"${itemTitle}" removido da lista`, 'info');
  }

  const filteredWatchlist = filter === 'all' 
    ? watchlistItems 
    : filter === 'anime' 
      ? watchlistItems.filter(i => i.is_anime)
      : watchlistItems.filter(i => i.media_type === filter && !i.is_anime);

  if (authLoading || (fetching && (activeTab === 'watchlist' ? watchlistItems.length === 0 : historyItems.length === 0))) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.grid}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`${styles.skeleton} skeleton`} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/');
    return null;
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        
        {/* Sistema de Abas Elegante */}
        <div className={styles.tabsContainer}>
          <div className={styles.tabs}>
            <div 
              className={styles.tabIndicator} 
              style={{ 
                transform: `translateX(${indicatorStyle.left}px)`, 
                width: `${indicatorStyle.width}px` 
              }} 
            />
            <button 
              ref={el => tabsRef.current['watchlist'] = el}
              className={`${styles.tab} ${activeTab === 'watchlist' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('watchlist')}
            >
              Minha Lista
            </button>
            <button 
              ref={el => tabsRef.current['history'] = el}
              className={`${styles.tab} ${activeTab === 'history' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('history')}
            >
              Histórico
            </button>
          </div>
        </div>

        {activeTab === 'watchlist' ? (
          <>
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <h1 className={styles.title}>
                  Salvos para ver depois
                  <span className={styles.subtitle}>({watchlistItems.length})</span>
                </h1>
              </div>
              <div className={styles.headerActions}>
                <div className={styles.viewToggle}>
                  <button
                    className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`}
                    onClick={() => setViewMode('grid')}
                  >
                    <LayoutGrid size={18} />
                  </button>
                  <button
                    className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`}
                    onClick={() => setViewMode('list')}
                  >
                    <ListIcon size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.filters}>
              {[
                { key: 'all', label: 'Todos', icon: <LayoutGrid size={14} />, count: watchlistItems.length },
                { key: 'movie', label: 'Filmes', icon: <Clapperboard size={14} />, count: watchlistItems.filter(i => i.media_type === 'movie').length },
                { key: 'tv', label: 'Séries', icon: <Tv size={14} />, count: watchlistItems.filter(i => i.media_type === 'tv' && !i.is_anime).length },
                { key: 'anime', label: 'Animes', icon: <span style={{fontSize: 14}}>⛩️</span>, count: watchlistItems.filter(i => i.is_anime).length },
              ].map(f => (
                <button
                  key={f.key}
                  className={`${styles.filterBtn} ${filter === f.key ? styles.filterActive : ''}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.icon}
                  {f.label}
                  {f.count > 0 && <span className={styles.filterCount}>{f.count}</span>}
                </button>
              ))}
            </div>

            {filteredWatchlist.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>📂</span>
                <h2>{filter === 'all' ? 'Sua lista está vazia' : 'Nada aqui ainda'}</h2>
                <p>Comece a explorar e salve seus favoritos para assistir depois.</p>
                <button className="btn btn-primary" onClick={() => router.push('/')}>
                  Explorar Catálogo
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className={styles.grid}>
                {filteredWatchlist.map(item => (
                  <WatchlistCard 
                    key={`${item.tmdb_id}-${item.media_type}`} 
                    item={item} 
                    onRemove={handleRemoveFromWatchlist} 
                  />
                ))}
              </div>
            ) : (
              <div className={styles.listView}>
                {filteredWatchlist.map(item => (
                  <WatchlistListItem 
                    key={`${item.tmdb_id}-${item.media_type}`} 
                    item={item} 
                    onRemove={handleRemoveFromWatchlist} 
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <h1 className={styles.title}>
                  Vistos recentemente
                  <span className={styles.subtitle}>({historyItems.length})</span>
                </h1>
              </div>
            </div>

            {historyItems.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>🎬</span>
                <h2>Sem histórico ainda</h2>
                <p>O que você assistir aparecerá aqui automaticamente.</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {historyItems.map((item) => (
                  <div key={`${item.media_type}_${item.tmdb_id}`} className={styles.historyCardWrapper}>
                    <button 
                      className={styles.historyRemoveBtn} 
                      onClick={() => {
                        removeProgress(item.media_type, item.tmdb_id);
                        setHistoryItems(prev => prev.filter(i => !(i.tmdb_id === item.tmdb_id && i.media_type === item.media_type)));
                      }}
                      title="Remover do histórico"
                    >
                      <X size={16} />
                    </button>
                    <ContentCard item={item} />
                    <p className={styles.lastWatched}>
                      <HistoryIcon size={12} /> {new Date(item.updated_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function WatchlistCard({ item, onRemove }) {
  const router = useRouter();
  const poster = getPosterUrl(item.poster_path, 'w342');
  const href = item.media_type === 'movie' ? `/movie/${item.tmdb_id}` : `/tv/${item.tmdb_id}`;
  const watchHref = `/watch/${item.media_type}/${item.tmdb_id}`;

  return (
    <div className={styles.wlCard}>
      <div className={styles.wlPoster} onClick={() => router.push(href)}>
        <img src={poster} alt={item.title || 'Poster'} />
        <div className={styles.wlOverlay}>
          <div className={styles.wlPlayBtn} onClick={e => { e.stopPropagation(); router.push(watchHref); }}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        {item.vote_average > 0 && <div className={styles.wlRating}>⭐ {item.vote_average?.toFixed(1)}</div>}
        <div className={styles.wlType}>{item.media_type === 'movie' ? 'Filme' : item.is_anime ? 'Anime' : 'Série'}</div>
      </div>
      <div className={styles.wlInfo}>
        <p className={styles.wlTitle} onClick={() => router.push(href)}>{item.title}</p>
        <p className={styles.wlYear}>{item.release_year}</p>
      </div>
      <button className={styles.wlRemoveBtn} onClick={() => onRemove(item.tmdb_id, item.media_type, item.title)} title="Remover">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function WatchlistListItem({ item, onRemove }) {
  const router = useRouter();
  const poster = getPosterUrl(item.poster_path, 'w92');
  const href = item.media_type === 'movie' ? `/movie/${item.tmdb_id}` : `/tv/${item.tmdb_id}`;
  const watchHref = `/watch/${item.media_type}/${item.tmdb_id}`;
  const date = item.added_at ? new Date(item.added_at).toLocaleDateString('pt-BR') : '';

  return (
    <div className={styles.listItem}>
      <div className={styles.listPoster} onClick={() => router.push(href)}>
        <img src={poster} alt={item.title || 'Poster'} />
      </div>
      <div className={styles.listInfo} onClick={() => router.push(href)}>
        <p className={styles.listTitle}>{item.title}</p>
        <div className={styles.listMeta}>
          <span className={`badge ${item.media_type === 'movie' ? 'badge-red' : 'badge-blue'}`}>
            {item.media_type === 'movie' ? 'Filme' : item.is_anime ? 'Anime' : 'Série'}
          </span>
          {item.vote_average > 0 && <span className="rating">⭐ {item.vote_average?.toFixed(1)}</span>}
          {item.release_year && <span className={styles.wlYear}>{item.release_year}</span>}
        </div>
        {item.overview && <p className={styles.listOverview}>{item.overview}</p>}
        {date && <p className={styles.listDate}>Salvo em {date}</p>}
      </div>
      <div className={styles.listActions}>
        <button className="btn btn-primary" onClick={() => router.push(watchHref)}>
          Assistir
        </button>
        <button className={styles.listRemoveBtn} onClick={() => onRemove(item.tmdb_id, item.media_type, item.title)} title="Remover">
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
