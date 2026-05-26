// src/pages/Relatorios/RelatoriosPage.jsx

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query'; 
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { fetchRelatorioOcupacao, downloadRelatorioOcupacaoPDF } from '../../services'; 
import { useToast } from '../../components/ToastNotification/ToastNotification';
import { generateColors } from '../../utils/charts';
import './Relatorios.css';

// Foundation wrappers e estados premium
import {
  PageShellV4Foundation,
  PageContainerV4Foundation,
  PageSectionV4Foundation,
  SurfaceCardV4Foundation,
  LoadingStateV4Foundation,
  ErrorStateV4Foundation,
  EmptyStateV4Foundation
} from '../../foundation';

// Regista os elementos necessários do Chart.js
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

// --- Helper para obter datas padrão ---
const getDefaultDates = () => {
    const dataFim = new Date();
    const dataInicio = new Date(dataFim.getFullYear(), dataFim.getMonth(), 1); // Primeiro dia do mês atual
    return {
        inicio: dataInicio.toISOString().split('T')[0],
        fim: dataFim.toISOString().split('T')[0]
    };
};


function RelatoriosPage() {
  const showToast = useToast();
  const [dateRange, setDateRange] = useState(getDefaultDates());
  const [submittedRange, setSubmittedRange] = useState(null);

  // Mantém lógica real
  const {
    data: reportData,
    isLoading,
    isError,
    error,
    isFetching,
    refetch
  } = useQuery({
    queryKey: ['relatorioOcupacao', submittedRange],
    queryFn: () => {
      if (!submittedRange) return null;
      return fetchRelatorioOcupacao(submittedRange.inicio, submittedRange.fim);
    },
    enabled: false,
    staleTime: Infinity,
    onError: (err) => {
      showToast(err.message || 'Erro ao carregar relatório.', 'error');
    },
    onSuccess: (data) => {
      if (!data) return;
      if (data.totalAlugueisNoPeriodo === 0) {
        showToast('Nenhum dado encontrado para o período selecionado.', 'info');
      }
    }
  });

  const downloadPdfMutation = useMutation({
    mutationFn: (dates) => downloadRelatorioOcupacaoPDF(dates.inicio, dates.fim),
    onSuccess: (data) => {
      const url = URL.createObjectURL(data.blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', data.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast('Download do PDF iniciado!', 'success');
    },
    onError: (err) => {
      showToast(err.message || 'Falha ao gerar o PDF.', 'error');
    }
  });

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({ ...prev, [name]: value }));
  };
  const handleSubmitReport = () => {
    if (!dateRange.inicio || !dateRange.fim) {
      showToast('Por favor, selecione data de início e fim.', 'warning');
      return;
    }
    if (dateRange.fim < dateRange.inicio) {
      showToast('A data final deve ser posterior à data inicial.', 'warning');
      return;
    }
    setSubmittedRange(dateRange);
    setTimeout(() => {
      refetch();
    }, 0);
  };
  const handleDownloadPDF = () => {
    if (!submittedRange || !reportData) {
      showToast('Primeiro, gere o relatório na tela.', 'warning');
      return;
    }
    if (reportData.totalAlugueisNoPeriodo === 0) {
      showToast('Não há dados para exportar em PDF.', 'info');
      return;
    }
    downloadPdfMutation.mutate(submittedRange);
  };

  // Mantém lógica real dos gráficos
  const ocupacaoChartData = useMemo(() => {
    if (!reportData?.ocupacaoPorRegiao || reportData.ocupacaoPorRegiao.length === 0) return null;
    const labels = reportData.ocupacaoPorRegiao.map(item => item.regiao || 'Sem Região');
    const dataValues = reportData.ocupacaoPorRegiao.map(item => item.taxa_ocupacao_regiao);
    const backgroundColors = generateColors(labels.length);
    return {
      labels,
      datasets: [{
        label: 'Taxa de Ocupação (%)',
        data: dataValues,
        backgroundColor: backgroundColors,
        borderColor: backgroundColors.map(color => color.replace('0.7', '1')),
        borderWidth: 1,
      }]
    };
  }, [reportData]);
  const clientesChartData = useMemo(() => {
    if (!reportData?.novosAlugueisPorCliente || reportData.novosAlugueisPorCliente.length === 0) return null;
    const labels = reportData.novosAlugueisPorCliente.map(item => item.cliente_nome || 'Cliente Apagado');
    const dataValues = reportData.novosAlugueisPorCliente.map(item => item.total_novos_alugueis);
    const backgroundColors = generateColors(labels.length);
    return {
      labels,
      datasets: [{
        label: 'Novos Aluguéis',
        data: dataValues,
        backgroundColor: backgroundColors,
        borderColor: backgroundColors.map(color => color.replace('0.7', '1')),
        borderWidth: 1,
      }]
    };
  }, [reportData]);
  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    plugins: { legend: { display: false } }
  };
  const clientesBarOptions = {
    ...barChartOptions,
    indexAxis: 'y',
    plugins: { legend: { display: false } }
  };

  // Renderização premium foundation
  let content;
  if (isLoading || isFetching) {
    content = (
      <SurfaceCardV4Foundation variant="default" className="fdn-mt-2">
        <LoadingStateV4Foundation message="A gerar relatório..." />
      </SurfaceCardV4Foundation>
    );
  } else if (isError) {
    content = (
      <SurfaceCardV4Foundation variant="default" className="fdn-mt-2">
        <ErrorStateV4Foundation title="Erro ao carregar relatório" description={error?.message} />
      </SurfaceCardV4Foundation>
    );
  } else if (!reportData || !submittedRange) {
    content = (
      <SurfaceCardV4Foundation variant="default" className="fdn-mt-2">
        <EmptyStateV4Foundation title="Selecione um período e clique em Gerar Relatório." />
      </SurfaceCardV4Foundation>
    );
  } else if (reportData.totalAlugueisNoPeriodo === 0) {
    content = (
      <SurfaceCardV4Foundation variant="default" className="fdn-mt-2">
        <EmptyStateV4Foundation title="Nenhum dado de aluguel encontrado para o período selecionado." />
      </SurfaceCardV4Foundation>
    );
  } else {
    content = (
      <>
        {/* KPIs premium */}
        <div className="relatorios-kpi-grid fdn-row-md fdn-wrap fdn-mt-2">
          <SurfaceCardV4Foundation variant="elevated" className="relatorios-kpi-card">
            <div className="relatorios-kpi-label">Aluguéis no Período</div>
            <div className="relatorios-kpi-value">{reportData.totalAlugueisNoPeriodo}</div>
          </SurfaceCardV4Foundation>
          <SurfaceCardV4Foundation variant="elevated" className="relatorios-kpi-card">
            <div className="relatorios-kpi-label">Ocupação Média</div>
            <div className="relatorios-kpi-value">
              {typeof reportData.percentagem === 'number' && !isNaN(reportData.percentagem)
                ? reportData.percentagem.toFixed(1) + '%'
                : '-'}
            </div>
          </SurfaceCardV4Foundation>
          <SurfaceCardV4Foundation variant="elevated" className="relatorios-kpi-card">
            <div className="relatorios-kpi-label">Total de Dias Alugados</div>
            <div className="relatorios-kpi-value">{reportData.totalDiasAlugados}</div>
          </SurfaceCardV4Foundation>
        </div>

        {/* Gráficos em cards premium */}
        <div className="relatorios-page__charts-grid fdn-mt-2">
          <SurfaceCardV4Foundation variant="default">
            <div className="relatorios-page__chart-title">Taxa de Ocupação por Região (%)</div>
            <div style={{ position: 'relative', height: '350px' }}>
              {ocupacaoChartData ? (
                <Bar options={barChartOptions} data={ocupacaoChartData} />
              ) : (
                <EmptyStateV4Foundation title="Sem dados de ocupação." />
              )}
            </div>
          </SurfaceCardV4Foundation>
          <SurfaceCardV4Foundation variant="default">
            <div className="relatorios-page__chart-title">Novos Aluguéis por Cliente</div>
            <div style={{ position: 'relative', height: '350px' }}>
              {clientesChartData ? (
                <Bar options={clientesBarOptions} data={clientesChartData} />
              ) : (
                <EmptyStateV4Foundation title="Sem dados de clientes." />
              )}
            </div>
          </SurfaceCardV4Foundation>
        </div>
      </>
    );
  }

  return (
    <PageShellV4Foundation fullHeight className="relatorios-v4-shell">
      <PageContainerV4Foundation maxWidth="xl" padded>
        <PageSectionV4Foundation>
          {/* Header premium visual */}
          <div className="relatorios-v4-header fdn-stack-md fdn-mt-2">
            <h1 className="relatorios-v4-title">Relatórios Executivos</h1>
            <div className="relatorios-v4-desc">Painel de análise de ocupação, clientes e exportação premium</div>
          </div>
          {/* FilterBar visual premium (mantém inputs reais) */}
          <SurfaceCardV4Foundation variant="default" className="relatorios-v4-filterbar fdn-row-md fdn-wrap fdn-mt-2">
            <div className="relatorios-v4-filter-group">
              <label htmlFor="data_inicio" className="relatorios-v4-filter-label">Data Início</label>
              <input
                type="date"
                id="data_inicio"
                name="inicio"
                className="relatorios-v4-date-input"
                value={dateRange.inicio}
                onChange={handleDateChange}
                disabled={isFetching || downloadPdfMutation.isPending}
              />
            </div>
            <div className="relatorios-v4-filter-group">
              <label htmlFor="data_fim" className="relatorios-v4-filter-label">Data Fim</label>
              <input
                type="date"
                id="data_fim"
                name="fim"
                className="relatorios-v4-date-input"
                value={dateRange.fim}
                onChange={handleDateChange}
                disabled={isFetching || downloadPdfMutation.isPending}
              />
            </div>
            <button
              className="relatorios-v4-btn relatorios-v4-btn--primary"
              onClick={handleSubmitReport}
              disabled={isFetching || downloadPdfMutation.isPending}
            >
              {isFetching ? 'A gerar...' : 'Gerar Relatório'}
            </button>
            <button
              className="relatorios-v4-btn relatorios-v4-btn--danger"
              onClick={handleDownloadPDF}
              disabled={!submittedRange || !reportData || downloadPdfMutation.isPending || isFetching}
              title={!submittedRange ? 'Gere um relatório primeiro' : 'Exportar PDF'}
            >
              {downloadPdfMutation.isPending ? 'A exportar...' : 'Exportar PDF'}
            </button>
          </SurfaceCardV4Foundation>
          {/* Conteúdo premium */}
          {content}
        </PageSectionV4Foundation>
      </PageContainerV4Foundation>
    </PageShellV4Foundation>
  );
}

export default RelatoriosPage;