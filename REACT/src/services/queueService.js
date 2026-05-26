// src/services/queueService.js
/**
 * Queue Service
 * Handles PDF generation jobs and status polling
 */

import apiClient from './apiClient';

/**
 * Queue a PDF generation job
 * @param {string} entityId - ID of the entity (contrato or pi)
 * @param {string} entityType - Type of entity ('contrato' or 'pi')
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Job information with jobId
 */
export const queuePDFJob = async (entityId, entityType, options = {}) => {
    const endpoint = entityType === 'contrato' 
        ? `/queue/contratos/${entityId}/generate-pdf`
        : `/queue/pis/${entityId}/generate-pdf`;
    
    const response = await apiClient.post(endpoint, options);
    return response.data;
};

/**
 * Get job status
 * @param {string} jobId - Job ID to check
 * @returns {Promise<Object>} Job status information
 */
export const getJobStatus = async (jobId) => {
    const response = await apiClient.get(`/queue/jobs/${jobId}`);
    return response.data;
};

/**
 * Get queue statistics
 * @returns {Promise<Object>} Queue stats
 */
export const getQueueStats = async () => {
    const response = await apiClient.get('/queue/jobs');
    return response.data;
};
