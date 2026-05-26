// src/components/PIModalForm/Pages/Page3Valores.jsx
import React from 'react';
import PropTypes from 'prop-types';
import { useCurrencyInput } from '../../../hooks/useCurrencyInput';

export default function Page3Valores({ 
    register, 
    errors, 
    isSubmitting, 
    setValue, 
    watch 
}) {

    // Hooks para inputs monetários
    const valorTotal = useCurrencyInput(
        watch('valorTotal') || 0,
        (value) => setValue('valorTotal', value, { shouldValidate: true })
    );
    
    const valorProducao = useCurrencyInput(
        watch('valorProducao') || 0,
        (value) => setValue('valorProducao', value, { shouldValidate: true })
    );

    return (
        <>
            {/* Valor Total */}
            <div className="modal-form__input-group">
                <label htmlFor="valorTotal">Valor Total (R$)</label>
                <input
                    type="text"
                    id="valorTotal"
                    className={`modal-form__input ${errors.valorTotal ? 'modal-form__input--error' : ''}`}
                    placeholder="R$ 0,00"
                    value={valorTotal.displayValue}
                    onChange={valorTotal.handleChange}
                    disabled={isSubmitting}
                />
                <input
                    type="hidden"
                    {...register('valorTotal', { 
                        valueAsNumber: true,
                        validate: value => (value > 0) || 'O valor deve ser maior que zero.' 
                    })}
                />
                {errors.valorTotal && <div className="modal-form__error-message">{errors.valorTotal.message}</div>}
            </div>

            {/* Forma de Pagamento */}
            <div className="modal-form__input-group modal-form__input-group--full">
                <label htmlFor="formaPagamento">Forma de Pagamento</label>
                <input
                    type="text"
                    id="formaPagamento"
                    placeholder="Ex: Boleto bancário, PIX, etc."
                    className={`modal-form__input ${errors.formaPagamento ? 'modal-form__input--error' : ''}`}
                    {...register('formaPagamento', { required: 'A forma de pagamento é obrigatória.' })}
                    disabled={isSubmitting}
                />
                {errors.formaPagamento && <div className="modal-form__error-message">{errors.formaPagamento.message}</div>}
            </div>

            {/* === NOVOS CAMPOS PARA PDF === */}
            
            {/* Produto */}
            <div className="modal-form__input-group">
                <label htmlFor="produto">Produto/Tipo</label>
                <input
                    type="text"
                    id="produto"
                    placeholder="Ex: OUTDOOR, PAINEL, etc."
                    className={`modal-form__input ${errors.produto ? 'modal-form__input--error' : ''}`}
                    {...register('produto')}
                    disabled={isSubmitting}
                />
                {errors.produto && <div className="modal-form__error-message">{errors.produto.message}</div>}
                <small style={{ color: '#666', fontSize: '0.85rem' }}>Padrão: OUTDOOR</small>
            </div>

            {/* Descrição do Período */}
            <div className="modal-form__input-group">
                <label htmlFor="descricaoPeriodo">Descrição do Período</label>
                <input
                    type="text"
                    id="descricaoPeriodo"
                    placeholder="Ex: BISEMANA 26, MENSAL - MARÇO/2025"
                    className={`modal-form__input ${errors.descricaoPeriodo ? 'modal-form__input--error' : ''}`}
                    {...register('descricaoPeriodo')}
                    disabled={isSubmitting}
                />
                {errors.descricaoPeriodo && <div className="modal-form__error-message">{errors.descricaoPeriodo.message}</div>}
                <small style={{ color: '#666', fontSize: '0.85rem' }}>Opcional - Aparecerá no PDF</small>
            </div>

            {/* Valor Produção */}
            <div className="modal-form__input-group">
                <label htmlFor="valorProducao">Valor Produção (R$)</label>
                <input
                    type="text"
                    id="valorProducao"
                    className={`modal-form__input ${errors.valorProducao ? 'modal-form__input--error' : ''}`}
                    placeholder="R$ 0,00"
                    value={valorProducao.displayValue}
                    onChange={valorProducao.handleChange}
                    disabled={isSubmitting}
                />
                <input
                    type="hidden"
                    {...register('valorProducao', { 
                        valueAsNumber: true,
                        validate: value => (value >= 0) || 'O valor não pode ser negativo.' 
                    })}
                />
                {errors.valorProducao && <div className="modal-form__error-message">{errors.valorProducao.message}</div>}
                <small style={{ color: '#666', fontSize: '0.85rem' }}>Separado do valor de veiculação</small>
            </div>
        </>
    );
}

Page3Valores.propTypes = {
    register: PropTypes.func.isRequired,
    errors: PropTypes.object.isRequired,
    isSubmitting: PropTypes.bool.isRequired,
    setValue: PropTypes.func.isRequired,
    watch: PropTypes.func.isRequired,
};