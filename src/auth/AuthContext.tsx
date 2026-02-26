/**
 * AuthContext.tsx — Contexto global de autenticación
 * Maneja sesión, perfiles, Coras, Nectar y funciones de login/logout
 */
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qhnmxvexkizcsmivfuam.supabase.co';
const SUPA_KEY = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFobm14dmV4a2l6Y3NtaXZmdWFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTIyMTI4MSwiZXhwIjoyMDg2Nzk3MjgxfQ.b2N86NyMG4F3CXcgTnzOjqx7AZPyDTa4QFFCtOSK42s';
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || '';

const supabase: SupabaseClient = createClient(SUPA_URL, SUPA_KEY);

// ─── Tipos ───────────────────────────────────────────────────────────────────
export interface MovimientoCoras {
  id: string;
  usuario_id: string;
  cantidad: number;
  motivo: string;
  juego?: string;
  created_at: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  perfil: 'adulto' | 'junior';
  creado_por?: string;
  pin_parental?: string;
  avatar: string;
  coras: number;
  nectar: number;
  casino_habilitado: boolean;
  created_at: string;
}

interface Estadistica {
  id: string;
  usuario_id: string;
  juego: string;
  partidas: number;
  victorias: number;
  derrotas: number;
  coras_ganadas: number;
  updated_at: string;
}

interface AuthContextType {
  usuario: Usuario | null;
  user: User | null;
  estadisticas: Estadistica[];
  historialCoras: MovimientoCoras[];
  cargando: boolean;
  logueado: boolean;
  esAdmin: boolean;
  esJunior: boolean;
  error: string | null;
  loginGoogle: () => Promise<void>;
  // loginSMS: (telefono: string) => Promise<void>;
  // verificarOTP: (telefono: string, codigo: string) => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
  registrar: (data: {
    nombre: string;
    email: string;
    password: string;
    perfil: 'adulto' | 'junior';
    pin_parental?: string;
    creado_por?: string;
    avatar: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  actualizarNectar: (nuevoNectar: number) => Promise<void>;
  actualizarEstadisticas: (juego: string, victoria: boolean, corasGanadas?: number) => Promise<void>;
  buscarUsuarioPorNombre: (nombre: string) => Promise<Usuario | null>;
  recargarUsuario: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ───────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [estadisticas, setEstadisticas] = useState<Estadistica[]>([]);
  const [historialCoras, setHistorialCoras] = useState<MovimientoCoras[]>([]);
  const [cargando, setCargando] = useState(true);
  const [logueado, setLogueado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Computed values ───────────────────────────────────────────────────────
  const esAdmin = user?.email === ADMIN_EMAIL;
  const esJunior = usuario?.perfil === 'junior';

  // ─── Cargar usuario desde Supabase ────────────────────────────────────────
  const cargarUsuario = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('gh_usuarios')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (data) {
        // Asegurar valores por defecto si no existen
        const usuarioData: Usuario = {
          ...data,
          coras: data.coras ?? 0,
          nectar: data.nectar ?? 0,
          casino_habilitado: data.casino_habilitado ?? false,
        };
        setUsuario(usuarioData);
        setLogueado(true);
      }
    } catch (err: any) {
      console.error('Error cargando usuario:', err);
      setError(err.message);
    }
  };

  // ─── Recargar usuario ─────────────────────────────────────────────────────
  const recargarUsuario = async () => {
    if (user?.id) {
      await cargarUsuario(user.id);
      await cargarHistorialCoras(user.id);
    }
  };

  // ─── Cargar historial de Coras ────────────────────────────────────────────
  const cargarHistorialCoras = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('gh_movimientos_coras')
        .select('*')
        .eq('usuario_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      if (data) setHistorialCoras(data);
    } catch (err: any) {
      console.error('Error cargando historial de Coras:', err);
    }
  };

  // ─── Cargar estadísticas ───────────────────────────────────────────────────
  const cargarEstadisticas = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('gh_estadisticas')
        .select('*')
        .eq('usuario_id', userId);

