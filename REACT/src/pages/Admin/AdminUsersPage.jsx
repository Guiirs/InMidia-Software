// src/pages/Admin/AdminUsersPage.jsx
import React, { useState } from 'react'; // Removido useEffect, useCallback
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // Importa hooks
import { fetchAllUsers, updateUserRole, deleteUser, createUser } from '../../services';
import { useToast } from '../../components/ToastNotification/ToastNotification';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../../components/Spinner/Spinner';
import Modal from '../../components/Modal/Modal';
import { useConfirmation } from '../../context/ConfirmationContext';
import UserTable from '../../components/UserTable/UserTable';
import UserModalForm from '../../components/UserModalForm/UserModalForm';
import EntityActivityTimeline from '../../components/EntityActivityTimeline/EntityActivityTimeline';
import { PERMISSIONS } from '../../auth/permissions';
import './AdminUsers.css';

const allUsersQueryKey = ['allUsers'];

function AdminUsersPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activityUser, setActivityUser] = useState(null);
  // Removemos isSubmittingForm, usaremos o da mutação
  // const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  const showToast = useToast();
  const { user: loggedInUser, hasPermission } = useAuth();
  const showConfirmation = useConfirmation();
  const queryClient = useQueryClient();

  // ---AS 1. useQuery para buscar utilizadores ---
  const {
    data: users = [],
    isLoading,
    isError,
    error
  } = useQuery({
    queryKey: allUsersQueryKey,
    queryFn: fetchAllUsers,
    placeholderData: [],
  });

  // --- 2. Mutações ---

  // Mutação para Criar Utilizador
  const createUserMutation = useMutation({
      mutationFn: createUser,
      onSuccess: () => {
          showToast('Utilizador criado com sucesso!', 'success');
          closeModal();
          queryClient.invalidateQueries({ queryKey: allUsersQueryKey });
      },
      onError: (error, _variables, context) => {
          // context.setModalError é a função setError do RHF que passamos
          if (context?.setModalError) {
              if (error.message.toLowerCase().includes('email') || error.message.toLowerCase().includes('e-mail')) {
                  context.setModalError('email', { type: 'api', message: error.message });
              } else if (error.message.toLowerCase().includes('username') || error.message.toLowerCase().includes('utilizador')) {
                  context.setModalError('username', { type: 'api', message: error.message });
              }
          }
          showToast(error.message || 'Erro ao criar utilizador.', 'error');
      }
  });

  // Mutação para Atualizar Role
  const updateUserRoleMutation = useMutation({
      mutationFn: (variables) => updateUserRole(variables.id, variables.role), // { id, role }
      onSuccess: (data, variables) => {
          showToast('Função atualizada com sucesso!', 'success');
          // Atualiza o cache localmente para evitar refetch
          queryClient.setQueryData(allUsersQueryKey, (oldData) =>
              oldData.map(u => u._id === variables.id ? { ...u, role: variables.role } : u)
          );
      },
      onError: (error, variables, context) => {
          showToast(error.message || 'Erro ao atualizar função.', 'error');
          // Reverte a UI (selectElement) para o valor original
          if (context?.selectElement) {
              context.selectElement.value = context.originalRole;
          }
      }
  });

  // Mutação para Apagar Utilizador
  const deleteUserMutation = useMutation({
      mutationFn: deleteUser, // Recebe id
      onSuccess: () => {
          showToast('Utilizador apagado com sucesso!', 'success');
          queryClient.invalidateQueries({ queryKey: allUsersQueryKey });
      },
      onError: (error) => {
          showToast(error.message || 'Erro ao apagar utilizador.', 'error');
      }
  });


  // --- Funções do Modal ---
  const openAddModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
  const closeActivityModal = () => setActivityUser(null);

  // Handler para submissão do formulário (chama a mutação)
  const onAddUserSubmit = async (dataFromForm, setModalErrorRHF) => {
    const dataToSend = { ...dataFromForm };
    delete dataToSend.role; // Role é 'user' por padrão no backend, ou admin se enviado
    delete dataToSend.confirmPassword; // Remove confirmação

    // Passamos o setModalError para o contexto do onError da mutação
    createUserMutation.mutate(dataToSend, {
        context: { setModalError: setModalErrorRHF }
    });
  };

  // --- Funções da Tabela (chamam mutações) ---
  const handleRoleChange = async (userId, newRole, selectElement) => {
     const originalRole = users.find(u => u._id === userId)?.role;
     updateUserRoleMutation.mutate(
         { id: userId, role: newRole },
         { context: { selectElement, originalRole } } // Passa contexto para o onError
     );
  };

  const handleDeleteClick = async (user) => {
     try {
         await showConfirmation({
             message: `Tem a certeza que deseja apagar o utilizador "${user.username}"? Esta ação é irreversível.`,
             title: "Confirmar Exclusão de Utilizador",
             confirmText: "Sim, Apagar",
             confirmButtonType: "red",
         });
         // Se confirmado, chama a mutação
         deleteUserMutation.mutate(user._id);
     } catch (error) {
         if (error.message !== "Ação cancelada pelo usuário.") {
            console.error("Erro no processo de confirmação:", error);
         } else {
            console.log("Exclusão cancelada.");
         }
     }
  };

  // --- Renderização ---
  const renderTableContent = () => {
    if (isLoading) {
      return (
        <tbody>
          <tr><td colSpan="5"><Spinner message="A carregar utilizadores..." /></td></tr>
        </tbody>
      );
    }
    if (isError) {
      return (
        <tbody>
          <tr><td colSpan="5" className="text-center error-message">Erro: {error.message}</td></tr>
        </tbody>
      );
    }
    if (users.length === 0) {
      return (
        <tbody>
          <tr><td colSpan="5" className="text-center">Nenhum utilizador encontrado.</td></tr>
        </tbody>
      );
    }
    return (
      <UserTable
        users={users}
        loggedInUserId={loggedInUser?.id}
        onRoleChange={handleRoleChange}
        onDeleteClick={handleDeleteClick}
        onViewActivity={hasPermission(PERMISSIONS.AUDIT_READ) ? setActivityUser : null}
        // Passa estados de loading para desabilitar ações na tabela
        isDeleting={deleteUserMutation.isPending}
        isUpdatingRole={updateUserRoleMutation.isPending}
      />
    );
  };

  return (
    <div className="admin-users-page">
       <div className="admin-users-page__controls">
          <button id="add-user-button" className="admin-users-page__add-button" onClick={openAddModal}>
              <i className="fas fa-plus"></i> Adicionar Utilizador
          </button>
      </div>

      <div className="admin-users-page__table-wrapper">
        <table className="admin-users-page__table">
           <thead>
                <tr><th>ID</th><th>Username</th><th>E-mail</th><th>Função</th><th>Ações</th></tr>
            </thead>
           {renderTableContent()}
        </table>
      </div>

      <Modal title="Adicionar Novo Utilizador" isOpen={isModalOpen} onClose={closeModal}>
        <UserModalForm
            onSubmit={onAddUserSubmit}
            onClose={closeModal}
            isSubmitting={createUserMutation.isPending} // Usa o isPending da mutação
        />
      </Modal>

      <Modal
        title={`Atividades de ${activityUser?.username || 'utilizador'}`}
        isOpen={Boolean(activityUser)}
        onClose={closeActivityModal}
      >
        {activityUser?._id && (
          <EntityActivityTimeline
            entityType="user"
            entityId={activityUser._id}
            title="Atividades recentes"
          />
        )}
      </Modal>

    </div>
  );
}

export default AdminUsersPage;
