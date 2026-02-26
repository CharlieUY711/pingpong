/**
 * RuletaView.tsx — Ruleta Casino Multijugador
 * Supabase Realtime — todos ven el resultado en tiempo real
 * Apuestas: número exacto, rojo/negro, par/impar
 * Fichas virtuales para ganancias/pérdidas
 */
import React, { useState, useEffect, useRef } from 'react';

// ─── Config Supabase ─────────────────────────────────────────────────────────
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPA_KEY = import.meta.env.VITE_SUPABASE_KEY || '';

const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPA_KEY,
  'Authorization': `Bearer ${SUPA_KEY}`,
  'Prefer': 'return=representation',
};

// ─── Constantes ─────────────────────────────────────────────────────────────
const NUMEROS_RULETA = [
  { num: 0, color: 'verde' },
  { num: 32, color: 'rojo' }, { num: 15, color: 'negro' }, { num: 19, color: 'rojo' },
  { num: 4, color: 'negro' }, { num: 21, color: 'rojo' }, { num: 2, color: 'negro' },
  { num: 25, color: 'rojo' }, { num: 17, color: 'negro' }, { num: 34, color: 'rojo' },
  { num: 6, color: 'negro' }, { num: 27, color: 'rojo' }, { num: 13, color: 'negro' },
  { num: 36, color: 'rojo' }, { num: 11, color: 'negro' }, { num: 30, color: 'rojo' },
  { num: 8, color: 'negro' }, { num: 23, color: 'rojo' }, { num: 10, color: 'negro' },
  { num: 5, color: 'rojo' }, { num: 24, color: 'negro' }, { num: 16, color: 'rojo' },
  { num: 33, color: 'negro' }, { num: 1, color: 'rojo' }, { num: 20, color: 'negro' },
  { num: 14, color: 'rojo' }, { num: 31, color: 'negro' }, { num: 9, color: 'rojo' },
  { num: 22, color: 'negro' }, { num: 18, color: 'rojo' }, { num: 29, color: 'negro' },
  { num: 7, color: 'rojo' }, { num: 28, color: 'negro' }, { num: 12, color: 'rojo' },
  { num: 35, color: 'negro' }, { num: 3, color: 'rojo' }, { num: 26, color: 'negro' },
];

interface RuletaViewProps {
  onBack: () => void;
}

interface Sala {
  id: string;
  estado: 'esperando' | 'apuestas' | 'girando' | 'resultado';
  jugador1: string | null;
  jugador2: string | null;
  numeroGanador: number | null;
  apuestas: Record<string, Apuesta>;
  ultimoGanador: number | null;
}

interface Apuesta {
  jugador: string;
  tipo: 'numero' | 'rojo' | 'negro' | 'par' | 'impar';
  valor: number; // número específico o 0 para color/paridad
  fichas: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function genCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function getColor(num: number): 'rojo' | 'negro' | 'verde' {
  const item = NUMEROS_RULETA.find(n => n.num === num);
  return item ? (item.color as 'rojo' | 'negro' | 'verde') : 'verde';
}

function esPar(num: number): boolean {
  return num !== 0 && num % 2 === 0;
}

async function getSala(id: string): Promise<Sala | null> {
  const r = await fetch(`${SUPA_URL}/rest/v1/ruleta_salas?id=eq.${id}`, { headers: HEADERS });
  const d = await r.json();
  return d[0] || null;
}

async function patchSala(id: string, data: Partial<Sala>) {
  await fetch(`${SUPA_URL}/rest/v1/ruleta_salas?id=eq.${id}`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify(data),
  });
}

async function crearSala(id: string, nombre: string): Promise<void> {
  await fetch(`${SUPA_URL}/rest/v1/ruleta_salas`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      id,
      estado: 'esperando',
      jugador1: nombre,
      jugador2: null,
      numeroGanador: null,
      apuestas: {},
      ultimoGanador: null,
    }),
  });
}

async function unirSala(id: string, nombre: string): Promise<boolean> {
  const sala = await getSala(id);
  if (!sala || sala.jugador2) return false;
  await patchSala(id, { jugador2: nombre, estado: 'apuestas' });
  return true;
}

