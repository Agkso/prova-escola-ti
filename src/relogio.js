const DESLOCAMENTO_MS = 3 * 60 * 60 * 1000;
const SUFIXO = '-03:00';

export function paraIso(ms) {
    return new Date(ms - DESLOCAMENTO_MS).toISOString().replace('Z', SUFIXO);
}

export function diaDe(ms) {
    return paraIso(ms).slice(0, 10);
}