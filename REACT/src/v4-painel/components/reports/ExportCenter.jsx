import { memo, useState } from 'react';

const EXPORT_FORMATS = [
  { id: 'pdf-exec',  tipo: 'PDF',  label: 'Relatório Executivo',   descricao: 'Resumo gerencial completo com todos os indicadores', icone: 'picture_as_pdf', cor: 'var(--v4p-danger)'  },
  { id: 'pdf-occ',   tipo: 'PDF',  label: 'Relatório de Ocupação', descricao: 'Detalhamento por região e categoria de inventário',  icone: 'picture_as_pdf', cor: 'var(--v4p-danger)'  },
  { id: 'xlsx-data', tipo: 'XLSX', label: 'Dados Completos',       descricao: 'Planilha com todos os pontos, contratos e receita',  icone: 'table_chart',   cor: 'var(--v4p-success)' },
  { id: 'xlsx-cont', tipo: 'XLSX', label: 'Carteira de Contratos', descricao: 'Lista completa com vencimentos e status',            icone: 'table_chart',   cor: 'var(--v4p-success)' },
  { id: 'csv-inv',   tipo: 'CSV',  label: 'Inventário Completo',   descricao: 'Export de todas as placas com coordenadas e status', icone: 'data_object',   cor: 'var(--v4p-accent)'  },
  { id: 'csv-camp',  tipo: 'CSV',  label: 'Campanhas Ativas',      descricao: 'Campanhas em veiculação com detalhes operacionais',  icone: 'data_object',   cor: 'var(--v4p-accent)'  },
];

function ExportCenter({ onExport }) {
  const [exporting, setExporting] = useState({});

  const handleExport = async (fmt) => {
    if (exporting[fmt.id]) return;
    setExporting((prev) => ({ ...prev, [fmt.id]: true }));
    try {
      if (typeof onExport === 'function') {
        await onExport({ type: fmt.id, format: fmt.tipo.toLowerCase(), filters: {} });
      }
    } finally {
      setExporting((prev) => ({ ...prev, [fmt.id]: false }));
    }
  };

  return (
    <div className="v4p-surface-card v4p-medium-panel">
      <div className="v4p-medium-panel__header">
        <div className="v4p-medium-panel__title-row">
          <span aria-hidden="true" className="v4p-icon v4p-icon--sm material-symbols-rounded" style={{ color: 'var(--v4p-accent)' }}>file_download</span>
          <div>
            <div className="v4p-card-title">Central de exportação</div>
            <div className="v4p-card-subtitle">Relatórios e dados exportáveis</div>
          </div>
        </div>
      </div>

      <div className="v4p-medium-grid" style={{ '--v4p-grid-min': '220px' }}>
        {EXPORT_FORMATS.map((fmt) => {
          const isExporting = exporting[fmt.id];
          return (
            <div key={fmt.id} className="v4p-export-card" style={{ '--v4p-accent-dynamic': fmt.cor }}>
              <span aria-hidden="true" className="v4p-icon v4p-icon--lg material-symbols-rounded" style={{ color: fmt.cor }}>{fmt.icone}</span>
              <div className="v4p-export-card__content">
                <div className="v4p-export-card__top">
                  <span className="v4p-export-card__title">{fmt.label}</span>
                  <span className="v4p-chip v4p-chip--sm" style={{ '--v4p-pill-color': fmt.cor, '--v4p-pill-border': `color-mix(in srgb, ${fmt.cor} 34%, transparent)`, '--v4p-pill-bg': `color-mix(in srgb, ${fmt.cor} 12%, transparent)` }}>{fmt.tipo}</span>
                </div>
                <div className="v4p-export-card__desc">{fmt.descricao}</div>
              </div>
              <button
                type="button"
                onClick={() => handleExport(fmt)}
                disabled={isExporting}
                className={`v4p-icon-button material-symbols-rounded${isExporting ? ' v4p-icon-button--spinning' : ''}`}
                style={{ '--v4p-btn-bg': `color-mix(in srgb, ${fmt.cor} 14%, transparent)`, color: fmt.cor }}
                aria-label={`Exportar ${fmt.label}`}
              >
                {isExporting ? 'sync' : 'download'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(ExportCenter);
