// src/pages/ForgotPassword/ForgotPasswordPage.jsx
import React from 'react'; // Não precisamos mais do useState
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form'; // <<< Refinamento 6
import { requestPasswordReset } from '../../services';
import { useToast } from '../../components/ToastNotification/ToastNotification';
import './ForgotPassword.css';

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const showToast = useToast();

  // --- Refinamento 6: Inicializa react-hook-form ---
  const {
    register, // Para registar o input
    handleSubmit, // Para envolver a submissão
    formState: { errors, isSubmitting }, // Pega erros e estado de submissão
  } = useForm({
    mode: 'onBlur', // Valida quando o utilizador sai do campo
    defaultValues: { email: '' }
  });

  // --- Refinamento 6: Função de submissão do RHF ---
  const onSubmit = async (data) => {
    // 'data' já contém { email: '...' } validado
    try {
      // A API (authService.js) retorna uma mensagem genérica no sucesso
      const response = await requestPasswordReset(data.email);
      showToast(response.message || 'Instruções enviadas com sucesso!', 'success');
      // Opcional: redirecionar para login após alguns segundos
      // setTimeout(() => navigate('/login'), 2000);
    } catch (error) {
      // O backend não deve retornar erro se o email não existir (por segurança)
      // Mas se houver um erro de servidor (500), mostramos aqui.
      showToast(error.message || 'Erro ao enviar o pedido.', 'error');
    }
    // isSubmitting é gerido automaticamente pelo RHF
  };

  return (
    <div className="forgot-password-page">
      <div className="forgot-password-page__container">
        <i className="fas fa-key forgot-password-page__icon"></i>
        <h2 className="forgot-password-page__title">Esqueceu a sua senha?</h2>
        <p className="forgot-password-page__subtitle">Sem problemas. Insira o seu e-mail e enviaremos as instruções para a redefinir.</p>
        
        {/* handleSubmit(onSubmit) envolve o formulário */}
        <form id="forgot-password-form" className="forgot-password-page__form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <input
            type="email"
            id="email"
            className={`forgot-password-page__input ${errors.email ? 'input-error' : ''}`}
            placeholder="Digite o seu e-mail"
            disabled={isSubmitting}
            // Regista o campo 'email' com RHF e define regras
            {...register('email', {
              required: 'O e-mail é obrigatório.',
              pattern: {
                value: /^\S+@\S+\.\S+$/,
                message: 'Formato de e-mail inválido.'
              }
            })}
          />
          {/* Exibe o erro do RHF */}
          {errors.email && <div className="modal-form__error-message" style={{ textAlign: 'left' }}>{errors.email.message}</div>}
          
          <button type="submit" className="forgot-password-page__button" disabled={isSubmitting}>
            {isSubmitting ? 'A enviar...' : 'Enviar Instruções'}
          </button>
        </form>
        <Link to="/login" className="forgot-password-page__back-link">Voltar para o Login</Link>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;