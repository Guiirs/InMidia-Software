import React, { useState } from 'react';
import { createExport, fetchExportProfiles } from '../../../services/exportService';
import { useQuery } from '@tanstack/react-query';

const PROFILE_LABELS = {
  'executive-summary': 'Resumo Executivo',
  'regional-performance': 'Desempenho Regional',
  'inventory-health': 'Saúde do Inventário',
  'quality-report': 'Relatório de Qualidade',
  'governance-report': 'Relatório de Governança',
};

const FORMAT_LABELS = {
  json: 'JSON',
  csv: 'CSV',
  pdf: 'PDF (planejado)',
  xlsx: 'XLSX (planejado)',
};

function downloadTextFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportPanel({ defaultProfile }) {
  const [selectedProfile, setSelectedProfile] = useState(defaultProfile ?? 'executive-summary');
  const [selectedFormat, setSelectedFormat] = useState('json');
  const [exportState, setExportState] = useState('idle'); // idle | loading | ready | planned | error
  const [exportResult, setExportResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const { data: profilesData } = useQuery({
    queryKey: ['export-profiles'],
    queryFn: fetchExportProfiles,
    staleTime: 1000 * 60 * 10,
  });

  const profiles = profilesData?.profiles ?? [];
  const currentProfileSpec = profiles.find((p) => p.profile === selectedProfile);
  const availableFormats = currentProfileSpec?.availableFormats ?? ['json', 'csv'];
  const plannedFormats = currentProfileSpec?.plannedFormats ?? ['pdf', 'xlsx'];
  const allFormats = [...availableFormats, ...plannedFormats];
  const isFormatPlanned = plannedFormats.includes(selectedFormat);

  async function handleExport() {
    setExportState('loading');
    setExportResult(null);
    setErrorMessage(null);
    try {
      const result = await createExport({ profile: selectedProfile, format: selectedFormat });
      if (result.status === 'planned') {
        setExportState('planned');
        setExportResult(result);
        return;
      }
      if (!result.success) {
        setExportState('error');
        setErrorMessage(result.error ?? 'Erro ao gerar exportação.');
        return;
      }
      setExportState('ready');
      setExportResult(result);
      // Trigger download automatically
      if (result.content) {
        const mimeType = selectedFormat === 'csv' ? 'text/csv' : 'application/json';
        downloadTextFile(result.content, result.filename ?? `export.${selectedFormat}`, mimeType);
      }
    } catch (err) {
      setExportState('error');
      setErrorMessage(err?.response?.data?.error ?? err?.message ?? 'Erro desconhecido.');
    }
  }

  return (
    <div className="bi-export-panel" data-testid="export-panel">
      <h3 className="bi-export-panel__title">Exportar Dados</h3>

      <div className="bi-export-panel__controls">
        {/* Profile selector */}
        <div className="bi-export-field">
          <label htmlFor="export-profile" className="bi-export-field__label">
            Perfil
          </label>
          <select
            id="export-profile"
            data-testid="export-profile-select"
            className="bi-export-field__select"
            value={selectedProfile}
            onChange={(e) => {
              setSelectedProfile(e.target.value);
              setExportState('idle');
              setExportResult(null);
              setErrorMessage(null);
              // Reset format to json when profile changes
              setSelectedFormat('json');
            }}
          >
            {Object.entries(PROFILE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Format selector */}
        <div className="bi-export-field">
          <label htmlFor="export-format" className="bi-export-field__label">
            Formato
          </label>
          <select
            id="export-format"
            data-testid="export-format-select"
            className="bi-export-field__select"
            value={selectedFormat}
            onChange={(e) => {
              setSelectedFormat(e.target.value);
              setExportState('idle');
              setExportResult(null);
              setErrorMessage(null);
            }}
          >
            {allFormats.map((fmt) => (
              <option key={fmt} value={fmt}>
                {FORMAT_LABELS[fmt] ?? fmt}
              </option>
            ))}
          </select>
        </div>

        {/* Planned badge */}
        {isFormatPlanned && (
          <div className="bi-export-planned-badge" data-testid="export-planned-badge" role="note">
            ⚠️ Formato <strong>{selectedFormat.toUpperCase()}</strong> ainda não disponível para download.
            Retornará status <em>planejado</em>.
          </div>
        )}

        {/* Export button */}
        <button
          type="button"
          className="bi-export-btn"
          data-testid="export-btn"
          onClick={handleExport}
          disabled={exportState === 'loading'}
          aria-busy={exportState === 'loading'}
        >
          {exportState === 'loading' ? 'Gerando…' : 'Exportar'}
        </button>
      </div>

      {/* Status feedback */}
      {exportState === 'ready' && exportResult && (
        <div className="bi-export-status bi-export-status--success" data-testid="export-status-success" role="status">
          ✅ Export gerado — <strong>{exportResult.filename}</strong> ({exportResult.metadata?.rowCount ?? 0} registros)
        </div>
      )}

      {exportState === 'planned' && (
        <div className="bi-export-status bi-export-status--planned" data-testid="export-status-planned" role="status">
          🕐 Formato <strong>{selectedFormat.toUpperCase()}</strong> está planejado.
          Estará disponível em uma versão futura.
        </div>
      )}

      {exportState === 'error' && (
        <div className="bi-export-status bi-export-status--error" data-testid="export-status-error" role="alert">
          ❌ {errorMessage}
        </div>
      )}
    </div>
  );
}
