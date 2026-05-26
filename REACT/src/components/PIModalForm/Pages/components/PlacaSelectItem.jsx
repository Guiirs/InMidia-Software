// src/components/PIModalForm/Pages/components/PlacaSelectItem.jsx
import React from 'react';
import PropTypes from 'prop-types';

/**
 * Componente de item individual para as listas de seleção de placas.
 * (Movido de 'steps/' para 'Pages/components/')
 */
function PlacaSelectItem({ placa, regiaoNome, onSelect, type, disabled, unavailable=false }) {
    const isAdd = type === 'add';
    const buttonIcon = isAdd ? 'fa-plus' : 'fa-minus';
    const buttonTitle = isAdd ? 'Adicionar placa' : 'Remover placa';

    // Usa os estilos do PlacaSelector.css (importado na Page2Placas.jsx)
    const handleKeyDown = (e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect && onSelect();
        }
    };

    const containerLabel = `${placa.numero_placa} ${placa.nomeDaRua || ''} ${regiaoNome || ''}` + (unavailable ? ' - Indisponível' : '');

    return (
        <div
            className={`placa-select-item ${unavailable ? 'placa-select-item--unavailable' : ''}`}
            tabIndex={0}
            role="group"
            aria-label={containerLabel}
            onKeyDown={handleKeyDown}
        >
            <div className="placa-select-item__info">
                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                    <span className="placa-select-item__codigo">{placa.numero_placa}</span>
                    {unavailable && <span className="placa-select-item__badge placa-select-item__badge--unavailable">Indisponível</span>}
                </div>
                <span className="placa-select-item__regiao">{regiaoNome}</span>
                <span className="placa-select-item__rua">{placa.nomeDaRua || 'Endereço não cadastrado'}</span>
            </div>
            <button
                type="button"
                className={`placa-select-item__button placa-select-item__button--${type}`}
                title={buttonTitle}
                aria-label={`${buttonTitle} ${placa.numero_placa}`}
                aria-disabled={disabled || unavailable}
                onClick={onSelect}
                disabled={disabled || unavailable}
            >
                <i className={`fas ${buttonIcon}`}></i>
            </button>
        </div>
    );
}

PlacaSelectItem.propTypes = {
    placa: PropTypes.object.isRequired,
    regiaoNome: PropTypes.string.isRequired,
    onSelect: PropTypes.func.isRequired,
    type: PropTypes.oneOf(['add', 'remove']).isRequired,
    disabled: PropTypes.bool.isRequired,
    unavailable: PropTypes.bool,
};

export default PlacaSelectItem;