import { useState } from 'react'
import PongView from './PongView'
import RuletaView from './games/RuletaView'
import RummyView from './games/RummyView'
import BatallaNavalView from './games/BatallaNavalView'
import BlackJackView from './games/BlackJackView'
import PokerView from './games/PokerView'

type Vista = 'menu' | 'pong' | 'ruleta' | 'rummy' | 'batallaNaval' | 'blackjack' | 'poker'

function App() {
  const [vista, setVista] = useState<Vista>('menu')

  if (vista === 'pong') return <PongView />
  if (vista === 'ruleta') return <RuletaView />
  if (vista === 'escoba') return <EscobaView />
  if (vista === 'domino') return <DominoView />
  if (vista === 'batallaNaval') return <BatallaNavalView />
  if (vista === 'rummy') return <RummyView />
  if (vista === 'blackjack') return <BlackJackView />
  if (vista === 'poker') return <PokerView />

  return (
    <div style={menuStyles.container}>
      <div style={menuStyles.title}>🎮 GameHub</div>
      <div style={menuStyles.subtitle}>Elegí un juego</div>
      
      <div style={menuStyles.cardsContainer}>
        <div style={menuStyles.card} onClick={() => setVista('pong')}>
          <div style={menuStyles.cardIcon}>🏓</div>
          <div style={menuStyles.cardTitle}>Ping Pong</div>
          <div style={menuStyles.cardSubtitle}>Multijugador en tiempo real</div>
        </div>

        <div style={menuStyles.card} onClick={() => setVista('ruleta')}>
          <div style={menuStyles.cardIcon}>🎰</div>
          <div style={menuStyles.cardTitle}>Ruleta</div>
          <div style={menuStyles.cardSubtitle}>Casino multijugador</div>
        </div>

        <div style={menuStyles.card} onClick={() => setVista('rummy')}>
          <div style={menuStyles.cardIcon}>🃏</div>
          <div style={menuStyles.cardTitle}>Rummy Canasta</div>
          <div style={menuStyles.cardSubtitle}>4 jugadores en parejas</div>
        </div>

        <div style={menuStyles.card} onClick={() => setVista('batallaNaval')}>
          <div style={menuStyles.cardIcon}>⚓</div>
          <div style={menuStyles.cardTitle}>Batalla Naval</div>
          <div style={menuStyles.cardSubtitle}>Estrategia multijugador</div>
        </div>

        <div style={menuStyles.card} onClick={() => setVista('blackjack')}>
          <div style={menuStyles.cardIcon}>🃏</div>
          <div style={menuStyles.cardTitle}>Blackjack</div>
          <div style={menuStyles.cardSubtitle}>1-4 jugadores, host es banca</div>
        </div>

        <div style={menuStyles.card} onClick={() => setVista('poker')}>
          <div style={menuStyles.cardIcon}>🂮</div>
          <div style={menuStyles.cardTitle}>Poker</div>
          <div style={menuStyles.cardSubtitle}>Texas Hold'em 2-4 jugadores</div>
        </div>
      </div>
    </div>
  )
}

const menuStyles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    minHeight: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: "'Courier New', monospace",
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
    marginBottom: 40,
  },
  cardsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 24,
    width: '100%',
    maxWidth: 600,
  },
  card: {
    background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)',
    border: '2px solid #333',
    borderRadius: 16,
    padding: '32px 24px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  cardIcon: {
    fontSize: 64,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#888',
    letterSpacing: 1,
  },
}

export default App
