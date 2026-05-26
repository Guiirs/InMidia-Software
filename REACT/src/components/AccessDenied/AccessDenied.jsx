import React from 'react';
import { Link } from 'react-router-dom';
import './AccessDenied.css';

function AccessDenied({ message = 'Voce nao tem permissao para acessar esta area.' }) {
  return (
    <div className="access-denied" role="alert">
      <div className="access-denied__icon" aria-hidden="true">
        <i className="fas fa-lock" />
      </div>
      <h2>Acesso restrito</h2>
      <p>{message}</p>
      <Link to="/dashboard" className="access-denied__link">
        Voltar ao dashboard
      </Link>
    </div>
  );
}

export default AccessDenied;