// ─── Componente principal ───────────────────────────────────────────────────
export function RuletaView({ onBack }: RuletaViewProps) {
  const [fase, setFase] = useState<'lobby' | 'sala' | 'juego'>('lobby');
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoInput, setCodigoInput] = useState('');
  const [jugador, setJugador] = useState<1 | 2>(1);
  const [sala, setSala] = useState<Sala | null>(null);
  const [error, setError] = useState('');
  const [esperando, setEsperando] = useState(false);

  const handleCrear = async () => {
    if (!nombre.trim()) { setError('Ingresá tu nombre'); return; }
    const code = genCode();
    await crearSala(code, nombre.trim());
    setCodigo(code);
    setJugador(1);
    setFase('sala');
    setEsperando(true);
  };

  const handleUnirse = async () => {
    if (!nombre.trim()) { setError('Ingresá tu nombre'); return; }
    if (!codigoInput.trim()) { setError('Ingresá el código'); return; }
    const ok = await unirSala(codigoInput.toUpperCase(), nombre.trim());
    if (!ok) { setError('Sala no encontrada o ya llena'); return; }
    setCodigo(codigoInput.toUpperCase());
    setJugador(2);
    setFase('juego');
  };

  useEffect(() => {
    if (fase !== 'sala' || !esperando) return;
    const iv = setInterval(async () => {
      const s = await getSala(codigo);
      if (s?.estado === 'apuestas' || s?.estado === 'girando' || s?.estado === 'resultado') {
        setSala(s);
        setFase('juego');
        setEsperando(false);
        clearInterval(iv);
      }
    }, 1500);
    return () => clearInterval(iv);
  }, [fase, esperando, codigo]);

  if (fase === 'lobby') {
    return (
      <Lobby
        nombre={nombre}
        setNombre={setNombre}
        codigoInput={codigoInput}
        setCodigoInput={setCodigoInput}
        error={error}
        setError={setError}
        onCrear={handleCrear}
        onUnirse={handleUnirse}
        onBack={onBack}
      />
    );
  }

  if (fase === 'sala') {
    return <SalaEspera codigo={codigo} nombre={nombre} onBack={onBack} />;
  }

  if (fase === 'juego') {
    return (
      <Juego
        codigo={codigo}
        jugador={jugador}
        nombre={nombre}
        salaInicial={sala}
        onBack={onBack}
      />
    );
  }

  return null;
}

// ─── Lobby ──────────────────────────────────────────────────────────────────
function Lobby({ nombre, setNombre, codigoInput, setCodigoInput, error, setError, onCrear, onUnirse, onBack }: any) {
  return (
    <div style={styles.fullPage}>
      <button style={styles.backButton} onClick={onBack}>← Volver</button>
      <div style={styles.lobbyCard}>
        <div style={styles.title}>🎰 RULETA</div>
        <div style={styles.subtitle}>Casino Multijugador</div>

        <input
          style={styles.input}
          placeholder="Tu nombre"
          value={nombre}
          onChange={e => { setNombre(e.target.value); setError(''); }}
          maxLength={12}
        />

        <button style={styles.btnPrimary} onClick={onCrear}>
          🎰 Crear sala
        </button>

        <div style={styles.divider}><span>o uníte con código</span></div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={{ ...styles.input, flex: 1, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 4, fontSize: 20, fontWeight: 700 }}
            placeholder="ABCD"
            value={codigoInput}
            onChange={e => { setCodigoInput(e.target.value.toUpperCase()); setError(''); }}
            maxLength={4}
          />
          <button style={styles.btnSecondary} onClick={onUnirse}>Unirse</button>
        </div>

        {error && <div style={styles.errorMsg}>{error}</div>}
      </div>
    </div>
  );
}

