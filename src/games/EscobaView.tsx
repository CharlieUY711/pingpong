/**
 * EscobaView.tsx — Escoba del 15 Multijugador
 * Supabase Realtime — funciona en redes distintas
 * Optimizado para celular portrait
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
type Palo = 'espadas' | 'bastos' | 'copas' | 'oros';
type Valor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10; // As=1, Sota=8, Caballo=9, Rey=10

interface Carta {
  palo: Palo;
  valor: Valor;
  id: string; // único para identificar
}

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Jugador {
  nombre: string;
  mano: Carta[];
  cartasLevantadas: Carta[];
  escobas: number;
  puntosRonda: number;
}

interface ConfigSala {
  numJugadores: 2 | 4;
  puntosPartido: 15 | 21;
}

interface EstadoJuego {
  jugadores: Record<string, Jugador>;
  mesa: Carta[];
  mazo: Carta[];
  turno: string; // nombre del jugador
  ronda: number;
  puntosPartido: Record<string, number>; // puntos totales del partido
  estado: 'configurando' | 'esperando' | 'jugando' | 'conteo' | 'partidoTerminado';
  config: ConfigSala;
  ultimoQueLevanto?: string;
  cartasEnMano: number; // cuántas cartas tiene cada jugador actualmente
}

interface Sala {
  id: string;
  estado_json: EstadoJuego;
  host: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function genCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function crearMazo(): Carta[] {
  const mazo: Carta[] = [];
  const palos: Palo[] = ['espadas', 'bastos', 'copas', 'oros'];
  const valores: Valor[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  
  palos.forEach(palo => {
    valores.forEach(valor => {
      mazo.push({ palo, valor, id: `${palo}-${valor}-${Math.random()}` });
    });
  });
  
  // Mezclar
  for (let i = mazo.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mazo[i], mazo[j]] = [mazo[j], mazo[i]];
  }
  
  return mazo;
}

function valorCarta(carta: Carta): number {
  if (carta.valor === 8) return 8; // Sota
  if (carta.valor === 9) return 9; // Caballo
  if (carta.valor === 10) return 10; // Rey
  return carta.valor; // As=1, resto nominal
}

function encontrarCombinaciones(cartaJugada: Carta, mesa: Carta[]): Carta[][] {
  const combinaciones: Carta[][] = [];
  const valorObjetivo = valorCarta(cartaJugada);
  const objetivo = 15 - valorObjetivo;
  
  if (objetivo <= 0) return [];
  
  // Buscar todas las combinaciones que sumen objetivo
  function buscarCombinaciones(restantes: Carta[], actual: Carta[], suma: number) {
    if (suma === objetivo && actual.length > 0) {
      combinaciones.push([...actual]);
      return;
    }
    if (suma > objetivo || restantes.length === 0) return;
    
    for (let i = 0; i < restantes.length; i++) {
      buscarCombinaciones(
        restantes.slice(i + 1),
        [...actual, restantes[i]],
        suma + valorCarta(restantes[i])
      );
    }
  }
  
  buscarCombinaciones(mesa, [], 0);
  return combinaciones;
}

function calcularPuntosRonda(jugadores: Record<string, Jugador>): Record<string, number> {
  const puntos: Record<string, number> = {};
  
  Object.keys(jugadores).forEach(nombre => {
    puntos[nombre] = 0;
  });
  
  // 1. Escobas
  Object.entries(jugadores).forEach(([nombre, jug]) => {
    puntos[nombre] += jug.escobas;
  });
  
  // 2. Más cartas
  const cartasPorJugador = Object.entries(jugadores).map(([nombre, jug]) => ({
    nombre,
    cantidad: jug.cartasLevantadas.length,
  }));
  cartasPorJugador.sort((a, b) => b.cantidad - a.cantidad);
  if (cartasPorJugador[0].cantidad > cartasPorJugador[1]?.cantidad) {
    puntos[cartasPorJugador[0].nombre]++;
  }
  
  // 3. Más oros
  const orosPorJugador = Object.entries(jugadores).map(([nombre, jug]) => ({
    nombre,
    cantidad: jug.cartasLevantadas.filter(c => c.palo === 'oros').length,
  }));
  orosPorJugador.sort((a, b) => b.cantidad - a.cantidad);
  if (orosPorJugador[0].cantidad > orosPorJugador[1]?.cantidad) {
    puntos[orosPorJugador[0].nombre]++;
  }
  
  // 4. 7 de oros
  Object.entries(jugadores).forEach(([nombre, jug]) => {
    if (jug.cartasLevantadas.some(c => c.palo === 'oros' && c.valor === 7)) {
      puntos[nombre]++;
    }
  });
  
  // 5. Mejor Setenta (una carta de cada palo, sumando valores, el 7 vale más)
  const setentas: Array<{ nombre: string; suma: number }> = [];
  Object.entries(jugadores).forEach(([nombre, jug]) => {
    const cartas = jug.cartasLevantadas;
    const tieneEspadas = cartas.some(c => c.palo === 'espadas');
    const tieneBastos = cartas.some(c => c.palo === 'bastos');
    const tieneCopas = cartas.some(c => c.palo === 'copas');
    const tieneOros = cartas.some(c => c.palo === 'oros');
    
    if (tieneEspadas && tieneBastos && tieneCopas && tieneOros) {
      let suma = 0;
      [tieneEspadas, tieneBastos, tieneCopas, tieneOros].forEach((tiene, idx) => {
        const palo: Palo[] = ['espadas', 'bastos', 'copas', 'oros'];
        const carta = cartas.find(c => c.palo === palo[idx]);
        if (carta) {
          // El 7 vale más (suma 7 + 7 = 14)
          suma += carta.valor === 7 ? 14 : valorCarta(carta);
        }
      });
      setentas.push({ nombre, suma });
    }
  });
  
  if (setentas.length > 0) {
    setentas.sort((a, b) => b.suma - a.suma);
    if (setentas[0].suma > setentas[1]?.suma) {
      puntos[setentas[0].nombre]++;
    }
  }
  
  return puntos;
}

async function getSala(id: string): Promise<Sala | null> {
  const r = await fetch(`${SUPA_URL}/rest/v1/escoba_salas?id=eq.${id}`, { headers: HEADERS });
  const d = await r.json();
  return d[0] || null;
}

async function patchSala(id: string, data: Partial<Sala>) {
  await fetch(`${SUPA_URL}/rest/v1/escoba_salas?id=eq.${id}`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify(data),
  });
}

async function crearSala(id: string, nombre: string): Promise<void> {
  const estadoInicial: EstadoJuego = {
    jugadores: {
      [nombre]: {
        nombre,
        mano: [],
        cartasLevantadas: [],
        escobas: 0,
        puntosRonda: 0,
      },
    },
    mesa: [],
    mazo: [],
    turno: nombre,
    ronda: 0,
    puntosPartido: { [nombre]: 0 },
    estado: 'configurando',
    config: { numJugadores: 2, puntosPartido: 15 },
    cartasEnMano: 0,
  };

  await fetch(`${SUPA_URL}/rest/v1/escoba_salas`, {
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
  if (estado.jugadores[nombre]) return false; // Ya está en la sala
  
  const numJugadores = Object.keys(estado.jugadores).length;
  if (estado.config.numJugadores === 2 && numJugadores >= 2) return false;
  if (estado.config.numJugadores === 4 && numJugadores >= 4) return false;

  estado.jugadores[nombre] = {
    nombre,
    mano: [],
    cartasLevantadas: [],
    escobas: 0,
    puntosRonda: 0,
  };
  estado.puntosPartido[nombre] = 0;

  await patchSala(id, { estado_json: estado });
  return true;
}

// ─── Componente principal ────────────────────────────────────────────────────
export function EscobaView() {
  const [fase, setFase] = useState<'lobby' | 'config' | 'sala' | 'juego'>('lobby');
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoInput, setCodigoInput] = useState('');
  const [sala, setSala] = useState<Sala | null>(null);
  const [error, setError] = useState('');
  const [esHost, setEsHost] = useState(false);

  // ── Crear sala ──────────────────────────────────────────────────────────────
  const handleCrear = async () => {
    if (!nombre.trim()) { setError('Ingresá tu nombre'); return; }
    const code = genCode();
    await crearSala(code, nombre.trim());
    setCodigo(code);
    setEsHost(true);
    setFase('config');
  };

  // ── Unirse ──────────────────────────────────────────────────────────────────
  const handleUnirse = async () => {
    if (!nombre.trim()) { setError('Ingresá tu nombre'); return; }
    if (!codigoInput.trim()) { setError('Ingresá el código'); return; }
    const ok = await unirSala(codigoInput.toUpperCase(), nombre.trim());
    if (!ok) { setError('Sala no encontrada o llena'); return; }
    setCodigo(codigoInput.toUpperCase());
    setEsHost(false);
    setFase('sala');
  };

  // ── Polling de sala ─────────────────────────────────────────────────────────
  useEffect(() => {
    if ((fase !== 'sala' && fase !== 'config' && fase !== 'juego') || !codigo) return;
    const iv = setInterval(async () => {
      const s = await getSala(codigo);
      if (s) {
        setSala(s);
        if (s.estado_json.estado === 'jugando' && fase !== 'juego') {
          setFase('juego');
        }
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [fase, codigo]);

  // ── Render fases ────────────────────────────────────────────────────────────
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

  if (fase === 'config' && sala && esHost) {
    return (
      <ConfigSala
        codigo={codigo}
        nombre={nombre}
        sala={sala}
        onActualizarSala={setSala}
      />
    );
  }

  if (fase === 'sala' && sala) {
    return (
      <SalaEspera
        codigo={codigo}
        nombre={nombre}
        sala={sala}
        esHost={esHost}
      />
    );
  }

  if (fase === 'juego' && sala) {
    return (
      <Juego
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
      <div style={styles.lobbyCard}>
        <div style={styles.title}>🃏 ESCOBA DEL 15</div>
        <div style={styles.subtitle}>Juego de Cartas Multijugador</div>

        <input
          style={styles.input}
          placeholder="Tu nombre"
          value={nombre}
          onChange={e => { setNombre(e.target.value); setError(''); }}
          maxLength={12}
        />

        <button style={styles.btnPrimary} onClick={onCrear}>
          🎲 Crear sala
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

// ─── Config Sala ────────────────────────────────────────────────────────────
function ConfigSala({ codigo, nombre, sala, onActualizarSala }: {
  codigo: string;
  nombre: string;
  sala: Sala;
  onActualizarSala: (s: Sala) => void;
}) {
  const estado = sala.estado_json;
  const [numJugadores, setNumJugadores] = useState<2 | 4>(estado.config.numJugadores);
  const [puntosPartido, setPuntosPartido] = useState<15 | 21>(estado.config.puntosPartido);

  const handleIniciar = async () => {
    const nuevoEstado = { ...estado };
    nuevoEstado.config = { numJugadores, puntosPartido };
    nuevoEstado.estado = 'esperando';
    
    await patchSala(codigo, { estado_json: nuevoEstado });
    onActualizarSala({ ...sala, estado_json: nuevoEstado });
  };

  return (
    <div style={styles.fullPage}>
      <div style={styles.lobbyCard}>
        <div style={styles.title}>⚙️ CONFIGURAR</div>
        <div style={styles.codigoDisplay}>Sala: {codigo}</div>

        <div style={styles.configSection}>
          <div style={styles.configLabel}>Jugadores:</div>
          <div style={styles.configButtons}>
            <button
              style={{
                ...styles.btnConfig,
                background: numJugadores === 2 ? '#FF6B35' : '#1a1a1a',
              }}
              onClick={() => setNumJugadores(2)}
            >
              2 (Mano a mano)
            </button>
            <button
              style={{
                ...styles.btnConfig,
                background: numJugadores === 4 ? '#FF6B35' : '#1a1a1a',
              }}
              onClick={() => setNumJugadores(4)}
            >
              4 (Parejas)
            </button>
          </div>
        </div>

        <div style={styles.configSection}>
          <div style={styles.configLabel}>Puntos del partido:</div>
          <div style={styles.configButtons}>
            <button
              style={{
                ...styles.btnConfig,
                background: puntosPartido === 15 ? '#FF6B35' : '#1a1a1a',
              }}
              onClick={() => setPuntosPartido(15)}
            >
              15 puntos
            </button>
            <button
              style={{
                ...styles.btnConfig,
                background: puntosPartido === 21 ? '#FF6B35' : '#1a1a1a',
              }}
              onClick={() => setPuntosPartido(21)}
            >
              21 puntos
            </button>
          </div>
        </div>

        <button style={styles.btnPrimary} onClick={handleIniciar}>
          ▶️ Iniciar partida
        </button>
      </div>
    </div>
  );
}

// ─── Sala de Espera ─────────────────────────────────────────────────────────
function SalaEspera({ codigo, nombre, sala, esHost }: {
  codigo: string;
  nombre: string;
  sala: Sala;
  esHost: boolean;
}) {
  const estado = sala.estado_json;
  const jugadores = Object.values(estado.jugadores);
  const numJugadores = estado.config.numJugadores;
  const todosListos = jugadores.length === numJugadores;

  return (
    <div style={styles.fullPage}>
      <div style={styles.lobbyCard}>
        <div style={styles.title}>🃏 ESCOBA</div>
        <div style={styles.codigoDisplay}>Sala: {codigo}</div>

        <div style={styles.jugadoresList}>
          <div style={styles.jugadoresTitle}>Jugadores ({jugadores.length}/{numJugadores}):</div>
          {jugadores.map((jug, idx) => (
            <div key={idx} style={styles.jugadorItem}>
              <span style={{ fontWeight: jug.nombre === nombre ? 700 : 400 }}>
                {jug.nombre} {jug.nombre === nombre && '(Tú)'}
              </span>
              {jug.nombre === sala.host && <span style={{ color: '#FF6B35' }}>👑</span>}
            </div>
          ))}
        </div>

        {!todosListos && (
          <div style={styles.esperandoMsg}>
            <span style={styles.dot} />
            Esperando jugadores...
          </div>
        )}

        {todosListos && !esHost && (
          <div style={styles.esperandoMsg}>
            Esperando que el host inicie...
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Juego ──────────────────────────────────────────────────────────────────
function Juego({ codigo, nombre, sala, esHost, onActualizarSala }: {
  codigo: string;
  nombre: string;
  sala: Sala;
  esHost: boolean;
  onActualizarSala: (s: Sala) => void;
}) {
  const estado = sala.estado_json;
  const jugador = estado.jugadores[nombre];
  const [cartaSeleccionada, setCartaSeleccionada] = useState<Carta | null>(null);
  const [combinacionesValidas, setCombinacionesValidas] = useState<Carta[][]>([]);
  const [mostrandoEscoba, setMostrandoEscoba] = useState(false);
  const [mostrandoConteo, setMostrandoConteo] = useState(false);

  // Inicializar juego si es host y está en esperando
  useEffect(() => {
    if (!esHost || estado.estado !== 'esperando') return;
    
    const iniciarJuego = async () => {
      const mazo = crearMazo();
      const nuevoEstado = { ...estado };
      const nombresJugadores = Object.keys(nuevoEstado.jugadores);
      
      // Repartir 3 cartas a cada jugador
      nombresJugadores.forEach(nombreJug => {
        nuevoEstado.jugadores[nombreJug].mano = mazo.splice(0, 3);
      });
      
      // 4 cartas en mesa
      nuevoEstado.mesa = mazo.splice(0, 4);
      nuevoEstado.mazo = mazo;
      nuevoEstado.turno = nombresJugadores[0];
      nuevoEstado.estado = 'jugando';
      nuevoEstado.ronda = 1;
      nuevoEstado.cartasEnMano = 3;
      
      await patchSala(codigo, { estado_json: nuevoEstado });
      onActualizarSala({ ...sala, estado_json: nuevoEstado });
    };
    
    iniciarJuego();
  }, [esHost, estado.estado]);

  // Cuando se selecciona una carta, buscar combinaciones
  useEffect(() => {
    if (!cartaSeleccionada || estado.turno !== nombre || estado.estado !== 'jugando') {
      setCombinacionesValidas([]);
      return;
    }
    
    const combis = encontrarCombinaciones(cartaSeleccionada, estado.mesa);
    setCombinacionesValidas(combis);
  }, [cartaSeleccionada, estado.mesa, estado.turno, nombre, estado.estado]);

  // Verificar si hay que repartir nuevas cartas
  useEffect(() => {
    if (!esHost || estado.estado !== 'jugando') return;
    
    const todosSinCartas = Object.values(estado.jugadores).every(j => j.mano.length === 0);
    if (todosSinCartas && estado.mazo.length > 0) {
      const repartirNuevas = async () => {
        const nuevoEstado = { ...estado };
        const nombresJugadores = Object.keys(nuevoEstado.jugadores);
        
        nombresJugadores.forEach(nombreJug => {
          nuevoEstado.jugadores[nombreJug].mano = nuevoEstado.mazo.splice(0, 3);
        });
        
        nuevoEstado.cartasEnMano = 3;
        
        await patchSala(codigo, { estado_json: nuevoEstado });
        onActualizarSala({ ...sala, estado_json: nuevoEstado });
      };
      
      repartirNuevas();
    }
  }, [estado, esHost, codigo, sala, onActualizarSala]);

  // Verificar si se terminó el mazo
  useEffect(() => {
    if (!esHost || estado.estado !== 'jugando') return;
    
    const todosSinCartas = Object.values(estado.jugadores).every(j => j.mano.length === 0);
    if (todosSinCartas && estado.mazo.length === 0) {
      const terminarRonda = async () => {
        const nuevoEstado = { ...estado };
        
        // Las cartas que quedaron en mesa las lleva el último que levantó
        if (nuevoEstado.ultimoQueLevanto && nuevoEstado.mesa.length > 0) {
          nuevoEstado.jugadores[nuevoEstado.ultimoQueLevanto].cartasLevantadas.push(...nuevoEstado.mesa);
          nuevoEstado.mesa = [];
        }
        
        // Calcular puntos de la ronda
        const puntosRonda = calcularPuntosRonda(nuevoEstado.jugadores);
        Object.entries(puntosRonda).forEach(([nombreJug, puntos]) => {
          nuevoEstado.jugadores[nombreJug].puntosRonda = puntos;
          nuevoEstado.puntosPartido[nombreJug] = (nuevoEstado.puntosPartido[nombreJug] || 0) + puntos;
        });
        
        nuevoEstado.estado = 'conteo';
        
        await patchSala(codigo, { estado_json: nuevoEstado });
        onActualizarSala({ ...sala, estado_json: nuevoEstado });
        setMostrandoConteo(true);
      };
      
      terminarRonda();
    }
  }, [estado, esHost, codigo, sala, onActualizarSala]);

  const handleJugarCarta = async (carta: Carta) => {
    if (estado.turno !== nombre || estado.estado !== 'jugando') return;
    if (!jugador.mano.includes(carta)) return;
    
    setCartaSeleccionada(carta);
    
    const combis = encontrarCombinaciones(carta, estado.mesa);
    
    if (combis.length === 0) {
      // No hay combinación, la carta queda en la mesa
      const nuevoEstado = { ...estado };
      nuevoEstado.jugadores[nombre].mano = nuevoEstado.jugadores[nombre].mano.filter(c => c.id !== carta.id);
      nuevoEstado.mesa.push(carta);
      
      // Siguiente turno
      const nombresJugadores = Object.keys(nuevoEstado.jugadores);
      const indiceActual = nombresJugadores.indexOf(nombre);
      nuevoEstado.turno = nombresJugadores[(indiceActual + 1) % nombresJugadores.length];
      
      await patchSala(codigo, { estado_json: nuevoEstado });
      onActualizarSala({ ...sala, estado_json: nuevoEstado });
      setCartaSeleccionada(null);
      return;
    }
    
    // Si hay combinaciones, esperar a que el jugador seleccione una
  };

  const handleSeleccionarCombinacion = async (combinacion: Carta[]) => {
    if (!cartaSeleccionada || estado.turno !== nombre || estado.estado !== 'jugando') return;
    
    const nuevoEstado = { ...estado };
    
    // Remover carta de la mano
    nuevoEstado.jugadores[nombre].mano = nuevoEstado.jugadores[nombre].mano.filter(c => c.id !== cartaSeleccionada.id);
    
    // Levantar cartas de la combinación
    const cartasALevantar = [...combinacion, cartaSeleccionada];
    nuevoEstado.jugadores[nombre].cartasLevantadas.push(...cartasALevantar);
    
    // Remover de la mesa
    combinacion.forEach(cartaCombi => {
      const idx = nuevoEstado.mesa.findIndex(c => c.id === cartaCombi.id);
      if (idx >= 0) nuevoEstado.mesa.splice(idx, 1);
    });
    
    // Verificar escoba
    const esEscoba = nuevoEstado.mesa.length === 0;
    if (esEscoba) {
      nuevoEstado.jugadores[nombre].escobas++;
      setMostrandoEscoba(true);
      setTimeout(() => setMostrandoEscoba(false), 2000);
    }
    
    nuevoEstado.ultimoQueLevanto = nombre;
    
    // Siguiente turno
    const nombresJugadores = Object.keys(nuevoEstado.jugadores);
    const indiceActual = nombresJugadores.indexOf(nombre);
    nuevoEstado.turno = nombresJugadores[(indiceActual + 1) % nombresJugadores.length];
    
    await patchSala(codigo, { estado_json: nuevoEstado });
    onActualizarSala({ ...sala, estado_json: nuevoEstado });
    setCartaSeleccionada(null);
    setCombinacionesValidas([]);
  };

  const handleContinuar = async () => {
    const nuevoEstado = { ...estado };
    
    // Verificar si alguien ganó el partido
    const alguienGano = Object.entries(nuevoEstado.puntosPartido).some(([_, puntos]) => 
      puntos >= nuevoEstado.config.puntosPartido
    );
    
    if (alguienGano) {
      nuevoEstado.estado = 'partidoTerminado';
    } else {
      // Nueva ronda
      const mazo = crearMazo();
      const nombresJugadores = Object.keys(nuevoEstado.jugadores);
      
      nombresJugadores.forEach(nombreJug => {
        nuevoEstado.jugadores[nombreJug].mano = mazo.splice(0, 3);
        nuevoEstado.jugadores[nombreJug].cartasLevantadas = [];
        nuevoEstado.jugadores[nombreJug].escobas = 0;
        nuevoEstado.jugadores[nombreJug].puntosRonda = 0;
      });
      
      nuevoEstado.mesa = mazo.splice(0, 4);
      nuevoEstado.mazo = mazo;
      nuevoEstado.turno = nombresJugadores[0];
      nuevoEstado.ronda++;
      nuevoEstado.estado = 'jugando';
      nuevoEstado.cartasEnMano = 3;
    }
    
    await patchSala(codigo, { estado_json: nuevoEstado });
    onActualizarSala({ ...sala, estado_json: nuevoEstado });
    setMostrandoConteo(false);
  };

  if (!jugador) return <div style={styles.fullPage}>Cargando...</div>;

  const esMiTurno = estado.turno === nombre && estado.estado === 'jugando';
  const puntosRonda = calcularPuntosRonda(estado.jugadores);

  return (
    <div style={styles.fullPage}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.codigoDisplay}>Sala: {codigo}</div>
        <div style={styles.rondaDisplay}>Ronda {estado.ronda}</div>
      </div>

      {/* Marcador */}
      <div style={styles.marcador}>
        {Object.entries(estado.puntosPartido).map(([nombreJug, puntos]) => (
          <div key={nombreJug} style={styles.marcadorItem}>
            <div style={styles.marcadorNombre}>
              {nombreJug} {nombreJug === nombre && '(Tú)'}
            </div>
            <div style={styles.marcadorPuntos}>{puntos} / {estado.config.puntosPartido}</div>
          </div>
        ))}
      </div>

      {/* Contador de Escobas */}
      <div style={styles.escobasContainer}>
        {Object.entries(estado.jugadores).map(([nombreJug, jug]) => (
          <div key={nombreJug} style={styles.escobaItem}>
            <span style={{ fontWeight: nombreJug === nombre ? 700 : 400 }}>
              {nombreJug === nombre ? 'Tú' : nombreJug}:
            </span>
            <span style={{ color: '#FF6B35', fontWeight: 700 }}>🧹 {jug.escobas}</span>
          </div>
        ))}
      </div>

      {/* Mesa */}
      <div style={styles.mesaContainer}>
        <div style={styles.mesaTitle}>Mesa</div>
        <div style={styles.mesaCartas}>
          {estado.mesa.map((carta, idx) => {
            const estaEnCombinacion = combinacionesValidas.some(combi => 
              combi.some(c => c.id === carta.id)
            );
            return (
              <div
                key={idx}
                style={{
                  ...styles.cartaMesa,
                  border: estaEnCombinacion ? '3px solid #FF6B35' : '1px solid #333',
                  boxShadow: estaEnCombinacion ? '0 0 15px #FF6B35' : 'none',
                }}
              >
                <CartaSVG carta={carta} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Mis Cartas */}
      <div style={styles.misCartasContainer}>
        <div style={styles.misCartasTitle}>
          {esMiTurno ? '👉 Tu turno - Seleccioná una carta' : `Turno de: ${estado.turno}`}
        </div>
        <div style={styles.misCartas}>
          {jugador.mano.map((carta, idx) => (
            <div
              key={idx}
              style={{
                ...styles.cartaMano,
                border: cartaSeleccionada?.id === carta.id ? '3px solid #FF6B35' : '1px solid #333',
                opacity: esMiTurno ? 1 : 0.6,
                cursor: esMiTurno ? 'pointer' : 'default',
              }}
              onClick={() => esMiTurno && handleJugarCarta(carta)}
            >
              <CartaSVG carta={carta} />
            </div>
          ))}
        </div>
      </div>

      {/* Combinaciones Válidas */}
      {combinacionesValidas.length > 0 && cartaSeleccionada && (
        <div style={styles.combinacionesContainer}>
          <div style={styles.combinacionesTitle}>Combinaciones válidas:</div>
          {combinacionesValidas.map((combi, idx) => (
            <button
              key={idx}
              style={styles.btnCombinacion}
              onClick={() => handleSeleccionarCombinacion(combi)}
            >
              Levantar: {combi.map(c => `${valorCarta(c)}`).join(' + ')} = {combi.reduce((sum, c) => sum + valorCarta(c), 0) + valorCarta(cartaSeleccionada)}
            </button>
          ))}
        </div>
      )}

      {/* Animación Escoba */}
      {mostrandoEscoba && (
        <div style={styles.escobaAnimacion}>
          <div style={styles.escobaTexto}>🧹 ¡ESCOBA! 🧹</div>
        </div>
      )}

      {/* Modal Conteo */}
      {mostrandoConteo && estado.estado === 'conteo' && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalTitle}>Puntos de la Ronda</div>
            {Object.entries(puntosRonda).map(([nombreJug, puntos]) => (
              <div key={nombreJug} style={styles.puntoItem}>
                <span>{nombreJug}:</span>
                <span style={{ fontWeight: 700, color: '#FF6B35' }}>+{puntos} puntos</span>
              </div>
            ))}
            <button style={styles.btnPrimary} onClick={handleContinuar}>
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Partido Terminado */}
      {estado.estado === 'partidoTerminado' && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalTitle}>🏆 Partido Terminado</div>
            {Object.entries(estado.puntosPartido)
              .sort(([, a], [, b]) => b - a)
              .map(([nombreJug, puntos]) => (
                <div key={nombreJug} style={styles.puntoItem}>
                  <span>{nombreJug}:</span>
                  <span style={{ fontWeight: 700, color: '#FF6B35' }}>{puntos} puntos</span>
                </div>
              ))}
            <button style={styles.btnPrimary} onClick={() => window.location.reload()}>
              Jugar de nuevo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente Carta SVG ────────────────────────────────────────────────────
function CartaSVG({ carta }: { carta: Carta }) {
  const valor = carta.valor;
  const palo = carta.palo;
  
  const simboloPalo = {
    espadas: '♠',
    bastos: '♣',
    copas: '♥',
    oros: '♦',
  }[palo];
  
  const colorPalo = palo === 'espadas' || palo === 'bastos' ? '#000' : '#c00';
  
  const textoValor = valor === 1 ? 'A' : valor === 8 ? 'S' : valor === 9 ? 'C' : valor === 10 ? 'R' : valor.toString();
  
  return (
    <div style={styles.cartaSVG}>
      <div style={{ ...styles.cartaValor, color: colorPalo }}>
        {textoValor}
      </div>
      <div style={{ ...styles.cartaPalo, color: colorPalo, fontSize: 24 }}>
        {simboloPalo}
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
    fontFamily: "'Courier New', monospace",
    overflow: 'auto',
    userSelect: 'none',
    paddingBottom: 20,
  },
  lobbyCard: {
    position: 'relative',
    background: 'linear-gradient(135deg, #1a0a0a 0%, #0a0a0a 100%)',
    border: '2px solid #FF6B35',
    borderRadius: 16,
    padding: '36px 28px',
    width: '90%',
    maxWidth: 360,
    margin: '50px auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    zIndex: 10,
    boxShadow: '0 0 30px rgba(255, 107, 53, 0.3)',
  },
  title: {
    fontSize: 48,
    fontWeight: 900,
    color: '#FF6B35',
    textAlign: 'center',
    letterSpacing: 8,
    textShadow: '0 0 20px rgba(255, 107, 53, 0.8)',
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
    background: 'linear-gradient(135deg, #FF6B35 0%, #d45a2a 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '14px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: 1,
    boxShadow: '0 4px 15px rgba(255, 107, 53, 0.4)',
  },
  btnSecondary: {
    background: '#1a1a1a',
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
  codigoDisplay: {
    fontSize: 18,
    fontWeight: 700,
    color: '#FF6B35',
    letterSpacing: 4,
  },
  configSection: {
    marginBottom: 20,
  },
  configLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  configButtons: {
    display: 'flex',
    gap: 8,
  },
  btnConfig: {
    flex: 1,
    padding: '12px',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  jugadoresList: {
    marginTop: 20,
  },
  jugadoresTitle: {
    color: '#FF6B35',
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
    padding: '8px',
    background: '#1a1a1a',
    borderRadius: 6,
  },
  esperandoMsg: {
    color: '#888',
    fontSize: 13,
    marginTop: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  dot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#FF6B35',
    boxShadow: '0 0 8px #FF6B35',
    animation: 'pulse 1.5s infinite',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #1a0a0a 0%, #0a0a0a 100%)',
    borderBottom: '1px solid #FF6B35',
  },
  rondaDisplay: {
    fontSize: 14,
    color: '#888',
    fontWeight: 700,
  },
  marcador: {
    display: 'flex',
    justifyContent: 'space-around',
    padding: '12px',
    background: '#111',
    borderBottom: '1px solid #222',
  },
  marcadorItem: {
    textAlign: 'center',
  },
  marcadorNombre: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  marcadorPuntos: {
    fontSize: 20,
    fontWeight: 700,
    color: '#FF6B35',
  },
  escobasContainer: {
    display: 'flex',
    justifyContent: 'space-around',
    padding: '8px',
    background: '#1a1a1a',
    borderBottom: '1px solid #222',
  },
  escobaItem: {
    fontSize: 12,
    color: '#fff',
  },
  mesaContainer: {
    padding: '20px',
    textAlign: 'center',
  },
  mesaTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#FF6B35',
    marginBottom: 16,
  },
  mesaCartas: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    minHeight: 120,
  },
  cartaMesa: {
    width: 60,
    height: 84,
    background: '#fff',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  misCartasContainer: {
    padding: '20px',
  },
  misCartasTitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
    textAlign: 'center',
  },
  misCartas: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  cartaMano: {
    width: 60,
    height: 84,
    background: '#fff',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  combinacionesContainer: {
    padding: '16px',
    background: '#1a1a1a',
    borderTop: '2px solid #FF6B35',
  },
  combinacionesTitle: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: 700,
    marginBottom: 8,
  },
  btnCombinacion: {
    width: '100%',
    padding: '12px',
    background: '#FF6B35',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: 8,
  },
  escobaAnimacion: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    animation: 'fadeInOut 2s',
  },
  escobaTexto: {
    fontSize: 64,
    fontWeight: 900,
    color: '#FF6B35',
    textShadow: '0 0 30px #FF6B35',
    animation: 'pulse 0.5s infinite',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    background: '#111',
    border: '2px solid #FF6B35',
    borderRadius: 16,
    padding: '32px',
    maxWidth: 320,
    width: '90%',
    textAlign: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: '#FF6B35',
    marginBottom: 20,
  },
  puntoItem: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
    padding: '8px',
    background: '#1a1a1a',
    borderRadius: 6,
  },
  cartaSVG: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartaValor: {
    position: 'absolute',
    top: 4,
    left: 4,
    fontSize: 14,
    fontWeight: 700,
  },
  cartaPalo: {
    fontSize: 32,
  },
};

export default EscobaView;
