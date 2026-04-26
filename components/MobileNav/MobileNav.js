'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Search, Bookmark, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import styles from './MobileNav.module.css';

export default function MobileNav() {
  const pathname = usePathname();
  const { user, setIsAuthOpen } = useAuth();

  const navItems = [
    { name: 'Início', href: '/', icon: Home, restricted: false },
    { name: 'Explorar', href: '/search', icon: Search, restricted: false },
    { name: 'Minha Lista', href: '/watchlist', icon: Bookmark, restricted: true },
    { name: 'Perfil', href: '/profile', icon: User, restricted: true },
  ];

  const handleNavClick = (e, item) => {
    if (item.restricted && !user) {
      e.preventDefault();
      setIsAuthOpen(true);
    }
  };

  // Don't show mobile nav on watch page
  if (pathname.startsWith('/watch/')) return null;

  return (
    <nav className={styles.mobileNav} suppressHydrationWarning>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={(e) => handleNavClick(e, item)}
            className={`${styles.navItem} ${isActive ? styles.active : ''}`}
          >
            <div className={styles.iconWrapper} suppressHydrationWarning>
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className={styles.label}>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
