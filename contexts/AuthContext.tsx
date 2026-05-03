// contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

export interface Profile {
  id: string;
  username: string;
  avatar_url: string;
  video_preferences?: {
    addon: string | null;
    quality: string | null;
    isDub: boolean | null;
  };
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  setProfile: (p: Profile | null) => void;
  logout: () => Promise<void>;
  isAuthOpen: boolean;
  setIsAuthOpen: (open: boolean) => void;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    // Recupera perfil do localStorage para persistência rápida
    const savedProfile = localStorage.getItem('sf_active_profile');
    if (savedProfile) {
      try { setProfile(JSON.parse(savedProfile)); } catch {}
    }

    // Verifica usuário inicial
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setLoading(false);
    });

    // Escuta mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setUser(session?.user ?? null);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        localStorage.removeItem('sf_active_profile');
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSetProfile = (p: Profile | null) => {
    setProfile(p);
    if (p) localStorage.setItem('sf_active_profile', JSON.stringify(p));
    else localStorage.removeItem('sf_active_profile');
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!profile) return;
    const newProfile = { ...profile, ...updates };
    handleSetProfile(newProfile);
    
    // Atualiza no banco
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id);
    
    if (error) console.error('Erro ao atualizar perfil:', error);
  };

  const logout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    localStorage.removeItem('sf_active_profile');
    setLoading(false);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, setProfile: handleSetProfile, logout, isAuthOpen, setIsAuthOpen, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};