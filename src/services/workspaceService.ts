import { supabase } from '../lib/supabase';

export interface WorkspaceData {
  id: string;
  slug?: string;
  nome: string;
  sigla: string;
  momento?: string;
  site_domain?: string;
  logo_url?: string;
  logo_source?: 'site' | 'upload';
  status?: string;
}

export const workspaceService = {
  async list(): Promise<WorkspaceData[]> {
    const { data, error } = await supabase
      .from('workspaces')
      .select('id, name, slug, site_domain, logo_url, logo_source, status')
      .order('name');

    if (error || !data || data.length === 0) {
      // Fallback to local default seeds
      return [
        { id: 'evolut', nome: 'Evolut Trading', sigla: 'EV', momento: 'Execução' },
        { id: 'grao', nome: 'Grão Norte Alimentos', sigla: 'GN', momento: 'Preparação' },
        { id: 'vertice', nome: 'Vértice Indústria', sigla: 'VI', momento: 'Otimização' }
      ];
    }

    return data.map(ws => ({
      id: ws.id,
      slug: ws.slug,
      nome: ws.name,
      sigla: ws.name.slice(0, 2).toUpperCase(),
      site_domain: ws.site_domain,
      logo_url: ws.logo_url,
      logo_source: ws.logo_source,
      status: ws.status
    }));
  },

  async get(id: string): Promise<WorkspaceData | null> {
    const { data, error } = await supabase
      .from('workspaces')
      .select('id, name, slug, site_domain, logo_url, logo_source, status')
      .or(`id.eq.${id},slug.eq.${id}`)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      slug: data.slug,
      nome: data.name,
      sigla: data.name.slice(0, 2).toUpperCase(),
      site_domain: data.site_domain,
      logo_url: data.logo_url,
      logo_source: data.logo_source,
      status: data.status
    };
  }
};
