'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useProgress } from '@/contexts/ProgressContext';
import { getMovieDetails, getTVDetails, getPosterUrl } from '@/lib/tmdb';
import { Play, Info, X, History } from 'lucide-react';
import styles from './ContinueWatching.module.css';

export default function ContinueWatching() {
  const { user, profile, loading: authLoading } = useAuth();
  const { progressMap, loading: progressLoading } = useProgress();
  const [items, setItems] = useState([]);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  useEffect(() => {
    if (authLoading || progressLoading || !user || !profile?.id) return;

    let cancelled = false;

    async function loadDetails() {
      setFetchingDetails(true);
      try {
        // Filtra apenas itens com status 'watching' e ordena por data
        const watchingItems = Object.values(progressMap)
          .filter(item => item.status === 'watching')
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
          .slice(0, 10);

        if (cancelled || watchingItems.length === 0) {
          if (!cancelled) setItems([]);
          return;
        }

        // Deduplicar por tmdb_id (garantir que não apareça o mesmo filme duas vezes)
        const uniqueMap = new Map();
        watchingItems.forEach(item => {
          if (!uniqueMap.has(item.tmdb_id)) uniqueMap.set(item.tmdb_id, item);
        });

        const resolved = await Promise.all(
          Array.from(uniqueMap.values()).map(async (item) => {
            // Se já temos os metadados no banco, não precisamos chamar o TMDB
            if (item.title && item.poster_path) {
              return item;
            }

            try {
              const details = item.media_type === 'movie'
                ? await getMovieDetails(item.tmdb_id)
                : await getTVDetails(item.tmdb_id);
              
              return {
                ...item,
                title: item.title || details?.title || details?.name || 'Título desconhecido',
                poster_path: item.poster_path || details?.poster_path,
              };
            } catch (err) {
              console.error(`Erro ao carregar detalhes para ${item.tmdb_id}:`, err);
              return item;
            }
          })
        );

        if (!cancelled) {
          setItems(resolved);
        }
      } catch (err) {
        console.error('ContinueWatching error:', err);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setFetchingDetails(false);
      }
    }

    loadDetails();
    return () => { cancelled = true; };
  }, [authLoading, progressLoading, user, profile?.id, progressMap]);

  // Não mostra nada se: ainda carregando, sem usuário, ou sem itens
  if (authLoading || progressLoading || !user || (!fetchingDetails && items.length === 0)) return null;

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <span className={styles.accentLine} />
          <History size={20} color="#e50914" />
          <span>Continue Assistindo</span>
        </h2>
      </div>
      <div className={styles.row}>
        {fetchingDetails
          ? Array.from({ length: 5 }).map((_, i) => <div key={i} className={`${styles.skeletonCard} skeleton`} />)
          : items.map(item => (
              <ContinueCard
                key={`${item.media_type}_${item.tmdb_id}`}
                item={item}
                onRemove={() => setItems(prev => prev.filter(i => i.id !== item.id))}
              />
            ))
        }
      </div>
    </section>
  );
}

function ContinueCard({ item, onRemove }) {
  const watchHref = item.media_type === 'movie'
    ? `/watch/movie/${item.tmdb_id}`
    : `/watch/tv/${item.tmdb_id}?s=${item.season_number || 1}&e=${item.episode_number || 1}`;
  const detailHref = item.media_type === 'movie' ? `/movie/${item.tmdb_id}` : `/tv/${item.tmdb_id}`;
  const progress = item.duration_seconds > 0
    ? Math.min(100, (item.position_seconds / item.duration_seconds) * 100)
    : 0;
  const remaining = item.duration_seconds
    ? Math.round((item.duration_seconds - item.position_seconds) / 60)
    : null;
  
  // Usamos backdrop se disponível, senão poster
  const image = getPosterUrl(item.backdrop_path || item.poster_path, 'w500');

  return (
    <div className={styles.card}>
      <Link href={watchHref} className={styles.cardInner}>
        <div className={styles.thumb}>
          <img src={image} alt={item.title || 'Conteúdo'} />
          <div className={styles.playOverlay}>
            <div className={styles.playIcon}>
              <Play fill="currentColor" size={24} />
            </div>
          </div>
          
          <div className={styles.progressContainer}>
            <div className={styles.progressLabel}>
              {item.season_number ? `T${item.season_number} • E${item.episode_number}` : 'Filme'}
              <span>{Math.round(progress)}%</span>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
        <div className={styles.cardInfo}>
          <p className={styles.cardTitle}>{item.title}</p>
          {remaining && <p className={styles.remaining}>{remaining} min restantes</p>}
        </div>
      </Link>
      
      <div className={styles.floatingActions}>
        <Link href={detailHref} className={styles.floatingBtn} title="Detalhes">
          <Info size={14} />
        </Link>
        <button className={styles.floatingBtn} onClick={onRemove} title="Remover">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
