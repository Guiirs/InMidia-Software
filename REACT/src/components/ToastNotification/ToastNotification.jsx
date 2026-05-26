// src/components/ToastNotification.jsx
import React, { useState, useEffect } from 'react';
import './ToastNotification.css'; // Criaremos este CSS

let showToastFunction = null;

// Função global para mostrar toast (para uso em interceptors, etc.)
export const showToastGlobal = (msg, toastType = 'info') => {
  if (showToastFunction) {
    showToastFunction(msg, toastType);
  } else {
    console.warn("Toast não está disponível ainda.");
  }
};

function ToastNotification() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info'); // 'info', 'success', 'error'

  showToastFunction = (msg, toastType = 'info') => {
    setMessage(msg);
    setType(toastType);
    setVisible(true);
    setTimeout(() => {
      setVisible(false);
    }, 5000); // Desaparece após 5 segundos
  };

  if (!visible) return null;

  let iconClass = 'fas fa-info-circle';
    if (type === 'success') iconClass = 'fas fa-check-circle';
    if (type === 'error') iconClass = 'fas fa-exclamation-circle';


  return (
    <div className={`toast-notification toast--${type} toast--visible`}>
       <i className={iconClass}></i>
       <span>{message}</span>
    </div>
  );
}

// Hook para usar o toast
export const useToast = () => {
    if (!showToastFunction) {
        // Se o componente ainda não montou, retorna uma função vazia
        // Isso pode acontecer se chamado muito cedo
        console.warn("useToast chamado antes de ToastNotification montar.")
        return () => {};
    }
    return showToastFunction;
};

export default ToastNotification;