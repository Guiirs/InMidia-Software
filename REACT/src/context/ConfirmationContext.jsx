// src/context/ConfirmationContext.jsx
import React, { createContext, useState, useContext, useCallback } from 'react';
import ConfirmationModal from '../components/ConfirmationModal/ConfirmationModal'; // Importa o componente

const ConfirmationContext = createContext(null);

// Valores padrão ou iniciais para o estado do modal
const initialConfirmState = {
  isOpen: false,
  message: "",
  title: "Confirmar Ação",
  confirmText: "Confirmar",
  cancelText: "Cancelar",
  confirmButtonType: "red",
  isConfirming: false,
  onProceed: () => {}, // Callback de sucesso
  onCancel: () => {},  // Callback de cancelamento
};

// Componente Provider
export function ConfirmationProvider({ children }) {
  const [confirmState, setConfirmState] = useState(initialConfirmState);

  // Função exposta pelo hook para mostrar o modal
  const showConfirmation = useCallback((options) => {
    // Envolve a Promessa de Confirmação:
    return new Promise((resolve, reject) => {
      setConfirmState({
        ...initialConfirmState,
        ...options, // Sobrescreve com as opções passadas (message, title, etc.)
        isOpen: true,
        onProceed: resolve, // Resolve a promessa se o utilizador confirmar
        onCancel: reject,   // Rejeita a promessa se o utilizador cancelar (opcional, mas bom)
      });
    });
  }, []);

  // Handler para o clique em Confirmar no Modal
  const handleConfirm = async () => {
    if (confirmState.isConfirming) return;
    setConfirmState(prev => ({ ...prev, isConfirming: true })); // Ativa loading
    try {
        await confirmState.onProceed(); // Executa o resolve da promessa (continua o try/catch na função chamadora)
    } catch (err) {
        // Se o onProceed for rejeitado, o erro é pego aqui e limpa o modal, mas a função chamadora já pegou.
    } finally {
        // Resetamos o estado principal, desativando o modal
        setConfirmState(initialConfirmState);
    }
  };

  // Handler para o clique em Cancelar/Fechar
  const handleCancel = () => {
    if (confirmState.isConfirming) return;
    confirmState.onCancel(new Error("Ação cancelada pelo usuário.")); // Rejeita a promessa
    setConfirmState(initialConfirmState); // Desativa o modal
  };


  return (
    <ConfirmationContext.Provider value={{ showConfirmation }}>
      {children}
      {/* O Modal é renderizado dentro do Provider, mas visível globalmente */}
      <ConfirmationModal
        isOpen={confirmState.isOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        confirmButtonType={confirmState.confirmButtonType}
        isConfirming={confirmState.isConfirming}
      />
    </ConfirmationContext.Provider>
  );
}

// Hook customizado
export function useConfirmation() {
  const context = useContext(ConfirmationContext);
  if (context === null) {
    throw new Error('useConfirmation deve ser usado dentro de um ConfirmationProvider');
  }
  return context.showConfirmation;
}