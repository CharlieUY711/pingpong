/**
 * BatallaNavalView.tsx — Batalla Naval Multijugador
 * Supabase Realtime — funciona en redes distintas
 * Optimizado para celular
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
const GRID_SIZE = 10;

// Tipos de barcos: [nombre, tamaño]
const BARCOS = [
  ['Portaaviones', 5],
  ['Acorazado', 4],
  ['Crucero', 3],
  ['Submarino', 3],
  ['Destructor', 2],
] as const;

// ─── Tipos ───────────────────────────────────────────────────────────────────
type EstadoCelda = 'agua' | 'barco' | 'agua_atacada' | 'barco_hundido';
type Orientacion = 'horizontal' | 'vertical';
type FaseJuego = 'preparacion' | 'jugando' | 'terminado';

interface Celda {
  estado: EstadoCelda;
  barcoId?: number; // ID del barco (0-4)
}

interface Barco {
  id: number;
  nombre: string;
  tamaño: number;
  posiciones: Array<{ fila: number; col: number }>;
  hundido: boolean;
}

interface Grilla {
  celdas: Celda[][];
  barcos: Barco[];
}

interface EstadoSala {
  jugadores: Record<string, {
    nombre: string;
    grilla: Grilla;
    listo: boolean;
  }>;
  fase: FaseJuego;
  turno: string | null; // nombre del jugador con turno
  ganador: string | null;
  ataques: Array<{ jugador: string; fila: number; col: number; resultado: 'agua' | 'impacto' | 'hundido' }>;
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

function crearGrillaVacia(): Grilla {
  const celdas: Celda[][] = Array(GRID_SIZE).fill(null).map(() =>
    Array(GRID_SIZE).fill(null).map(() => ({ estado: 'agua' }))
  );
  return { celdas, barcos: [] };
}

function puedeColocarBarco(
  grilla: Grilla,
  fila: number,
  col: number,
  tamaño: number,
  orientacion: Orientacion
): boolean {
  if (orientacion === 'horizontal') {
    if (col + tamaño > GRID_SIZE) return false;
    for (let i = 0; i < tamaño; i++) {
      if (grilla.celdas[fila][col + i].estado !== 'agua') return false;
    }
  } else {
    if (fila + tamaño > GRID_SIZE) return false;
    for (let i = 0; i < tamaño; i++) {
      if (grilla.celdas[fila + i][col].estado !== 'agua') return false;
    }
  }
  return true;
}

function colocarBarco(
  grilla: Grilla,
  barcoId: number,
  nombre: string,
  tamaño: number,
  fila: number,
  col: number,
  orientacion: Orientacion
): Grilla {
  const nuevaGrilla = JSON.parse(JSON.stringify(grilla)) as Grilla;
  const posiciones: Array<{ fila: number; col: number }> = [];

  if (orientacion === 'horizontal') {
    for (let i = 0; i < tamaño; i++) {
      nuevaGrilla.celdas[fila][col + i] = { estado: 'barco', barcoId };
      posiciones.push({ fila, col: col + i });
    }
  } else {
    for (let i = 0; i < tamaño; i++) {
      nuevaGrilla.celdas[fila + i][col] = { estado: 'barco', barcoId };
      posiciones.push({ fila: fila + i, col });
    }
  }

  nuevaGrilla.barcos.push({
    id: barcoId,
    nombre,
    tamaño,
    posiciones,
    hundido: false,
  });

  return nuevaGrilla;
}

function verificarBarcoHundido(grilla: Grilla, barcoId: number): boolean {
  const barco = grilla.barcos.find(b => b.id === barcoId);
  if (!barco) return false;
  return barco.posiciones.every(pos => 
    grilla.celdas[pos.fila][pos.col].estado === 'barco_hundido'
  );
}

async function getSala(id: string): Promise<Sala | null> {
  const r = await fetch(`${SUPA_URL}/rest/v1/naval_salas?id=eq.${id}`, { headers: HEADERS });
  const d = await r.json();
  return d[0] || null;
}

async function patchSala(id: string, data: Partial<Sala>) {
  await fetch(`${SUPA_URL}/rest/v1/naval_salas?id=eq.${id}`, {
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
        grilla: crearGrillaVacia(),
        listo: false,
      },
    },
    fase: 'preparacion',
    turno: null,
    ganador: null,
    ataques: [],
  };

  await fetch(`${SUPA_URL}/rest/v1/naval_salas`, {
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
  if (Object.keys(estado.jugadores).length >= 2) return false; // Sala llena

  estado.jugadores[nombre] = {
    nombre,
    grilla: crearGrillaVacia(),
    listo: false,
  };

  await patchSala(id, { estado_json: estado });
  return true;
}

// ─── Componente principal ────────────────────────────────────────────────────
export function BatallaNavalView() {
  const [fase, setFase] = useState<'lobby' | 'sala'>('lobby');
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
    setFase('sala');
  };

  // ── Unirse ──────────────────────────────────────────────────────────────────
  const handleUnirse = async () => {
    if (!nombre.trim()) { setError('Ingresá tu nombre'); return; }
    if (!codigoInput.trim()) { setError('Ingresá el código'); return; }
    const ok = await unirSala(codigoInput.toUpperCase(), nombre.trim());
    if (!ok) { setError('Sala no encontrada o ya llena'); return; }
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
      <SalaJuego
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
      <div style={styles.militaryBg} />
      <div style={styles.lobbyCard}>
        <div style={styles.title}>⚓ BATALLA NAVAL</div>
        <div style={styles.subtitle}>Estrategia Multijugador</div>

        <input
          style={styles.input}
          placeholder="Tu nombre"
          value={nombre}
          onChange={e => { setNombre(e.target.value); setError(''); }}
          maxLength={12}
        />

        <button style={styles.btnPrimary} onClick={onCrear}>
          ⚓ Crear sala
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

// ─── Sala de Juego ───────────────────────────────────────────────────────────
function SalaJuego({ codigo, nombre, sala, esHost, onActualizarSala }: {
  codigo: string;
  nombre: string;
  sala: Sala;
  esHost: boolean;
  onActualizarSala: (s: Sala) => void;
}) {
  const estado = sala.estado_json;
  const jugador = estado.jugadores[nombre];
  const oponente = Object.values(estado.jugadores).find(j => j.nombre !== nombre);
  const [barcoSeleccionado, setBarcoSeleccionado] = useState<number | null>(null);
  const [orientacion, setOrientacion] = useState<Orientacion>('horizontal');
  const [error, setError] = useState('');

  // ── Colocar barco ───────────────────────────────────────────────────────────
  const handleColocarBarco = async (fila: number, col: number) => {
    if (estado.fase !== 'preparacion' || jugador.listo) return;
    if (barcoSeleccionado === null) {
      setError('Seleccioná un barco primero');
      return;
    }

    const [nombreBarco, tamaño] = BARCOS[barcoSeleccionado];
    const grillaActual = jugador.grilla;

    // Verificar si ya está colocado
    if (grillaActual.barcos.some(b => b.id === barcoSeleccionado)) {
      setError('Este barco ya está colocado');
      return;
    }

    if (!puedeColocarBarco(grillaActual, fila, col, tamaño, orientacion)) {
      setError('No se puede colocar ahí');
      return;
    }

    const nuevaGrilla = colocarBarco(
      grillaActual,
      barcoSeleccionado,
      nombreBarco,
      tamaño,
      fila,
      col,
      orientacion
    );

    const nuevoEstado = { ...estado };
    nuevoEstado.jugadores[nombre].grilla = nuevaGrilla;

    await patchSala(codigo, { estado_json: nuevoEstado });
    onActualizarSala({ ...sala, estado_json: nuevoEstado });
    setError('');
    setBarcoSeleccionado(null);
  };

  // ── Confirmar preparación ───────────────────────────────────────────────────
  const handleConfirmar = async () => {
    if (jugador.grilla.barcos.length !== BARCOS.length) {
      setError('Colocá todos los barcos primero');
      return;
    }

    const nuevoEstado = { ...estado };
    nuevoEstado.jugadores[nombre].listo = true;

    // Si ambos están listos, iniciar juego
    const todosListos = Object.values(nuevoEstado.jugadores).every(j => j.listo);
    if (todosListos && Object.keys(nuevoEstado.jugadores).length === 2) {
      nuevoEstado.fase = 'jugando';
      // El host empieza
      nuevoEstado.turno = sala.host;
    }

    await patchSala(codigo, { estado_json: nuevoEstado });
    onActualizarSala({ ...sala, estado_json: nuevoEstado });
    setError('');
  };

  // ── Atacar ───────────────────────────────────────────────────────────────────
  const handleAtacar = async (fila: number, col: number) => {
    if (estado.fase !== 'jugando') return;
    if (estado.turno !== nombre) {
      setError('No es tu turno');
      return;
    }
    if (!oponente) return;

    // Verificar si ya fue atacada
    const yaAtacada = estado.ataques.some(
      a => a.jugador === nombre && a.fila === fila && a.col === col
    );
    if (yaAtacada) {
      setError('Ya atacaste esa casilla');
      return;
    }

    const grillaOponente = oponente.grilla;
    const celda = grillaOponente.celdas[fila][col];
    let resultado: 'agua' | 'impacto' | 'hundido' = 'agua';

    if (celda.estado === 'barco') {
      // Impacto
      const nuevaGrillaOponente = JSON.parse(JSON.stringify(grillaOponente)) as Grilla;
      nuevaGrillaOponente.celdas[fila][col].estado = 'barco_hundido';

      // Verificar si el barco está hundido
      if (celda.barcoId !== undefined) {
        const hundido = verificarBarcoHundido(nuevaGrillaOponente, celda.barcoId);
        if (hundido) {
          nuevaGrillaOponente.barcos.find(b => b.id === celda.barcoId)!.hundido = true;
          resultado = 'hundido';

          // Verificar si todos los barcos están hundidos
          const todosHundidos = nuevaGrillaOponente.barcos.every(b => b.hundido);
          if (todosHundidos) {
            const nuevoEstado = { ...estado };
            nuevoEstado.fase = 'terminado';
            nuevoEstado.ganador = nombre;
            nuevoEstado.jugadores[oponente.nombre].grilla = nuevaGrillaOponente;
            nuevoEstado.ataques.push({ jugador: nombre, fila, col, resultado });
            await patchSala(codigo, { estado_json: nuevoEstado });
            onActualizarSala({ ...sala, estado_json: nuevoEstado });
            return;
          }
        } else {
          resultado = 'impacto';
        }
      }

      const nuevoEstado = { ...estado };
      nuevoEstado.jugadores[oponente.nombre].grilla = nuevaGrillaOponente;
      nuevoEstado.ataques.push({ jugador: nombre, fila, col, resultado });
      // Cambiar turno solo si es agua
      if (resultado === 'agua') {
        nuevoEstado.turno = oponente.nombre;
      }
      await patchSala(codigo, { estado_json: nuevoEstado });
      onActualizarSala({ ...sala, estado_json: nuevoEstado });
    } else {
      // Agua
      const nuevaGrillaOponente = JSON.parse(JSON.stringify(grillaOponente)) as Grilla;
      nuevaGrillaOponente.celdas[fila][col].estado = 'agua_atacada';

      const nuevoEstado = { ...estado };
      nuevoEstado.jugadores[oponente.nombre].grilla = nuevaGrillaOponente;
      nuevoEstado.ataques.push({ jugador: nombre, fila, col, resultado });
      nuevoEstado.turno = oponente.nombre;

      await patchSala(codigo, { estado_json: nuevoEstado });
      onActualizarSala({ ...sala, estado_json: nuevoEstado });
    }

    setError('');
  };

  // ── Render según fase ───────────────────────────────────────────────────────
  if (estado.fase === 'preparacion') {
    return (
      <Preparacion
        codigo={codigo}
        nombre={nombre}
        jugador={jugador}
        estado={estado}
        barcoSeleccionado={barcoSeleccionado}
        setBarcoSeleccionado={setBarcoSeleccionado}
        orientacion={orientacion}
        setOrientacion={setOrientacion}
        error={error}
        setError={setError}
        onColocarBarco={handleColocarBarco}
        onConfirmar={handleConfirmar}
      />
    );
  }

  if (estado.fase === 'jugando' || estado.fase === 'terminado') {
    return (
      <Juego
        codigo={codigo}
        nombre={nombre}
        estado={estado}
        error={error}
        setError={setError}
        onAtacar={handleAtacar}
      />
    );
  }

  return <div style={styles.fullPage}>Cargando...</div>;
}

// ─── Preparación ─────────────────────────────────────────────────────────────
function Preparacion({
  codigo,
  nombre,
  jugador,
  estado,
  barcoSeleccionado,
  setBarcoSeleccionado,
  orientacion,
  setOrientacion,
  error,
  setError,
  onColocarBarco,
  onConfirmar,
}: any) {
  const barcosColocados = jugador.grilla.barcos.length;
  const todosColocados = barcosColocados === BARCOS.length;
  const oponente = (Object.values(estado.jugadores) as Array<{ nombre: string; grilla: Grilla; listo: boolean }>).find(j => j.nombre !== nombre);

  return (
    <div style={styles.fullPage}>
      <div style={styles.militaryBg} />
      <div style={styles.salaContainer}>
        <div style={styles.header}>
          <div style={styles.codigoDisplay}>Sala: {codigo}</div>
          <div style={styles.estadoDisplay}>
            {jugador.listo ? '✅ Listo' : '⏳ Preparando...'}
          </div>
        </div>

        {oponente && (
          <div style={styles.infoBox}>
            {oponente.listo ? '✅ Oponente listo' : '⏳ Esperando oponente...'}
          </div>
        )}

        <div style={styles.preparacionContainer}>
          <div style={styles.preparacionTitle}>Colocá tus barcos</div>
          <div style={styles.preparacionSubtitle}>
            {barcosColocados} / {BARCOS.length} colocados
          </div>

          {/* Selector de barcos */}
          <div style={styles.barcosSelector}>
            {BARCOS.map(([nombreBarco, tamaño], idx) => {
              const yaColocado = jugador.grilla.barcos.some((b: Barco) => b.id === idx);
              return (
                <button
                  key={idx}
                  style={{
                    ...styles.btnBarco,
                    background: barcoSeleccionado === idx ? '#4ECDC4' : yaColocado ? '#2a5a2a' : '#1a1a1a',
                    borderColor: barcoSeleccionado === idx ? '#4ECDC4' : yaColocado ? '#4ECDC4' : '#333',
                    opacity: yaColocado ? 0.6 : 1,
                  }}
                  onClick={() => !yaColocado && setBarcoSeleccionado(idx)}
                  disabled={yaColocado}
                >
                  {yaColocado ? '✅' : '⚓'} {nombreBarco} ({tamaño})
                </button>
              );
            })}
          </div>

          {/* Orientación */}
          {barcoSeleccionado !== null && (
            <div style={styles.orientacionContainer}>
              <button
                style={{
                  ...styles.btnOrientacion,
                  background: orientacion === 'horizontal' ? '#4ECDC4' : '#1a1a1a',
                }}
                onClick={() => setOrientacion('horizontal')}
              >
                ↔ Horizontal
              </button>
              <button
                style={{
                  ...styles.btnOrientacion,
                  background: orientacion === 'vertical' ? '#4ECDC4' : '#1a1a1a',
                }}
                onClick={() => setOrientacion('vertical')}
              >
                ↕ Vertical
              </button>
            </div>
          )}

          {/* Grilla */}
          <GrillaPreparacion
            grilla={jugador.grilla}
            onCeldaClick={onColocarBarco}
            barcoSeleccionado={barcoSeleccionado}
            orientacion={orientacion}
          />

          {error && <div style={styles.errorMsg}>{error}</div>}

          {/* Botón confirmar */}
          <button
            style={{
              ...styles.btnPrimary,
              opacity: todosColocados ? 1 : 0.5,
            }}
            onClick={onConfirmar}
            disabled={!todosColocados || jugador.listo}
          >
            {jugador.listo ? '✅ Confirmado' : '✅ Confirmar preparación'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Grilla de Preparación ───────────────────────────────────────────────────
function GrillaPreparacion({
  grilla,
  onCeldaClick,
  barcoSeleccionado,
  orientacion,
}: {
  grilla: Grilla;
  onCeldaClick: (fila: number, col: number) => void;
  barcoSeleccionado: number | null;
  orientacion: Orientacion;
}) {
  const [hoverCelda, setHoverCelda] = useState<{ fila: number; col: number } | null>(null);

  const getCeldaStyle = (fila: number, col: number): React.CSSProperties => {
    const celda = grilla.celdas[fila][col];
    let bg = '#0a1a2a'; // Agua azul oscuro

    if (celda.estado === 'barco') {
      bg = '#666'; // Barco gris
    }

    // Preview del barco a colocar
    if (barcoSeleccionado !== null && hoverCelda?.fila === fila && hoverCelda?.col === col) {
      const tamaño = BARCOS[barcoSeleccionado][1];
      let enPreview = false;

      if (orientacion === 'horizontal') {
        for (let i = 0; i < tamaño; i++) {
          if (col + i === hoverCelda.col && fila === hoverCelda.fila) {
            enPreview = true;
            break;
          }
        }
      } else {
        for (let i = 0; i < tamaño; i++) {
          if (fila + i === hoverCelda.fila && col === hoverCelda.col) {
            enPreview = true;
            break;
          }
        }
      }

      if (enPreview) {
        bg = '#4ECDC4';
      }
    }

    return {
      ...styles.celda,
      background: bg,
      border: `1px solid ${bg === '#0a1a2a' ? '#1a2a3a' : '#333'}`,
    };
  };

  return (
    <div style={styles.grillaContainer}>
      <div style={styles.grillaLabels}>
        <div style={styles.labelRow}>
          <div style={styles.labelCorner} />
          {Array.from({ length: GRID_SIZE }, (_, i) => (
            <div key={i} style={styles.label}>{String.fromCharCode(65 + i)}</div>
          ))}
        </div>
      </div>
      <div style={styles.grilla}>
        {grilla.celdas.map((fila, i) => (
          <div key={i} style={styles.fila}>
            <div style={styles.label}>{i + 1}</div>
            {fila.map((celda, j) => (
              <div
                key={j}
                style={getCeldaStyle(i, j)}
                onClick={() => onCeldaClick(i, j)}
                onMouseEnter={() => setHoverCelda({ fila: i, col: j })}
                onMouseLeave={() => setHoverCelda(null)}
                onTouchStart={() => setHoverCelda({ fila: i, col: j })}
                onTouchEnd={() => setHoverCelda(null)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Juego ───────────────────────────────────────────────────────────────────
function Juego({
  codigo,
  nombre,
  estado,
  error,
  setError,
  onAtacar,
}: {
  codigo: string;
  nombre: string;
  estado: EstadoSala;
  error: string;
  setError: (e: string) => void;
  onAtacar: (fila: number, col: number) => void;
}) {
  const jugador = estado.jugadores[nombre];
  const oponente = Object.values(estado.jugadores).find(j => j.nombre !== nombre);
  const esMiTurno = estado.turno === nombre;

  // Crear grilla del oponente con solo los ataques visibles
  const grillaOponenteVisible: Celda[][] = Array(GRID_SIZE).fill(null).map(() =>
    Array(GRID_SIZE).fill(null).map(() => ({ estado: 'agua' }))
  );

  if (oponente) {
    estado.ataques
      .filter(a => a.jugador === nombre)
      .forEach(a => {
        grillaOponenteVisible[a.fila][a.col] = {
          estado: a.resultado === 'agua' ? 'agua_atacada' : 'barco_hundido',
        };
      });
  }

  return (
    <div style={styles.fullPage}>
      <div style={styles.militaryBg} />
      <div style={styles.salaContainer}>
        <div style={styles.header}>
          <div style={styles.codigoDisplay}>Sala: {codigo}</div>
          <div style={styles.turnoDisplay}>
            {esMiTurno ? '🎯 Tu turno' : '⏳ Turno del oponente'}
          </div>
        </div>

        {estado.fase === 'terminado' && (
          <div style={styles.gameOverBox}>
            <div style={styles.gameOverTitle}>
              {estado.ganador === nombre ? '🏆 ¡GANASTE!' : '💥 Perdiste'}
            </div>
            <div style={styles.gameOverSubtitle}>
              {estado.ganador === nombre ? 'Hundiste todos los barcos enemigos' : 'El oponente hundió todos tus barcos'}
            </div>
          </div>
        )}

        <div style={styles.juegoContainer}>
          {/* Mi grilla */}
          <div style={styles.grillaSection}>
            <div style={styles.grillaTitle}>Tu flota</div>
            <GrillaJuego grilla={jugador.grilla} mostrarBarcos={true} />
          </div>

          {/* Grilla enemiga */}
          {oponente && (
            <div style={styles.grillaSection}>
              <div style={styles.grillaTitle}>Flota enemiga</div>
              <GrillaJuego
                grilla={{ celdas: grillaOponenteVisible, barcos: [] }}
                mostrarBarcos={false}
                onCeldaClick={esMiTurno && estado.fase !== 'terminado' ? onAtacar : undefined}
              />
            </div>
          )}

          {error && <div style={styles.errorMsg}>{error}</div>}

          {/* Info de barcos */}
          <div style={styles.barcosInfo}>
            <div style={styles.barcosInfoTitle}>Barcos restantes:</div>
            <div style={styles.barcosInfoGrid}>
              {oponente && oponente.grilla.barcos.map(barco => (
                <div
                  key={barco.id}
                  style={{
                    ...styles.barcoInfoItem,
                    opacity: barco.hundido ? 0.3 : 1,
                    textDecoration: barco.hundido ? 'line-through' : 'none',
                  }}
                >
                  {barco.hundido ? '💥' : '⚓'} {barco.nombre}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Grilla de Juego ─────────────────────────────────────────────────────────
function GrillaJuego({
  grilla,
  mostrarBarcos,
  onCeldaClick,
}: {
  grilla: Grilla;
  mostrarBarcos: boolean;
  onCeldaClick?: (fila: number, col: number) => void;
}) {
  const getCeldaStyle = (celda: Celda): React.CSSProperties => {
    let bg = '#0a1a2a'; // Agua azul oscuro

    if (mostrarBarcos && celda.estado === 'barco') {
      bg = '#666'; // Barco gris
    } else if (celda.estado === 'agua_atacada') {
      bg = '#4ECDC4'; // Agua atacada celeste
    } else if (celda.estado === 'barco_hundido') {
      bg = '#ff4444'; // Impacto rojo
    }

    return {
      ...styles.celda,
      background: bg,
      border: `1px solid ${bg === '#0a1a2a' ? '#1a2a3a' : '#333'}`,
      cursor: onCeldaClick ? 'pointer' : 'default',
    };
  };

  return (
    <div style={styles.grillaContainer}>
      <div style={styles.grillaLabels}>
        <div style={styles.labelRow}>
          <div style={styles.labelCorner} />
          {Array.from({ length: GRID_SIZE }, (_, i) => (
            <div key={i} style={styles.label}>{String.fromCharCode(65 + i)}</div>
          ))}
        </div>
      </div>
      <div style={styles.grilla}>
        {grilla.celdas.map((fila, i) => (
          <div key={i} style={styles.fila}>
            <div style={styles.label}>{i + 1}</div>
            {fila.map((celda, j) => (
              <div
                key={j}
                style={getCeldaStyle(celda)}
                onClick={() => onCeldaClick?.(i, j)}
              />
            ))}
          </div>
        ))}
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
  },
  militaryBg: {
    position: 'fixed',
    inset: 0,
    background: 'radial-gradient(circle at 50% 50%, #0a1a2a 0%, #0a0a0a 100%)',
    opacity: 0.3,
    zIndex: 0,
  },
  lobbyCard: {
    position: 'relative',
    background: 'linear-gradient(135deg, #0a1a2a 0%, #0a0a0a 100%)',
    border: '2px solid #4ECDC4',
    borderRadius: 16,
    padding: '36px 28px',
    width: '90%',
    maxWidth: 360,
    margin: '50px auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    zIndex: 10,
    boxShadow: '0 0 30px rgba(78, 205, 196, 0.3)',
  },
  title: {
    fontSize: 36,
    fontWeight: 900,
    color: '#4ECDC4',
    textAlign: 'center',
    letterSpacing: 4,
    textShadow: '0 0 20px rgba(78, 205, 196, 0.8)',
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
    background: 'linear-gradient(135deg, #4ECDC4 0%, #2a8a7f 100%)',
    color: '#000',
    border: 'none',
    borderRadius: 10,
    padding: '14px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: 1,
    boxShadow: '0 4px 15px rgba(78, 205, 196, 0.4)',
  },
  btnSecondary: {
    background: '#1a1a1a',
    color: '#4ECDC4',
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
  salaContainer: {
    position: 'relative',
    width: '100%',
    maxWidth: 800,
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
    background: 'linear-gradient(135deg, #0a1a2a 0%, #0a0a0a 100%)',
    border: '1px solid #4ECDC4',
    borderRadius: 10,
  },
  codigoDisplay: {
    fontSize: 18,
    fontWeight: 700,
    color: '#4ECDC4',
    letterSpacing: 4,
  },
  estadoDisplay: {
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
  },
  turnoDisplay: {
    fontSize: 14,
    fontWeight: 700,
    color: '#4ECDC4',
  },
  infoBox: {
    background: '#0a1a2a',
    border: '1px solid #4ECDC4',
    borderRadius: 8,
    padding: '12px',
    marginBottom: 20,
    textAlign: 'center',
    color: '#4ECDC4',
    fontSize: 14,
  },
  preparacionContainer: {
    background: 'linear-gradient(135deg, #0a1a2a 0%, #0a0a0a 100%)',
    border: '2px solid #4ECDC4',
    borderRadius: 16,
    padding: 20,
  },
  preparacionTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: '#4ECDC4',
    textAlign: 'center',
    marginBottom: 8,
  },
  preparacionSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
  },
  barcosSelector: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 16,
  },
  btnBarco: {
    padding: '10px',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'left',
  },
  orientacionContainer: {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
  },
  btnOrientacion: {
    flex: 1,
    padding: '10px',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  grillaContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: 20,
  },
  grillaLabels: {
    display: 'flex',
    flexDirection: 'column',
  },
  labelRow: {
    display: 'flex',
    marginLeft: 30,
    gap: 2,
  },
  labelCorner: {
    width: 28,
    height: 28,
  },
  label: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    color: '#888',
    fontWeight: 700,
  },
  grilla: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  fila: {
    display: 'flex',
    gap: 2,
    alignItems: 'center',
  },
  celda: {
    width: 28,
    height: 28,
    borderRadius: 2,
    transition: 'all 0.2s',
  },
  juegoContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  grillaSection: {
    background: 'linear-gradient(135deg, #0a1a2a 0%, #0a0a0a 100%)',
    border: '1px solid #4ECDC4',
    borderRadius: 12,
    padding: 16,
  },
  grillaTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#4ECDC4',
    marginBottom: 12,
    textAlign: 'center',
  },
  gameOverBox: {
    background: 'linear-gradient(135deg, #0a1a2a 0%, #0a0a0a 100%)',
    border: '2px solid #4ECDC4',
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  gameOverTitle: {
    fontSize: 32,
    fontWeight: 900,
    color: '#4ECDC4',
    marginBottom: 8,
  },
  gameOverSubtitle: {
    fontSize: 14,
    color: '#888',
  },
  barcosInfo: {
    background: 'linear-gradient(135deg, #0a1a2a 0%, #0a0a0a 100%)',
    border: '1px solid #4ECDC4',
    borderRadius: 12,
    padding: 16,
  },
  barcosInfoTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#4ECDC4',
    marginBottom: 12,
  },
  barcosInfoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 8,
  },
  barcoInfoItem: {
    fontSize: 14,
    color: '#fff',
    padding: '8px',
    background: '#1a1a1a',
    borderRadius: 6,
    textAlign: 'center',
  },
};

export default BatallaNavalView;
