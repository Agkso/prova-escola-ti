import { diaDe, paraIso } from './relogio.js';

export const TIPOS = ['normal', 'preferencial'];
const TAMANHO_PAINEL = 5;

function estadoInicial() {
    return { dia: null, sequencia: 0, consecutivas: 0, ordem: 0, ultimoInstante: 0, senhas: [] };
}

function apresentar(senha) {
    const { codigo, tipo, emissao, status } = senha;
    const corpo = { codigo, tipo, emissao, status };
    if (senha.chamada_em) corpo.chamada_em = senha.chamada_em;
    return corpo;
}

export class Fila {
    constructor({ prefixo, razao, estado = null, agora = Date.now, aoMudar = () => {} }) {
        this.prefixo = prefixo;
        this.razao = razao;
        this.agora = agora;
        this.aoMudar = aoMudar;
        this.estado = { ...estadoInicial(), ...estado };
    }

    #instante() {
        const ms = Math.max(this.agora(), this.estado.ultimoInstante + 1);
        this.estado.ultimoInstante = ms;
        return ms;
    }

    #buscar(codigo) {
        // Codigos se repetem entre dias: vale a senha mais recente.
        return this.estado.senhas.findLast((s) => s.codigo === codigo);
    }

    #marcarChamada(senha) {
        senha.status = 'chamada';
        senha.chamada_em = paraIso(this.#instante());
        senha.ordem = ++this.estado.ordem;
    }

    emitir(tipo) {
        if (!TIPOS.includes(tipo)) return { erro: 'tipo_invalido' };
        const ms = this.#instante();
        const dia = diaDe(ms);
        if (this.estado.dia !== dia) {
            this.estado.dia = dia;
            this.estado.sequencia = 0;
        }
        this.estado.sequencia += 1;
        const senha = {
            codigo: this.prefixo + String(this.estado.sequencia).padStart(3, '0'),
            tipo,
            emissao: paraIso(ms),
            status: 'aguardando',
        };
        this.estado.senhas.push(senha);
        this.aoMudar(this.estado);
        return { senha: apresentar(senha) };
    }

    proxima() {
        const aguardando = this.estado.senhas.filter((s) => s.status === 'aguardando');
        const preferencial = aguardando.find((s) => s.tipo === 'preferencial');
        const normal = aguardando.find((s) => s.tipo === 'normal');
        if (!preferencial && !normal) return { erro: 'fila_vazia' };

        const vezDaPreferencial = preferencial && (this.estado.consecutivas < this.razao || !normal);
        const senha = vezDaPreferencial ? preferencial : normal;
        this.estado.consecutivas = vezDaPreferencial ? this.estado.consecutivas + 1 : 0;

        this.#marcarChamada(senha);
        this.aoMudar(this.estado);
        return { senha: apresentar(senha) };
    }

    #transicao(codigo, statusExigido, erroDeStatus, aplicar) {
        const senha = this.#buscar(codigo);
        if (!senha) return { erro: 'senha_nao_encontrada' };
        if (senha.status !== statusExigido) return { erro: erroDeStatus };
        aplicar(senha);
        this.aoMudar(this.estado);
        return { senha: apresentar(senha) };
    }

    concluir(codigo) {
        return this.#transicao(codigo, 'chamada', 'senha_nao_chamada', (s) => {
            s.status = 'concluida';
        });
    }

    rechamar(codigo) {
        return this.#transicao(codigo, 'chamada', 'senha_nao_chamada', (s) => this.#marcarChamada(s));
    }

    cancelar(codigo) {
        return this.#transicao(codigo, 'aguardando', 'senha_nao_aguardando', (s) => {
            s.status = 'cancelada';
        });
    }

    painel() {
        return this.estado.senhas
            .filter((s) => s.ordem)
            .sort((a, b) => b.ordem - a.ordem)
            .slice(0, TAMANHO_PAINEL)
            .map(apresentar);
    }
}