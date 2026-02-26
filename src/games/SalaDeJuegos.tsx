/**
 * SalaDeJuegos.tsx — Vista inmersiva de sala de juegos lujosa
 * Diseño basado en sala de entretenimiento con mesas interactivas
 */
import React from 'react';
import { useAuth } from '../auth/AuthContext';

interface SalaDeJuegosProps {
  onSeleccionarJuego: (juego: string) => void;
}

export function SalaDeJuegos({ onSeleccionarJuego }: SalaDeJuegosProps) {
  const { usuario } = useAuth();

  return (
    <div style={styles.container}>
      {/* Iluminación ambiental */}
      <div style={styles.neonLights}>
        <div style={styles.neonTop} />
        <div style={styles.neonBar} />
      </div>

      {/* Barra lateral derecha */}
      <div style={styles.barArea}>
        <div style={styles.barCounter}>
          <div style={styles.barGlow} />
          <div style={styles.barStools}>
            <div style={styles.stool} />
            <div style={styles.stool} />
            <div style={styles.stool} />
          </div>
        </div>
      </div>

      {/* TV lateral izquierda */}
      <div style={styles.tvArea}>
        <div style={styles.tvScreen} />
        <div style={styles.tvConsole} />
      </div>

      {/* Título flotante */}
      <div style={styles.header}>
        <h1 style={styles.title}>🎮 SALA DE JUEGOS</h1>
        <div style={styles.subtitle}>Bienvenido, {usuario?.nombre || 'Jugador'}</div>
      </div>

      {/* Mesas principales - Fondo */}
      <div style={styles.mesasFondo}>
        {/* Mesa Grande Central - Juegos de Mesa */}
        <div 
          style={styles.mesaGrandeCentral}
          className="mesa-hover"
          onClick={() => onSeleccionarJuego('menu-grande')}
        >
          <div style={styles.mesaGrandeTop}>
            <div style={styles.gameBoxes}>
              <div style={styles.gameBox}>🎲</div>
              <div style={styles.gameBox}>🎴</div>
              <div style={styles.gameBox}>❓</div>
            </div>
          </div>
          <div style={styles.mesaLabel}>JUEGOS DE MESA</div>
        </div>

        {/* Mesa Ping Pong */}
        <div 
          style={styles.pingPongTable}
          className="mesa-hover"
          onClick={() => onSeleccionarJuego('pong')}
        >
          <div style={styles.pingPongNet} />
          <div style={styles.pingPongLines} />
          <div style={styles.mesaLabel}>PING PONG</div>
        </div>
      </div>

      {/* Mesas principales - Frente */}
      <div style={styles.mesasFrente}>
        {/* Ruleta - Frente Izquierdo */}
        <div 
          style={styles.ruletaContainer}
          className="mesa-hover"
          onClick={() => onSeleccionarJuego('ruleta')}
        >
          <div style={styles.ruletaTable}>
            <div style={styles.ruletaWheel}>
              <div style={styles.ruletaNumbers}>
                {[0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27].map((num, i) => (
                  <div 
                    key={i} 
                    style={{
                      ...styles.ruletaNumber,
                      transform: `rotate(${i * 30}deg) translateY(-60px)`,
                    }}
                  >
                    {num}
                  </div>
                ))}
              </div>
              <div style={styles.ruletaCenter}>🎰</div>
            </div>
            <div style={styles.ruletaFelt} />
          </div>
          <div style={styles.mesaLabel}>RULETA</div>
        </div>

        {/* Mesa Cartas - Frente Derecho */}
        <div 
          style={styles.cartasContainer}
          className="mesa-hover"
          onClick={() => onSeleccionarJuego('poker')}
        >
          <div style={styles.cartasTable}>
            <div style={styles.cartasFelt}>
              <div style={styles.chips}>
                <div style={styles.chip} className="chip-blue" />
                <div style={styles.chip} className="chip-red" />
                <div style={styles.chip} className="chip-green" />
                <div style={styles.chip} className="chip-yellow" />
              </div>
              <div style={styles.cards}>
                <div style={styles.card}>🂡</div>
                <div style={styles.card}>🂮</div>
              </div>
            </div>
          </div>
          <div style={styles.mesaLabel}>POKER / BLACKJACK</div>
        </div>
      </div>

      {/* Instrucciones */}
      <div style={styles.instructions}>
        👆 Toca una mesa para jugar
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '100%',
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 50%, #2a2a2a 100%)',
    overflow: 'hidden',
    fontFamily: "'Courier New', monospace",
  },
  // Iluminación
  neonLights: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 1,
  },
  neonTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    background: 'linear-gradient(90deg, transparent 0%, #FF6B35 20%, #FF6B35 80%, transparent 100%)',
    boxShadow: '0 0 30px #FF6B35, 0 0 60px #FF6B35',
  },
  neonBar: {
    position: 'absolute',
    top: '60%',
    right: 0,
    width: 300,
    height: 8,
    background: 'linear-gradient(180deg, transparent 0%, #FF6B35 20%, #FF6B35 80%, transparent 100%)',
    boxShadow: '0 0 30px #FF6B35, 0 0 60px #FF6B35',
  },
  // Barra
  barArea: {
    position: 'absolute',
    top: '50%',
    right: 0,
    transform: 'translateY(-50%)',
    width: 280,
    height: '60%',
    zIndex: 2,
  },
  barCounter: {
    position: 'relative',
    width: '100%',
    height: 120,
    background: 'linear-gradient(135deg, #2a1a0a 0%, #1a0f05 100%)',
    borderTop: '4px solid #8B4513',
    boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.5)',
  },
  barGlow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    background: '#FF6B35',
    boxShadow: '0 0 20px #FF6B35',
  },
  barStools: {
    position: 'absolute',
    bottom: -40,
    left: 20,
    right: 20,
    display: 'flex',
    gap: 20,
    justifyContent: 'space-around',
  },
  stool: {
    width: 40,
    height: 40,
    background: 'linear-gradient(135deg, #8B4513 0%, #654321 100%)',
    borderRadius: '50% 50% 0 0',
    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.3)',
  },
  // TV
  tvArea: {
    position: 'absolute',
    top: '20%',
    left: 0,
    width: 300,
    height: 200,
    zIndex: 2,
  },
  tvScreen: {
    width: '100%',
    height: 150,
    background: 'linear-gradient(135deg, #000 0%, #1a1a1a 100%)',
    border: '8px solid #333',
    borderRadius: 8,
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), inset 0 0 50px rgba(0, 0, 0, 0.8)',
  },
  tvConsole: {
    width: '80%',
    height: 30,
    margin: '10px auto 0',
    background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)',
    borderRadius: 4,
    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.3)',
  },
  // Header
  header: {
    position: 'absolute',
    top: 30,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 100,
    textAlign: 'center',
  },
  title: {
    fontSize: 'clamp(28px, 5vw, 48px)',
    fontWeight: 900,
    color: '#FF6B35',
    textShadow: '0 0 20px #FF6B35, 0 0 40px #FF6B35',
    letterSpacing: '0.2em',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 'clamp(12px, 2vw, 18px)',
    color: '#4ECDC4',
    textShadow: '0 0 10px #4ECDC4',
    letterSpacing: '0.1em',
  },
  // Mesas Fondo
  mesasFondo: {
    position: 'absolute',
    top: '35%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '90%',
    maxWidth: 1200,
    zIndex: 3,
    display: 'flex',
    flexDirection: 'column',
    gap: 40,
    alignItems: 'center',
  },
  mesaGrandeCentral: {
    position: 'relative',
    width: 500,
    height: 350,
    background: 'linear-gradient(135deg, #2d5016 0%, #1a3009 100%)',
    borderRadius: 20,
    border: '8px solid #8B4513',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 15px 40px rgba(0, 0, 0, 0.6), inset 0 0 30px rgba(0, 0, 0, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mesaGrandeTop: {
    position: 'relative',
    width: '90%',
    height: '80%',
    background: 'radial-gradient(ellipse at center, #2d5016 0%, #1a3009 100%)',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 30,
  },
  gameBoxes: {
    display: 'flex',
    gap: 20,
  },
  gameBox: {
    width: 80,
    height: 80,
    background: 'linear-gradient(135deg, #3a3a3a 0%, #1a1a1a 100%)',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 40,
    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)',
  },
  pingPongTable: {
    position: 'relative',
    width: 400,
    height: 220,
    background: 'linear-gradient(135deg, #1e4d2b 0%, #0d2818 100%)',
    borderRadius: 12,
    border: '6px solid #8B4513',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 15px 40px rgba(0, 0, 0, 0.6)',
  },
  pingPongNet: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    transform: 'translateY(-50%)',
    height: 6,
    background: 'linear-gradient(90deg, transparent 0%, #fff 10%, #fff 90%, transparent 100%)',
    borderTop: '3px solid #333',
    borderBottom: '3px solid #333',
    boxShadow: '0 0 10px rgba(255, 255, 255, 0.5)',
  },
  pingPongLines: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    right: '10%',
    height: 2,
    background: '#fff',
    opacity: 0.3,
  },
  // Mesas Frente
  mesasFrente: {
    position: 'absolute',
    bottom: '15%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '90%',
    maxWidth: 1000,
    zIndex: 4,
    display: 'flex',
    justifyContent: 'space-around',
    gap: 40,
    alignItems: 'flex-end',
  },
  ruletaContainer: {
    position: 'relative',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  ruletaTable: {
    position: 'relative',
    width: 320,
    height: 280,
    background: 'linear-gradient(135deg, #0d5d1a 0%, #0a4a14 100%)',
    borderRadius: '50%',
    border: '10px solid #8B4513',
    boxShadow: '0 15px 40px rgba(0, 0, 0, 0.6), inset 0 0 30px rgba(0, 0, 0, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruletaFelt: {
    position: 'absolute',
    inset: 10,
    background: 'radial-gradient(circle, #0d5d1a 0%, #0a4a14 100%)',
    borderRadius: '50%',
  },
  ruletaWheel: {
    position: 'relative',
    width: 200,
    height: 200,
    background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
    borderRadius: '50%',
    border: '6px solid #FF6B35',
    boxShadow: '0 0 30px #FF6B35, inset 0 0 30px rgba(255, 107, 53, 0.3)',
    zIndex: 2,
  },
  ruletaNumbers: {
    position: 'absolute',
    inset: 0,
  },
  ruletaNumber: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 20,
    height: 20,
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    textAlign: 'center',
    transformOrigin: '0 0',
  },
  ruletaCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: 48,
    filter: 'drop-shadow(0 0 10px #FF6B35)',
  },
  cartasContainer: {
    position: 'relative',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  cartasTable: {
    position: 'relative',
    width: 320,
    height: 240,
    background: 'linear-gradient(135deg, #0d5d1a 0%, #0a4a14 100%)',
    borderRadius: 20,
    border: '8px solid #8B4513',
    boxShadow: '0 15px 40px rgba(0, 0, 0, 0.6), inset 0 0 30px rgba(0, 0, 0, 0.3)',
  },
  cartasFelt: {
    position: 'absolute',
    inset: 8,
    background: 'radial-gradient(ellipse at center, #0d5d1a 0%, #0a4a14 100%)',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  chips: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  chip: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: '2px solid #fff',
    boxShadow: '0 3px 8px rgba(0, 0, 0, 0.4)',
  },
  cards: {
    display: 'flex',
    gap: 10,
  },
  card: {
    width: 40,
    height: 56,
    background: '#fff',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    boxShadow: '0 3px 8px rgba(0, 0, 0, 0.4)',
  },
  mesaLabel: {
    position: 'absolute',
    bottom: -35,
    left: '50%',
    transform: 'translateX(-50%)',
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: 700,
    textShadow: '0 0 10px #FF6B35, 0 0 20px #FF6B35',
    letterSpacing: '0.1em',
    whiteSpace: 'nowrap',
    textAlign: 'center',
  },
  instructions: {
    position: 'absolute',
    bottom: 30,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 100,
    color: '#888',
    fontSize: 18,
    textAlign: 'center',
    fontStyle: 'italic',
    textShadow: '0 0 10px rgba(0, 0, 0, 0.8)',
  },
};

// Agregar estilos CSS para hover y chips
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    .mesa-hover:hover {
      transform: scale(1.05) translateY(-8px) !important;
      box-shadow: 0 20px 50px rgba(255, 107, 53, 0.4) !important;
    }
    .chip-blue { background: linear-gradient(135deg, #4a90e2 0%, #2e5c8a 100%); }
    .chip-red { background: linear-gradient(135deg, #e24a4a 0%, #8a2e2e 100%); }
    .chip-green { background: linear-gradient(135deg, #4ae24a 0%, #2e8a2e 100%); }
    .chip-yellow { background: linear-gradient(135deg, #e2d44a 0%, #8a7e2e 100%); }
  `;
  document.head.appendChild(style);
}