// ─── Sala de espera ─────────────────────────────────────────────────────────
function SalaEspera({ codigo, nombre, onBack }: { codigo: string; nombre: string; onBack: () => void }) {
  return (
    <div style={styles.fullPage}>
      <button style={styles.backButton} onClick={onBack}>← Volver</button>
      <div style={styles.lobbyCard}>
        <div style={styles.title}>🎰 RULETA</div>
        <div style={{ color: '#aaa', fontSize: 15, marginBottom: 24 }}>Hola, <b style={{ color: '#fff' }}>{nombre}</b></div>
        <div style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>Compartí este código con tu oponente:</div>
        <div style={styles.codigoGrande}>{codigo}</div>
        <div style={{ color: '#666', fontSize: 13, marginTop: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={styles.dot} />
          Esperando oponente...
        </div>
      </div>
    </div>
  );
}

// ─── Juego ───────────────────────────────────────────────────────────────────
function Juego({ codigo, jugador, nombre, salaInicial, onBack }: {
  codigo: string;
  jugador: 1 | 2;
  nombre: string;
  salaInicial: Sala | null;
  onBack: () => void;
}) {
  const [sala, setSala] = useState<Sala | null>(salaInicial);
  const [fichas, setFichas] = useState(1000);
  const [apuestaActual, setApuestaActual] = useState<{ tipo: string; valor: number; fichas: number } | null>(null);
  const [rotacion, setRotacion] = useState(0);
  const [girando, setGirando] = useState(false);
  const ruedaRef = useRef<HTMLDivElement>(null);
  const isHost = jugador === 1;

  useEffect(() => {
    const iv = setInterval(async () => {
      const s = await getSala(codigo);
      if (!s) return;
      setSala(s);

      if (s.estado === 'girando' && !girando) {
        setGirando(true);
        girarRuleta(s.numeroGanador || 0);
      }

      if (s.estado === 'resultado' && s.numeroGanador !== null) {
        calcularGanancias(s.numeroGanador, s.apuestas);
      }
    }, 500);
    return () => clearInterval(iv);
  }, [codigo, girando]);

  const girarRuleta = (numeroGanador: number) => {
    const indexGanador = NUMEROS_RULETA.findIndex(n => n.num === numeroGanador);
    const anguloPorNumero = 360 / NUMEROS_RULETA.length;
    const rotacionFinal = 360 * 5 + (NUMEROS_RULETA.length - indexGanador) * anguloPorNumero;
    
    setRotacion(rotacionFinal);
    
    setTimeout(() => {
      setGirando(false);
    }, 4000);
  };

  const calcularGanancias = (numeroGanador: number, apuestas: Record<string, Apuesta>) => {
    const miApuesta = Object.values(apuestas).find(a => a.jugador === nombre);
    if (!miApuesta) return;

    let ganancia = 0;
    const colorGanador = getColor(numeroGanador);
    const parGanador = esPar(numeroGanador);

    if (miApuesta.tipo === 'numero' && miApuesta.valor === numeroGanador) {
      ganancia = miApuesta.fichas * 36; // Paga 36:1
    } else if (miApuesta.tipo === 'rojo' && colorGanador === 'rojo') {
      ganancia = miApuesta.fichas * 2; // Paga 2:1
    } else if (miApuesta.tipo === 'negro' && colorGanador === 'negro') {
      ganancia = miApuesta.fichas * 2; // Paga 2:1
    } else if (miApuesta.tipo === 'par' && parGanador) {
      ganancia = miApuesta.fichas * 2; // Paga 2:1
    } else if (miApuesta.tipo === 'impar' && !parGanador && numeroGanador !== 0) {
      ganancia = miApuesta.fichas * 2; // Paga 2:1
    }

    setFichas(prev => prev - miApuesta.fichas + ganancia);
  };

  const hacerApuesta = async (tipo: 'numero' | 'rojo' | 'negro' | 'par' | 'impar', valor: number, fichasApostadas: number) => {
    if (fichas < fichasApostadas || sala?.estado !== 'apuestas') return;

    const nuevaApuesta: Apuesta = {
      jugador: nombre,
      tipo,
      valor,
      fichas: fichasApostadas,
    };

    const apuestasActualizadas = { ...sala?.apuestas, [nombre]: nuevaApuesta };
    await patchSala(codigo, { apuestas: apuestasActualizadas });
    setFichas(prev => prev - fichasApostadas);
  };

  const iniciarGiro = async () => {
    if (!isHost || sala?.estado !== 'apuestas') return;
    const numeroGanador = Math.floor(Math.random() * 37);
    await patchSala(codigo, { estado: 'girando', numeroGanador });
  };

  const resetearRonda = async () => {
    if (!isHost || sala?.estado !== 'resultado') return;
    await patchSala(codigo, { estado: 'apuestas', numeroGanador: null, apuestas: {} });
  };

  if (!sala) return <div style={{ ...styles.fullPage, color: '#888', fontSize: 16 }}>Cargando...</div>;

  const numeroGanador = sala.numeroGanador;
  const colorGanador = numeroGanador !== null ? getColor(numeroGanador) : null;

  return (
    <div style={styles.fullPage}>
      <button style={styles.backButton} onClick={onBack}>← Volver</button>

      {/* Header con fichas y estado */}
      <div style={styles.header}>
        <div style={styles.fichasContainer}>
          <span style={styles.fichasLabel}>Fichas:</span>
          <span style={styles.fichasValor}>{fichas}</span>
        </div>
        <div style={styles.estadoContainer}>
          <span style={styles.estadoLabel}>Estado:</span>
          <span style={styles.estadoValor}>{sala.estado === 'apuestas' ? 'Apuestas abiertas' : sala.estado === 'girando' ? 'Girando...' : 'Resultado'}</span>
        </div>
      </div>

      {/* Rueda */}
      <div style={styles.ruletaContainer}>
        <div
          ref={ruedaRef}
          style={{
            ...styles.ruleta,
            transform: `rotate(${rotacion}deg)`,
            transition: girando ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
          }}
        >
          {NUMEROS_RULETA.map((item, index) => {
            const angulo = (360 / NUMEROS_RULETA.length) * index;
            const radio = 170;
            const x = Math.cos((angulo - 90) * (Math.PI / 180)) * radio;
            const y = Math.sin((angulo - 90) * (Math.PI / 180)) * radio;

            return (
              <div
                key={index}
                style={{
                  ...styles.numeroRueda,
                  background: item.color === 'rojo' ? '#c41e3a' : item.color === 'negro' ? '#1a1a1a' : '#0d7d0d',
                  color: '#fff',
                  position: 'absolute',
                  left: `calc(50% + ${x}px)`,
                  top: `calc(50% + ${y}px)`,
                  transform: `translate(-50%, -50%) rotate(${angulo + 90}deg)`,
                  transformOrigin: 'center',
                }}
              >
                {item.num}
              </div>
            );
          })}
        </div>
        <div style={styles.puntero} />
      </div>

      {/* Resultado */}
      {sala.estado === 'resultado' && numeroGanador !== null && (
        <div style={styles.resultadoContainer}>
          <div style={styles.resultadoNumero}>{numeroGanador}</div>
          <div style={{ ...styles.resultadoColor, color: colorGanador === 'rojo' ? '#c41e3a' : colorGanador === 'negro' ? '#1a1a1a' : '#0d7d0d' }}>
            {colorGanador?.toUpperCase()}
          </div>
        </div>
      )}

      {/* Panel de apuestas */}
      {sala.estado === 'apuestas' && (
        <div style={styles.apuestasContainer}>
          <div style={styles.apuestasTitle}>Hacé tu apuesta</div>

          {/* Apuesta por número */}
          <div style={styles.apuestaSection}>
            <div style={styles.apuestaLabel}>Número (1-36):</div>
            <div style={styles.numerosGrid}>
              {Array.from({ length: 37 }, (_, i) => (
                <button
                  key={i}
                  style={{
                    ...styles.numeroBtn,
                    background: apuestaActual?.tipo === 'numero' && apuestaActual.valor === i ? '#FF6B35' : '#1a1a1a',
                  }}
                  onClick={() => setApuestaActual({ tipo: 'numero', valor: i, fichas: 10 })}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* Apuestas por color/paridad */}
          <div style={styles.apuestaSection}>
            <div style={styles.apuestaLabel}>Color / Paridad:</div>
            <div style={styles.botonesApuesta}>
              <button
                style={{
                  ...styles.apuestaBtn,
                  background: apuestaActual?.tipo === 'rojo' ? '#c41e3a' : '#1a1a1a',
                }}
                onClick={() => setApuestaActual({ tipo: 'rojo', valor: 0, fichas: 10 })}
              >
                🔴 ROJO
              </button>
              <button
                style={{
                  ...styles.apuestaBtn,
                  background: apuestaActual?.tipo === 'negro' ? '#1a1a1a' : '#1a1a1a',
                  borderColor: apuestaActual?.tipo === 'negro' ? '#fff' : '#333',
                }}
                onClick={() => setApuestaActual({ tipo: 'negro', valor: 0, fichas: 10 })}
              >
                ⚫ NEGRO
              </button>
              <button
                style={{
                  ...styles.apuestaBtn,
                  background: apuestaActual?.tipo === 'par' ? '#FF6B35' : '#1a1a1a',
                }}
                onClick={() => setApuestaActual({ tipo: 'par', valor: 0, fichas: 10 })}
              >
                PAR
              </button>
              <button
                style={{
                  ...styles.apuestaBtn,
                  background: apuestaActual?.tipo === 'impar' ? '#FF6B35' : '#1a1a1a',
                }}
                onClick={() => setApuestaActual({ tipo: 'impar', valor: 0, fichas: 10 })}
              >
                IMPAR
              </button>
            </div>
          </div>

          {/* Cantidad de fichas */}
          {apuestaActual && (
            <div style={styles.fichasInput}>
              <div style={styles.apuestaLabel}>Fichas a apostar:</div>
              <div style={styles.fichasButtons}>
                {[10, 25, 50, 100].map(f => (
                  <button
                    key={f}
                    style={{
                      ...styles.fichaBtn,
                      background: apuestaActual.fichas === f ? '#FF6B35' : '#1a1a1a',
                    }}
                    onClick={() => setApuestaActual({ ...apuestaActual, fichas: f })}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <button
                style={styles.btnConfirmar}
                onClick={() => {
                  if (apuestaActual) {
                    hacerApuesta(apuestaActual.tipo as any, apuestaActual.valor, apuestaActual.fichas);
                    setApuestaActual(null);
                  }
                }}
              >
                Confirmar Apuesta
              </button>
            </div>
          )}
        </div>
      )}

      {/* Botones de control (solo host) */}
      {isHost && (
        <div style={styles.controlButtons}>
          {sala.estado === 'apuestas' && (
            <button style={styles.btnGirar} onClick={iniciarGiro}>
              🎰 GIRAR RULETA
            </button>
          )}
          {sala.estado === 'resultado' && (
            <button style={styles.btnResetear} onClick={resetearRonda}>
              Nueva Ronda
            </button>
          )}
        </div>
      )}

      {/* Jugadores */}
      <div style={styles.jugadoresContainer}>
        <div style={styles.jugador}>
          <span style={styles.jugadorNombre}>{sala.jugador1 || 'Jugador 1'}</span>
          {jugador === 1 && <span style={styles.tuTurno}>👈 Tú</span>}
        </div>
        {sala.jugador2 && (
          <div style={styles.jugador}>
            <span style={styles.jugadorNombre}>{sala.jugador2}</span>
            {jugador === 2 && <span style={styles.tuTurno}>👈 Tú</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  fullPage: {
    position: 'relative',
    width: '100%',
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    fontFamily: "'Courier New', monospace",
    overflow: 'auto',
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    background: '#111',
    border: '1px solid #333',
    borderRadius: 8,
    padding: '8px 16px',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    zIndex: 1000,
  },
  lobbyCard: {
    position: 'relative',
    background: '#111',
    border: '1px solid #222',
    borderRadius: 16,
    padding: '36px 28px',
    width: '90%',
    maxWidth: 360,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    zIndex: 10,
  },
  title: {
    fontSize: 48,
    fontWeight: 900,
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 8,
    textShadow: '0 0 40px #FF6B3560',
  },
  subtitle: {
    fontSize: 12,
    color: '#555',
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: -8,
    marginBottom: 8,
  },
  input: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 10,
    padding: '12px 16px',
    color: '#fff',
    fontSize: 16,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  btnPrimary: {
    background: '#FF6B35',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '14px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: 1,
  },
  btnSecondary: {
    background: '#222',
    color: '#FF6B35',
    border: '1px solid #333',
    borderRadius: 10,
    padding: '12px 20px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#333',
    fontSize: 12,
  },
  errorMsg: {
    background: '#3a1a1a',
    color: '#ff6b6b',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    textAlign: 'center',
  },
  codigoGrande: {
    fontSize: 52,
    fontWeight: 900,
    color: '#FF6B35',
    textAlign: 'center',
    letterSpacing: 16,
    textShadow: '0 0 30px #FF6B3560',
  },
  dot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#4ECDC4',
    boxShadow: '0 0 8px #4ECDC4',
  },
  header: {
    display: 'flex',
    gap: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  fichasContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  fichasLabel: {
    color: '#888',
    fontSize: 14,
  },
  fichasValor: {
    color: '#FF6B35',
    fontSize: 24,
    fontWeight: 700,
  },
  estadoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  estadoLabel: {
    color: '#888',
    fontSize: 14,
  },
  estadoValor: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: 600,
  },
  ruletaContainer: {
    position: 'relative',
    width: 400,
    height: 400,
    margin: '20px 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleta: {
    position: 'relative',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: '#0d7d0d',
    border: '10px solid #8b4513',
    boxShadow: '0 0 30px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
  },
  numeroRueda: {
    width: 35,
    height: 35,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    border: '2px solid #fff',
    textShadow: '0 0 2px rgba(0,0,0,0.8)',
  },
  puntero: {
    position: 'absolute',
    top: -10,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 0,
    height: 0,
    borderLeft: '15px solid transparent',
    borderRight: '15px solid transparent',
    borderTop: '30px solid #FF6B35',
    zIndex: 10,
  },
  resultadoContainer: {
    textAlign: 'center',
    margin: '20px 0',
  },
  resultadoNumero: {
    fontSize: 72,
    fontWeight: 900,
    color: '#FF6B35',
    textShadow: '0 0 20px #FF6B35',
  },
  resultadoColor: {
    fontSize: 24,
    fontWeight: 700,
    marginTop: 10,
  },
  apuestasContainer: {
    width: '100%',
    maxWidth: 600,
    background: '#111',
    border: '1px solid #222',
    borderRadius: 16,
    padding: '20px',
    marginTop: 20,
  },
  apuestasTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  apuestaSection: {
    marginBottom: 20,
  },
  apuestaLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 10,
  },
  numerosGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: 8,
    marginBottom: 10,
  },
  numeroBtn: {
    padding: '10px',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    background: '#1a1a1a',
  },
  botonesApuesta: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
  },
  apuestaBtn: {
    padding: '12px',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    background: '#1a1a1a',
  },
  fichasInput: {
    marginTop: 20,
    paddingTop: 20,
    borderTop: '1px solid #222',
  },
  fichasButtons: {
    display: 'flex',
    gap: 10,
    marginBottom: 15,
  },
  fichaBtn: {
    flex: 1,
    padding: '10px',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    background: '#1a1a1a',
  },
  btnConfirmar: {
    width: '100%',
    padding: '14px',
    background: '#FF6B35',
    border: 'none',
    borderRadius: 10,
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
  },
  controlButtons: {
    marginTop: 20,
  },
  btnGirar: {
    padding: '16px 32px',
    background: '#FF6B35',
    border: 'none',
    borderRadius: 10,
    color: '#fff',
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 0 20px rgba(255, 107, 53, 0.4)',
  },
  btnResetear: {
    padding: '12px 24px',
    background: '#4ECDC4',
    border: 'none',
    borderRadius: 10,
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
  },
  jugadoresContainer: {
    display: 'flex',
    gap: 20,
    marginTop: 20,
  },
  jugador: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 20px',
    background: '#111',
    border: '1px solid #222',
    borderRadius: 8,
  },
  jugadorNombre: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
  },
  tuTurno: {
    color: '#FF6B35',
    fontSize: 12,
  },
};
