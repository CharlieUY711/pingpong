/**
 * PerfilView.tsx — Pantalla de perfil
 * Avatar, nombre, perfil, fichas, estadísticas, ranking
 */
import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qhnmxvexkizcsmivfuam.supabase.co';
const SUPA_KEY = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFobm14dmV4a2l6Y3NtaXZmdWFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTIyMTI4MSwiZXhwIjoyMDg2Nzk3MjgxfQ.b2N86NyMG4F3CXcgTnzOjqx7AZPyDTa4QFFCtOSK42s';
const supabase = createClient(SUPA_URL, SUPA_KEY);

export function PerfilView({ onClose }: { onClose: () => void }) {
  const { usuario, estadisticas, historialCoras, logout, buscarUsuarioPorNombre, recargarUsuario } = useAuth();
  const [mostrarAgregarJunior, setMostrarAgregarJunior] = useState(false);
  const [nombreJunior, setNombreJunior] = useState('');
  const [emailJunior, setEmailJunior] = useState('');
  const [passwordJunior, setPasswordJunior] = useState('');
  const [pinParental, setPinParental] = useState('');
  const [avatarJunior, setAvatarJunior] = useState('🎮');
  const [cargando, setCargando] = useState(false);
  const [mostrarCambiarPassword, setMostrarCambiarPassword] = useState(false);
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [ranking, setRanking] = useState<any[]>([]);

  const AVATARES = ['🎮', '🏆', '🎯', '🎲', '🃏', '♟️', '🎳', '🎪'];

  React.useEffect(() => {
    cargarRanking();
  }, []);

  const cargarRanking = async () => {
    try {
      // Ranking por Coras totales
      const { data, error } = await supabase
        .from('gh_usuarios')
        .select('id, nombre, avatar, coras')
        .order('coras', { ascending: false })
        .limit(10);

      if (error) throw error;
      if (data) {
        setRanking(data.map((u: any) => ({
          nombre: u.nombre,
          avatar: u.avatar,
          coras: u.coras ?? 0,
        })));
      }
    } catch (err) {
      console.error('Error cargando ranking:', err);
    }
  };

  // Calcular logros obtenidos
  const calcularLogros = () => {
    if (!usuario || !estadisticas) return [];
    const logros: Array<{ icono: string; nombre: string; descripcion: string }> = [];

    // Logro: Primera partida
    if (estadisticas.length > 0) {
      logros.push({ icono: '🎮', nombre: 'Primer juego', descripcion: 'Jugaste tu primera partida' });
    }

    // Logro: Primera victoria
    const tieneVictoria = estadisticas.some(s => s.victorias > 0);
    if (tieneVictoria) {
      logros.push({ icono: '🏆', nombre: 'Primera victoria', descripcion: 'Ganaste tu primera partida' });
    }

    // Logro: 10 victorias
    const totalVictorias = estadisticas.reduce((sum, s) => sum + s.victorias, 0);
    if (totalVictorias >= 10) {
      logros.push({ icono: '⭐', nombre: 'Veterano', descripcion: '10 victorias conseguidas' });
    }

    // Logro: 100 Coras
    if (usuario.coras >= 100) {
      logros.push({ icono: '💎', nombre: 'Rico en Coras', descripcion: 'Acumulaste 100 Coras' });
    }

    // Logro: Racha de 3
    const tieneRacha = historialCoras.some(m => m.motivo.includes('Racha'));
    if (tieneRacha) {
      logros.push({ icono: '🔥', nombre: 'En racha', descripcion: '3 victorias seguidas' });
    }

    return logros;
  };

  const handleAgregarJunior = async () => {
    if (!nombreJunior || !emailJunior || !passwordJunior || !pinParental) {
      alert('Completa todos los campos');
      return;
    }

    if (pinParental.length !== 4) {
      alert('El PIN debe tener 4 dígitos');
      return;
    }

    if (!usuario) return;

    setCargando(true);
    try {
      // Crear cuenta en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailJunior,
        password: passwordJunior,
      });
      if (authError) throw authError;

      if (!authData.user) throw new Error('No se pudo crear el usuario');

      // Crear registro en gh_usuarios
      const { error: usuarioError } = await supabase.from('gh_usuarios').insert({
        id: authData.user.id,
        nombre: nombreJunior,
        perfil: 'junior',
        pin_parental: pinParental,
        creado_por: usuario.id,
        avatar: avatarJunior,
        coras: 0,
        nectar: 0,
        casino_habilitado: false,
      });
      if (usuarioError) throw usuarioError;

      alert('Cuenta Junior creada exitosamente');
      setMostrarAgregarJunior(false);
      setNombreJunior('');
      setEmailJunior('');
      setPasswordJunior('');
      setPinParental('');
    } catch (err: any) {
      alert(err.message || 'Error al crear cuenta Junior');
    } finally {
      setCargando(false);
    }
  };

  const handleCambiarPassword = async () => {
    if (!passwordActual || !passwordNueva) {
      alert('Completa ambos campos');
      return;
    }

    setCargando(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordNueva,
      });
      if (error) throw error;
      alert('Contraseña actualizada');
      setMostrarCambiarPassword(false);
      setPasswordActual('');
      setPasswordNueva('');
    } catch (err: any) {
      alert(err.message || 'Error al cambiar contraseña');
    } finally {
      setCargando(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
      await logout();
    }
  };

  if (!usuario) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.closeButton} onClick={onClose}>
          ✕
        </button>
        <div style={styles.title}>Perfil</div>
      </div>

      <div style={styles.perfilCard}>
        <div style={styles.avatar}>{usuario.avatar}</div>
        <div style={styles.nombre}>{usuario.nombre}</div>
        <div style={styles.perfil}>
          {usuario.perfil === 'adulto' ? '👨 Adulto' : '👦 Junior'}
        </div>
        <div style={styles.coras}>
          ❤️ {usuario.coras?.toLocaleString() ?? 0} Coras
        </div>
        {usuario.casino_habilitado && (
          <div style={styles.nectar}>
            🔥 {usuario.nectar?.toLocaleString() ?? 0} Nectar
          </div>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Historial de Coras (últimos 10)</div>
        {historialCoras.length === 0 ? (
          <div style={styles.empty}>Aún no tienes movimientos de Coras</div>
        ) : (
          <div style={styles.historialList}>
            {historialCoras.map((mov) => (
              <div key={mov.id} style={styles.historialItem}>
                <div style={styles.historialCantidad}>
                  {mov.cantidad > 0 ? '+' : ''}{mov.cantidad} ❤️
                </div>
                <div style={styles.historialDetalle}>
                  <div style={styles.historialMotivo}>{mov.motivo}</div>
                  {mov.juego && (
                    <div style={styles.historialJuego}>{mov.juego}</div>
                  )}
                  <div style={styles.historialFecha}>
                    {new Date(mov.created_at).toLocaleDateString('es-AR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Estadísticas por juego</div>
        {estadisticas.length === 0 ? (
          <div style={styles.empty}>Aún no has jugado ningún juego</div>
        ) : (
          <div style={styles.statsList}>
            {estadisticas.map((stat) => (
              <div key={stat.id} style={styles.statItem}>
                <div style={styles.statJuego}>{stat.juego}</div>
                <div style={styles.statDetails}>
                  <span>Partidas: {stat.partidas}</span>
                  <span>Victorias: {stat.victorias}</span>
                  <span>Derrotas: {stat.derrotas}</span>
                  <span>Coras ganadas: {stat.coras_ganadas ?? 0} ❤️</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Ranking General por Coras</div>
        {ranking.length === 0 ? (
          <div style={styles.empty}>No hay datos de ranking aún</div>
        ) : (
          <div style={styles.rankingList}>
            {ranking.map((user, index) => (
              <div key={index} style={styles.rankingItem}>
                <span style={styles.rankingPos}>#{index + 1}</span>
                <span style={styles.rankingAvatar}>{user.avatar}</span>
                <span style={styles.rankingNombre}>{user.nombre}</span>
                <span style={styles.rankingPuntos}>{user.coras ?? 0} ❤️</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Logros obtenidos</div>
        {calcularLogros().length === 0 ? (
          <div style={styles.empty}>Aún no has obtenido logros</div>
        ) : (
          <div style={styles.logrosList}>
            {calcularLogros().map((logro, index) => (
              <div key={index} style={styles.logroItem}>
                <span style={styles.logroIcono}>{logro.icono}</span>
                <div style={styles.logroDetalle}>
                  <div style={styles.logroNombre}>{logro.nombre}</div>
                  <div style={styles.logroDescripcion}>{logro.descripcion}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {usuario.perfil === 'adulto' && (
        <div style={styles.section}>
          <button
            style={styles.button}
            onClick={() => setMostrarAgregarJunior(!mostrarAgregarJunior)}
          >
            {mostrarAgregarJunior ? 'Cancelar' : 'Agregar cuenta Junior'}
          </button>

          {mostrarAgregarJunior && (
            <div style={styles.form}>
              <input
                type="text"
                placeholder="Nombre del Junior"
                value={nombreJunior}
                onChange={(e) => setNombreJunior(e.target.value)}
                style={styles.input}
                disabled={cargando}
              />
              <input
                type="email"
                placeholder="Email"
                value={emailJunior}
                onChange={(e) => setEmailJunior(e.target.value)}
                style={styles.input}
                disabled={cargando}
              />
              <input
                type="password"
                placeholder="Contraseña"
                value={passwordJunior}
                onChange={(e) => setPasswordJunior(e.target.value)}
                style={styles.input}
                disabled={cargando}
              />
              <input
                type="text"
                placeholder="PIN parental (4 dígitos)"
                value={pinParental}
                onChange={(e) => setPinParental(e.target.value.replace(/\D/g, '').slice(0, 4))}
                style={styles.input}
                maxLength={4}
                inputMode="numeric"
                disabled={cargando}
              />
              <div style={styles.avatarGrid}>
                {AVATARES.map((av) => (
                  <button
                    key={av}
                    style={{
                      ...styles.avatarButton,
                      ...(avatarJunior === av ? styles.avatarButtonActive : {}),
                    }}
                    onClick={() => setAvatarJunior(av)}
                    disabled={cargando}
                  >
                    {av}
                  </button>
                ))}
              </div>
              <button
                style={styles.buttonPrimary}
                onClick={handleAgregarJunior}
                disabled={cargando}
              >
                {cargando ? 'Creando...' : 'Crear cuenta Junior'}
              </button>
            </div>
          )}
        </div>
      )}

      <div style={styles.section}>
        <button
          style={styles.button}
          onClick={() => setMostrarCambiarPassword(!mostrarCambiarPassword)}
        >
          {mostrarCambiarPassword ? 'Cancelar' : 'Cambiar contraseña'}
        </button>

        {mostrarCambiarPassword && (
          <div style={styles.form}>
            <input
              type="password"
              placeholder="Contraseña actual"
              value={passwordActual}
              onChange={(e) => setPasswordActual(e.target.value)}
              style={styles.input}
              disabled={cargando}
            />
            <input
              type="password"
              placeholder="Nueva contraseña"
              value={passwordNueva}
              onChange={(e) => setPasswordNueva(e.target.value)}
              style={styles.input}
              disabled={cargando}
            />
            <button
              style={styles.buttonPrimary}
              onClick={handleCambiarPassword}
              disabled={cargando}
            >
              {cargando ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>
          </div>
        )}
      </div>

      <button style={styles.buttonLogout} onClick={handleLogout}>
        Cerrar sesión
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
    fontFamily: "'Courier New', monospace",
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: 32,
    cursor: 'pointer',
    width: 48,
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 900,
    color: '#FF6B35',
    flex: 1,
    textAlign: 'center',
  },
  perfilCard: {
    background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)',
    border: '2px solid #333',
    borderRadius: 16,
    padding: 32,
    textAlign: 'center',
    marginBottom: 24,
  },
  avatar: {
    fontSize: 80,
    marginBottom: 16,
  },
  nombre: {
    fontSize: 28,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 8,
  },
  perfil: {
    fontSize: 18,
    color: '#888',
    marginBottom: 16,
  },
  coras: {
    fontSize: 24,
    color: '#FF6B35',
    fontWeight: 700,
    marginTop: 8,
  },
  nectar: {
    fontSize: 20,
    color: '#FFD700',
    fontWeight: 700,
    marginTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  empty: {
    color: '#888',
    textAlign: 'center',
    padding: 20,
    fontSize: 14,
  },
  statsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  statItem: {
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 12,
    padding: 16,
  },
  statJuego: {
    fontSize: 18,
    fontWeight: 700,
    color: '#FF6B35',
    marginBottom: 8,
  },
  statDetails: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 16,
    fontSize: 14,
    color: '#888',
  },
  rankingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  rankingItem: {
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  rankingPos: {
    fontSize: 18,
    fontWeight: 700,
    color: '#FF6B35',
    width: 40,
  },
  rankingAvatar: {
    fontSize: 32,
  },
  rankingNombre: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  rankingPuntos: {
    fontSize: 16,
    fontWeight: 700,
    color: '#FF6B35',
  },
  historialList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  historialItem: {
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  historialCantidad: {
    fontSize: 20,
    fontWeight: 700,
    color: '#FF6B35',
    minWidth: 80,
  },
  historialDetalle: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  historialMotivo: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 600,
  },
  historialJuego: {
    fontSize: 12,
    color: '#888',
    textTransform: 'capitalize',
  },
  historialFecha: {
    fontSize: 12,
    color: '#666',
  },
  logrosList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  logroItem: {
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  logroIcono: {
    fontSize: 32,
  },
  logroDetalle: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  logroNombre: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 600,
  },
  logroDescripcion: {
    fontSize: 12,
    color: '#888',
  },
  button: {
    width: '100%',
    height: 56,
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 12,
    fontSize: 16,
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  buttonPrimary: {
    width: '100%',
    height: 56,
    background: '#FF6B35',
    border: 'none',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginTop: 12,
  },
  buttonLogout: {
    width: '100%',
    height: 56,
    background: '#ff4444',
    border: 'none',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginTop: 24,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 16,
  },
  input: {
    width: '100%',
    height: 56,
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 12,
    padding: '0 20px',
    fontSize: 16,
    color: '#fff',
    fontFamily: "'Courier New', monospace",
    outline: 'none',
  },
  avatarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
  },
  avatarButton: {
    height: 64,
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 12,
    fontSize: 32,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  avatarButtonActive: {
    background: '#FF6B35',
    borderColor: '#FF6B35',
    transform: 'scale(1.1)',
  },
};
