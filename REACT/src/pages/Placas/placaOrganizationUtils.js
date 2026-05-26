export function normalizeOperationalList(placas = []) {
  return [...placas]
    .map((placa, index) => ({
      ...placa,
      numeroOperacional: typeof placa.numeroOperacional === 'number' ? placa.numeroOperacional : index + 1,
    }))
    .sort((a, b) => (a.numeroOperacional ?? 0) - (b.numeroOperacional ?? 0));
}

export function detectOperationalGaps(placas = []) {
  const normalized = normalizeOperationalList(placas);
  if (normalized.length === 0) {
    return { gapCount: 0, gaps: [] };
  }

  const numbers = normalized
    .map((placa) => placa.numeroOperacional)
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);

  if (numbers.length === 0) {
    return { gapCount: 0, gaps: [] };
  }

  const gaps = [];
  const start = numbers[0];
  const end = numbers[numbers.length - 1];
  const numberSet = new Set(numbers);

  for (let value = start; value <= end; value++) {
    if (!numberSet.has(value)) gaps.push(value);
  }

  return { gapCount: gaps.length, gaps };
}

export function buildAutoOrganizationPreview(placas = []) {
  const before = normalizeOperationalList(placas);
  const after = before.map((placa, index) => ({
    ...placa,
    numeroOperacional: index + 1,
  }));

  return { before, after };
}

export function applyDragMove(items = [], activeId, overId) {
  if (!overId || activeId === overId) return items;

  const oldIndex = items.findIndex((item) => item.id === activeId || item._id === activeId);
  const newIndex = items.findIndex((item) => item.id === overId || item._id === overId);

  if (oldIndex < 0 || newIndex < 0) return items;

  const next = [...items];
  const [moved] = next.splice(oldIndex, 1);
  next.splice(newIndex, 0, moved);

  return next.map((item, index) => ({
    ...item,
    numeroOperacional: index + 1,
  }));
}

export function formatOperationalNumber(value) {
  const num = Number(value) || 0;
  return `#${String(num).padStart(3, '0')}`;
}

export function getVisualStatusLabel(placa) {
  if (placa?.arquivada) return 'Arquivada';
  const disponivel = placa?.disponivel ?? placa?.ativa ?? true;
  return disponivel ? 'Ativa' : 'Inativa';
}

export function getFriendlyOrganizationError() {
  return 'Não foi possível salvar a nova ordem. Tente novamente.';
}
