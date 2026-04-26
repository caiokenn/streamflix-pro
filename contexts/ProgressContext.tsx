'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { createClient } from '@/lib/supabase/client';
import { saveProgress as supabaseSaveProgress } from '@/lib/supabase';

const ProgressContext = createContext({
  progressMap: {},
  updateProgress: () => {},
  loading: true
});

export function ProgressProvider({ children }) {
  const { profile } = useAuth();
  const [progressMap, setProgressMap] = useState({});
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
      const map = {};
      data.forEach(item => {
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

  const updateProgress = useCallback(async (tmdbId, mediaType, data) => {
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

  const removeProgress = async (mediaType, tmdbId) => {
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

export const useProgress = () => useContext(ProgressContext);
