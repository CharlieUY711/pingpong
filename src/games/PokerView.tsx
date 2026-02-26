/**
 * PokerView.tsx — Texas Hold'em Poker Multijugador
 * 2 a 4 jugadores, el host dirige la mesa
 * Supabase Realtime — funciona en redes distintas
 */
import React, { useState, useEffect } from 'react';
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
const PALOS = ['♠', '♥', '♦', '♣'];
const VALORES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const FICHAS_INICIALES_OPCIONES = [500, 1000, 2000];

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Carta {
  palo: string;
  valor: string;
}

interface Jugador {
  nombre: string;
  fichas: number;
  cartasPrivadas: Carta[];
  apuestaActual: number;
  apuestaTotal: number;
  activo: boolean;
  allIn: boolean;
  retirado: boolean;
}

interface EstadoSala {
  jugadores: Record<string, Jugador>;
  cartasComunitarias: Carta[];
  mazo: Carta[];
  estado: 'esperando' | 'configurando' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  turnoActual?: string;
  bote: number;
  ciegaPequena: number;
  ciegaGrande: number;
  dealerIndex: number;
  rondaApuestas: number;
  apuestaMinima: number;
  fichasIniciales: number;
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
      mazo.push({ palo, valor });
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
  if (carta.valor === 'A') return 14;
  if (carta.valor === 'K') return 13;
  if (carta.valor === 'Q') return 12;
  if (carta.valor === 'J') return 11;
  return parseInt(carta.valor);
}

function evaluarMano(cartas: Carta[]): { tipo: string; valor: number; nombre: string } {
  if (cartas.length < 5) return { tipo: 'alta', valor: 0, nombre: 'Carta Alta' };

  // Ordenar por valor
  const ordenadas = [...cartas].sort((a, b) => valorCarta(b) - valorCarta(a));
  const valores = ordenadas.map(c => valorCarta(c));
  const palos = ordenadas.map(c => c.palo);

  // Contar valores
  const conteo: Record<number, number> = {};
  valores.forEach(v => conteo[v] = (conteo[v] || 0) + 1);
  const pares = Object.entries(conteo).filter(([_, c]) => c === 2).map(([v]) => parseInt(v)).sort((a, b) => b - a);
  const trios = Object.entries(conteo).filter(([_, c]) => c === 3).map(([v]) => parseInt(v));
  const cuartetos = Object.entries(conteo).filter(([_, c]) => c === 4).map(([v]) => parseInt(v));

  // Verificar escalera real
  const esEscaleraReal = palos.every(p => p === palos[0]) && 
    valores.includes(14) && valores.includes(13) && valores.includes(12) && 
    valores.includes(11) && valores.includes(10);
  if (esEscaleraReal) return { tipo: 'escalera_real', valor: 10, nombre: 'Escalera Real' };

  // Verificar escalera de color
  const esEscalera = valores.every((v, i) => i === 0 || v === valores[i - 1] - 1) ||
    (valores[0] === 14 && valores[1] === 5 && valores[2] === 4 && valores[3] === 3 && valores[4] === 2); // A-2-3-4-5
  const esColor = palos.every(p => p === palos[0]);
  if (esEscalera && esColor) return { tipo: 'escalera_color', valor: 9, nombre: 'Escalera de Color' };

  // Verificar poker
  if (cuartetos.length > 0) {
    const kicker = valores.find(v => v !== cuartetos[0]);
    return { tipo: 'poker', valor: 8, nombre: 'Poker', ...{ kicker } };
  }

  // Verificar full house
  if (trios.length > 0 && pares.length > 0) {
    return { tipo: 'full', valor: 7, nombre: 'Full House' };
  }

  // Verificar color
  if (esColor) return { tipo: 'color', valor: 6, nombre: 'Color' };

  // Verificar escalera
  if (esEscalera) return { tipo: 'escalera', valor: 5, nombre: 'Escalera' };

  // Verificar trío
  if (trios.length > 0) {
    const kickers = valores.filter(v => v !== trios[0]).slice(0, 2);
    return { tipo: 'trio', valor: 4, nombre: 'Trío', ...{ kickers } };
  }

  // Verificar doble par
  if (pares.length >= 2) {
    const kicker = valores.find(v => v !== pares[0] && v !== pares[1]);
    return { tipo: 'doble_par', valor: 3, nombre: 'Doble Par', ...{ kicker } };
  }

  // Verificar par
  if (pares.length > 0) {
    const kickers = valores.filter(v => v !== pares[0]).slice(0, 3);
    return { tipo: 'par', valor: 2, nombre: 'Par', ...{ kickers } };
  }

  // Carta alta
  return { tipo: 'alta', valor: 1, nombre: 'Carta Alta' };
}

