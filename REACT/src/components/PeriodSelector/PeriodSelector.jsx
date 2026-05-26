/**
 * COMPONENTE PERIOD SELECTOR
 * 
 * Componente reutilizável para seleção de períodos (bi-week ou custom)
 * Usado em formulários de Aluguel e PI
 */

import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@tanstack/react-query';
import { fetchBiWeeksCalendar } from '../../services/biWeekService';
import { 
    PeriodType, 
    PeriodTypeLabels, 
    validatePeriod, 
    formatPeriodDisplay,
    calculateDurationInDays 
} from '../../types/period';
import './PeriodSelector.css';

const PeriodSelector = ({ 
    value, 
    onChange, 
    errors = {}, 
    disabled = false,
    showDuration = true 
}) => {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedPeriodType, setSelectedPeriodType] = useState(
        value?.periodType || PeriodType.CUSTOM
    );
    const [selectedBiWeeks, setSelectedBiWeeks] = useState(value?.biWeekIds || []);
    const [startDate, setStartDate] = useState(value?.startDate || '');
    const [endDate, setEndDate] = useState(value?.endDate || '');
    
    // Ref para evitar loops infinitos
    const isInternalChange = useRef(false);
    const previousPeriodData = useRef(null);

    // Buscar bi-semanas disponíveis
    const { data: biWeeks = [], isLoading } = useQuery({
        queryKey: ['biWeeks', selectedYear],
        queryFn: () => fetchBiWeeksCalendar({ ano: selectedYear }),
        enabled: selectedPeriodType === PeriodType.BI_WEEK,
        staleTime: 5 * 60 * 1000
    });

    // Sincronizar com valor externo
    useEffect(() => {
        if (value && !isInternalChange.current) {
            setSelectedPeriodType(value.periodType || PeriodType.CUSTOM);
            setSelectedBiWeeks(value.biWeekIds || []);
            setStartDate(value.startDate || '');
            setEndDate(value.endDate || '');
        }
        isInternalChange.current = false;
    }, [value]);

    // Notificar mudanças
    useEffect(() => {
        const periodData = {
            periodType: selectedPeriodType,
            startDate,
            endDate,
            biWeekIds: selectedPeriodType === PeriodType.BI_WEEK ? selectedBiWeeks : [],
            biWeeks: []
        };

        // Calcular datas automáticas para bi-weeks selecionadas
        if (selectedPeriodType === PeriodType.BI_WEEK && selectedBiWeeks.length > 0 && biWeeks.length > 0) {
            const selected = biWeeks.filter(bw => selectedBiWeeks.includes(bw.bi_week_id));
            if (selected.length > 0) {
                const sortedBiWeeks = [...selected].sort((a, b) => 
                    new Date(a.start_date) - new Date(b.start_date)
                );
                const newStartDate = sortedBiWeeks[0].start_date.split('T')[0];
                const newEndDate = sortedBiWeeks[sortedBiWeeks.length - 1].end_date.split('T')[0];
                
                // Atualiza apenas se mudou
                if (startDate !== newStartDate || endDate !== newEndDate) {
                    setStartDate(newStartDate);
                    setEndDate(newEndDate);
                    return; // Aguarda próximo render para chamar onChange
                }
                
                periodData.startDate = newStartDate;
                periodData.endDate = newEndDate;
            }
        }

        // Verificar se houve mudança real comparando com valor anterior
        const prevData = previousPeriodData.current;
        const hasChanged = !prevData || 
            prevData.periodType !== periodData.periodType ||
            prevData.startDate !== periodData.startDate ||
            prevData.endDate !== periodData.endDate ||
            JSON.stringify(prevData.biWeekIds) !== JSON.stringify(periodData.biWeekIds);

        if (!hasChanged) {
            return; // Não chama onChange se nada mudou
        }

        // Atualiza referência e chama onChange
        previousPeriodData.current = periodData;
        isInternalChange.current = true;
        onChange(periodData);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPeriodType, selectedBiWeeks, startDate, endDate, biWeeks]);

    const handlePeriodTypeChange = (e) => {
        const newType = e.target.value;
        setSelectedPeriodType(newType);
        
        // Limpar seleções ao trocar de tipo
        if (newType === PeriodType.CUSTOM) {
            setSelectedBiWeeks([]);
        }
    };

    const handleBiWeekToggle = (biWeekId) => {
        setSelectedBiWeeks(prev => {
            const newSelection = prev.includes(biWeekId)
                ? prev.filter(id => id !== biWeekId)
                : [...prev, biWeekId].sort();
            return newSelection;
        });
    };

    const handleSelectAllBiWeeks = () => {
        setSelectedBiWeeks(prev => {
            const newSelection = prev.length === biWeeks.length
                ? []
                : biWeeks.map(bw => bw.bi_week_id);
            return newSelection;
        });
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const duration = (startDate && endDate) 
        ? calculateDurationInDays(startDate, endDate) 
        : 0;

    return (
        <div className="period-selector">
            <div className="period-selector__header">
                <h4>Período de Locação</h4>
                {showDuration && duration > 0 && (
                    <span className="period-selector__duration">
                        {duration} dia{duration !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {/* Seletor de Tipo */}
            <div className="period-selector__type-group">
                <label htmlFor="periodType">Tipo de Período</label>
                <select
                    id="periodType"
                    className={`period-selector__select ${errors.periodType ? 'input-error' : ''}`}
                    value={selectedPeriodType}
                    onChange={handlePeriodTypeChange}
                    disabled={disabled}
                >
                    {Object.entries(PeriodTypeLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
                {errors.periodType && (
                    <span className="period-selector__error">{errors.periodType}</span>
                )}
            </div>

            {/* Modo BI-WEEK */}
            {selectedPeriodType === PeriodType.BI_WEEK && (
                <div className="period-selector__biweek-mode">
                    <div className="period-selector__year-selector">
                        <label htmlFor="biweek-year">Ano</label>
                        <select
                            id="biweek-year"
                            className="period-selector__select"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            disabled={disabled}
                        >
                            {[currentYear - 1, currentYear, currentYear + 1].map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>

                    {isLoading && (
                        <div className="period-selector__loading">Carregando bi-semanas...</div>
                    )}

                    {!isLoading && biWeeks.length === 0 && (
                        <div className="period-selector__empty">
                            Nenhuma bi-semana disponível para {selectedYear}
                        </div>
                    )}

                    {!isLoading && biWeeks.length > 0 && (
                        <>
                            <div className="period-selector__actions">
                                <button
                                    type="button"
                                    className="period-selector__btn-select-all"
                                    onClick={handleSelectAllBiWeeks}
                                    disabled={disabled}
                                >
                                    {selectedBiWeeks.length === biWeeks.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                                </button>
                                <span className="period-selector__selected-count">
                                    {selectedBiWeeks.length} selecionada{selectedBiWeeks.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            <div className="period-selector__biweek-grid">
                                {biWeeks.map(biWeek => {
                                    const isSelected = selectedBiWeeks.includes(biWeek.bi_week_id);
                                    return (
                                        <div
                                            key={biWeek.bi_week_id}
                                            className={`period-selector__biweek-item ${isSelected ? 'selected' : ''}`}
                                            onClick={() => !disabled && handleBiWeekToggle(biWeek.bi_week_id)}
                                        >
                                            <div className="period-selector__biweek-id">{biWeek.bi_week_id}</div>
                                            <div className="period-selector__biweek-dates">
                                                {formatDate(biWeek.start_date)} - {formatDate(biWeek.end_date)}
                                            </div>
                                            {isSelected && (
                                                <div className="period-selector__biweek-check">✓</div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {errors.biWeekIds && (
                        <span className="period-selector__error">{errors.biWeekIds}</span>
                    )}

                    {/* Datas automáticas (read-only para bi-week) */}
                    {startDate && endDate && (
                        <div className="period-selector__date-summary">
                            <strong>Período:</strong> {formatDate(startDate)} a {formatDate(endDate)}
                        </div>
                    )}
                </div>
            )}

            {/* Modo CUSTOM */}
            {selectedPeriodType === PeriodType.CUSTOM && (
                <div className="period-selector__custom-mode">
                    <div className="period-selector__date-row">
                        <div className="period-selector__date-group">
                            <label htmlFor="startDate">Data de Início</label>
                            <input
                                type="date"
                                id="startDate"
                                className={`period-selector__input ${errors.startDate ? 'input-error' : ''}`}
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                disabled={disabled}
                            />
                            {errors.startDate && (
                                <span className="period-selector__error">{errors.startDate}</span>
                            )}
                        </div>

                        <div className="period-selector__date-group">
                            <label htmlFor="endDate">Data de Fim</label>
                            <input
                                type="date"
                                id="endDate"
                                className={`period-selector__input ${errors.endDate ? 'input-error' : ''}`}
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                min={startDate}
                                disabled={disabled}
                            />
                            {errors.endDate && (
                                <span className="period-selector__error">{errors.endDate}</span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Resumo Visual */}
            {startDate && endDate && (
                <div className="period-selector__summary">
                    <strong>Resumo:</strong> {formatPeriodDisplay({
                        periodType: selectedPeriodType,
                        startDate,
                        endDate,
                        biWeekIds: selectedBiWeeks
                    })}
                </div>
            )}
        </div>
    );
};

PeriodSelector.propTypes = {
    value: PropTypes.shape({
        periodType: PropTypes.oneOf(Object.values(PeriodType)),
        startDate: PropTypes.string,
        endDate: PropTypes.string,
        biWeekIds: PropTypes.arrayOf(PropTypes.string),
        biWeeks: PropTypes.array
    }),
    onChange: PropTypes.func.isRequired,
    errors: PropTypes.object,
    disabled: PropTypes.bool,
    showDuration: PropTypes.bool
};

export default PeriodSelector;
