// src/components/ContratoTable/ContratoTable.jsx
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { formatDate } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { PERMISSIONS } from '../../auth/permissions';

function ContratoTable({
    contratos,
    onEditStatusClick,
    onDeleteClick,
    onGeneratePDF,
    onDownloadPDF,
    onDownloadExcel,
    onDownloadPDFTemplate,
    isDeleting,
    isGeneratingPDF,
    isDownloading,
    currentJobStatus,
    isPolling
}) {
    const [openDropdownId, setOpenDropdownId] = useState(null);
    const dropdownRef = useRef(null);
    const { hasPermission } = useAuth();
    const canManageContratos = hasPermission(PERMISSIONS.CONTRATOS_CREATE) || hasPermission(PERMISSIONS.CONTRATOS_APPROVE);

    // Fecha dropdown ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setOpenDropdownId(null);
            }
        };

        if (openDropdownId) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [openDropdownId]);

    const toggleDropdown = (contratoId) => {
        setOpenDropdownId(openDropdownId === contratoId ? null : contratoId);
    };

    const handleDownloadOption = (contrato, action) => {
        setOpenDropdownId(null);
        action(contrato);
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'ativo': return 'status-badge--ativo'; // Crie esta classe CSS
            case 'concluido': return 'status-badge--concluida';
            case 'cancelado': return 'status-badge--vencida'; // Reutiliza o estilo de 'vencida'
            case 'rascunho':
            default:
                return 'status-badge--em-andamento'; // Reutiliza o estilo de 'em-andamento'
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'ativo': return 'Ativo';
            case 'concluido': return 'Concluído';
            case 'cancelado': return 'Cancelado';
            case 'rascunho':
            default:
                return 'Rascunho';
        }
    };

    return contratos.map(contrato => {
        const isThisOneDeleting = isDeleting && isDeleting.contratoId === contrato._id;
        const isThisOneGeneratingPDF = isGeneratingPDF && isGeneratingPDF.contratoId === contrato._id;
        const isThisOneDownloading = isDownloading && isDownloading.contratoId === contrato._id;
        const disableActions = isThisOneDeleting || isThisOneGeneratingPDF || isThisOneDownloading;
        
        // Check if this contrato is the one being processed
        const isCurrentJob = currentJobStatus && currentJobStatus.contratoId === contrato._id;
        
        // Os campos 'clienteId' e 'pi' são populados seletivamente pelo backend
        const clienteNome = contrato.clienteId?.nome || 'Cliente Apagado';
        const piValor = contrato.pi?.valorTotal || 0;
        const piDataInicio = contrato.pi?.dataInicio ? formatDate(contrato.pi.dataInicio) : '-';
        const piDataFim = contrato.pi?.dataFim ? formatDate(contrato.pi.dataFim) : '-';

        const isDropdownOpen = openDropdownId === contrato._id;

        return (
            <tr key={contrato._id}>
                <td>{clienteNome}</td>
                <td>R$ {piValor.toFixed(2)}</td>
                <td>{piDataInicio}</td>
                <td>{piDataFim}</td>
                <td>
                    <span className={`status-badge ${getStatusClass(contrato.status)}`}>
                        {getStatusText(contrato.status)}
                    </span>
                </td>
                        <td>{formatDate(contrato.createdAt)}</td>
                        <td className="pis-page__actions">
                            {/* Dropdown para Downloads */}
                            <div 
                                className="action-dropdown" 
                                style={{ position: 'relative', display: 'inline-block' }}
                                ref={isDropdownOpen ? dropdownRef : null}
                            >
                                <button
                                    className="pis-page__action-button pis-page__action-button--download"
                                    title="Download"
                                    onClick={() => toggleDropdown(contrato._id)}
                                    disabled={disableActions}
                                >
                                    {isThisOneDownloading ? (
                                        <i className="fas fa-spinner fa-spin"></i>
                                    ) : (
                                        <>
                                            <i className="fas fa-download"></i>
                                            <i className="fas fa-caret-down" style={{ marginLeft: '4px', fontSize: '10px' }}></i>
                                        </>
                                    )}
                                </button>
                                
                                {isDropdownOpen && (
                                    <div className="dropdown-menu" style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: '0',
                                        backgroundColor: 'white',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                        zIndex: 1000,
                                        minWidth: '200px',
                                        marginTop: '4px'
                                    }}>
                                        <button
                                            className="dropdown-item"
                                            onClick={() => handleDownloadOption(contrato, onDownloadPDFTemplate)}
                                            style={{
                                                width: '100%',
                                                padding: '10px 15px',
                                                border: 'none',
                                                background: 'none',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                fontSize: '14px'
                                            }}
                                            onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                                            onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                                        >
                                            <i className="fas fa-file-pdf" style={{ marginRight: '8px', color: '#e74c3c' }}></i>
                                            PDF via Excel Template ⭐
                                        </button>
                                        <button
                                            className="dropdown-item"
                                            onClick={() => handleDownloadOption(contrato, onDownloadPDF)}
                                            style={{
                                                width: '100%',
                                                padding: '10px 15px',
                                                border: 'none',
                                                background: 'none',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                fontSize: '14px'
                                            }}
                                            onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                                            onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                                        >
                                            <i className="fas fa-file-pdf" style={{ marginRight: '8px', color: '#e74c3c' }}></i>
                                            PDF Nativo (rápido)
                                        </button>
                                        <button
                                            className="dropdown-item"
                                            onClick={() => handleDownloadOption(contrato, onDownloadExcel)}
                                            style={{
                                                width: '100%',
                                                padding: '10px 15px',
                                                border: 'none',
                                                background: 'none',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                fontSize: '14px'
                                            }}
                                            onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                                            onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                                        >
                                            <i className="fas fa-file-excel" style={{ marginRight: '8px', color: '#27ae60' }}></i>
                                            Excel (.xlsx)
                                        </button>
                                        <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }}></div>
                                        <button
                                            className="dropdown-item"
                                            onClick={() => handleDownloadOption(contrato, onGeneratePDF)}
                                            style={{
                                                width: '100%',
                                                padding: '10px 15px',
                                                border: 'none',
                                                background: 'none',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                fontSize: '14px'
                                            }}
                                            onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
                                            onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                                        >
                                            <i className="fas fa-paper-plane" style={{ marginRight: '8px', color: '#3498db' }}></i>
                                            Enviar PDF via WhatsApp
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            {/* Editar Status */}
                            {canManageContratos && <button
                                className="pis-page__action-button pis-page__action-button--edit"
                                title="Alterar Status"
                                onClick={() => onEditStatusClick(contrato)}
                                disabled={disableActions}
                            >
                                <i className="fas fa-pencil-alt"></i>
                            </button>}
                            {/* Apagar Contrato (se for rascunho) */}
                            {canManageContratos && contrato.status === 'rascunho' && (
                                <button
                                    className="pis-page__action-button pis-page__action-button--delete"
                                    title="Apagar Rascunho"
                                    onClick={() => onDeleteClick(contrato)}
                                    disabled={disableActions}
                                >
                                    {isThisOneDeleting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-trash"></i>}
                                </button>
                            )}
                        </td>
                    </tr>
                );
            });
}

ContratoTable.propTypes = {
    contratos: PropTypes.array.isRequired,
    onEditStatusClick: PropTypes.func.isRequired,
    onDeleteClick: PropTypes.func.isRequired,
    onGeneratePDF: PropTypes.func.isRequired,
    onDownloadPDF: PropTypes.func.isRequired,
    onDownloadExcel: PropTypes.func.isRequired,
    onDownloadPDFTemplate: PropTypes.func.isRequired,
    isDeleting: PropTypes.object,
    isGeneratingPDF: PropTypes.object,
    isDownloading: PropTypes.object,
    currentJobStatus: PropTypes.object,
    isPolling: PropTypes.bool,
};

export default ContratoTable;
