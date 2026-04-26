import { getMovieDetails, getPosterUrl, getBackdropUrl, formatRuntime, formatDate, getVideoEmbedUrl } from '@/lib/tmdb';
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
    const movie = await getMovieDetails(id);
    return {
      title: movie.title,
      description: movie.overview?.slice(0, 160),
      openGraph: { images: [{ url: `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` }] },
    };
  } catch { return { title: 'Filme' }; }
}

export default async function MovieDetailPage({ params }) {
  const { id } = await params;
  const movie = await getMovieDetails(id);

  const cast = movie.credits?.cast?.slice(0, 12) || [];
  const crew = movie.credits?.crew || [];
  const director = crew.find(c => c.job === 'Director');
  const similar = movie.similar?.results?.slice(0, 15) || [];
  const recommendations = movie.recommendations?.results?.slice(0, 15) || [];
  const trailer = movie.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');

  const backdrop = getBackdropUrl(movie.backdrop_path, 'original');
  const poster = getPosterUrl(movie.poster_path, 'w500');

  return (
    <div className={styles.page}>
      {/* Hero Backdrop */}
      <div className={styles.heroBackdrop}>
        <img src={backdrop} alt={movie.title} className={styles.backdropImg} />
        <div className={styles.backdropOverlay} />
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        <div className={styles.container}>
          <div className={styles.topActions}>
            <BackButton />
          </div>
          {/* Header Section */}
          <div className={styles.header}>
            <div className={styles.poster}>
              <img src={poster} alt={movie.title} />
              {movie.vote_average > 0 && (
                <div className={styles.score}>
                  <div className={styles.scoreCircle} style={{ '--score': `${(movie.vote_average / 10) * 100}%` }}>
                    <span>{movie.vote_average.toFixed(1)}</span>
                  </div>
                  <p>Nota TMDB</p>
                </div>
              )}
            </div>

            <div className={styles.info}>
              {/* Genres */}
              <div className={styles.genresList}>
                {movie.genres?.map(g => (
                  <span key={g.id} className="badge badge-red">{g.name}</span>
                ))}
              </div>

              <h1 className={styles.title}>{movie.title}</h1>

              {movie.tagline && <p className={styles.tagline}>"{movie.tagline}"</p>}

              {/* Meta */}
              <div className={styles.metaRow}>
                {movie.release_date && <span>{formatDate(movie.release_date)}</span>}
                {movie.runtime > 0 && <span>⏱ {formatRuntime(movie.runtime)}</span>}
                {movie.original_language && <span className="badge badge-blue">{movie.original_language.toUpperCase()}</span>}
                {movie.adult && <span className="badge badge-red">+18</span>}
              </div>

              {/* Overview */}
              {movie.overview && <p className={styles.overview}>{movie.overview}</p>}

              {/* Director */}
              {director && (
                <div className={styles.directorRow}>
                  <span className={styles.metaLabel}>Direção</span>
                  <span>{director.name}</span>
                </div>
              )}

              {/* Actions */}
              <div className={styles.actions}>
                <Link href={`/watch/movie/${movie.id}`} className="btn btn-primary" style={{ fontSize: '1.05rem', padding: '14px 32px' }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>
                  Assistir Agora
                </Link>

                {trailer && (
                  <a href={`https://youtube.com/watch?v=${trailer.key}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M21 12l-18 10V2l18 10z"/></svg>
                    Trailer
                  </a>
                )}

                <WatchlistButton tmdbId={movie.id} mediaType="movie" />
                <ShareButton title={movie.title} />
              </div>

              <div style={{ marginTop: '1.25rem' }}>
                <StarRating tmdbId={movie.id} mediaType="movie" />
              </div>
            </div>
          </div>

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

          {/* Similar */}
          {recommendations.length > 0 && (
            <ContentRow title="Recomendados" icon="💡" items={recommendations} />
          )}
          {similar.length > 0 && (
            <ContentRow title="Semelhantes" icon="🎞️" items={similar} />
          )}
        </div>
      </div>
    </div>
  );
}
