// src/components/UserTable/UserTable.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { normalizeRole } from '../../auth/permissions';

// <<< ALTERAÇÃO: Aceita 'isUpdatingRole' e 'isDeleting' como props >>>
function UserTable({
    users,
    loggedInUserId,
    onRoleChange,
    onDeleteClick,
    onViewActivity,
    isUpdatingRole, // boolean
    isDeleting      // boolean
}) {

    // Renderiza as linhas da tabela
    return (
        <tbody>
            {users.map(user => {
                const isCurrentUser = loggedInUserId && String(user._id) === String(loggedInUserId);
                
                // <<< MELHORIA: Desabilita ações se for o user atual OU se outra ação estiver em curso >>>
                const disableActions = isCurrentUser || isUpdatingRole || isDeleting;
                
                let disableReason = "";
                if (isCurrentUser) {
                    disableReason = "Não pode alterar/apagar a sua própria conta aqui";
                } else if (isUpdatingRole || isDeleting) {
                    disableReason = "Aguarde, outra ação está em progresso...";
                }

                return (
                    <tr key={user._id}>
                        <td>{user._id}</td>
                        <td>{user.username}</td>
                        <td>{user.email}</td>
                        <td>
                            <select
                                className="admin-users-page__role-select"
                                value={normalizeRole(user.role)}
                                onChange={(e) => onRoleChange(user._id, e.target.value, e.target)}
                                disabled={disableActions} // Usa a nova lógica
                                title={disableReason}
                            >
                                <option value="vendedor">Vendedor</option>
                                <option value="visualizador">Visualizador</option>
                                <option value="financeiro">Financeiro</option>
                                <option value="gestor">Gestor</option>
                                <option value="admin_empresa">Admin Empresa</option>
                            </select>
                        </td>
                        <td className="admin-users-page__actions">
                            {onViewActivity && (
                                <button
                                    className="admin-users-page__action-button"
                                    title="Ver atividades"
                                    onClick={() => onViewActivity(user)}
                                    disabled={isUpdatingRole || isDeleting}
                                >
                                    <i className="fas fa-history"></i>
                                </button>
                            )}
                            <button
                                className="admin-users-page__action-button admin-users-page__action-button--delete"
                                title={disableReason || "Apagar"}
                                onClick={() => onDeleteClick(user)}
                                disabled={disableActions} // Usa a nova lógica
                            >
                                {/* O spinner individual por linha foi movido
                                  para a página AdminUsersPage (na mutação de delete),
                                  mas podemos adicionar um genérico aqui se preferir.
                                  Por agora, apenas desabilitamos.
                                */}
                                <i className="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                );
            })}
        </tbody>
    );
}

UserTable.propTypes = {
    users: PropTypes.arrayOf(PropTypes.shape({
        _id: PropTypes.string.isRequired,
        username: PropTypes.string.isRequired,
        email: PropTypes.string.isRequired,
        role: PropTypes.string.isRequired,
    })).isRequired,
    loggedInUserId: PropTypes.string,
    onRoleChange: PropTypes.func.isRequired,
    onDeleteClick: PropTypes.func.isRequired,
    onViewActivity: PropTypes.func,
    // <<< ALTERAÇÃO: Adiciona validação das novas props >>>
    isUpdatingRole: PropTypes.bool,
    isDeleting: PropTypes.bool,
};

// Define valores padrão
UserTable.defaultProps = {
    isUpdatingRole: false,
    isDeleting: false,
    onViewActivity: null
};


export default UserTable;
