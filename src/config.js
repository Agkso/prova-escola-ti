import { readFileSync } from 'node:fs';

const PADRAO = { PREFIXO: 'A', RAZAO_PREFERENCIAL: 2 };

function lerParams() {
    try {
        const caminho = new URL('../variante/params.json', import.meta.url);
        return JSON.parse(readFileSync(caminho, 'utf8'));
    } catch {
        return {};
    }
}

export function carregarConfig(env = process.env) {
    const params = lerParams();
    const razao = Number(env.RAZAO_PREFERENCIAL ?? params.RAZAO_PREFERENCIAL);
    return {
        prefixo: String(env.PREFIXO ?? params.PREFIXO ?? PADRAO.PREFIXO),
        razao: Number.isInteger(razao) && razao > 0 ? razao : PADRAO.RAZAO_PREFERENCIAL,
        porta: Number(env.PORT) || 8080,
        dirDados: env.DATA_DIR ?? '/data',
    };
}