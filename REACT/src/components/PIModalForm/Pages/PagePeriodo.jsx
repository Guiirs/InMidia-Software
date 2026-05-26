// src/components/PIModalForm/Pages/PagePeriodo.jsx
import React from 'react';
import PropTypes from 'prop-types';
import PeriodSelector from '../../PeriodSelector/PeriodSelector';

/**
 * Page 2 (Nova): Seleção de Período
 * Página dedicada exclusivamente à seleção de datas e bi-semanas
 */
export default function PagePeriodo({ 
    control,
    setValue,
    watch,
    errors,
    isSubmitting
}) {
    const periodValue = watch('period');

    const handlePeriodChange = (newPeriod) => {

        // Usar shouldValidate: false e shouldDirty: true para evitar loop
        setValue('period', newPeriod, { shouldValidate: false, shouldDirty: true });
        
        // Mantém compatibilidade com campos legado para backend (batch update)
        if (newPeriod) {
            setValue('periodType', newPeriod.periodType, { shouldValidate: false });
            setValue('startDate', newPeriod.startDate, { shouldValidate: false });
            setValue('endDate', newPeriod.endDate, { shouldValidate: false });
            setValue('biWeekIds', newPeriod.biWeekIds, { shouldValidate: false });
            
            // Campos legado (dataInicio/dataFim)
            setValue('dataInicio', newPeriod.startDate, { shouldValidate: false });
            setValue('dataFim', newPeriod.endDate, { shouldValidate: false });
            setValue('tipoPeriodo', newPeriod.periodType === 'bi-week' ? 'quinzenal' : 'customizado', { shouldValidate: false });
        }
    };

    return (
        <div className="modal-form__input-group modal-form__input-group--full">
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#333' }}>
                Selecione o Período de Veiculação
            </h3>
            <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: '#666' }}>
                Escolha as bi-semanas ou defina um período personalizado para a campanha.
            </p>
            
            <PeriodSelector
                value={periodValue}
                onChange={handlePeriodChange}
                errors={errors.period ? { periodType: errors.period.message } : {}}
                disabled={isSubmitting}
                showDuration={true}
            />
            
            {errors.period && (
                <div className="modal-form__error-message" style={{ marginTop: '0.5rem' }}>
                    {errors.period.message}
                </div>
            )}
        </div>
    );
}

PagePeriodo.propTypes = {
    control: PropTypes.object.isRequired,
    setValue: PropTypes.func.isRequired,
    watch: PropTypes.func.isRequired,
    errors: PropTypes.object.isRequired,
    isSubmitting: PropTypes.bool.isRequired,
};
