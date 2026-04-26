'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { Plus, UserPlus } from 'lucide-react';
import styles from './ProfileSystem.module.css';

const AVATARS = [
  'https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-881640101-38_y613rv.jpg',
  'https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-881640101-31_f73c68.jpg',
  'https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-881640101-26_0905v0.jpg',
  'https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-881640101-20_6p4v7f.jpg',
  'https://wallpapers.com/images/hd/netflix-profile-pictures-1000-x-1000-881640101-13_p98v7w.jpg'
];

export default function ProfileSystem({ children }) {
  const { user, profile, setProfile, loading } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [creating, setCreating] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (user && !profile) {
      loadProfiles();
    }
  }, [user, profile]);

  async function loadProfiles() {
    setFetching(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('account_id', user.id);
    setProfiles(data || []);
    setFetching(false);
  }

  async function handleCreateProfile() {
    setCreating(true);
    const username = user.email.split('@')[0];
    const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    
    const { data, error } = await supabase
      .from('profiles')
      .insert({ 
        account_id: user.id, 
        username, 
        avatar_url: avatar 
      })
      .select()
      .single();

    if (data) {
      setProfiles([...profiles, data]);
    }
    setCreating(false);
  }

  // Se não estiver logado, ou já tiver perfil, ou estiver carregando o auth, segue o fluxo normal
  if (loading || !user || profile) return children;

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        <h1 className={styles.title}>Quem está assistindo?</h1>
        
        <div className={styles.profileGrid}>
          {profiles.map(p => (
            <div key={p.id} className={styles.profileItem} onClick={() => setProfile(p)}>
              <div className={styles.avatarWrapper}>
                <img src={p.avatar_url || AVATARS[0]} alt={p.username} className={styles.avatar} />
                <div className={styles.avatarOverlay} />
              </div>
              <span className={styles.username}>{p.username}</span>
            </div>
          ))}

          {profiles.length < 4 && (
            <div className={styles.profileItem} onClick={handleCreateProfile}>
              <div className={styles.addBtn}>
                {creating ? <span className={styles.spinner} /> : <Plus size={40} strokeWidth={1.5} />}
              </div>
              <span className={styles.username}>Adicionar Perfil</span>
            </div>
          )}
        </div>

        <button className={styles.manageBtn}>GERENCIAR PERFIS</button>
      </div>
    </div>
  );
}
