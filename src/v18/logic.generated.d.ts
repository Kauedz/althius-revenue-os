// Contrato tipado da lógica gerada do protótipo (logic.generated.js).
// Escrito à mão: lista só o que a camada real (src/app/AlthiusApp.ts) usa ou sobrescreve.
// Se uma versão nova do design renomear algo daqui, os testes de src/app devem falhar.
import type { Component } from 'react';

export interface AlthiusLogicProps {
  /** Papel inicial do modo demonstração (o avatar troca em tempo de execução). */
  papel?: 'superadmin' | 'estrategista' | 'cliente' | 'bdr';
  /** Estado simulado de carregamento do protótipo. */
  estadoDemo?: 'normal' | 'carregando' | 'vazio' | 'erro' | 'offline' | 'desatualizado';
}

export class AlthiusLogic<P = AlthiusLogicProps> extends Component<P, Record<string, any>> {
  /** false no modo real: esconde a troca de papel (regras de produto em scripts/v18/patches.mjs). */
  modoDemo?: boolean;
  /** Papel da pessoa no workspace aberto. */
  papel(): 'superadmin' | 'estrategista' | 'cliente' | 'bdr';
  /** Slug do workspace aberto (validado contra wsPermitidos). */
  wsId(): string;
  /** Workspaces que a pessoa pode abrir. */
  wsPermitidos(): Array<{ id: string; nome: string; sigla: string; momento: string }>;
  /** Logo do workspace (busca pelo site no protótipo). */
  wsLogo(w: { id: string; nome: string }): { tem: boolean; src: string; erro: () => void; load: () => void };
  /** Membros de um workspace (pelo slug). */
  membros(ws: string): Array<Record<string, any>>;
  /** Valores que o template renderiza. */
  renderVals(): Record<string, any>;
}
