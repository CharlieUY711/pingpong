/**
 * TrivialView.tsx — Trivia Multijugador por Equipos
 * Supabase Realtime — funciona en redes distintas
 * Claude API para generar preguntas
 * Optimizado para celular portrait
 */
import React, { useState, useEffect, useRef } from 'react';

// ─── Config ────────────────────────────────────────────────────────────────
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qhnmxvexkizcsmivfuam.supabase.co';
const SUPA_KEY = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFobm14dmV4a2l6Y3NtaXZmdWFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTIyMTI4MSwiZXhwIjoyMDg2Nzk3MjgxfQ.b2N86NyMG4F3CXcgTnzOjqx7AZPyDTa4QFFCtOSK42s';
const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY || '';

const HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPA_KEY,
  'Authorization': `Bearer ${SUPA_KEY}`,
  'Prefer': 'return=representation',
};

// ─── Constantes ────────────────────────────────────────────────────────────
const CATEGORIAS = [
  'Historia', 'Ciencia y Tecnología', 'Geografía', 'Deportes',
  'Arte y Cultura', 'Cine y Música', 'Naturaleza', 'Gastronomía',
  'Matemáticas', 'Literatura'
];

const COLORES_EQUIPOS = ['#FF6B35', '#4ECDC4', '#45B7D1', '#FFA07A'];

// ─── Tipos ──────────────────────────────────────────────────────────────────
type Publico = 'adolescente' | 'adulto';
type Dificultad = 'facil' | 'medio' | 'dificil';
type ModoPuntuacion = 'fijos' | 'velocidad';
type FormatoPregunta = 'multiple' | 'verdadero_falso';

interface ConfigSala {
  publico: Publico;
  categorias: string[];
  dificultad: Dificultad;
  preguntasPorCategoria: number;
  tiempoRespuesta: number;
  modoPuntuacion: ModoPuntuacion;
  penalizacion: boolean;
}

interface Jugador {
  id: string;
  nombre: string;
  equipoId: string | null;
  esCapitán: boolean;
  esHost: boolean;
}

interface Equipo {
  id: string;
  nombre: string;
  jugadores: string[]; // IDs de jugadores
  puntos: number;
  color: string;
}

interface Pregunta {
  id: string;
  pregunta: string;
  opciones: string[];
  respuesta_correcta: string;
  explicacion: string;
  categoria: string;
  dificultad: Dificultad;
  publico: Publico;
  formato: FormatoPregunta;
  fuente: 'manual' | 'claude';
}

interface RespuestaEquipo {
  equipoId: string;
  respuesta: string;
  tiempoRestante: number; // segundos restantes cuando respondieron
  puntos: number;
}

interface EstadoSala {
  estado: 'lobby' | 'configuracion' | 'esperando' | 'jugando' | 'resultados';
  config: ConfigSala | null;
  equipos: Equipo[];
  jugadores: Jugador[];
  preguntaActual: Pregunta | null;
  preguntaNumero: number;
  totalPreguntas: number;
  respuestas: RespuestaEquipo[];
  tiempoInicio: number | null; // timestamp cuando empezó la pregunta
  respuestaRevelada: boolean;
  categoriaActual: string | null;
}

interface Sala {
  id: string;
  codigo: string;
  estado: EstadoSala;
}

