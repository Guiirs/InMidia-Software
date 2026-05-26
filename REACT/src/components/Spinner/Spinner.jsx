// src/components/Spinner/Spinner.jsx
import React from 'react';
import './Spinner.css'; // Importa o CSS

// O componente recebe a mensagem como prop
function Spinner({ message = 'A carregar...' }) {
  return (
    <div className="loading-spinner">
      <div className="spinner"></div>
      <span>{message}</span>
    </div>
  );
}

export default Spinner;