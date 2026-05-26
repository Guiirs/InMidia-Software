// src/components/PIModalForm/Pages/Page1Cliente.jsx
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@tanstack/react-query';
import { fetchClientes } from '../../../services';

export default function Page1Cliente({ 
    register, 
    errors, 
    isSubmitting, 
    watchedClienteId, 
    setValue,
    watch
}) {
    
    // --- Lógica de Clientes (Específica desta Página) ---
    const { data: clientes = [], isLoading: isLoadingClientes } = useQuery({
        queryKey: ['clientes'], 
        queryFn: () => fetchClientes(new URLSearchParams({ limit: 1000 })), // Busca todos
        select: (data) => data.data ?? [],
        staleTime: 1000 * 60 * 10 // 10 min cache
    });

    // Efeito para auto-preencher campos quando o cliente muda
    // Correção: Só preenche se o campo estiver vazio (não sobrescreve input manual do usuário)
    useEffect(() => {
        if (watchedClienteId) {
            const clienteSelecionado = clientes.find(c => c._id === watchedClienteId);
            if (clienteSelecionado) {
                // Só preenche 'responsavel' se estiver vazio
                const currentResponsavel = watch('responsavel');
                if (!currentResponsavel || currentResponsavel.trim() === '') {
                    setValue('responsavel', clienteSelecionado.responsavel || '', { shouldValidate: false });
                }
                
                // Só preenche 'segmento' se estiver vazio
                const currentSegmento = watch('segmento');
                if (!currentSegmento || currentSegmento.trim() === '') {
                    setValue('segmento', clienteSelecionado.segmento || '', { shouldValidate: false });
                }
            }
        }
    }, [watchedClienteId, clientes, setValue, watch]);

    const isLoading = isSubmitting || isLoadingClientes;

    return (
        <>
            {/* Input Cliente (Dropdown) */}
            <div className="modal-form__input-group modal-form__input-group--full">
                <label htmlFor="clienteId">Cliente</label>
                <select
                    id="clienteId"
                    className={`modal-form__input ${errors.clienteId ? 'modal-form__input--error' : ''}`}
                    {...register('clienteId', { required: 'Selecione um cliente.' })}
                    disabled={isLoading}
                >
                    <option value="">{isLoadingClientes ? 'A carregar clientes...' : 'Selecione um cliente...'}</option>
                    {clientes.map(cliente => (
                        <option key={cliente._id} value={cliente._id}>{cliente.nome}</option>
                    ))}
                </select>
                {errors.clienteId && <div className="modal-form__error-message">{errors.clienteId.message}</div>}
            </div>

            {/* Input Descrição */}
            <div className="modal-form__input-group modal-form__input-group--full">
                <label htmlFor="descricao">Descrição (Ex: "Campanha Dia das Mães")</label>
                <input
                    type="text"
                    id="descricao"
                    placeholder="Descrição da Proposta"
                    className={`modal-form__input ${errors.descricao ? 'modal-form__input--error' : ''}`}
                    {...register('descricao', { required: 'A descrição é obrigatória.' })}
                    disabled={isLoading}
                />
                {errors.descricao && <div className="modal-form__error-message">{errors.descricao.message}</div>}
            </div>

            {/* Inputs Responsável e Segmento (Auto-preenchidos) */}
            <div className="modal-form__input-group">
                <label htmlFor="responsavel">Responsável (do Cliente)</label>
                <input
                    type="text"
                    id="responsavel"
                    className="modal-form__input"
                    {...register('responsavel')}
                    disabled
                    readOnly 
                />
            </div>
            <div className="modal-form__input-group">
                <label htmlFor="segmento">Segmento (do Cliente)</label>
                <input
                    type="text"
                    id="segmento"
                    className="modal-form__input"
                    {...register('segmento')}
                    disabled
                    readOnly
                />
            </div>
        </>
    );
}

Page1Cliente.propTypes = {
    register: PropTypes.func.isRequired,
    errors: PropTypes.object.isRequired,
    isSubmitting: PropTypes.bool.isRequired,
    watchedClienteId: PropTypes.string,
    setValue: PropTypes.func.isRequired,
    watch: PropTypes.func.isRequired,
};