interface Mensaje {
  id: string;
  sala_id: string;
  equipo_id: string | null;
  jugador: string;
  mensaje: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function generarCodigo(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generarIdEquipo(): string {
  return `equipo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

async function generarPreguntaClaude(
  categoria: string,
  publico: Publico,
  dificultad: Dificultad
): Promise<Omit<Pregunta, 'id' | 'fuente'>> {
  if (!ANTHROPIC_KEY) {
    throw new Error('Claude API key no configurada');
  }

  const prompt = `Generá una pregunta de trivia sobre ${categoria} para público ${publico} con dificultad ${dificultad}. 

Responde SOLO con un JSON válido con estos campos:
- pregunta: string (la pregunta)
- opciones: array de 4 strings (si es múltiple opción) o ["Verdadero", "Falso"] (si es verdadero/falso)
- respuesta_correcta: string (una de las opciones)
- explicacion: string (breve explicación)
- formato: "multiple" o "verdadero_falso"

Ejemplo de respuesta:
{
  "pregunta": "¿Cuál es la capital de Francia?",
  "opciones": ["París", "Londres", "Madrid", "Roma"],
  "respuesta_correcta": "París",
  "explicacion": "París es la capital y ciudad más poblada de Francia.",
  "formato": "multiple"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: prompt,
        }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al generar pregunta con Claude: ${errorText}`);
    }

    const data = await response.json();
    const content = data.content[0].text;
    
    // Extraer JSON del contenido (puede estar entre markdown code blocks o directamente)
    let jsonText = content.trim();
    
    // Si está en un bloque de código, extraerlo
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    } else {
      // Buscar el primer objeto JSON
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
    }

    if (!jsonText) {
      throw new Error('No se pudo encontrar JSON en la respuesta de Claude');
    }

    const preguntaData = JSON.parse(jsonText);
    
    return {
      pregunta: preguntaData.pregunta,
      opciones: preguntaData.opciones || ['Verdadero', 'Falso'],
      respuesta_correcta: preguntaData.respuesta_correcta,
      explicacion: preguntaData.explicacion || '',
      categoria,
      dificultad,
      publico,
      formato: preguntaData.formato || 'multiple',
    };
  } catch (err: any) {
    throw new Error(`Error al generar pregunta: ${err.message}`);
  }
}

async function obtenerPregunta(
  categoria: string,
  publico: Publico,
  dificultad: Dificultad,
  formato?: FormatoPregunta
): Promise<Pregunta> {
  // Buscar en banco propio
  let query = `categoria=eq.${categoria}&publico=eq.${publico}&dificultad=eq.${dificultad}`;
  if (formato) {
    query += `&formato=eq.${formato}`;
  }

  try {
    const response = await fetch(`${SUPA_URL}/rest/v1/trivial_preguntas?${query}&limit=100`, {
      headers: HEADERS,
    });

    if (response.ok) {
      const preguntas: any[] = await response.json();
      if (preguntas.length > 0) {
        // Seleccionar una aleatoria
        const pregunta = preguntas[Math.floor(Math.random() * preguntas.length)];
        return {
          id: pregunta.id,
          pregunta: pregunta.pregunta,
          opciones: pregunta.opciones,
          respuesta_correcta: pregunta.respuesta_correcta,
          explicacion: pregunta.explicacion || '',
          categoria: pregunta.categoria,
          dificultad: pregunta.dificultad,
          publico: pregunta.publico,
          formato: pregunta.formato,
          fuente: pregunta.fuente || 'manual',
        };
      }
    }
  } catch (err) {
    console.error('Error al buscar pregunta:', err);
  }

  // Si no hay preguntas, generar con Claude
  const preguntaGenerada = await generarPreguntaClaude(categoria, publico, dificultad);
  
  // Guardar en Supabase
  try {
    const response = await fetch(`${SUPA_URL}/rest/v1/trivial_preguntas`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        ...preguntaGenerada,
        fuente: 'claude',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        id: data[0].id,
        ...preguntaGenerada,
        fuente: 'claude',
      };
    }
  } catch (err) {
    console.error('Error al guardar pregunta:', err);
  }

  return {
    id: `temp_${Date.now()}`,
    ...preguntaGenerada,
    fuente: 'claude',
  };
}

function calcularPuntos(
  correcta: boolean,
  tiempoRestante: number,
  tiempoTotal: number,
  modoPuntuacion: ModoPuntuacion,
  penalizacion: boolean
): number {
  if (!correcta) {
    return penalizacion ? -1 : 0;
  }

  if (modoPuntuacion === 'fijos') {
    return 1;
  }

  // Puntos por velocidad
  const porcentajeTiempo = (tiempoRestante / tiempoTotal) * 100;
  if (porcentajeTiempo >= 80) return 3;
  if (porcentajeTiempo >= 40) return 2;
  return 1;
}

// ─── Componentes ───────────────────────────────────────────────────────────
function Lobby({ onCreateSala, onUnirseSala }: {
  onCreateSala: (nombre: string) => void;
  onUnirseSala: (nombre: string, codigo: string) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');

  const handleCreate = () => {
    if (!nombre.trim()) {
      setError('Ingresá tu nombre');
      return;
    }
    onCreateSala(nombre.trim());
  };

  const handleUnirse = () => {
    if (!nombre.trim() || !codigo.trim()) {
      setError('Completá nombre y código');
      return;
    }
    onUnirseSala(nombre.trim(), codigo.toUpperCase());
  };

  return (
    <div style={styles.container}>
      <div style={styles.title}>🧠 Trivia Multijugador</div>
      <div style={styles.subtitle}>Por equipos</div>

      <input
        type="text"
        placeholder="Tu nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        style={styles.input}
        maxLength={20}
      />

      <button
        onClick={handleCreate}
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
        onClick={handleUnirse}
        disabled={!nombre.trim() || !codigo.trim()}
        style={styles.button}
      >
        Unirse
      </button>

      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
}

function Configuracion({ sala, jugadorId, onConfigurar, onCancelar }: {
  sala: Sala;
  jugadorId: string;
  onConfigurar: (config: ConfigSala) => void;
  onCancelar: () => void;
}) {
  const [publico, setPublico] = useState<Publico>('adulto');
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState<string[]>([]);
  const [dificultad, setDificultad] = useState<Dificultad>('medio');
  const [preguntasPorCategoria, setPreguntasPorCategoria] = useState(10);
  const [tiempoRespuesta, setTiempoRespuesta] = useState(30);
  const [modoPuntuacion, setModoPuntuacion] = useState<ModoPuntuacion>('fijos');
  const [penalizacion, setPenalizacion] = useState(false);

  const toggleCategoria = (cat: string) => {
    if (categoriasSeleccionadas.includes(cat)) {
      setCategoriasSeleccionadas(categoriasSeleccionadas.filter(c => c !== cat));
    } else {
      if (categoriasSeleccionadas.length < 6) {
        setCategoriasSeleccionadas([...categoriasSeleccionadas, cat]);
      }
    }
  };

  const handleConfigurar = () => {
    if (categoriasSeleccionadas.length !== 6) {
      alert('Seleccioná exactamente 6 categorías');
      return;
    }

    onConfigurar({
      publico,
      categorias: categoriasSeleccionadas,
      dificultad,
      preguntasPorCategoria,
      tiempoRespuesta,
      modoPuntuacion,
      penalizacion,
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.title}>Configuración de la Partida</div>
      <div style={styles.subtitle}>Sala: {sala.codigo}</div>

      <div style={styles.configSection}>
        <div style={styles.configLabel}>Público:</div>
        <div style={styles.configOptions}>
          <button
            onClick={() => setPublico('adolescente')}
            style={{
              ...styles.configButton,
              ...(publico === 'adolescente' ? styles.configButtonActive : {}),
            }}
          >
            Adolescente (12-17)
          </button>
          <button
            onClick={() => setPublico('adulto')}
            style={{
              ...styles.configButton,
              ...(publico === 'adulto' ? styles.configButtonActive : {}),
            }}
          >
            Adulto (18+)
          </button>
        </div>
      </div>

      <div style={styles.configSection}>
        <div style={styles.configLabel}>Categorías (6):</div>
        <div style={styles.categoriasGrid}>
          {CATEGORIAS.map(cat => (
            <button
              key={cat}
              onClick={() => toggleCategoria(cat)}
              style={{
                ...styles.categoriaButton,
                ...(categoriasSeleccionadas.includes(cat) ? styles.categoriaButtonActive : {}),
              }}
            >
              {cat}
            </button>
          ))}
        </div>
        <div style={styles.configHint}>
          {categoriasSeleccionadas.length} / 6 seleccionadas
        </div>
      </div>

      <div style={styles.configSection}>
        <div style={styles.configLabel}>Dificultad:</div>
        <div style={styles.configOptions}>
          {(['facil', 'medio', 'dificil'] as Dificultad[]).map(diff => (
            <button
              key={diff}
              onClick={() => setDificultad(diff)}
              style={{
                ...styles.configButton,
                ...(dificultad === diff ? styles.configButtonActive : {}),
              }}
            >
              {diff === 'facil' ? 'Fácil' : diff === 'medio' ? 'Medio' : 'Difícil'}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.configSection}>
        <div style={styles.configLabel}>Preguntas por categoría:</div>
        <div style={styles.configOptions}>
          {[5, 10, 15].map(num => (
            <button
              key={num}
              onClick={() => setPreguntasPorCategoria(num)}
              style={{
                ...styles.configButton,
                ...(preguntasPorCategoria === num ? styles.configButtonActive : {}),
              }}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.configSection}>
        <div style={styles.configLabel}>Tiempo para responder:</div>
        <div style={styles.configOptions}>
          {[15, 30, 60].map(seg => (
            <button
              key={seg}
              onClick={() => setTiempoRespuesta(seg)}
              style={{
                ...styles.configButton,
                ...(tiempoRespuesta === seg ? styles.configButtonActive : {}),
              }}
            >
              {seg}s
            </button>
          ))}
        </div>
      </div>

      <div style={styles.configSection}>
        <div style={styles.configLabel}>Modo puntuación:</div>
        <div style={styles.configOptions}>
          <button
            onClick={() => setModoPuntuacion('fijos')}
            style={{
              ...styles.configButton,
              ...(modoPuntuacion === 'fijos' ? styles.configButtonActive : {}),
            }}
          >
            Puntos fijos (1)
          </button>
          <button
            onClick={() => setModoPuntuacion('velocidad')}
            style={{
              ...styles.configButton,
              ...(modoPuntuacion === 'velocidad' ? styles.configButtonActive : {}),
            }}
          >
            Por velocidad (3/2/1)
          </button>
        </div>
      </div>

      <div style={styles.configSection}>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={penalizacion}
            onChange={(e) => setPenalizacion(e.target.checked)}
            style={styles.checkbox}
          />
          Penalización: respuesta incorrecta resta 1 punto
        </label>
      </div>

      <div style={styles.configActions}>
        <button onClick={onCancelar} style={styles.button}>
          Cancelar
        </button>
        <button
          onClick={handleConfigurar}
          disabled={categoriasSeleccionadas.length !== 6}
          style={{ ...styles.button, ...styles.buttonPrimary }}
        >
          Confirmar
        </button>
      </div>
    </div>
  );
}

function SeleccionEquipo({ sala, jugadorId, onUnirseEquipo, onCreateEquipo }: {
  sala: Sala;
  jugadorId: string;
  onUnirseEquipo: (equipoId: string) => void;
  onCreateEquipo: (nombreEquipo: string) => void;
}) {
  const [nombreEquipo, setNombreEquipo] = useState('');
  const [mostrarCrear, setMostrarCrear] = useState(false);
  const jugador = sala.estado.jugadores.find(j => j.id === jugadorId);

  const equiposDisponibles = sala.estado.equipos.filter(eq => eq.jugadores.length < 10);
  const puedeCrearEquipo = sala.estado.equipos.length < 4;

  if (jugador?.equipoId) {
    const equipo = sala.estado.equipos.find(e => e.id === jugador.equipoId);
    return (
      <div style={styles.container}>
        <div style={styles.title}>Equipo: {equipo?.nombre}</div>
        <div style={styles.subtitle}>
          {jugador.esCapitán ? '👑 Eres el capitán' : 'Jugador'}
        </div>
        <div style={styles.equipoInfo}>
          <div style={styles.equipoColor}></div>
          <div>
            <div style={styles.equipoNombre}>{equipo?.nombre}</div>
            <div style={styles.equipoJugadores}>
              {equipo?.jugadores.length} jugador{equipo?.jugadores.length !== 1 ? 'es' : ''}
            </div>
          </div>
        </div>
        <div style={styles.info}>
          Esperando a que el host inicie la partida...
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.title}>Elegí tu Equipo</div>
      <div style={styles.subtitle}>Sala: {sala.codigo}</div>

      <div style={styles.equiposList}>
        {sala.estado.equipos.map((equipo, idx) => (
          <button
            key={equipo.id}
            onClick={() => onUnirseEquipo(equipo.id)}
            style={{
              ...styles.equipoCard,
              borderColor: equipo.color,
            }}
          >
            <div style={{ ...styles.equipoColor, backgroundColor: equipo.color }}></div>
            <div style={styles.equipoCardContent}>
              <div style={styles.equipoNombre}>{equipo.nombre}</div>
              <div style={styles.equipoJugadores}>
                {equipo.jugadores.length} jugador{equipo.jugadores.length !== 1 ? 'es' : ''}
              </div>
            </div>
            {equipo.jugadores.length === 0 && (
              <div style={styles.equipoNuevo}>Nuevo</div>
            )}
          </button>
        ))}
      </div>

      {puedeCrearEquipo && (
        <>
          {!mostrarCrear ? (
            <button
              onClick={() => setMostrarCrear(true)}
              style={{ ...styles.button, ...styles.buttonPrimary }}
            >
              Crear Nuevo Equipo
            </button>
          ) : (
            <div style={styles.crearEquipo}>
              <input
                type="text"
                placeholder="Nombre del equipo"
                value={nombreEquipo}
                onChange={(e) => setNombreEquipo(e.target.value)}
                style={styles.input}
                maxLength={20}
              />
              <div style={styles.crearEquipoActions}>
                <button
                  onClick={() => {
                    setMostrarCrear(false);
                    setNombreEquipo('');
                  }}
                  style={styles.button}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (nombreEquipo.trim()) {
                      onCreateEquipo(nombreEquipo.trim());
                      setNombreEquipo('');
                      setMostrarCrear(false);
                    }
                  }}
                  disabled={!nombreEquipo.trim()}
                  style={{ ...styles.button, ...styles.buttonPrimary }}
                >
                  Crear
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div style={styles.info}>
        {sala.estado.equipos.length} / 4 equipos creados
      </div>
    </div>
  );
}

function SalaEspera({ sala, jugadorId, onIniciar, onSalir }: {
  sala: Sala;
  jugadorId: string;
  onIniciar?: () => void;
  onSalir: () => void;
}) {
  const jugador = sala.estado.jugadores.find(j => j.id === jugadorId);
  const esHost = jugador?.esHost || false;
  const totalEquipos = sala.estado.equipos.length;
  const puedeIniciar = esHost && totalEquipos >= 2 && totalEquipos <= 4;

  return (
    <div style={styles.container}>
      <div style={styles.title}>Sala: {sala.codigo}</div>
      <div style={styles.subtitle}>
        {totalEquipos} equipo{totalEquipos !== 1 ? 's' : ''} formado{totalEquipos !== 1 ? 's' : ''}
      </div>

      <div style={styles.equiposList}>
        {sala.estado.equipos.map(equipo => (
          <div
            key={equipo.id}
            style={{
              ...styles.equipoCard,
              borderColor: equipo.color,
            }}
          >
            <div style={{ ...styles.equipoColor, backgroundColor: equipo.color }}></div>
            <div style={styles.equipoCardContent}>
              <div style={styles.equipoNombre}>{equipo.nombre}</div>
              <div style={styles.equipoJugadores}>
                {equipo.jugadores.map(jugId => {
                  const jug = sala.estado.jugadores.find(j => j.id === jugId);
                  return (
                    <span key={jugId} style={styles.jugadorTag}>
                      {jug?.esCapitán ? '👑' : '👤'} {jug?.nombre}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {puedeIniciar && onIniciar && (
        <button onClick={onIniciar} style={{ ...styles.button, ...styles.buttonPrimary }}>
          Iniciar Partida
        </button>
      )}

      {!puedeIniciar && esHost && (
        <div style={styles.info}>
          Esperando más equipos (2-4 equipos necesarios)
        </div>
      )}

      <button onClick={onSalir} style={styles.button}>
        Salir
      </button>
    </div>
  );
}

function Cronometro({ tiempoTotal, tiempoRestante, onAgotado }: {
  tiempoTotal: number;
  tiempoRestante: number;
  onAgotado: () => void;
}) {
  const porcentaje = (tiempoRestante / tiempoTotal) * 100;
  let color = '#4CAF50'; // verde
  if (porcentaje < 40) color = '#FFC107'; // amarillo
  if (porcentaje < 20) color = '#F44336'; // rojo

  return (
    <div style={styles.cronometroContainer}>
      <div style={styles.cronometroBar}>
        <div
          style={{
            ...styles.cronometroFill,
            width: `${porcentaje}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <div style={styles.cronometroTiempo}>{tiempoRestante}s</div>
    </div>
  );
}

function Chat({ mensajes, equipoId, jugadorId, onEnviarMensaje, esPrivado }: {
  mensajes: Mensaje[];
  equipoId: string | null;
  jugadorId: string;
  onEnviarMensaje: (mensaje: string) => void;
  esPrivado: boolean;
}) {
  const [mensaje, setMensaje] = useState('');
  const [abierto, setAbierto] = useState(false);
  const mensajesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mensajesRef.current) {
      mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight;
    }
  }, [mensajes]);

  const handleEnviar = () => {
    if (mensaje.trim()) {
      onEnviarMensaje(mensaje.trim());
      setMensaje('');
    }
  };

  const mensajesFiltrados = mensajes.filter(m =>
    esPrivado ? m.equipo_id === equipoId : m.equipo_id === null
  );

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        style={styles.chatToggle}
      >
        💬 {esPrivado ? 'Equipo' : 'General'} ({mensajesFiltrados.length})
      </button>
    );
  }

  return (
    <div style={styles.chatPanel}>
      <div style={styles.chatHeader}>
        <span>{esPrivado ? '💬 Chat Equipo' : '💬 Chat General'}</span>
        <button onClick={() => setAbierto(false)} style={styles.chatClose}>✕</button>
      </div>
      <div ref={mensajesRef} style={styles.chatMensajes}>
        {mensajesFiltrados.map(msg => (
          <div key={msg.id} style={styles.chatMensaje}>
            <div style={styles.chatMensajeJugador}>{msg.jugador}:</div>
            <div style={styles.chatMensajeTexto}>{msg.mensaje}</div>
          </div>
        ))}
      </div>
      <div style={styles.chatInput}>
        <input
          type="text"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleEnviar()}
          placeholder="Escribí un mensaje..."
          style={styles.chatInputField}
        />
        <button onClick={handleEnviar} style={styles.chatEnviar}>Enviar</button>
      </div>
    </div>
  );
}

