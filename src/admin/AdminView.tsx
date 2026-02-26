/**
 * AdminView.tsx — Panel de administración
 * Gestión completa de usuarios, Coras, Nectar, casino
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qhnmxvexkizcsmivfuam.supabase.co';
const SUPA_KEY = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFobm14dmV4a2l6Y3NtaXZmdWFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTIyMTI4MSwiZXhwIjoyMDg2Nzk3MjgxfQ.b2N86NyMG4F3CXcgTnzOjqx7AZPyDTa4QFFCtOSK42s';
const supabase = createClient(SUPA_URL, SUPA_KEY);

interface UsuarioAdmin {
  id: string;
  nombre: string;
  avatar: string;
  perfil: 'adulto' | 'junior';
  coras: number;
  nectar: number;
  casino_habilitado: boolean;
  created_at: string;
}

interface MovimientoNectar {
  id: string;
  usuario_id: string;
  cantidad: number;
  motivo: string;
  created_at: string;
}

export function AdminView({ onClose }: { onClose: () => void }) {
  const { esAdmin } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<UsuarioAdmin | null>(null);
  const [mostrarHistorialNectar, setMostrarHistorialNectar] = useState(false);
  const [mostrarEstadisticas, setMostrarEstadisticas] = useState(false);
  const [historialNectar, setHistorialNectar] = useState<MovimientoNectar[]>([]);
  const [estadisticasUsuario, setEstadisticasUsuario] = useState<any[]>([]);
  const [nectarAgregar, setNectarAgregar] = useState('');
  const [nectarInicial, setNectarInicial] = useState('10000');

  useEffect(() => {
    if (esAdmin) {
      cargarUsuarios();
      cargarResumen();
    }
  }, [esAdmin]);

  const cargarUsuarios = async () => {
    try {
      const { data, error } = await supabase
        .from('gh_usuarios')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setUsuarios(data);
      }
    } catch (err) {
      console.error('Error cargando usuarios:', err);
    } finally {
      setCargando(false);
    }
  };

  const [resumen, setResumen] = useState({
    totalUsuarios: 0,
    totalNectar: 0,
    totalCoras: 0,
  });

  const cargarResumen = async () => {
    try {
      const { data: usuariosData } = await supabase
        .from('gh_usuarios')
        .select('coras, nectar');

      if (usuariosData) {
        const totalNectar = usuariosData.reduce((sum: number, u: { nectar?: number }) => sum + (u.nectar ?? 0), 0);
        const totalCoras = usuariosData.reduce((sum: number, u: { coras?: number }) => sum + (u.coras ?? 0), 0);
        setResumen({
          totalUsuarios: usuariosData.length,
          totalNectar,
          totalCoras,
        });
      }
    } catch (err) {
      console.error('Error cargando resumen:', err);
    }
  };

  const toggleCasino = async (usuario: UsuarioAdmin) => {
    if (!usuario.casino_habilitado) {
      // Habilitar casino y asignar Nectar inicial
      const cantidad = parseInt(nectarInicial) || 10000;
      const { error } = await supabase
        .from('gh_usuarios')
        .update({
          casino_habilitado: true,
          nectar: (usuario.nectar ?? 0) + cantidad,
        })
        .eq('id', usuario.id);

      if (error) {
        alert('Error habilitando casino: ' + error.message);
        return;
      }

      // Registrar movimiento de Nectar
      await supabase.from('gh_movimientos_nectar').insert({
        usuario_id: usuario.id,
        cantidad,
        motivo: 'Habilitación de casino',
      });
    } else {
      // Deshabilitar casino
      const { error } = await supabase
        .from('gh_usuarios')
        .update({ casino_habilitado: false })
        .eq('id', usuario.id);

      if (error) {
        alert('Error deshabilitando casino: ' + error.message);
        return;
      }
    }

    await cargarUsuarios();
    await cargarResumen();
  };

  const agregarNectar = async (usuario: UsuarioAdmin) => {
    const cantidad = parseInt(nectarAgregar);
    if (!cantidad || cantidad <= 0) {
      alert('Ingresa una cantidad válida');
      return;
    }

    try {
      const { error } = await supabase
        .from('gh_usuarios')
        .update({ nectar: (usuario.nectar ?? 0) + cantidad })
        .eq('id', usuario.id);

      if (error) throw error;

      // Registrar movimiento
      await supabase.from('gh_movimientos_nectar').insert({
        usuario_id: usuario.id,
        cantidad,
        motivo: 'Agregado por administrador',
      });

      alert(`Se agregaron ${cantidad} Nectar a ${usuario.nombre}`);
      setNectarAgregar('');
      await cargarUsuarios();
      await cargarResumen();
    } catch (err: any) {
      alert('Error agregando Nectar: ' + err.message);
    }
  };

  const cargarHistorialNectar = async (usuarioId: string) => {
    try {
      const { data, error } = await supabase
        .from('gh_movimientos_nectar')
        .select('*')
        .eq('usuario_id', usuarioId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (data) setHistorialNectar(data);
    } catch (err) {
      console.error('Error cargando historial Nectar:', err);
    }
  };

  const cargarEstadisticasUsuario = async (usuarioId: string) => {
    try {
      const { data, error } = await supabase
        .from('gh_estadisticas')
        .select('*')
        .eq('usuario_id', usuarioId);

      if (error) throw error;
      if (data) setEstadisticasUsuario(data);
    } catch (err) {
      console.error('Error cargando estadísticas:', err);
    }
  };

  const verHistorialNectar = (usuario: UsuarioAdmin) => {
    setUsuarioSeleccionado(usuario);
    setMostrarHistorialNectar(true);
    cargarHistorialNectar(usuario.id);
  };

  const verEstadisticas = (usuario: UsuarioAdmin) => {
    setUsuarioSeleccionado(usuario);
    setMostrarEstadisticas(true);
    cargarEstadisticasUsuario(usuario.id);
  };

  if (!esAdmin) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>No tienes permisos de administrador</div>
        <button style={styles.button} onClick={onClose}>
          Volver
        </button>
      </div>
    );
  }

  if (mostrarHistorialNectar && usuarioSeleccionado) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.closeButton} onClick={() => {
            setMostrarHistorialNectar(false);
            setUsuarioSeleccionado(null);
          }}>
            ← Volver
          </button>
          <div style={styles.title}>Historial Nectar: {usuarioSeleccionado.nombre}</div>
        </div>
        <div style={styles.historialList}>
          {historialNectar.map((mov) => (
            <div key={mov.id} style={styles.historialItem}>
              <div style={styles.historialCantidad}>
                {mov.cantidad > 0 ? '+' : ''}{mov.cantidad.toLocaleString()} 🔥
              </div>
              <div style={styles.historialDetalle}>
                <div style={styles.historialMotivo}>{mov.motivo}</div>
                <div style={styles.historialFecha}>
                  {new Date(mov.created_at).toLocaleString('es-AR')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (mostrarEstadisticas && usuarioSeleccionado) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.closeButton} onClick={() => {
            setMostrarEstadisticas(false);
            setUsuarioSeleccionado(null);
          }}>
            ← Volver
          </button>
          <div style={styles.title}>Estadísticas: {usuarioSeleccionado.nombre}</div>
        </div>
        <div style={styles.statsList}>
          {estadisticasUsuario.map((stat) => (
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
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.closeButton} onClick={onClose}>
          ✕
        </button>
        <div style={styles.title}>Panel de Administración</div>
      </div>

      <div style={styles.resumen}>
        <div style={styles.resumenItem}>
          <div style={styles.resumenLabel}>Total Usuarios</div>
          <div style={styles.resumenValor}>{resumen.totalUsuarios}</div>
        </div>
        <div style={styles.resumenItem}>
          <div style={styles.resumenLabel}>Total Nectar</div>
          <div style={styles.resumenValor}>{resumen.totalNectar.toLocaleString()} 🔥</div>
        </div>
        <div style={styles.resumenItem}>
          <div style={styles.resumenLabel}>Total Coras</div>
          <div style={styles.resumenValor}>{resumen.totalCoras.toLocaleString()} ❤️</div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Ranking General por Coras</div>
        <div style={styles.rankingList}>
          {usuarios
            .sort((a, b) => (b.coras ?? 0) - (a.coras ?? 0))
            .slice(0, 10)
            .map((user, index) => (
              <div key={user.id} style={styles.rankingItem}>
                <span style={styles.rankingPos}>#{index + 1}</span>
                <span style={styles.rankingAvatar}>{user.avatar}</span>
                <span style={styles.rankingNombre}>{user.nombre}</span>
                <span style={styles.rankingCoras}>{user.coras ?? 0} ❤️</span>
              </div>
            ))}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Gestión de Usuarios</div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Nectar inicial al habilitar casino:</label>
          <input
            type="number"
            value={nectarInicial}
            onChange={(e) => setNectarInicial(e.target.value)}
            style={styles.input}
            placeholder="10000"
          />
        </div>
        {cargando ? (
          <div style={styles.loading}>Cargando usuarios...</div>
        ) : (
          <div style={styles.usuariosList}>
            {usuarios.map((usuario) => (
              <div key={usuario.id} style={styles.usuarioCard}>
                <div style={styles.usuarioHeader}>
                  <span style={styles.usuarioAvatar}>{usuario.avatar}</span>
                  <div style={styles.usuarioInfo}>
                    <div style={styles.usuarioNombre}>{usuario.nombre}</div>
                    <div style={styles.usuarioPerfil}>
                      {usuario.perfil === 'adulto' ? '👨 Adulto' : '👦 Junior'}
                    </div>
                  </div>
                </div>
                <div style={styles.usuarioStats}>
                  <div>❤️ {usuario.coras ?? 0} Coras</div>
                  <div>🔥 {usuario.nectar ?? 0} Nectar</div>
                  <div>
                    Casino: {usuario.casino_habilitado ? '✅ Habilitado' : '❌ Deshabilitado'}
                  </div>
                </div>
                <div style={styles.usuarioActions}>
                  <button
                    style={{
                      ...styles.button,
                      ...(usuario.casino_habilitado ? styles.buttonDanger : styles.buttonSuccess),
                    }}
                    onClick={() => toggleCasino(usuario)}
                  >
                    {usuario.casino_habilitado ? 'Deshabilitar Casino' : 'Habilitar Casino'}
                  </button>
                  <div style={styles.nectarGroup}>
                    <input
                      type="number"
                      value={nectarAgregar}
                      onChange={(e) => setNectarAgregar(e.target.value)}
                      style={styles.inputSmall}
                      placeholder="Cantidad"
                    />
                    <button
                      style={styles.buttonSmall}
                      onClick={() => agregarNectar(usuario)}
                    >
                      Agregar Nectar
                    </button>
                  </div>
                  <button
                    style={styles.buttonSecondary}
                    onClick={() => verHistorialNectar(usuario)}
                  >
                    Ver Historial Nectar
                  </button>
                  <button
                    style={styles.buttonSecondary}
                    onClick={() => verEstadisticas(usuario)}
                  >
                    Ver Estadísticas
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
  resumen: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
    marginBottom: 24,
  },
  resumenItem: {
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 12,
    padding: 20,
    textAlign: 'center',
  },
  resumenLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  resumenValor: {
    fontSize: 24,
    fontWeight: 700,
    color: '#FF6B35',
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
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
    display: 'block',
  },
  input: {
    width: '100%',
    height: 48,
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 12,
    padding: '0 20px',
    fontSize: 16,
    color: '#fff',
    fontFamily: "'Courier New', monospace",
    outline: 'none',
  },
  inputSmall: {
    flex: 1,
    height: 40,
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 8,
    padding: '0 12px',
    fontSize: 14,
    color: '#fff',
    fontFamily: "'Courier New', monospace",
    outline: 'none',
  },
  usuariosList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  usuarioCard: {
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 12,
    padding: 20,
  },
  usuarioHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  usuarioAvatar: {
    fontSize: 40,
  },
  usuarioInfo: {
    flex: 1,
  },
  usuarioNombre: {
    fontSize: 18,
    fontWeight: 700,
    color: '#fff',
  },
  usuarioPerfil: {
    fontSize: 14,
    color: '#888',
  },
  usuarioStats: {
    display: 'flex',
    gap: 16,
    marginBottom: 16,
    fontSize: 14,
    color: '#888',
  },
  usuarioActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  nectarGroup: {
    display: 'flex',
    gap: 8,
  },
  button: {
    width: '100%',
    height: 48,
    background: '#FF6B35',
    border: 'none',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  buttonSuccess: {
    background: '#4caf50',
  },
  buttonDanger: {
    background: '#ff4444',
  },
  buttonSecondary: {
    width: '100%',
    height: 40,
    background: '#333',
    border: '2px solid #333',
    borderRadius: 8,
    fontSize: 14,
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  buttonSmall: {
    height: 40,
    padding: '0 16px',
    background: '#FF6B35',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  loading: {
    color: '#888',
    textAlign: 'center',
    padding: 40,
  },
  error: {
    background: '#ff4444',
    color: '#fff',
    padding: '20px',
    borderRadius: 12,
    textAlign: 'center',
    marginBottom: 20,
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
  rankingCoras: {
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
    color: '#FFD700',
    minWidth: 120,
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
  historialFecha: {
    fontSize: 12,
    color: '#666',
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
};
