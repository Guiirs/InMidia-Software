// src/components/PIModalForm/system/usePIFormLogic.js
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useDebounce } from '../../../hooks/useDebounce';
import { PERIOD_TYPES } from '../../../constants/periodos';
import { format, parseISO, addMonths, addDays, addYears, endOfMonth, subDays } from 'date-fns';

/**
 * Formata data ISO para input HTML (YYYY-MM-DD)
 * Usa date-fns para garantir formato consistente independente do timezone
 */
function formatDateForInput(isoDate) {
    if (!isoDate) return '';
    try {
        return format(parseISO(isoDate), 'yyyy-MM-dd');
    } catch (error) {
        console.error('[usePIFormLogic] Erro ao formatar data:', error);
        return '';
    }
}

/**
 * Calcula dataFim baseado no tipoPeriodo e dataInicio
 * Usa date-fns para manipulação precisa de datas sem problemas de timezone
 */
function calcularDataFimInicial(inicio, tipoPeriodo = PERIOD_TYPES.MENSAL) {
    let baseDate;
    
    if (!inicio) {
        // Se não houver dataInicio, calcula para 1 mês a partir de hoje
        baseDate = new Date();
        const nextMonth = addMonths(baseDate, 1);
        return format(subDays(nextMonth, 1), 'yyyy-MM-dd');
    }
    
    try {
        // Parse da data de início (formato YYYY-MM-DD)
        baseDate = parseISO(inicio);
    } catch (error) {
        console.error('[usePIFormLogic] Erro ao parsear data de início:', error);
        return '';
    }
    
    let endDate;
    
    switch (tipoPeriodo) {
        case PERIOD_TYPES.QUINZENAL:
            // Adiciona 14 dias
            endDate = addDays(baseDate, 14);
            break;
        case PERIOD_TYPES.MENSAL:
            // Vai para o próximo mês e pega o último dia do mês atual
            endDate = endOfMonth(baseDate);
            break;
        case PERIOD_TYPES.BIMESTRAL:
            // Adiciona 2 meses e pega último dia
            endDate = subDays(addMonths(baseDate, 2), 1);
            break;
        case PERIOD_TYPES.SEMESTRAL:
            // Adiciona 6 meses e pega último dia
            endDate = subDays(addMonths(baseDate, 6), 1);
            break;
        case PERIOD_TYPES.ANUAL:
            // Adiciona 1 ano e pega último dia
            endDate = subDays(addYears(baseDate, 1), 1);
            break;
        default:
            // Default: mensal
            endDate = endOfMonth(baseDate);
            break;
    }
    
    return format(endDate, 'yyyy-MM-dd');
}

