/**
 * coras.ts — Utilidades para otorgar Coras
 * Sistema de recompensas automáticas y manuales
 */
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qhnmxvexkizcsmivfuam.supabase.co';
const SUPA_KEY = import.meta.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFobm14dmV4a2l6Y3NtaXZmdWFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTIyMTI4MSwiZXhwIjoyMDg2Nzk3MjgxfQ.b2N86NyMG4F3CXcgTnzOjqx7AZPyDTa4QFFCtOSK42s';
const supabase = createClient(SUPA_URL, SUPA_KEY);

export interface MovimientoCoras {
  id: string;
  usuario_id: string;
  cantidad: number;
  motivo: string;
  juego?: string;
  created_at: string;
}

/**
 * Otorga Coras a un usuario y registra el movimiento
 */
export async function otorgarCoras(
  usuarioId: string,
  cantidad: number,
  motivo: string,
  juego?: string
): Promise<void> {
  try {
    // Obtener usuario actual
    const { data: usuario, error: usuarioError } = await supabase
      .from('gh_usuarios')
      .select('coras')
      .eq('id', usuarioId)
      .single();

    if (usuarioError) throw usuarioError;
    if (!usuario) throw new Error('Usuario no encontrado');

    const nuevasCoras = (usuario.coras ?? 0) + cantidad;

    // Actualizar Coras del usuario
    const { error: updateError } = await supabase
      .from('gh_usuarios')
      .update({ coras: nuevasCoras })
      .eq('id', usuarioId);

    if (updateError) throw updateError;

    // Registrar movimiento en historial
    const { error: historialError } = await supabase
      .from('gh_movimientos_coras')
      .insert({
        usuario_id: usuarioId,
        cantidad,
        motivo,
        juego: juego || null,
      });

    if (historialError) throw historialError;
  } catch (err: any) {
    console.error('Error otorgando Coras:', err);
    throw err;
  }
}

/**
 * Verifica y otorga recompensas automáticas basadas en estadísticas
 */
export async function verificarRecompensasAutomaticas(
  usuarioId: string,
  juego: string,
  victoria: boolean
): Promise<void> {
  try {
    // Obtener estadísticas del usuario para este juego
    const { data: estadisticas, error: statsError } = await supabase
      .from('gh_estadisticas')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('juego', juego)
      .single();

    if (statsError && statsError.code !== 'PGRST116') throw statsError;

    const partidasAnteriores = estadisticas?.partidas ?? 0;
    const victoriasAnteriores = estadisticas?.victorias ?? 0;

    // Regla 1: Ganar partida → +10 Coras
    if (victoria) {
      await otorgarCoras(usuarioId, 10, 'Victoria en partida', juego);
    }

    // Regla 2: Primera vez que jugás un juego → +5 Coras
    if (partidasAnteriores === 0) {
      await otorgarCoras(usuarioId, 5, 'Primera partida en este juego', juego);
    }

    // Regla 3: Racha de 3 victorias seguidas → +25 Coras bonus
    if (victoria && victoriasAnteriores >= 2) {
      // Verificar si las últimas 3 partidas fueron victorias
      const { data: ultimasPartidas } = await supabase
        .from('gh_movimientos_coras')
        .select('*')
        .eq('usuario_id', usuarioId)
        .eq('juego', juego)
        .eq('motivo', 'Victoria en partida')
        .order('created_at', { ascending: false })
        .limit(3);

      if (ultimasPartidas && ultimasPartidas.length >= 2) {
        // Verificar que las últimas 2 victorias fueron recientes (últimas 24 horas)
        const ahora = new Date();
        const hace24Horas = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
        const victoriasRecientes = ultimasPartidas.filter(
          (m: MovimientoCoras) => new Date(m.created_at) > hace24Horas
        );

        if (victoriasRecientes.length >= 2) {
          await otorgarCoras(usuarioId, 25, 'Racha de 3 victorias seguidas', juego);
        }
      }
    }
  } catch (err: any) {
    console.error('Error verificando recompensas automáticas:', err);
  }
}

/**
 * Otorga Coras por completar perfil (avatar + nombre)
 */
export async function otorgarCorasPorPerfilCompleto(usuarioId: string): Promise<void> {
  try {
    const { data: usuario } = await supabase
      .from('gh_usuarios')
      .select('nombre, avatar')
      .eq('id', usuarioId)
      .single();

    if (!usuario) return;

    // Verificar si ya se otorgaron las Coras por perfil completo
    const { data: movimientoExistente } = await supabase
      .from('gh_movimientos_coras')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('motivo', 'Perfil completo')
      .single();

    if (movimientoExistente) return; // Ya se otorgaron

    if (usuario.nombre && usuario.avatar && usuario.nombre !== '' && usuario.avatar !== '') {
      await otorgarCoras(usuarioId, 10, 'Perfil completo');
    }
  } catch (err: any) {
    console.error('Error otorgando Coras por perfil completo:', err);
  }
}

/**
 * Procesa el final de una partida: otorga Coras y actualiza estadísticas
 * Esta función debe llamarse cuando termina una partida
 */
export async function procesarFinalPartida(
  usuarioId: string,
  juego: string,
  victoria: boolean
): Promise<void> {
  try {
    // Verificar y otorgar recompensas automáticas
    await verificarRecompensasAutomaticas(usuarioId, juego, victoria);

    // Actualizar estadísticas
    const { data: estadisticaExistente } = await supabase
      .from('gh_estadisticas')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('juego', juego)
      .single();

    const corasGanadas = victoria ? 10 : 0; // Las Coras ya se otorgaron en verificarRecompensasAutomaticas

    if (estadisticaExistente) {
      await supabase
        .from('gh_estadisticas')
        .update({
          partidas: estadisticaExistente.partidas + 1,
          victorias: victoria ? estadisticaExistente.victorias + 1 : estadisticaExistente.victorias,
          derrotas: victoria ? estadisticaExistente.derrotas : estadisticaExistente.derrotas + 1,
          coras_ganadas: (estadisticaExistente.coras_ganadas ?? 0) + corasGanadas,
          updated_at: new Date().toISOString(),
        })
        .eq('id', estadisticaExistente.id);
    } else {
      await supabase.from('gh_estadisticas').insert({
        usuario_id: usuarioId,
        juego,
        partidas: 1,
        victorias: victoria ? 1 : 0,
        derrotas: victoria ? 0 : 1,
        coras_ganadas: corasGanadas,
      });
    }
  } catch (err: any) {
    console.error('Error procesando final de partida:', err);
  }
}
