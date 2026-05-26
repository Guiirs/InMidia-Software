// src/services/relatorioService.js
/**
 * Serviço de Relatórios
 * Responsável por: Geração de relatórios, Downloads
 * Normalização delegada ao dashboardAdapter.
 */

import apiClient from './apiClient';
import { handleBlobDownload } from '../utils/downloadHelper';
import { normalizeDashboardSummary, normalizePlacasPorRegiao } from '../adapters/dashboardAdapter';

/**
 * Busca relatório de placas por região
 * @returns {Promise<import('../contracts').PlacasPorRegiaoItem[]>}
 */
export const fetchPlacasPorRegiaoReport = async () => {
    const response = await apiClient.get('/relatorios/placas-por-regiao');
    return normalizePlacasPorRegiao(response.data);
};

/**
 * Busca resumo do dashboard
 * @returns {Promise<import('../contracts').DashboardSummaryCanonical>}
 */
export const fetchDashboardSummary = async () => {
    const response = await apiClient.get('/relatorios/dashboard-summary');
    return normalizeDashboardSummary(response.data);
};

/**
 * Busca relatório de ocupação por período
 * @param {string} data_inicio - Data inicial (YYYY-MM-DD)
 * @param {string} data_fim - Data final (YYYY-MM-DD)
 * @returns {Promise<Object>} Dados do relatório
 */
export const fetchRelatorioOcupacao = async (data_inicio, data_fim) => {
    const params = new URLSearchParams({
        data_inicio,
        data_fim,
        dataInicio: data_inicio,
        dataFim: data_fim,
    });
    const response = await apiClient.get(`/relatorios/ocupacao-por-periodo?${params.toString()}`);
    return response.data;
};

/**
 * Download PDF do relatório de ocupação
 * @param {string} data_inicio - Data inicial (YYYY-MM-DD)
 * @param {string} data_fim - Data final (YYYY-MM-DD)
 * @returns {Promise<Object>} { blob, filename }
 */
export const downloadRelatorioOcupacaoPDF = async (data_inicio, data_fim) => {
    const params = new URLSearchParams({
        data_inicio,
        data_fim,
        dataInicio: data_inicio,
        dataFim: data_fim,
    });
    const response = await apiClient.get(
        `/relatorios/export/ocupacao-por-periodo?${params.toString()}`,
        { responseType: 'blob' }
    );
    return handleBlobDownload(response);
};
