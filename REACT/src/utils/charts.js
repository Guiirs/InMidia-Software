// utils/charts.js
import { Chart } from 'chart.js';

/**
 * Destrói uma instância de gráfico Chart.js existente.
 * @param {object} chartInstances - O objeto que armazena as instâncias de gráfico da página.
 * @param {string} canvasId - O ID do elemento canvas.
 */
export function destroyExistingChart(chartInstances, canvasId) {
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
        delete chartInstances[canvasId];
    } else {
        const chart = Chart.getChart(canvasId);
        if (chart) {
            chart.destroy();
        }
    }
}

/**
 * Gera cores aleatórias para os gráficos.
 * @param {number} numColors - Quantidade de cores a gerar.
 * @returns {string[]} - Array de cores RGBA.
 */
export function generateColors(numColors) {
    const colors = [];
    for (let i = 0; i < numColors; i++) {
        const r = Math.floor(Math.random() * 155) + 100; // 100-255
        const g = Math.floor(Math.random() * 155) + 100; // 100-255
        const b = Math.floor(Math.random() * 155) + 100; // 100-255
        colors.push(`rgba(${r}, ${g}, ${b}, 0.7)`);
    }
    return colors;
}
