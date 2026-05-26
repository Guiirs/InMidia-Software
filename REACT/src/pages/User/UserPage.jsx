// src/pages/User/UserPage.jsx
import React, { useEffect } from 'react'; // Removido useState, useCallback
import { useForm } from 'react-hook-form';
// 1. Importar hooks do React Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchUserData, updateUserData } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ToastNotification/ToastNotification';
import Spinner from '../../components/Spinner/Spinner';
import './User.css';

// Chave da query para os dados do utilizador
const userQueryKey = ['userData', 'me'];

function UserPage() {
  const { updateUser: updateAuthContext } = useAuth(); // Renomeia para clareza
  const showToast = useToast();
  const queryClient = useQueryClient(); // Obter o cliente Query

  // --- RHF Config (inalterado, mas reset será chamado pelo useQuery) ---
  const {
    register, handleSubmit, reset, setError,
    formState: { errors, isSubmitting: isFormSubmitting }, // Renomeia isSubmitting
  } = useForm({
    mode: 'onBlur',
    defaultValues: { nome: '', sobrenome: '', username: '', email: '', password: '' }
  });

  // --- 2. useQuery para buscar dados do utilizador ---
  const {
    data: userData, // Dados do utilizador
    isLoading,     // Estado de loading da query
    isError,       // Estado de erro da query
    error,         // Objeto de erro da query
    // Não precisamos de placeholder aqui, o formulário mostrará vazio inicialmente
  } = useQuery({
    queryKey: userQueryKey, // Chave única
    queryFn: fetchUserData, // Função da API
    staleTime: 1000 * 60 * 15, // Cache de 15 minutos (exemplo)
    // React Query já trata retries por padrão
  });

  // --- 3. useEffect para preencher o formulário quando os dados do useQuery carregam ---
  useEffect(() => {
    if (userData) {
      reset({ // Preenche o formulário RHF
        nome: userData.nome || '',
        sobrenome: userData.sobrenome || '',
        username: userData.username || '',
        email: userData.email || '',
        password: '', // Senha sempre vazia
      });
    }
  }, [userData, reset]); // Depende dos dados do useQuery

  // --- 4. useMutation para atualizar o perfil ---
  const updateProfileMutation = useMutation({
    mutationFn: updateUserData, // API fn (recebe dataToUpdate)
    onSuccess: (response) => { // 'response' é o retorno da API { message, user }
      showToast('Perfil atualizado com sucesso!', 'success');
      // Atualiza o cache do React Query com os novos dados do utilizador
      queryClient.setQueryData(userQueryKey, response.user);
      // Atualiza também o AuthContext
      updateAuthContext(response.user);
      // Limpa o campo de senha no formulário após sucesso
      reset({ ...response.user, password: '' });
    },
    onError: (error) => {
      showToast(error.message || 'Erro ao atualizar o perfil.', 'error');
      // Define erros específicos para os campos se a API retornar erro de duplicação
      if (error.message.toLowerCase().includes('email')) {
        setError('email', { type: 'api', message: error.message });
      } else if (error.message.toLowerCase().includes('username')) {
        setError('username', { type: 'api', message: error.message });
      }
      console.error("Erro submit user profile:", error);
    }
  });

  // Estado de submissão agora vem da mutação
  const isSubmitting = updateProfileMutation.isPending;

  // --- Submissão do Formulário (chama a mutação) ---
  const onSubmit = (data) => {
    const dataToUpdate = { ...data };
    if (!dataToUpdate.password || dataToUpdate.password.trim() === '') {
      delete dataToUpdate.password;
    }
    // Chama a mutação
    updateProfileMutation.mutate(dataToUpdate);
  };

  // --- Renderização ---
  if (isLoading) { // Do useQuery
    return <Spinner message="A carregar perfil..." />;
  }

  if (isError) { // Do useQuery
    return <div className="user-page"><p className="error-message">Erro ao carregar perfil: {error.message}</p></div>;
  }

  return (
    <div className="user-page">
      <form id="user-profile-form" className="user-page__form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="user-page__form-grid">
          {/* Nome */}
          <div className="user-page__input-group">
            <input type="text" id="nome" placeholder=" " disabled={isSubmitting}
                   className={`user-page__input ${errors.nome ? 'input-error' : ''}`}
                   {...register('nome', { maxLength: { value: 100, message: 'Máx 100'} })} />
            <label htmlFor="nome" className="user-page__label">Nome</label>
            {errors.nome && <div className="modal-form__error-message">{errors.nome.message}</div>}
          </div>

          {/* Sobrenome */}
          <div className="user-page__input-group">
            <input type="text" id="sobrenome" placeholder=" " disabled={isSubmitting}
                   className={`user-page__input ${errors.sobrenome ? 'input-error' : ''}`}
                   {...register('sobrenome', { maxLength: { value: 100, message: 'Máx 100'} })} />
            <label htmlFor="sobrenome" className="user-page__label">Sobrenome</label>
             {errors.sobrenome && <div className="modal-form__error-message">{errors.sobrenome.message}</div>}
          </div>

          {/* Username */}
          <div className="user-page__input-group user-page__input-group--full-width">
            <input type="text" id="username" placeholder=" " required disabled={isSubmitting}
                   className={`user-page__input ${errors.username ? 'input-error' : ''}`}
                   {...register('username', {
                       required: 'Obrigatório.',
                       minLength: { value: 3, message: 'Mín 3' },
                       maxLength: { value: 50, message: 'Máx 50'}
                   })} />
            <label htmlFor="username" className="user-page__label">Nome de Utilizador</label>
             {errors.username && <div className="modal-form__error-message">{errors.username.message}</div>}
          </div>

          {/* Email */}
          <div className="user-page__input-group user-page__input-group--full-width">
            <input type="email" id="email" placeholder=" " required disabled={isSubmitting}
                   className={`user-page__input ${errors.email ? 'input-error' : ''}`}
                   {...register('email', {
                       required: 'Obrigatório.',
                       pattern: { value: /^\S+@\S+\.\S+$/, message: 'Inválido.' },
                       maxLength: { value: 100, message: 'Máx 100'}
                   })} />
            <label htmlFor="email" className="user-page__label">E-mail</label>
            {errors.email && <div className="modal-form__error-message">{errors.email.message}</div>}
          </div>

          {/* Nova Senha */}
          <div className="user-page__input-group user-page__input-group--full-width">
            <input type="password" id="password" placeholder=" " disabled={isSubmitting}
                   className={`user-page__input ${errors.password ? 'input-error' : ''}`}
                   autoComplete="new-password"
                   {...register('password', {
                       validate: (value) => !value || value.length >= 6 || 'Mín 6 caracteres.'
                   })}
                   />
            <label htmlFor="password" className="user-page__label">Nova Senha (deixe em branco para não alterar)</label>
            {errors.password && <div className="modal-form__error-message">{errors.password.message}</div>}
          </div>

          {/* Ações */}
          <div className="user-page__actions">
            {/* Usa isSubmitting da mutação */}
            <button type="submit" className="user-page__save-button" disabled={isSubmitting}>
              {isSubmitting ? 'A guardar...' : 'Guardar Alterações'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default UserPage;