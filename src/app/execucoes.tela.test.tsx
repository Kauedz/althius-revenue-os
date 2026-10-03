import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';
const ID='ec000000-0000-0000-0000-000000001042';
async function abrir(email:string) {
  window.location.hash='#/app/evolut/executions/'+ID;
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'),{target:{value:email}});
  fireEvent.change(screen.getByLabelText('Senha'),{target:{value:'althius-demo'}});
  fireEvent.click(screen.getByRole('button',{name:'Continuar'}));
  await screen.findByText('512 contas com fit acima de 70',{}, {timeout:8000});
}
describe.skipIf(!bancoLocalNoAr)('tela de Execuções (banco local)',()=>{
  let original:any;
  beforeEach(async()=> { const r=await adminLocal().from('executions').select('status,logs').eq('id',ID).single(); if(r.error) throw r.error; original=r.data; });
  afterEach(async()=>{ const r=await adminLocal().from('executions').update(original).eq('id',ID); if(r.error) throw r.error; });
  it('C-level abre execução real sem dólar e sem botões de controle',async()=>{
    await abrir('aline@evolut.com.br');
    expect(screen.queryByRole('button',{name:'Pausar'})).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('US$');
  });
  it('estrategista pausa pela tela e o banco confirma a mudança',async()=>{
    await abrir('camila@althius.com.br');
    fireEvent.click(screen.getByRole('button',{name:'Pausar'}));
    const dialog=await screen.findByRole('alertdialog', { name: 'Pausar execução?' });
    fireEvent.click(within(dialog).getByRole('button',{name:'Pausar'}));
    await waitFor(async()=>expect((await adminLocal().from('executions').select('status').eq('id',ID).single()).data?.status).toBe('paused'),{timeout:8000});
    expect(document.body).not.toHaveTextContent('US$');
  });
});