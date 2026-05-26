import React, { useMemo } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  formatOperationalNumber,
  getVisualStatusLabel,
} from './placaOrganizationUtils';

function SortablePlacaCard({ placa }) {
  const id = placa.id || placa._id;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="placa-org__card" {...attributes} {...listeners}>
      <div className="placa-org__card-head">
        <strong>{formatOperationalNumber(placa.numeroOperacional)}</strong>
        <span>{getVisualStatusLabel(placa)}</span>
      </div>
      <div className="placa-org__card-title">{placa.numero_placa || 'Placa sem nome'}</div>
      <div className="placa-org__card-subtitle">{placa.nomeDaRua || placa.localizacao || 'Local não informado'}</div>
      <div className="placa-org__card-subtitle">{placa.regiao_nome || placa.regiao?.nome || 'Sem região'}</div>
    </div>
  );
}

export default function PlacaOrganizationPanel({
  items,
  beforeItems,
  loading,
  saving,
  onDragEnd,
  onAutoOrganize,
  onApply,
  onCancel,
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const sortableIds = useMemo(
    () => items.map((item) => item.id || item._id),
    [items]
  );

  if (loading) {
    return <div className="placas-page__no-results">Carregando organização das placas...</div>;
  }

  if (!items.length) {
    return <div className="placas-page__no-results">Não há placas cadastradas ainda.</div>;
  }

  return (
    <section className="placa-org">
      <div className="placa-org__header">
        <h3>Organização Das Placas</h3>
        <p>Arraste os cards para organizar placas e ver antes de salvar.</p>
      </div>

      <div className="placa-org__actions">
        <button className="placa-org__btn" type="button" onClick={onAutoOrganize} disabled={saving}>
          Organizar Automaticamente
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="placa-org__grid">
            {items.map((item) => (
              <SortablePlacaCard key={item.id || item._id} placa={item} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="placa-org__preview">
        <div>
          <h4>Antes</h4>
          <ul>
            {beforeItems.map((item) => (
              <li key={`before-${item.id || item._id}`}>
                {formatOperationalNumber(item.numeroOperacional)} - {item.nomeDaRua || item.localizacao || item.numero_placa}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Depois</h4>
          <ul>
            {items.map((item) => (
              <li key={`after-${item.id || item._id}`}>
                {formatOperationalNumber(item.numeroOperacional)} - {item.nomeDaRua || item.localizacao || item.numero_placa}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="placa-org__footer">
        <button className="placa-org__btn placa-org__btn--secondary" type="button" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button className="placa-org__btn placa-org__btn--primary" type="button" onClick={onApply} disabled={saving}>
          {saving ? 'Salvando...' : 'Aplicar Nova Numeração'}
        </button>
      </div>
    </section>
  );
}
