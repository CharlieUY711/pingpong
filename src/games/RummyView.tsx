/**
 * RummyView.tsx — Rummy Canasta en Parejas
 * Supabase Realtime — funciona en redes distintas
 * 4 jugadores en 2 parejas (1+3 vs 2+4)
 * Optimizado para celular en landscape
 */
import React, { useState, useEffect, useRef } from 'react';

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
const CARTAS_POR_JUGADOR = 11;
const PUNTOS_VICTORIA = 5000;
const PUNTOS_CANASTA_PURA = 500;
const PUNTOS_CANASTA_IMPURA = 300;

// ─── Tipos ───────────────────────────────────────────────────────────────────
type Palo = 'corazones' | 'diamantes' | 'picas' | 'treboles';
type Figura = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
type TipoComodin = 'joker' | 'dos-comodin';

interface Carta {
  id: string;
  valor: Figura | TipoComodin;
  palo?: Palo; // undefined para comodines
  esComodin: boolean;
}

interface Combinacion {
  id: string;
  tipo: 'grupo' | 'escalera';
  cartas: Carta[];
  esCanasta: boolean; // 7+ cartas
  esPura: boolean; // sin comodines
  creador: string; // nombre del jugador que la creó
}

interface ManoJugador {
  cartas: Carta[];
  nombre: string;
  posicion: 1 | 2 | 3 | 4;
}

interface EstadoJuego {
  fase: 'esperando' | 'jugando' | 'ronda-terminada' | 'partida-terminada';
  jugadores: ManoJugador[];
  turno: number; // índice del jugador (0-3)
  mazo: Carta[];
  descarte: Carta[];
  combinaciones: Combinacion[];
  puntajes: {
    pareja1: number; // jugadores 1 y 3
    pareja2: number; // jugadores 2 y 4
  };
  rondaActual: number;
  cerradoPor?: string; // nombre de la pareja que cerró
  ganador?: 'pareja1' | 'pareja2';
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

async function getSala(id: string): Promise<Sala | null> {
  const r = await fetch(`${SUPA_URL}/rest/v1/rummy_salas?id=eq.${id}`, { headers: HEADERS });
  const d = await r.json();
  return d[0] || null;
}

async function patchSala(id: string, data: Partial<Sala>) {
  await fetch(`${SUPA_URL}/rest/v1/rummy_salas?id=eq.${id}`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify(data),
  });
}

// ─── Generación de mazo ─────────────────────────────────────────────────────
function crearMazo(): Carta[] {
  const mazo: Carta[] = [];
  const palos: Palo[] = ['corazones', 'diamantes', 'picas', 'treboles'];
  const figuras: Figura[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  // 2 mazos completos
  for (let mazoNum = 0; mazoNum < 2; mazoNum++) {
    for (const palo of palos) {
      for (const figura of figuras) {
        mazo.push({
          id: `${mazoNum}-${palo}-${figura}`,
          valor: figura,
          palo,
          esComodin: false,
        });
      }
    }
  }

  // 4 comodines (2 jokers + 2 dos-comodin)
  for (let i = 0; i < 2; i++) {
    mazo.push({
      id: `joker-${i}`,
      valor: 'joker',
      esComodin: true,
    });
  }
  for (let i = 0; i < 2; i++) {
    mazo.push({
      id: `dos-comodin-${i}`,
      valor: 'dos-comodin',
      esComodin: true,
    });
  }

  // Mezclar
  for (let i = mazo.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mazo[i], mazo[j]] = [mazo[j], mazo[i]];
  }

  return mazo;
}

// ─── Validación de combinaciones ────────────────────────────────────────────
function esGrupoValido(cartas: Carta[]): boolean {
  if (cartas.length < 3) return false;
  
  // Agrupar por valor real (sin comodines)
  const valores: Record<string, Carta[]> = {};
  let comodines = 0;

  for (const carta of cartas) {
    if (carta.esComodin) {
      comodines++;
    } else {
      const key = carta.valor;
      if (!valores[key]) valores[key] = [];
      valores[key].push(carta);
    }
  }

  // Debe haber un solo valor base (sin contar comodines)
  const valoresUnicos = Object.keys(valores);
  if (valoresUnicos.length !== 1) return false;

  // Todas las cartas del mismo valor deben tener palos distintos
  const palosUsados = new Set<string>();
  for (const carta of valores[valoresUnicos[0]]) {
    if (palosUsados.has(carta.palo!)) return false;
    palosUsados.add(carta.palo!);
  }

  return true;
}

