import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Fila } from '../src/fila.js';

const DIA_1 = Date.parse('2026-10-07T12:00:00-03:00');
const UM_DIA = 24 * 60 * 60 * 1000;

function novaFila(extra = {}) {
    return new Fila({ prefixo: 'B', razao: 3, ...extra });
}
const tipos = (fila, n) => Array.from({ length: n }, () => fila.proxima().senha.tipo);

test('emite codigos sequenciais com prefixo e fuso -03:00', () => {
    const fila = novaFila();
    const { senha } = fila.emitir('normal');
    assert.equal(senha.codigo, 'B001');
    assert.equal(senha.status, 'aguardando');
    assert.match(senha.emissao, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}-03:00$/);
    assert.equal(fila.emitir('preferencial').senha.codigo, 'B002');
    assert.deepEqual(fila.emitir('vip'), { erro: 'tipo_invalido' });
    assert.deepEqual(fila.emitir(undefined), { erro: 'tipo_invalido' });
});

test('chama RAZAO preferenciais antes de 1 normal e recomeca o ciclo', () => {
    const fila = novaFila();
    for (let i = 0; i < 3; i++) fila.emitir('normal');
    for (let i = 0; i < 7; i++) fila.emitir('preferencial');
    const p = 'preferencial';
    assert.deepEqual(tipos(fila, 10), [p, p, p, 'normal', p, p, p, 'normal', p, 'normal']);
    assert.deepEqual(fila.proxima(), { erro: 'fila_vazia' });
});

test('com um unico tipo na fila, chama o que houver', () => {
    const fila = novaFila();
    for (let i = 0; i < 5; i++) fila.emitir('preferencial');
    assert.deepEqual(tipos(fila, 5), Array(5).fill('preferencial'));
    fila.emitir('normal');
    fila.emitir('normal');
    assert.deepEqual(tipos(fila, 2), ['normal', 'normal']);
});

test('transicoes: concluir, rechamar e cancelar', () => {
    const fila = novaFila();
    fila.emitir('normal');
    fila.emitir('normal');
    assert.equal(fila.concluir('B999').erro, 'senha_nao_encontrada');
    assert.equal(fila.concluir('B001').erro, 'senha_nao_chamada');
    assert.equal(fila.rechamar('B001').erro, 'senha_nao_chamada');
    assert.equal(fila.cancelar('B002').senha.status, 'cancelada');
    assert.equal(fila.cancelar('B002').erro, 'senha_nao_aguardando');

    const chamada = fila.proxima().senha;
    assert.equal(chamada.codigo, 'B001');
    assert.equal(fila.cancelar('B001').erro, 'senha_nao_aguardando');
    const rechamada = fila.rechamar('B001').senha;
    assert.equal(rechamada.status, 'chamada');
    assert.notEqual(rechamada.chamada_em, chamada.chamada_em);
    assert.equal(fila.concluir('B001').senha.status, 'concluida');
    assert.equal(fila.concluir('B001').erro, 'senha_nao_chamada');
    assert.deepEqual(fila.proxima(), { erro: 'fila_vazia' });
});

test('painel: 5 ultimas chamadas, mais recente primeiro, sem canceladas', () => {
    const fila = novaFila();
    for (let i = 0; i < 8; i++) fila.emitir('normal');
    fila.cancelar('B008');
    for (let i = 0; i < 7; i++) fila.proxima();
    fila.concluir('B007');
    fila.rechamar('B002');
    const codigos = fila.painel().map((s) => s.codigo);
    assert.deepEqual(codigos, ['B002', 'B007', 'B006', 'B005', 'B004']);
    assert.equal(fila.painel()[1].status, 'concluida');
});

test('sequencia reinicia a cada dia', () => {
    let agora = DIA_1;
    const fila = novaFila({ agora: () => agora });
    fila.emitir('normal');
    assert.equal(fila.emitir('normal').senha.codigo, 'B002');
    agora += UM_DIA;
    assert.equal(fila.emitir('normal').senha.codigo, 'B001');
});

test('estado restaurado preserva fila, sequencia, ciclo e painel', () => {
    let salvo;
    const fila = novaFila({ aoMudar: (e) => { salvo = JSON.stringify(e); } });
    fila.emitir('preferencial');
    fila.emitir('preferencial');
    fila.emitir('normal');
    fila.proxima();

    const outra = novaFila({ estado: JSON.parse(salvo) });
    assert.deepEqual(outra.painel().map((s) => s.codigo), ['B001']);
    assert.equal(outra.emitir('normal').senha.codigo, 'B004');
    assert.equal(outra.proxima().senha.codigo, 'B002');
});