/**
 * GeneralaView.tsx — Generala Uruguaya Multijugador
 * Supabase Realtime — funciona en redes distintas
 * Optimizado para celular portrait
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
const MAX_JUGADORES = 6;
const MIN_JUGADORES = 2;
const DADOS_TOTALES = 5;
const TIROS_MAXIMOS = 3;

// ─── Tipos ───────────────────────────────────────────────────────────────────
type Combinacion = 
  | 'unos' | 'doses' | 'treses' | 'cuatros' | 'cincos' | 'seises'
  | 'escalera' | 'full' | 'poker' | 'generala';

interface Planilla {
  unos: number | null;
  doses: number | null;
  treses: number | null;
  cuatros: number | null;
  cincos: number | null;
  seises: number | null;
  escalera: number | null;
  full: number | null;
  poker: number | null;
  generala: number | null;
}

interface Jugador {
  id: string;
  nombre: string;
  planilla: Planilla;
  esHost: boolean;
}

interface EstadoSala {
  jugadores: Jugador[];
  turnoActual: number; // índice en jugadores
  estado: 'lobby' | 'esperando' | 'jugando' | 'terminado';
  jugadorActivo: string | null; // id del jugador activo
  dadosActuales: number[];
  dadosGuardados: number[];
  tiradasRestantes: number;
  primeraTirada: boolean; // para bonos de primera tirada
  ganador: string | null;
  generalaDoble: string | null; // jugador que hizo generala doble
}

interface Sala {
  id: string;
  codigo: string;
  estado_json: EstadoSala;
  host?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generarCodigo(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function tirarDado(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function contarDados(dados: number[]): Record<number, number> {
  const conteo: Record<number, number> = {};
  dados.forEach(d => {
    conteo[d] = (conteo[d] || 0) + 1;
  });
  return conteo;
}

function calcularCombinacion(dados: number[], tipo: Combinacion): number | null {
  const conteo = contarDados(dados);
  const valores = Object.values(conteo).sort((a, b) => b - a);
  const dadosOrdenados = [...dados].sort((a, b) => a - b);

  switch (tipo) {
    case 'unos':
      return dados.filter(d => d === 1).reduce((a, b) => a + b, 0);
    case 'doses':
      return dados.filter(d => d === 2).reduce((a, b) => a + b, 0);
    case 'treses':
      return dados.filter(d => d === 3).reduce((a, b) => a + b, 0);
    case 'cuatros':
      return dados.filter(d => d === 4).reduce((a, b) => a + b, 0);
    case 'cincos':
      return dados.filter(d => d === 5).reduce((a, b) => a + b, 0);
    case 'seises':
      return dados.filter(d => d === 6).reduce((a, b) => a + b, 0);
    
    case 'escalera': {
      const escalera1 = [1, 2, 3, 4, 5].every(n => dados.includes(n));
      const escalera2 = [2, 3, 4, 5, 6].every(n => dados.includes(n));
      return (escalera1 || escalera2) ? 20 : null;
    }
    
    case 'full': {
      const tiene3 = valores[0] >= 3;
      const tiene2 = valores[1] >= 2 || valores[0] >= 5;
      return (tiene3 && tiene2) ? 30 : null;
    }
    
    case 'poker': {
      return valores[0] >= 4 ? 40 : null;
    }
    
    case 'generala': {
      return valores[0] === 5 ? 50 : null;
    }
    
    default:
      return null;
  }
}

function obtenerCombinacionesDisponibles(dados: number[]): Combinacion[] {
  const disponibles: Combinacion[] = [];
  const tipos: Combinacion[] = ['unos', 'doses', 'treses', 'cuatros', 'cincos', 'seises', 'escalera', 'full', 'poker', 'generala'];
  
  tipos.forEach(tipo => {
    if (calcularCombinacion(dados, tipo) !== null) {
      disponibles.push(tipo);
    }
  });
  
  return disponibles;
}

function calcularPuntos(planilla: Planilla, primeraTirada: boolean): number {
  let total = 0;
  
  const valores: Array<{ tipo: Combinacion; valor: number | null }> = [
    { tipo: 'unos', valor: planilla.unos },
    { tipo: 'doses', valor: planilla.doses },
    { tipo: 'treses', valor: planilla.treses },
    { tipo: 'cuatros', valor: planilla.cuatros },
    { tipo: 'cincos', valor: planilla.cincos },
    { tipo: 'seises', valor: planilla.seises },
    { tipo: 'escalera', valor: planilla.escalera },
    { tipo: 'full', valor: planilla.full },
    { tipo: 'poker', valor: planilla.poker },
    { tipo: 'generala', valor: planilla.generala },
  ];
  
  valores.forEach(({ tipo, valor }) => {
    if (valor !== null) {
      let puntos = valor;
      // Bonos de primera tirada
      if (primeraTirada && tipo === 'escalera' && valor === 20) puntos = 25;
      if (primeraTirada && tipo === 'full' && valor === 30) puntos = 35;
      if (primeraTirada && tipo === 'poker' && valor === 40) puntos = 45;
      if (primeraTirada && tipo === 'generala' && valor === 50) puntos = 100;
      total += puntos;
    }
  });
  
  return total;
}

// ─── Componentes ────────────────────────────────────────────────────────────
function Lobby({ nombre, setNombre, codigo, setCodigo, error, setError, onCreateSala, onUnirseSala }: {
  nombre: string;
  setNombre: (n: string) => void;
  codigo: string;
  setCodigo: (c: string) => void;
  error: string;
  setError: (e: string) => void;
  onCreateSala: () => void;
  onUnirseSala: () => void;
}) {
  return (
    <div style={styles.container}>
      <div style={styles.title}>🎲 Generala Uruguaya</div>
      <div style={styles.subtitle}>2 a 6 jugadores</div>
      
      <div style={styles.form}>
        <input
          type="text"
          placeholder="Tu nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          style={styles.input}
          maxLength={20}
        />
        
        <button
          onClick={onCreateSala}
          disabled={!nombre.trim()}
          style={{ ...styles.button, ...styles.buttonPrimary }}
        >
          Crear Sala
        </button>
        
        <div style={styles.divider}>o</div>
        
        <input
          type="text"
          placeholder="Código de sala"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          style={styles.input}
          maxLength={6}
        />
        
        <button
          onClick={onUnirseSala}
          disabled={!nombre.trim() || !codigo.trim()}
          style={styles.button}
        >
          Unirse
        </button>
        
        {error && <div style={styles.error}>{error}</div>}
      </div>
    </div>
  );
}

function SalaEspera({ sala, jugadorId, onIniciar, onSalir }: {
  sala: Sala;
  jugadorId: string;
  onIniciar: () => void;
  onSalir: () => void;
}) {
  const jugador = sala.estado_json.jugadores.find(j => j.id === jugadorId);
  const esHost = jugador?.esHost || false;
  const puedeIniciar = esHost && sala.estado_json.jugadores.length >= MIN_JUGADORES && sala.estado_json.jugadores.length <= MAX_JUGADORES;

  return (
    <div style={styles.container}>
      <div style={styles.title}>Sala: {sala.codigo}</div>
      <div style={styles.subtitle}>
        {sala.estado_json.jugadores.length} / {MAX_JUGADORES} jugadores
      </div>
      
      <div style={styles.listaJugadores}>
        {sala.estado_json.jugadores.map((j, idx) => (
          <div key={j.id} style={styles.jugadorItem}>
            <span>{j.esHost ? '👑' : '👤'} {j.nombre}</span>
            {j.id === jugadorId && <span style={styles.tu}> (Tú)</span>}
          </div>
        ))}
      </div>
      
      {puedeIniciar && (
        <button onClick={onIniciar} style={{ ...styles.button, ...styles.buttonPrimary }}>
          Iniciar Partida
        </button>
      )}
      
      {!puedeIniciar && esHost && (
        <div style={styles.info}>
          Esperando más jugadores ({MIN_JUGADORES}-{MAX_JUGADORES})
        </div>
      )}
      
      <button onClick={onSalir} style={styles.button}>
        Salir
      </button>
    </div>
  );
}

function Dado({ valor, guardado, onClick, animando }: {
  valor: number;
  guardado: boolean;
  onClick: () => void;
  animando: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        ...styles.dado,
        ...(guardado ? styles.dadoGuardado : {}),
        ...(animando ? styles.dadoAnimando : {}),
      }}
    >
      <div style={styles.dadoValor}>{valor}</div>
      {guardado && <div style={styles.dadoLock}>🔒</div>}
    </div>
  );
}

function Juego({ sala, jugadorId, onAnotar, onTachar, onTirar, onGuardarDado, onDesguardarDado }: {
  sala: Sala;
  jugadorId: string;
  onAnotar: (combinacion: Combinacion) => void;
  onTachar: (combinacion: Combinacion) => void;
  onTirar: () => void;
  onGuardarDado: (idx: number) => void;
  onDesguardarDado: (idx: number) => void;
}) {
  const jugador = sala.estado_json.jugadores.find(j => j.id === jugadorId);
  const esMiTurno = sala.estado_json.jugadorActivo === jugadorId;
  const todosDados = [...sala.estado_json.dadosGuardados, ...sala.estado_json.dadosActuales];
  const combinacionesDisponibles = obtenerCombinacionesDisponibles(todosDados);
  const [animando, setAnimando] = useState(false);

  const handleTirar = () => {
    if (!esMiTurno || sala.estado_json.tiradasRestantes === 0) return;
    setAnimando(true);
    setTimeout(() => setAnimando(false), 800);
    onTirar();
  };

  const puedeAnotar = esMiTurno && sala.estado_json.tiradasRestantes === 0;
  const puedeTirar = esMiTurno && sala.estado_json.tiradasRestantes > 0;

  return (
    <div style={styles.container}>
      <div style={styles.headerJuego}>
        <div style={styles.codigoSala}>Sala: {sala.codigo}</div>
        <div style={styles.turnoInfo}>
          Turno: {sala.estado_json.jugadores[sala.estado_json.turnoActual]?.nombre || '...'}
        </div>
        <div style={styles.tiradasInfo}>
          {Array.from({ length: TIROS_MAXIMOS }).map((_, i) => (
            <span
              key={i}
              style={{
                ...styles.tiradaDot,
                ...(i < TIROS_MAXIMOS - sala.estado_json.tiradasRestantes ? styles.tiradaDotUsada : {}),
              }}
            >
              ●
            </span>
          ))}
        </div>
      </div>

      {sala.estado_json.ganador && (
        <div style={styles.ganador}>
          🎉 {sala.estado_json.jugadores.find(j => j.id === sala.estado_json.ganador)?.nombre} ganó!
        </div>
      )}

      {sala.estado_json.generalaDoble && (
        <div style={styles.ganador}>
          🏆 Generala Doble! {sala.estado_json.jugadores.find(j => j.id === sala.estado_json.generalaDoble)?.nombre} ganó!
        </div>
      )}

      {/* Dados */}
      <div style={styles.dadosContainer}>
        {sala.estado_json.dadosGuardados.map((valor, idx) => (
          <Dado
            key={`guardado-${idx}`}
            valor={valor}
            guardado={true}
            onClick={() => onDesguardarDado(idx)}
            animando={false}
          />
        ))}
        {sala.estado_json.dadosActuales.map((valor, idx) => (
          <Dado
            key={`actual-${idx}`}
            valor={valor}
            guardado={false}
            onClick={() => onGuardarDado(idx)}
            animando={animando}
          />
        ))}
      </div>

      {/* Botón Tirar */}
      {puedeTirar && (
        <button
          onClick={handleTirar}
          disabled={sala.estado_json.dadosActuales.length === 0}
          style={{ ...styles.button, ...styles.buttonPrimary, ...styles.buttonTirar }}
        >
          Tirar ({sala.estado_json.tiradasRestantes} restantes)
        </button>
      )}

      {/* Planilla de Puntos */}
      <div style={styles.planillaContainer}>
        <div style={styles.planillaHeader}>Planilla de Puntos</div>
        <div style={styles.planillaGrid}>
          <div style={styles.planillaHeaderRow}>
            <div style={styles.planillaColNombre}>Combinación</div>
            {sala.estado_json.jugadores.map(j => (
              <div key={j.id} style={styles.planillaCol}>
                {j.nombre}
                {j.id === jugadorId && ' (Tú)'}
              </div>
            ))}
          </div>
          
          {(['unos', 'doses', 'treses', 'cuatros', 'cincos', 'seises', 'escalera', 'full', 'poker', 'generala'] as Combinacion[]).map(combinacion => (
            <div key={combinacion} style={styles.planillaRow}>
              <div style={styles.planillaColNombre}>
                {combinacion.charAt(0).toUpperCase() + combinacion.slice(1)}
                {puedeAnotar && combinacionesDisponibles.includes(combinacion) && (
                  <span style={styles.disponible}> ✓</span>
                )}
              </div>
              {sala.estado_json.jugadores.map(j => {
                const valor = j.planilla[combinacion];
                const esMiPlanilla = j.id === jugadorId;
                const disponible = combinacionesDisponibles.includes(combinacion);
                const puedeAnotarEsta = puedeAnotar && esMiPlanilla && disponible;
                const puedeTacharEsta = puedeAnotar && esMiPlanilla && valor === null;
                
                return (
                  <div
                    key={j.id}
                    style={{
                      ...styles.planillaCol,
                      ...(puedeAnotarEsta ? styles.planillaColClickable : {}),
                      ...(puedeTacharEsta ? styles.planillaColTachable : {}),
                    }}
                    onClick={() => {
                      if (puedeAnotarEsta) onAnotar(combinacion);
                      else if (puedeTacharEsta) onTachar(combinacion);
                    }}
                  >
                    {valor !== null ? valor : (puedeTacharEsta ? '✗' : '-')}
                  </div>
                );
              })}
            </div>
          ))}
          
          {/* Totales */}
          <div style={styles.planillaRowTotal}>
            <div style={styles.planillaColNombre}>Total</div>
            {sala.estado_json.jugadores.map(j => {
              const total = calcularPuntos(j.planilla, sala.estado_json.primeraTirada);
              return (
                <div key={j.id} style={styles.planillaColTotal}>
                  {total}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente Principal ────────────────────────────────────────────────────
export default function GeneralaView({ onBack }: { onBack?: () => void }) {
  const { usuario } = useAuth();
  const nombre = usuario?.nombre || 'Jugador';
  const [codigo, setCodigo] = useState('');
  const [codigoInput, setCodigoInput] = useState('');
  const [error, setError] = useState('');
  const [sala, setSala] = useState<Sala | null>(null);
  const [jugadorId, setJugadorId] = useState<string>('');
  const channelRef = useRef<any>(null);
  const [animando, setAnimando] = useState(false);
  const [fase, setFase] = useState<'sala' | 'multijugador'>('sala');

  // Inicializar Supabase client
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).supabase) {
      // Cargar Supabase desde CDN si no está disponible
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      script.onload = () => {
        (window as any).supabase = (window as any).supabase.createClient(SUPA_URL, SUPA_KEY);
      };
      document.head.appendChild(script);
    }
  }, []);

  // ── Crear sala automáticamente ──────────────────────────────────────────────
  useEffect(() => {
    const crearSalaAuto = async () => {
      if (!nombre.trim()) return;
      
      try {
        const codigoSala = generarCodigo();
        const nuevoJugadorId = `jugador_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        setJugadorId(nuevoJugadorId);

        const planillaInicial: Planilla = {
          unos: null, doses: null, treses: null, cuatros: null,
          cincos: null, seises: null, escalera: null, full: null,
          poker: null, generala: null,
        };

        const estadoInicial: EstadoSala = {
          jugadores: [{
            id: nuevoJugadorId,
            nombre: nombre.trim(),
            planilla: planillaInicial,
            esHost: true,
          }],
          turnoActual: 0,
          estado: 'esperando',
          jugadorActivo: null,
          dadosActuales: [],
          dadosGuardados: [],
          tiradasRestantes: 0,
          primeraTirada: false,
          ganador: null,
          generalaDoble: null,
        };

        const response = await fetch(`${SUPA_URL}/rest/v1/generala_salas`, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify({
            codigo: codigoSala,
            estado_json: estadoInicial,
            host: nombre.trim(),
          }),
        });

        if (!response.ok) {
          throw new Error('Error al crear sala');
        }

        const data = await response.json();
        const nuevaSala: Sala = {
          id: data[0].id,
          codigo: codigoSala,
          estado_json: estadoInicial,
          host: nombre.trim(),
        };
        
        setSala(nuevaSala);
        setCodigo(codigoSala);
        setError('');

        // Suscribirse a cambios
        suscribirCambios(nuevaSala.id);
      } catch (err: any) {
        setError(err.message || 'Error al crear sala');
      }
    };
    crearSalaAuto();
  }, [nombre]);

  const unirseSala = async () => {
    if (!codigoInput.trim()) {
      setError('Ingresá el código');
      return;
    }

    try {
      const response = await fetch(`${SUPA_URL}/rest/v1/generala_salas?codigo=eq.${codigoInput.toUpperCase()}`, {
        headers: HEADERS,
      });

      if (!response.ok) {
        throw new Error('Error al buscar sala');
      }

      const data = await response.json();
      if (data.length === 0) {
        setError('Sala no encontrada');
        return;
      }

      const salaExistente = data[0];
      const estadoActual: EstadoSala = salaExistente.estado_json || salaExistente.estado;

      if (estadoActual.jugadores.length >= MAX_JUGADORES) {
        setError('Sala llena');
        return;
      }

      if (estadoActual.estado !== 'esperando' && estadoActual.estado !== 'lobby') {
        setError('La partida ya comenzó');
        return;
      }

      const nuevoJugadorId = `jugador_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      setJugadorId(nuevoJugadorId);

      const planillaInicial: Planilla = {
        unos: null, doses: null, treses: null, cuatros: null,
        cincos: null, seises: null, escalera: null, full: null,
        poker: null, generala: null,
      };

      estadoActual.jugadores.push({
        id: nuevoJugadorId,
        nombre: nombre.trim(),
        planilla: planillaInicial,
        esHost: false,
      });

      const salaActualizada: Sala = {
        id: salaExistente.id,
        codigo: salaExistente.codigo,
        estado_json: estadoActual,
        host: salaExistente.host,
      };

      await fetch(`${SUPA_URL}/rest/v1/generala_salas?id=eq.${salaExistente.id}`, {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify({ estado_json: estadoActual }),
      });

      setSala(salaActualizada);
      setError('');

      suscribirCambios(salaExistente.id);
    } catch (err: any) {
      setError(err.message || 'Error al unirse');
    }
  };

  const suscribirCambios = (salaId: string) => {
    if (typeof window === 'undefined' || !(window as any).supabase) {
      // Fallback: polling cada 2 segundos
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`${SUPA_URL}/rest/v1/generala_salas?id=eq.${salaId}`, {
            headers: HEADERS,
          });
          if (response.ok) {
            const data = await response.json();
            if (data.length > 0) {
              setSala({
                id: data[0].id,
                codigo: data[0].codigo,
                estado_json: data[0].estado_json || data[0].estado,
                host: data[0].host,
              });
            }
          }
        } catch (err) {
          console.error('Error en polling:', err);
        }
      }, 2000);

      return () => clearInterval(interval);
    }

    try {
      const supabase = (window as any).supabase;
      const channel = supabase.channel(`generala_${salaId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'generala_salas',
          filter: `id=eq.${salaId}`,
        }, (payload: any) => {
          if (payload.new) {
            setSala({
              id: payload.new.id,
              codigo: payload.new.codigo,
              estado_json: payload.new.estado_json || payload.new.estado,
              host: payload.new.host,
            });
          }
        })
        .subscribe();

      channelRef.current = channel;
    } catch (err) {
      console.error('Error suscribiendo cambios:', err);
    }
  };

  const iniciarPartida = async () => {
    if (!sala) return;

    const estadoActualizado = { ...sala.estado_json };
    estadoActualizado.estado = 'jugando';
    estadoActualizado.turnoActual = 0;
    estadoActualizado.jugadorActivo = estadoActualizado.jugadores[0].id;
    estadoActualizado.tiradasRestantes = TIROS_MAXIMOS;
    estadoActualizado.dadosActuales = Array.from({ length: DADOS_TOTALES }, () => tirarDado());
    estadoActualizado.dadosGuardados = [];
    estadoActualizado.primeraTirada = true;

    await actualizarEstado(estadoActualizado);
  };

  const tirarDados = async () => {
    if (!sala || sala.estado_json.jugadorActivo !== jugadorId) return;
    if (sala.estado_json.tiradasRestantes === 0) return;

    const estadoActualizado = { ...sala.estado_json };
    const dadosATirar = DADOS_TOTALES - estadoActualizado.dadosGuardados.length;
    estadoActualizado.dadosActuales = Array.from({ length: dadosATirar }, () => tirarDado());
    estadoActualizado.tiradasRestantes -= 1;
    estadoActualizado.primeraTirada = estadoActualizado.tiradasRestantes === TIROS_MAXIMOS - 1;

    await actualizarEstado(estadoActualizado);
  };

  const guardarDado = async (idx: number) => {
    if (!sala || sala.estado_json.jugadorActivo !== jugadorId) return;
    if (sala.estado_json.tiradasRestantes === 0) return;

    const estadoActualizado = { ...sala.estado_json };
    const dado = estadoActualizado.dadosActuales[idx];
    estadoActualizado.dadosGuardados.push(dado);
    estadoActualizado.dadosActuales = estadoActualizado.dadosActuales.filter((_, i) => i !== idx);

    await actualizarEstado(estadoActualizado);
  };

  const desguardarDado = async (idx: number) => {
    if (!sala || sala.estado_json.jugadorActivo !== jugadorId) return;
    if (sala.estado_json.tiradasRestantes === 0) return;

    const estadoActualizado = { ...sala.estado_json };
    const dado = estadoActualizado.dadosGuardados[idx];
    estadoActualizado.dadosActuales.push(dado);
    estadoActualizado.dadosGuardados = estadoActualizado.dadosGuardados.filter((_, i) => i !== idx);

    await actualizarEstado(estadoActualizado);
  };

  const anotarCombinacion = async (combinacion: Combinacion) => {
    if (!sala || sala.estado_json.jugadorActivo !== jugadorId) return;
    if (sala.estado_json.tiradasRestantes > 0) return;

    const jugador = sala.estado_json.jugadores.find(j => j.id === jugadorId);
    if (!jugador) return;
    if (jugador.planilla[combinacion] !== null) return;

    const todosDados = [...sala.estado_json.dadosGuardados, ...sala.estado_json.dadosActuales];
    const puntos = calcularCombinacion(todosDados, combinacion);
    if (puntos === null) return;

    const estadoActualizado = { ...sala.estado_json };
    const jugadorIdx = estadoActualizado.jugadores.findIndex(j => j.id === jugadorId);
    estadoActualizado.jugadores[jugadorIdx].planilla[combinacion] = puntos;

    // Bonos de primera tirada
    if (estadoActualizado.primeraTirada) {
      if (combinacion === 'escalera' && puntos === 20) {
        estadoActualizado.jugadores[jugadorIdx].planilla[combinacion] = 25;
      } else if (combinacion === 'full' && puntos === 30) {
        estadoActualizado.jugadores[jugadorIdx].planilla[combinacion] = 35;
      } else if (combinacion === 'poker' && puntos === 40) {
        estadoActualizado.jugadores[jugadorIdx].planilla[combinacion] = 45;
      } else if (combinacion === 'generala' && puntos === 50) {
        estadoActualizado.jugadores[jugadorIdx].planilla[combinacion] = 100;
        estadoActualizado.ganador = jugadorId;
        estadoActualizado.estado = 'terminado';
      }
    }

    // Verificar Generala doble
    if (combinacion === 'generala' && jugador.planilla.generala !== null && puntos === 50) {
      estadoActualizado.generalaDoble = jugadorId;
      estadoActualizado.ganador = jugadorId;
      estadoActualizado.estado = 'terminado';
    }

    // Verificar si completó todas las combinaciones
    const planillaCompleta = Object.values(estadoActualizado.jugadores[jugadorIdx].planilla).every(v => v !== null);
    if (planillaCompleta) {
      // Calcular ganador por puntos
      const puntajes = estadoActualizado.jugadores.map(j => ({
        id: j.id,
        puntos: calcularPuntos(j.planilla, estadoActualizado.primeraTirada),
      }));
      puntajes.sort((a, b) => b.puntos - a.puntos);
      estadoActualizado.ganador = puntajes[0].id;
      estadoActualizado.estado = 'terminado';
    } else {
      // Siguiente turno
      estadoActualizado.turnoActual = (estadoActualizado.turnoActual + 1) % estadoActualizado.jugadores.length;
      estadoActualizado.jugadorActivo = estadoActualizado.jugadores[estadoActualizado.turnoActual].id;
      estadoActualizado.tiradasRestantes = TIROS_MAXIMOS;
      estadoActualizado.dadosActuales = Array.from({ length: DADOS_TOTALES }, () => tirarDado());
      estadoActualizado.dadosGuardados = [];
      estadoActualizado.primeraTirada = true;
    }

    await actualizarEstado(estadoActualizado);
  };

  const tacharCombinacion = async (combinacion: Combinacion) => {
    if (!sala || sala.estado_json.jugadorActivo !== jugadorId) return;
    if (sala.estado_json.tiradasRestantes > 0) return;

    const jugador = sala.estado_json.jugadores.find(j => j.id === jugadorId);
    if (!jugador) return;
    if (jugador.planilla[combinacion] !== null) return;

    const estadoActualizado = { ...sala.estado_json };
    const jugadorIdx = estadoActualizado.jugadores.findIndex(j => j.id === jugadorId);
    estadoActualizado.jugadores[jugadorIdx].planilla[combinacion] = 0;

    // Verificar si completó todas las combinaciones
    const planillaCompleta = Object.values(estadoActualizado.jugadores[jugadorIdx].planilla).every(v => v !== null);
    if (planillaCompleta) {
      const puntajes = estadoActualizado.jugadores.map(j => ({
        id: j.id,
        puntos: calcularPuntos(j.planilla, estadoActualizado.primeraTirada),
      }));
      puntajes.sort((a, b) => b.puntos - a.puntos);
      estadoActualizado.ganador = puntajes[0].id;
      estadoActualizado.estado = 'terminado';
    } else {
      // Siguiente turno
      estadoActualizado.turnoActual = (estadoActualizado.turnoActual + 1) % estadoActualizado.jugadores.length;
      estadoActualizado.jugadorActivo = estadoActualizado.jugadores[estadoActualizado.turnoActual].id;
      estadoActualizado.tiradasRestantes = TIROS_MAXIMOS;
      estadoActualizado.dadosActuales = Array.from({ length: DADOS_TOTALES }, () => tirarDado());
      estadoActualizado.dadosGuardados = [];
      estadoActualizado.primeraTirada = true;
    }

    await actualizarEstado(estadoActualizado);
  };

  const actualizarEstado = async (estado: EstadoSala) => {
    if (!sala) return;

    try {
      await fetch(`${SUPA_URL}/rest/v1/generala_salas?id=eq.${sala.id}`, {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify({ estado_json: estado }),
      });
      // Actualizar estado local
      setSala({ ...sala, estado_json: estado });
    } catch (err) {
      console.error('Error actualizando estado:', err);
    }
  };

  const salir = () => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }
    setSala(null);
    setJugadorId('');
    setCodigo('');
    setError('');
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, []);

  if (fase === 'multijugador') {
    return (
      <div style={styles.fullPage}>
        <button style={styles.backButton} onClick={onBack}>← Volver</button>
        <div style={styles.lobbyCard}>
          <div style={styles.title}>🎲 GENERALA MULTIJUGADOR</div>
          <div style={styles.subtitle}>Ingresa el código de la sala</div>
          <input
            style={styles.input}
            placeholder="Código (ABCD)"
            value={codigoInput}
            onChange={e => { setCodigoInput(e.target.value.toUpperCase()); setError(''); }}
            maxLength={4}
            onKeyPress={(e) => e.key === 'Enter' && unirseSala()}
          />
          <button style={styles.btnPrimary} onClick={unirseSala}>
            Unirse
          </button>
          {error && <div style={styles.errorMsg}>{error}</div>}
        </div>
      </div>
    );
  }

  if (!sala || !codigo) {
    return <div style={styles.fullPage}>Cargando generala...</div>;
  }

  if (sala.estado_json.estado === 'esperando') {
    return (
      <SalaEspera
        sala={sala}
        jugadorId={jugadorId}
        onIniciar={iniciarPartida}
        onSalir={salir}
      />
    );
  }

  return (
    <Juego
      sala={sala}
      jugadorId={jugadorId}
      onAnotar={anotarCombinacion}
      onTachar={tacharCombinacion}
      onTirar={tirarDados}
      onGuardarDado={guardarDado}
      onDesguardarDado={desguardarDado}
    />
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
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
  errorMsg: {
    background: '#3a1a1a',
    color: '#ff6b6b',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    textAlign: 'center',
  },
  container: {
    minHeight: '100vh',
    padding: '20px',
    backgroundColor: '#1a1a2e',
    color: '#eee',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '10px',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '18px',
    color: '#aaa',
    marginBottom: '30px',
    textAlign: 'center',
  },
  form: {
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  input: {
    padding: '15px',
    fontSize: '16px',
    borderRadius: '8px',
    border: '2px solid #333',
    backgroundColor: '#2a2a3e',
    color: '#eee',
    outline: 'none',
  },
  button: {
    padding: '15px',
    fontSize: '18px',
    fontWeight: 'bold',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#444',
    color: '#eee',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  buttonPrimary: {
    backgroundColor: '#4a9eff',
  },
  buttonTirar: {
    fontSize: '24px',
    padding: '20px',
    marginTop: '20px',
    marginBottom: '20px',
  },
  divider: {
    textAlign: 'center',
    color: '#666',
    margin: '10px 0',
  },
  error: {
    color: '#ff4444',
    textAlign: 'center',
    padding: '10px',
    backgroundColor: '#3a1a1a',
    borderRadius: '8px',
  },
  listaJugadores: {
    width: '100%',
    maxWidth: '400px',
    marginBottom: '30px',
  },
  jugadorItem: {
    padding: '15px',
    marginBottom: '10px',
    backgroundColor: '#2a2a3e',
    borderRadius: '8px',
    fontSize: '18px',
  },
  tu: {
    color: '#4a9eff',
    fontWeight: 'bold',
  },
  info: {
    textAlign: 'center',
    color: '#aaa',
    marginBottom: '20px',
  },
  headerJuego: {
    width: '100%',
    textAlign: 'center',
    marginBottom: '20px',
  },
  codigoSala: {
    fontSize: '16px',
    color: '#aaa',
    marginBottom: '10px',
  },
  turnoInfo: {
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '10px',
  },
  tiradasInfo: {
    fontSize: '24px',
    letterSpacing: '10px',
  },
  tiradaDot: {
    color: '#666',
  },
  tiradaDotUsada: {
    color: '#4a9eff',
  },
  ganador: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#ffd700',
    textAlign: 'center',
    padding: '20px',
    backgroundColor: '#3a2a1a',
    borderRadius: '12px',
    marginBottom: '20px',
    animation: 'pulse 1s infinite',
  },
  dadosContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '15px',
    marginBottom: '20px',
  },
  dado: {
    width: '70px',
    height: '70px',
    backgroundColor: '#fff',
    color: '#000',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '36px',
    fontWeight: 'bold',
    cursor: 'pointer',
    position: 'relative',
    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
    transition: 'all 0.2s',
    userSelect: 'none',
  },
  dadoGuardado: {
    backgroundColor: '#4a9eff',
    color: '#fff',
    transform: 'scale(1.1)',
    boxShadow: '0 0 20px rgba(74, 158, 255, 0.5)',
  },
  dadoAnimando: {
    animation: 'roll 0.8s ease-in-out',
  },
  dadoValor: {
    fontSize: '36px',
  },
  dadoLock: {
    position: 'absolute',
    top: '2px',
    right: '2px',
    fontSize: '12px',
  },
  planillaContainer: {
    width: '100%',
    maxWidth: '100%',
    backgroundColor: '#2a2a3e',
    borderRadius: '12px',
    padding: '15px',
    overflowX: 'auto',
  },
  planillaHeader: {
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '15px',
    textAlign: 'center',
  },
  planillaGrid: {
    display: 'grid',
    gridTemplateColumns: '120px repeat(auto-fit, minmax(80px, 1fr))',
    gap: '8px',
    fontSize: '14px',
  },
  planillaHeaderRow: {
    display: 'contents',
    fontWeight: 'bold',
    borderBottom: '2px solid #444',
    paddingBottom: '8px',
    marginBottom: '8px',
  },
  planillaRow: {
    display: 'contents',
  },
  planillaRowTotal: {
    display: 'contents',
    fontWeight: 'bold',
    borderTop: '2px solid #444',
    paddingTop: '8px',
    marginTop: '8px',
  },
  planillaColNombre: {
    padding: '8px',
    textAlign: 'left',
  },
  planillaCol: {
    padding: '8px',
    textAlign: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: '4px',
  },
  planillaColClickable: {
    backgroundColor: '#2a4a3e',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  planillaColTachable: {
    backgroundColor: '#4a2a2a',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  planillaColTotal: {
    padding: '8px',
    textAlign: 'center',
    backgroundColor: '#3a3a4e',
    borderRadius: '4px',
  },
  disponible: {
    color: '#4a9eff',
  },
};

// Agregar animaciones CSS
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes roll {
      0% { transform: rotate(0deg); }
      25% { transform: rotate(90deg) scale(1.1); }
      50% { transform: rotate(180deg) scale(0.9); }
      75% { transform: rotate(270deg) scale(1.1); }
      100% { transform: rotate(360deg); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
  `;
  document.head.appendChild(style);
}
