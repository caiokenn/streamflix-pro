'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast/Toast';
import { 
  User, 
  Mail, 
  Calendar, 
  Settings, 
  Activity, 
  Bookmark, 
  CheckCircle, 
  Clock,
  Camera,
  LogOut,
  Edit2
} from 'lucide-react';
import styles from './page.module.css';

const AVATAR_PRESETS = ['🦁', '🐺', '🦊', '🐸', '🐙', '🦄', '🐬', '🦅', '🐉', '👾', '🤖', '👽', '👑', '⭐', '🎬', '🍿'];

export default function ProfilePage() {
  const { user, profile, loading: authLoading, setProfile } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('overview');
  const [username, setUsername] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🦁');
  const [stats, setStats] = useState({ watchlist: 0, watching: 0, completed: 0 });
  const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState('');
  const [presets, setPresets] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !profile) return;
    
    setUsername(profile.username || '');
    setSelectedEmoji(profile.avatar_url || '🦁');
    setBio(profile.bio || '');
    loadStats();
    loadPresets();
  }, [authLoading, user, profile]);

  async function loadPresets() {
    const supabase = createClient();
    const { data } = await supabase.from('avatar_presets').select('*');
    if (data) setPresets(data);
  }

  async function loadStats() {
    if (!profile?.id) return;
    const supabase = createClient();
    
    try {
      const [wl, wp] = await Promise.all([
        supabase.from('watchlist').select('*', { count: 'exact', head: true }).eq('profile_id', profile.id),
        supabase.from('watch_progress').select('status').eq('profile_id', profile.id)
      ]);

      const watching = wp.data?.filter(p => p.status === 'watching').length || 0;
      const completed = wp.data?.filter(p => p.status === 'completed').length || 0;

      setStats({
        watchlist: wl.count || 0,
        watching,
        completed
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }

  async function handleSaveProfile() {
    if (!profile?.id) return;
    setSaving(true);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          username, 
          avatar_url: selectedEmoji,
          bio
        })
        .eq('id', profile.id);

      if (error) throw error;

      // ATUALIZAÇÃO CRÍTICA: Sincroniza com o AuthContext e localStorage
      const updatedProfile = { 
        ...profile, 
        username, 
        avatar_url: selectedEmoji,
        bio 
      };
      setProfile(updatedProfile);

      toast?.addToast('Perfil atualizado com sucesso!', 'success');
      // window.location.reload(); // Não precisa mais de reload forçado se o contexto atualizar
    } catch (err) {
      toast?.addToast('Erro ao atualizar perfil', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    setUploading(true);
    const supabase = createClient();
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setSelectedEmoji(publicUrl);
      toast?.addToast('Foto enviada! Clique em Salvar para confirmar.', 'success');
    } catch (err) {
      toast?.addToast('Erro no upload: ' + err.message, 'error');
    } finally {
      setUploading(false);
    }
  }

  if (authLoading) return <div className={styles.loading} suppressHydrationWarning>Carregando...</div>;
  if (!user || !profile) return null;

  return (
    <div className={styles.pageContainer} suppressHydrationWarning>
      <div className={styles.profileHero}>
        <div className={styles.heroBackground} style={{ backgroundImage: profile.banner_url ? `url(${profile.banner_url})` : 'none' }} />
        <div className={styles.heroContent}>
          <div className={styles.avatarSection}>
            <div className={styles.avatarLarge}>
              {selectedEmoji && selectedEmoji.startsWith('http') ? (
                <img src={selectedEmoji} alt="Avatar" className={styles.avatarImg} />
              ) : (
                <span className={styles.avatarEmoji}>{selectedEmoji || '👤'}</span>
              )}
              <label className={styles.editAvatarFloating}>
                <input type="file" hidden onChange={handleFileUpload} accept="image/*" disabled={uploading} />
                <Camera size={16} />
              </label>
            </div>
          </div>
          <div className={styles.profileInfo}>
            <div className={styles.nameRow}>
              <h1 className={styles.username}>{profile.username}</h1>
              <span className={styles.memberBadge}>Membro Premium</span>
            </div>
            <p className={styles.email}><Mail size={14} /> {user.email}</p>
            {profile.bio && <p className={styles.profileBio}>{profile.bio}</p>}
            <div className={styles.profileStatsSmall}>
              <span><Calendar size={12} /> Criado em {new Date(profile.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
          <div className={styles.heroActions}>
            <button 
              className={`${styles.actionBtn} ${tab === 'settings' ? styles.activeAction : ''}`}
              onClick={() => setTab(tab === 'settings' ? 'overview' : 'settings')}
            >
              {tab === 'settings' ? <Activity size={18} /> : <Settings size={18} />}
              <span>{tab === 'settings' ? 'Ver Atividade' : 'Configurações'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className={styles.mainContent}>
        <div className={styles.contentTabs}>
          <button 
            className={`${styles.tabBtn} ${tab === 'overview' ? styles.activeTab : ''}`} 
            onClick={() => setTab('overview')}
          >
            <Activity size={18} />
            Visão Geral
          </button>
          <button 
            className={`${styles.tabBtn} ${tab === 'settings' ? styles.activeTab : ''}`} 
            onClick={() => setTab('settings')}
          >
            <Settings size={18} />
            Configurações
          </button>
        </div>

        {tab === 'overview' && (
          <div className={styles.overviewSection}>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.iconWatchlist}`}>
                  <Bookmark size={24} />
                </div>
                <div className={styles.statData}>
                  <span className={styles.statValue}>{stats.watchlist}</span>
                  <span className={styles.statLabel}>Minha Lista</span>
                </div>
                <div className={styles.statProgress} style={{ width: '40%' }} />
              </div>

              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.iconWatching}`}>
                  <Clock size={24} />
                </div>
                <div className={styles.statData}>
                  <span className={styles.statValue}>{stats.watching}</span>
                  <span className={styles.statLabel}>Assistindo</span>
                </div>
                <div className={styles.statProgress} style={{ width: '65%' }} />
              </div>

              <div className={styles.statCard}>
                <div className={`${styles.statIcon} ${styles.iconCompleted}`}>
                  <CheckCircle size={24} />
                </div>
                <div className={styles.statData}>
                  <span className={styles.statValue}>{stats.completed}</span>
                  <span className={styles.statLabel}>Concluídos</span>
                </div>
                <div className={styles.statProgress} style={{ width: '20%' }} />
              </div>
            </div>

            <div className={styles.activityDashboard}>
              <div className={styles.activityCard}>
                <h3><Clock size={20} /> Atividade Recente</h3>
                <div className={styles.emptyState}>
                  <Activity size={48} opacity={0.2} />
                  <p>Nenhuma atividade registrada nos últimos 7 dias.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className={styles.settingsSection}>
            <div className={styles.settingsGrid}>
              <div className={styles.settingsCard}>
                <h3><User size={20} /> Informações Básicas</h3>
                <div className={styles.formGroup}>
                  <label>Nome de usuário</label>
                  <div className={styles.inputWrapper}>
                    <User size={18} className={styles.inputIcon} />
                    <input 
                      type="text" 
                      value={username} 
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Como quer ser chamado?"
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Bio (Resumo do Perfil)</label>
                  <div className={styles.inputWrapper}>
                    <Edit2 size={18} className={styles.inputIcon} />
                    <textarea 
                      value={bio} 
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Conte um pouco sobre você..."
                      className={styles.bioTextarea}
                    />
                  </div>
                </div>

                <div className={styles.avatarSelection}>
                  <label>Opções Premium (Presets)</label>
                  <div className={styles.avatarPresets}>
                    {presets.length > 0 ? presets.map(p => (
                      <button 
                        key={p.id}
                        className={`${styles.avatarOption} ${selectedEmoji === p.url ? styles.selectedAvatar : ''}`}
                        onClick={() => setSelectedEmoji(p.url)}
                        title={p.name}
                      >
                        <img src={p.url} alt={p.name} />
                      </button>
                    )) : AVATAR_PRESETS.map(emoji => (
                      <button 
                        key={emoji}
                        className={`${styles.avatarOption} ${selectedEmoji === emoji ? styles.selectedAvatar : ''}`}
                        onClick={() => setSelectedEmoji(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  className={styles.saveBtn} 
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  <Edit2 size={18} />
                  {saving ? 'Salvando...' : 'Atualizar Perfil'}
                </button>
              </div>

              <div className={styles.settingsCard}>
                <h3><Settings size={20} /> Preferências e Segurança</h3>
                <div className={styles.infoBox}>
                  <p>Sua conta está vinculada ao e-mail:</p>
                  <strong>{user.email}</strong>
                </div>
                
                <div className={styles.dangerZone}>
                  <h4>Zona de Perigo</h4>
                  <p>Ações permanentes que não podem ser desfeitas.</p>
                  <button className={styles.logoutBtn} onClick={() => window.location.href = '/api/auth/logout'}>
                    <LogOut size={18} />
                    Encerrar Sessão em todos os aparelhos
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
