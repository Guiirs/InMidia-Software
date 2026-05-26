// src/components/Header/Header.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext'; // Hook de autenticação
import './Header.css'; // Importar o CSS

// O componente Header agora recebe o título como prop
function Header({ title = 'Dashboard' }) {
  const { user } = useAuth(); // Obtém dados do utilizador logado
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  // Nomes e role do utilizador (com fallbacks)
  const userName = user?.username || 'Utilizador';
  const userRole = user?.role || 'user';
  const avatarUrl = user?.avatar_url || '/assets/img/avatar.png'; // Caminho para imagem em public

   // Lógica de debounce para a pesquisa (similar à original)
   useEffect(() => {
       // Só dispara o evento se o termo de busca mudar *após* o debounce
       const handler = setTimeout(() => {
           // Dispara um evento customizado global (outros componentes podem ouvir)
           // Ou, alternativamente, poderia chamar uma função passada via props/context
           const searchEvent = new CustomEvent('search', { detail: { query: searchTerm } });
           document.dispatchEvent(searchEvent);
           if (import.meta.env.DEV) console.debug("[Header] Dispatched search event:", searchTerm);
       }, 300); // 300ms debounce

       // Função de limpeza para cancelar o timeout se o searchTerm mudar antes de 300ms
       return () => {
           clearTimeout(handler);
       };
   }, [searchTerm]); // Executa este efeito sempre que searchTerm mudar


  const handleProfileClick = () => {
    navigate('/user'); // Navega para a página de perfil
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  return (
    <header className="header fdn-root">
      <h1 className="header__title">{title}</h1>

      <div className="header__actions">
        <div className="header__search-wrapper">
          <i className="fas fa-search header__search-icon"></i>
          <input
            type="text"
            id="header-search-input"
            className="header__search-input"
            placeholder="Pesquisar por nº ou rua..."
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>

        {/* Renderiza o perfil apenas se houver utilizador */}
        {user && (
          <div
            className="header__user-profile"
            id="header-user-profile"
            style={{ cursor: 'pointer' }}
            onClick={handleProfileClick}
          >
            <div className="header__user-info">
              <span className="header__user-name">{userName}</span>
              <span className="header__user-role">{userRole}</span>
            </div>
            <img
                src={avatarUrl}
                alt="Avatar do Utilizador"
                className="header__user-avatar"
                // Fallback direto no onError
                onError={(e) => { e.target.onerror = null; e.target.src='/assets/img/avatar.png'; }}
            />
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
