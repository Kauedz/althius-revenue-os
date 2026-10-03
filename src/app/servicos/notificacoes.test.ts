// Seam: src/app/servicos/notificacoes.ts (listarNotificacoes, formatarTempoRelativo, marcarNotificacoesComoLidas)
import { describe, it, expect, vi } from 'vitest';
import {
  formatarTempoRelativo,
  listarNotificacoes,
  marcarNotificacoesComoLidas
} from './notificacoes';

describe('Serviço de Notificações (ADR 0036)', () => {
  describe('formatarTempoRelativo', () => {
    const base = new Date('2026-10-03T12:00:00Z');

    it('formata segundos como agora', () => {
      expect(formatarTempoRelativo('2026-10-03T11:59:30Z', base)).toBe('agora');
    });

    it('formata minutos como há X min', () => {
      expect(formatarTempoRelativo('2026-10-03T11:45:00Z', base)).toBe('há 15 min');
    });

    it('formata horas como há X h', () => {
      expect(formatarTempoRelativo('2026-10-03T09:00:00Z', base)).toBe('há 3 h');
    });

    it('formata 1 dia atrás como ontem', () => {
      expect(formatarTempoRelativo('2026-10-02T10:00:00Z', base)).toBe('ontem');
    });

    it('formata múltiplos dias como há X d', () => {
      expect(formatarTempoRelativo('2026-09-30T10:00:00Z', base)).toBe('há 3 d');
    });
  });

  describe('listarNotificacoes', () => {
    it('retorna lista mapeada com id e status de lida', async () => {
      const dadosMock = [
        {
          id: 'fa000000-0000-0000-0000-000000000001',
          workspace_id: 'ws-1',
          recipient_member_id: 'mb-1',
          type: 'approval',
          title: 'Aprovação pendente',
          body: 'E-mails T1',
          read_at: null,
          created_at: new Date().toISOString()
        },
        {
          id: 'fa000000-0000-0000-0000-000000000002',
          workspace_id: 'ws-1',
          recipient_member_id: 'mb-1',
          type: 'system',
          title: 'Créditos consumidos',
          body: '15 créditos debitados',
          read_at: new Date().toISOString(),
          created_at: new Date(Date.now() - 3600000).toISOString()
        }
      ];

      const clientMock = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: dadosMock, error: null })
              })
            })
          })
        })
      };

      const resultado = await listarNotificacoes(clientMock as any, 'ws-1', 'mb-1');

      expect(resultado).toHaveLength(2);
      expect(resultado[0][0]).toBe('Aprovação pendente');
      expect(resultado[0][1]).toBe('E-mails T1');
      expect(resultado[0][3]).toBe('fa000000-0000-0000-0000-000000000001');
      expect(resultado[0][4]).toBe(false); // read_at is null

      expect(resultado[1][0]).toBe('Créditos consumidos');
      expect(resultado[1][4]).toBe(true); // read_at is set
    });

    it('lança erro descritivo em caso de falha na consulta', async () => {
      const clientMock = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Network error' } })
              })
            })
          })
        })
      };

      await expect(listarNotificacoes(clientMock as any, 'ws-1', 'mb-1')).rejects.toThrow(
        'Não foi possível carregar as notificações.'
      );
    });
  });

  describe('marcarNotificacoesComoLidas', () => {
    it('executa RPC com member_id e notification_id opcional', async () => {
      const rpcMock = vi.fn().mockResolvedValue({ error: null });
      const clientMock = { rpc: rpcMock };

      await marcarNotificacoesComoLidas(clientMock as any, 'mb-1', 'fa000000-0000-0000-0000-000000000001');

      expect(rpcMock).toHaveBeenCalledWith('mark_notifications_read', {
        p_member_id: 'mb-1',
        p_notification_id: 'fa000000-0000-0000-0000-000000000001'
      });
    });

    it('passa null quando notification_id não é fornecido', async () => {
      const rpcMock = vi.fn().mockResolvedValue({ error: null });
      const clientMock = { rpc: rpcMock };

      await marcarNotificacoesComoLidas(clientMock as any, 'mb-1');

      expect(rpcMock).toHaveBeenCalledWith('mark_notifications_read', {
        p_member_id: 'mb-1',
        p_notification_id: null
      });
    });

    it('lança erro claro se a RPC falhar', async () => {
      const rpcMock = vi.fn().mockResolvedValue({ error: { message: 'Permissão negada' } });
      const clientMock = { rpc: rpcMock };

      await expect(marcarNotificacoesComoLidas(clientMock as any, 'mb-1')).rejects.toThrow(
        'Não foi possível marcar as notificações como lidas.'
      );
    });
  });
});