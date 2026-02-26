/**
 * AuthContext.tsx — Contexto global de usuario
 * Maneja sesión local con solo nombre, perfiles, Coras, Nectar
 */
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qhnmxvexkizcsmivfuam.supabase.co';
const SUPA_KEY = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFobm14dmV4a2l6Y3NtaXZmdWFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTIyMTI4MSwiZXhwIjoyMDg2Nzk3MjgxfQ.b2N86NyMG4F3CXcgTnzOjqx7AZPyDTa4QFFCtOSK42s';

const supabase: SupabaseClient = createClient(SUPA_URL, SUPA_KEY);

// Clave para localStorage
const STORAGE_KEY = 'gamehub_usuario';

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
  estadisticas: Estadistica[];
  historialCoras: MovimientoCoras[];
  cargando: boolean;
  logueado: boolean;
  esAdmin: boolean;
  esJunior: boolean;
  error: string | null;
  iniciarSesion: (nombre: string) => void;
  logout: () => void;
  actualizarNectar: (nuevoNectar: number) => Promise<void>;
  actualizarEstadisticas: (juego: string, victoria: boolean, corasGanadas?: number) => Promise<void>;
  buscarUsuarioPorNombre: (nombre: string) => Promise<Usuario | null>;
  recargarUsuario: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ───────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [estadisticas, setEstadisticas] = useState<Estadistica[]>([]);
  const [historialCoras, setHistorialCoras] = useState<MovimientoCoras[]>([]);
  const [cargando, setCargando] = useState(true);
  const [logueado, setLogueado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Computed values ───────────────────────────────────────────────────────
  const esAdmin = false;
  const esJunior = usuario?.perfil === 'junior';

  // ─── Generar ID único ──────────────────────────────────────────────────────
  const generarId = () => {
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // ─── Cargar usuario desde localStorage ─────────────────────────────────────
  const cargarUsuarioLocal = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const usuarioData: Usuario = JSON.parse(stored);
        setUsuario(usuarioData);
        setLogueado(true);
        // Cargar estadísticas e historial si hay ID
        if (usuarioData.id) {
          cargarEstadisticas(usuarioData.id);
          cargarHistorialCoras(usuarioData.id);
        }
      }
    } catch (err: any) {
      console.error('Error cargando usuario local:', err);
    } finally {
      setCargando(false);
    }
  };

  // ─── Cargar historial de Coras ────────────────────────────────────────────
  const cargarHistorialCoras = async (userId: string) => {
    if (!userId || userId.startsWith('local_')) {
      setHistorialCoras([]);
      return;
    }
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
      setHistorialCoras([]);
    }
  };

  // ─── Cargar estadísticas ───────────────────────────────────────────────────
  const cargarEstadisticas = async (userId: string) => {
    if (!userId || userId.startsWith('local_')) {
      setEstadisticas([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('gh_estadisticas')
        .select('*')
        .eq('usuario_id', userId);

      if (error) throw error;
      if (data) setEstadisticas(data);
    } catch (err: any) {
      console.error('Error cargando estadísticas:', err);
      setEstadisticas([]);
    }
  };

  // ─── Iniciar sesión con nombre ─────────────────────────────────────────────
  const iniciarSesion = (nombre: string) => {
    try {
      setError(null);
      const nuevoUsuario: Usuario = {
        id: generarId(),
        nombre: nombre.trim(),
        perfil: 'adulto',
        avatar: '🎮',
        coras: 0,
        nectar: 0,
        casino_habilitado: false,
        created_at: new Date().toISOString(),
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nuevoUsuario));
      setUsuario(nuevoUsuario);
      setLogueado(true);
      setEstadisticas([]);
      setHistorialCoras([]);
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    }
  };

  // ─── Logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUsuario(null);
    setEstadisticas([]);
    setHistorialCoras([]);
    setLogueado(false);
    setError(null);
  };

  // ─── Recargar usuario ─────────────────────────────────────────────────────
  const recargarUsuario = async () => {
    if (usuario?.id) {
      cargarUsuarioLocal();
    }
  };

  // ─── Actualizar Nectar ─────────────────────────────────────────────────────
  const actualizarNectar = async (nuevoNectar: number) => {
    if (!usuario) return;
    try {
      const usuarioActualizado = { ...usuario, nectar: nuevoNectar };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(usuarioActualizado));
      setUsuario(usuarioActualizado);
      
      // Si tiene ID de Supabase, actualizar en BD
      if (usuario.id && !usuario.id.startsWith('local_')) {
        const { error } = await supabase
          .from('gh_usuarios')
          .update({ nectar: nuevoNectar })
          .eq('id', usuario.id);
        if (error) throw error;
      }
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
    if (!usuario || usuario.id.startsWith('local_')) {
      // Usuario local, no guardar estadísticas en BD
      return;
    }
    
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

  // ─── Cargar usuario al iniciar ─────────────────────────────────────────────
  useEffect(() => {
    cargarUsuarioLocal();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        usuario,
        estadisticas,
        historialCoras,
        cargando,
        logueado,
        esAdmin,
        esJunior,
        error,
        iniciarSesion,
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
