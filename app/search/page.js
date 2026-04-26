'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { searchMulti, getTrending } from '@/lib/tmdb';
import ContentCard from '@/components/ContentCard/ContentCard';
import BackButton from '@/components/BackButton/BackButton';
import { Search, X, Clapperboard, Tv, Frown, TrendingUp, Sparkles } from 'lucide-react';
import styles from './page.module.css';

function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState('all'); // all | movie | tv
  const [inputValue, setInputValue] = useState(query);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const searchRef = useRef(null);

  // Carregar tendências inicialmente
  useEffect(() => {
    getTrending('all', 'day').then(data => {
      setTrending(data.results?.slice(0, 12) || []);
    });
  }, []);

  // Fechar sugestões ao clicar fora
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSuggestionsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-complete logic
  useEffect(() => {
    if (!inputValue || inputValue.length < 3) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const data = await searchMulti(inputValue, 1);
        const filtered = (data?.results || [])
          .filter(r => r.media_type !== 'person' && (r.poster_path || r.backdrop_path))
          .slice(0, 6);
        setSuggestions(filtered);
        setSuggestionsOpen(true);
      } catch (err) {
        console.error('Suggestions error:', err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue]);

  useEffect(() => {
    setInputValue(query);
    setSuggestionsOpen(false);
    if (!query) { setResults([]); return; }
    setLoading(true);
    setPage(1);
    searchMulti(query, 1).then(data => {
      const filtered = (data?.results || []).filter(r => r.media_type !== 'person' && (r.poster_path || r.backdrop_path));
      setResults(filtered);
      setTotalPages(data?.total_pages || 1);
      setLoading(false);
    });
  }, [query]);

  function handleSearch(e) {
    if (e) e.preventDefault();
    setSuggestionsOpen(false);
    if (inputValue.trim()) router.push(`/search?q=${encodeURIComponent(inputValue.trim())}`);
  }

  function handleSuggestionClick(item) {
    setSuggestionsOpen(false);
    setInputValue(item.title || item.name);
    router.push(`/${item.media_type === 'movie' ? 'movie' : 'tv'}/${item.id}`);
  }

  async function loadMore() {
    const nextPage = page + 1;
    setLoading(true);
    const data = await searchMulti(query, nextPage);
    const filtered = (data?.results || []).filter(r => r.media_type !== 'person' && (r.poster_path || r.backdrop_path));
    setResults(prev => [...prev, ...filtered]);
    setPage(nextPage);
    setLoading(false);
  }

  const filtered = filter === 'all' ? results : results.filter(r => r.media_type === filter);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Search Header */}
        <div className={styles.searchHeader}>
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <BackButton />
            <div className={styles.searchBox} ref={searchRef}>
              <Search className={styles.searchIcon} size={20} />
              <input
                type="text"
                placeholder="Buscar filmes, séries, animes..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onFocus={() => inputValue.length >= 3 && setSuggestionsOpen(true)}
                className={styles.searchInput}
                autoFocus
              />
              {inputValue && (
                <button type="button" className={styles.clearBtn} onClick={() => { setInputValue(''); setResults([]); setSuggestions([]); }}>
                  <X size={20} />
                </button>
              )}

              {/* Sugestões Dropdown */}
              {suggestionsOpen && suggestions.length > 0 && (
                <div className={styles.suggestions}>
                  {suggestions.map(item => (
                    <div 
                      key={item.id} 
                      className={styles.suggestionItem}
                      onClick={() => handleSuggestionClick(item)}
                    >
                      <img 
                        src={`https://image.tmdb.org/t/p/w92${item.poster_path}`} 
                        alt={item.title || item.name} 
                        className={styles.suggestionPoster}
                      />
                      <div className={styles.suggestionInfo}>
                        <p className={styles.suggestionTitle}>{item.title || item.name}</p>
                        <div className={styles.suggestionMeta}>
                          <span className={styles.suggestionType}>
                            {item.media_type === 'movie' ? <Clapperboard size={12} /> : <Tv size={12} />}
                            {item.media_type === 'movie' ? 'Filme' : 'Série'}
                          </span>
                          <span className={styles.suggestionYear}>
                            {(item.release_date || item.first_air_date)?.split('-')[0]}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="submit" className={styles.seeAllBtn}>
                    <Search size={14} /> Ver todos os resultados para "{inputValue}"
                  </button>
                </div>
              )}
            </div>
          </form>

          {query && (
            <p className={styles.resultCount}>
              {results.length > 0 ? (
                <><span>{results.length}+</span> resultados para <span>"{query}"</span></>
              ) : !loading ? (
                <>Nenhum resultado para "<span>{query}</span>"</>
              ) : null}
            </p>
          )}

          {/* Filters */}
          {results.length > 0 && (
            <div className={styles.filters}>
              {[
                { key: 'all', label: 'Todos', icon: null },
                { key: 'movie', label: 'Filmes', icon: <Clapperboard size={14} /> },
                { key: 'tv', label: 'Séries', icon: <Tv size={14} /> },
              ].map(f => (
                <button
                  key={f.key}
                  className={`${styles.filterBtn} ${filter === f.key ? styles.filterActive : ''}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.icon}
                  <span>{f.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        {/* Trending or Empty State */}
        {!query && (
          <div className={styles.trendingSection}>
            <div className={styles.trendingHeader}>
              <TrendingUp size={20} color="var(--accent)" />
              <h3>Bombando hoje</h3>
            </div>
            <div className={styles.grid}>
              {trending.map(item => (
                <ContentCard key={item.id} item={item} size="lg" />
              ))}
            </div>
          </div>
        )}

        {query && results.length === 0 && !loading && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Frown size={64} color="var(--text-muted)" />
            </div>
            <h2>Nenhum resultado encontrado</h2>
            <p>Tente termos diferentes ou explore as tendências acima.</p>
            <button className="btn btn-primary" onClick={() => { setInputValue(''); router.push('/search'); }} style={{ marginTop: '1rem' }}>
              <Sparkles size={18} /> Ver Tendências
            </button>
          </div>
        )}

        {loading && results.length === 0 && (
          <div className={styles.grid}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className={`${styles.skeletonCard} skeleton`} />
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <>
            <div className={styles.grid}>
              {filtered.map(item => (
                <ContentCard key={item.id} item={item} size="lg" />
              ))}
            </div>

            {page < totalPages && (
              <div className={styles.loadMore}>
                <button className="btn btn-secondary" onClick={loadMore} disabled={loading}>
                  {loading ? 'Carregando...' : 'Carregar mais'}
                </button>
              </div>
            )}
          </>
        )}

        {query && !loading && filtered.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Frown size={48} color="#737373" />
            </div>
            <h2>Nada encontrado</h2>
            <p>Tente pesquisar com termos diferentes.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>}>
      <SearchResults />
    </Suspense>
  );
}
