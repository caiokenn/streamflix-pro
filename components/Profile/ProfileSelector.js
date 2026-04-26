import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createProfile } from '@/lib/supabase';
import { Plus } from 'lucide-react';
import styles from './ProfileSelector.module.css';

export default function ProfileSelector() {
  const { user, profiles, selectProfile, loadProfiles, logout } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  async function handleAddProfile(e) {
    e.preventDefault();
    if (!newUsername.trim()) return;
    const { data, error } = await createProfile(user.id, newUsername.trim(), '🦁');
    if (data) {
      await loadProfiles(user.id);
      setShowAdd(false);
      setNewUsername('');
    }
  }

  if (!user) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        <h1 className={styles.title}>Quem está assistindo?</h1>
        <div className={styles.profiles}>
          {!showAdd ? (
            <>
              {profiles.map(p => (
                <button 
                  key={p.id} 
                  className={styles.profileCard}
                  onClick={() => selectProfile(p)}
                >
                  <div className={styles.avatar}>
                    {p.avatar_url && p.avatar_url.length <= 2 ? (
                      <span>{p.avatar_url}</span>
                    ) : (
                      <span>{p.username[0].toUpperCase()}</span>
                    )}
                  </div>
                  <span className={styles.name}>{p.username}</span>
                </button>
              ))}
              
              <button className={`${styles.profileCard} ${styles.addBtn}`} onClick={() => setShowAdd(true)}>
                <div className={styles.avatar}>
                  <Plus size={48} strokeWidth={1.5} />
                </div>
                <span className={styles.name}>Adicionar Perfil</span>
              </button>
            </>
          ) : (
            <div className={styles.addFormCard}>
              <h2 className={styles.formTitle}>Novo Perfil</h2>
              <form onSubmit={handleAddProfile} className={styles.form}>
                <input 
                  type="text" 
                  autoFocus 
                  placeholder="Nome do perfil" 
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className={styles.input}
                />
                <div className={styles.formActions}>
                  <button type="submit" className="btn btn-primary">Salvar</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancelar</button>
                </div>
              </form>
            </div>
          )}
        </div>

        <button className={styles.manageBtn} onClick={logout}>
          Sair da Conta
        </button>
      </div>
    </div>
  );
}