function esEscaleraValida(cartas: Carta[]): boolean {
  if (cartas.length < 3) return false;

  // Separar comodines y cartas normales
  const comodines: Carta[] = [];
  const normales: Carta[] = [];

  for (const carta of cartas) {
    if (carta.esComodin) {
      comodines.push(carta);
    } else {
      normales.push(carta);
    }
  }

  // Todas las normales deben ser del mismo palo
  if (normales.length > 0) {
    const primerPalo = normales[0].palo;
    if (!normales.every(c => c.palo === primerPalo)) return false;
  }

  // Ordenar por valor
  const ordenValores: Record<string, number> = {
    'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
    '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13,
  };

  normales.sort((a, b) => ordenValores[a.valor as Figura] - ordenValores[b.valor as Figura]);

  // Verificar que sean consecutivas (usando comodines para llenar huecos)
  if (normales.length === 0) {
    // Solo comodines: válido si hay al menos 3
    return comodines.length >= 3;
  }

  let huecos = 0;
  for (let i = 1; i < normales.length; i++) {
    const diff = ordenValores[normales[i].valor as Figura] - ordenValores[normales[i - 1].valor as Figura];
    if (diff > 1) {
      huecos += diff - 1;
    }
  }

  // También verificar huecos al inicio y final
  const primerValor = ordenValores[normales[0].valor as Figura];
  const ultimoValor = ordenValores[normales[normales.length - 1].valor as Figura];
  const rangoNecesario = ultimoValor - primerValor + 1;
  const huecosTotales = rangoNecesario - normales.length;

  return comodines.length >= huecosTotales;
}

function calcularPuntosCarta(carta: Carta): number {
  if (carta.valor === 'joker') return 50;
  if (carta.valor === 'dos-comodin') return 20;
  if (carta.valor === 'A') return 20;
  if (['J', 'Q', 'K'].includes(carta.valor)) return 10;
  return Number(carta.valor) || 0;
}

