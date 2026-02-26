/**
 * DominoView.tsx — Dominó Clásico Multijugador
 * Supabase Realtime — funciona en redes distintas
 * Optimizado para celular landscape
 * Modo: 2 o 4 jugadores (mano a mano o en parejas)
 */
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';

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
const FICHAS_TOTALES = 28; // 0-0 al 6-6
const FICHAS_POR_JUGADOR = 7;

// ─── Tipos ───────────────────────────────────────────────────────────────────
type Ficha = [number, number]; // [lado1, lado2]

interface Jugador {
  nombre: string;
  fichas: Ficha[];
  puntos: number;
}

interface ConfigSala {
  jugadores: 2 | 4;
  puntosPartido: 100 | 200 | 300;
}

interface EstadoSala {
  fase: 'config' | 'esperando' | 'jugando' | 'rondaTerminada' | 'partidoTerminado';
  config?: ConfigSala;
  jugadores: Record<string, Jugador>;
  cadena: Ficha[]; // Fichas colocadas en el centro
  pozo: Ficha[]; // Fichas restantes (solo con 2 jugadores)
  turno: string | null; // Nombre del jugador actual
  jugadorInicial?: string; // Quien empezó la ronda
  extremos: [number, number]; // Valores en los extremos de la cadena
  ronda: number;
  puntajes: Record<string, number>; // Puntos acumulados por jugador/pareja
  ganadorRonda?: string;
  ganadorPartido?: string;
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

function generarFichas(): Ficha[] {
  const fichas: Ficha[] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      fichas.push([i, j]);
    }
  }
  return fichas;
}

function mezclar<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function calcularPuntos(fichas: Ficha[]): number {
  return fichas.reduce((sum, f) => sum + f[0] + f[1], 0);
}

function esDoble(ficha: Ficha): boolean {
  return ficha[0] === ficha[1];
}

function obtenerDobleMasAlto(fichas: Ficha[]): Ficha | null {
  const dobles = fichas.filter(esDoble);
  if (dobles.length === 0) return null;
  return dobles.reduce((max, f) => (f[0] > max[0] ? f : max));
}

function fichasJugables(fichas: Ficha[], extremos: [number, number]): Ficha[] {
  const [izq, der] = extremos;
  return fichas.filter(f => f[0] === izq || f[1] === izq || f[0] === der || f[1] === der);
}

async function getSala(id: string): Promise<Sala | null> {
  const r = await fetch(`${SUPA_URL}/rest/v1/domino_salas?id=eq.${id}`, { headers: HEADERS });
  const d = await r.json();
  return d[0] || null;
}

async function patchSala(id: string, data: Partial<Sala>) {
  await fetch(`${SUPA_URL}/rest/v1/domino_salas?id=eq.${id}`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify(data),
  });
}

