/**
 * BlackJackView.tsx — Blackjack Casino Multijugador
 * 1 a 4 jugadores, el host es la banca
 * Supabase Realtime — funciona en redes distintas
 */
import React, { useState, useEffect } from 'react';

// ─── Config Supabase ─────────────────────────────────────────────────────────
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qhnmxvexkizcsmivfuam.supabase.co';
const SUPA_KEY = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFobm14dmV4a2l6Y3NtaXZmdWFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTIyMTI4MSwiZXhwIjoyMDg2Nzk3MjgxfQ.b2N86NyMG4F3CXcgTnzOjqx7AZPyDTa4QFFCtOSK42s';

const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPA_KEY,
  'Authorization': `Bearer ${SUPA_KEY}`,
  'Prefer': 'return=representation',
};

// ─── Constantes ────────────────────────────────────────────────────────────
const FICHAS_INICIALES = 1000;
const PALOS = ['♠', '♥', '♦', '♣'];
const VALORES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Carta {
  palo: string;
  valor: string;
  visible: boolean;
}

interface Mano {
  cartas: Carta[];
  apuesta: number;
  terminado: boolean;
  resultado?: 'gana' | 'pierde' | 'empate' | 'blackjack';
}

interface Jugador {
  nombre: string;
  fichas: number;
  mano: Mano | null;
}

interface EstadoSala {
  jugadores: Record<string, Jugador>;
  banca: {
    cartas: Carta[];
    terminado: boolean;
  };
  mazo: Carta[];
  estado: 'esperando' | 'apostando' | 'jugando' | 'banca' | 'resultado';
  turnoActual?: string;
  ronda: number;
}

interface Sala {
  id: string;
  estado_json: EstadoSala;
  host: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function genCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function crearMazo(): Carta[] {
  const mazo: Carta[] = [];
  for (const palo of PALOS) {
    for (const valor of VALORES) {
      mazo.push({ palo, valor, visible: true });
    }
  }
  // Barajar
  for (let i = mazo.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mazo[i], mazo[j]] = [mazo[j], mazo[i]];
  }
  return mazo;
}

function valorCarta(carta: Carta): number {
  if (carta.valor === 'A') return 11;
  if (['J', 'Q', 'K'].includes(carta.valor)) return 10;
  return parseInt(carta.valor);
}

function calcularPuntos(mano: Carta[]): number {
  let puntos = 0;
  let ases = 0;
  
  for (const carta of mano) {
    if (carta.valor === 'A') {
      ases++;
      puntos += 11;
    } else {
      puntos += valorCarta(carta);
    }
  }
  
  // Ajustar ases si se pasa de 21
  while (puntos > 21 && ases > 0) {
    puntos -= 10;
    ases--;
  }
  
  return puntos;
}

function esBlackjack(mano: Carta[]): boolean {
  return mano.length === 2 && calcularPuntos(mano) === 21;
}

async function getSala(id: string): Promise<Sala | null> {
  const r = await fetch(`${SUPA_URL}/rest/v1/blackjack_salas?id=eq.${id}`, { headers: HEADERS });
  const d = await r.json();
  return d[0] || null;
}

async function patchSala(id: string, data: Partial<Sala>) {
  await fetch(`${SUPA_URL}/rest/v1/blackjack_salas?id=eq.${id}`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify(data),
  });
}

async function crearSala(id: string, nombre: string): Promise<void> {
  const estadoInicial: EstadoSala = {
    jugadores: {
      [nombre]: {
        nombre,
        fichas: FICHAS_INICIALES,
        mano: null,
      },
    },
    banca: {
      cartas: [],
      terminado: false,
    },
    mazo: [],
    estado: 'esperando',
    ronda: 0,
  };

  await fetch(`${SUPA_URL}/rest/v1/blackjack_salas`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      id,
      host: nombre,
      estado_json: estadoInicial,
    }),
  });
}

async function unirSala(id: string, nombre: string): Promise<boolean> {
  const sala = await getSala(id);
  if (!sala) return false;

  const estado = sala.estado_json;
  if (estado.jugadores[nombre]) return false;
  if (Object.keys(estado.jugadores).length >= 4) return false; // Máximo 4 jugadores

  estado.jugadores[nombre] = {
    nombre,
    fichas: FICHAS_INICIALES,
    mano: null,
  };

  await patchSala(id, { estado_json: estado });
  return true;
}

