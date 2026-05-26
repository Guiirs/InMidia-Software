// src/pages/Login/LoginPage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { loginUser } from '../../services';
import { useToast } from '../../components/ToastNotification/ToastNotification';
import { V4Badge, V4Button } from '../../v4-painel/components/ui/index.js';
import './Login.css';

function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const showToast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const onSubmit = async (data) => {
    setAuthError('');

    try {
      const responseData = await loginUser(data.email, data.password);

      if (responseData && responseData.user && responseData.token) {
        login(responseData.user, responseData.token);
        showToast('Login bem-sucedido!', 'success');
      } else {
        throw new Error(responseData?.message || 'Resposta inesperada do servidor.');
      }
    } catch (error) {
      const message = error.message || 'Nao foi possivel entrar. Verifique seus dados e tente novamente.';
      setAuthError(message);
      showToast(message, 'error');
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__glow login-page__glow--primary" aria-hidden="true" />
      <div className="login-page__glow login-page__glow--secondary" aria-hidden="true" />

      <div className="login-page__container">
        <section className="login-page__showcase" aria-label="InMidia">
          <div className="login-page__brand">
            <div className="login-page__brand-mark" aria-hidden="true">IN</div>
            <div>
              <h1 className="login-page__brand-name">InMidia</h1>
              <p className="login-page__brand-subtitle">Central operacional de midia exterior</p>
            </div>
          </div>

          <p className="login-page__showcase-text">
            Acesse sua operacao para acompanhar placas, contratos, campanhas e alertas em tempo real.
          </p>

          <div className="login-page__signals" aria-label="Capacidades operacionais">
            <V4Badge variant="success" size="sm" dot>Operacao</V4Badge>
            <V4Badge variant="info" size="sm" dot>Contratos</V4Badge>
            <V4Badge variant="warning" size="sm" dot>Alertas</V4Badge>
          </div>
        </section>

        <div className="login-page__form-wrapper">
          <form id="login-form" className="login-page__form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="login-page__form-header">
              <span className="login-page__eyebrow">Acesso seguro</span>
              <h2 className="login-page__form-title">Entrar na operacao</h2>
              <span className="login-page__form-subtitle">Use seu email e senha para acessar o painel.</span>
            </div>

            {authError && (
              <div className="login-page__auth-error" role="alert">
                <span className="material-symbols-rounded" aria-hidden="true">error</span>
                <span>{authError}</span>
              </div>
            )}

            <div className="login-page__input-group">
              <label className="login-page__label" htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                className={`login-page__input ${errors.email ? 'input-error' : ''}`}
                placeholder="seu@email.com"
                required
                autoComplete="email"
                disabled={isSubmitting}
                {...register('email', {
                  required: 'Informe seu email.',
                  pattern: {
                    value: /^\S+@\S+\.\S+$/,
                    message: 'Informe um email valido.',
                  },
                })}
              />
              {errors.email && <div className="login-page__error-message">{errors.email.message}</div>}
            </div>

            <div className="login-page__input-group">
              <label className="login-page__label" htmlFor="password">Senha</label>
              <div className="login-page__password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className={`login-page__input login-page__input--password ${errors.password ? 'input-error' : ''}`}
                  placeholder="Sua senha"
                  required
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  {...register('password', {
                    required: 'Informe sua senha.',
                  })}
                />
                <button
                  type="button"
                  className="login-page__password-toggle material-symbols-rounded"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={isSubmitting}
                >
                  {showPassword ? 'visibility_off' : 'visibility'}
                </button>
              </div>
              {errors.password && <div className="login-page__error-message">{errors.password.message}</div>}
            </div>

            <div className="login-page__form-options">
              <Link to="/forgot-password" className="login-page__form-link">Esqueceu a senha?</Link>
            </div>

            <V4Button
              type="submit"
              variant="primary"
              size="lg"
              className="login-page__button"
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              Entrar
            </V4Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
