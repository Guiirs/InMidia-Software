// src/components/ContratoStatusModal/ContratoStatusModal.jsx
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useForm } from 'react-hook-form';

function ContratoStatusModal({ onSubmit, onClose, isSubmitting, initialData }) {
    
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors: modalErrors }
    } = useForm({
        defaultValues: {
            status: initialData?.status || 'rascunho'
        }
    });

    // Reseta o formulário se o contrato (initialData) mudar
    useEffect(() => {
        if (initialData) {
            reset({ status: initialData.status });
        }
    }, [initialData, reset]);

    const handleFormSubmit = (data) => {
        onSubmit(data);
    };

    return (
        <form id="contrato-status-form" className="modal-form" onSubmit={handleSubmit(handleFormSubmit)} noValidate>
            <div className="modal-form__grid">
                
                <div className="modal-form__input-group modal-form__input-group--full">
                    <label htmlFor="status">Novo Status do Contrato</label>
                    <select id="status"
                           className={`modal-form__input ${modalErrors.status ? 'input-error' : ''}`}
                           {...register('status', { required: 'O status é obrigatório.' })}
                           disabled={isSubmitting}>
                        
                        <option value="rascunho">Rascunho</option>
                        <option value="ativo">Ativo</option>
                        <option value="concluido">Concluído</option>
                        <option value="cancelado">Cancelado</option>
                    </select>
                    {modalErrors.status && <div className="modal-form__error-message">{modalErrors.status.message}</div>}
                </div>
            </div>

            <div className="modal-form__actions">
                <button type="button" className="modal-form__button modal-form__button--cancel" onClick={onClose} disabled={isSubmitting}>
                    Cancelar
                </button>
                <button type="submit" className="modal-form__button modal-form__button--confirm" disabled={isSubmitting}>
                    {isSubmitting ? 'A guardar...' : 'Guardar Status'}
                </button>
            </div>
        </form>
    );
}

ContratoStatusModal.propTypes = {
    onSubmit: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    isSubmitting: PropTypes.bool.isRequired,
    initialData: PropTypes.object,
};

export default ContratoStatusModal;