// ─── Componente principal ────────────────────────────────────────────────────
export function BlackJackView() {
  const [fase, setFase] = useState<'lobby' | 'sala'>('lobby');
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoInput, setCodigoInput] = useState('');
  const [sala, setSala] = useState<Sala | null>(null);
  const [error, setError] = useState('');
  const [esHost, setEsHost] = useState(false);

  const handleCrear = async () => {
    if (!nombre.trim()) { setError('Ingresá tu nombre'); return; }
    const code = genCode();
    await crearSala(code, nombre.trim());
    setCodigo(code);
    setEsHost(true);
    setFase('sala');
  };

  const handleUnirse = async () => {
    if (!nombre.trim()) { setError('Ingresá tu nombre'); return; }
    if (!codigoInput.trim()) { setError('Ingresá el código'); return; }
    const ok = await unirSala(codigoInput.toUpperCase(), nombre.trim());
    if (!ok) { setError('Sala no encontrada o llena'); return; }
    setCodigo(codigoInput.toUpperCase());
    setEsHost(false);
    setFase('sala');
  };

  useEffect(() => {
    if (fase !== 'sala' || !codigo) return;
    const iv = setInterval(async () => {
      const s = await getSala(codigo);
      if (s) setSala(s);
    }, 1000);
    return () => clearInterval(iv);
  }, [fase, codigo]);

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
      />
    );
  }

  if (fase === 'sala' && sala) {
    return (
      <MesaBlackjack
        codigo={codigo}
        nombre={nombre}
        sala={sala}
        esHost={esHost}
        onActualizarSala={setSala}
      />
    );
  }

  return <div style={styles.fullPage}>Cargando...</div>;
}

