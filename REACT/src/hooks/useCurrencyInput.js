// src/hooks/useCurrencyInput.js
/**
 * Hook para gerenciar inputs de moeda (BRL)
 * Resolve problemas de formatação e posição do cursor
 */

import { useState, useCallback } from 'react';

/**
 * Formata valor numérico para BRL
 * @param {number} value - Valor numérico
 * @returns {string} Valor formatado (ex: "1.234,56")
 */
const formatCurrency = (value) => {
    if (!value && value !== 0) return '';
    
    return new Intl.NumberFormat('pt-PT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
};

/**
 * Remove formatação e retorna número
 * @param {string} formattedValue - Valor formatado
 * @returns {number} Valor numérico
 */
const parseCurrency = (formattedValue) => {
    if (!formattedValue) return 0;
    
    // Remove tudo exceto números e vírgula
    const cleanValue = formattedValue.replace(/[^\d,]/g, '');
    // Substitui vírgula por ponto
    const normalizedValue = cleanValue.replace(',', '.');
    
    return parseFloat(normalizedValue) || 0;
};

/**
 * Hook para gerenciar input de moeda
 * @param {number} initialValue - Valor inicial
 * @param {Function} onChange - Callback para mudanças (recebe o valor numérico)
 * @returns {Object} { displayValue, handleChange, setValue, numericValue }
 */
export const useCurrencyInput = (initialValue = 0, onChange) => {
    const [displayValue, setDisplayValue] = useState(() => formatCurrency(initialValue));
    const [numericValue, setNumericValue] = useState(initialValue);

    const handleChange = useCallback((e) => {
        const input = e.target.value;
        
        // Permite apenas números, vírgula e ponto
        const sanitized = input.replace(/[^\d.,]/g, '');
        
        // Parse para número
        const numeric = parseCurrency(sanitized);
        
        // Atualiza estados
        setNumericValue(numeric);
        setDisplayValue(formatCurrency(numeric));
        
        // Notifica mudança
        if (onChange) {
            onChange(numeric);
        }
    }, [onChange]);

    const setValue = useCallback((value) => {
        const numeric = typeof value === 'number' ? value : parseCurrency(value);
        setNumericValue(numeric);
        setDisplayValue(formatCurrency(numeric));
        
        if (onChange) {
            onChange(numeric);
        }
    }, [onChange]);

    return {
        displayValue,
        handleChange,
        setValue,
        numericValue
    };
};

export { formatCurrency, parseCurrency };
