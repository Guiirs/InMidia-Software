// src/components/PITable/PITable.jsx
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../context/AuthContext';
import { PERMISSIONS } from '../../auth/permissions';
import { useToast } from '../ToastNotification/ToastNotification';
import { queuePDFJob } from '../../services';
import Spinner from '../Spinner/Spinner';
import { getPIStatusMeta } from '../../utils/piStatusMeta';

// Statuses that allow Aprovar / Rejeitar
const APPROVABLE  = new Set(['DRAFT', 'PENDING_APPROVAL']);
// Statuses that allow Cancelar
const CANCELLABLE = new Set(['APPROVED', 'DRAFT', 'PENDING_APPROVAL', 'em_andamento']);
// Status that allows Gerar Contrato
const CONTRACTABLE = 'APPROVED';
// Statuses where no workflow actions are shown at all
const TERMINAL = new Set(['CANCELLED', 'REJECTED', 'CONTRACT_GENERATED', 'concluida']);

export function PIsTable({
    pis,
    onEdit,
    onDelete,
    onApprove,
    onReject,
    onCancel,
    onGenerateContractFromPI,
    onGeneratePDF,
    onDownloadPDF,
    onDownloadExcel,
    downloadingPIId,
    actionLoadingId,
}) {
    const showToast = useToast();
    const { hasPermission } = useAuth();
    const canManage = hasPermission(PERMISSIONS.PROPOSTAS_EDIT);

    const [generatingPDFId, setGeneratingPDFId] = useState(null);
    const [openDropdownId, setOpenDropdownId] = useState(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (!openDropdownId) return;
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpenDropdownId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openDropdownId]);

    const handleGeneratePDFClick = async (piId) => {
        setGeneratingPDFId(piId);
        try {
            if (onGeneratePDF) {
                await onGeneratePDF(piId);
            } else {
                await queuePDFJob(piId, 'pi');
                showToast('PDF da PI está sendo gerado e será enviado via WhatsApp...', 'info');
            }
        } catch (error) {
            showToast(error.message || 'Erro ao iniciar geração do PDF.', 'error');
        } finally {
            setGeneratingPDFId(null);
        }
    };

    const formatShortDate = (dateString) => {
        if (!dateString) return '—';
        try { return format(parseISO(dateString), 'dd/MM/yy', { locale: ptBR }); }
        catch { return '—'; }
    };

    const formatCurrency = (value) => {
        if (typeof value !== 'number') return 'R$ —';
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    if (!pis || pis.length === 0) {
        return (
            <tbody>
                <tr>
                    <td colSpan="6" className="table-no-data">
                        Nenhuma proposta interna (PI) encontrada.
                    </td>
                </tr>
            </tbody>
        );
    }

    return (
        <tbody>
            {pis.map((pi) => {
                const { label: statusLabel, cssClass: statusCss } = getPIStatusMeta(pi.status);
                const isTerminal        = TERMINAL.has(pi.status);
                const canApprove        = APPROVABLE.has(pi.status);
                const canReject         = APPROVABLE.has(pi.status);
                const canCancel         = CANCELLABLE.has(pi.status);
                const canContract       = pi.status === CONTRACTABLE;

                const isThisLoading     = actionLoadingId === pi._id;
                const isThisDLing       = downloadingPIId === pi._id;
                const isThisPDFing      = generatingPDFId === pi._id;
                const isDisabled        = isThisLoading || isThisDLing || isThisPDFing;

                const isDropdownOpen    = openDropdownId === pi._id;

                // Period display: prefer V4.1 fields, fall back to legacy
                const periodStart = pi.startDate || pi.dataInicio;
                const periodEnd   = pi.endDate   || pi.dataFim;

                return (
                    <tr key={pi._id} className={pi.status === 'vencida' ? 'pi-vencida' : ''}>
                        {/* Status badge */}
                        <td>
                            <span className={`pi-status-badge pi-status-badge--${statusCss}`}>
                                {statusLabel}
                            </span>
                        </td>

                        <td data-label="Descrição">{pi.descricao}</td>
                        <td data-label="Cliente">{pi.clienteId?.nome || 'Cliente não encontrado'}</td>
                        <td data-label="Período">
                            {formatShortDate(periodStart)} — {formatShortDate(periodEnd)}
                        </td>
                        <td data-label="Valor">{formatCurrency(pi.valorTotal)}</td>

                        {/* Actions */}
                        <td data-label="Ações" className="table-actions">

                            {/* ── Workflow actions (only when user can manage + not terminal) ── */}
                            {canManage && !isTerminal && (
                                <>
                                    {canApprove && (
                                        <button
                                            className="pi-action-btn pi-action-btn--approve"
                                            title="Aprovar PI"
                                            onClick={() => onApprove(pi)}
                                            disabled={isDisabled}
                                        >
                                            {isThisLoading ? <Spinner mini /> : 'Aprovar'}
                                        </button>
                                    )}

                                    {canReject && (
                                        <button
                                            className="pi-action-btn pi-action-btn--reject"
                                            title="Rejeitar PI"
                                            onClick={() => onReject(pi)}
                                            disabled={isDisabled}
                                        >
                                            Rejeitar
                                        </button>
                                    )}

                                    {canCancel && !canApprove && (
                                        // Cancelar shown for APPROVED (not overlapping with Aprovar/Rejeitar)
                                        <button
                                            className="pi-action-btn pi-action-btn--cancel"
                                            title="Cancelar PI"
                                            onClick={() => onCancel(pi)}
                                            disabled={isDisabled}
                                        >
                                            Cancelar
                                        </button>
                                    )}

                                    {canContract && (
                                        <button
                                            className="pi-action-btn pi-action-btn--contract"
                                            title="Gerar Contrato"
                                            onClick={() => onGenerateContractFromPI(pi)}
                                            disabled={isDisabled}
                                        >
                                            {isThisLoading ? <Spinner mini /> : 'Gerar contrato'}
                                        </button>
                                    )}
                                </>
                            )}

                            {/* ── Edit ── */}
                            {canManage && (
                                <button
                                    className="table-action-button"
                                    title="Editar PI"
                                    onClick={() => onEdit(pi)}
                                    disabled={isTerminal || isDisabled}
                                >
                                    <i className="fas fa-pencil-alt"></i>
                                </button>
                            )}

                            {/* ── Delete ── */}
                            {canManage && (
                                <button
                                    className="table-action-button action-delete"
                                    title="Apagar PI"
                                    onClick={() => onDelete(pi)}
                                    disabled={isDisabled}
                                >
                                    <i className="fas fa-trash"></i>
                                </button>
                            )}

                            {/* ── Download dropdown ── */}
                            <div
                                className="action-dropdown"
                                style={{ position: 'relative', display: 'inline-block' }}
                                ref={isDropdownOpen ? dropdownRef : null}
                            >
                                <button
                                    className="table-action-button"
                                    title="Download"
                                    onClick={() => setOpenDropdownId(isDropdownOpen ? null : pi._id)}
                                    disabled={isDisabled}
                                >
                                    {isThisDLing ? (
                                        <Spinner mini />
                                    ) : (
                                        <>
                                            <i className="fas fa-download"></i>
                                            <i className="fas fa-caret-down" style={{ marginLeft: '4px', fontSize: '10px' }}></i>
                                        </>
                                    )}
                                </button>

                                {isDropdownOpen && (
                                    <div className="dropdown-menu" style={{
                                        position: 'absolute', top: '100%', right: 0,
                                        backgroundColor: 'white', border: '1px solid #ddd',
                                        borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                        zIndex: 1000, minWidth: '200px', marginTop: '4px'
                                    }}>
                                        {[
                                            { icon: 'fa-file-excel', color: '#27ae60', label: 'Excel (.xlsx) ⭐', action: () => { setOpenDropdownId(null); onDownloadExcel(pi._id); } },
                                            { icon: 'fa-file-pdf',   color: '#e74c3c', label: 'PDF',            action: () => { setOpenDropdownId(null); onDownloadPDF(pi._id); } },
                                        ].map(({ icon, color, label, action }) => (
                                            <button key={label} onClick={action} style={{
                                                width: '100%', padding: '10px 15px', border: 'none',
                                                background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px'
                                            }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <i className={`fas ${icon}`} style={{ marginRight: '8px', color }}></i>
                                                {label}
                                            </button>
                                        ))}
                                        <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
                                        <button onClick={() => { setOpenDropdownId(null); handleGeneratePDFClick(pi._id); }} style={{
                                            width: '100%', padding: '10px 15px', border: 'none',
                                            background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '14px'
                                        }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            {isThisPDFing ? (
                                                <><Spinner mini /> Gerando...</>
                                            ) : (
                                                <><i className="fas fa-paper-plane" style={{ marginRight: '8px', color: '#3498db' }}></i>Enviar PDF via WhatsApp</>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </td>
                    </tr>
                );
            })}
        </tbody>
    );
}

PIsTable.propTypes = {
    pis:                      PropTypes.array.isRequired,
    onEdit:                   PropTypes.func.isRequired,
    onDelete:                 PropTypes.func.isRequired,
    onApprove:                PropTypes.func.isRequired,
    onReject:                 PropTypes.func.isRequired,
    onCancel:                 PropTypes.func.isRequired,
    onGenerateContractFromPI: PropTypes.func.isRequired,
    onGeneratePDF:            PropTypes.func,
    onDownloadPDF:            PropTypes.func.isRequired,
    onDownloadExcel:          PropTypes.func.isRequired,
    downloadingPIId:          PropTypes.string,
    actionLoadingId:          PropTypes.string,
};