function compararManos(mano1: Carta[], mano2: Carta[]): number {
  const eval1 = evaluarMano(mano1);
  const eval2 = evaluarMano(mano2);

  if (eval1.valor !== eval2.valor) {
    return eval2.valor - eval1.valor;
  }

  // Si son del mismo tipo, comparar valores
  const valores1 = mano1.map(c => valorCarta(c)).sort((a, b) => b - a);
  const valores2 = mano2.map(c => valorCarta(c)).sort((a, b) => b - a);

  for (let i = 0; i < Math.min(valores1.length, valores2.length); i++) {
    if (valores1[i] !== valores2[i]) {
      return valores2[i] - valores1[i];
    }
  }

  return 0;
}

async function getSala(id: string): Promise<Sala | null> {
  const r = await fetch(`${SUPA_URL}/rest/v1/poker_salas?id=eq.${id}`, { headers: HEADERS });
  const d = await r.json();
  return d[0] || null;
}

async function patchSala(id: string, data: Partial<Sala>) {
  await fetch(`${SUPA_URL}/rest/v1/poker_salas?id=eq.${id}`, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify(data),
  });
}

async function crearSala(id: string, nombre: string, usuarioId?: string): Promise<void> {
  const estadoInicial: EstadoSala = {
    jugadores: {
      [nombre]: {
        nombre,
        fichas: 0,
        cartasPrivadas: [],
        apuestaActual: 0,
        apuestaTotal: 0,
        activo: true,
        allIn: false,
        retirado: false,
      },
    },
    cartasComunitarias: [],
    mazo: [],
    estado: 'esperando',
    bote: 0,
    ciegaPequena: 5,
    ciegaGrande: 10,
    dealerIndex: 0,
    rondaApuestas: 0,
    apuestaMinima: 10,
    fichasIniciales: 1000,
  };

  await fetch(`${SUPA_URL}/rest/v1/poker_salas`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      id,
      host: nombre,
      usuario_id: usuarioId || null,
      estado_json: estadoInicial,
    }),
  });
}

async function unirSala(id: string, nombre: string): Promise<boolean> {
  const sala = await getSala(id);
  if (!sala) return false;

  const estado = sala.estado_json;
  if (estado.jugadores[nombre]) return false;
  if (Object.keys(estado.jugadores).length >= 4) return false;

  estado.jugadores[nombre] = {
    nombre,
    fichas: 0,
    cartasPrivadas: [],
    apuestaActual: 0,
    apuestaTotal: 0,
    activo: true,
    allIn: false,
    retirado: false,
  };

  await patchSala(id, { estado_json: estado });
  return true;
}

