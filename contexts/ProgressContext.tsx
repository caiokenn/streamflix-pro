'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { createClient } from '@/lib/supabase/client';
import { saveProgress as supabaseSaveProgress } from '@/lib/supabase';

import { MediaType } from '@/lib/validation';

interface WatchProgress {
  id: string;
  tmdb_id: number;
  media_type: string;
  progress: number;
  duration: number;
  updated_at: string;
}

interface ProgressContextType {
  progressMap: Record<string, WatchProgress>;
  updateProgress: (tmdbId: number, mediaType: MediaType, data: any) => Promise<void>;
  removeProgress: (mediaType: MediaType, tmdbId: number) => Promise<void>;
  refreshProgress: () => Promise<void>;
  loading: boolean;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [progressMap, setProgressMap] = useState<Record<string, WatchProgress>>({});
  const [loading, setLoading] = useState(true);

  const fetchProgress = useCallback(async () => {
    if (!profile?.id) {
      setProgressMap({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('watch_progress')
      .select('*')
      .eq('profile_id', profile.id)
      .order('updated_at', { ascending: true });

    if (!error && data) {
      const map: Record<string, WatchProgress> = {};
      data.forEach((item: WatchProgress) => {
        map[`${item.media_type}_${item.tmdb_id}`] = item;
      });
      setProgressMap(map);
    }
    setLoading(false);
  }, [profile?.id]);

  // Carregar todo o progresso ao iniciar
  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const updateProgress = useCallback(async (tmdbId: number, mediaType: MediaType, data: any) => {
    if (!profile?.id) return;

    // Atualização Otimista (UI primeiro)
    const key = `${mediaType}_${tmdbId}`;
    setProgressMap(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...data,
        updated_at: new Date().toISOString()
      }
    }));

    // Persistência no Supabase
    try {
      await supabaseSaveProgress(profile.id, tmdbId, mediaType, data);
    } catch (err) {
      console.error('Falha ao salvar progresso:', err);
    }
  }, [profile?.id]);

  const removeProgress = async (mediaType: MediaType, tmdbId: number) => {
    if (!profile) return;
    const key = `${mediaType}_${tmdbId}`;
    const supabase = createClient();
    
    // Atualização otimista
    setProgressMap(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    try {
      const { error } = await supabase
        .from('watch_progress')
        .delete()
        .eq('profile_id', profile.id)
        .eq('tmdb_id', tmdbId)
        .eq('media_type', mediaType);

      if (error) throw error;
    } catch (err) {
      console.error('Erro ao remover progresso:', err);
      // Reverter se falhar (opcional, mas bom para UX)
      fetchProgress(); 
    }
  };

  return (
    <ProgressContext.Provider value={{ progressMap, loading, updateProgress, removeProgress, refreshProgress: fetchProgress }}>
      {children}
    </ProgressContext.Provider>
  );
}

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) throw new Error('useProgress must be used within ProgressProvider');
  return context;
};
