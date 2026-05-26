// components/BiWeeksGenerator/BiWeeksGenerator.jsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../ToastNotification/ToastNotification';
import { generateCalendar } from '../../services/biWeekService';
import './BiWeeksGenerator.css';

function BiWeeksGenerator({ onBack, initialYear, onSuccess }) {
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(initialYear || currentYear);
    const [startDate, setStartDate] = useState(''); // Nova: data de início customizada
    const [overwrite, setOverwrite] = useState(false);
    const [preview, setPreview] = useState([]);
    const [showPreview, setShowPreview] = useState(false);
    
    const showToast = useToast();
    const queryClient = useQueryClient();

    const generateMutation = useMutation({
        mutationFn: generateCalendar,
        onSuccess: (response) => {
            const { created, skipped, total } = response.data || {};
            showToast(
                `✅ Calendário gerado! ${created || 0} bi-semanas criadas, ${skipped || 0} já existiam.`,
                'success'
            );
            // Invalida todas as queries de bi-weeks para forçar recarregamento
            queryClient.invalidateQueries({ queryKey: ['biWeeks'] });
            queryClient.invalidateQueries({ queryKey: ['biWeeksYears'] });
            
            // Chama callback de sucesso se fornecido
            if (onSuccess) {
                onSuccess(year);
            }
            
            // Volta após 2 segundos
            setTimeout(() => {
                if (onBack) onBack();
            }, 2000);
        },
        onError: (error) => {
            showToast(
                error.response?.data?.message || 'Erro ao gerar calendário',
                'error'
            );
        }
    });

    // Função para gerar preview das bi-semanas
    const generatePreview = () => {
        const biWeeks = [];
        
        // Define data de início: customizada ou padrão (01/01)
        let firstStartDate;
        if (startDate) {
            // Parse manual para evitar problemas de timezone
            const [year_d, month_d, day_d] = startDate.split('-').map(Number);
            firstStartDate = new Date(year_d, month_d - 1, day_d, 0, 0, 0, 0);
        } else {
            firstStartDate = new Date(year, 0, 1, 0, 0, 0, 0); // 01/01 do ano
        }
        
        for (let i = 0; i < 26; i++) {
            const currentStartDate = new Date(firstStartDate);
            currentStartDate.setDate(firstStartDate.getDate() + (i * 14));
            
            const currentEndDate = new Date(currentStartDate);
            currentEndDate.setDate(currentStartDate.getDate() + 13); // Soma 13 dias (dia 0 + 13 = 14 dias total)
            currentEndDate.setHours(23, 59, 59, 999);
            
            // Numeração de 2 em 2: 02, 04, 06, 08... 52
            const numero = (i + 1) * 2;
            const bi_week_id = `${year}-${String(numero).padStart(2, '0')}`;
            
            biWeeks.push({
                bi_week_id,
                numero,
                start_date: currentStartDate,
                end_date: currentEndDate
            });
        }
        
        setPreview(biWeeks);
        setShowPreview(true);
    };

    const handleGenerate = () => {
        if (!showPreview) {
            generatePreview();
        } else {
            generateMutation.mutate({ 
                ano: year, 
                overwrite, 
                start_date: startDate || null 
            });
        }
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    if (generateMutation.isPending) {
        return (
            <div className="biweeks-generator">
                <div className="biweeks-generator__card">
                    <div className="biweeks-generator__spinner">
                        <div className="biweeks-generator__spinner-icon"></div>
                        <p>Gerando {preview.length} bi-semanas para {year}...</p>
                        <p style={{ color: '#666', fontSize: '0.9rem' }}>Isso pode levar alguns segundos</p>
                    </div>
                </div>
            </div>
        );
    }

    if (generateMutation.isSuccess) {
        return (
            <div className="biweeks-generator">
                <div className="biweeks-generator__card">
                    <div className="biweeks-generator__success-box">
                        <h3>✅ Sucesso!</h3>
                        <p>Calendário de {year} gerado com sucesso!</p>
                        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                            Redirecionando...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="biweeks-generator">
            {onBack && (
                <button className="biweeks-generator__back-button" onClick={onBack}>
                    <i className="fas fa-arrow-left"></i>
                    Voltar
                </button>
            )}

            <div className="biweeks-generator__header">
                <h1 className="biweeks-generator__title">
                    🗓️ Gerar Calendário de Bi-Semanas
                </h1>
                <p className="biweeks-generator__subtitle">
                                Crie automaticamente todas as 52 bi-semanas do ano
                            </p>
                        </div>            <div className="biweeks-generator__card">
                {!showPreview ? (
                    <>
                        <div className="biweeks-generator__info-box">
                            <p>
                                <strong>ℹ️ Como funciona:</strong> O sistema irá gerar <strong>26 bi-semanas</strong> (períodos de 14 dias)
                                numeradas de 2 em 2 (02, 04, 06... 52). As bi-semanas podem cruzar o final do ano.
                            </p>
                        </div>

                        <div className="biweeks-generator__form">
                            <div className="biweeks-generator__form-row">
                                <div className="biweeks-generator__field">
                                    <label className="biweeks-generator__label">
                                        📅 Ano *
                                    </label>
                                    <input
                                        type="number"
                                        className="biweeks-generator__input"
                                        value={year}
                                        onChange={(e) => setYear(Number(e.target.value))}
                                        min="2020"
                                        max="2100"
                                        disabled={showPreview}
                                    />
                                </div>

                                <div className="biweeks-generator__field">
                                    <label className="biweeks-generator__label">
                                        �️ Data de Início (opcional)
                                    </label>
                                    <input
                                        type="date"
                                        className="biweeks-generator__input"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        disabled={showPreview}
                                    />
                                    <small className="biweeks-generator__hint">
                                        Se não informado, inicia em 01/01/{year}
                                    </small>
                                </div>
                            </div>

                            <div className="biweeks-generator__form-row">
                                <div className="biweeks-generator__field">
                                    <label className="biweeks-generator__label">
                                        📊 Total de Bi-Semanas
                                    </label>
                                    <input
                                        type="text"
                                        className="biweeks-generator__input"
                                        value="26 bi-semanas (02, 04, 06... 52)"
                                        disabled
                                        readOnly
                                    />
                                </div>
                            </div>

                            <div className="biweeks-generator__checkbox-group">
                                <input
                                    type="checkbox"
                                    id="overwrite"
                                    className="biweeks-generator__checkbox"
                                    checked={overwrite}
                                    onChange={(e) => setOverwrite(e.target.checked)}
                                    disabled={showPreview}
                                />
                                <label htmlFor="overwrite" className="biweeks-generator__checkbox-label">
                                    🔄 Sobrescrever bi-semanas existentes (use com cuidado!)
                                </label>
                            </div>

                            {overwrite && (
                                <div className="biweeks-generator__warning-box">
                                    <p>
                                        <strong>⚠️ Atenção:</strong> Ao habilitar esta opção, todas as bi-semanas existentes
                                        do ano {year} serão substituídas. Certifique-se de que deseja fazer isso!
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="biweeks-generator__info-box">
                            <p>
                                <strong>✅ Preview Gerado!</strong> Confira as {preview.length} bi-semanas que serão criadas.
                                Cada período tem exatamente 14 dias.
                            </p>
                        </div>

                        <div className="biweeks-generator__preview">
                            <h3 className="biweeks-generator__preview-title">
                                <i className="fas fa-eye"></i>
                                Preview das Bi-Semanas de {year}
                            </h3>
                            
                            <div className="biweeks-generator__preview-grid">
                                {preview.map((bw) => (
                                    <div key={bw.bi_week_id} className="biweeks-generator__preview-card">
                                        <div className="biweeks-generator__preview-id">
                                            {bw.bi_week_id}
                                        </div>
                                        <div className="biweeks-generator__preview-dates">
                                            📅 {formatDate(bw.start_date)} - {formatDate(bw.end_date)}
                                        </div>
                                        <div className="biweeks-generator__preview-duration">
                                            ⏱️ {bw.days} dias
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                <div className="biweeks-generator__actions">
                    {showPreview && (
                        <button
                            className="biweeks-generator__button biweeks-generator__button--secondary"
                            onClick={() => setShowPreview(false)}
                        >
                            <i className="fas fa-arrow-left"></i>
                            Voltar
                        </button>
                    )}
                    
                    <button
                        className="biweeks-generator__button biweeks-generator__button--primary"
                        onClick={handleGenerate}
                        disabled={generateMutation.isPending}
                    >
                        <i className={showPreview ? "fas fa-check" : "fas fa-eye"}></i>
                        {showPreview ? `Gerar ${preview.length} Bi-Semanas` : 'Preview'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default BiWeeksGenerator;
