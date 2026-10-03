// Seam: tela v18 de Tarefas, com persistência observada pela tela e pelo serviço público.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { AlthiusApp } from './AlthiusApp';
import { carregarContexto } from './contexto';
import { montarDados } from './dados';
import { criarTarefa, listarTarefas } from './servicos/tarefas';
import { entrarComoLocal } from '../test/supabaseLocal';
import { EVOLUT_TAREFAS as EVOLUT, isolarTarefas, membroTarefa as m } from '../test/isolarTarefas';
const demo={data:window.ALTHIUS_DATA!,caps:window.ALTHIUS_CAPS};
afterEach(()=>vi.restoreAllMocks());
async function abrirTarefas(email='lucas@evolut.com.br') {
  const cliente=await entrarComoLocal(email);
  const dados=montarDados(await carregarContexto(cliente),demo.data,demo.caps);
  window.ALTHIUS_DATA=dados; window.ALTHIUS_CAPS=dados.CAPS;
  window.location.hash='#/app/evolut/tasks';
  return render(<AlthiusApp dados={dados} supabase={cliente} aoSair={()=>{}} />);
}
describe('Tarefas reais na tela',()=>{
  isolarTarefas();
  it('lê a tarefa persistida e não mostra tarefas inventadas do protótipo',async()=>{
    await criarTarefa(await entrarComoLocal('lucas@evolut.com.br'),EVOLUT,m(4),crypto.randomUUID(),{
      titulo:'codex-tarefa-T1 do banco',responsavelId:m(4),prazo:'2026-10-03T14:00:00Z',canal:'call'
    });
    await abrirTarefas();
    expect(await screen.findByText('codex-tarefa-T1 do banco',{}, {timeout:5000})).toBeInTheDocument();
    expect(screen.queryByText('Ligar para Aline Xavier')).not.toBeInTheDocument();
    expect(screen.queryByText('41')).not.toBeInTheDocument();
  });
  it('cria uma tarefa pela tela e a mantém depois de reabrir',async()=>{
    const tela=await abrirTarefas();
    fireEvent.click(await screen.findByRole('button',{name:'Nova tarefa'}, {timeout:5000}));
    const formulario=await screen.findByRole('dialog',{name:'Nova tarefa'});
    fireEvent.change(within(formulario).getByLabelText('O que precisa ser feito'),{target:{value:'codex-tarefa-Criada na tela'}});
    fireEvent.click(within(formulario).getByRole('button',{name:'Criar tarefa'}));
    await screen.findByText('codex-tarefa-Criada na tela',{}, {timeout:5000});
    const tarefas=await listarTarefas(await entrarComoLocal('lucas@evolut.com.br'),EVOLUT);
    expect(tarefas.find(t=>t.titulo==='codex-tarefa-Criada na tela')).toMatchObject({responsavelId:m(4),status:'pendente'});
    tela.unmount();
    await abrirTarefas();
    expect(await screen.findByText('codex-tarefa-Criada na tela',{}, {timeout:5000})).toBeInTheDocument();
  });
  it('conclui pela tela e registra somente a conclusão, sem mensagem de CRM ou envio',async()=>{
    const c=await entrarComoLocal('lucas@evolut.com.br');
    const tarefa=await criarTarefa(c,EVOLUT,m(4),crypto.randomUUID(),{
      titulo:'codex-tarefa-Concluir e-mail',responsavelId:m(4),prazo:new Date().toISOString(),canal:'email'
    });
    await abrirTarefas();
    fireEvent.click(await screen.findByText('codex-tarefa-Concluir e-mail',{}, {timeout:5000}));
    fireEvent.click(await screen.findByRole('button',{name:'Concluir'}));
    await screen.findByText('Concluída',{}, {timeout:5000});
    expect((await listarTarefas(c,EVOLUT)).find(t=>t.id===tarefa.id)?.status).toBe('concluida');
    expect(screen.queryByText(/registrada no CRM|mensagem enviada/i)).not.toBeInTheDocument();
  });
  it('formulário usa contas reais e limita responsável do BDR ao próprio membro',async()=>{
    await abrirTarefas();
    fireEvent.click(await screen.findByRole('button',{name:'Nova tarefa'}, {timeout:5000}));
    const formulario=await screen.findByRole('dialog',{name:'Nova tarefa'});
    const conta=within(formulario).getByLabelText<HTMLSelectElement>('Conta');
    expect(Array.from(conta.options).filter(o=>o.value).length).toBeGreaterThan(0);
    for(const opcao of Array.from(conta.options).filter(o=>o.value)) expect(opcao.value).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/);
    expect(within(formulario).getByRole('button',{name:/Lucas Teixeira/})).toHaveAttribute('aria-pressed','true');
    expect(within(formulario).queryByRole('button',{name:/Bruna Lima/})).not.toBeInTheDocument();
  });
  it('Adiar 1 dia grava a nova data no banco',async()=>{
    const c=await entrarComoLocal('lucas@evolut.com.br');
    const tarefa=await criarTarefa(c,EVOLUT,m(4),crypto.randomUUID(),{
      titulo:'codex-tarefa-Adiar na tela',responsavelId:m(4),prazo:'2026-10-03T14:00:00Z',canal:'call'
    });
    await abrirTarefas();
    fireEvent.click(await screen.findByText('codex-tarefa-Adiar na tela',{}, {timeout:5000}));
    fireEvent.click(await screen.findByRole('button',{name:'Adiar 1 dia'}));
    await screen.findByText(/04\/10\/2026/,{}, {timeout:5000});
    expect(new Date((await listarTarefas(c,EVOLUT)).find(t=>t.id===tarefa.id)!.prazo).toISOString()).toBe('2026-10-04T14:00:00.000Z');
  });
  it('falha de leitura mostra erro e Tentar de novo, sem dados de demonstração',async()=>{
    await criarTarefa(await entrarComoLocal('lucas@evolut.com.br'),EVOLUT,m(4),crypto.randomUUID(),{
      titulo:'codex-tarefa-Depois da reconexão',responsavelId:m(4),prazo:new Date().toISOString(),canal:'call'
    });
    const fetchReal=globalThis.fetch;
    let falhar=true;
    vi.spyOn(globalThis,'fetch').mockImplementation((input,opcoes)=>{
      if(falhar && String(input).includes('/rest/v1/tasks?')) return Promise.reject(new Error('Sem conexão de teste.'));
      return fetchReal(input,opcoes);
    });
    await abrirTarefas();
    const erro=await screen.findByRole('alertdialog',{name:'Tarefas não carregadas'}, {timeout:10000});
    expect(erro).toHaveTextContent('Não foi possível carregar as tarefas.');
    expect(screen.queryByText('Ligar para Aline Xavier')).not.toBeInTheDocument();
    expect(screen.queryByText('codex-tarefa-Depois da reconexão')).not.toBeInTheDocument();
    falhar=false;
    fireEvent.click(within(erro).getByRole('button',{name:'Tentar de novo'}));
    expect(await screen.findByText('codex-tarefa-Depois da reconexão',{}, {timeout:5000})).toBeInTheDocument();
  });
  it('Tentar de novo não duplica tarefa quando a primeira resposta se perde',async()=>{
    const fetchReal=globalThis.fetch;
    let perder=true;
    vi.spyOn(globalThis,'fetch').mockImplementation(async(input,opcoes)=>{
      const resposta=await fetchReal(input,opcoes);
      if(perder && String(input).includes('/rpc/task_create')) {
        perder=false; throw new Error('Resposta perdida depois da gravação.');
      }
      return resposta;
    });
    await abrirTarefas();
    fireEvent.click(await screen.findByRole('button',{name:'Nova tarefa'}, {timeout:5000}));
    const formulario=await screen.findByRole('dialog',{name:'Nova tarefa'});
    fireEvent.change(within(formulario).getByLabelText('O que precisa ser feito'),{target:{value:'codex-tarefa-Repetir após resposta perdida'}});
    fireEvent.click(within(formulario).getByRole('button',{name:'Criar tarefa'}));
    const erro=await screen.findByRole('alertdialog',{name:'Tarefa não registrada'}, {timeout:5000});
    fireEvent.click(within(erro).getByRole('button',{name:'Tentar de novo'}));
    await screen.findByText('codex-tarefa-Repetir após resposta perdida',{}, {timeout:5000});
    expect((await listarTarefas(await entrarComoLocal('lucas@evolut.com.br'),EVOLUT))
      .filter(t=>t.titulo==='codex-tarefa-Repetir após resposta perdida')).toHaveLength(1);
  });
});