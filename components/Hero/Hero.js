'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useProgress } from '@/contexts/ProgressContext';
import { getTitle, getReleaseYear, getBackdropUrl, getPosterUrl, formatRuntime, getMovieDetails, getTVDetails } from '@/lib/tmdb';
import { Play, Info, Star } from 'lucide-react';
import styles from './Hero.module.css';

export default function Hero({ items = [] }) {
  const { progressMap } = useProgress();
  const [mounted, setMounted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [trailerKey, setTrailerKey] = useState(null);
  const [showTrailer, setShowTrailer] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setTransitioning(true);
      setTimeout(() => {
        setCurrent(c => (c + 1) % items.length);
        setTransitioning(false);
      }, 600);
    }, 12000);
    return () => clearInterval(timer);
  }, [items.length]);

  useEffect(() => {
    setShowTrailer(false);
    setTrailerKey(null);
    if (!items.length) return;
    
    const item = items[current];
    const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
    let isCancelled = false;

    const timeout = setTimeout(async () => {
      try {
        const details = mediaType === 'movie' ? await getMovieDetails(item.id) : await getTVDetails(item.id);
        if (isCancelled) return;
        
        const videos = details?.videos?.results || [];
        const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube' && v.official) 
                     || videos.find(v => v.type === 'Trailer' && v.site === 'YouTube')
                     || videos.find(v => v.site === 'YouTube');
                     
        if (trailer) {
          setTrailerKey(trailer.key);
          setTimeout(() => {
            if (!isCancelled) setShowTrailer(true);
          }, 1500);
        }
      } catch (e) {
        console.error("Failed to load trailer", e);
      }
    }, 1000);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [current, items]);

  if (!items.length) return <div className={styles.heroSkeleton} />;

  const item = items[current];
  const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
  const progressData = mounted ? progressMap[`${mediaType}_${item.id}`] : null;
  const hasProgress = !!(progressData && progressData.status === 'watching');
  const watchHref = hasProgress 
    ? `/watch/${mediaType}/${item.id}?s=${progressData.season_number || 1}&e=${progressData.episode_number || 1}`
    : `/watch/${mediaType}/${item.id}`;

  const title = getTitle(item);
  const year = getReleaseYear(item);
  const backdrop = getBackdropUrl(item.backdrop_path, 'original');
  const overview = item.overview?.slice(0, 160) + (item.overview?.length > 160 ? '...' : '');

  function goTo(i) {
    if (i === current) return;
    setTransitioning(true);
    setTimeout(() => { setCurrent(i); setTransitioning(false); }, 400);
  }

  const { user, setIsAuthOpen } = useAuth();
  
  const handleWatchClick = (e) => {
    if (!user) {
      e.preventDefault();
      setIsAuthOpen(true);
    }
  };

  return (
    <section className={styles.hero} suppressHydrationWarning>
      <div className={`${styles.backdrop} ${transitioning ? styles.transitioning : ''}`} suppressHydrationWarning>
        <img src={backdrop} alt={title} className={styles.backdropImg} fetchPriority="high" />
        
        {trailerKey && (
          <div className={`${styles.trailerWrapper} ${showTrailer ? styles.visible : ''}`}>
            <iframe
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${trailerKey}&modestbranding=1&playsinline=1`}
              allow="autoplay; encrypted-media"
              frameBorder="0"
              title="Trailer"
            />
          </div>
        )}

        <div className={styles.backdropOverlay} suppressHydrationWarning />
      </div>

      <div className={`${styles.content} ${transitioning ? styles.transitioning : ''}`} suppressHydrationWarning>
        <div className={styles.infoBox} suppressHydrationWarning>
          <div className={styles.meta}>
            <span className={styles.badge}>
              {mediaType === 'movie' ? 'Filme' : 'Série'}
            </span>
            {year && <span className={styles.year}>{year}</span>}
            {item.vote_average > 0 && (
              <span className={styles.rating}>
                <Star size={14} fill="currentColor" />
                {item.vote_average.toFixed(1)}
              </span>
            )}
          </div>

          <h1 className={styles.title}>{title}</h1>

          {overview && <p className={styles.overview}>{overview}</p>}

          {item.genre_ids?.length > 0 && (
            <div className={styles.genres}>
              {item.genre_ids.slice(0, 2).map(id => (
                <span key={id} className={styles.genre}>{getGenreName(id)}</span>
              ))}
            </div>
          )}

          <div className={styles.actions}>
            <Link href={watchHref} className={styles.mainBtn} onClick={handleWatchClick}>
              <Play size={18} fill="currentColor" />
              <span>{hasProgress ? 'Continuar Assistindo' : 'Assistir'}</span>
            </Link>
            <Link href={`/${mediaType === 'movie' ? 'movie' : 'tv'}/${item.id}`} className={styles.secBtn}>
              <Info size={18} />
              <span>Detalhes</span>
            </Link>
          </div>
        </div>
      </div>

      <div className={styles.navContainer}>
        {items.length > 1 && (
          <div className={styles.thumbnails}>
            {items.slice(0, 4).map((item, i) => (
              <button
                key={item.id}
                className={`${styles.thumb} ${i === current ? styles.thumbActive : ''}`}
                onClick={() => goTo(i)}
              >
                <img src={getPosterUrl(item.poster_path, 'w92')} alt={getTitle(item)} />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const GENRE_MAP = {
  28: 'Ação', 12: 'Aventura', 16: 'Animação', 35: 'Comédia', 80: 'Crime',
  18: 'Drama', 10751: 'Família', 14: 'Fantasia', 27: 'Terror', 9648: 'Mistério',
  10749: 'Romance', 878: 'Ficção Científica', 53: 'Suspense', 37: 'Faroeste',
  10759: 'Ação e Aventura', 10762: 'Infantil', 10763: 'Notícias', 10764: 'Reality',
  10765: 'Sci-Fi e Fantasia', 10766: 'Novela', 10767: 'Talk Show', 10768: 'Guerra',
};

function getGenreName(id) {
  return GENRE_MAP[id] || '';
}