// ─── Componente principal ────────────────────────────────────────────────────
export function RummyView() {
  const [fase, setFase] = useState<'lobby' | 'sala' | 'juego'>('lobby');
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoInput, setCodigoInput] = useState('');
  const [sala, setSala] = useState<Sala | null>(null);
  const [error, setError] = useState('');
  const [esHost, setEsHost] = useState(false);
  const [miPosicion, setMiPosicion] = useState<1 | 2 | 3 | 4 | null>(null);

  // ── Crear sala ──────────────────────────────────────────────────────────────
  const handleCrear = async () => {
    if (!nombre.trim()) { setError('Ingresá tu nombre'); return; }
    const code = genCode();
    const estadoInicial: EstadoJuego = {
      fase: 'esperando',
      jugadores: [{
        nombre: nombre.trim(),
        posicion: 1,
        cartas: [],
      }],
      turno: 0,
      mazo: [],
      descarte: [],
      combinaciones: [],
      puntajes: { pareja1: 0, pareja2: 0 },
      rondaActual: 1,
    };

    await fetch(`${SUPA_URL}/rest/v1/rummy_salas`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        id: code,
        host: nombre.trim(),
        estado_json: estadoInicial,
      }),
    });

    setCodigo(code);
    setEsHost(true);
    setMiPosicion(1);
    setFase('sala');
  };

  // ── Unirse ──────────────────────────────────────────────────────────────────
  const handleUnirse = async () => {
    if (!nombre.trim()) { setError('Ingresá tu nombre'); return; }
    if (!codigoInput.trim()) { setError('Ingresá el código'); return; }
    
    const s = await getSala(codigoInput.toUpperCase());
    if (!s) { setError('Sala no encontrada'); return; }

    const estado = s.estado_json;
    if (estado.jugadores.length >= 4) { setError('Sala llena'); return; }
    if (estado.jugadores.some(j => j.nombre === nombre.trim())) { setError('Ya hay un jugador con ese nombre'); return; }

    const nuevaPosicion = (estado.jugadores.length + 1) as 1 | 2 | 3 | 4;
    estado.jugadores.push({
      nombre: nombre.trim(),
      posicion: nuevaPosicion,
      cartas: [],
    });

    await patchSala(codigoInput.toUpperCase(), { estado_json: estado });
    setCodigo(codigoInput.toUpperCase());
    setEsHost(false);
    setMiPosicion(nuevaPosicion);
    setFase('sala');
  };

  // ── Polling de sala ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (fase !== 'sala' || !codigo) return;
    const iv = setInterval(async () => {
      const s = await getSala(codigo);
      if (s) {
        setSala(s);
        if (s.estado_json.fase === 'jugando') {
          setFase('juego');
        }
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [fase, codigo]);

  // ── Iniciar juego (solo host) ─────────────────────────────────────────────
  const handleIniciar = async () => {
    if (!esHost || !sala) return;
    const estado = { ...sala.estado_json };
    
    if (estado.jugadores.length !== 4) {
      setError('Se necesitan exactamente 4 jugadores');
      return;
    }

    // Crear y repartir mazo
    const mazo = crearMazo();
    const manos: Carta[][] = [[], [], [], []];
    
    for (let i = 0; i < CARTAS_POR_JUGADOR; i++) {
      for (let j = 0; j < 4; j++) {
        if (mazo.length > 0) {
          manos[j].push(mazo.pop()!);
        }
      }
    }

    // Asignar cartas a jugadores
    estado.jugadores.forEach((jug, idx) => {
      jug.cartas = manos[idx];
    });

    estado.mazo = mazo;
    estado.descarte = mazo.length > 0 ? [mazo.pop()!] : [];
    estado.fase = 'jugando';
    estado.turno = 0;

    await patchSala(codigo, { estado_json: estado });
  };

  // ── Render fases ───────────────────────────────────────────────────────────
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
      <SalaEspera
        codigo={codigo}
        nombre={nombre}
        sala={sala}
        esHost={esHost}
        onIniciar={handleIniciar}
        error={error}
      />
    );
  }

  if (fase === 'juego' && sala && miPosicion) {
    return (
      <Juego
        codigo={codigo}
        nombre={nombre}
        sala={sala}
        miPosicion={miPosicion}
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
        <div style={styles.title}>🃏 Rummy Canasta</div>
        <div style={styles.subtitle}>4 jugadores en parejas</div>

        <input
          style={styles.input}
          placeholder="Tu nombre"
          value={nombre}
          onChange={e => { setNombre(e.target.value); setError(''); }}
          maxLength={12}
        />

        <button style={styles.btnPrimary} onClick={onCrear}>
          🎮 Crear sala
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

// ─── Sala de Espera ─────────────────────────────────────────────────────────
function SalaEspera({ codigo, nombre, sala, esHost, onIniciar, error }: {
  codigo: string;
  nombre: string;
  sala: Sala;
  esHost: boolean;
  onIniciar: () => void;
  error: string;
}) {
  const estado = sala.estado_json;
  const parejas = [
    estado.jugadores.filter(j => j.posicion === 1 || j.posicion === 3),
    estado.jugadores.filter(j => j.posicion === 2 || j.posicion === 4),
  ];

  return (
    <div style={styles.fullPage}>
      <div style={styles.salaCard}>
        <div style={styles.title}>Sala: {codigo}</div>
        <div style={styles.subtitle}>Esperando jugadores (4/4)</div>

        <div style={styles.parejasContainer}>
          <div style={styles.parejaBox}>
            <div style={styles.parejaTitle}>Pareja 1 (Jugadores 1 y 3)</div>
            {parejas[0].map(j => (
              <div key={j.nombre} style={styles.jugadorItem}>
                {j.nombre} {j.nombre === nombre && '(Tú)'}
              </div>
            ))}
            {parejas[0].length < 2 && <div style={styles.jugadorItemVacio}>Esperando...</div>}
          </div>

          <div style={styles.parejaBox}>
            <div style={styles.parejaTitle}>Pareja 2 (Jugadores 2 y 4)</div>
            {parejas[1].map(j => (
              <div key={j.nombre} style={styles.jugadorItem}>
                {j.nombre} {j.nombre === nombre && '(Tú)'}
              </div>
            ))}
            {parejas[1].length < 2 && <div style={styles.jugadorItemVacio}>Esperando...</div>}
          </div>
        </div>

        {estado.jugadores.length === 4 && esHost && (
          <button style={styles.btnPrimary} onClick={onIniciar}>
            ▶ Iniciar partida
          </button>
        )}

        {estado.jugadores.length < 4 && (
          <div style={styles.esperandoText}>
            Esperando {4 - estado.jugadores.length} jugador{4 - estado.jugadores.length > 1 ? 'es' : ''}...
          </div>
        )}

        {error && <div style={styles.errorMsg}>{error}</div>}
      </div>
    </div>
  );
}

// ─── Juego ──────────────────────────────────────────────────────────────────
function Juego({ codigo, nombre, sala, miPosicion, onActualizarSala }: {
  codigo: string;
  nombre: string;
  sala: Sala;
  miPosicion: 1 | 2 | 3 | 4;
  onActualizarSala: (s: Sala) => void;
}) {
  const [estado, setEstado] = useState<EstadoJuego>(sala.estado_json);
  const [cartaSeleccionada, setCartaSeleccionada] = useState<Carta | null>(null);
  const [combinacionTemporal, setCombinacionTemporal] = useState<Carta[]>([]);
  const [mostrarValidar, setMostrarValidar] = useState(false);
  const [error, setError] = useState('');

  // Polling del estado
  useEffect(() => {
    const iv = setInterval(async () => {
      const s = await getSala(codigo);
      if (s) {
        setEstado(s.estado_json);
        onActualizarSala(s);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [codigo, onActualizarSala]);

  const miJugador = estado.jugadores.find(j => j.nombre === nombre);
  const esMiTurno = estado.jugadores[estado.turno]?.nombre === nombre;
  const miPareja = miPosicion === 1 || miPosicion === 3 ? 'pareja1' : 'pareja2';
  const esHost = sala.host === nombre;

  // ── Robar del mazo ─────────────────────────────────────────────────────────
  const handleRobarMazo = async () => {
    if (!esMiTurno || estado.mazo.length === 0) return;
    const nuevoEstado = { ...estado };
    const carta = nuevoEstado.mazo.pop()!;
    miJugador!.cartas.push(carta);
    await patchSala(codigo, { estado_json: nuevoEstado });
    setEstado(nuevoEstado);
  };

  // ── Robar del descarte ─────────────────────────────────────────────────────
  const handleRobarDescarte = async () => {
    if (!esMiTurno || estado.descarte.length === 0) return;
    const nuevoEstado = { ...estado };
    const carta = nuevoEstado.descarte.pop()!;
    miJugador!.cartas.push(carta);
    await patchSala(codigo, { estado_json: nuevoEstado });
    setEstado(nuevoEstado);
  };

  // ── Seleccionar carta ──────────────────────────────────────────────────────
  const handleSeleccionarCarta = (carta: Carta) => {
    if (!esMiTurno) return;
    if (cartaSeleccionada?.id === carta.id) {
      setCartaSeleccionada(null);
    } else {
      setCartaSeleccionada(carta);
    }
  };

  // ── Agregar a combinación temporal ─────────────────────────────────────────
  const handleAgregarACombinacion = (carta: Carta) => {
    if (!cartaSeleccionada || cartaSeleccionada.id !== carta.id) return;
    setCombinacionTemporal([...combinacionTemporal, carta]);
    setCartaSeleccionada(null);
    setMostrarValidar(true);
  };

  // ── Bajar combinación ───────────────────────────────────────────────────────
  const handleBajarCombinacion = async () => {
    if (combinacionTemporal.length < 3) {
      setError('Mínimo 3 cartas para bajar');
      return;
    }

    const esGrupo = esGrupoValido(combinacionTemporal);
    const esEscalera = esEscaleraValida(combinacionTemporal);

    if (!esGrupo && !esEscalera) {
      setError('Combinación inválida');
      return;
    }

    const nuevoEstado = { ...estado };
    const esCanasta = combinacionTemporal.length >= 7;
    const tieneComodines = combinacionTemporal.some(c => c.esComodin);
    const esPura = !tieneComodines;

    // Remover cartas de la mano
    for (const carta of combinacionTemporal) {
      const idx = miJugador!.cartas.findIndex(c => c.id === carta.id);
      if (idx >= 0) miJugador!.cartas.splice(idx, 1);
    }

    const nuevaCombinacion: Combinacion = {
      id: `comb-${Date.now()}`,
      tipo: esGrupo ? 'grupo' : 'escalera',
      cartas: combinacionTemporal,
      esCanasta,
      esPura,
      creador: nombre,
    };

    nuevoEstado.combinaciones.push(nuevaCombinacion);
    await patchSala(codigo, { estado_json: nuevoEstado });
    setEstado(nuevoEstado);
    setCombinacionTemporal([]);
    setMostrarValidar(false);
  };

  // ── Agregar a combinación existente ───────────────────────────────────────
  const handleAgregarAExistente = async (combinacionId: string) => {
    if (!cartaSeleccionada) return;
    const nuevoEstado = { ...estado };
    const comb = nuevoEstado.combinaciones.find(c => c.id === combinacionId);
    if (!comb) return;

    // Validar que la carta puede agregarse
    comb.cartas.push(cartaSeleccionada);
    const idx = miJugador!.cartas.findIndex(c => c.id === cartaSeleccionada!.id);
    if (idx >= 0) miJugador!.cartas.splice(idx, 1);

    // Actualizar canasta si aplica
    if (comb.cartas.length >= 7 && !comb.esCanasta) {
      comb.esCanasta = true;
      comb.esPura = !comb.cartas.some(c => c.esComodin);
    }

    await patchSala(codigo, { estado_json: nuevoEstado });
    setEstado(nuevoEstado);
    setCartaSeleccionada(null);
  };

  // ── Descartar ──────────────────────────────────────────────────────────────
  const handleDescartar = async () => {
    if (!cartaSeleccionada || !esMiTurno) return;
    const nuevoEstado = { ...estado };
    const idx = miJugador!.cartas.findIndex(c => c.id === cartaSeleccionada!.id);
    if (idx >= 0) {
      const carta = miJugador!.cartas.splice(idx, 1)[0];
      nuevoEstado.descarte.push(carta);
      nuevoEstado.turno = (nuevoEstado.turno + 1) % 4;
    }
    await patchSala(codigo, { estado_json: nuevoEstado });
    setEstado(nuevoEstado);
    setCartaSeleccionada(null);
  };

  // ── Cerrar ────────────────────────────────────────────────────────────────
  const handleCerrar = async () => {
    if (!esMiTurno) return;
    const nuevoEstado = { ...estado };
    
    // Verificar que la pareja tenga al menos una canasta
    const canastasPareja = nuevoEstado.combinaciones.filter(c => {
      const creador = estado.jugadores.find(j => j.nombre === c.creador);
      return creador && (creador.posicion === miPosicion || 
        (miPareja === 'pareja1' && (creador.posicion === 1 || creador.posicion === 3)) ||
        (miPareja === 'pareja2' && (creador.posicion === 2 || creador.posicion === 4)));
    }).filter(c => c.esCanasta);

    if (canastasPareja.length === 0) {
      setError('Tu pareja debe tener al menos una canasta para cerrar');
      return;
    }

    // Verificar que todos los jugadores de la pareja hayan bajado todas sus cartas
    const jugadoresPareja = nuevoEstado.jugadores.filter(j => 
      (miPareja === 'pareja1' && (j.posicion === 1 || j.posicion === 3)) ||
      (miPareja === 'pareja2' && (j.posicion === 2 || j.posicion === 4))
    );

    const todosBajaron = jugadoresPareja.every(j => j.cartas.length === 0);
    if (!todosBajaron) {
      setError('Todos los jugadores de tu pareja deben bajar todas sus cartas');
      return;
    }

    // Calcular puntuación
    let puntosPareja = 0;
    let puntosOponente = 0;

    // Puntos de combinaciones
    nuevoEstado.combinaciones.forEach(comb => {
      const creador = nuevoEstado.jugadores.find(j => j.nombre === comb.creador);
      if (!creador) return;
      const esDePareja = (miPareja === 'pareja1' && (creador.posicion === 1 || creador.posicion === 3)) ||
                        (miPareja === 'pareja2' && (creador.posicion === 2 || creador.posicion === 4));
      
      const puntosComb = comb.cartas.reduce((sum, c) => sum + calcularPuntosCarta(c), 0);
      if (esDePareja) {
        puntosPareja += puntosComb;
        if (comb.esCanasta) {
          puntosPareja += comb.esPura ? PUNTOS_CANASTA_PURA : PUNTOS_CANASTA_IMPURA;
        }
      } else {
        puntosOponente += puntosComb;
        if (comb.esCanasta) {
          puntosOponente += comb.esPura ? PUNTOS_CANASTA_PURA : PUNTOS_CANASTA_IMPURA;
        }
      }
    });

    // Puntos negativos de cartas en mano del oponente
    nuevoEstado.jugadores.forEach(j => {
      const esOponente = (miPareja === 'pareja1' && (j.posicion === 2 || j.posicion === 4)) ||
                         (miPareja === 'pareja2' && (j.posicion === 1 || j.posicion === 3));
      if (esOponente) {
        const puntosMano = j.cartas.reduce((sum, c) => sum + calcularPuntosCarta(c), 0);
        puntosOponente -= puntosMano;
        puntosPareja += puntosMano;
      }
    });

    nuevoEstado.puntajes[miPareja] += puntosPareja;
    nuevoEstado.puntajes[miPareja === 'pareja1' ? 'pareja2' : 'pareja1'] += puntosOponente;
    nuevoEstado.cerradoPor = miPareja;
    nuevoEstado.fase = 'ronda-terminada';

    // Verificar victoria
    if (nuevoEstado.puntajes[miPareja] >= PUNTOS_VICTORIA) {
      nuevoEstado.fase = 'partida-terminada';
      nuevoEstado.ganador = miPareja;
    }

    await patchSala(codigo, { estado_json: nuevoEstado });
    setEstado(nuevoEstado);
  };

  // ── Nueva ronda ────────────────────────────────────────────────────────────
  const handleNuevaRonda = async () => {
    if (!esHost) return;
    const nuevoEstado: EstadoJuego = {
      fase: 'jugando',
      jugadores: estado.jugadores.map(j => ({ ...j, cartas: [] })),
      turno: 0,
      mazo: [],
      descarte: [],
      combinaciones: [],
      puntajes: estado.puntajes,
      rondaActual: estado.rondaActual + 1,
    };

    const mazo = crearMazo();
    const manos: Carta[][] = [[], [], [], []];
    
    for (let i = 0; i < CARTAS_POR_JUGADOR; i++) {
      for (let j = 0; j < 4; j++) {
        if (mazo.length > 0) {
          manos[j].push(mazo.pop()!);
        }
      }
    }

    nuevoEstado.jugadores.forEach((jug, idx) => {
      jug.cartas = manos[idx];
    });

    nuevoEstado.mazo = mazo;
    nuevoEstado.descarte = mazo.length > 0 ? [mazo.pop()!] : [];

    await patchSala(codigo, { estado_json: nuevoEstado });
    setEstado(nuevoEstado);
  };

  if (!miJugador) return <div style={styles.fullPage}>Cargando...</div>;

  return (
    <div style={styles.juegoContainer}>
      {/* Header con puntajes */}
      <div style={styles.header}>
        <div style={styles.puntajeBox}>
          <div style={styles.puntajeLabel}>Pareja 1</div>
          <div style={styles.puntajeNum}>{estado.puntajes.pareja1}</div>
        </div>
        <div style={styles.codigoDisplay}>Ronda {estado.rondaActual}</div>
        <div style={styles.puntajeBox}>
          <div style={styles.puntajeLabel}>Pareja 2</div>
          <div style={styles.puntajeNum}>{estado.puntajes.pareja2}</div>
        </div>
      </div>

      {/* Mesa con 4 posiciones */}
      <div style={styles.mesa}>
        {[1, 2, 3, 4].map(pos => {
          const jug = estado.jugadores.find(j => j.posicion === pos);
          const esAliado = (miPareja === 'pareja1' && (pos === 1 || pos === 3)) ||
                          (miPareja === 'pareja2' && (pos === 2 || pos === 4));
          const esMiPosicion = pos === miPosicion;
          const esSuTurno = estado.jugadores[estado.turno]?.posicion === pos;

          return (
            <div
              key={pos}
              style={{
                ...styles.posicionJugador,
                ...(pos === 1 ? styles.posicionTop) : {},
                ...(pos === 2 ? styles.posicionRight) : {},
                ...(pos === 3 ? styles.posicionBottom) : {},
                ...(pos === 4 ? styles.posicionLeft) : {},
                ...(esAliado ? styles.posicionAliado : {}),
                ...(esSuTurno ? styles.posicionTurno : {}),
              }}
            >
              <div style={styles.nombreJugador}>
                {jug?.nombre || `Jugador ${pos}`}
                {esSuTurno && ' ⭐'}
              </div>
              {!esMiPosicion && (
                <div style={styles.cartasOponente}>
                  {jug?.cartas.length || 0} cartas
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Combinaciones en el centro */}
      <div style={styles.combinacionesArea}>
        {estado.combinaciones.map(comb => (
          <div key={comb.id} style={styles.combinacionBox}>
            <div style={styles.combinacionHeader}>
              {comb.tipo === 'grupo' ? '📦 Grupo' : '📊 Escalera'}
              {comb.esCanasta && (comb.esPura ? ' 🏆 Canasta Pura' : ' 🎯 Canasta')}
            </div>
            <div style={styles.combinacionCartas}>
              {comb.cartas.map(c => (
                <CartaComponent key={c.id} carta={c} size="small" />
              ))}
            </div>
            {cartaSeleccionada && esMiTurno && (
              <button
                style={styles.btnAgregar}
                onClick={() => handleAgregarAExistente(comb.id)}
              >
                Agregar carta
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Área de juego del jugador */}
      <div style={styles.areaJugador}>
        {/* Mazo y descarte */}
        <div style={styles.mazoArea}>
          <button
            style={{ ...styles.btnMazo, opacity: esMiTurno && estado.mazo.length > 0 ? 1 : 0.5 }}
            onClick={handleRobarMazo}
            disabled={!esMiTurno || estado.mazo.length === 0}
          >
            🎴 Mazo ({estado.mazo.length})
          </button>
          {estado.descarte.length > 0 && (
            <div
              style={styles.descarte}
              onClick={handleRobarDescarte}
            >
              <CartaComponent
                carta={estado.descarte[estado.descarte.length - 1]}
                size="medium"
                seleccionada={false}
              />
            </div>
          )}
        </div>

        {/* Combinación temporal */}
        {combinacionTemporal.length > 0 && (
          <div style={styles.combinacionTemp}>
            <div style={styles.combinacionTempHeader}>Combinación temporal</div>
            <div style={styles.combinacionTempCartas}>
              {combinacionTemporal.map(c => (
                <CartaComponent key={c.id} carta={c} size="medium" />
              ))}
            </div>
            {mostrarValidar && (
              <button style={styles.btnValidar} onClick={handleBajarCombinacion}>
                Bajar combinación
              </button>
            )}
          </div>
        )}

        {/* Mis cartas */}
        <div style={styles.misCartas}>
          {miJugador.cartas.map(c => (
            <CartaComponent
              key={c.id}
              carta={c}
              size="large"
              seleccionada={cartaSeleccionada?.id === c.id}
              onClick={() => handleSeleccionarCarta(c)}
            />
          ))}
        </div>

        {/* Acciones */}
        {esMiTurno && (
          <div style={styles.acciones}>
            {cartaSeleccionada && (
              <>
                <button
                  style={styles.btnAccion}
                  onClick={() => {
                    setCombinacionTemporal([...combinacionTemporal, cartaSeleccionada]);
                    const idx = miJugador.cartas.findIndex(c => c.id === cartaSeleccionada!.id);
                    if (idx >= 0) {
                      miJugador.cartas.splice(idx, 1);
                      setCartaSeleccionada(null);
                      setMostrarValidar(true);
                    }
                  }}
                >
                  Agregar a combinación
                </button>
                <button style={styles.btnAccion} onClick={handleDescartar}>
                  Descartar
                </button>
              </>
            )}
            <button
              style={styles.btnCerrar}
              onClick={handleCerrar}
            >
              Cerrar ronda
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={styles.errorMsg} onClick={() => setError('')}>
          {error}
        </div>
      )}

      {/* Ronda terminada */}
      {estado.fase === 'ronda-terminada' && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalTitle}>Ronda terminada</div>
            <div style={styles.modalContent}>
              Cerrada por: {estado.cerradoPor === 'pareja1' ? 'Pareja 1' : 'Pareja 2'}
              <br />
              Puntos Pareja 1: {estado.puntajes.pareja1}
              <br />
              Puntos Pareja 2: {estado.puntajes.pareja2}
            </div>
            {esHost && (
              <button style={styles.btnPrimary} onClick={handleNuevaRonda}>
                Nueva ronda
              </button>
            )}
          </div>
        </div>
      )}

      {/* Partida terminada */}
      {estado.fase === 'partida-terminada' && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalTitle}>🏆 Partida terminada</div>
            <div style={styles.modalContent}>
              Ganador: {estado.ganador === 'pareja1' ? 'Pareja 1' : 'Pareja 2'}
            </div>
            <button style={styles.btnPrimary} onClick={() => window.location.reload()}>
              Nueva partida
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente de Carta ─────────────────────────────────────────────────────
function CartaComponent({ carta, size, seleccionada, onClick }: {
  carta: Carta;
  size: 'small' | 'medium' | 'large';
  seleccionada?: boolean;
  onClick?: () => void;
}) {
  const sizeStyles = {
    small: { width: 30, height: 42, fontSize: 10 },
    medium: { width: 45, height: 63, fontSize: 14 },
    large: { width: 60, height: 84, fontSize: 18 },
  };

  const estilo = sizeStyles[size];
  const paloEmoji: Record<Palo, string> = {
    corazones: '♥',
    diamantes: '♦',
    picas: '♠',
    treboles: '♣',
  };
  const paloColor: Record<Palo, string> = {
    corazones: '#ff0000',
    diamantes: '#ff0000',
    picas: '#000000',
    treboles: '#000000',
  };

  let displayValor = '';
  let displayPalo = '';
  let esRojo = false;

  if (carta.esComodin) {
    if (carta.valor === 'joker') {
      displayValor = '🃏';
      displayPalo = 'JOKER';
    } else {
      displayValor = '2';
      displayPalo = '🃏';
    }
  } else {
    displayValor = carta.valor;
    displayPalo = paloEmoji[carta.palo!];
    esRojo = carta.palo === 'corazones' || carta.palo === 'diamantes';
  }

  return (
    <div
      style={{
        ...styles.carta,
        ...estilo,
        border: seleccionada ? '3px solid #FF6B35' : '1px solid #333',
        background: seleccionada ? '#2a2a2a' : '#fff',
        color: esRojo ? '#ff0000' : '#000',
        cursor: onClick ? 'pointer' : 'default',
        transform: seleccionada ? 'translateY(-10px)' : 'none',
      }}
      onClick={onClick}
    >
      <div style={styles.cartaValor}>{displayValor}</div>
      <div style={{ ...styles.cartaPalo, color: esRojo ? '#ff0000' : '#000' }}>
        {displayPalo}
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
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Courier New', monospace",
    padding: '20px',
  },
  lobbyCard: {
    background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)',
    border: '2px solid #333',
    borderRadius: 16,
    padding: '36px 28px',
    width: '90%',
    maxWidth: 360,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  title: {
    fontSize: 48,
    fontWeight: 900,
    color: '#FF6B35',
    textAlign: 'center',
    letterSpacing: 8,
    textShadow: '0 0 40px #FF6B3560',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    letterSpacing: 2,
    textTransform: 'uppercase',
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
  salaCard: {
    background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)',
    border: '2px solid #333',
    borderRadius: 16,
    padding: '24px',
    width: '90%',
    maxWidth: 500,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  parejasContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  parejaBox: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 10,
    padding: '16px',
  },
  parejaTitle: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 12,
  },
  jugadorItem: {
    color: '#fff',
    fontSize: 14,
    padding: '8px',
    background: '#222',
    borderRadius: 6,
    marginBottom: 8,
  },
  jugadorItemVacio: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
    padding: '8px',
  },
  esperandoText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    padding: '12px',
  },
  juegoContainer: {
    width: '100%',
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Courier New', monospace",
    padding: '10px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: '#111',
    borderBottom: '1px solid #333',
    marginBottom: '10px',
  },
  puntajeBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  puntajeLabel: {
    fontSize: 12,
    color: '#888',
  },
  puntajeNum: {
    fontSize: 24,
    fontWeight: 900,
    color: '#FF6B35',
  },
  codigoDisplay: {
    fontSize: 14,
    color: '#888',
  },
  mesa: {
    position: 'relative',
    width: '100%',
    height: '300px',
    background: '#1a1a1a',
    borderRadius: 12,
    marginBottom: '10px',
    border: '2px solid #333',
  },
  posicionJugador: {
    position: 'absolute',
    padding: '12px',
    background: '#222',
    borderRadius: 8,
    border: '2px solid #333',
  },
  posicionTop: {
    top: '10px',
    left: '50%',
    transform: 'translateX(-50%)',
  },
  posicionRight: {
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
  },
  posicionBottom: {
    bottom: '10px',
    left: '50%',
    transform: 'translateX(-50%)',
  },
  posicionLeft: {
    left: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
  },
  posicionAliado: {
    borderColor: '#4ECDC4',
    background: '#1a2a2a',
  },
  posicionTurno: {
    borderColor: '#FF6B35',
    boxShadow: '0 0 20px #FF6B3560',
  },
  nombreJugador: {
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 4,
  },
  cartasOponente: {
    fontSize: 12,
    color: '#888',
  },
  combinacionesArea: {
    minHeight: '120px',
    background: '#111',
    borderRadius: 10,
    padding: '12px',
    marginBottom: '10px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    overflowY: 'auto',
    maxHeight: '200px',
  },
  combinacionBox: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 8,
    padding: '10px',
    minWidth: '200px',
  },
  combinacionHeader: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: 700,
    marginBottom: 8,
  },
  combinacionCartas: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
  },
  btnAgregar: {
    marginTop: '8px',
    padding: '6px 12px',
    background: '#333',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
  },
  areaJugador: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  mazoArea: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  btnMazo: {
    padding: '12px 20px',
    background: '#333',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  descarte: {
    cursor: 'pointer',
  },
  combinacionTemp: {
    background: '#1a1a1a',
    border: '2px dashed #FF6B35',
    borderRadius: 10,
    padding: '12px',
  },
  combinacionTempHeader: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: 700,
    marginBottom: 8,
  },
  combinacionTempCartas: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '8px',
  },
  btnValidar: {
    padding: '8px 16px',
    background: '#FF6B35',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  misCartas: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: '12px',
    background: '#111',
    borderRadius: 10,
    minHeight: '100px',
  },
  acciones: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  btnAccion: {
    padding: '10px 16px',
    background: '#333',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnCerrar: {
    padding: '10px 16px',
    background: '#d32f2f',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  carta: {
    background: '#fff',
    border: '1px solid #333',
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
    transition: 'all 0.2s',
  },
  cartaValor: {
    fontSize: 'inherit',
    fontWeight: 900,
  },
  cartaPalo: {
    fontSize: 'inherit',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: '#111',
    border: '2px solid #333',
    borderRadius: 16,
    padding: '32px',
    textAlign: 'center',
    maxWidth: '400px',
    width: '90%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 900,
    color: '#FF6B35',
    marginBottom: '16px',
  },
  modalContent: {
    fontSize: 16,
    color: '#fff',
    marginBottom: '24px',
    lineHeight: 1.6,
  },
};

export default RummyView;
