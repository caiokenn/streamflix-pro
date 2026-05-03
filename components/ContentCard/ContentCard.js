'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPosterUrl, getTitle, getReleaseYear, getMediaType, getMovieDetails, getTVDetails } from '@/lib/tmdb';
import { useAuth } from '@/contexts/AuthContext';
import { useProgress } from '@/contexts/ProgressContext';
import { addToWatchlist, removeFromWatchlist, isInWatchlist } from '@/lib/supabase';
import { useToast } from '@/components/Toast/Toast';
import { Play, Plus, Check, Info, Star, Clapperboard, Tv, CheckCircle2 } from 'lucide-react';
import { useRef } from 'react';
import styles from './ContentCard.module.css';

export default function ContentCard({ item, size = 'md', index = 0 }) {
  const { user, profile, setIsAuthOpen } = useAuth();
  const { progressMap } = useProgress();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const toast = useToast();
  const [inList, setInList] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [hovering, setHovering] = useState(false);
  const hoverTimer = useRef(null);

  const mediaType = getMediaType(item);
  const title = getTitle(item);
  const year = getReleaseYear(item);
  const poster = getPosterUrl(item.poster_path, size === 'lg' ? 'w780' : 'w500');
  const href = `/${mediaType === 'movie' ? 'movie' : 'tv'}/${item.id}`;
  const watchHref = item.season_number
    ? `/watch/${mediaType}/${item.id}?s=${item.season_number}&e=${item.episode_number || 1}`
    : `/watch/${mediaType}/${item.id}`;

  // Obter progresso do contexto global (SÓ NO CLIENTE PARA EVITAR HYDRATION MISMATCH)
  const progressData = mounted ? progressMap[`${mediaType}_${item.id}`] : null;
  const progress = progressData?.progress_percent ? parseFloat(progressData.progress_percent) : null;

  // Check watchlist status
  useEffect(() => {
    if (!user || !profile) return;
    isInWatchlist(profile.id, item.id, mediaType).then(setInList);
  }, [user, profile, item.id, mediaType]);

  // Removida extração pesada de cor via Canvas para ganho de performance

  // Removida lógica de trailer nos cards para melhor desempenho

  async function toggleWatchlist(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!user || !profile) {
      setIsAuthOpen(true);
      return;
    }
    setListLoading(true);
    if (inList) {
      await removeFromWatchlist(profile.id, item.id, mediaType);
      setInList(false);
      toast?.addToast(`"${title}" removido da sua lista`, 'info');
    } else {
      await addToWatchlist(profile.id, item.id, mediaType);
      setInList(true);
      toast?.addToast(`"${title}" adicionado à sua lista ✓`, 'success');
    }
    setListLoading(false);
  }

  function handleCardClick() {
    router.push(href);
  }

  function handlePlayClick(e) {
    e.stopPropagation();
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    router.push(watchHref);
  }

  return (
    <div
      className={`${styles.card} ${styles[size]}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={handleCardClick}
      role="link"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleCardClick()}
      style={{ 
        '--delay': `${index * 60}ms`
      }}
      suppressHydrationWarning
    >
      {/* Poster */}
      <div className={styles.poster} suppressHydrationWarning>
        <img src={poster} alt={title} loading="lazy" />

        {/* Hover Overlay */}
        <div className={`${styles.overlay} ${hovering ? styles.overlayVisible : ''}`} suppressHydrationWarning>
          <button className={styles.playBtn} onClick={handlePlayClick} title="Assistir">
            <Play fill="currentColor" size={28} />
          </button>

          {/* Watchlist toggle */}
          <button
            className={`${styles.listBtn} ${inList ? styles.inList : ''}`}
            onClick={toggleWatchlist}
            disabled={listLoading}
            title={inList ? 'Remover da lista' : 'Adicionar à lista'}
          >
            {listLoading ? (
              <span className={styles.miniSpinner} />
            ) : inList ? (
              <Check size={16} strokeWidth={3} />
            ) : (
              <Plus size={16} strokeWidth={3} />
            )}
          </button>

          {/* More info button */}
          <button
            className={styles.infoBtn}
            onClick={e => { e.stopPropagation(); router.push(href); }}
            title="Mais detalhes"
          >
            <Info size={16} />
          </button>
        </div>

        {/* Rating badge */}
        {item.vote_average > 0 && (
          <div className={styles.rating} suppressHydrationWarning>
            <Star size={10} fill="#f5c518" color="#f5c518" />
            {item.vote_average.toFixed(1)}
          </div>
        )}

        {/* Type badge */}
        <div className={styles.typeBadge} suppressHydrationWarning>
          {mediaType === 'movie' ? <Clapperboard size={12} /> : <Tv size={12} />}
        </div>

        {/* Progress bar at bottom of poster */}
        {progress !== null && progress > 2 && (
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
        )}

        {/* "Completed" overlay */}
        {progress >= 90 && (
          <div className={styles.completedBadge}>
            <CheckCircle2 size={14} /> <span>Assistido</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className={styles.info} suppressHydrationWarning>
        <p className={styles.title}>{title}</p>
        <div className={styles.meta} suppressHydrationWarning>
          {year && <span className={styles.year}>{year}</span>}
          {item.season_number && (
            <span className={styles.epInfo}>T{item.season_number} E{item.episode_number}</span>
          )}
          {progress !== null && progress > 2 && progress < 90 && (
            <span className={styles.progressText}>{Math.round(progress)}%</span>
          )}
        </div>
      </div>
    </div>
  );
}
