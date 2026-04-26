'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { searchMulti, getPosterUrl, getTitle, getReleaseYear } from '@/lib/tmdb';
import { Search, ChevronDown, User, List, History, LogOut } from 'lucide-react';
import styles from './Navbar.module.css';

const NAV_LINKS = [
  { name: 'Início', href: '/' },
  { name: 'Filmes', href: '/movies' },
  { name: 'Séries', href: '/series' },
  { name: 'Animes', href: '/anime' },
  { name: 'Categorias', href: '/genres' },
];

export default function Navbar() {
  const { user, profile, logout, loading, setIsAuthOpen } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Para a animação da "pílula" de seleção
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const [hoveredLink, setHoveredLink] = useState(null);
  const linksRef = useRef({});

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Atualiza a posição do indicador quando o pathname ou o hover muda
  useEffect(() => {
    const targetPath = hoveredLink || pathname;
    const activeLink = linksRef.current[targetPath];
    
    if (activeLink) {
      setIndicatorStyle({
        left: activeLink.offsetLeft,
        width: activeLink.offsetWidth,
        opacity: 1
      });
    } else if (!hoveredLink) {
      setIndicatorStyle(prev => ({ ...prev, opacity: 0 }));
    }
  }, [pathname, hoveredLink]);

  useEffect(() => {
    setIsUserMenuOpen(false);
    setIsAuthOpen(false);
    setIsSearchOpen(false);
    setSearchQuery('');
  }, [pathname]);

  // Load search history from localStorage
  useEffect(() => {
    if (mounted) {
      const saved = localStorage.getItem('streamflix_search_history');
      if (saved) setSearchHistory(JSON.parse(saved));
    }
  }, [mounted]);

  const addToHistory = (query) => {
    if (!query.trim()) return;
    const newHistory = [query, ...searchHistory.filter(h => h !== query)].slice(0, 5);
    setSearchHistory(newHistory);
    localStorage.setItem('streamflix_search_history', JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('streamflix_search_history');
  };

  // Handle clicking outside search to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounce and fetch search results
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const data = await searchMulti(searchQuery);
        const filtered = (data?.results || []).filter(item => item.media_type === 'movie' || item.media_type === 'tv').slice(0, 5);
        setSearchResults(filtered);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSearchClick = () => {
    if (isSearchOpen && searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
    } else {
      setIsSearchOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  };

  const handleSearchSubmit = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      addToHistory(searchQuery);
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
    }
  };

  const handleHistoryClick = (query) => {
    setSearchQuery(query);
    addToHistory(query);
    router.push(`/search?q=${encodeURIComponent(query)}`);
    setIsSearchOpen(false);
  };

  const allLinks = [...NAV_LINKS];
  if (mounted && user && profile) {
    allLinks.push({ name: 'Minha Lista', href: '/watchlist' });
  }

  return (
    <>
      <nav className={`${styles.navbar} ${scrolled ? styles.scrolled : ''}`} suppressHydrationWarning>
        <div className={styles.container} suppressHydrationWarning>
          <div className={styles.left} suppressHydrationWarning>
            <Link href="/" className={styles.logo}>
              <span className={styles.logoRed}>Stream</span>Flix
            </Link>
            
            <div className={styles.linksContainer} suppressHydrationWarning>
              <div 
                className={styles.links}
                onMouseLeave={() => setHoveredLink(null)}
                suppressHydrationWarning
              >
                {/* Indicador Flutuante */}
                <div 
                  className={styles.indicator} 
                  style={{
                    transform: `translateX(${indicatorStyle.left}px)`,
                    width: `${indicatorStyle.width}px`,
                    opacity: indicatorStyle.opacity
                  }} 
                  suppressHydrationWarning
                />
                
                {allLinks.map(link => (
                  <Link 
                    key={link.href} 
                    href={link.href}
                    ref={el => linksRef.current[link.href] = el}
                    onMouseEnter={() => setHoveredLink(link.href)}
                    className={`${styles.link} ${pathname === link.href ? styles.active : ''} nav-item`}
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.right} suppressHydrationWarning>
            <div className={styles.searchContainer} ref={searchRef} suppressHydrationWarning>
              <div className={`${styles.searchInputWrapper} ${isSearchOpen ? styles.open : ''}`} suppressHydrationWarning>
                <button className={styles.searchIconBtn} onClick={handleSearchClick} aria-label="Pesquisar">
                  <Search size={20} strokeWidth={2.5} />
                </button>
                <input 
                  ref={searchInputRef}
                  type="text" 
                  className={styles.searchInput} 
                  placeholder="Filmes, Séries, Animes..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchSubmit}
                />
              </div>

              {isSearchOpen && (
                <div className={styles.searchDropdown}>
                  {searchQuery.trim() ? (
                    // Search Results
                    <>
                      {isSearching ? (
                        <div className={styles.searchLoader}>
                          <div className={styles.searchLoaderSpinner} />
                          Pesquisando...
                        </div>
                      ) : searchResults.length > 0 ? (
                        <>
                          {searchResults.map(item => (
                            <Link 
                              key={item.id} 
                              href={`/${item.media_type}/${item.id}`}
                              className={styles.searchResultItem}
                              onClick={() => addToHistory(getTitle(item))}
                            >
                              <img 
                                src={getPosterUrl(item.poster_path, 'w92')} 
                                className={styles.searchResultImage}
                                alt={getTitle(item)}
                              />
                              <div className={styles.searchResultInfo}>
                                <span className={styles.searchResultTitle}>{getTitle(item)}</span>
                                <div className={styles.searchResultMeta}>
                                  <span className={styles.searchResultBadge}>{item.media_type === 'movie' ? 'Filme' : 'Série'}</span>
                                  <span>{getReleaseYear(item)}</span>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </>
                      ) : (
                        <div className={styles.searchEmpty}>Nenhum resultado encontrado</div>
                      )}
                    </>
                  ) : (
                    // Search History
                    <>
                      {searchHistory.length > 0 ? (
                        <div className={styles.historyContainer}>
                          <div className={styles.historyHeader}>
                            <span>Buscas Recentes</span>
                            <button onClick={clearHistory} className={styles.clearHistoryBtn}>Limpar</button>
                          </div>
                          {searchHistory.map((h, i) => (
                            <button 
                              key={i} 
                              className={styles.historyItem}
                              onClick={() => handleHistoryClick(h)}
                            >
                              <Search size={14} />
                              <span>{h}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className={styles.searchEmpty}>Comece a digitar para buscar...</div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {!mounted || loading ? (
              <div className={styles.navLoader} suppressHydrationWarning />
            ) : user ? (
              <div className={styles.userSection}>
                <button 
                  className={styles.userBtn} 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                  <div className={styles.avatar}>
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="Avatar" />
                    ) : (
                      <User size={20} />
                    )}
                  </div>
                  <ChevronDown size={16} className={`${styles.chevron} ${isUserMenuOpen ? styles.open : ''}`} />
                </button>

                {isUserMenuOpen && (
                  <div className={styles.userMenu}>
                    <div className={styles.menuHeader}>
                      <p className={styles.menuName}>{profile?.username || 'Usuário'}</p>
                      <p className={styles.menuEmail}>{user.email}</p>
                    </div>
                    <div className={styles.menuDivider} />
                    <Link href="/profile" className={styles.menuItem}>
                      <User size={16} /> <span>Meu Perfil</span>
                    </Link>
                    <Link href="/watchlist" className={styles.menuItem}>
                      <List size={16} /> <span>Minha Lista</span>
                    </Link>
                    <Link href="/watchlist?tab=history" className={styles.menuItem}>
                      <History size={16} /> <span>Histórico</span>
                    </Link>
                    <div className={styles.menuDivider} />
                    <button onClick={() => { logout(); setIsUserMenuOpen(false); }} className={styles.logoutBtn}>
                      <LogOut size={16} /> <span>Sair da conta</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className={styles.loginBtn} onClick={() => setIsAuthOpen(true)}>
                Entrar
              </button>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
