// src/pages/PIs/PIsPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    createPI, deletePI, fetchPIs, updatePI,
    approvePI, rejectPI, cancelPI, generateContractFromPI,
    queuePDFJob, downloadPI_PDF, downloadPI_Excel,
} from '../../services';
import { useToast } from '../../components/ToastNotification/ToastNotification';
import { useConfirmation } from '../../context/ConfirmationContext';
import { useJobStatus } from '../../hooks/useJobStatus';

import Modal from '../../components/Modal/Modal';
import { PIsTable } from '../../components/PITable/PITable';
import PIModalForm from '../../components/PIModalForm/PIModalForm';
import EntityActivityTimeline from '../../components/EntityActivityTimeline/EntityActivityTimeline';
import Spinner from '../../components/Spinner/Spinner';

import './PIs.css';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const pisQueryKey = 'pis';

function PIsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPI, setEditingPI] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [currentJobId, setCurrentJobId] = useState(null);
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [downloadingPIId, setDownloadingPIId] = useState(null);
    const [filters, setFilters] = useState({
        status: '',
        clienteId: '',
        sortBy: 'createdAt',
        order: 'desc',
    });

    const showToast = useToast();
    const showConfirmation = useConfirmation();
    const queryClient = useQueryClient();

    // --- Data Fetching ---
    const { data: piData, isLoading, isError, error } = useQuery({
        queryKey: [pisQueryKey, currentPage, filters],
        queryFn: () => {
            const params = new URLSearchParams({ page: currentPage, limit: 10, ...filters });
            if (!filters.status) params.delete('status');
            if (!filters.clienteId) params.delete('clienteId');
            return fetchPIs(params);
        },
        placeholderData: (prev) => prev,
        staleTime: 1000 * 60,
    });

    const pis = piData?.data || [];
    const pagination = piData?.pagination || { currentPage: 1, totalPages: 1 };

    // --- Helpers ---
    const invalidatePIs = () =>
        queryClient.invalidateQueries({ queryKey: [pisQueryKey], exact: false, refetchType: 'all' });

    const handleApiError = (error, setErrorFn) => {
        const apiErrors = error.response?.data?.errors;
        if (apiErrors && setErrorFn) {
            Object.keys(apiErrors).forEach((field) =>
                setErrorFn(field, { type: 'api', message: apiErrors[field] })
            );
        }
        // Friendly message for temporal conflicts
        if (error.response?.status === 409) {
            showToast('Conflito de reserva: as placas desta PI não estão disponíveis para este período.', 'error');
        } else {
            showToast(error.response?.data?.message || error.message || 'Ocorreu um erro', 'error');
        }
    };

    // --- CRUD Mutations ---
    const createPIMutation = useMutation({
        mutationFn: createPI,
        onSuccess: async () => {
            showToast('Proposta criada com sucesso!', 'success');
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: [pisQueryKey], exact: false, refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: ['placasDisponiveis'], exact: false, refetchType: 'all' }),
                queryClient.invalidateQueries({ queryKey: ['placas'], exact: false, refetchType: 'all' }),
                queryClient.refetchQueries({ queryKey: ['placasDisponiveis'], exact: false, type: 'all' }),
            ]);
            closeModal();
        },
        onError: (error, vars) => handleApiError(error, vars.setModalError),
    });

    const updatePIMutation = useMutation({
        mutationFn: (vars) => updatePI(vars.id, vars.data),
        onSuccess: () => {
            showToast('Proposta atualizada com sucesso!', 'success');
            closeModal();
            queryClient.invalidateQueries({ queryKey: [pisQueryKey], exact: false });
            queryClient.invalidateQueries({ queryKey: ['placasDisponiveis'], exact: false, refetchType: 'all' });
            queryClient.invalidateQueries({ queryKey: ['placas'], exact: false });
        },
        onError: (error, vars) => handleApiError(error, vars.setModalError),
    });

    const deletePIMutation = useMutation({
        mutationFn: deletePI,
        onSuccess: () => {
            showToast('Proposta apagada com sucesso!', 'success');
            queryClient.invalidateQueries({ queryKey: [pisQueryKey], exact: false });
            queryClient.invalidateQueries({ queryKey: ['placasDisponiveis'], exact: false, refetchType: 'all' });
            queryClient.invalidateQueries({ queryKey: ['placas'], exact: false });
        },
        onError: (error) => showToast(error.message || 'Erro ao apagar proposta.', 'error'),
    });

    // --- PI Workflow Mutations ---
    const approvePIMutation = useMutation({
        mutationFn: (id) => approvePI(id),
        onSuccess: () => {
            showToast('PI aprovada com sucesso!', 'success');
            invalidatePIs();
        },
        onError: (error) => handleApiError(error),
        onSettled: () => setActionLoadingId(null),
    });

    const rejectPIMutation = useMutation({
        mutationFn: (id) => rejectPI(id),
        onSuccess: () => {
            showToast('PI rejeitada.', 'success');
            invalidatePIs();
        },
        onError: (error) => handleApiError(error),
        onSettled: () => setActionLoadingId(null),
    });

    const cancelPIMutation = useMutation({
        mutationFn: (id) => cancelPI(id),
        onSuccess: () => {
            showToast('PI cancelada.', 'success');
            invalidatePIs();
        },
        onError: (error) => handleApiError(error),
        onSettled: () => setActionLoadingId(null),
    });

    const generateContractMutation = useMutation({
        mutationFn: (id) => generateContractFromPI(id),
        onSuccess: () => {
            showToast('Contrato gerado com sucesso!', 'success');
            invalidatePIs();
            queryClient.invalidateQueries({ queryKey: ['contratos'], exact: false });
        },
        onError: (error) => handleApiError(error),
        onSettled: () => setActionLoadingId(null),
    });

    // --- Job status monitoring ---
    const { jobStatus, isPolling } = useJobStatus(currentJobId, {
        onComplete: () => {
            showToast('PDF da PI enviado via WhatsApp!', 'success');
            setCurrentJobId(null);
        },
        onError: (error) => {
            showToast(`Erro na geração do PDF: ${error}`, 'error');
            setCurrentJobId(null);
        },
    });

    const generatePDFMutation = useMutation({
        mutationFn: (piId) => queuePDFJob(piId, 'pi'),
        onSuccess: (data) => {
            setCurrentJobId(data.jobId);
            showToast('PDF da PI está sendo gerado e será enviado via WhatsApp...', 'info');
        },
        onError: (error) => showToast(error.message || 'Erro ao iniciar geração do PDF.', 'error'),
    });

    // --- Modal Handlers ---
    const openAddModal = () => { setEditingPI(null); setIsModalOpen(true); };
    const openEditModal = (pi) => { setEditingPI(pi); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setEditingPI(null); };

    const onModalSubmit = (data, setModalError) => {
        const periodData = data.period || {};
        const startDate = periodData.startDate || data.dataInicio;
        const endDate   = periodData.endDate   || data.dataFim;

        if (!startDate || !endDate || new Date(endDate) < new Date(startDate)) {
            if (setModalError) {
                setModalError('period', { type: 'manual', message: 'Data final deve ser após a data inicial.' });
            } else {
                showToast('Data final deve ser após a data inicial.', 'error');
            }
            return;
        }

        const piData = {
            clienteId: data.clienteId,
            descricao: data.descricao,
            valorTotal: Number(data.valorTotal),
            formaPagamento: data.formaPagamento,
            placas: data.placas,
            produto: data.produto,
            descricaoPeriodo: data.descricaoPeriodo,
            valorProducao: Number(data.valorProducao) || 0,
            // V4.1 period fields
            periodType: periodData.periodType,
            startDate: format(new Date(startDate + 'T00:00:00'), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
            endDate:   format(new Date(endDate   + 'T00:00:00'), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
            biWeekIds: periodData.biWeekIds || [],
            // Legacy compatibility
            dataInicio: format(new Date(startDate + 'T00:00:00'), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
            dataFim:    format(new Date(endDate   + 'T00:00:00'), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
            tipoPeriodo: periodData.periodType === 'bi-week' ? 'quinzenal' : 'customizado',
        };

        if (editingPI) {
            updatePIMutation.mutate({ id: editingPI._id, data: piData, setModalError });
        } else {
            createPIMutation.mutate({ ...piData, setModalError });
        }
    };

    // --- PI Action Handlers ---
    const onDeleteClick = async (pi) => {
        try {
            await showConfirmation({
                message: `Tem a certeza que deseja apagar a PI "${pi.descricao}"? Esta ação não pode ser revertida.`,
                title: 'Confirmar Exclusão',
                confirmButtonType: 'red',
            });
            deletePIMutation.mutate(pi._id);
        } catch { /* cancelled */ }
    };

    const onApproveClick = async (pi) => {
        try {
            await showConfirmation({
                message: `Aprovar a PI "${pi.descricao}"?`,
                title: 'Aprovar PI',
                confirmText: 'Aprovar',
            });
            setActionLoadingId(pi._id);
            approvePIMutation.mutate(pi._id);
        } catch { /* cancelled */ }
    };

    const onRejectClick = async (pi) => {
        try {
            await showConfirmation({
                message: `Rejeitar a PI "${pi.descricao}"? As reservas temporais serão canceladas.`,
                title: 'Rejeitar PI',
                confirmButtonType: 'red',
                confirmText: 'Rejeitar',
            });
            setActionLoadingId(pi._id);
            rejectPIMutation.mutate(pi._id);
        } catch { /* cancelled */ }
    };

    const onCancelClick = async (pi) => {
        try {
            await showConfirmation({
                message: `Cancelar a PI "${pi.descricao}"? As reservas temporais serão canceladas.`,
                title: 'Cancelar PI',
                confirmButtonType: 'red',
                confirmText: 'Cancelar PI',
            });
            setActionLoadingId(pi._id);
            cancelPIMutation.mutate(pi._id);
        } catch { /* cancelled */ }
    };

    const onGenerateContractClick = async (pi) => {
        try {
            await showConfirmation({
                message: `Gerar um contrato a partir da PI "${pi.descricao}"? Esta ação não pode ser revertida.`,
                title: 'Confirmar Geração de Contrato',
                confirmText: 'Gerar Contrato',
            });
            setActionLoadingId(pi._id);
            generateContractMutation.mutate(pi._id);
        } catch { /* cancelled */ }
    };

    const onGeneratePDFClick = (piId) => generatePDFMutation.mutate(piId);

    // --- Download Handlers ---
    const handleDownloadPDF = async (piId) => {
        setDownloadingPIId(piId);
        try {
            const { blob, filename } = await downloadPI_PDF(piId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || `PI-${piId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showToast('PDF baixado com sucesso!', 'success');
        } catch (error) {
            showToast(error.message || 'Erro ao baixar PDF.', 'error');
        } finally {
            setDownloadingPIId(null);
        }
    };

    const handleDownloadExcel = async (piId) => {
        setDownloadingPIId(piId);
        try {
            const { blob, filename } = await downloadPI_Excel(piId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || `PI-${piId}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showToast('Excel baixado com sucesso!', 'success');
        } catch (error) {
            showToast(error.message || 'Erro ao baixar Excel.', 'error');
        } finally {
            setDownloadingPIId(null);
        }
    };

    const isMutating = createPIMutation.isPending || updatePIMutation.isPending;

    return (
        <div className="pis-page">
            <div className="pis-page__controls">
                <button className="pis-page__add-button" onClick={openAddModal}>
                    <i className="fas fa-plus"></i> Criar Nova PI
                </button>
            </div>

            {isLoading && <Spinner message="A carregar propostas..." />}
            {isError && <div className="error-message">Erro ao carregar propostas: {error.message}</div>}

            {!isLoading && !isError && (
                <div className="table-wrapper">
                    <table className="pis-page__table">
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th>Descrição</th>
                                <th>Cliente</th>
                                <th>Período</th>
                                <th>Valor</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <PIsTable
                            pis={pis}
                            onEdit={openEditModal}
                            onDelete={onDeleteClick}
                            onApprove={onApproveClick}
                            onReject={onRejectClick}
                            onCancel={onCancelClick}
                            onGenerateContractFromPI={onGenerateContractClick}
                            onGeneratePDF={onGeneratePDFClick}
                            onDownloadPDF={handleDownloadPDF}
                            onDownloadExcel={handleDownloadExcel}
                            downloadingPIId={downloadingPIId}
                            actionLoadingId={actionLoadingId}
                        />
                    </table>
                </div>
            )}

            <Modal
                title={editingPI ? 'Editar Proposta Interna (PI)' : 'Criar Nova Proposta Interna (PI)'}
                isOpen={isModalOpen}
                onClose={closeModal}
                isLarge={true}
            >
                <PIModalForm
                    onSubmit={onModalSubmit}
                    onClose={closeModal}
                    isSubmitting={isMutating}
                    initialData={editingPI || {}}
                />
                {editingPI?._id && (
                    <EntityActivityTimeline
                        entityType="proposta_interna"
                        entityId={editingPI._id}
                        title="Atividades recentes"
                    />
                )}
            </Modal>
        </div>
    );
}

export default PIsPage;