function Juego({ sala, jugadorId, onResponder, mensajes, onEnviarMensaje }: {
  sala: Sala;
  jugadorId: string;
  onResponder: (respuesta: string) => void;
  mensajes: Mensaje[];
  onEnviarMensaje: (mensaje: string, equipoId: string | null) => void;
}) {
  const jugador = sala.estado.jugadores.find(j => j.id === jugadorId);
  const equipo = jugador?.equipoId ? sala.estado.equipos.find(e => e.id === jugador.equipoId) : null;
  const pregunta = sala.estado.preguntaActual;
  const config = sala.estado.config!;
  const tiempoTotal = config.tiempoRespuesta;
  const [tiempoRestante, setTiempoRestante] = useState(tiempoTotal);
  const [respuestaSeleccionada, setRespuestaSeleccionada] = useState<string | null>(null);
  const puedeResponder = jugador?.esCapitán && !sala.estado.respuestaRevelada;
  const yaRespondio = sala.estado.respuestas.some(r => r.equipoId === equipo?.id);

  useEffect(() => {
    if (!sala.estado.tiempoInicio || sala.estado.respuestaRevelada) return;

    const interval = setInterval(() => {
      const ahora = Date.now();
      const transcurrido = Math.floor((ahora - sala.estado.tiempoInicio!) / 1000);
      const restante = Math.max(0, tiempoTotal - transcurrido);
      setTiempoRestante(restante);

      if (restante === 0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [sala.estado.tiempoInicio, sala.estado.respuestaRevelada, tiempoTotal]);

  const handleResponder = () => {
    if (respuestaSeleccionada && puedeResponder) {
      onResponder(respuestaSeleccionada);
    }
  };

  if (!pregunta) {
    return (
      <div style={styles.container}>
        <div style={styles.title}>Cargando pregunta...</div>
      </div>
    );
  }

  const respuestaCorrecta = sala.estado.respuestaRevelada
    ? pregunta.respuesta_correcta
    : null;
  const respuestaEquipo = sala.estado.respuestas.find(r => r.equipoId === equipo?.id);

  return (
    <div style={styles.container}>
      <div style={styles.juegoHeader}>
        <div style={styles.juegoInfo}>
          Pregunta {sala.estado.preguntaNumero} / {sala.estado.totalPreguntas}
        </div>
        <div style={styles.juegoCategoria}>{pregunta.categoria}</div>
      </div>

      <Cronometro
        tiempoTotal={tiempoTotal}
        tiempoRestante={tiempoRestante}
        onAgotado={() => {}}
      />

      <div style={styles.preguntaContainer}>
        <div style={styles.preguntaTexto}>{pregunta.pregunta}</div>
      </div>

      <div style={styles.opcionesContainer}>
        {pregunta.opciones.map((opcion, idx) => {
          let estiloOpcion = styles.opcion;
          if (sala.estado.respuestaRevelada) {
            if (opcion === respuestaCorrecta) {
              estiloOpcion = { ...estiloOpcion, ...styles.opcionCorrecta };
            } else if (respuestaEquipo && opcion === respuestaEquipo.respuesta && opcion !== respuestaCorrecta) {
              estiloOpcion = { ...estiloOpcion, ...styles.opcionIncorrecta };
            }
          } else if (respuestaSeleccionada === opcion) {
            estiloOpcion = { ...estiloOpcion, ...styles.opcionSeleccionada };
          }

          return (
            <button
              key={idx}
              onClick={() => puedeResponder && setRespuestaSeleccionada(opcion)}
              disabled={!puedeResponder || yaRespondio}
              style={estiloOpcion}
            >
              {opcion}
            </button>
          );
        })}
      </div>

      {sala.estado.respuestaRevelada && pregunta.explicacion && (
        <div style={styles.explicacion}>
          <div style={styles.explicacionTitulo}>Explicación:</div>
          <div style={styles.explicacionTexto}>{pregunta.explicacion}</div>
        </div>
      )}

      {puedeResponder && !yaRespondio && !sala.estado.respuestaRevelada && (
        <button
          onClick={handleResponder}
          disabled={!respuestaSeleccionada}
          style={{ ...styles.button, ...styles.buttonPrimary, marginTop: 20 }}
        >
          Confirmar Respuesta
        </button>
      )}

      {yaRespondio && !sala.estado.respuestaRevelada && (
        <div style={styles.info}>
          ✅ Respuesta enviada. Esperando a otros equipos...
        </div>
      )}

      <div style={styles.puntajesContainer}>
        {sala.estado.equipos.map(eq => (
          <div
            key={eq.id}
            style={{
              ...styles.puntajeCard,
              borderColor: eq.color,
              ...(eq.id === equipo?.id ? styles.puntajeCardActivo : {}),
            }}
          >
            <div style={{ ...styles.puntajeColor, backgroundColor: eq.color }}></div>
            <div style={styles.puntajeNombre}>{eq.nombre}</div>
            <div style={styles.puntajePuntos}>{eq.puntos} pts</div>
            {sala.estado.respuestas.some(r => r.equipoId === eq.id) && (
              <div style={styles.puntajeRespondio}>✓</div>
            )}
          </div>
        ))}
      </div>

      <div style={styles.chatsContainer}>
        {equipo && (
          <Chat
            mensajes={mensajes}
            equipoId={equipo.id}
            jugadorId={jugadorId}
            onEnviarMensaje={(msg) => onEnviarMensaje(msg, equipo.id)}
            esPrivado={true}
          />
        )}
        <Chat
          mensajes={mensajes}
          equipoId={null}
          jugadorId={jugadorId}
          onEnviarMensaje={(msg) => onEnviarMensaje(msg, null)}
          esPrivado={false}
        />
      </div>
    </div>
  );
}

function Resultados({ sala, onVolver }: {
  sala: Sala;
  onVolver: () => void;
}) {
  const equiposOrdenados = [...sala.estado.equipos].sort((a, b) => b.puntos - a.puntos);

  return (
    <div style={styles.container}>
      <div style={styles.title}>🎉 Resultados Finales</div>

      <div style={styles.podio}>
        {equiposOrdenados.length >= 2 && (
          <div style={styles.podioSegundo}>
            <div style={styles.podioMedalla}>🥈</div>
            <div style={styles.podioNombre}>{equiposOrdenados[1].nombre}</div>
            <div style={styles.podioPuntos}>{equiposOrdenados[1].puntos} pts</div>
          </div>
        )}
        {equiposOrdenados.length >= 1 && (
          <div style={styles.podioPrimero}>
            <div style={styles.podioMedalla}>🥇</div>
            <div style={styles.podioNombre}>{equiposOrdenados[0].nombre}</div>
            <div style={styles.podioPuntos}>{equiposOrdenados[0].puntos} pts</div>
          </div>
        )}
        {equiposOrdenados.length >= 3 && (
          <div style={styles.podioTercero}>
            <div style={styles.podioMedalla}>🥉</div>
            <div style={styles.podioNombre}>{equiposOrdenados[2].nombre}</div>
            <div style={styles.podioPuntos}>{equiposOrdenados[2].puntos} pts</div>
          </div>
        )}
      </div>

      <div style={styles.ranking}>
        <div style={styles.rankingTitulo}>Ranking Completo</div>
        {equiposOrdenados.map((equipo, idx) => (
          <div key={equipo.id} style={styles.rankingItem}>
            <div style={styles.rankingPosicion}>#{idx + 1}</div>
            <div style={{ ...styles.rankingColor, backgroundColor: equipo.color }}></div>
            <div style={styles.rankingNombre}>{equipo.nombre}</div>
            <div style={styles.rankingPuntos}>{equipo.puntos} pts</div>
          </div>
        ))}
      </div>

      <button onClick={onVolver} style={{ ...styles.button, ...styles.buttonPrimary }}>
        Volver al Menú
      </button>
    </div>
  );
}

// ─── Componente Principal ──────────────────────────────────────────────────
export default function TrivialView() {
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [sala, setSala] = useState<Sala | null>(null);
  const [jugadorId, setJugadorId] = useState<string>('');
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const channelRef = useRef<any>(null);
  const mensajesChannelRef = useRef<any>(null);

  // Inicializar Supabase
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).supabase) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      script.onload = () => {
        (window as any).supabase = (window as any).supabase.createClient(SUPA_URL, SUPA_KEY);
      };
      document.head.appendChild(script);
    }
  }, []);

  const crearSala = async () => {
    if (!nombre.trim()) {
      setError('Ingresá tu nombre');
      return;
    }

    try {
      const codigoSala = generarCodigo();
      const nuevoJugadorId = `jugador_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      setJugadorId(nuevoJugadorId);

      const estadoInicial: EstadoSala = {
        estado: 'configuracion',
        config: null,
        equipos: [],
        jugadores: [{
          id: nuevoJugadorId,
          nombre: nombre.trim(),
          equipoId: null,
          esCapitán: false,
          esHost: true,
        }],
        preguntaActual: null,
        preguntaNumero: 0,
        totalPreguntas: 0,
        respuestas: [],
        tiempoInicio: null,
        respuestaRevelada: false,
        categoriaActual: null,
      };

      const response = await fetch(`${SUPA_URL}/rest/v1/trivial_salas`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          codigo: codigoSala,
          estado: estadoInicial,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al crear sala');
      }

      const data = await response.json();
      const nuevaSala: Sala = {
        id: data[0].id,
        codigo: codigoSala,
        estado: estadoInicial,
      };

      setSala(nuevaSala);
      setError('');
      suscribirCambios(nuevaSala.id);
      suscribirMensajes(nuevaSala.id);
    } catch (err: any) {
      setError(err.message || 'Error al crear sala');
    }
  };

  const unirseSala = async () => {
    if (!nombre.trim() || !codigo.trim()) {
      setError('Completá nombre y código');
      return;
    }

    try {
      const response = await fetch(`${SUPA_URL}/rest/v1/trivial_salas?codigo=eq.${codigo.toUpperCase()}`, {
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
      const estadoActual: EstadoSala = salaExistente.estado;

      if (estadoActual.estado === 'jugando' || estadoActual.estado === 'resultados') {
        setError('La partida ya comenzó');
        return;
      }

      const nuevoJugadorId = `jugador_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      setJugadorId(nuevoJugadorId);

      estadoActual.jugadores.push({
        id: nuevoJugadorId,
        nombre: nombre.trim(),
        equipoId: null,
        esCapitán: false,
        esHost: false,
      });

      const salaActualizada: Sala = {
        id: salaExistente.id,
        codigo: salaExistente.codigo,
        estado: estadoActual,
      };

      await fetch(`${SUPA_URL}/rest/v1/trivial_salas?id=eq.${salaExistente.id}`, {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify({ estado: estadoActual }),
      });

      setSala(salaActualizada);
      setError('');
      suscribirCambios(salaExistente.id);
      suscribirMensajes(salaExistente.id);
    } catch (err: any) {
      setError(err.message || 'Error al unirse');
    }
  };

  const configurarSala = async (config: ConfigSala) => {
    if (!sala) return;

    const estadoActualizado = {
      ...sala.estado,
      config,
      estado: 'esperando' as const,
    };

    await actualizarEstado(estadoActualizado);
  };

  const crearEquipo = async (nombreEquipo: string) => {
    if (!sala) return;

    const nuevoEquipo: Equipo = {
      id: generarIdEquipo(),
      nombre: nombreEquipo,
      jugadores: [],
      puntos: 0,
      color: COLORES_EQUIPOS[sala.estado.equipos.length % COLORES_EQUIPOS.length],
    };

    const estadoActualizado = {
      ...sala.estado,
      equipos: [...sala.estado.equipos, nuevoEquipo],
    };

    await actualizarEstado(estadoActualizado);
  };

  const unirseEquipo = async (equipoId: string) => {
    if (!sala || !jugadorId) return;

    const equipo = sala.estado.equipos.find(e => e.id === equipoId);
    if (!equipo) return;

    const jugador = sala.estado.jugadores.find(j => j.id === jugadorId);
    if (!jugador || jugador.equipoId) return;

    const esPrimerJugador = equipo.jugadores.length === 0;

    const jugadoresActualizados = sala.estado.jugadores.map(j => {
      if (j.id === jugadorId) {
        return {
          ...j,
          equipoId,
          esCapitán: esPrimerJugador,
        };
      }
      return j;
    });

    const equiposActualizados = sala.estado.equipos.map(eq => {
      if (eq.id === equipoId) {
        return {
          ...eq,
          jugadores: [...eq.jugadores, jugadorId],
        };
      }
      return eq;
    });

    const estadoActualizado = {
      ...sala.estado,
      jugadores: jugadoresActualizados,
      equipos: equiposActualizados,
    };

    await actualizarEstado(estadoActualizado);
  };

  const iniciarPartida = async () => {
    if (!sala || !sala.estado.config) return;

    const totalPreguntas = sala.estado.config.categorias.length * sala.estado.config.preguntasPorCategoria;
    const primeraCategoria = sala.estado.config.categorias[0];

    try {
      const pregunta = await obtenerPregunta(
        primeraCategoria,
        sala.estado.config.publico,
        sala.estado.config.dificultad
      );

      const estadoActualizado: EstadoSala = {
        ...sala.estado,
        estado: 'jugando',
        preguntaActual: pregunta,
        preguntaNumero: 1,
        totalPreguntas,
        tiempoInicio: Date.now(),
        categoriaActual: primeraCategoria,
      };

      await actualizarEstado(estadoActualizado);
    } catch (err: any) {
      setError(`Error al iniciar: ${err.message}`);
    }
  };

  const responderPregunta = async (respuesta: string) => {
    if (!sala || !jugadorId) return;

    const jugador = sala.estado.jugadores.find(j => j.id === jugadorId);
    if (!jugador?.equipoId || !jugador.esCapitán) return;

    const equipo = sala.estado.equipos.find(e => e.id === jugador.equipoId);
    if (!equipo) return;

    const yaRespondio = sala.estado.respuestas.some(r => r.equipoId === equipo.id);
    if (yaRespondio) return;

    const tiempoTranscurrido = sala.estado.tiempoInicio
      ? Math.floor((Date.now() - sala.estado.tiempoInicio) / 1000)
      : 0;
    const tiempoRestante = Math.max(0, sala.estado.config!.tiempoRespuesta - tiempoTranscurrido);

    const esCorrecta = respuesta === sala.estado.preguntaActual?.respuesta_correcta;
    const puntos = calcularPuntos(
      esCorrecta,
      tiempoRestante,
      sala.estado.config!.tiempoRespuesta,
      sala.estado.config!.modoPuntuacion,
      sala.estado.config!.penalizacion
    );

    const nuevaRespuesta: RespuestaEquipo = {
      equipoId: equipo.id,
      respuesta,
      tiempoRestante,
      puntos,
    };

    const equiposActualizados = sala.estado.equipos.map(eq => {
      if (eq.id === equipo.id) {
        return { ...eq, puntos: eq.puntos + puntos };
      }
      return eq;
    });

    const estadoActualizado = {
      ...sala.estado,
      respuestas: [...sala.estado.respuestas, nuevaRespuesta],
      equipos: equiposActualizados,
    };

    await actualizarEstado(estadoActualizado);

    // Si todos respondieron, revelar respuesta
    if (estadoActualizado.respuestas.length === estadoActualizado.equipos.length) {
      setTimeout(() => {
        revelarRespuesta();
      }, 1000);
    }
  };

  const revelarRespuesta = async () => {
    if (!sala) return;

    const estadoActualizado = {
      ...sala.estado,
      respuestaRevelada: true,
    };

    await actualizarEstado(estadoActualizado);

    // Después de 5 segundos, siguiente pregunta
    setTimeout(() => {
      siguientePregunta();
    }, 5000);
  };

  const siguientePregunta = async () => {
    if (!sala || !sala.estado.config) return;

    const preguntaNumero = sala.estado.preguntaNumero + 1;

    if (preguntaNumero > sala.estado.totalPreguntas) {
      // Terminar partida
      const estadoActualizado: EstadoSala = {
        ...sala.estado,
        estado: 'resultados',
      };
      await actualizarEstado(estadoActualizado);
      return;
    }

    // Calcular categoría actual
    const preguntasPorCategoria = sala.estado.config.preguntasPorCategoria;
    const categoriaIndex = Math.floor((preguntaNumero - 1) / preguntasPorCategoria);
    const categoria = sala.estado.config.categorias[categoriaIndex];

    try {
      const pregunta = await obtenerPregunta(
        categoria,
        sala.estado.config.publico,
        sala.estado.config.dificultad
      );

      const estadoActualizado: EstadoSala = {
        ...sala.estado,
        preguntaActual: pregunta,
        preguntaNumero,
        respuestas: [],
        tiempoInicio: Date.now(),
        respuestaRevelada: false,
        categoriaActual: categoria,
      };

      await actualizarEstado(estadoActualizado);
    } catch (err: any) {
      setError(`Error al cargar pregunta: ${err.message}`);
    }
  };

  const enviarMensaje = async (mensaje: string, equipoId: string | null) => {
    if (!sala || !jugadorId) return;

    const jugador = sala.estado.jugadores.find(j => j.id === jugadorId);
    if (!jugador) return;

    try {
      await fetch(`${SUPA_URL}/rest/v1/trivial_mensajes`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          sala_id: sala.id,
          equipo_id: equipoId,
          jugador: jugador.nombre,
          mensaje,
        }),
      });
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
    }
  };

  const actualizarEstado = async (nuevoEstado: EstadoSala) => {
    if (!sala) return;

    try {
      await fetch(`${SUPA_URL}/rest/v1/trivial_salas?id=eq.${sala.id}`, {
        method: 'PATCH',
        headers: HEADERS,
        body: JSON.stringify({ estado: nuevoEstado }),
      });
    } catch (err) {
      console.error('Error al actualizar estado:', err);
    }
  };

  const suscribirCambios = (salaId: string) => {
    if (typeof window === 'undefined' || !(window as any).supabase) {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`${SUPA_URL}/rest/v1/trivial_salas?id=eq.${salaId}`, {
            headers: HEADERS,
          });
          if (response.ok) {
            const data = await response.json();
            if (data.length > 0) {
              setSala({
                id: data[0].id,
                codigo: data[0].codigo,
                estado: data[0].estado,
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
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }

      const channel = supabase.channel(`trivial_${salaId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'trivial_salas',
          filter: `id=eq.${salaId}`,
        }, (payload: any) => {
          if (payload.new) {
            setSala({
              id: payload.new.id,
              codigo: payload.new.codigo,
              estado: payload.new.estado,
            });
          }
        })
        .subscribe();

      channelRef.current = channel;
    } catch (err) {
      console.error('Error al suscribirse:', err);
    }
  };

  const suscribirMensajes = (salaId: string) => {
    // Cargar mensajes existentes
    fetch(`${SUPA_URL}/rest/v1/trivial_mensajes?sala_id=eq.${salaId}&order=created_at.asc`, {
      headers: HEADERS,
    })
      .then(res => res.json())
      .then(data => {
        setMensajes(data);
      })
      .catch(err => console.error('Error al cargar mensajes:', err));

    if (typeof window === 'undefined' || !(window as any).supabase) {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`${SUPA_URL}/rest/v1/trivial_mensajes?sala_id=eq.${salaId}&order=created_at.asc`, {
            headers: HEADERS,
          });
          if (response.ok) {
            const data = await response.json();
            setMensajes(data);
          }
        } catch (err) {
          console.error('Error en polling mensajes:', err);
        }
      }, 2000);

      return () => clearInterval(interval);
    }

    try {
      const supabase = (window as any).supabase;
      if (mensajesChannelRef.current) {
        mensajesChannelRef.current.unsubscribe();
      }

      const channel = supabase.channel(`trivial_mensajes_${salaId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'trivial_mensajes',
          filter: `sala_id=eq.${salaId}`,
        }, (payload: any) => {
          if (payload.new) {
            setMensajes(prev => {
              if (!prev.find(m => m.id === payload.new.id)) {
                return [...prev, payload.new];
              }
              return prev;
            });
          }
        })
        .subscribe();

      mensajesChannelRef.current = channel;
    } catch (err) {
      console.error('Error al suscribirse a mensajes:', err);
    }
  };

  const salir = () => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }
    if (mensajesChannelRef.current) {
      mensajesChannelRef.current.unsubscribe();
    }
    setSala(null);
    setJugadorId('');
    setMensajes([]);
    setError('');
  };

  // Auto-revelar respuesta si se agota el tiempo
  useEffect(() => {
    if (!sala || sala.estado.estado !== 'jugando' || !sala.estado.tiempoInicio || sala.estado.respuestaRevelada) return;

    const tiempoTotal = sala.estado.config?.tiempoRespuesta || 30;
    const tiempoTranscurrido = Math.floor((Date.now() - sala.estado.tiempoInicio) / 1000);
    const tiempoRestante = Math.max(0, tiempoTotal - tiempoTranscurrido);

    if (tiempoRestante <= 0) {
      // Ya se agotó el tiempo
      if (!sala.estado.respuestaRevelada) {
        revelarRespuesta();
      }
      return;
    }

    const timeout = setTimeout(() => {
      // Verificar nuevamente antes de revelar
      if (sala && !sala.estado.respuestaRevelada) {
        revelarRespuesta();
      }
    }, tiempoRestante * 1000);

    return () => clearTimeout(timeout);
  }, [sala?.estado.tiempoInicio, sala?.estado.respuestaRevelada, sala?.estado.estado]);

  if (!sala) {
    return (
      <Lobby
        onCreateSala={crearSala}
        onUnirseSala={unirseSala}
      />
    );
  }

  if (sala.estado.estado === 'configuracion') {
    const jugador = sala.estado.jugadores.find(j => j.id === jugadorId);
    if (jugador?.esHost) {
      return (
        <Configuracion
          sala={sala}
          jugadorId={jugadorId}
          onConfigurar={configurarSala}
          onCancelar={salir}
        />
      );
    }
    return (
      <div style={styles.container}>
        <div style={styles.title}>Esperando configuración...</div>
      </div>
    );
  }

  if (sala.estado.estado === 'esperando') {
    const jugador = sala.estado.jugadores.find(j => j.id === jugadorId);
    if (!jugador?.equipoId) {
      return (
        <SeleccionEquipo
          sala={sala}
          jugadorId={jugadorId}
          onUnirseEquipo={unirseEquipo}
          onCreateEquipo={crearEquipo}
        />
      );
    }

    const esHost = jugador.esHost;
    return (
      <SalaEspera
        sala={sala}
        jugadorId={jugadorId}
        onIniciar={esHost ? iniciarPartida : undefined}
        onSalir={salir}
      />
    );
  }

  if (sala.estado.estado === 'jugando') {
    return (
      <Juego
        sala={sala}
        jugadorId={jugadorId}
        onResponder={responderPregunta}
        mensajes={mensajes}
        onEnviarMensaje={enviarMensaje}
      />
    );
  }

  if (sala.estado.estado === 'resultados') {
    return (
      <Resultados
        sala={sala}
        onVolver={salir}
      />
    );
  }

  return null;
}

