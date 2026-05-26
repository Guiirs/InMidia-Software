// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Componente para proteger rotas
function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  // 1. Se ainda estiver verificando o estado inicial.
  if (isLoading) {
    return <div>A verificar autenticacao...</div>;
  }

  // 2. Se a verificacao terminou e o utilizador nao esta autenticado.
  if (!isAuthenticated) {
    if (import.meta.env.DEV) {
      console.debug('[ProtectedRoute] Utilizador nao autenticado. A redirecionar para /login.');
    }
    return <Navigate to="/login" replace />;
  }

  // 3. Se a verificacao terminou e o utilizador esta autenticado.
  if (import.meta.env.DEV) {
    console.debug('[ProtectedRoute] Utilizador autenticado. A renderizar rota protegida.');
  }
  return <Outlet />;
}

export default ProtectedRoute;
