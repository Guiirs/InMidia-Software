// src/pages/Empresa/subpages/EmpresaApiKey.jsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchEmpresaData, regenerateApiKey } from '../../../services';
import { useToast } from '../../../components/ToastNotification/ToastNotification';
import Spinner from '../../../components/Spinner/Spinner';
import Modal from '../../../components/Modal/Modal';
import ApiKeyModal from '../../../components/ApiKeyModal/ApiKeyModal';
import { QUERY_KEYS } from '../../../constants/queryKeys';
// (O CSS já foi carregado pela página pai EmpresaSettingsPage.css)

function EmpresaApiKey() {
  // Estados locais para os modais
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');

  const showToast = useToast();
  const queryClient = useQueryClient();

  // --- RHF para o formulário do Modal de Confirmação ---
  const {
    register: registerConfirm,
    handleSubmit: handleConfirmSubmit,
    reset: resetConfirmForm,
    setError: setConfirmError,
    formState: { errors: confirmErrors },
  } = useForm({ mode: 'onBlur', defaultValues: { password_confirm: '' } });

  // --- useQuery para buscar dados da empresa (prefixo da chave) ---
  // Nota: Isto usará o cache do React Query se já foi buscado pela página EmpresaDetalhes
  const {
    data: empresaData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: QUERY_KEYS.empresa.apiKey,
    queryFn: fetchEmpresaData,
    staleTime: 1000 * 60 * 10,
  });

  // --- useMutation para regenerar a API Key ---
  const regenerateMutation = useMutation({
    mutationFn: (password) => regenerateApiKey(password),
    onSuccess: (response) => { // response = { fullApiKey, newApiKeyPrefix }
      showToast('API Key regenerada com sucesso!', 'success');
      setNewApiKey(response.fullApiKey);

      // Atualiza o cache do React Query com os dados parciais (novo prefixo)
      queryClient.setQueryData(QUERY_KEYS.empresa.apiKey, (oldData) => {
        if (!oldData) return undefined;
        return { ...oldData, api_key_prefix: response.newApiKeyPrefix };
      });

      handleCloseConfirmModal(); // Fecha modal de confirmação
      setIsApiKeyModalOpen(true);   // Abre modal para mostrar a chave
    },
    onError: (error) => {
      // Define erro no campo de senha do modal de confirmação
      setConfirmError('password_confirm', { type: 'api', message: error.message || 'Erro ao regenerar.' });
      showToast(error.message || 'Erro ao regenerar a chave.', 'error');
    }
  });

  const isRegenerating = regenerateMutation.isPending;

  // --- Handlers dos Modais ---
  const handleOpenConfirmModal = () => {
    resetConfirmForm({ password_confirm: '' });
    setIsConfirmModalOpen(true);
  };
  const handleCloseConfirmModal = () => setIsConfirmModalOpen(false);
  const handleCloseApiKeyModal = () => setIsApiKeyModalOpen(false);

  // Submissão do modal de confirmação (chama a mutação)
  const onConfirmSubmit = (data) => {
    regenerateMutation.mutate(data.password_confirm);
  };

  // --- Renderização ---
  if (isLoading) {
    return <Spinner message="A carregar gestão de API..." />;
  }

  if (isError) {
    return (
      <div className="empresa-settings-card">
        <p className="error-message">Erro ao carregar dados: {error.message}</p>
      </div>
    );
  }

  return (
    <>
      {/* Card API Key (Usa as classes CSS reutilizáveis) */}
      <div className="empresa-settings-card">
        <div className="empresa-settings-card__header">
          <i className="fas fa-key empresa-settings-card__icon" style={{ color: 'var(--accent-yellow)' }}></i>
          <h3 className="empresa-settings-card__title">Chave de API (Apenas Admin)</h3>
        </div>
        
        <p className="empresa-settings-card__info-label" style={{ fontSize: '1.4rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          Esta chave permite que aplicações externas (como o seu site público) acedam
          a dados específicos da sua empresa, como a lista de placas disponíveis
          (através da rota `/api/v1/public/placas/disponiveis`).
        </p>

        <div className="empresa-settings-card__info-group">
          <span className="empresa-settings-card__info-label">Prefixo da Chave (Segredo oculto)</span>
          <p className="empresa-settings-card__info-value" title="A chave completa só é exibida ao regenerar.">
            {empresaData?.api_key_prefix
              ? `${empresaData.api_key_prefix}_******************`
              : 'Nenhuma chave gerada.'}
          </p>
        </div>
        <div className="empresa-settings-card__actions">
          <button
            className="empresa-settings-card__button--regenerate"
            onClick={handleOpenConfirmModal}
            disabled={isRegenerating}
          >
            <i className="fas fa-sync-alt"></i> Regenerar Chave de API
          </button>
        </div>
      </div>

      {/* Modal de Confirmação de Senha */}
      <Modal
        title="Confirmar Regeneração de API Key"
        isOpen={isConfirmModalOpen}
        onClose={handleCloseConfirmModal}
      >
        <form onSubmit={handleConfirmSubmit(onConfirmSubmit)} className="modal-form" noValidate>
            <p style={{ fontSize: '1.4rem', color: 'var(--text-color-light)', marginTop: 0, lineHeight: 1.6 }}>
              Insira a sua senha atual para confirmar. A chave antiga deixará de funcionar imediatamente.
            </p>
            <div className="modal-form__input-group modal-form__input-group--full">
                <label htmlFor="password_confirm">Sua Senha Atual</label>
                <input
                    type="password"
                    id="password_confirm"
                    className={`modal-form__input ${confirmErrors.password_confirm ? 'input-error' : ''}`}
                    autoComplete="current-password"
                    {...registerConfirm('password_confirm', { required: 'A senha é obrigatória.' })}
                    disabled={isRegenerating}
                />
                {confirmErrors.password_confirm && <div className="modal-form__error-message">{confirmErrors.password_confirm.message}</div>}
            </div>
            <div className="modal-form__actions">
                <button type="button" className="modal-form__button modal-form__button--cancel" onClick={handleCloseConfirmModal} disabled={isRegenerating}>
                    Cancelar
                </button>
                <button type="submit" className="modal-form__button modal-form__button--confirm" disabled={isRegenerating}>
                    {isRegenerating ? 'A regenerar...' : 'Confirmar e Regenerar'}
                </button>
            </div>
        </form>
      </Modal>

      {/* Modal para Mostrar Nova API Key */}
      <ApiKeyModal
        apiKey={newApiKey}
        isOpen={isApiKeyModalOpen}
        onClose={handleCloseApiKeyModal}
      />
    </>
  );
}

export default EmpresaApiKey;