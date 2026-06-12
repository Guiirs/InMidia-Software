import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './OperationFormModal.css';

function MaintenanceCompletionModal({ open, onClose, onConfirm, saving = false, serverError = null }) {
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const firstRef = useRef(null);

  useEffect(() => {
    if (open) {
      setReport('');
      setError('');
      const id = requestAnimationFrame(() => firstRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!report.trim()) {
      setError('Relatório final é obrigatório para concluir a manutenção.');
      return;
    }
    await onConfirm(report.trim());
  }

  return createPortal(
    <div className="v4p-op-modal__backdrop" data-testid="maintenance-completion-modal" role="dialog" aria-modal="true" aria-label="Concluir manutenção"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="v4p-op-modal__dialog" style={{ width: 'min(100%, 480px)', maxWidth: 480 }}>
        <header className="v4p-op-modal__header">
          <div>
            <span className="v4p-op-modal__eyebrow">Manutenção</span>
            <h2 className="v4p-op-modal__title">Concluir manutenção</h2>
            <p className="v4p-op-modal__subtitle">
              Descreva o relatório final da manutenção realizada. Esse campo é obrigatório para liberar a placa.
            </p>
          </div>
          <button className="v4p-op-modal__close" type="button" onClick={onClose} aria-label="Fechar">
            <span className="material-symbols-rounded" aria-hidden="true">close</span>
          </button>
        </header>

        <form className="v4p-op-modal__form" onSubmit={handleSubmit} noValidate>
          {serverError && (
            <div className="v4p-op-modal__banner--error" role="alert" data-testid="maintenance-completion-error-banner">
              <span className="v4p-op-modal__banner-title">Não foi possível concluir a manutenção.</span>
              <span className="v4p-op-modal__banner-message">{serverError.message}</span>
            </div>
          )}

          <section className="v4p-op-modal__section">
            <div className="v4p-op-modal__field">
              <label className="v4p-op-modal__label" htmlFor="maintenance-final-report">
                Relatório final
                <span className="v4p-op-modal__required" aria-hidden="true"> *</span>
              </label>
              <textarea
                id="maintenance-final-report"
                ref={firstRef}
                className="v4p-op-modal__textarea v4p-op-modal__textarea--full"
                value={report}
                onChange={(e) => { setReport(e.target.value); if (error) setError(''); }}
                rows={5}
                placeholder="Descreva o que foi feito, peças trocadas, condições encontradas, etc."
              />
              {(error || (serverError?.field === 'finalReport' && serverError.fieldMessage)) && (
                <span className="v4p-op-modal__error" role="alert">{error || serverError.fieldMessage}</span>
              )}
            </div>
          </section>

          <footer className="v4p-op-modal__footer">
            <button type="button" className="v4p-op-modal__btn v4p-op-modal__btn--secondary"
              onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="v4p-op-modal__btn v4p-op-modal__btn--primary"
              disabled={saving}>
              {saving ? 'Concluindo…' : 'Concluir manutenção'}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default memo(MaintenanceCompletionModal);