      if (error) throw error;
      if (data) setEstadisticas(data);
    } catch (err: any) {
      console.error('Error cargando estadísticas:', err);
    }
  };

  // ─── Verificar sesión activa ───────────────────────────────────────────────
  useEffect(() => {
    const verificarSesion = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session?.user) {
          setUser(session.user);
          await cargarUsuario(session.user.id);
          await cargarEstadisticas(session.user.id);
          await cargarHistorialCoras(session.user.id);
        }
      } catch (err: any) {
        console.error('Error verificando sesión:', err);
        setError(err.message);
      } finally {
        setCargando(false);
      }
    };

    verificarSesion();

    // ─── Escuchar cambios de autenticación ───────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: Session | null) => {
        if (session?.user) {
          setUser(session.user);
          await cargarUsuario(session.user.id);
          await cargarEstadisticas(session.user.id);
          await cargarHistorialCoras(session.user.id);
        } else {
          setUser(null);
          setUsuario(null);
          setEstadisticas([]);
          setHistorialCoras([]);
          setLogueado(false);
        }
        setCargando(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ─── Login con Google ──────────────────────────────────────────────────────
  const loginGoogle = async () => {
    try {
      setError(null);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${window.location.pathname}`
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión con Google');
      throw err;
    }
  };

  // ─── Login con SMS ─────────────────────────────────────────────────────────
  const loginSMS = async (telefono: string) => {
    try {
      setError(null);
      const { error } = await supabase.auth.signInWithOtp({
        phone: telefono,
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Error al enviar código SMS');
      throw err;
    }
  };

  // ─── Verificar código OTP ──────────────────────────────────────────────────
  const verificarOTP = async (telefono: string, codigo: string) => {
    try {
      setError(null);
      const { data, error } = await supabase.auth.verifyOtp({
        phone: telefono,
        token: codigo,
        type: 'sms',
      });
      if (error) throw error;

      if (data.user) {
        // Verificar si el usuario ya existe en gh_usuarios
        const { data: usuarioExistente } = await supabase
          .from('gh_usuarios')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (!usuarioExistente) {
          // Crear usuario si no existe
          const { error: insertError } = await supabase
            .from('gh_usuarios')
            .insert({
              id: data.user.id,
              nombre: telefono,
              perfil: 'adulto',
              avatar: '🎮',
              coras: 0,
              nectar: 0,
              casino_habilitado: false,
            });
          if (insertError) throw insertError;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Código inválido');
      throw err;
    }
  };

  // ─── Login con Email ───────────────────────────────────────────────────────
  const loginEmail = async (email: string, password: string) => {
    try {
      setError(null);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Email o contraseña incorrectos');
      throw err;
    }
  };

  // ─── Registrar nuevo usuario ───────────────────────────────────────────────
  const registrar = async (data: {
    nombre: string;
    email: string;
    password: string;
    perfil: 'adulto' | 'junior';
    pin_parental?: string;
    creado_por?: string;
    avatar: string;
  }) => {
    try {
      setError(null);

      // Crear cuenta en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });
      if (authError) throw authError;

      if (!authData.user) throw new Error('No se pudo crear el usuario');

      // Crear registro en gh_usuarios
      const { error: usuarioError } = await supabase
        .from('gh_usuarios')
        .insert({
          id: authData.user.id,
          nombre: data.nombre,
          perfil: data.perfil,
          pin_parental: data.pin_parental,
          creado_por: data.creado_por,
          avatar: data.avatar,
          coras: 0,
          nectar: 0,
          casino_habilitado: false,
        });
      if (usuarioError) throw usuarioError;
    } catch (err: any) {
      setError(err.message || 'Error al registrar usuario');
      throw err;
    }
  };

  // ─── Logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    try {
      setError(null);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setUsuario(null);
      setEstadisticas([]);
      setHistorialCoras([]);
      setLogueado(false);
    } catch (err: any) {
      setError(err.message || 'Error al cerrar sesión');
      throw err;
    }
  };

  // ─── Actualizar Nectar ─────────────────────────────────────────────────────
  const actualizarNectar = async (nuevoNectar: number) => {
    if (!usuario) return;
    try {
      const { error } = await supabase
        .from('gh_usuarios')
        .update({ nectar: nuevoNectar })
        .eq('id', usuario.id);
      if (error) throw error;
      setUsuario({ ...usuario, nectar: nuevoNectar });
    } catch (err: any) {
      console.error('Error actualizando Nectar:', err);
    }
  };

  // ─── Actualizar estadísticas ───────────────────────────────────────────────
  const actualizarEstadisticas = async (
    juego: string,
    victoria: boolean,
    corasGanadas: number = 0
  ) => {
    if (!usuario) return;
    try {
      // Buscar estadística existente
      const { data: estadisticaExistente } = await supabase
        .from('gh_estadisticas')
        .select('*')
        .eq('usuario_id', usuario.id)
        .eq('juego', juego)
        .single();

      if (estadisticaExistente) {
        // Actualizar existente
        const { error } = await supabase
          .from('gh_estadisticas')
          .update({
            partidas: estadisticaExistente.partidas + 1,
            victorias: victoria
              ? estadisticaExistente.victorias + 1
              : estadisticaExistente.victorias,
            derrotas: victoria
              ? estadisticaExistente.derrotas
              : estadisticaExistente.derrotas + 1,
            coras_ganadas: (estadisticaExistente.coras_ganadas ?? 0) + corasGanadas,
            updated_at: new Date().toISOString(),
          })
          .eq('id', estadisticaExistente.id);
        if (error) throw error;
      } else {
        // Crear nueva estadística
        const { error } = await supabase.from('gh_estadisticas').insert({
          usuario_id: usuario.id,
          juego,
          partidas: 1,
          victorias: victoria ? 1 : 0,
          derrotas: victoria ? 0 : 1,
          coras_ganadas: corasGanadas,
        });
        if (error) throw error;
      }

      // Recargar estadísticas
      await cargarEstadisticas(usuario.id);
    } catch (err: any) {
      console.error('Error actualizando estadísticas:', err);
    }
  };

  // ─── Buscar usuario por nombre ────────────────────────────────────────────
  const buscarUsuarioPorNombre = async (nombre: string): Promise<Usuario | null> => {
    try {
      const { data, error } = await supabase
        .from('gh_usuarios')
        .select('*')
        .eq('nombre', nombre)
        .eq('perfil', 'adulto')
        .single();
      if (error) return null;
      return data;
    } catch (err) {
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        user,
        estadisticas,
        historialCoras,
        cargando,
        logueado,
        esAdmin,
        esJunior,
        error,
        loginGoogle,
        // loginSMS,
        // verificarOTP,
        loginEmail,
        registrar,
        logout,
        actualizarNectar,
        actualizarEstadisticas,
        buscarUsuarioPorNombre,
        recargarUsuario,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook personalizado ─────────────────────────────────────────────────────
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
