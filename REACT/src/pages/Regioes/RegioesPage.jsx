// src/pages/Regioes/RegioesPage.jsx (Refatorada com React Query)
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
// 1. Importar os hooks do React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Remover imports do dataCache (getRegioes, clearRegioesCache)
import { createRegiao, updateRegiao, deleteRegiao, fetchRegioes } from '../../services';
import Spinner from '../../components/Spinner/Spinner';
import Modal from '../../components/Modal/Modal';
import { useToast } from '../../components/ToastNotification/ToastNotification';
import { useConfirmation } from '../../context/ConfirmationContext';
import './Regioes.css';

function RegioesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRegiao, setEditingRegiao] = useState(null); 
  
  const showToast = useToast();
  const showConfirmation = useConfirmation();
  const queryClient = useQueryClient(); // 2. Obter o cliente Query

  // 3. Substituir useState(isLoading/error/regioes) e useEffect(loadRegioes)
  const { 
    data: regioes, // O React Query fornece os dados aqui
    isLoading,    // Estado de loading
    isError,      // Estado booleano de erro
    error         // O objeto de erro
  } = useQuery({
      queryKey: ['regioes'], // A chave única para este cache
      queryFn: fetchRegioes, // A função da API que busca os dados
      // Nenhuma dependência (como []) é necessária
  });

  // --- Configuração do Formulário RHF (inalterada) ---
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: modalErrors },
    // Removemos 'isSubmitting' do RHF, usaremos o 'isPending' da mutação
  } = useForm({ mode: 'onBlur', defaultValues: { nome: '' } });

  // --- 4. Configurar Mutações (Create, Update, Delete) ---

  // Mutação para Criar Região
  const createMutation = useMutation({
    mutationFn: createRegiao, // Função da API (recebe { nome })
    onSuccess: (data) => { // 'data' é o retorno da API
      showToast('Região criada com sucesso!', 'success');
      // Invalida o cache ['regioes'], forçando o useQuery a buscar novamente
      queryClient.invalidateQueries({ queryKey: ['regioes'] });
      handleCloseModal();
    },
    onError: (error) => {
      showToast(error.message || 'Erro ao criar região.', 'error');
    }
  });

  // Mutação para Atualizar Região
  const updateMutation = useMutation({
    mutationFn: (variables) => updateRegiao(variables.id, variables.data), // (recebe { id, data })
    onSuccess: (data) => {
      showToast('Região atualizada com sucesso!', 'success');
      queryClient.invalidateQueries({ queryKey: ['regioes'] });
      handleCloseModal();
    },
    onError: (error) => {
      showToast(error.message || 'Erro ao atualizar região.', 'error');
    }
  });

  // Mutação para Apagar Região
  const deleteMutation = useMutation({
    mutationFn: deleteRegiao, // (recebe id)
    onSuccess: () => {
      showToast('Região apagada com sucesso!', 'success');
      queryClient.invalidateQueries({ queryKey: ['regioes'] });
    },
    onError: (error) => {
      showToast(error.message || 'Erro ao apagar região.', 'error');
    }
  });

  // Combina estados de 'pending' (carregando) das mutações
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // --- Funções do Modal (adaptadas para mutações) ---
  const handleAddClick = () => {
    setEditingRegiao(null);
    reset({ nome: '' });
    setIsModalOpen(true);
  };

  const handleEditClick = (regiao) => {
    setEditingRegiao(regiao);
    reset({ nome: regiao.nome });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRegiao(null);
    reset({ nome: '' });
  };
   
  // Submissão do formulário agora chama a mutação apropriada
  const onModalSubmit = (data) => {
    const nome = data.nome.trim();

    if (editingRegiao && nome === editingRegiao.nome) {
      handleCloseModal();
      return;
    }

    if (editingRegiao) {
      updateMutation.mutate({ id: editingRegiao._id, data: { nome } });
    } else {
      createMutation.mutate({ nome });
    }
  };
  
  // Função de exclusão agora chama a mutação
  const handleDeleteClick = async (regiao) => {
     try {
         await showConfirmation({
             message: `Tem a certeza de que deseja apagar a região "${regiao.nome}"?`,
             title: "Confirmar Exclusão",
             confirmButtonType: "red",
         });
         
         // Chama a mutação (o estado 'isPending' da mutação será gerido pelo ConfirmationContext)
         deleteMutation.mutate(regiao._id);

     } catch (error) { /* Cancelado */ }
  };

  // --- Renderização (adaptada para useQuery) ---
  const renderTableBody = () => {
    if (isLoading) { // Do useQuery
      return <tr><td colSpan="3"><Spinner message="A carregar regiões..." /></td></tr>;
    }
    if (isError) { // Do useQuery
      return <tr><td colSpan="3" className="text-center error-message">Erro: {error.message}</td></tr>;
    }
    if (regioes.length === 0) {
      return <tr><td colSpan="3" className="text-center">Nenhuma região encontrada.</td></tr>;
    }
    return regioes.map(regiao => (
      <tr key={regiao._id}>
        <td>{regiao._id}</td>
        <td>{regiao.nome}</td>
        <td className="regioes-page__actions">
          <button
            className="regioes-page__action-button regioes-page__action-button--edit"
            title="Editar"
            onClick={() => handleEditClick(regiao)}
            disabled={deleteMutation.isPending} // Desabilita se qualquer exclusão estiver em curso
          >
            <i className="fas fa-pencil-alt"></i>
          </button>
          <button
            className="regioes-page__action-button regioes-page__action-button--delete"
            title="Apagar"
            onClick={() => handleDeleteClick(regiao)}
            // Desabilita se esta linha específica estiver a ser apagada
            disabled={deleteMutation.isPending && deleteMutation.variables === regiao._id} 
          >
            {/* Mostra spinner se esta linha específica estiver a ser apagada */}
            {(deleteMutation.isPending && deleteMutation.variables === regiao._id) ?
              <i className="fas fa-spinner fa-spin"></i> :
              <i className="fas fa-trash"></i>
            }
          </button>
        </td>
      </tr>
    ));
  };
  
  return (
      <div className="regioes-page">
        <div className="regioes-page__header"> {/* Corrected: className instead of className. */}
          <h1 className="regioes-page__title">Gerenciar Regiões</h1>
          <div className="regioes-page__controls">
            <button id="add-regiao-button" className="regioes-page__add-button" onClick={handleAddClick}>
              <i className="fas fa-plus"></i> Adicionar Região
            </button>
          </div>
        </div>
        
        <div className="regioes-page__table-wrapper">
          <table className="regioes-page__table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome da Região</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {renderTableBody()}
            </tbody>
          </table>
        </div>
  
        {/* Modal Adicionar/Editar (usa isSubmitting das mutações) */}
        <Modal
          title={editingRegiao ? 'Editar Região' : 'Adicionar Região'}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        >
          <form id="regiao-form" className="modal-form" onSubmit={handleSubmit(onModalSubmit)} noValidate>
            <div className="modal-form__grid"> 
              <div className="modal-form__input-group modal-form__input-group--full"> 
                <label htmlFor="nome">Nome da Região</label>
                <input
                  type="text"
                  id="nome"
                  {...register('nome', {
                    required: 'O nome da região é obrigatório.',
                    maxLength: { value: 100, message: 'Máximo de 100 caracteres.' }
                  })}
                  className={`modal-form__input ${modalErrors.nome ? 'input-error' : ''}`}
                  disabled={isSubmitting} // Usa o estado de pending das mutações
                />
                {modalErrors.nome && <div className="modal-form__error-message">{modalErrors.nome.message}</div>}
              </div>
            </div>
            <div className="modal-form__actions">
              <button type="button" className="modal-form__button modal-form__button--cancel" onClick={handleCloseModal} disabled={isSubmitting} >
                  Cancelar
               </button>
              <button type="submit" className="modal-form__button modal-form__button--confirm" disabled={isSubmitting} >
                {isSubmitting ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }
  
  export default RegioesPage;