// ─── Lobby ───────────────────────────────────────────────────────────────────
function Lobby({ nombre, setNombre, codigoInput, setCodigoInput, error, setError, onCrear, onUnirse }: any) {
  return (
    <div style={styles.fullPage}>
      <div style={styles.casinoBg} />
      <div style={styles.lobbyCard}>
        <div style={styles.title}>🃏 BLACKJACK</div>
        <div style={styles.subtitle}>Casino Multijugador (1-4 jugadores)</div>

        <input
          style={styles.input}
          placeholder="Tu nombre"
          value={nombre}
          onChange={e => { setNombre(e.target.value); setError(''); }}
          maxLength={12}
        />

        <button style={styles.btnPrimary} onClick={onCrear}>
          🎲 Crear sala (eres la banca)
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

// ─── Mesa de Blackjack ───────────────────────────────────────────────────────
function MesaBlackjack({ codigo, nombre, sala, esHost, onActualizarSala }: {
  codigo: string;
  nombre: string;
  sala: Sala;
  esHost: boolean;
  onActualizarSala: (s: Sala) => void;
}) {
  const estado = sala.estado_json;
  const jugador = estado.jugadores[nombre];
  const [apuestaInput, setApuestaInput] = useState(10);
  const [error, setError] = useState('');

  const jugadoresLista = Object.values(estado.jugadores).filter(j => j.nombre !== sala.host);
  const todosApostaron = estado.estado === 'apostando' && jugadoresLista.every(j => j.mano && j.mano.apuesta > 0);
  const todosTerminaron = estado.estado === 'jugando' && jugadoresLista.every(j => j.mano && j.mano.terminado);

  // ── Apostar ────────────────────────────────────────────────────────────────
  const handleApostar = async () => {
    if (apuestaInput > jugador.fichas) {
      setError('No tenés suficientes fichas');
      return;
    }
    if (apuestaInput <= 0) {
      setError('La apuesta debe ser mayor a 0');
      return;
    }

    const nuevoEstado = { ...estado };
    nuevoEstado.jugadores[nombre].mano = {
      cartas: [],
      apuesta: apuestaInput,
      terminado: false,
    };
    nuevoEstado.jugadores[nombre].fichas -= apuestaInput;

    await patchSala(codigo, { estado_json: nuevoEstado });
    onActualizarSala({ ...sala, estado_json: nuevoEstado });
    setError('');
  };

  // ── Iniciar ronda (host) ───────────────────────────────────────────────────
  const handleIniciarRonda = async () => {
    if (!todosApostaron) return;

    const nuevoEstado = { ...estado };
    nuevoEstado.mazo = crearMazo();
    nuevoEstado.ronda++;
    nuevoEstado.estado = 'jugando';

    // Repartir 2 cartas a cada jugador
    for (const jug of jugadoresLista) {
      if (jug.mano) {
        jug.mano.cartas = [
          nuevoEstado.mazo.pop()!,
          nuevoEstado.mazo.pop()!,
        ];
      }
    }

    // Repartir 2 cartas a la banca (una boca abajo)
    const carta1 = nuevoEstado.mazo.pop()!;
    const carta2 = nuevoEstado.mazo.pop()!;
    carta2.visible = false;
    nuevoEstado.banca.cartas = [carta1, carta2];

    // Primer turno
    nuevoEstado.turnoActual = jugadoresLista[0]?.nombre;

    await patchSala(codigo, { estado_json: nuevoEstado });
    onActualizarSala({ ...sala, estado_json: nuevoEstado });
  };

  // ── Acción jugador ─────────────────────────────────────────────────────────
  const handleAccion = async (accion: 'pedir' | 'plantarse' | 'doblar') => {
    if (estado.turnoActual !== nombre) return;
    if (!jugador.mano) return;

    const nuevoEstado = { ...estado };
    const mano = nuevoEstado.jugadores[nombre].mano!;

    if (accion === 'pedir') {
      mano.cartas.push(nuevoEstado.mazo.pop()!);
      const puntos = calcularPuntos(mano.cartas);
      if (puntos >= 21) {
        mano.terminado = true;
      }
    } else if (accion === 'plantarse') {
      mano.terminado = true;
    } else if (accion === 'doblar') {
      if (jugador.fichas < mano.apuesta) {
        setError('No tenés suficientes fichas para doblar');
        return;
      }
      nuevoEstado.jugadores[nombre].fichas -= mano.apuesta;
      mano.apuesta *= 2;
      mano.cartas.push(nuevoEstado.mazo.pop()!);
      mano.terminado = true;
    }

    // Siguiente turno
    if (mano.terminado) {
      const jugadoresActivos = jugadoresLista.filter(j => j.mano && !j.mano.terminado);
      if (jugadoresActivos.length > 0) {
        nuevoEstado.turnoActual = jugadoresActivos[0].nombre;
      } else {
        nuevoEstado.estado = 'banca';
        nuevoEstado.turnoActual = undefined;
      }
    }

    await patchSala(codigo, { estado_json: nuevoEstado });
    onActualizarSala({ ...sala, estado_json: nuevoEstado });
    setError('');
  };

  // ── Acción banca (host) ────────────────────────────────────────────────────
  const handleBancaAccion = async (accion: 'pedir' | 'plantarse') => {
    if (!esHost || estado.estado !== 'banca') return;

    const nuevoEstado = { ...estado };
    const banca = nuevoEstado.banca;

    // Revelar carta oculta
    if (banca.cartas.some(c => !c.visible)) {
      banca.cartas.forEach(c => c.visible = true);
    }

    if (accion === 'pedir') {
      banca.cartas.push(nuevoEstado.mazo.pop()!);
      const puntos = calcularPuntos(banca.cartas);
      if (puntos >= 17) {
        banca.terminado = true;
      }
    } else {
      banca.terminado = true;
    }

    if (banca.terminado) {
      nuevoEstado.estado = 'resultado';
      // Calcular resultados
      const puntosBanca = calcularPuntos(banca.cartas);
      const esBlackjackBanca = esBlackjack(banca.cartas);

      for (const jug of jugadoresLista) {
        if (!jug.mano) continue;
        const puntosJugador = calcularPuntos(jug.mano.cartas);
        const esBlackjackJugador = esBlackjack(jug.mano.cartas);

        if (puntosJugador > 21) {
          jug.mano.resultado = 'pierde';
        } else if (puntosBanca > 21) {
          jug.mano.resultado = esBlackjackJugador ? 'blackjack' : 'gana';
        } else if (esBlackjackJugador && !esBlackjackBanca) {
          jug.mano.resultado = 'blackjack';
        } else if (esBlackjackBanca && !esBlackjackJugador) {
          jug.mano.resultado = 'pierde';
        } else if (puntosJugador > puntosBanca) {
          jug.mano.resultado = esBlackjackJugador ? 'blackjack' : 'gana';
        } else if (puntosJugador < puntosBanca) {
          jug.mano.resultado = 'pierde';
        } else {
          jug.mano.resultado = 'empate';
        }

        // Pagar o cobrar
        if (jug.mano.resultado === 'blackjack') {
          nuevoEstado.jugadores[jug.nombre].fichas += jug.mano.apuesta * 3;
        } else if (jug.mano.resultado === 'gana') {
          nuevoEstado.jugadores[jug.nombre].fichas += jug.mano.apuesta * 2;
        } else if (jug.mano.resultado === 'empate') {
          nuevoEstado.jugadores[jug.nombre].fichas += jug.mano.apuesta;
        }
      }
    }

    await patchSala(codigo, { estado_json: nuevoEstado });
    onActualizarSala({ ...sala, estado_json: nuevoEstado });
  };

  // ── Nueva ronda (host) ─────────────────────────────────────────────────────
  const handleNuevaRonda = async () => {
    const nuevoEstado: EstadoSala = {
      jugadores: Object.fromEntries(
        Object.entries(estado.jugadores).map(([nombreJugador, jug]) => [
          nombreJugador,
          { ...jug, mano: null },
        ])
      ),
      banca: {
        cartas: [],
        terminado: false,
      },
      mazo: [],
      estado: 'apostando',
      ronda: estado.ronda,
    };

    await patchSala(codigo, { estado_json: nuevoEstado });
    onActualizarSala({ ...sala, estado_json: nuevoEstado });
  };

  return (
    <div style={styles.fullPage}>
      <div style={styles.casinoBg} />
      
      <div style={styles.mesaContainer}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.codigoDisplay}>Sala: {codigo}</div>
          <div style={styles.fichasDisplay}>
            💰 {jugador.fichas} fichas
          </div>
        </div>

        {/* Banca (arriba) */}
        {estado.estado !== 'esperando' && (
          <div style={styles.bancaContainer}>
            <div style={styles.bancaLabel}>BANCA {esHost && '(Tú)'}</div>
            <div style={styles.cartasContainer}>
              {estado.banca.cartas.map((carta, idx) => (
                <CartaComponent key={idx} carta={carta} />
              ))}
            </div>
            {estado.estado === 'banca' && esHost && !estado.banca.terminado && (
              <div style={styles.accionesContainer}>
                <button style={styles.btnAccion} onClick={() => handleBancaAccion('pedir')}>
                  Pedir
                </button>
                <button style={styles.btnAccion} onClick={() => handleBancaAccion('plantarse')}>
                  Plantarse
                </button>
              </div>
            )}
            {estado.banca.cartas.length > 0 && estado.banca.cartas.every(c => c.visible) && (
              <div style={styles.puntosDisplay}>
                {calcularPuntos(estado.banca.cartas)} puntos
              </div>
            )}
          </div>
        )}

        {/* Jugadores (abajo) */}
        <div style={styles.jugadoresGrid}>
          {jugadoresLista.map((jug) => {
            const esMiTurno = estado.turnoActual === jug.nombre;
            const esYo = jug.nombre === nombre;
            return (
              <div
                key={jug.nombre}
                style={{
                  ...styles.jugadorCard,
                  border: esMiTurno ? '3px solid #d4af37' : '1px solid #333',
                }}
              >
                <div style={styles.jugadorNombre}>
                  {jug.nombre} {esYo && '(Tú)'}
                  {esMiTurno && ' ⭐'}
                </div>
                <div style={styles.fichasJugador}>💰 {jug.fichas}</div>
                {jug.mano && (
                  <>
                    <div style={styles.cartasContainer}>
                      {jug.mano.cartas.map((carta, idx) => (
                        <CartaComponent key={idx} carta={carta} />
                      ))}
                    </div>
                    {jug.mano.cartas.length > 0 && (
                      <div style={styles.puntosDisplay}>
                        {calcularPuntos(jug.mano.cartas)} puntos
                      </div>
                    )}
                    {jug.mano.apuesta > 0 && (
                      <div style={styles.apuestaDisplay}>
                        Apuesta: {jug.mano.apuesta}
                      </div>
                    )}
                    {jug.mano.resultado && (
                      <div style={{
                        ...styles.resultadoDisplay,
                        color: jug.mano.resultado === 'gana' || jug.mano.resultado === 'blackjack' ? '#4ECDC4' : 
                               jug.mano.resultado === 'pierde' ? '#ff6b6b' : '#888',
                      }}>
                        {jug.mano.resultado === 'blackjack' && 'BLACKJACK! 🎉'}
                        {jug.mano.resultado === 'gana' && 'GANA'}
                        {jug.mano.resultado === 'pierde' && 'PIERDE'}
                        {jug.mano.resultado === 'empate' && 'EMPATE'}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Acciones del jugador */}
        {estado.estado === 'apostando' && !jugador.mano && (
          <div style={styles.apostarContainer}>
            <div style={styles.apostarTitle}>Elegí tu apuesta</div>
            <div style={styles.montoButtons}>
              {[10, 25, 50, 100].map(m => (
                <button
                  key={m}
                  style={{
                    ...styles.btnMonto,
                    background: apuestaInput === m ? '#d4af37' : '#1a1a1a',
                  }}
                  onClick={() => setApuestaInput(m)}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              type="number"
              style={styles.inputMonto}
              value={apuestaInput}
              onChange={e => setApuestaInput(Number(e.target.value) || 0)}
              min={1}
              max={jugador.fichas}
            />
            <button style={styles.btnApostar} onClick={handleApostar}>
              Apostar {apuestaInput} fichas
            </button>
            {error && <div style={styles.errorMsg}>{error}</div>}
          </div>
        )}

        {estado.estado === 'jugando' && estado.turnoActual === nombre && jugador.mano && !jugador.mano.terminado && (
          <div style={styles.accionesContainer}>
            <button style={styles.btnAccion} onClick={() => handleAccion('pedir')}>
              Pedir
            </button>
            <button style={styles.btnAccion} onClick={() => handleAccion('plantarse')}>
              Plantarse
            </button>
            {jugador.mano.cartas.length === 2 && jugador.fichas >= jugador.mano.apuesta && (
              <button style={styles.btnAccion} onClick={() => handleAccion('doblar')}>
                Doblar
              </button>
            )}
            {error && <div style={styles.errorMsg}>{error}</div>}
          </div>
        )}

        {/* Control host */}
        {estado.estado === 'esperando' && esHost && (
          <div style={styles.controlContainer}>
            <button
              style={{
                ...styles.btnGirar,
                opacity: jugadoresLista.length >= 1 ? 1 : 0.5,
              }}
              onClick={handleIniciarRonda}
              disabled={jugadoresLista.length < 1}
            >
              Iniciar Ronda
            </button>
          </div>
        )}

        {estado.estado === 'apostando' && esHost && todosApostaron && (
          <div style={styles.controlContainer}>
            <button style={styles.btnGirar} onClick={handleIniciarRonda}>
              Repartir Cartas
            </button>
          </div>
        )}

        {estado.estado === 'resultado' && esHost && (
          <div style={styles.controlContainer}>
            <button style={styles.btnNuevaRonda} onClick={handleNuevaRonda}>
              Nueva Ronda
            </button>
          </div>
        )}

        {/* Lista de jugadores */}
        <div style={styles.jugadoresLista}>
          <div style={styles.jugadoresTitle}>Jugadores ({Object.keys(estado.jugadores).length}/4):</div>
          {Object.values(estado.jugadores).map((jug, idx) => (
            <div key={idx} style={styles.jugadorItem}>
              <span style={{ fontWeight: jug.nombre === nombre ? 700 : 400 }}>
                {jug.nombre} {jug.nombre === sala.host && '(Banca)'} {jug.nombre === nombre && '(Tú)'}
              </span>
              <span style={{ color: '#d4af37' }}>💰 {jug.fichas}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Componente Carta ───────────────────────────────────────────────────────
function CartaComponent({ carta }: { carta: Carta }) {
  const esRoja = carta.palo === '♥' || carta.palo === '♦';
  
  if (!carta.visible) {
    return (
      <div style={styles.cartaOculta}>
        🂠
      </div>
    );
  }

  return (
    <div style={{
      ...styles.carta,
      color: esRoja ? '#ff0000' : '#000',
    }}>
      <div style={styles.cartaValor}>{carta.valor}</div>
      <div style={styles.cartaPalo}>{carta.palo}</div>
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
    fontFamily: "'Courier New', monospace",
    overflow: 'auto',
    userSelect: 'none',
  },
  casinoBg: {
    position: 'fixed',
    inset: 0,
    background: 'radial-gradient(circle at 50% 50%, #1a0a0a 0%, #0a0a0a 100%)',
    opacity: 0.3,
    zIndex: 0,
  },
  lobbyCard: {
    position: 'relative',
    background: 'linear-gradient(135deg, #1a0a0a 0%, #0a0a0a 100%)',
    border: '2px solid #d4af37',
    borderRadius: 16,
    padding: '36px 28px',
    width: '90%',
    maxWidth: 360,
    margin: '50px auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    zIndex: 10,
    boxShadow: '0 0 30px rgba(212, 175, 55, 0.3)',
  },
  title: {
    fontSize: 48,
    fontWeight: 900,
    color: '#d4af37',
    textAlign: 'center',
    letterSpacing: 8,
    textShadow: '0 0 20px rgba(212, 175, 55, 0.8)',
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: -8,
    marginBottom: 8,
  },
  input: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 10,
    padding: '12px 16px',
    color: '#fff',
    fontSize: 16,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #d4af37 0%, #b8941f 100%)',
    color: '#000',
    border: 'none',
    borderRadius: 10,
    padding: '14px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: 1,
    boxShadow: '0 4px 15px rgba(212, 175, 55, 0.4)',
  },
  btnSecondary: {
    background: '#1a1a1a',
    color: '#d4af37',
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
    textAlign: 'center',
  },
  errorMsg: {
    background: '#3a1a1a',
    color: '#ff6b6b',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    textAlign: 'center',
  },
  mesaContainer: {
    position: 'relative',
    width: '100%',
    maxWidth: 900,
    margin: '0 auto',
    padding: '20px',
    zIndex: 1,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #1a0a0a 0%, #0a0a0a 100%)',
    border: '1px solid #d4af37',
    borderRadius: 10,
  },
  codigoDisplay: {
    fontSize: 18,
    fontWeight: 700,
    color: '#d4af37',
    letterSpacing: 4,
  },
  fichasDisplay: {
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
  },
  bancaContainer: {
    background: 'linear-gradient(135deg, #1a0a0a 0%, #0a0a0a 100%)',
    border: '2px solid #d4af37',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  bancaLabel: {
    fontSize: 20,
    fontWeight: 700,
    color: '#d4af37',
    marginBottom: 12,
  },
  cartasContainer: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  carta: {
    width: 60,
    height: 84,
    background: '#fff',
    border: '2px solid #333',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    fontWeight: 700,
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  cartaOculta: {
    width: 60,
    height: 84,
    background: '#1a3a5a',
    border: '2px solid #333',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 40,
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  cartaValor: {
    fontSize: 18,
    fontWeight: 900,
  },
  cartaPalo: {
    fontSize: 28,
  },
  puntosDisplay: {
    fontSize: 18,
    fontWeight: 700,
    color: '#d4af37',
    marginTop: 8,
  },
  jugadoresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
    marginBottom: 20,
  },
  jugadorCard: {
    background: 'linear-gradient(135deg, #1a0a0a 0%, #0a0a0a 100%)',
    border: '1px solid #333',
    borderRadius: 12,
    padding: 16,
    textAlign: 'center',
  },
  jugadorNombre: {
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 8,
  },
  fichasJugador: {
    fontSize: 14,
    color: '#d4af37',
    marginBottom: 12,
  },
  apuestaDisplay: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
  },
  resultadoDisplay: {
    fontSize: 16,
    fontWeight: 700,
    marginTop: 8,
  },
  apostarContainer: {
    background: 'linear-gradient(135deg, #1a0a0a 0%, #0a0a0a 100%)',
    border: '2px solid #d4af37',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  apostarTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#d4af37',
    marginBottom: 12,
  },
  montoButtons: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },
  btnMonto: {
    flex: 1,
    padding: '10px',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  inputMonto: {
    width: '100%',
    padding: '12px',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 16,
    outline: 'none',
    marginBottom: 12,
    boxSizing: 'border-box' as const,
  },
  btnApostar: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #d4af37 0%, #b8941f 100%)',
    border: 'none',
    borderRadius: 10,
    color: '#000',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
  },
  accionesContainer: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  btnAccion: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #d4af37 0%, #b8941f 100%)',
    border: 'none',
    borderRadius: 8,
    color: '#000',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
  },
  controlContainer: {
    textAlign: 'center',
    marginBottom: 20,
  },
  btnGirar: {
    padding: '16px 32px',
    background: 'linear-gradient(135deg, #d4af37 0%, #b8941f 100%)',
    border: 'none',
    borderRadius: 12,
    color: '#000',
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(212, 175, 55, 0.4)',
  },
  btnNuevaRonda: {
    padding: '14px 28px',
    background: '#1a1a1a',
    border: '2px solid #d4af37',
    borderRadius: 10,
    color: '#d4af37',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
  },
  jugadoresLista: {
    background: 'linear-gradient(135deg, #1a0a0a 0%, #0a0a0a 100%)',
    border: '1px solid #333',
    borderRadius: 12,
    padding: '16px',
  },
  jugadoresTitle: {
    color: '#d4af37',
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 12,
  },
  jugadorItem: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
};

export default BlackJackView;
