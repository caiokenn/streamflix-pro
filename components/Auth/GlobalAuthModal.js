'use client';
import { useAuth } from '@/contexts/AuthContext';
import AuthModal from './AuthModal';

export default function GlobalAuthModal() {
  const { isAuthOpen, setIsAuthOpen } = useAuth();

  return (
    <AuthModal 
      isOpen={isAuthOpen} 
      onClose={() => setIsAuthOpen(false)} 
    />
  );
}
