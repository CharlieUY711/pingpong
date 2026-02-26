/**
 * LoginView.tsx — Pantalla de login
 * Google OAuth, Email/Password
 */
import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { RegisterView } from './RegisterView';

export function LoginView() {
  const { loginGoogle, loginEmail, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarEmail, setMostrarEmail] = useState(false);
  const [mostrarRegistro, setMostrarRegistro] = useState(false);
  const [cargando, setCargando] = useState(false);

  if (mostrarRegistro) {
    return <RegisterView onVolver={() => setMostrarRegistro(false)} />;
  }

  const handleGoogleLogin = async () => {
    setCargando(true);
    try {
      await loginGoogle();
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) return;
    setCargando(true);
    try {
      await loginEmail(email, password);
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.logoContainer}>
        <div style={styles.logo}>🎮 GameHub</div>
        <div style={styles.nectarContainer}>
          <img src="/nectar.png" alt="Nectar" style={styles.nectarImage} />
        </div>
      </div>
      <div style={styles.subtitle}>Iniciar sesión</div>

      {error && <div style={styles.error}>{error}</div>}

      {!mostrarEmail && (
        <>
          <button
            style={styles.buttonGoogle}
            onClick={handleGoogleLogin}
            disabled={cargando}
          >
            {cargando ? (
              <span>⏳ Cargando...</span>
            ) : (
              <>
                <span style={styles.googleIcon}>🔵</span>
                <span>Entrar con Google</span>
              </>
            )}
          </button>

          <div style={styles.separator}>
            <div style={styles.separatorLine}></div>
            <span style={styles.separatorText}>o</span>
            <div style={styles.separatorLine}></div>
          </div>

          <button
            style={styles.buttonSecondary}
            onClick={() => setMostrarEmail(true)}
            disabled={cargando}
          >
            Iniciar sesión con email
          </button>

          <button
            style={styles.linkButton}
            onClick={() => setMostrarRegistro(true)}
            disabled={cargando}
          >
            Registrarse con email
          </button>
        </>
      )}

      {mostrarEmail && (
        <>
          <div style={styles.inputGroup}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              disabled={cargando}
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              disabled={cargando}
            />
            <button
              style={styles.buttonPrimary}
              onClick={handleEmailLogin}
              disabled={cargando || !email || !password}
            >
              Iniciar sesión
            </button>
          </div>
          <button
            style={styles.linkButton}
            onClick={() => {
              setMostrarEmail(false);
              setEmail('');
              setPassword('');
            }}
          >
            Volver
          </button>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
  logoContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  logo: {
    fontSize: 48,
    fontWeight: 900,
    color: '#FF6B35',
    textAlign: 'center',
    letterSpacing: 8,
    textShadow: '0 0 40px #FF6B3560',
  },
  nectarContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nectarImage: {
    width: 64,
    height: 64,
    objectFit: 'contain',
  },
  subtitle: {
    fontSize: 18,
    color: '#888',
    textAlign: 'center',
    marginBottom: 40,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  error: {
    background: '#ff4444',
    color: '#fff',
    padding: '12px 20px',
    borderRadius: 8,
    marginBottom: 20,
    fontSize: 14,
    maxWidth: 400,
    textAlign: 'center',
  },
  buttonGoogle: {
    width: '100%',
    maxWidth: 400,
    height: 56,
    background: '#fff',
    color: '#333',
    border: 'none',
    borderRadius: 12,
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
    transition: 'all 0.3s ease',
  },
  googleIcon: {
    fontSize: 24,
  },
  separator: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    marginBottom: 24,
    gap: 16,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    background: '#333',
  },
  separatorText: {
    color: '#888',
    fontSize: 14,
    textTransform: 'uppercase',
  },
  inputGroup: {
    width: '100%',
    maxWidth: 400,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 56,
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: 12,
    padding: '0 20px',
    fontSize: 16,
    color: '#fff',
    fontFamily: "'Courier New', monospace",
    outline: 'none',
    transition: 'all 0.3s ease',
  },
  buttonSMS: {
    width: '100%',
    height: 56,
    background: '#FF6B35',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  buttonSecondary: {
    width: '100%',
    maxWidth: 400,
    height: 56,
    background: '#1a1a1a',
    color: '#fff',
    border: '2px solid #333',
    borderRadius: 12,
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginBottom: 12,
  },
  buttonPrimary: {
    width: '100%',
    height: 56,
    background: '#FF6B35',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  linkButton: {
    background: 'transparent',
    border: 'none',
    color: '#FF6B35',
    fontSize: 14,
    cursor: 'pointer',
    textDecoration: 'underline',
    marginTop: 12,
  },
};
