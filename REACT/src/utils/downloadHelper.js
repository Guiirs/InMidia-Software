// src/utils/downloadHelper.js
/**
 * Helpers para tratamento de downloads (Blobs)
 * Centraliza a lógica de extração de filename e criação de Blob
 */

/**
 * Processa resposta de download e extrai blob + filename
 * @param {Object} response - Resposta do axios (responseType: 'blob')
 * @returns {Object} { blob, filename }
 */
export const handleBlobDownload = (response) => {
    const blob = response.data;
    
    // Extrai filename do Content-Disposition header
    let filename = 'download'; // Default sem extensão
    const contentDisposition = response.headers['content-disposition'];
    
    if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1].replace(/['"]/g, '');
        }
    }
    
    return { blob, filename };
};

/**
 * Trigger download no navegador
 * @param {Blob} blob - Blob do arquivo
 * @param {string} filename - Nome do arquivo
 */
export const triggerDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};
