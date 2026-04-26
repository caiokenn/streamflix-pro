'use client';
import { useState, useEffect, Suspense } from 'react';
import { getTrending } from '@/lib/tmdb';
import ContentCard from '@/components/ContentCard/ContentCard';
import styles from './page.module.css';

function TrendingContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeWindow, setTimeWindow] = useState('day'); // day | week
  const [mediaType, setMediaType] = useState('all'); // all | movie | tv
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadTrending(true);
  }, [timeWindow, mediaType]);

  async function loadTrending(reset = false) {
    setLoading(true);
    const currentPage = reset ? 1 : page + 1;
    try {
      const data = await getTrending(mediaType, timeWindow, currentPage);
      if (reset) {
        setItems(data.results || []);
      } else {
        setItems(prev => [...prev, ...(data.results || [])]);
      }
      setPage(currentPage);
      setTotalPages(data.total_pages || 1);
    } catch (error) {
      console.error('Error loading trending:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.container}>
          <h1 className={styles.title}>
            <span className={styles.accentLine} />
            Tendências
          </h1>
          <p className={styles.subtitle}>Os títulos mais assistidos e comentados no momento.</p>

          <div className={styles.filters}>
            <div className={styles.filterGroup}>
              <button 
                className={`${styles.filterBtn} ${timeWindow === 'day' ? styles.active : ''}`}
                onClick={() => setTimeWindow('day')}
              >
                Hoje
              </button>
              <button 
                className={`${styles.filterBtn} ${timeWindow === 'week' ? styles.active : ''}`}
                onClick={() => setTimeWindow('week')}
              >
                Esta Semana
              </button>
            </div>

            <div className={styles.filterGroup}>
              <button 
                className={`${styles.filterBtn} ${mediaType === 'all' ? styles.active : ''}`}
                onClick={() => setMediaType('all')}
              >
                Todos
              </button>
              <button 
                className={`${styles.filterBtn} ${mediaType === 'movie' ? styles.active : ''}`}
                onClick={() => setMediaType('movie')}
              >
                Filmes
              </button>
              <button 
                className={`${styles.filterBtn} ${mediaType === 'tv' ? styles.active : ''}`}
                onClick={() => setMediaType('tv')}
              >
                Séries
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.container}>
        {loading && items.length === 0 ? (
          <div className={styles.grid}>
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className={`${styles.skeleton} skeleton`} />
            ))}
          </div>
        ) : (
          <>
            <div className={styles.grid}>
              {items.map((item, index) => (
                <div key={`${item.id}-${index}`} className={styles.cardWrapper} style={{ animationDelay: `${(index % 20) * 0.05}s` }}>
                  <div className={styles.rankBadge}>{index + 1}</div>
                  <ContentCard item={item} size="md" />
                </div>
              ))}
            </div>

            {page < totalPages && (
              <div className={styles.loadMore}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => loadTrending(false)}
                  disabled={loading}
                >
                  {loading ? 'Carregando...' : 'Carregar Mais'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function TrendingPage() {
  return (
    <Suspense fallback={<div className="loading-screen">Carregando...</div>}>
      <TrendingContent />
    </Suspense>
  );
}