async function crearSala(id: string, nombre: string): Promise<void> {
  const estadoInicial: EstadoSala = {
    fase: 'config',
    jugadores: {
      [nombre]: {
        nombre,
        fichas: [],
        puntos: 0,
      },
    },
    cadena: [],
    pozo: [],
    turno: null,
    extremos: [0, 0],
    ronda: 0,
    puntajes: { [nombre]: 0 },
  };

  await fetch(`${SUPA_URL}/rest/v1/domino_salas`, {
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
  if (estado.fase !== 'config' && estado.fase !== 'esperando') return false; // Ya empezó

  estado.jugadores[nombre] = {
    nombre,
    fichas: [],
    puntos: 0,
  };
  estado.puntajes[nombre] = 0;

  await patchSala(id, { estado_json: estado });
  return true;
}

// ─── Componente principal ────────────────────────────────────────────────────
export function DominoView({ onBack }: { onBack?: () => void }) {
  const { usuario } = useAuth();
  const [fase, setFase] = useState<'sala' | 'multijugador'>('sala');
  const nombre = usuario?.nombre || 'Jugador';
  const [codigo, setCodigo] = useState('');
  const [codigoInput, setCodigoInput] = useState('');
  const [sala, setSala] = useState<Sala | null>(null);
  const [error, setError] = useState('');
  const [esHost, setEsHost] = useState(false);

  // ── Crear sala automáticamente ──────────────────────────────────────────────
  useEffect(() => {
    const crearSalaAuto = async () => {
      if (!nombre.trim()) return;
      const code = genCode();
      await crearSala(code, nombre);
      setCodigo(code);
      setEsHost(true);
    };
    crearSalaAuto();
  }, [nombre]);

  // ── Unirse a sala multijugador ──────────────────────────────────────────────
  const handleUnirse = async () => {
    if (!codigoInput.trim()) { setError('Ingresá el código'); return; }
    const ok = await unirSala(codigoInput.toUpperCase(), nombre);
    if (!ok) { setError('Sala no encontrada o ya empezó'); return; }
    setCodigo(codigoInput.toUpperCase());
    setEsHost(false);
    setFase('sala');
  };

  // ── Polling de sala ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (fase !== 'sala' || !codigo) return;
    const iv = setInterval(async () => {
      const s = await getSala(codigo);
      if (s) setSala(s);
    }, 1000);
    return () => clearInterval(iv);
  }, [fase, codigo]);

  // ── Render fases ────────────────────────────────────────────────────────────
  if (fase === 'multijugador') {
    return (
      <div style={styles.fullPage}>
        <button style={styles.backButton} onClick={onBack}>← Volver</button>
        <div style={styles.lobbyCard}>
          <div style={styles.title}>🎴 DOMINÓ MULTIJUGADOR</div>
          <div style={styles.subtitle}>Ingresa el código de la sala</div>
          <input
            style={styles.input}
            placeholder="Código (ABCD)"
            value={codigoInput}
            onChange={e => { setCodigoInput(e.target.value.toUpperCase()); setError(''); }}
            maxLength={4}
            onKeyPress={(e) => e.key === 'Enter' && handleUnirse()}
          />
          <button style={styles.btnPrimary} onClick={handleUnirse}>
            Unirse
          </button>
          {error && <div style={styles.errorMsg}>{error}</div>}
        </div>
      </div>
    );
  }

  if (fase === 'sala' && sala && codigo) {
    return (
      <SalaJuego
        codigo={codigo}
        nombre={nombre}
        sala={sala}
        esHost={esHost}
        onActualizarSala={setSala}
      />
    );
  }

  if (!codigo) {
    return <div style={styles.fullPage}>Cargando dominó...</div>;
  }

  return <div style={styles.fullPage}>Cargando...</div>;
}

