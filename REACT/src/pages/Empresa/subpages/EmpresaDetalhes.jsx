// src/pages/Empresa/subpages/EmpresaDetalhes.jsx
import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { getEmpresaDetails, updateEmpresaDetails } from '../../../services';
import { useToast } from '../../../components/ToastNotification/ToastNotification';
import Spinner from '../../../components/Spinner/Spinner';
import { QUERY_KEYS } from '../../../constants/queryKeys';
import '../EmpresaSettings.css'; // O CSS importado está correto

function EmpresaDetalhes() {
    const showToast = useToast();
    const queryClient = useQueryClient();

    // --- Query para buscar dados da empresa ---
    const { data: empresaData, isLoading: isLoadingEmpresa, isError, error } = useQuery({
        queryKey: QUERY_KEYS.empresa.details,
        queryFn: getEmpresaDetails
    });

    // --- Formulário ---
    const { 
        register, 
        handleSubmit, 
        reset, 
        setError, 
        formState: { errors, isDirty } 
    } = useForm({
        defaultValues: {
            nome: '',
            cnpj: '',
            endereco: '', 
            bairro: '',   
            cidade: '',   
            telefone: ''  
        }
    });

    // Carregar dados no form quando a query retornar
    useEffect(() => {
        if (empresaData) {
            reset({
                nome: empresaData.nome || '',
                cnpj: empresaData.cnpj || '',
                endereco: empresaData.endereco || '', 
                bairro: empresaData.bairro || '',   
                cidade: empresaData.cidade || '',   
                telefone: empresaData.telefone || ''  
            });
        }
    }, [empresaData, reset]);

    // --- Mutação para atualizar ---
    const updateEmpresaMutation = useMutation({
        mutationFn: updateEmpresaDetails,
        onSuccess: (data) => {
            queryClient.setQueryData(QUERY_KEYS.empresa.details, data); // Atualiza o cache
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.empresa.details });
            reset(data); // Reseta o form com os novos dados
            showToast('Dados da empresa atualizados com sucesso!', 'success');
        },
        onError: (error) => {
            const apiErrors = error.response?.data?.errors;
            if (apiErrors) {
                Object.keys(apiErrors).forEach((fieldName) => {
                    setError(fieldName, { type: 'api', message: apiErrors[fieldName] });
                });
            }
            showToast(error.message || 'Erro ao atualizar dados.', 'error');
        }
    });

    const onFormSubmit = (data) => {
        updateEmpresaMutation.mutate(data);
    };
    
    const isSubmitting = updateEmpresaMutation.isPending;

    // --- Renderização ---
    if (isLoadingEmpresa) {
        return <Spinner message="A carregar dados da empresa..." />;
    }

    if (isError) {
        return <div className="text-center error-message">Erro ao carregar dados: {error.message}</div>;
    }

    return (
        // --- CORREÇÃO: Renomeado de 'settings-card' para 'empresa-settings-card' ---
        <form className="empresa-settings-card" onSubmit={handleSubmit(onFormSubmit)} noValidate>
            <div className="empresa-settings-card__header">
                <h3>Detalhes da Empresa</h3>
                <p>Informações principais da sua empresa que aparecerão em relatórios e contratos.</p>
            </div>
            
            <div className="empresa-settings-card__content">
                {/* Nome */}
                <div className="empresa-settings-card__input-group">
                    <label htmlFor="nome">Nome / Razão Social</label>
                    <input
                        type="text"
                        id="nome"
                        className={`modal-form__input ${errors.nome ? 'input-error' : ''}`}
                        {...register('nome', { required: 'O nome é obrigatório.' })}
                        disabled={isSubmitting}
                    />
                    {errors.nome && <div className="modal-form__error-message">{errors.nome.message}</div>}
                </div>
                
                {/* CNPJ */}
                <div className="empresa-settings-card__input-group">
                    <label htmlFor="cnpj">CNPJ</label>
                    <input
                        type="text"
                        id="cnpj"
                        className={`modal-form__input ${errors.cnpj ? 'input-error' : ''}`}
                        {...register('cnpj', { required: 'O CNPJ é obrigatório.' })}
                        disabled={isSubmitting}
                    />
                    {errors.cnpj && <div className="modal-form__error-message">{errors.cnpj.message}</div>}
                </div>
                
                {/* Endereço */}
                <div className="empresa-settings-card__input-group">
                    <label htmlFor="endereco">Endereço</label>
                    <input
                        type="text"
                        id="endereco"
                        className={`modal-form__input ${errors.endereco ? 'input-error' : ''}`}
                        {...register('endereco')}
                        disabled={isSubmitting}
                    />
                </div>
                
                {/* Bairro */}
                <div className="empresa-settings-card__input-group">
                    <label htmlFor="bairro">Bairro</label>
                    <input
                        type="text"
                        id="bairro"
                        className={`modal-form__input ${errors.bairro ? 'input-error' : ''}`}
                        {...register('bairro')}
                        disabled={isSubmitting}
                    />
                </div>
                
                {/* Cidade */}
                <div className="empresa-settings-card__input-group">
                    <label htmlFor="cidade">Cidade</label>
                    <input
                        type="text"
                        id="cidade"
                        className={`modal-form__input ${errors.cidade ? 'input-error' : ''}`}
                        {...register('cidade')}
                        disabled={isSubmitting}
                    />
                </div>
                
                {/* Telefone */}
                <div className="empresa-settings-card__input-group">
                    <label htmlFor="telefone">Telefone</label>
                    <input
                        type="tel"
                        id="telefone"
                        className={`modal-form__input ${errors.telefone ? 'input-error' : ''}`}
                        {...register('telefone')}
                        disabled={isSubmitting}
                    />
                </div>

            </div>
            
            <div className="empresa-settings-card__actions">
                <button 
                    type="submit" 
                    className="modal-form__button modal-form__button--confirm"
                    disabled={isSubmitting || !isDirty}
                >
                    {isSubmitting ? 'A guardar...' : 'Guardar Alterações'}
                </button>
            </div>
        </form>
    );
}

export default EmpresaDetalhes;