// src/components/UserModalForm/UserModalForm.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { useForm } from 'react-hook-form';
import { normalizeRole } from '../../auth/permissions';

function UserModalForm({ onSubmit, onClose, isSubmitting: isFormSubmitting, initialData = {} }) {
    // Inicializa react-hook-form DENTRO do componente do formulário
    const {
        register,
        handleSubmit,
        watch,
        reset, // Reset pode ser chamado aqui se necessário, mas geralmente é feito ao abrir o modal
        formState: { errors: modalErrors },
        setError: setModalError // Permite que a página pai defina erros da API
    } = useForm({
        mode: 'onBlur',
        // Define valores padrão baseados nos dados iniciais (vazio para 'add', preenchido para 'edit' no futuro)
        defaultValues: {
            nome: initialData.nome || '',
            sobrenome: initialData.sobrenome || '',
            username: initialData.username || '',
            email: initialData.email || '',
            password: '', // Senha sempre vazia por padrão
            confirmPassword: '',
            role: normalizeRole(initialData.role || 'vendedor')
        }
    });

    // Observa a senha para validação de confirmação
    const password = watch('password', '');

    // A função onSubmit passada como prop será chamada pelo handleSubmit do RHF
    // Opcional: Adicionar um wrapper se precisar processar dados antes de chamar a prop
    const handleFormSubmit = (data) => {
        const dataToSend = { ...data };
        delete dataToSend.confirmPassword; // Remove confirmação antes de enviar
        onSubmit(dataToSend, setModalError); // Passa os dados e a função setError para o handler da página pai
    };

    return (
        // handleSubmit(handleFormSubmit) envolve o form
        <form id="user-form" className="modal-form" onSubmit={handleSubmit(handleFormSubmit)} noValidate> {/* */}
            <div className="modal-form__grid"> {/* */}
                {/* Nome */}
                <div className="modal-form__input-group"> {/* */}
                    <label htmlFor="nome">Nome</label> {/* */}
                    <input type="text" id="nome"
                           className={`modal-form__input ${modalErrors.nome ? 'input-error' : ''}`} //
                           {...register('nome', { required: 'O nome é obrigatório.' })}
                           disabled={isFormSubmitting} />
                    {modalErrors.nome && <div className="modal-form__error-message">{modalErrors.nome.message}</div>} {/* */}
                </div>
                {/* Sobrenome */}
                <div className="modal-form__input-group"> {/* */}
                    <label htmlFor="sobrenome">Sobrenome</label> {/* */}
                    <input type="text" id="sobrenome"
                           className={`modal-form__input ${modalErrors.sobrenome ? 'input-error' : ''}`} //
                           {...register('sobrenome', { required: 'O sobrenome é obrigatório.' })}
                           disabled={isFormSubmitting} />
                    {modalErrors.sobrenome && <div className="modal-form__error-message">{modalErrors.sobrenome.message}</div>} {/* */}
                </div>
                {/* Username */}
                <div className="modal-form__input-group modal-form__input-group--full"> {/* */}
                    <label htmlFor="username">Nome de Utilizador</label> {/* */}
                    <input type="text" id="username"
                           className={`modal-form__input ${modalErrors.username ? 'input-error' : ''}`} //
                           {...register('username', {
                               required: 'O nome de utilizador é obrigatório.',
                               minLength: { value: 3, message: 'Mínimo 3 caracteres.' },
                               maxLength: { value: 50, message: 'Máximo 50 caracteres.'}
                           })}
                           disabled={isFormSubmitting} />
                    {modalErrors.username && <div className="modal-form__error-message">{modalErrors.username.message}</div>} {/* */}
                </div>
                {/* Email */}
                <div className="modal-form__input-group modal-form__input-group--full"> {/* */}
                    <label htmlFor="email">E-mail</label> {/* */}
                    <input type="email" id="email"
                           className={`modal-form__input ${modalErrors.email ? 'input-error' : ''}`} //
                           {...register('email', {
                               required: 'O e-mail é obrigatório.',
                               pattern: { value: /^\S+@\S+\.\S+$/, message: 'Formato de e-mail inválido.' },
                               maxLength: { value: 100, message: 'Máximo 100 caracteres.'}
                           })}
                           disabled={isFormSubmitting} />
                    {modalErrors.email && <div className="modal-form__error-message">{modalErrors.email.message}</div>} {/* */}
                </div>
                {/* Password */}
                <div className="modal-form__input-group"> {/* */}
                    <label htmlFor="password">Senha</label> {/* */}
                    <input type="password" id="password"
                           className={`modal-form__input ${modalErrors.password ? 'input-error' : ''}`} //
                           {...register('password', {
                               required: 'A senha é obrigatória.', // Tornar obrigatório para criação
                               minLength: { value: 6, message: 'Mínimo 6 caracteres.' }
                           })}
                           disabled={isFormSubmitting} />
                    {modalErrors.password && <div className="modal-form__error-message">{modalErrors.password.message}</div>} {/* */}
                </div>
                {/* Confirmar Senha */}
                 <div className="modal-form__input-group"> {/* */}
                    <label htmlFor="confirmPassword">Confirmar Senha</label> {/* */}
                    <input type="password" id="confirmPassword"
                           className={`modal-form__input ${modalErrors.confirmPassword ? 'input-error' : ''}`} //
                           {...register('confirmPassword', {
                               required: 'Confirme a senha.',
                               validate: (value) => value === password || 'As senhas não coincidem.'
                           })}
                           disabled={isFormSubmitting} />
                    {modalErrors.confirmPassword && <div className="modal-form__error-message">{modalErrors.confirmPassword.message}</div>} {/* */}
                 </div>
                {/* Role */}
                <div className="modal-form__input-group"> {/* */}
                    <label htmlFor="role">Função</label> {/* */}
                    <select id="role"
                            className="modal-form__input" // Usa classe de input para estilo consistente
                            {...register('role')}
                            disabled={isFormSubmitting}>
                        <option value="vendedor">Vendedor</option>
                        <option value="visualizador">Visualizador</option>
                        <option value="financeiro">Financeiro</option>
                        <option value="gestor">Gestor</option>
                        <option value="admin_empresa">Admin Empresa</option>
                    </select>
                     {/* Não costuma ter erro aqui, a menos que seja obrigatório e não haja default */}
                </div>
            </div>

            {/* Ações do Modal */}
            <div className="modal-form__actions"> {/* */}
                <button type="button" className="modal-form__button modal-form__button--cancel" onClick={onClose} disabled={isFormSubmitting}> {/* */}
                    Cancelar
                </button>
                <button type="submit" className="modal-form__button modal-form__button--confirm" disabled={isFormSubmitting}> {/* */}
                    {isFormSubmitting ? 'A criar...' : 'Criar Utilizador'}
                </button>
            </div>
        </form>
    );
}

UserModalForm.propTypes = {
    onSubmit: PropTypes.func.isRequired,       // Função chamada na submissão bem-sucedida
    onClose: PropTypes.func.isRequired,        // Função chamada para fechar o modal (cancelar)
    isSubmitting: PropTypes.bool.isRequired,   // Estado de submissão (vem da página pai/React Query)
    initialData: PropTypes.object,             // Dados iniciais para preencher o formulário (útil para edição)
};

export default UserModalForm;
