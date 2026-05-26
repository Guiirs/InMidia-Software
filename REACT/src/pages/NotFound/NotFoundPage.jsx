// src/pages/NotFound/NotFoundPage.jsx (Melhorado)
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext'; // 1. Importar useAuth
import './NotFound.css'; // 2. Importar o CSS

function NotFoundPage() {
  const { isAuthenticated } = useAuth(); // 3. Verificar se está autenticado

  // Define o link de retorno com base na autenticação
  const returnLink = isAuthenticated ? '/dashboard' : '/login';
  const returnLinkText = isAuthenticated ? 'Voltar ao Dashboard' : 'Ir para Login';

  return (
    // 4. Usar as classes CSS
    <div className="not-found-page">
      {/* 5. Adicionar um ícone */}
      <i className="fas fa-exclamation-triangle not-found-page__icon"></i>

      <h1 className="not-found-page__title">Oops! Página Não Encontrada</h1>
      <p className="not-found-page__message">
        Não conseguimos encontrar a página que você está procurando.
        Verifique o endereço ou volte para um local seguro.
      </p>

      {/* 6. Usar link e texto dinâmicos */}
      <Link to={returnLink} className="not-found-page__link">
        {returnLinkText}
      </Link>
    </div>
  );
}

export default NotFoundPage;