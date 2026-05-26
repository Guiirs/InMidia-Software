import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import PlacaOrganizationPanel from './PlacaOrganizationPanel';

describe('PlacaOrganizationPanel', () => {
  it('renderiza cards de placas na organizacao', () => {
    const html = renderToString(
      <PlacaOrganizationPanel
        items={[
          { id: '1', numeroOperacional: 1, numero_placa: 'A-1', nomeDaRua: 'Av. A', regiao_nome: 'Centro', disponivel: true },
          { id: '2', numeroOperacional: 2, numero_placa: 'A-2', nomeDaRua: 'Av. B', regiao_nome: 'Norte', disponivel: false },
        ]}
        beforeItems={[
          { id: '1', numeroOperacional: 1, numero_placa: 'A-1', nomeDaRua: 'Av. A', regiao_nome: 'Centro', disponivel: true },
          { id: '2', numeroOperacional: 3, numero_placa: 'A-2', nomeDaRua: 'Av. B', regiao_nome: 'Norte', disponivel: false },
        ]}
        loading={false}
        saving={false}
        onDragEnd={() => {}}
        onAutoOrganize={() => {}}
        onApply={() => {}}
        onCancel={() => {}}
      />
    );

    expect(html).toContain('Organização Das Placas');
    expect(html).toContain('A-1');
    expect(html).toContain('A-2');
  });
});