export const usePIFormLogic = (onSubmit, initialData = {}, isSubmitting = false) => {
    const [currentStep, setCurrentStep] = useState(1);

    // Filtros para placas (mantidos aqui para persistência entre renders)
    const [selectedRegiao, setSelectedRegiao] = useState('');
    const [placaSearch, setPlacaSearch] = useState('');
    const debouncedPlacaSearch = useDebounce(placaSearch, 300);

    // React Hook Form
    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        control,
        trigger,
        formState: { errors: modalErrors },
        setError
    } = useForm({
        mode: 'onBlur',
        defaultValues: {
            clienteId: initialData.clienteId?._id || initialData.clienteId || '',
            // [PERÍODO UNIFICADO] Campo novo - Prioriza novo formato
            period: initialData.periodType ? {
                periodType: initialData.periodType,
                startDate: initialData.startDate ? formatDateForInput(initialData.startDate) : '',
                endDate: initialData.endDate ? formatDateForInput(initialData.endDate) : '',
                biWeekIds: initialData.biWeekIds || [],
                biWeeks: []
            } : (initialData.dataInicio ? {
                // Converte formato legado para novo
                periodType: (initialData.bi_week_ids && initialData.bi_week_ids.length > 0) ? 'bi-week' : 'custom',
                startDate: formatDateForInput(initialData.dataInicio),
                endDate: formatDateForInput(initialData.dataFim),
                biWeekIds: initialData.bi_week_ids || [],
                biWeeks: []
            } : {
                // Padrão: custom com data de hoje
                periodType: 'custom',
                startDate: new Date().toISOString().split('T')[0],
                endDate: calcularDataFimInicial(new Date().toISOString().split('T')[0], 'mensal'),
                biWeekIds: [],
                biWeeks: []
            }),
            // [LEGADO] Mantidos para compatibilidade
            tipoPeriodo: initialData.tipoPeriodo || 'mensal',
            dataInicio: initialData.dataInicio ? formatDateForInput(initialData.dataInicio) : new Date().toISOString().split('T')[0],
            dataFim: initialData.dataFim 
                ? formatDateForInput(initialData.dataFim) 
                : calcularDataFimInicial(
                    initialData.dataInicio ? formatDateForInput(initialData.dataInicio) : new Date().toISOString().split('T')[0],
                    initialData.tipoPeriodo || 'mensal'
                ),
            valorTotal: initialData.valorTotal || 0,
            descricao: initialData.descricao || '',
            responsavel: initialData.clienteId?.responsavel || '',
            segmento: initialData.clienteId?.segmento || '',
            formaPagamento: initialData.formaPagamento || '',
            placas: initialData.placas?.map(p => p._id || p) || [],
            // Novos campos para PDF compatível com XLSX
            produto: initialData.produto || 'OUTDOOR',
            descricaoPeriodo: initialData.descricaoPeriodo || '',
            valorProducao: initialData.valorProducao || 0
        }
    });

    const dataInicio = watch('dataInicio');
    const dataFim = watch('dataFim');
    const watchedClienteId = watch('clienteId');

    useEffect(() => {
        // Sempre que o initialData mudar, reseta o formulário e filtros
        const cliente = initialData.clienteId || {};
        
        // [PERÍODO UNIFICADO] Prepara dados de período
        const periodData = initialData.periodType ? {
            periodType: initialData.periodType,
            startDate: formatDateForInput(initialData.startDate),
            endDate: formatDateForInput(initialData.endDate),
            biWeekIds: initialData.biWeekIds || [],
            biWeeks: []
        } : (initialData.dataInicio ? {
            periodType: (initialData.bi_week_ids && initialData.bi_week_ids.length > 0) ? 'bi-week' : 'custom',
            startDate: formatDateForInput(initialData.dataInicio),
            endDate: formatDateForInput(initialData.dataFim),
            biWeekIds: initialData.bi_week_ids || [],
            biWeeks: []
        } : {
            periodType: 'custom',
            startDate: new Date().toISOString().split('T')[0],
            endDate: calcularDataFimInicial(new Date().toISOString().split('T')[0], 'mensal'),
            biWeekIds: [],
            biWeeks: []
        });
        
        reset({
            clienteId: cliente._id || initialData.clienteId || '',
            period: periodData,
            tipoPeriodo: initialData.tipoPeriodo || 'mensal',
            dataInicio: periodData.startDate,
            dataFim: periodData.endDate,
            valorTotal: initialData.valorTotal || 0,
            descricao: initialData.descricao || '',
            responsavel: cliente.responsavel || '',
            segmento: cliente.segmento || '',
            formaPagamento: initialData.formaPagamento || '',
            placas: initialData.placas?.map(p => p._id || p) || [],
            // Novos campos para PDF compatível com XLSX
            produto: initialData.produto || 'OUTDOOR',
            descricaoPeriodo: initialData.descricaoPeriodo || '',
            valorProducao: initialData.valorProducao || 0
        });

        setCurrentStep(1);
        setSelectedRegiao('');
        setPlacaSearch('');
    }, [initialData, reset]);

    const handleFormSubmit = (data) => {
        const { responsavel, segmento, ...piData } = data;
        onSubmit(piData, setError);
    };

    const nextStep = async () => {
        let fieldsToValidate = null;
        
        // Validação por etapa
        if (currentStep === 1) {
            // Etapa 1: Cliente e Descrição
            fieldsToValidate = ['clienteId', 'descricao'];
        }
        if (currentStep === 2) {
            // Etapa 2: Período (Datas/Bi-semanas)
            fieldsToValidate = ['period'];
        }
        if (currentStep === 3) {
            // Etapa 3: Placas
            fieldsToValidate = ['placas'];
        }

        if (fieldsToValidate) {
            const ok = await trigger(fieldsToValidate);
            if (!ok) {
                if (import.meta.env.DEV) {
                    console.log('[usePIFormLogic] Validation failed for step', currentStep, fieldsToValidate);
                }
                return;
            }
        }

        if (import.meta.env.DEV) {
            console.log('[usePIFormLogic] Moving to next step from', currentStep, 'to', currentStep + 1);
        }

        setCurrentStep(s => Math.min(4, s + 1));
    };

    const prevStep = () => setCurrentStep(s => Math.max(1, s - 1));

    return {
        currentStep,
        formControls: {
            register,
            handleSubmit,
            reset,
            watch,
            setValue,
            control,
            trigger,
            errors: modalErrors,
        },
        watchedValues: { dataInicio, dataFim, watchedClienteId },
        placaFilters: { selectedRegiao, setSelectedRegiao, placaSearch, setPlacaSearch, debouncedPlacaSearch },
        navigation: { nextStep, prevStep, handleFormSubmit }
    };
};
