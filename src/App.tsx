import React, { useState } from 'react';
import { useAuth } from './auth/AuthContext';
import { LoginView } from './auth/LoginView';
import { PongView } from './games/PongView';
import { RuletaView } from './games/RuletaView';
import { DominoView } from './games/DominoView';
import { EscobaView } from './games/EscobaView';
import GeneralaView from './games/GeneralaView';

type Game = 'menu' | 'pong' | 'ruleta' | 'domino' | 'escoba' | 'generala';

function App() {
  const { logueado, cargando } = useAuth();
  const [currentGame, setCurrentGame] = useState<Game>('menu');

  // Mostrar loading mientras se verifica la sesión
  if (cargando) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingText}>Cargando...</div>
      </div>
    );
  }

  // Mostrar LoginView si no está autenticado
  if (!logueado) {
    return <LoginView />;
  }

  // Renderizar juegos
  if (currentGame === 'pong') {
    return <PongView onBack={() => setCurrentGame('menu')} />;
  }

  if (currentGame === 'ruleta') {
    return <RuletaView onBack={() => setCurrentGame('menu')} />;
  }

  if (currentGame === 'domino') {
    return <DominoView />;
  }

  if (currentGame === 'escoba') {
    return <EscobaView />;
  }

  if (currentGame === 'generala') {
    return <GeneralaView />;
  }

  // Menú principal
  return (
    <div style={styles.container}>
      {/* Efectos de fondo con luces de neón */}
      <div style={styles.backgroundEffects}>
        <div style={styles.neonGlow1} />
        <div style={styles.neonGlow2} />
        <div style={styles.neonGlow3} />
      </div>

      {/* Título principal */}
      <div style={styles.titleContainer}>
        <h1 style={styles.mainTitle}>GAMEHUB</h1>
        <div style={styles.subtitle}>ARCADE MULTIPLAYER</div>
      </div>

      {/* Grilla de juegos */}
      <div style={styles.gamesGrid}>
        {/* Card Ping Pong */}
        <div style={styles.gameCard}>
          <div style={styles.gameIcon}>🏓</div>
          <div style={styles.gameName}>PING PONG</div>
          <div style={styles.gameDescription}>Multijugador en tiempo real</div>
          <button
            style={styles.playButton}
            onClick={() => setCurrentGame('pong')}
          >
            JUGAR
          </button>
        </div>

        {/* Card Ruleta */}
        <div style={styles.gameCard}>
          <div style={styles.gameIcon}>🎰</div>
          <div style={styles.gameName}>RULETA</div>
          <div style={styles.gameDescription}>Casino multijugador</div>
          <button
            style={styles.playButton}
            onClick={() => setCurrentGame('ruleta')}
          >
            JUGAR
          </button>
        </div>

        {/* Card Dominó */}
        <div style={styles.gameCard}>
          <div style={styles.gameIcon}>🎴</div>
          <div style={styles.gameName}>DOMINÓ</div>
          <div style={styles.gameDescription}>Clásico en parejas</div>
          <button
            style={styles.playButton}
            onClick={() => setCurrentGame('domino')}
          >
            JUGAR
          </button>
        </div>

        {/* Card Escoba */}
        <div style={styles.gameCard}>
          <div style={styles.gameIcon}>🃏</div>
          <div style={styles.gameName}>ESCOBA DEL 15</div>
          <div style={styles.gameDescription}>Juego de cartas multijugador</div>
          <button
            style={styles.playButton}
            onClick={() => setCurrentGame('escoba')}
          >
            JUGAR
          </button>
        </div>

        {/* Card Generala */}
        <div style={styles.gameCard}>
          <div style={styles.gameIcon}>🎲</div>
          <div style={styles.gameName}>GENERALA</div>
          <div style={styles.gameDescription}>Uruguaya 2-6 jugadores</div>
          <button
            style={styles.playButton}
            onClick={() => setCurrentGame('generala')}
          >
            JUGAR
          </button>
        </div>
      </div>

      {/* Efectos de partículas flotantes */}
      <div style={styles.particles}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} style={getParticleStyle(i)} />
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loadingContainer: {
    width: '100%',
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Courier New', monospace",
  },
  loadingText: {
    color: '#FF6B35',
    fontSize: 24,
    textShadow: '0 0 20px #FF6B35',
  },
  container: {
    position: 'relative',
    width: '100%',
    minHeight: '100vh',
    background: '#000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    overflow: 'hidden',
  },
  backgroundEffects: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  neonGlow1: {
    position: 'absolute',
    top: '10%',
    left: '10%',
    width: '300px',
    height: '300px',
    background: 'radial-gradient(circle, rgba(255, 107, 53, 0.3) 0%, transparent 70%)',
    borderRadius: '50%',
    filter: 'blur(40px)',
    animation: 'pulse 3s ease-in-out infinite',
  },
  neonGlow2: {
    position: 'absolute',
    top: '50%',
    right: '15%',
    width: '250px',
    height: '250px',
    background: 'radial-gradient(circle, rgba(78, 205, 196, 0.3) 0%, transparent 70%)',
    borderRadius: '50%',
    filter: 'blur(40px)',
    animation: 'pulse 4s ease-in-out infinite',
  },
  neonGlow3: {
    position: 'absolute',
    bottom: '15%',
    left: '50%',
    width: '200px',
    height: '200px',
    background: 'radial-gradient(circle, rgba(255, 107, 53, 0.2) 0%, transparent 70%)',
    borderRadius: '50%',
    filter: 'blur(40px)',
    animation: 'pulse 5s ease-in-out infinite',
  },
  titleContainer: {
    textAlign: 'center',
    marginBottom: '60px',
    zIndex: 10,
  },
  mainTitle: {
    fontSize: 'clamp(48px, 10vw, 96px)',
    fontWeight: 900,
    color: '#fff',
    textShadow: `
      0 0 10px #FF6B35,
      0 0 20px #FF6B35,
      0 0 30px #FF6B35,
      0 0 40px #FF6B35,
      0 0 70px #FF6B35
    `,
    letterSpacing: '0.2em',
    marginBottom: '10px',
    fontFamily: "'Courier New', monospace",
    animation: 'glow 2s ease-in-out infinite alternate',
  },
  subtitle: {
    fontSize: 'clamp(12px, 2vw, 18px)',
    color: '#4ECDC4',
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    textShadow: '0 0 10px #4ECDC4',
    fontWeight: 600,
  },
  gamesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 320px))',
    gap: '40px',
    maxWidth: '1200px',
    width: '100%',
    zIndex: 10,
  },
  gameCard: {
    background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)',
    border: '2px solid #333',
    borderRadius: '20px',
    padding: '40px 30px',
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
    transition: 'all 0.3s ease',
    boxShadow: '0 0 20px rgba(0, 0, 0, 0.5)',
  },
  gameIcon: {
    fontSize: '64px',
    marginBottom: '20px',
    filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.3))',
  },
  gameName: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '0.1em',
    marginBottom: '10px',
    textShadow: '0 0 10px rgba(255, 255, 255, 0.5)',
  },
  gameDescription: {
    fontSize: '14px',
    color: '#888',
    marginBottom: '30px',
    letterSpacing: '0.05em',
  },
  playButton: {
    width: '100%',
    padding: '16px 24px',
    background: 'linear-gradient(135deg, #FF6B35 0%, #FF8C42 100%)',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    cursor: 'pointer',
    textTransform: 'uppercase',
    boxShadow: '0 0 20px rgba(255, 107, 53, 0.4)',
    transition: 'all 0.3s ease',
    fontFamily: "'Courier New', monospace",
  },
  particles: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 1,
  },
};

