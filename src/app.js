import { createServer } from 'node:http';

const LIMITE_CORPO= 64* 1024;
const STATUS_DO_ERRO = {
    tipo_invalido: 422,
    fila_vazia: 404,
    senha_nao_encontrada: 404,
    senha_nao_chamada: 409,
    senha_nao_aguardando: 409,
};

const ROTA_ACAO = /^\/senhas\/([^/]+)\/(concluir|rechamar|cancelar)$/;

function responder(res, status, corpo) {
    const dados = JSON.stringify(corpo);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(dados),
    });
    res.end(dados);
}

async function lerJson(req) {
    const partes = [];
    let tamanho = 0;
    for await (const parte of req) {
        tamanho += parte.length;
        if (tamanho > LIMITE_CORPO) return null;
        partes.push(parte);
    }
    try {
        return JSON.parse(Buffer.concat(partes).toString('utf8'));
    } catch {
        return null;
    }
}

function resultado(res, r, statusOk = 200) {
    if (r.erro) return responder(res, STATUS_DO_ERRO[r.erro], { erro: r.erro });
    return responder(res, statusOk, r.senha);
}

async function rotear(fila, req, res) {
    const { pathname } = new URL(req.url, 'http://localhost');
    const caminho = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    const metodo = req.method;
    const acao = ROTA_ACAO.exec(caminho);

    const rotas = {
        '/healthz': { GET: () => responder(res, 200, { status: 'ok' }) },
        '/painel': { GET: () => responder(res, 200, { chamadas: fila.painel() }) },
        '/senhas/proxima': { GET: () => resultado(res, fila.proxima()) },
        '/senhas': {
            POST: async () => {
                const corpo = await lerJson(req);
                const tipo = corpo && typeof corpo === 'object' ? corpo.tipo : undefined;
                return resultado(res, fila.emitir(tipo), 201);
            },
        },
    };
    if (acao) {
        const [, codigo, nome] = acao;
        rotas[caminho] = { POST: () => resultado(res, fila[nome](decodeURIComponent(codigo))) };
    }

    const rota = Object.hasOwn(rotas, caminho) ? rotas[caminho] : null;
    if (!rota) return responder(res, 404, { erro: 'rota_nao_encontrada' });
    if (!Object.hasOwn(rota, metodo)) {
        res.setHeader('Allow', Object.keys(rota).join(', '));
        return responder(res, 405, { erro: 'metodo_nao_permitido' });
    }
    return rota[metodo]();
}

export function criarApp(fila) {
    return createServer((req, res) => {
        rotear(fila, req, res).catch((erro) => {
            console.error('erro interno:', erro);
            if (!res.headersSent) responder(res, 500, { erro: 'erro_interno' });
        });
    });
}