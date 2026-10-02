import type { Component } from 'react';

export interface AlthiusLogicProps {
  /** Papel inicial do modo demonstração (o avatar troca em tempo de execução). */
  papel?: 'superadmin' | 'estrategista' | 'cliente' | 'bdr';
  /** Estado simulado de carregamento do protótipo. */
  estadoDemo?: 'normal' | 'carregando' | 'vazio' | 'erro' | 'offline' | 'desatualizado';
}

export class AlthiusLogic extends Component<AlthiusLogicProps> {}