// ─── Componente principal ────────────────────────────────────────────────────
export function PokerView() {
  const { usuario } = useAuth();
  const [fase, setFase] = useState<'lobby' | 'sala'>('lobby');
  const [nombre, setNombre] = useState(usuario?.nombre || '');
  const [codigo, setCodigo] = useState('');
  const [codigoInput, setCodigoInput] = useState('');
  const [sala, setSala] = useState<Sala | null>(null);
  const [error, setError] = useState('');
  const [esHost, setEsHost] = useState(false);

  // ── Verificar perfil ────────────────────────────────────────────────────────
  useEffect(() => {
    if (usuario && usuario.perfil !== 'adulto') {
      alert('Este juego es solo para adultos');
      window.location.href = '/';
    }
  }, [usuario]);

  if (!usuario || usuario.perfil !== 'adulto') {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#fff' }}>
        <div>Este juego es solo para adultos</div>
        <button onClick={() => window.location.href = '/'} style={{ marginTop: 20, padding: '12px 24px', background: '#FF6B35', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>
          Volver al menú
        </button>
      </div>
    );
  }

  const handleCrear = async () => {
    if (!nombre.trim()) { setError('Ingresá tu nombre'); return; }
    const code = genCode();
    await crearSala(code, nombre.trim(), usuario?.id);
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
      <MesaPoker
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
        <div style={styles.title}>🃏 POKER</div>
        <div style={styles.subtitle}>Texas Hold'em (2-4 jugadores)</div>

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

// ─── Mesa de Poker ───────────────────────────────────────────────────────────
function MesaPoker({ codigo, nombre, sala, esHost, onActualizarSala }: {
  codigo: string;
  nombre: string;
  sala: Sala;
  esHost: boolean;
  onActualizarSala: (s: Sala) => void;
}) {
  const estado = sala.estado_json;
  const jugador = estado.jugadores[nombre];
  const [fichasIniciales, setFichasIniciales] = useState(1000);
  const [apuestaInput, setApuestaInput] = useState(0);
  const [error, setError] = useState('');

  const jugadoresLista = Object.values(estado.jugadores);
  const jugadoresActivos = jugadoresLista.filter(j => !j.retirado);
  const puedeIniciar = estado.estado === 'esperando' && jugadoresLista.length >= 2;
  const puedeConfigurar = estado.estado === 'configurando' && esHost;

  // ── Configurar fichas iniciales (host) ─────────────────────────────────────
  const handleConfigurar = async () => {
    const nuevoEstado = { ...estado };
    nuevoEstado.fichasIniciales = fichasIniciales;
    nuevoEstado.ciegaPequena = Math.floor(fichasIniciales / 100);
    nuevoEstado.ciegaGrande = nuevoEstado.ciegaPequena * 2;
    nuevoEstado.apuestaMinima = nuevoEstado.ciegaGrande;

    for (const jug of jugadoresLista) {
      jug.fichas = fichasIniciales;
    }

    nuevoEstado.estado = 'preflop';
    await iniciarMano(nuevoEstado);
  };

  // ── Iniciar mano ───────────────────────────────────────────────────────────
  async function iniciarMano(nuevoEstado: EstadoSala) {
    nuevoEstado.mazo = crearMazo();
    nuevoEstado.bote = 0;
    nuevoEstado.cartasComunitarias = [];
    nuevoEstado.rondaApuestas = 0;

    // Reset jugadores
    for (const jug of jugadoresLista) {
      jug.cartasPrivadas = [];
      jug.apuestaActual = 0;
      jug.apuestaTotal = 0;
      jug.activo = true;
      jug.allIn = false;
      jug.retirado = false;
    }

    // Repartir cartas privadas
    for (let i = 0; i < 2; i++) {
      for (const jug of jugadoresActivos) {
        jug.cartasPrivadas.push(nuevoEstado.mazo.pop()!);
      }
    }

    // Ciegas
    const dealerIdx = nuevoEstado.dealerIndex % jugadoresActivos.length;
    const ciegaPIdx = (dealerIdx + 1) % jugadoresActivos.length;
    const ciegaGIdx = (dealerIdx + 2) % jugadoresActivos.length;

    const ciegaP = jugadoresActivos[ciegaPIdx];
    const ciegaG = jugadoresActivos[ciegaGIdx];

    ciegaP.fichas -= nuevoEstado.ciegaPequena;
    ciegaP.apuestaActual = nuevoEstado.ciegaPequena;
    ciegaP.apuestaTotal = nuevoEstado.ciegaPequena;
    nuevoEstado.bote += nuevoEstado.ciegaPequena;

    ciegaG.fichas -= nuevoEstado.ciegaGrande;
    ciegaG.apuestaActual = nuevoEstado.ciegaGrande;
    ciegaG.apuestaTotal = nuevoEstado.ciegaGrande;
    nuevoEstado.bote += nuevoEstado.ciegaGrande;

    nuevoEstado.apuestaMinima = nuevoEstado.ciegaGrande;

    // Primer turno después de la ciega grande
    const siguienteIdx = (ciegaGIdx + 1) % jugadoresActivos.length;
    nuevoEstado.turnoActual = jugadoresActivos[siguienteIdx]?.nombre;

    await patchSala(codigo, { estado_json: nuevoEstado });
    onActualizarSala({ ...sala, estado_json: nuevoEstado });
  }

  // ── Acción jugador ─────────────────────────────────────────────────────────
  const handleAccion = async (accion: 'pasar' | 'igualar' | 'subir' | 'retirarse') => {
    if (estado.turnoActual !== nombre) return;
    if (!jugador || jugador.retirado) return;

    const nuevoEstado = { ...estado };
    const jug = nuevoEstado.jugadores[nombre];

    if (accion === 'retirarse') {
      jug.retirado = true;
      jug.activo = false;
    } else if (accion === 'pasar') {
      // Solo si la apuesta actual es igual a la mínima
      if (jug.apuestaActual >= nuevoEstado.apuestaMinima) {
        jug.activo = false;
      } else {
        setError('No podés pasar, tenés que igualar o subir');
        return;
      }
    } else if (accion === 'igualar') {
      const diferencia = nuevoEstado.apuestaMinima - jug.apuestaActual;
      if (diferencia > jug.fichas) {
        // All-in
        jug.apuestaActual += jug.fichas;
        jug.apuestaTotal += jug.fichas;
        nuevoEstado.bote += jug.fichas;
        jug.fichas = 0;
        jug.allIn = true;
        jug.activo = false;
      } else {
        jug.fichas -= diferencia;
        jug.apuestaActual = nuevoEstado.apuestaMinima;
        jug.apuestaTotal += diferencia;
        nuevoEstado.bote += diferencia;
        jug.activo = false;
      }
    } else if (accion === 'subir') {
      if (apuestaInput <= nuevoEstado.apuestaMinima) {
        setError(`La apuesta debe ser mayor a ${nuevoEstado.apuestaMinima}`);
        return;
      }
      const total = apuestaInput - jug.apuestaActual;
      if (total > jug.fichas) {
        setError('No tenés suficientes fichas');
        return;
      }
      jug.fichas -= total;
      jug.apuestaActual = apuestaInput;
      jug.apuestaTotal += total;
      nuevoEstado.bote += total;
      nuevoEstado.apuestaMinima = apuestaInput;
      jug.activo = false;
    }

    // Siguiente turno
    siguienteTurno(nuevoEstado);
    setError('');
  };

  // ── Siguiente turno ────────────────────────────────────────────────────────
  function siguienteTurno(nuevoEstado: EstadoSala) {
    const activos = jugadoresActivos.filter(j => !j.retirado);
    const conAccion = activos.filter(j => j.activo && !j.allIn);

    if (conAccion.length <= 1) {
      // Ronda de apuestas terminada
      avanzarRonda(nuevoEstado);
    } else {
      // Siguiente jugador
      const idxActual = activos.findIndex(j => j.nombre === nuevoEstado.turnoActual);
      let siguienteIdx = (idxActual + 1) % activos.length;
      while (activos[siguienteIdx].retirado || activos[siguienteIdx].allIn || !activos[siguienteIdx].activo) {
        siguienteIdx = (siguienteIdx + 1) % activos.length;
        if (siguienteIdx === idxActual) break;
      }
      nuevoEstado.turnoActual = activos[siguienteIdx]?.nombre;

      // Reset activo para nueva ronda
      if (nuevoEstado.rondaApuestas === 0) {
        activos.forEach(j => {
          if (!j.allIn && !j.retirado) j.activo = true;
        });
      }
    }

    patchSala(codigo, { estado_json: nuevoEstado });
    onActualizarSala({ ...sala, estado_json: nuevoEstado });
  }

  // ── Avanzar ronda ──────────────────────────────────────────────────────────
  async function avanzarRonda(nuevoEstado: EstadoSala) {
    nuevoEstado.rondaApuestas = 0;
    nuevoEstado.turnoActual = undefined;

    // Reset apuestas actuales
    jugadoresActivos.forEach(j => {
      j.apuestaActual = 0;
      j.activo = true;
    });

    if (nuevoEstado.estado === 'preflop') {
      nuevoEstado.estado = 'flop';
      nuevoEstado.cartasComunitarias.push(
        nuevoEstado.mazo.pop()!,
        nuevoEstado.mazo.pop()!,
        nuevoEstado.mazo.pop()!,
      );
    } else if (nuevoEstado.estado === 'flop') {
      nuevoEstado.estado = 'turn';
      nuevoEstado.cartasComunitarias.push(nuevoEstado.mazo.pop()!);
    } else if (nuevoEstado.estado === 'turn') {
      nuevoEstado.estado = 'river';
      nuevoEstado.cartasComunitarias.push(nuevoEstado.mazo.pop()!);
    } else if (nuevoEstado.estado === 'river') {
      nuevoEstado.estado = 'showdown';
      calcularGanador(nuevoEstado);
    }

    // Primer turno de la nueva ronda
    const activos = jugadoresActivos.filter(j => !j.retirado && !j.allIn);
    if (activos.length > 0 && nuevoEstado.estado !== 'showdown') {
      nuevoEstado.turnoActual = activos[0]?.nombre;
    }

    await patchSala(codigo, { estado_json: nuevoEstado });
    onActualizarSala({ ...sala, estado_json: nuevoEstado });
  }

  // ── Calcular ganador ──────────────────────────────────────────────────────
  function calcularGanador(nuevoEstado: EstadoSala) {
    const activos = jugadoresActivos.filter(j => !j.retirado);
    if (activos.length === 1) {
      activos[0].fichas += nuevoEstado.bote;
      nuevoEstado.bote = 0;
      return;
    }

    // Evaluar mejor mano de cada jugador (5 cartas de las 7 disponibles)
    const mejoresManos: Array<{ jugador: Jugador; cartas: Carta[]; evaluacion: any }> = [];

    for (const jug of activos) {
      const todasLasCartas = [...jug.cartasPrivadas, ...nuevoEstado.cartasComunitarias];
      let mejorMano: Carta[] = [];
      let mejorEval = { valor: 0 };

      // Probar todas las combinaciones de 5 cartas
      for (let i = 0; i < todasLasCartas.length; i++) {
        for (let j = i + 1; j < todasLasCartas.length; j++) {
          for (let k = j + 1; k < todasLasCartas.length; k++) {
            for (let l = k + 1; l < todasLasCartas.length; l++) {
              for (let m = l + 1; m < todasLasCartas.length; m++) {
                const combinacion = [todasLasCartas[i], todasLasCartas[j], todasLasCartas[k], todasLasCartas[l], todasLasCartas[m]];
                const evaluacion = evaluarMano(combinacion);
                if (evaluacion.valor > mejorEval.valor || (evaluacion.valor === mejorEval.valor && compararManos(combinacion, mejorMano) > 0)) {
                  mejorMano = combinacion;
                  mejorEval = evaluacion;
                }
              }
            }
          }
        }
      }

      mejoresManos.push({ jugador: jug, cartas: mejorMano, evaluacion: mejorEval });
    }

    // Ordenar por mejor mano
    mejoresManos.sort((a, b) => {
      if (a.evaluacion.valor !== b.evaluacion.valor) {
        return b.evaluacion.valor - a.evaluacion.valor;
      }
      return compararManos(b.cartas, a.cartas);
    });

    // El ganador se lleva el bote
    if (mejoresManos.length > 0) {
      mejoresManos[0].jugador.fichas += nuevoEstado.bote;
      nuevoEstado.bote = 0;
    }
  }

  // ── Nueva mano (host) ─────────────────────────────────────────────────────
  const handleNuevaMano = async () => {
    const nuevoEstado = { ...estado };
    nuevoEstado.dealerIndex = (nuevoEstado.dealerIndex + 1) % jugadoresActivos.length;
    nuevoEstado.estado = 'preflop';
    await iniciarMano(nuevoEstado);
  };

  // ── Iniciar partida (host) ────────────────────────────────────────────────
  const handleIniciar = async () => {
    if (!puedeIniciar) return;
    const nuevoEstado = { ...estado };
    nuevoEstado.estado = 'configurando';
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
            💰 {jugador?.fichas || 0} fichas
          </div>
        </div>

        {/* Bote */}
        {estado.bote > 0 && (
          <div style={styles.boteContainer}>
            <div style={styles.boteLabel}>BOTE</div>
            <div style={styles.boteValor}>{estado.bote} fichas</div>
          </div>
        )}

        {/* Cartas comunitarias */}
        {estado.cartasComunitarias.length > 0 && (
          <div style={styles.comunitariasContainer}>
            <div style={styles.comunitariasLabel}>Cartas Comunitarias</div>
            <div style={styles.cartasContainer}>
              {estado.cartasComunitarias.map((carta, idx) => (
                <CartaComponent key={idx} carta={carta} />
              ))}
            </div>
          </div>
        )}

        {/* Jugadores alrededor de la mesa */}
        <div style={styles.jugadoresMesa}>
          {jugadoresLista.map((jug) => {
            const esMiTurno = estado.turnoActual === jug.nombre;
            const esYo = jug.nombre === nombre;
            return (
              <div
                key={jug.nombre}
                style={{
                  ...styles.jugadorMesa,
                  border: esMiTurno ? '3px solid #d4af37' : '1px solid #333',
                  opacity: jug.retirado ? 0.5 : 1,
                }}
              >
                <div style={styles.jugadorNombre}>
                  {jug.nombre} {esYo && '(Tú)'}
                  {esMiTurno && ' ⭐'}
                  {jug.allIn && ' (ALL-IN)'}
                  {jug.retirado && ' (Retirado)'}
                </div>
                <div style={styles.fichasJugador}>💰 {jug.fichas}</div>
                {jug.apuestaTotal > 0 && (
                  <div style={styles.apuestaDisplay}>
                    Apuesta: {jug.apuestaTotal}
                  </div>
                )}
                {esYo && jug.cartasPrivadas.length > 0 && (
                  <div style={styles.cartasContainer}>
                    {jug.cartasPrivadas.map((carta, idx) => (
                      <CartaComponent key={idx} carta={carta} />
                    ))}
                  </div>
                )}
                {!esYo && jug.cartasPrivadas.length > 0 && (
                  <div style={styles.cartasContainer}>
                    <div style={styles.cartaOculta}>🂠</div>
                    <div style={styles.cartaOculta}>🂠</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Acciones del jugador */}
        {estado.estado !== 'esperando' && estado.estado !== 'configurando' && 
         estado.estado !== 'showdown' && estado.turnoActual === nombre && 
         jugador && !jugador.retirado && !jugador.allIn && (
          <div style={styles.accionesContainer}>
            <button style={styles.btnAccion} onClick={() => handleAccion('pasar')}>
              Pasar
            </button>
            <button style={styles.btnAccion} onClick={() => handleAccion('igualar')}>
              Igualar ({estado.apuestaMinima - jugador.apuestaActual})
            </button>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                style={styles.inputApuesta}
                value={apuestaInput || ''}
                onChange={e => setApuestaInput(Number(e.target.value) || 0)}
                min={estado.apuestaMinima + 1}
                max={jugador.fichas + jugador.apuestaActual}
                placeholder="Monto"
              />
              <button style={styles.btnAccion} onClick={() => handleAccion('subir')}>
                Subir
              </button>
            </div>
            <button style={{ ...styles.btnAccion, background: '#8b0000' }} onClick={() => handleAccion('retirarse')}>
              Retirarse
            </button>
            {error && <div style={styles.errorMsg}>{error}</div>}
          </div>
        )}

        {/* Control host */}
        {estado.estado === 'esperando' && esHost && (
          <div style={styles.controlContainer}>
            <button
              style={{
                ...styles.btnGirar,
                opacity: puedeIniciar ? 1 : 0.5,
              }}
              onClick={handleIniciar}
              disabled={!puedeIniciar}
            >
              Iniciar Partida
            </button>
          </div>
        )}

        {puedeConfigurar && (
          <div style={styles.configContainer}>
            <div style={styles.configTitle}>Configurar Fichas Iniciales</div>
            <div style={styles.montoButtons}>
              {FICHAS_INICIALES_OPCIONES.map(m => (
                <button
                  key={m}
                  style={{
                    ...styles.btnMonto,
                    background: fichasIniciales === m ? '#d4af37' : '#1a1a1a',
                  }}
                  onClick={() => setFichasIniciales(m)}
                >
                  {m}
                </button>
              ))}
            </div>
            <button style={styles.btnGirar} onClick={handleConfigurar}>
              Confirmar y Repartir
            </button>
          </div>
        )}

        {estado.estado === 'showdown' && esHost && (
          <div style={styles.controlContainer}>
            <button style={styles.btnNuevaRonda} onClick={handleNuevaMano}>
              Nueva Mano
            </button>
          </div>
        )}

        {/* Estado actual */}
        <div style={styles.estadoDisplay}>
          Estado: {estado.estado === 'preflop' && 'Pre-Flop'}
          {estado.estado === 'flop' && 'Flop'}
          {estado.estado === 'turn' && 'Turn'}
          {estado.estado === 'river' && 'River'}
          {estado.estado === 'showdown' && 'Showdown'}
          {estado.estado === 'esperando' && 'Esperando jugadores'}
          {estado.estado === 'configurando' && 'Configurando'}
        </div>
      </div>
    </div>
  );
}

// ─── Componente Carta ───────────────────────────────────────────────────────
function CartaComponent({ carta }: { carta: Carta }) {
  const esRoja = carta.palo === '♥' || carta.palo === '♦';
  
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
    background: 'radial-gradient(circle at 50% 50%, #0a1a0a 0%, #0a0a0a 100%)',
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
    maxWidth: 1000,
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
  boteContainer: {
    background: 'linear-gradient(135deg, #0a3a0a 0%, #0a1a0a 100%)',
    border: '2px solid #d4af37',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  boteLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  boteValor: {
    fontSize: 32,
    fontWeight: 900,
    color: '#d4af37',
  },
  comunitariasContainer: {
    background: 'linear-gradient(135deg, #1a0a0a 0%, #0a0a0a 100%)',
    border: '1px solid #333',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  comunitariasLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  cartasContainer: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
    flexWrap: 'wrap',
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
  jugadoresMesa: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
    marginBottom: 20,
  },
  jugadorMesa: {
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
  accionesContainer: {
    background: 'linear-gradient(135deg, #1a0a0a 0%, #0a0a0a 100%)',
    border: '2px solid #d4af37',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    alignItems: 'center',
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
    width: '100%',
    maxWidth: 300,
  },
  inputApuesta: {
    padding: '10px',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 16,
    outline: 'none',
    width: 120,
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
  configContainer: {
    background: 'linear-gradient(135deg, #1a0a0a 0%, #0a0a0a 100%)',
    border: '2px solid #d4af37',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  configTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#d4af37',
    marginBottom: 16,
  },
  montoButtons: {
    display: 'flex',
    gap: 12,
    marginBottom: 16,
    justifyContent: 'center',
  },
  btnMonto: {
    padding: '12px 24px',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
  },
  estadoDisplay: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 700,
    color: '#d4af37',
    padding: '12px',
    background: '#1a1a1a',
    borderRadius: 8,
    border: '1px solid #333',
  },
};

export default PokerView;