// ─── Estilos ───────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '20px',
    fontFamily: "'Courier New', monospace",
    color: '#fff',
    overflowY: 'auto',
  },
  title: {
    fontSize: 32,
    fontWeight: 900,
    color: '#FF6B35',
    textAlign: 'center',
    marginBottom: 8,
    textShadow: '0 0 20px #FF6B3560',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  input: {
    width: '100%',
    maxWidth: 300,
    padding: '12px 16px',
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    fontFamily: "'Courier New', monospace",
  },
  button: {
    width: '100%',
    maxWidth: 300,
    padding: '14px 24px',
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: "'Courier New', monospace",
    marginBottom: 12,
  },
  buttonPrimary: {
    background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)',
    border: 'none',
    boxShadow: '0 4px 15px #FF6B3540',
  },
  divider: {
    textAlign: 'center',
    color: '#666',
    margin: '16px 0',
    fontSize: 12,
  },
  error: {
    color: '#F44336',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  info: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  configSection: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 24,
  },
  configLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  configOptions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  configButton: {
    flex: 1,
    minWidth: 100,
    padding: '10px 16px',
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 6,
    color: '#fff',
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  configButtonActive: {
    background: '#FF6B35',
    borderColor: '#FF6B35',
  },
  categoriasGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 8,
  },
  categoriaButton: {
    padding: '12px 16px',
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 6,
    color: '#fff',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center',
  },
  categoriaButtonActive: {
    background: '#4ECDC4',
    borderColor: '#4ECDC4',
    color: '#000',
  },
  configHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    color: '#fff',
    cursor: 'pointer',
  },
  checkbox: {
    width: 18,
    height: 18,
    cursor: 'pointer',
  },
  configActions: {
    display: 'flex',
    gap: 12,
    width: '100%',
    maxWidth: 400,
    marginTop: 24,
  },
  equiposList: {
    width: '100%',
    maxWidth: 400,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 24,
  },
  equipoCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px',
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  equipoColor: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    flexShrink: 0,
  },
  equipoCardContent: {
    flex: 1,
  },
  equipoNombre: {
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
    marginBottom: 4,
  },
  equipoJugadores: {
    fontSize: 12,
    color: '#888',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  },
  equipoNuevo: {
    fontSize: 10,
    color: '#4ECDC4',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  equipoInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '20px',
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 8,
    marginBottom: 24,
  },
  jugadorTag: {
    fontSize: 11,
    color: '#aaa',
    background: '#2a2a2a',
    padding: '4px 8px',
    borderRadius: 4,
  },
  crearEquipo: {
    width: '100%',
    maxWidth: 400,
    marginTop: 16,
  },
  crearEquipoActions: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
  },
  juegoHeader: {
    width: '100%',
    maxWidth: 600,
    textAlign: 'center',
    marginBottom: 16,
  },
  juegoInfo: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  juegoCategoria: {
    fontSize: 18,
    color: '#4ECDC4',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  cronometroContainer: {
    width: '100%',
    maxWidth: 600,
    marginBottom: 24,
  },
  cronometroBar: {
    width: '100%',
    height: 8,
    background: '#1a1a1a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  cronometroFill: {
    height: '100%',
    transition: 'width 0.1s linear, background-color 0.3s',
  },
  cronometroTiempo: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 700,
    color: '#fff',
  },
  preguntaContainer: {
    width: '100%',
    maxWidth: 600,
    marginBottom: 24,
  },
  preguntaTexto: {
    fontSize: 20,
    fontWeight: 600,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 1.5,
    padding: '20px',
    background: '#1a1a1a',
    borderRadius: 12,
    border: '2px solid #333',
  },
  opcionesContainer: {
    width: '100%',
    maxWidth: 600,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 24,
  },
  opcion: {
    width: '100%',
    padding: '16px 20px',
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 16,
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left',
    fontFamily: "'Courier New', monospace",
  },
  opcionSeleccionada: {
    borderColor: '#4ECDC4',
    background: '#1a3a3a',
  },
  opcionCorrecta: {
    borderColor: '#4CAF50',
    background: '#1a3a1a',
    color: '#4CAF50',
  },
  opcionIncorrecta: {
    borderColor: '#F44336',
    background: '#3a1a1a',
    color: '#F44336',
  },
  explicacion: {
    width: '100%',
    maxWidth: 600,
    padding: '16px',
    background: '#1a1a1a',
    border: '2px solid #4ECDC4',
    borderRadius: 8,
    marginBottom: 24,
  },
  explicacionTitulo: {
    fontSize: 14,
    color: '#4ECDC4',
    fontWeight: 600,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  explicacionTexto: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 1.6,
  },
  puntajesContainer: {
    width: '100%',
    maxWidth: 600,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  puntajeCard: {
    flex: 1,
    minWidth: 120,
    padding: '12px',
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    position: 'relative',
  },
  puntajeCardActivo: {
    borderWidth: 3,
    boxShadow: '0 0 15px rgba(255, 107, 53, 0.3)',
  },
  puntajeColor: {
    width: 20,
    height: 20,
    borderRadius: '50%',
  },
  puntajeNombre: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 600,
    textAlign: 'center',
  },
  puntajePuntos: {
    fontSize: 18,
    color: '#FF6B35',
    fontWeight: 700,
  },
  puntajeRespondio: {
    position: 'absolute',
    top: 4,
    right: 4,
    fontSize: 16,
    color: '#4CAF50',
  },
  chatsContainer: {
    position: 'fixed',
    bottom: 20,
    right: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    zIndex: 1000,
  },
  chatToggle: {
    padding: '10px 16px',
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: "'Courier New', monospace",
  },
  chatPanel: {
    width: 280,
    height: 400,
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    bottom: 20,
    right: 20,
    zIndex: 1001,
  },
  chatHeader: {
    padding: '12px',
    borderBottom: '1px solid #333',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 14,
    color: '#fff',
  },
  chatClose: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: 18,
    cursor: 'pointer',
    padding: 0,
    width: 24,
    height: 24,
  },
  chatMensajes: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
  },
  chatMensaje: {
    marginBottom: 12,
  },
  chatMensajeJugador: {
    fontSize: 11,
    color: '#4ECDC4',
    marginBottom: 4,
    fontWeight: 600,
  },
  chatMensajeTexto: {
    fontSize: 13,
    color: '#ccc',
    lineHeight: 1.4,
  },
  chatInput: {
    padding: '12px',
    borderTop: '1px solid #333',
    display: 'flex',
    gap: 8,
  },
  chatInputField: {
    flex: 1,
    padding: '8px 12px',
    background: '#0a0a0a',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#fff',
    fontSize: 13,
    fontFamily: "'Courier New', monospace",
  },
  chatEnviar: {
    padding: '8px 16px',
    background: '#FF6B35',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'Courier New', monospace",
  },
  podio: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 32,
    width: '100%',
    maxWidth: 600,
  },
  podioPrimero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px',
    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
    borderRadius: 16,
    border: '3px solid #FFD700',
    boxShadow: '0 8px 30px rgba(255, 215, 0, 0.4)',
    minWidth: 140,
  },
  podioSegundo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    background: 'linear-gradient(135deg, #C0C0C0 0%, #808080 100%)',
    borderRadius: 12,
    border: '2px solid #C0C0C0',
    minWidth: 120,
  },
  podioTercero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    background: 'linear-gradient(135deg, #CD7F32 0%, #8B4513 100%)',
    borderRadius: 12,
    border: '2px solid #CD7F32',
    minWidth: 120,
  },
  podioMedalla: {
    fontSize: 48,
    marginBottom: 8,
  },
  podioNombre: {
    fontSize: 18,
    fontWeight: 700,
    color: '#000',
    marginBottom: 4,
    textAlign: 'center',
  },
  podioPuntos: {
    fontSize: 24,
    fontWeight: 900,
    color: '#000',
  },
  ranking: {
    width: '100%',
    maxWidth: 600,
    marginBottom: 24,
  },
  rankingTitulo: {
    fontSize: 20,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  rankingItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px',
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 8,
    marginBottom: 8,
  },
  rankingPosicion: {
    fontSize: 18,
    fontWeight: 700,
    color: '#888',
    minWidth: 40,
  },
  rankingColor: {
    width: 20,
    height: 20,
    borderRadius: '50%',
  },
  rankingNombre: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    fontWeight: 600,
  },
  rankingPuntos: {
    fontSize: 18,
    color: '#FF6B35',
    fontWeight: 700,
  },
};