// ─── Lobby (ya no se usa, pero se mantiene por compatibilidad) ───────────────────────────────────────────────────────────────────
function Lobby({ nombre, setNombre, codigoInput, setCodigoInput, error, setError, onCrear, onUnirse }: any) {
  return (
    <div style={styles.fullPage}>
      <div style={styles.lobbyCard}>
        <div style={styles.title}>🎴 DOMINÓ</div>
        <div style={styles.subtitle}>Clásico Multijugador</div>

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

// ─── Sala de Juego ────────────────────────────────────────────────────────────
function SalaJuego({ codigo, nombre, sala, esHost, onActualizarSala }: {
  codigo: string;
  nombre: string;
  sala: Sala;
  esHost: boolean;
  onActualizarSala: (s: Sala) => void;
}) {
  const estado = sala.estado_json;
  const jugador = estado.jugadores[nombre];
  const [fichaSeleccionada, setFichaSeleccionada] = useState<Ficha | null>(null);
  const [ladoSeleccionado, setLadoSeleccionado] = useState<'izq' | 'der' | null>(null);

  // ── Configurar sala (solo host) ────────────────────────────────────────────
  const handleConfigurar = async (jugadores: 2 | 4, puntos: 100 | 200 | 300) => {
    const nuevoEstado = { ...estado };
    nuevoEstado.config = { jugadores, puntosPartido: puntos };
    nuevoEstado.fase = 'esperando';
    await patchSala(codigo, { estado_json: nuevoEstado });
    onActualizarSala({ ...sala, estado_json: nuevoEstado });
  };

  // ── Iniciar juego (solo host) ────────────────────────────────────────────────
  const handleIniciar = async () => {
    if (!estado.config) return;
    const { jugadores: numJugadores } = estado.config;
    const nombresJugadores = Object.keys(estado.jugadores);
    if (nombresJugadores.length !== numJugadores) return;

    // Repartir fichas
    const todasFichas = mezclar(generarFichas());
    const nuevoEstado = { ...estado };
    nuevoEstado.fase = 'jugando';
    nuevoEstado.ronda = 1;

    // Repartir 7 fichas a cada jugador
    nombresJugadores.forEach((nom, idx) => {
      nuevoEstado.jugadores[nom].fichas = todasFichas.slice(
        idx * FICHAS_POR_JUGADOR,
        (idx + 1) * FICHAS_POR_JUGADOR
      );
    });

    // Pozo solo con 2 jugadores
    if (numJugadores === 2) {
      nuevoEstado.pozo = todasFichas.slice(numJugadores * FICHAS_POR_JUGADOR);
    } else {
      nuevoEstado.pozo = [];
    }

    // Determinar quien empieza (doble más alto, o 6-6 en primera ronda)
    let jugadorInicial = nombresJugadores[0];
    let fichaInicial: Ficha | null = null;

    if (nuevoEstado.ronda === 1) {
      // Primera ronda: busca 6-6
      for (const nom of nombresJugadores) {
        const ficha66 = nuevoEstado.jugadores[nom].fichas.find(f => f[0] === 6 && f[1] === 6);
        if (ficha66) {
          jugadorInicial = nom;
          fichaInicial = ficha66;
          break;
        }
      }
    }

    // Si no hay 6-6, busca doble más alto
    if (!fichaInicial) {
      let maxDoble: Ficha | null = null;
      for (const nom of nombresJugadores) {
        const doble = obtenerDobleMasAlto(nuevoEstado.jugadores[nom].fichas);
        if (doble && (!maxDoble || doble[0] > maxDoble[0])) {
          maxDoble = doble;
          jugadorInicial = nom;
          fichaInicial = doble;
        }
      }
    }

    // Si no hay doble, elige aleatoriamente
    if (!fichaInicial) {
      jugadorInicial = nombresJugadores[Math.floor(Math.random() * nombresJugadores.length)];
      fichaInicial = nuevoEstado.jugadores[jugadorInicial].fichas[0];
    }

    // Colocar ficha inicial
    nuevoEstado.cadena = [fichaInicial];
    nuevoEstado.extremos = [fichaInicial[0], fichaInicial[1]];
    nuevoEstado.turno = jugadorInicial;
    nuevoEstado.jugadorInicial = jugadorInicial;

    // Remover ficha inicial de la mano del jugador
    const idxFicha = nuevoEstado.jugadores[jugadorInicial].fichas.findIndex(
      f => f[0] === fichaInicial![0] && f[1] === fichaInicial![1]
    );
    nuevoEstado.jugadores[jugadorInicial].fichas.splice(idxFicha, 1);

    await patchSala(codigo, { estado_json: nuevoEstado });
    onActualizarSala({ ...sala, estado_json: nuevoEstado });
  };

  // ── Colocar ficha ───────────────────────────────────────────────────────────
  const handleColocarFicha = async (ficha: Ficha) => {
    if (estado.turno !== nombre) return;
    if (estado.cadena.length === 0) return; // Primera ficha ya está colocada

    const jugables = fichasJugables([ficha], estado.extremos);
    if (jugables.length === 0) return;

    const nuevoEstado = { ...estado };
    const [izq, der] = nuevoEstado.extremos;
    let fichaColocada: Ficha = ficha;
    let nuevoIzq = izq;
    let nuevoDer = der;

    // Determinar en qué extremo y orientación
    if (ficha[0] === izq) {
      // Colocar a la izquierda, invertida
      nuevoEstado.cadena.unshift([ficha[1], ficha[0]]);
      nuevoIzq = ficha[1];
    } else if (ficha[1] === izq) {
      // Colocar a la izquierda, normal
      nuevoEstado.cadena.unshift(ficha);
      nuevoIzq = ficha[0];
    } else if (ficha[0] === der) {
      // Colocar a la derecha, normal
      nuevoEstado.cadena.push(ficha);
      nuevoDer = ficha[1];
    } else if (ficha[1] === der) {
      // Colocar a la derecha, invertida
      nuevoEstado.cadena.push([ficha[1], ficha[0]]);
      nuevoDer = ficha[0];
    }

    nuevoEstado.extremos = [nuevoIzq, nuevoDer];

    // Remover ficha de la mano
    const idxFicha = nuevoEstado.jugadores[nombre].fichas.findIndex(
      f => f[0] === ficha[0] && f[1] === ficha[1]
    );
    nuevoEstado.jugadores[nombre].fichas.splice(idxFicha, 1);

    // Verificar si ganó
    if (nuevoEstado.jugadores[nombre].fichas.length === 0) {
      nuevoEstado.fase = 'rondaTerminada';
      nuevoEstado.ganadorRonda = nombre;
      // Calcular puntos
      const nombresJugadores = Object.keys(nuevoEstado.jugadores);
      nombresJugadores.forEach(nom => {
        if (nom !== nombre) {
          const puntos = calcularPuntos(nuevoEstado.jugadores[nom].fichas);
          nuevoEstado.puntajes[nom] = (nuevoEstado.puntajes[nom] || 0) + puntos;
        }
      });
    } else {
      // Siguiente turno
      const nombresJugadores = Object.keys(nuevoEstado.jugadores);
      const idxActual = nombresJugadores.indexOf(nombre);
      nuevoEstado.turno = nombresJugadores[(idxActual + 1) % nombresJugadores.length];
    }

    await patchSala(codigo, { estado_json: nuevoEstado });
    onActualizarSala({ ...sala, estado_json: nuevoEstado });
    setFichaSeleccionada(null);
    setLadoSeleccionado(null);
  };

  // ── Robar del pozo (solo 2 jugadores) ───────────────────────────────────────
  const handleRobar = async () => {
    if (estado.turno !== nombre) return;
    if (estado.config?.jugadores !== 2) return;
    if (estado.pozo.length === 0) return;

    const nuevoEstado = { ...estado };
    const fichaRobada = nuevoEstado.pozo.pop()!;
    nuevoEstado.jugadores[nombre].fichas.push(fichaRobada);

    // Si puede jugar, queda su turno, sino pasa
    const jugables = fichasJugables(nuevoEstado.jugadores[nombre].fichas, nuevoEstado.extremos);
    if (jugables.length === 0) {
      // Pasar turno
      const nombresJugadores = Object.keys(nuevoEstado.jugadores);
      const idxActual = nombresJugadores.indexOf(nombre);
      nuevoEstado.turno = nombresJugadores[(idxActual + 1) % nombresJugadores.length];
    }

    await patchSala(codigo, { estado_json: nuevoEstado });
    onActualizarSala({ ...sala, estado_json: nuevoEstado });
  };

  // ── Pasar turno (solo 4 jugadores) ────────────────────────────────────────────
  const handlePasar = async () => {
    if (estado.turno !== nombre) return;
    if (estado.config?.jugadores !== 4) return;

    const nuevoEstado = { ...estado };
    const nombresJugadores = Object.keys(nuevoEstado.jugadores);
    const idxActual = nombresJugadores.indexOf(nombre);
    nuevoEstado.turno = nombresJugadores[(idxActual + 1) % nombresJugadores.length];

    // Verificar si todos pasaron (trancado)
    // Por simplicidad, asumimos que si todos pasan consecutivamente, está trancado
    // En una implementación más robusta, se debería trackear esto

    await patchSala(codigo, { estado_json: nuevoEstado });
    onActualizarSala({ ...sala, estado_json: nuevoEstado });
  };

  // ── Nueva ronda ─────────────────────────────────────────────────────────────
  const handleNuevaRonda = async () => {
    if (!estado.config) return;
    const { jugadores: numJugadores, puntosPartido } = estado.config;
    const nombresJugadores = Object.keys(estado.jugadores);

    // Verificar si alguien ganó el partido
    const ganadorPartido = nombresJugadores.find(nom => estado.puntajes[nom] >= puntosPartido);
    if (ganadorPartido) {
      const nuevoEstado = { ...estado };
      nuevoEstado.fase = 'partidoTerminado';
      nuevoEstado.ganadorPartido = ganadorPartido;
      await patchSala(codigo, { estado_json: nuevoEstado });
      onActualizarSala({ ...sala, estado_json: nuevoEstado });
      return;
    }

    // Iniciar nueva ronda
    const todasFichas = mezclar(generarFichas());
    const nuevoEstado = { ...estado };
    nuevoEstado.fase = 'jugando';
    nuevoEstado.ronda += 1;
    nuevoEstado.cadena = [];
    nuevoEstado.extremos = [0, 0];

    nombresJugadores.forEach((nom, idx) => {
      nuevoEstado.jugadores[nom].fichas = todasFichas.slice(
        idx * FICHAS_POR_JUGADOR,
        (idx + 1) * FICHAS_POR_JUGADOR
      );
    });

    if (numJugadores === 2) {
      nuevoEstado.pozo = todasFichas.slice(numJugadores * FICHAS_POR_JUGADOR);
    } else {
      nuevoEstado.pozo = [];
    }

    // Determinar quien empieza
    let jugadorInicial = nombresJugadores[0];
    let fichaInicial: Ficha | null = null;

    // Busca doble más alto
    let maxDoble: Ficha | null = null;
    for (const nom of nombresJugadores) {
      const doble = obtenerDobleMasAlto(nuevoEstado.jugadores[nom].fichas);
      if (doble && (!maxDoble || doble[0] > maxDoble[0])) {
        maxDoble = doble;
        jugadorInicial = nom;
        fichaInicial = doble;
      }
    }

    if (!fichaInicial) {
      jugadorInicial = nombresJugadores[Math.floor(Math.random() * nombresJugadores.length)];
      fichaInicial = nuevoEstado.jugadores[jugadorInicial].fichas[0];
    }

    nuevoEstado.cadena = [fichaInicial];
    nuevoEstado.extremos = [fichaInicial[0], fichaInicial[1]];
    nuevoEstado.turno = jugadorInicial;
    nuevoEstado.jugadorInicial = jugadorInicial;

    const idxFicha = nuevoEstado.jugadores[jugadorInicial].fichas.findIndex(
      f => f[0] === fichaInicial![0] && f[1] === fichaInicial![1]
    );
    nuevoEstado.jugadores[jugadorInicial].fichas.splice(idxFicha, 1);

    await patchSala(codigo, { estado_json: nuevoEstado });
    onActualizarSala({ ...sala, estado_json: nuevoEstado });
  };

  // ── Render según fase ──────────────────────────────────────────────────────
  if (estado.fase === 'config' && esHost) {
    return (
      <ConfigSala
        codigo={codigo}
        onConfigurar={handleConfigurar}
      />
    );
  }

  if (estado.fase === 'esperando') {
    return (
      <SalaEspera
        codigo={codigo}
        nombre={nombre}
        sala={sala}
        esHost={esHost}
        onIniciar={handleIniciar}
      />
    );
  }

  if (estado.fase === 'partidoTerminado') {
    return (
      <PartidoTerminado
        ganador={estado.ganadorPartido || ''}
        puntajes={estado.puntajes}
      />
    );
  }

  if (estado.fase === 'rondaTerminada') {
    return (
      <RondaTerminada
        ganador={estado.ganadorRonda || ''}
        puntajes={estado.puntajes}
        config={estado.config!}
        esHost={esHost}
        onNuevaRonda={handleNuevaRonda}
      />
    );
  }

  if (estado.fase === 'jugando') {
    const jugables = fichasJugables(jugador.fichas, estado.extremos);
    const esMiTurno = estado.turno === nombre;
    const puedeRobar = estado.config?.jugadores === 2 && estado.pozo.length > 0 && esMiTurno;
    const puedePasar = estado.config?.jugadores === 4 && esMiTurno && jugables.length === 0;

    return (
      <Juego
        codigo={codigo}
        nombre={nombre}
        estado={estado}
        jugador={jugador}
        jugables={jugables}
        esMiTurno={esMiTurno}
        puedeRobar={puedeRobar}
        puedePasar={puedePasar}
        onColocarFicha={handleColocarFicha}
        onRobar={handleRobar}
        onPasar={handlePasar}
      />
    );
  }

  return <div style={styles.fullPage}>Cargando...</div>;
}

// ─── Config Sala ─────────────────────────────────────────────────────────────
function ConfigSala({ codigo, onConfigurar }: { codigo: string; onConfigurar: (jugadores: 2 | 4, puntos: 100 | 200 | 300) => void }) {
  const [jugadores, setJugadores] = useState<2 | 4>(2);
  const [puntos, setPuntos] = useState<100 | 200 | 300>(100);

  return (
    <div style={styles.fullPage}>
      <div style={styles.configCard}>
        <div style={styles.title}>⚙️ Configurar Sala</div>
        <div style={styles.codigoDisplay}>Código: {codigo}</div>

        <div style={styles.configSection}>
          <div style={styles.configLabel}>Jugadores:</div>
          <div style={styles.configButtons}>
            <button
              style={{
                ...styles.btnConfig,
                background: jugadores === 2 ? '#FF6B35' : '#1a1a1a',
              }}
              onClick={() => setJugadores(2)}
            >
              2 (Mano a mano)
            </button>
            <button
              style={{
                ...styles.btnConfig,
                background: jugadores === 4 ? '#FF6B35' : '#1a1a1a',
              }}
              onClick={() => setJugadores(4)}
            >
              4 (Parejas)
            </button>
          </div>
        </div>

        <div style={styles.configSection}>
          <div style={styles.configLabel}>Puntos del partido:</div>
          <div style={styles.configButtons}>
            {[100, 200, 300].map(p => (
              <button
                key={p}
                style={{
                  ...styles.btnConfig,
                  background: puntos === p ? '#FF6B35' : '#1a1a1a',
                }}
                onClick={() => setPuntos(p as 100 | 200 | 300)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <button
          style={styles.btnPrimary}
          onClick={() => onConfigurar(jugadores, puntos)}
        >
          Confirmar
        </button>
      </div>
    </div>
  );
}

// ─── Sala Espera ─────────────────────────────────────────────────────────────
function SalaEspera({ codigo, nombre, sala, esHost, onIniciar }: {
  codigo: string;
  nombre: string;
  sala: Sala;
  esHost: boolean;
  onIniciar: () => void;
}) {
  const estado = sala.estado_json;
  const nombresJugadores = Object.keys(estado.jugadores);
  const numJugadores = estado.config?.jugadores || 2;
  const todosListos = nombresJugadores.length === numJugadores;

  return (
    <div style={styles.fullPage}>
      <div style={styles.esperaCard}>
        <div style={styles.title}>🎴 DOMINÓ</div>
        <div style={styles.codigoDisplay}>Sala: {codigo}</div>

        <div style={styles.configInfo}>
          <div>Jugadores: {numJugadores} {numJugadores === 2 ? '(Mano a mano)' : '(Parejas)'}</div>
          <div>Partido a: {estado.config?.puntosPartido} puntos</div>
        </div>

        <div style={styles.jugadoresList}>
          <div style={styles.jugadoresTitle}>Jugadores ({nombresJugadores.length}/{numJugadores}):</div>
          {nombresJugadores.map((nom, idx) => (
            <div key={idx} style={styles.jugadorItem}>
              <span style={{ fontWeight: nom === nombre ? 700 : 400 }}>
                {nom} {nom === nombre && '(Tú)'}
              </span>
            </div>
          ))}
        </div>

        {esHost && (
          <button
            style={{
              ...styles.btnPrimary,
              opacity: todosListos ? 1 : 0.5,
            }}
            onClick={onIniciar}
            disabled={!todosListos}
          >
            {todosListos ? '🎲 Iniciar Juego' : `Esperando ${numJugadores - nombresJugadores.length} jugador${numJugadores - nombresJugadores.length > 1 ? 'es' : ''}...`}
          </button>
        )}

        {!esHost && (
          <div style={styles.esperandoText}>Esperando a que el host inicie...</div>
        )}
      </div>
    </div>
  );
}

// ─── Juego ────────────────────────────────────────────────────────────────────
function Juego({ codigo, nombre, estado, jugador, jugables, esMiTurno, puedeRobar, puedePasar, onColocarFicha, onRobar, onPasar }: {
  codigo: string;
  nombre: string;
  estado: EstadoSala;
  jugador: Jugador;
  jugables: Ficha[];
  esMiTurno: boolean;
  puedeRobar: boolean;
  puedePasar: boolean;
  onColocarFicha: (f: Ficha) => void;
  onRobar: () => void;
  onPasar: () => void;
}) {
  const nombresJugadores = Object.keys(estado.jugadores);
  const otrosJugadores = nombresJugadores.filter(n => n !== nombre);

  return (
    <div style={styles.juegoContainer}>
      {/* Header con puntajes */}
      <div style={styles.header}>
        <div style={styles.codigoDisplay}>Sala: {codigo}</div>
        <div style={styles.puntajesContainer}>
          {nombresJugadores.map(nom => (
            <div key={nom} style={{
              ...styles.puntajeItem,
              fontWeight: nom === nombre ? 700 : 400,
            }}>
              {nom === nombre ? 'Tú' : nom}: {estado.puntajes[nom] || 0}
            </div>
          ))}
        </div>
      </div>

      {/* Cadena de fichas */}
      <div style={styles.cadenaContainer}>
        <div style={styles.cadenaTitle}>Cadena:</div>
        <div style={styles.cadena}>
          {estado.cadena.map((ficha, idx) => (
            <div key={idx} style={styles.fichaCadena}>
              <div style={styles.fichaLado}>{ficha[0]}</div>
              <div style={styles.fichaDivider} />
              <div style={styles.fichaLado}>{ficha[1]}</div>
            </div>
          ))}
        </div>
        <div style={styles.extremosInfo}>
          Extremos: {estado.extremos[0]} | {estado.extremos[1]}
        </div>
      </div>

      {/* Fichas de otros jugadores */}
      <div style={styles.otrosJugadoresContainer}>
        {otrosJugadores.map(nom => {
          const otroJugador = estado.jugadores[nom];
          return (
            <div key={nom} style={styles.otroJugador}>
              <div style={styles.otroJugadorNombre}>
                {nom} {estado.turno === nom && '▶'}
              </div>
              <div style={styles.fichasReverso}>
                {Array(otroJugador.fichas.length).fill(0).map((_, i) => (
                  <div key={i} style={styles.fichaReverso}>🎴</div>
                ))}
              </div>
              <div style={styles.fichasCount}>{otroJugador.fichas.length} fichas</div>
            </div>
          );
        })}
      </div>

      {/* Pozo (solo 2 jugadores) */}
      {estado.config?.jugadores === 2 && (
        <div style={styles.pozoContainer}>
          <div style={styles.pozoTitle}>Pozo: {estado.pozo.length} fichas</div>
        </div>
      )}

      {/* Mis fichas */}
      <div style={styles.misFichasContainer}>
        <div style={styles.misFichasTitle}>
          {esMiTurno ? '▶ Tu turno' : 'Esperando...'}
        </div>
        <div style={styles.misFichas}>
          {jugador.fichas.map((ficha, idx) => {
            const esJugable = jugables.some(j => j[0] === ficha[0] && j[1] === ficha[1]);
            const esSeleccionada = false; // Se puede mejorar con estado local
            return (
              <div
                key={idx}
                style={{
                  ...styles.fichaMia,
                  border: esJugable && esMiTurno ? '3px solid #FF6B35' : '2px solid #333',
                  opacity: esJugable && esMiTurno ? 1 : 0.7,
                  transform: esSeleccionada ? 'scale(1.1)' : 'scale(1)',
                }}
                onClick={() => {
                  if (esJugable && esMiTurno) {
                    onColocarFicha(ficha);
                  }
                }}
              >
                <div style={styles.fichaLado}>{ficha[0]}</div>
                <div style={styles.fichaDivider} />
                <div style={styles.fichaLado}>{ficha[1]}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Botones de acción */}
      {esMiTurno && (
        <div style={styles.accionesContainer}>
          {puedeRobar && (
            <button style={styles.btnAccion} onClick={onRobar}>
              🎴 Robar del pozo
            </button>
          )}
          {puedePasar && (
            <button style={styles.btnAccion} onClick={onPasar}>
              ⏭️ Pasar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ronda Terminada ─────────────────────────────────────────────────────────
function RondaTerminada({ ganador, puntajes, config, esHost, onNuevaRonda }: {
  ganador: string;
  puntajes: Record<string, number>;
  config: ConfigSala;
  esHost: boolean;
  onNuevaRonda: () => void;
}) {
  return (
    <div style={styles.fullPage}>
      <div style={styles.resultadoCard}>
        <div style={styles.resultadoTitle}>🎉 ¡Ronda Terminada!</div>
        <div style={styles.ganadorDisplay}>Ganador: {ganador}</div>
        <div style={styles.puntajesDisplay}>
          <div style={styles.puntajesTitle}>Puntajes:</div>
          {Object.entries(puntajes).map(([nom, pts]) => (
            <div key={nom} style={styles.puntajeItem}>
              {nom}: {pts} puntos
            </div>
          ))}
        </div>
        {esHost && (
          <button style={styles.btnPrimary} onClick={onNuevaRonda}>
            Nueva Ronda
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Partido Terminado ───────────────────────────────────────────────────────
function PartidoTerminado({ ganador, puntajes }: {
  ganador: string;
  puntajes: Record<string, number>;
}) {
  return (
    <div style={styles.fullPage}>
      <div style={styles.resultadoCard}>
        <div style={styles.resultadoTitle}>🏆 ¡Partido Terminado!</div>
        <div style={styles.ganadorDisplay}>Ganador: {ganador}</div>
        <div style={styles.puntajesDisplay}>
          <div style={styles.puntajesTitle}>Puntajes finales:</div>
          {Object.entries(puntajes).map(([nom, pts]) => (
            <div key={nom} style={styles.puntajeItem}>
              {nom}: {pts} puntos
            </div>
          ))}
        </div>
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
    justifyContent: 'center',
    fontFamily: "'Courier New', monospace",
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
    color: '#FF6B35',
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
  configCard: {
    position: 'relative',
    background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)',
    border: '2px solid #FF6B35',
    borderRadius: 16,
    padding: '36px 28px',
    width: '90%',
    maxWidth: 400,
    margin: '50px auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  codigoDisplay: {
    fontSize: 18,
    fontWeight: 700,
    color: '#FF6B35',
    letterSpacing: 4,
    textAlign: 'center',
  },
  configSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  configLabel: {
    color: '#888',
    fontSize: 14,
    fontWeight: 700,
  },
  configButtons: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
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
    minWidth: 120,
  },
  esperaCard: {
    position: 'relative',
    background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)',
    border: '2px solid #FF6B35',
    borderRadius: 16,
    padding: '36px 28px',
    width: '90%',
    maxWidth: 400,
    margin: '50px auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  configInfo: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  jugadoresList: {
    background: '#1a1a1a',
    borderRadius: 10,
    padding: '16px',
    border: '1px solid #333',
  },
  jugadoresTitle: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 12,
  },
  jugadorItem: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  esperandoText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  juegoContainer: {
    width: '100%',
    minHeight: '100vh',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)',
    border: '1px solid #FF6B35',
    borderRadius: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  puntajesContainer: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
  },
  puntajeItem: {
    color: '#fff',
    fontSize: 14,
  },
  cadenaContainer: {
    background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)',
    border: '2px solid #FF6B35',
    borderRadius: 12,
    padding: '16px',
    minHeight: 120,
  },
  cadenaTitle: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 12,
  },
  cadena: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 60,
  },
  extremosInfo: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  fichaCadena: {
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    border: '2px solid #333',
    borderRadius: 4,
    width: 40,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    color: '#000',
    fontWeight: 700,
    fontSize: 18,
  },
  fichaLado: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fichaDivider: {
    width: '80%',
    height: 2,
    background: '#333',
  },
  otrosJugadoresContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  otroJugador: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 10,
    padding: '12px',
  },
  otroJugadorNombre: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 8,
  },
  fichasReverso: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
  },
  fichaReverso: {
    width: 30,
    height: 45,
    background: '#333',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
  },
  fichasCount: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  pozoContainer: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 10,
    padding: '12px',
    textAlign: 'center',
  },
  pozoTitle: {
    color: '#888',
    fontSize: 14,
  },
  misFichasContainer: {
    background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)',
    border: '2px solid #FF6B35',
    borderRadius: 12,
    padding: '16px',
  },
  misFichasTitle: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 12,
    textAlign: 'center',
  },
  misFichas: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  fichaMia: {
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    border: '2px solid #333',
    borderRadius: 6,
    width: 50,
    height: 75,
    justifyContent: 'center',
    alignItems: 'center',
    color: '#000',
    fontWeight: 700,
    fontSize: 20,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  accionesContainer: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  btnAccion: {
    padding: '12px 24px',
    background: '#1a1a1a',
    border: '2px solid #FF6B35',
    borderRadius: 10,
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
  },
  resultadoCard: {
    position: 'relative',
    background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)',
    border: '2px solid #FF6B35',
    borderRadius: 16,
    padding: '36px 28px',
    width: '90%',
    maxWidth: 400,
    margin: '50px auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    textAlign: 'center',
  },
  resultadoTitle: {
    fontSize: 32,
    fontWeight: 900,
    color: '#FF6B35',
    textShadow: '0 0 20px rgba(255, 107, 53, 0.8)',
  },
  ganadorDisplay: {
    fontSize: 24,
    fontWeight: 700,
    color: '#fff',
  },
  puntajesDisplay: {
    background: '#1a1a1a',
    borderRadius: 10,
    padding: '16px',
    border: '1px solid #333',
  },
  puntajesTitle: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 12,
  },
};

export default DominoView;
