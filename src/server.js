import {criarApp} from "./index.js";
import {criarArmazenamento} from "./armazenamento.js";
import {carregarConfig} from "./config.js";
import {Fila} from "./fila.js";

const config = carregarConfig();
const armazenamento = criarArmazenamento(config.dirDados);
const fila = new Fila({
    prefixo: config.prefixo,
    razao: config.razao,
    estado: armazenamento.carregar(),
    aoMudar: (estado) => armazenamento.salvar(estado),
});

const servidor = criarApp(fila);
servidor.listen(config.porta, '0.0.0.0', () => {
    const modo = armazenamento.persistente ? `arquivo em ${config.dirDados}` : 'memoria';
    console.log(`fila de atendimento na porta ${config.porta} (persistencia: ${modo})`);
});

for (const sinal of ['SIGTERM', 'SIGINT']) {
    process.on(sinal, () => {
        servidor.close(() => process.exit(0));
        servidor.closeAllConnections();
    });
}