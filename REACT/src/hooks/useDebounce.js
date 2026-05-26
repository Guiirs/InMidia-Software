// src/hooks/useDebounce.js
import { useState, useEffect } from 'react';

/**
 * Hook customizado para "atrasar" a atualização de um valor.
 * Útil para campos de busca, evitando buscas a cada tecla.
 * @param {any} value O valor a ser "atrasado" (ex: o termo da busca).
 * @param {number} delay O tempo em milissegundos (ex: 300).
 * @returns {any} O valor "atrasado".
 */
export function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        // Cria um temporizador para atualizar o valor
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        // Limpa o temporizador se o valor mudar antes do delay
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]); // Só re-executa se o valor ou o delay mudarem

    return debouncedValue;
}