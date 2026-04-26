import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/Toast/Toast';
import Navbar from '@/components/Navbar/Navbar';
import MobileNav from '@/components/MobileNav/MobileNav';
import KeyboardNav from '@/components/KeyboardNav/KeyboardNav';
import BackToTop from '@/components/BackToTop/BackToTop';
import ProfileSystem from '@/components/Profile/ProfileSystem';
import GlobalAuthModal from '@/components/Auth/GlobalAuthModal';

export const metadata = {
  title: { default: 'StreamFlix — Filmes e Séries', template: '%s | StreamFlix' },
  description: 'Assista aos melhores filmes e séries online gratuitamente.',
  icons: {
    icon: '/icon.svg',
  },
};

import NextTopLoader from 'nextjs-toploader';
import { ProgressProvider } from '@/contexts/ProgressContext';

import { Inter, Bebas_Neue } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const bebas = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bebas',
});

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${bebas.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <NextTopLoader color="#e50914" height={3} showSpinner={false} shadow="0 0 15px #e50914,0 0 5px #e50914" />
        <AuthProvider>
          <ToastProvider>
            <GlobalAuthModal />
            <ProfileSystem>
              <ProgressProvider>
                <Navbar />
                <main className="page-content">
                  {children}
                </main>
                <MobileNav />
                <KeyboardNav />
                <BackToTop />
              </ProgressProvider>
            </ProfileSystem>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