// Función helper para generar estilos de partícula
const getParticleStyle = (index: number): React.CSSProperties => ({
  position: 'absolute',
  width: '4px',
  height: '4px',
  background: '#4ECDC4',
  borderRadius: '50%',
  left: `${(index * 5) % 100}%`,
  top: `${(index * 7) % 100}%`,
  boxShadow: '0 0 6px #4ECDC4',
  animation: `float ${3 + (index % 3)}s ease-in-out infinite`,
  animationDelay: `${index * 0.2}s`,
});

// Agregar estilos de animación al documento
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes glow {
      from {
        text-shadow: 
          0 0 10px #FF6B35,
          0 0 20px #FF6B35,
          0 0 30px #FF6B35,
          0 0 40px #FF6B35,
          0 0 70px #FF6B35;
      }
      to {
        text-shadow: 
          0 0 20px #FF6B35,
          0 0 30px #FF6B35,
          0 0 40px #FF6B35,
          0 0 50px #FF6B35,
          0 0 80px #FF6B35,
          0 0 100px #FF6B35;
      }
    }
    @keyframes pulse {
      0%, 100% {
        opacity: 0.3;
        transform: scale(1);
      }
      50% {
        opacity: 0.6;
        transform: scale(1.1);
      }
    }
    @keyframes float {
      0%, 100% {
        transform: translateY(0) translateX(0);
        opacity: 0.3;
      }
      50% {
        transform: translateY(-20px) translateX(10px);
        opacity: 0.8;
      }
    }
    .gameCard:hover {
      transform: translateY(-5px);
      border-color: #FF6B35;
      box-shadow: 0 0 30px rgba(255, 107, 53, 0.6);
    }
    .playButton:hover {
      transform: scale(1.05);
      box-shadow: 0 0 30px rgba(255, 107, 53, 0.6);
    }
    .playButton:active {
      transform: scale(0.98);
    }
  `;
  document.head.appendChild(style);
}

export default App;
