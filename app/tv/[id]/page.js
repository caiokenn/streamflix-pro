import { getTVDetails, getPosterUrl, getBackdropUrl, formatDate } from '@/lib/tmdb';
import Link from 'next/link';
import ContentRow from '@/components/ContentRow/ContentRow';
import WatchlistButton from '@/components/WatchlistButton/WatchlistButton';
import StarRating from '@/components/StarRating/StarRating';
import ShareButton from '@/components/ShareButton/ShareButton';
import BackButton from '@/components/BackButton/BackButton';
import styles from './page.module.css';

export async function generateMetadata({ params }) {
  try {
    const { id } = await params;
    const tv = await getTVDetails(id);
    return {
      title: tv.name,
      description: tv.overview?.slice(0, 160),
    };
  } catch { return { title: 'Série' }; }
}

export default async function TVDetailPage({ params }) {
  const { id } = await params;
  const tv = await getTVDetails(id);

  const cast = tv.credits?.cast?.slice(0, 12) || [];
  const similar = tv.similar?.results?.slice(0, 15) || [];
  const recommendations = tv.recommendations?.results?.slice(0, 15) || [];
  const trailer = tv.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
  const seasons = tv.seasons?.filter(s => s.season_number > 0) || [];

  const backdrop = getBackdropUrl(tv.backdrop_path, 'original');
  const poster = getPosterUrl(tv.poster_path, 'w500');

  return (
    <div className={styles.page}>
      <div className={styles.heroBackdrop}>
        <img src={backdrop} alt={tv.name} className={styles.backdropImg} />
        <div className={styles.backdropOverlay} />
      </div>

      <div className={styles.mainContent}>
        <div className={styles.container}>
          <div className={styles.topActions}>
            <BackButton />
          </div>
          <div className={styles.header}>
            <div className={styles.poster}>
              <img src={poster} alt={tv.name} />
              {tv.vote_average > 0 && (
                <div className={styles.score}>
                  <div className={styles.scoreCircle} style={{ '--score': `${(tv.vote_average / 10) * 100}%` }}>
                    <span>{tv.vote_average.toFixed(1)}</span>
                  </div>
                  <p>Nota TMDB</p>
                </div>
              )}
            </div>

            <div className={styles.info}>
              <div className={styles.genresList}>
                {tv.genres?.map(g => <span key={g.id} className="badge badge-blue">{g.name}</span>)}
                <span className="badge badge-red">📺 Série</span>
              </div>

              <h1 className={styles.title}>{tv.name}</h1>
              {tv.tagline && <p className={styles.tagline}>"{tv.tagline}"</p>}

              <div className={styles.metaRow}>
                {tv.first_air_date && <span>Estreia: {formatDate(tv.first_air_date)}</span>}
                {tv.number_of_seasons > 0 && <span>{tv.number_of_seasons} temporada{tv.number_of_seasons > 1 ? 's' : ''}</span>}
                {tv.number_of_episodes > 0 && <span>{tv.number_of_episodes} episódios</span>}
                {tv.status && <span className="badge badge-blue">{tv.status}</span>}
              </div>

              {tv.overview && <p className={styles.overview}>{tv.overview}</p>}

              <div className={styles.actions}>
                <Link href={`/watch/tv/${tv.id}?s=1&e=1`} className="btn btn-primary" style={{ fontSize: '1.05rem', padding: '14px 32px' }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>
                  Assistir Agora
                </Link>
                {trailer && (
                  <a href={`https://youtube.com/watch?v=${trailer.key}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M21 12l-18 10V2l18 10z"/></svg>
                    Trailer
                  </a>
                )}
                <WatchlistButton tmdbId={tv.id} mediaType="tv" />
                <ShareButton title={tv.name} />
              </div>

              <div style={{ marginTop: '1.25rem' }}>
                <StarRating tmdbId={tv.id} mediaType="tv" />
              </div>
            </div>
          </div>

          {/* Seasons */}
          {seasons.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}><span className={styles.accentLine}/>Temporadas</h2>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {seasons.map(s => (
                  <Link
                    key={s.id}
                    href={`/watch/tv/${tv.id}?s=${s.season_number}&e=1`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      textDecoration: 'none',
                    }}
                  >
                    <div style={{ width: '100px', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                      {s.poster_path
                        ? <img src={getPosterUrl(s.poster_path, 'w154')} alt={s.name} style={{ width: '100%' }} />
                        : <div style={{ aspectRatio: '2/3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📺</div>
                      }
                    </div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, textAlign: 'center', color: 'var(--text-secondary)' }}>
                      T{s.season_number} • {s.episode_count} ep.
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Cast */}
          {cast.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}><span className={styles.accentLine}/>Elenco Principal</h2>
              <div className={styles.castGrid}>
                {cast.map(actor => (
                  <div key={actor.id} className={styles.castCard}>
                    <div className={styles.castAvatar}>
                      {actor.profile_path
                        ? <img src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`} alt={actor.name} />
                        : <span>{actor.name[0]}</span>
                      }
                    </div>
                    <div className={styles.castInfo}>
                      <p className={styles.castName}>{actor.name}</p>
                      <p className={styles.castChar}>{actor.character}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {recommendations.length > 0 && <ContentRow title="Recomendados" icon="💡" items={recommendations} />}
          {similar.length > 0 && <ContentRow title="Semelhantes" icon="📺" items={similar} />}
        </div>
      </div>
    </div>
  );
}
