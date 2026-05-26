import { memo, useState } from 'react';
import BoardStatusBadge from './BoardStatusBadge.jsx';
import { getStateMeta } from '../../foundation/operationalStates.js';
import { getPriorityMeta } from '../../foundation/priorities.js';
import './InventoryTable.css';

const COL = [
  { id: 'codigo', label: 'Codigo' },
  { id: 'local', label: 'Localizacao' },
  { id: 'status', label: 'Status' },
  { id: 'cliente', label: 'Cliente' },
  { id: 'campanha', label: 'Campanha' },
  { id: 'vencimento', label: 'Vencimento' },
  { id: 'receita', label: 'Receita/mes' },
  { id: 'prioridade', label: 'Prioridade' },
  { id: 'acao', label: 'Acao' },
];

const FALLBACK_DUE = ['3 dias', '8 dias', '11 dias', '18 dias', '24 dias', '32 dias', '45 dias'];

function getDueLabel(board, index) {
  if (board.status === 'available') return board.diasOcioso ? `Livre ha ${board.diasOcioso}d` : 'Livre';
  if (board.status === 'maintenance') return 'Retorno 48h';
  if (board.status === 'reserved') return '3 dias';
  if (board.status === 'critical') return 'SLA hoje';
  return FALLBACK_DUE[index % FALLBACK_DUE.length];
}

function getActionLabel(board) {
  if (board.status === 'available') return 'Indisponibilizar';
  if (board.status === 'maintenance') return 'Disponibilizar';
  if (board.status === 'critical') return 'Acionar';
  if (board.status === 'reserved') return 'Renovar';
  return 'Contrato';
}

function PriorityChip({ priority }) {
  const meta = getPriorityMeta(priority);
  return (
    <span className="v4p-inv-table__priority" style={{ '--v4p-priority-color': meta.color }}>
      {meta.label}
    </span>
  );
}

function InventoryTable({ boards = [], onSelectBoard, onActionBoard, actionLoading = false }) {
  const [sortCol, setSortCol] = useState('codigo');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (colId) => {
    if (colId === 'acao') return;
    if (sortCol === colId) setSortAsc(value => !value);
    else {
      setSortCol(colId);
      setSortAsc(true);
    }
  };

  const sortedBoards = [...boards].sort((a, b) => {
    const valueMap = {
      codigo: [a.codigo, b.codigo],
      local: [a.nome, b.nome],
      status: [a.status, b.status],
      cliente: [a.cliente ?? '', b.cliente ?? ''],
      campanha: [a.campanha ?? '', b.campanha ?? ''],
      receita: [a.receitaEstimada, b.receitaEstimada],
      prioridade: [a.prioridade, b.prioridade],
    };
    const [va, vb] = valueMap[sortCol] ?? [a.codigo, b.codigo];
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });

  return (
    <div className="v4p-inv-table">
      <table>
        <thead>
          <tr>
            {COL.map(col => (
              <th
                key={col.id}
                onClick={() => handleSort(col.id)}
                className={`v4p-inv-table__col--${col.id}${sortCol === col.id ? ' is-sorted' : ''}`}
              >
                <span>{col.label}</span>
                {sortCol === col.id && (
                  <span aria-hidden="true" className="v4p-inv-table__sort">
                    {sortAsc ? 'arrow_upward' : 'arrow_downward'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedBoards.map((board, index) => {
            const stateMeta = getStateMeta(board.estado);
            return (
              <tr
                key={board.id}
                onClick={() => onSelectBoard?.(board)}
                className={onSelectBoard ? 'is-clickable' : undefined}
                style={{ '--v4p-row-accent': stateMeta.color }}
              >
                <td className="v4p-inv-table__col--codigo">
                  <span className="v4p-inv-table__code v4p-mono">{board.codigo}</span>
                </td>
                <td className="v4p-inv-table__col--local">
                  <div className="v4p-inv-table__location">
                    <strong>{board.nome}</strong>
                    <span>{board.localizacao}</span>
                  </div>
                </td>
                <td className="v4p-inv-table__col--status">
                  <BoardStatusBadge status={board.status} size="sm" />
                </td>
                <td className="v4p-inv-table__col--cliente">
                  <span className={board.cliente ? 'v4p-inv-table__text' : 'v4p-inv-table__muted'}>
                    {board.cliente ?? 'Sem cliente'}
                  </span>
                </td>
                <td className="v4p-inv-table__col--campanha">
                  <span className={board.campanha ? 'v4p-inv-table__text' : 'v4p-inv-table__muted'}>
                    {board.campanha ?? 'Disponivel para venda'}
                  </span>
                </td>
                <td className="v4p-inv-table__col--vencimento">
                  <span className="v4p-inv-table__due">{getDueLabel(board, index)}</span>
                </td>
                <td className="v4p-inv-table__col--receita">
                  <span className="v4p-inv-table__revenue">{board.receitaFormatada}</span>
                </td>
                <td className="v4p-inv-table__col--prioridade">
                  <PriorityChip priority={board.prioridade} />
                </td>
                <td className="v4p-inv-table__col--acao">
                  <button
                    type="button"
                    className="v4p-inv-table__action"
                    disabled={actionLoading}
                    onClick={(event) => {
                      event.stopPropagation();
                      onActionBoard?.(board);
                    }}
                  >
                    {actionLoading ? '...' : getActionLabel(board)}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {boards.length === 0 && (
        <div className="v4p-inv-table__empty">
          Nenhuma placa encontrada com os filtros aplicados.
        </div>
      )}
    </div>
  );
}

export default memo(InventoryTable);
