'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getMovieGenres, getTVGenres, discoverMovies, discoverTV } from '@/lib/tmdb';
import ContentCard from '@/components/ContentCard/ContentCard';
import styles from './page.module.css';

import { 
  Zap, Map, Palette, Smile, ShieldAlert, Video, Users,
  Heart, Wand2, Landmark, Ghost, Music, Search, 
  Rocket, Tv, Eye, Swords, Compass, Baby, Radio, 
  Mic, Globe, Film, HeartPulse, Clapperboard
} from 'lucide-react';

const GENRE_ICONS = {
  28: Zap, 12: Map, 16: Palette, 35: Smile, 80: ShieldAlert, 99: Video, 18: Users,
  10751: Heart, 14: Wand2, 36: Landmark, 27: Ghost, 10402: Music, 9648: Search,
  10749: HeartPulse, 878: Rocket, 10770: Tv, 53: Eye, 10752: Swords, 37: Compass,
  10759: Zap, 10762: Baby, 10763: Radio, 10764: Video, 10765: Wand2, 10766: HeartPulse,
  10767: Mic, 10768: Globe
};

function GenreContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mediaType = searchParams.get('type') || 'movie';
  const genreId = searchParams.get('id');

  const [genres, setGenres] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState(genreId ? parseInt(genreId) : null);
  const [selectedType, setSelectedType] = useState(mediaType);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Load genre list
  useEffect(() => {
    const fn = selectedType === 'movie' ? getMovieGenres : getTVGenres;
    fn().then(data => setGenres(data?.genres || []));
  }, [selectedType]);

  // Load content for selected genre
  useEffect(() => {
    if (!selectedGenre) return;
    setLoading(true);
    setPage(1);
    const fn = selectedType === 'movie' ? discoverMovies : discoverTV;
    fn(`with_genres=${selectedGenre}&page=1`).then(data => {
      setResults(data?.results || []);
      setTotalPages(data?.total_pages || 1);
      setLoading(false);
    });
  }, [selectedGenre, selectedType]);

  async function loadMore() {
    const nextPage = page + 1;
    setLoading(true);
    const fn = selectedType === 'movie' ? discoverMovies : discoverTV;
    const data = await fn(`with_genres=${selectedGenre}&page=${nextPage}`);
    setResults(prev => [...prev, ...(data?.results || [])]);
    setPage(nextPage);
    setTotalPages(data?.total_pages || 1);
    setLoading(false);
  }

  function selectGenre(id) {
    setSelectedGenre(id);
    router.replace(`/genres?type=${selectedType}&id=${id}`, { scroll: false });
  }

  function switchType(type) {
    setSelectedType(type);
    setSelectedGenre(null);
    setResults([]);
    router.replace(`/genres?type=${type}`, { scroll: false });
  }

  const activeGenre = genres.find(g => g.id === selectedGenre);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.container}>
          <h1 className={styles.title}>
            <span className={styles.accentLine} />
            Explorar por Gênero
          </h1>

          {/* Type toggle */}
          <div className={styles.typeToggle}>
            <button
              className={`${styles.typeBtn} ${selectedType === 'movie' ? styles.typeBtnActive : ''}`}
              onClick={() => switchType('movie')}
            >
              <Clapperboard size={18} />
              Filmes
            </button>
            <button
              className={`${styles.typeBtn} ${selectedType === 'tv' ? styles.typeBtnActive : ''}`}
              onClick={() => switchType('tv')}
            >
              <Tv size={18} />
              Séries
            </button>
          </div>
        </div>
      </div>

      <div className={styles.container}>
        {/* Genre Pills */}
        <div className={styles.genreGrid}>
          {genres.map(genre => {
            const IconComponent = GENRE_ICONS[genre.id] || Film;
            return (
              <button
                key={genre.id}
                className={`${styles.genreChip} ${selectedGenre === genre.id ? styles.genreChipActive : ''}`}
                onClick={() => selectGenre(genre.id)}
              >
                <div className={styles.genreIcon}>
                  <IconComponent size={16} strokeWidth={selectedGenre === genre.id ? 2.5 : 2} />
                </div>
                {genre.name}
              </button>
            );
          })}
        </div>

        {/* Results */}
        {!selectedGenre && (
          <div className={styles.emptyState}>
            <span>🎭</span>
            <h2>Selecione um gênero</h2>
            <p>Escolha uma categoria acima para explorar o catálogo</p>
          </div>
        )}

        {selectedGenre && (
          <>
            <div className={styles.resultsHeader}>
              <h2 className={styles.resultsTitle}>
                {(() => {
                  const Icon = GENRE_ICONS[selectedGenre] || Film;
                  return <Icon size={24} style={{ marginRight: '8px', verticalAlign: 'middle', display: 'inline-block' }} />;
                })()}
                {activeGenre?.name}
              </h2>
              <span className={styles.resultsCount}>{results.length}+ títulos</span>
            </div>

            {loading && results.length === 0 ? (
              <div className={styles.grid}>
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className={`${styles.skeletonCard} skeleton`} />
                ))}
              </div>
            ) : (
              <>
                <div className={styles.grid}>
                  {results.map(item => (
                    <ContentCard
                      key={item.id}
                      item={{ ...item, media_type: selectedType }}
                      size="md"
                    />
                  ))}
                </div>

                {page < totalPages && (
                  <div className={styles.loadMore}>
                    <button className="btn btn-secondary" onClick={loadMore} disabled={loading}>
                      {loading ? (
                        <><span className={styles.spinner} /> Carregando...</>
                      ) : (
                        'Carregar mais'
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function GenresPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
      <GenreContent />
    </Suspense>
  );
}
