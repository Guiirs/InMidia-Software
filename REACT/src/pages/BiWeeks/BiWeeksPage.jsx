// pages/BiWeeks/BiWeeksPage.jsx
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useToast } from '../../components/ToastNotification/ToastNotification';
import { useConfirmation } from '../../context/ConfirmationContext';
import Spinner from '../../components/Spinner/Spinner';
import Modal from '../../components/Modal/Modal';
import BiWeeksGenerator from '../../components/BiWeeksGenerator/BiWeeksGenerator';
import {
    fetchBiWeeksCalendar,
    fetchAvailableYears,
    createBiWeek,
    updateBiWeek,
    deleteBiWeek,
    generateCalendar
} from '../../services/biWeekService';
import './BiWeeksPage.css';

const biWeeksQueryKey = ['biWeeks'];

function BiWeeksPage() {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [showGenerator, setShowGenerator] = useState(false);
    const [editingBiWeek, setEditingBiWeek] = useState(null);
    const [generateYearInput, setGenerateYearInput] = useState(new Date().getFullYear() + 1);
    const [overwrite, setOverwrite] = useState(false);
    
    const showToast = useToast();
    const showConfirmation = useConfirmation();
    const queryClient = useQueryClient();

    const {
        register,
        handleSubmit,
        reset,
        setError,
        formState: { errors: formErrors }
    } = useForm({
        mode: 'onBlur',
        defaultValues: {
            bi_week_id: '',
            ano: new Date().getFullYear(),
            numero: 1,
            start_date: '',
            end_date: '',
            descricao: '',
            ativo: true
        }
    });

    useEffect(() => {
        if (isModalOpen) {
            reset(editingBiWeek || {
                bi_week_id: '',
                ano: selectedYear,
                numero: 1,
                start_date: '',
                end_date: '',
                descricao: '',
                ativo: true
            });
        }
    }, [isModalOpen, editingBiWeek, reset, selectedYear]);

    const { data: biWeeksData, isLoading, isError, error } = useQuery({
        queryKey: [...biWeeksQueryKey, selectedYear],
        queryFn: () => fetchBiWeeksCalendar({ ano: selectedYear }),
        select: (data) => data ?? [],
        placeholderData: [],
        staleTime: 5 * 60 * 1000
    });

    const biWeeks = biWeeksData || [];

    const { data: availableYears = [] } = useQuery({
        queryKey: ['biWeeksYears'],
        queryFn: fetchAvailableYears,
        staleTime: 10 * 60 * 1000
    });

    const handleApiError = (error) => {
        const apiErrors = error.response?.data?.errors;
        if (apiErrors) {
            Object.keys(apiErrors).forEach((fieldName) => {
                setError(fieldName, { type: 'api', message: apiErrors[fieldName] });
            });
        }
        showToast(error.response?.data?.message || error.message || 'Ocorreu um erro', 'error');
    };

    const createMutation = useMutation({
        mutationFn: createBiWeek,
        onSuccess: () => {
            showToast('Bi-Semana criada com sucesso!', 'success');
            closeModal();
            queryClient.invalidateQueries({ queryKey: biWeeksQueryKey });
        },
        onError: handleApiError
    });

    const updateMutation = useMutation({
        mutationFn: (vars) => updateBiWeek(vars.id, vars.data),
        onSuccess: () => {
            showToast('Bi-Semana atualizada com sucesso!', 'success');
            closeModal();
            queryClient.invalidateQueries({ queryKey: biWeeksQueryKey });
        },
        onError: handleApiError
    });

    const deleteMutation = useMutation({
        mutationFn: deleteBiWeek,
        onSuccess: () => {
            showToast('Bi-Semana excluída com sucesso!', 'success');
            queryClient.invalidateQueries({ queryKey: biWeeksQueryKey });
        },
        onError: (error) => {
            showToast(error.response?.data?.message || error.message || 'Erro ao excluir', 'error');
        }
    });

    const generateMutation = useMutation({
        mutationFn: generateCalendar,
        onSuccess: () => {
            showToast('Calendário gerado com sucesso!', 'success');
            closeGenerateModal();
            queryClient.invalidateQueries({ queryKey: biWeeksQueryKey });
            setSelectedYear(generateYearInput);
        },
        onError: (error) => {
            showToast(error.response?.data?.message || error.message || 'Erro ao gerar calendário', 'error');
        }
    });

    const openModal = () => setIsModalOpen(true);
    const closeModal = () => {
        setIsModalOpen(false);
        setEditingBiWeek(null);
    };

    const openGenerateModal = () => setIsGenerateModalOpen(true);
    const closeGenerateModal = () => {
        setIsGenerateModalOpen(false);
        setOverwrite(false);
    };

    const handleCreate = () => {
        setEditingBiWeek(null);
        openModal();
    };

    const handleEdit = (biWeek) => {
        setEditingBiWeek({
            ...biWeek,
            start_date: biWeek.start_date?.split('T')[0] || '',
            end_date: biWeek.end_date?.split('T')[0] || ''
        });
        openModal();
    };

    const handleDelete = (biWeek) => {
        showConfirmation({
            title: 'Confirmar Exclusão',
            message: `Deseja realmente excluir a Bi-Semana ${biWeek.bi_week_id}?`,
            onConfirm: () => deleteMutation.mutate(biWeek.id)
        });
    };

    const onSubmit = (data) => {
        if (editingBiWeek) {
            updateMutation.mutate({ id: editingBiWeek.id, data });
        } else {
            createMutation.mutate(data);
        }
    };

    const handleGenerate = () => {
        generateMutation.mutate({ ano: generateYearInput, overwrite });
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    };

    // Se estiver no modo gerador, mostra apenas o componente BiWeeksGenerator
    if (showGenerator) {
        return (
            <BiWeeksGenerator
                onBack={() => setShowGenerator(false)}
                initialYear={generateYearInput}
                onSuccess={(generatedYear) => {
                    setSelectedYear(generatedYear);
                }}
            />
        );
    }

    if (isLoading) {
        return (
            <div className="biweeks-page">
                <div className="biweeks-page__loading">
                    <Spinner />
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="biweeks-page">
                <div className="biweeks-page__error">
                    Erro ao carregar Bi-Semanas: {error?.message}
                </div>
            </div>
        );
    }

    return (
        <div className="biweeks-page">
            <div className="biweeks-page__header">
                <h1 className="biweeks-page__title">Calendário de Bi-Semanas</h1>
                <p className="biweeks-page__subtitle">
                    Gerencie os períodos de 14 dias (02, 04, 06... 52) para campanhas outdoor
                </p>
            </div>

            <div className="biweeks-page__controls">
                <div className="biweeks-page__filters">
                    <select
                        className="biweeks-page__filter-select"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                    >
                        {availableYears.length > 0 ? (
                            availableYears.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))
                        ) : (
                            <option value={selectedYear}>{selectedYear}</option>
                        )}
                    </select>
                </div>

                <div className="biweeks-page__actions">
                    <button
                        className="biweeks-page__button biweeks-page__button--secondary"
                        onClick={() => setShowGenerator(true)}
                    >
                        <i className="fas fa-calendar-plus"></i>
                        Gerar Calendário Completo
                    </button>
                    <button
                        className="biweeks-page__button biweeks-page__button--secondary"
                        onClick={openGenerateModal}
                    >
                        <i className="fas fa-magic"></i>
                        Gerar Rápido
                    </button>
                    <button
                        className="biweeks-page__button"
                        onClick={handleCreate}
                    >
                        <i className="fas fa-plus"></i>
                        Nova Bi-Semana
                    </button>
                </div>
            </div>

            <div className="biweeks-page__table-wrapper">
                {biWeeks.length === 0 ? (
                    <div className="biweeks-page__empty">
                        Nenhuma Bi-Semana encontrada para {selectedYear}
                    </div>
                ) : (
                    <table className="biweeks-page__table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Número</th>
                                <th>Início</th>
                                <th>Término</th>
                                <th>Descrição</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {biWeeks.map((biWeek) => (
                                <tr key={biWeek.id}>
                                    <td>{biWeek.bi_week_id}</td>
                                    <td>{biWeek.numero}</td>
                                    <td>{formatDate(biWeek.start_date)}</td>
                                    <td>{formatDate(biWeek.end_date)}</td>
                                    <td>{biWeek.descricao || '-'}</td>
                                    <td>
                                        <span className={`biweeks-page__status-badge ${biWeek.ativo ? 'biweeks-page__status-badge--active' : 'biweeks-page__status-badge--inactive'}`}>
                                            <span className="biweeks-page__status-dot"></span>
                                            {biWeek.ativo ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="biweeks-page__table-actions">
                                            <button
                                                className="biweeks-page__action-button biweeks-page__action-button--edit"
                                                onClick={() => handleEdit(biWeek)}
                                                title="Editar"
                                            >
                                                <i className="fas fa-edit"></i>
                                            </button>
                                            <button
                                                className="biweeks-page__action-button biweeks-page__action-button--delete"
                                                onClick={() => handleDelete(biWeek)}
                                                title="Excluir"
                                            >
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal de Criar/Editar */}
            <Modal isOpen={isModalOpen} onClose={closeModal} title={editingBiWeek ? 'Editar Bi-Semana' : 'Nova Bi-Semana'}>
                <form onSubmit={handleSubmit(onSubmit)} className="modal-form">
                    <div className="modal-form__field">
                        <label htmlFor="bi_week_id">ID da Bi-Semana *</label>
                        <input
                            type="text"
                            id="bi_week_id"
                            placeholder="Ex: 2026-01"
                            {...register('bi_week_id', { required: 'ID é obrigatório', pattern: { value: /^\d{4}-\d{2}$/, message: 'Formato inválido (use YYYY-NN)' } })}
                            className={formErrors.bi_week_id ? 'input-error' : ''}
                        />
                        {formErrors.bi_week_id && <span className="modal-form__error-message">{formErrors.bi_week_id.message}</span>}
                    </div>

                    <div className="modal-form__row">
                        <div className="modal-form__field">
                            <label htmlFor="ano">Ano *</label>
                            <input
                                type="number"
                                id="ano"
                                min="2020"
                                max="2100"
                                {...register('ano', { required: 'Ano é obrigatório', min: { value: 2020, message: 'Ano mínimo: 2020' }, max: { value: 2100, message: 'Ano máximo: 2100' } })}
                                className={formErrors.ano ? 'input-error' : ''}
                            />
                            {formErrors.ano && <span className="modal-form__error-message">{formErrors.ano.message}</span>}
                        </div>

                        <div className="modal-form__field">
                            <label htmlFor="numero">Número *</label>
                            <input
                                type="number"
                                id="numero"
                                min="1"
                                max="26"
                                {...register('numero', { required: 'Número é obrigatório', min: { value: 1, message: 'Mínimo: 1' }, max: { value: 26, message: 'Máximo: 26' } })}
                                className={formErrors.numero ? 'input-error' : ''}
                            />
                            {formErrors.numero && <span className="modal-form__error-message">{formErrors.numero.message}</span>}
                        </div>
                    </div>

                    <div className="modal-form__row">
                        <div className="modal-form__field">
                            <label htmlFor="start_date">Data de Início *</label>
                            <input
                                type="date"
                                id="start_date"
                                {...register('start_date', { required: 'Data de início é obrigatória' })}
                                className={formErrors.start_date ? 'input-error' : ''}
                            />
                            {formErrors.start_date && <span className="modal-form__error-message">{formErrors.start_date.message}</span>}
                        </div>

                        <div className="modal-form__field">
                            <label htmlFor="end_date">Data de Término *</label>
                            <input
                                type="date"
                                id="end_date"
                                {...register('end_date', { required: 'Data de término é obrigatória' })}
                                className={formErrors.end_date ? 'input-error' : ''}
                            />
                            {formErrors.end_date && <span className="modal-form__error-message">{formErrors.end_date.message}</span>}
                        </div>
                    </div>

                    <div className="modal-form__field">
                        <label htmlFor="descricao">Descrição</label>
                        <textarea
                            id="descricao"
                            rows="3"
                            placeholder="Descrição opcional"
                            {...register('descricao', { maxLength: { value: 200, message: 'Máximo 200 caracteres' } })}
                            className={formErrors.descricao ? 'input-error' : ''}
                        />
                        {formErrors.descricao && <span className="modal-form__error-message">{formErrors.descricao.message}</span>}
                    </div>

                    <div className="modal-form__field">
                        <label className="modal-form__checkbox-label">
                            <input
                                type="checkbox"
                                {...register('ativo')}
                            />
                            Ativo
                        </label>
                    </div>

                    <div className="modal-form__actions">
                        <button type="button" onClick={closeModal} className="modal-form__button modal-form__button--secondary">
                            Cancelar
                        </button>
                        <button type="submit" className="modal-form__button modal-form__button--primary" disabled={createMutation.isPending || updateMutation.isPending}>
                            {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : editingBiWeek ? 'Atualizar' : 'Criar'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal de Gerar Calendário */}
            <Modal isOpen={isGenerateModalOpen} onClose={closeGenerateModal} title="Gerar Calendário">
                <div className="modal-form">
                    <div className="modal-form__field">
                        <label htmlFor="generateYear">Ano</label>
                        <input
                            type="number"
                            id="generateYear"
                            min="2020"
                            max="2100"
                            value={generateYearInput}
                            onChange={(e) => setGenerateYearInput(Number(e.target.value))}
                        />
                    </div>

                    <div className="modal-form__field">
                        <label className="modal-form__checkbox-label">
                            <input
                                type="checkbox"
                                checked={overwrite}
                                onChange={(e) => setOverwrite(e.target.checked)}
                            />
                            Sobrescrever Bi-Semanas existentes
                        </label>
                    </div>

                    <div className="modal-form__actions">
                        <button onClick={closeGenerateModal} className="modal-form__button modal-form__button--secondary">
                            Cancelar
                        </button>
                        <button onClick={handleGenerate} className="modal-form__button modal-form__button--primary" disabled={generateMutation.isPending}>
                            {generateMutation.isPending ? 'Gerando...' : 'Gerar'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

export default BiWeeksPage;
