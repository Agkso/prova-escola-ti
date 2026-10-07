import { accessSync, constants, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ARQUIVO = 'fila.json';

function gravavel(dir) {
    try {
        if (!statSync(dir).isDirectory()) return false;
        accessSync(dir, constants.W_OK);
        return true;
    } catch {
        return false;
    }
}

export function criarArmazenamento(dir) {
    if (!gravavel(dir)) {
        return { persistente: false, carregar: () => null, salvar: () => {} };
    }
    const destino = join(dir, ARQUIVO);
    const temporario = `${destino}.tmp`;

    return {
        persistente: true,
        carregar() {
            try {
                return JSON.parse(readFileSync(destino, 'utf8'));
            } catch {
                return null; // primeiro uso ou arquivo ilegivel: comeca vazio
            }
        },
        salvar(estado) {
            try {
                writeFileSync(temporario, JSON.stringify(estado));
                renameSync(temporario, destino);
            } catch (erro) {
                console.error('falha ao persistir estado:', erro.message);
            }
        },
    };
}