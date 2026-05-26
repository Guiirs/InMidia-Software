// src/services/contratoService.js
/**
 * Serviço de Contratos
 * Responsável por: CRUD Contratos, Download PDFs
 */

import apiClient from './apiClient';
import { handleBlobDownload } from '../utils/downloadHelper';

/**
 * Busca contratos com filtros
 * @param {URLSearchParams} params - Parâmetros de busca
 * @returns {Promise<Object>} Lista de contratos
 */
export const fetchContratos = async (params) => {
    const response = await apiClient.get(`/contratos?${params.toString()}`);
    return response.data;
};

/**
 * Cria novo contrato a partir de uma PI
 * @param {Object} contratoData - Dados do contrato
 * @returns {Promise<Object>} Contrato criado
 */
export const createContrato = async (contratoData) => {
    const response = await apiClient.post('/contratos', contratoData);
    return response.data;
};

/**
 * Atualiza contrato existente
 * @param {string} id - ID do contrato
 * @param {Object} contratoData - Dados atualizados
 * @returns {Promise<Object>} Contrato atualizado
 */
export const updateContrato = async (id, contratoData) => {
    const response = await apiClient.put(`/contratos/${id}`, contratoData);
    return response.data;
};

/**
 * Deleta contrato
 * @param {string} id - ID do contrato
 * @returns {Promise<void>}
 */
export const deleteContrato = async (id) => {
    await apiClient.delete(`/contratos/${id}`);
};

/**
 * Download PDF do contrato (método nativo com pdfkit)
 * @param {string} id - ID do contrato
 * @returns {Promise<Object>} { blob, filename }
 */
export const downloadContrato_PDF = async (id) => {
    const response = await apiClient.get(`/contratos/${id}/download`, {
        responseType: 'blob'
    });
    return handleBlobDownload(response);
};

/**
 * Download Excel do contrato
 * @param {string} id - ID do contrato
 * @returns {Promise<Object>} { blob, filename }
 */
export const downloadContrato_Excel = async (id) => {
    const response = await apiClient.get(`/contratos/${id}/excel`, {
        responseType: 'blob'
    });
    return handleBlobDownload(response);
};

/**
 * Download PDF do contrato via Excel Template (NOVO - Conversor XLSX to PDF)
 * @param {string} id - ID do contrato
 * @returns {Promise<Object>} { blob, filename }
 */
export const downloadContrato_PDF_FromTemplate = async (id) => {
    const response = await apiClient.get(`/contratos/${id}/pdf-template`, {
        responseType: 'blob'
    });
    return handleBlobDownload(response);
};
