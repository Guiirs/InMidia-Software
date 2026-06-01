# Handoff → Claude Code · InMidia V4.1 — Remediação UX/UI

> **O que é este documento.** Um *mapa de execução* que liga cada achado da auditoria UX/UI ao **arquivo exato** do repositório `Guiirs/InMidia-Software` (`REACT/src/…`) e à **mudança concreta** a aplicar. Não é uma recriação de telas em HTML — é o plano para corrigir o código que já existe.

---

## Como usar este mapa (leia primeiro)

1. **O arquivo `Auditoria UX-UI.html` neste bundle é o RELATÓRIO** — o diagnóstico completo (Fases 1–4), feito a partir de leitura direta do código de produção. Use-o como contexto/justificativa. **Não copie o HTML/CSS do relatório para o produto** — o relatório tem o próprio estilo (tema escuro editorial); o produto tem o dele.
2. **As mudanças reais vão em `REACT/src/…`** — sempre usando os padrões já estabelecidos do projeto (React + react-router + @tanstack/react-query + CSS por componente).
3. **Trabalhe na ordem P0 → P1 → P2 → P3.** P0 não é o mais difícil — é o que mais danifica a credibilidade enterprise por aparecer todo dia na tela.
4. Cada item abaixo traz: **arquivo · estado atual · mudança · critério de aceite**. Implemente o critério de aceite, não só o texto.

---

## Princípios inegociáveis (as 3 decisões que orientam tudo)

| # | Decisão | Por quê |
|---|---------|---------|
| 1 | **Uma única fonte de verdade de tokens.** `REACT/src/design/tokens.js` é canônico. O runtime CSS deve usar **só `--ds-*`**. `--bg-color`/`--text-color` (legado) e `--fdn-*` (foundation) viram **aliases** apontando para `--ds-*`, nunca valores independentes. | Hoje há 3 sistemas de tokens paralelos e componentes hardcodam cores fora de todos eles. |
| 2 | **Uma única cor de marca.** Primário = `--ds-primary` (`#2563EB`). Eliminar todo hex avulso (`#7485ff`, `#2F80ED`, `rgba(116,133,255,…)`). | A marca aparece em 3 azuis diferentes ao mesmo tempo (nav vs DS). |
| 3 | **Backend nunca fala com o usuário.** Todo enum/severidade/estado passa por uma camada de tradução (`statusMap`) antes da tela. Nenhuma string crua de domínio no JSX. | Hoje vazam `CONTRACTED_ACTIVE`, `critical`, e até texto corrompido `'ManutenÃ§Ã£o'`. |

---

# P0 — Parar o sangramento (Sprint 1)

### P0.1 · Corrigir texto corrompido (mojibake)
- **Arquivo:** `REACT/src/components/PlacaCard/PlacaCard.jsx` → função `getStatusInfo`, ramo `commercialStatus === 'MAINTENANCE'`.
- **Estado atual:**
  ```js
  } else if (commercialStatus === 'MAINTENANCE') {
    statusText = 'ManutenÃ§Ã£o';   // UTF-8 corrompido → vai pra tela
  ```
- **Mudança:** trocar por `'Manutenção'`. **E** rodar uma varredura de encoding em todo `REACT/src` (`grep` por sequências `Ã`, `Â`, `â€`) e corrigir todas. Salvar todos os arquivos como UTF-8.
- **Prevenção:** adicionar checagem de encoding no CI (ex.: lint que rejeita bytes inválidos).
- **Aceite:** nenhum `Ã`/`Â` espúrio no código; todos os acentos renderizam corretos.

### P0.2 · Camada de tradução de status (criar módulo novo)
- **Criar:** `REACT/src/utils/statusMap.js` — fonte única que recebe uma `placa` (ou um alerta) e devolve `{ key, label, tone }`. Centraliza os DOIS modelos de status que hoje vivem soltos no `PlacaCard` (o enum `commercialStatus` e os booleans `aluguel_ativo`/`aluguel_futuro`).
  ```js
  // statusMap.js — esboço
  export const PLACA_STATUS = {
    disponivel: { label: 'Disponível', tone: 'success' },
    ocupada:    { label: 'Ocupada',    tone: 'danger'  },
    reservada:  { label: 'Reservada',  tone: 'info'    },
    manutencao: { label: 'Manutenção', tone: 'warning' },
    erro:       { label: 'Indisponível', tone: 'neutral' },
  };

  // Deriva UM status canônico a partir de qualquer modelo recebido.
  export function resolvePlacaStatus(placa) {
    if (!placa) return 'erro';
    const cs = placa.temporalStatus ?? placa.commercialStatus ?? placa.statusComercial;
    if (cs === 'CONTRACTED_ACTIVE' || cs === 'OCCUPIED') return 'ocupada';
    if (cs === 'RESERVED' || cs === 'FUTURE_RESERVED')   return 'reservada';
    if (cs === 'MAINTENANCE')                            return 'manutencao';
    // fallback modelo legado (boolean)
    const disponivel = placa.disponivel ?? placa.ativa ?? true;
    if (placa.aluguel_ativo && placa.cliente_nome) {
      return placa.aluguel_futuro ? 'reservada' : 'ocupada';
    }
    return disponivel ? 'disponivel' : 'manutencao';
  }

  export const SEVERIDADE = {
    critical: { label: 'Crítico',  tone: 'danger'  },
    warning:  { label: 'Atenção',  tone: 'warning' },
    info:     { label: 'Informativo', tone: 'info' },
  };
  ```
- **Aplicar em:**
  - `PlacaCard.jsx` → `getStatusInfo` passa a chamar `resolvePlacaStatus(placa)` e ler `PLACA_STATUS[key]`. Remover todas as strings literais de status do componente.
  - `REACT/src/components/dashboard/SmartAlerts.jsx` (L15) → trocar `{alerta.severidade}` por `SEVERIDADE[alerta.severidade]?.label ?? '—'`.
  - `REACT/src/pages/Placas/PlacasPage.jsx` → opção de filtro `"Indisponível (Alugada)"` vira `"Ocupada"`; usar os mesmos rótulos do `PLACA_STATUS`.
- **Aceite:** `grep -r "CONTRACTED_ACTIVE\|critical\|warning\|Indisponível (Alugada)"` não retorna nada **dentro de JSX renderizado** (só dentro do `statusMap`).

### P0.3 · Consolidar tokens para UMA fonte de verdade
- **Arquivo:** `REACT/src/index.css` (blocos `:root`, `body.dark-theme`, `body.light-theme`).
- **Estado atual:** convivem `--bg-color`/`--text-color` (legado), `--ds-*` (tido como oficial) e `--fdn-*` (foundation). O próprio comentário do arquivo manda usar `--ds-*`, mas Dashboard/Sidebar usam `--fdn-*` + hex fixo.
- **Mudança:**
  1. Manter `--ds-*` como **únicos valores reais** (já espelham `tokens.js`).
  2. Reescrever os legados como aliases: `--bg-color: var(--ds-bg);`, `--text-color: var(--ds-text-primary);` etc.
  3. Definir os `--fdn-*` usados (`--fdn-color-surface`, `--fdn-color-border`, `--fdn-color-text-strong`, `--fdn-radius-*`…) como aliases de `--ds-*` num único lugar — **remover os fallbacks `var(--fdn-x, hex)` espalhados**.
  4. Idealmente: gerar `--ds-*` a partir de `tokens.js` em build (script) para que JS e CSS nunca divirjam.
- **Aceite:** existe um único bloco que define cor; todo o resto referencia variável. Nenhum hex de cor em `Dashboard.css`/`Sidebar.css`/`PlacaCard.css`.

### P0.4 · Unificar a cor de marca
- **Arquivos:** `REACT/src/components/Sidebar/Sidebar.css`, `REACT/src/pages/Dashboard/Dashboard.css`.
- **Estado atual:** Sidebar hover/ativo = `rgba(116,133,255,.14/.28)` e switch `#2F80ED`; Dashboard ícones/acentos = `#7485ff`. Token de marca = `#2563EB`.
- **Mudança:** substituir todos por `var(--ds-primary)` / `var(--ds-primary-soft)` / `var(--ds-primary-subtle)`. **Decisão de produto:** se a equipe prefere o periwinkle (`#6E8BFF`-ish do redesign anterior), então **mude o token** `--ds-primary` para esse valor e propague — mas escolha **um** e use o token, nunca hex solto.
- **Aceite:** uma só cor primária em toda a UI, vinda de `--ds-primary`.

### P0.5 · Consertar o modo claro
- **Arquivo:** `REACT/src/pages/Dashboard/Dashboard.css`.
- **Estado atual:** `.dashboard-summary-card`, `.dashboard-list__item`, `.funnel-card` etc. hardcodam fundo escuro `rgba(20,27,41,.94)`/`rgba(17,25,40,.5x)`; o claro é “consertado” por cima com `body.light-theme:not(.foundation-theme) …`.
- **Mudança:** trocar os fundos fixos por `var(--ds-surface)` / `var(--ds-surface-elevated)` e bordas por `var(--ds-border)`. Deixar o tema (claro/escuro) trocar **só os tokens**, nunca o componente. Remover os overrides `body.light-theme …` que viram desnecessários.
- **Aceite:** alternar tema não exige seletor de correção; cards corretos em ambos os modos.

---

# P1 — Reconstruir os pontos de maior tráfego (Sprint 2–3)

### P1.1 · Dashboard operacional (hierarquia de comando)
- **Arquivo:** `REACT/src/pages/Dashboard/DashboardPage.jsx` (ordem de render) + `REACT/src/components/dashboard/OverviewCards.jsx`.
- **Estado atual:** 8 KPIs de peso idêntico no topo, depois 7 blocos empilhados; `SmartAlerts` (exceções) só aparece no 6º bloco.
- **Mudança — nova ordem de render:**
  1. **Faixa de Exceções/Ações** (mover `SmartAlerts` para o topo absoluto; renomear seção — ver P1.2).
  2. **2 métricas-herói** — Receita estimada e Taxa de ocupação, grandes, com tendência. Criar variante visual “hero” no `OverviewCards` (ou um `HeroMetrics`).
  3. **KPIs secundários** compactos (os 6 restantes), menores, abaixo.
  4. Funil, ranking, ociosas, tabela de regiões — detalhe sob demanda.
- **`OverviewCards`:** parametrizar peso (`variant: 'hero' | 'compact'`) em vez de 8 cards iguais. `CARD_META` já existe — só dividir em dois grupos.
- **Aceite:** ao abrir o dashboard, a primeira coisa visível é “o que precisa de ação” + métricas decisivas, não 8 números iguais.

### P1.2 · Renomear seção “Oportunidades”
- **Arquivo:** `REACT/src/components/dashboard/SmartAlerts.jsx`.
- **Estado atual:** título `Oportunidades`, mas lista severidades de risco (`critical`/`warning`).
- **Mudança:** título → **“Exceções operacionais”** (ou “Precisa de atenção”). Cada item mostra severidade traduzida (P0.2) + título + ação sugerida.
- **Aceite:** nome da seção descreve o conteúdo; nenhuma severidade em inglês.

### P1.3 · Novo PlacaCard (remover redundância e ruído)
- **Arquivos:** `REACT/src/components/PlacaCard/PlacaCard.jsx` + `PlacaCard.css`.
- **Estado atual (11 elementos/ card):** banner com `#01` + título-código; corpo repete **“Placa 01”** e **“Código X”**; eyebrow fixo **“Ativo operacional”**; ponto de sync **pulsante em todo card**; faixa-de-cor 3px + sombra pesada.
- **Mudança — anatomia alvo (responde 3 perguntas em 3s: qual placa · estado · onde):**
  - **Um** identificador (código, mono) — eliminar a duplicação banner↔corpo.
  - **Um** badge de status (do `PLACA_STATUS`), canto superior.
  - **Localização** legível (subir de ~13px para ~14–15px; é o dado-chave).
  - **Ações** (toggle/editar/excluir) reveladas em **hover/foco**, não permanentes.
  - **Cliente + datas** só quando `ocupada`/`reservada`.
  - Remover eyebrow “Ativo operacional” e o `sync-dot` por card (sync indicado **uma vez** no header global — ver P2).
  - Sombra sutil (`var(--ds-shadow-card)`), **sem** `border-left` colorido em todo card (o estado já é o badge).
- **Aceite:** código aparece 1×; sem animação por card; card lê-se em <3s.

### P1.4 · Modelo de status único no front
- Já endereçado por **P0.2** (`resolvePlacaStatus`). Garantir que `PlacaCard`, `PlacasPage` (contadores `statusCounts`) e o resumo usem **a mesma função** — hoje `PlacasPage.statusCounts` reimplementa a lógica de status à mão.
- **Aceite:** uma só função decide status em todo o app.

### P1.5 · Tipografia mobile (parar de encolher a base)
- **Arquivo:** `REACT/src/index.css` (media queries no fim).
- **Estado atual:** `html { font-size: 62.5% }` cai para `56.25%` (9px) e `50%` (8px).
- **Mudança:** remover os passos de encolhimento ou pôr piso. Corpo mínimo **14px**. Preferir ajustar tamanhos por componente (clamp/rem) em vez de mexer na base global.
- **Aceite:** nenhum texto de conteúdo abaixo de 14px em qualquer viewport.

---

# P2 — Polir e padronizar (Sprint 4–5)

### P2.1 · Navegação por intenção
- **Arquivo:** `REACT/src/components/Sidebar/Sidebar.jsx` (+ `Sidebar.css` para os rótulos de grupo).
- **Estado atual:** lista plana de 9 itens; rótulos sem acento (**“Regioes”, “Relatorios”**); `Sync Ops` (dev) e `Auditoria` no mesmo nível da operação.
- **Mudança:**
  - Agrupar com cabeçalhos: **OPERAÇÃO** (Dashboard, Placas, Regiões, Mapa) · **COMERCIAL** (Propostas, Contratos, Clientes) · **GESTÃO** (Relatórios, Bi-Semanas) · **SISTEMA** (Admin, Auditoria, Sync Ops — visualmente separado, idealmente fora do menu principal).
  - Corrigir acentos: **“Regiões”, “Relatórios”**.
- **Aceite:** menu agrupado, acentuação correta, dev tools segregados.

### P2.2 · Tabelas responsivas
- **Arquivo:** `REACT/src/pages/Dashboard/Dashboard.css` (`.dashboard-table { min-width: 780px }`) e demais tabelas (ex.: `ContratoTable`, `PITable`).
- **Mudança:** colunas prioritárias + colapso para lista/cards em mobile; remover `min-width` que força scroll horizontal.
- **Aceite:** nenhuma tabela com scroll horizontal em tablet/mobile.

### P2.3 · Sistema de Badges/Status documentado
- Consolidar a anatomia do badge (cor semântica **+ texto**, nunca cor sozinha; tamanho/peso idênticos em card, tabela e detalhe). Reaproveitar `status-pill` (Dashboard) e `placa-card__badge` num só componente `StatusBadge` lendo `tone` do `statusMap`.
- **Aceite:** um componente de badge usado em toda a UI.

### P2.4 · Aliviar decoração
- Sync em tempo real indicado **uma vez** (header/global), não por card.
- Sombras sutis (token), sem faixa-de-cor universal.
- **Aceite:** grade de 10+ cards visualmente calma.

---

# P3 — Dívida estrutural (contínuo)

- **P3.1** Remover a fronteira `.legacy-root` migrando telas V3 restantes (busca por `.legacy-root`/`.v4p-root`).
- **P3.2** Paginação escalável em `PlacasPage` (cursor / “carregar mais” / janela de páginas) — hoje monta `1…N` botões via `cloneElement`.
- **P3.3** Mobile real: drawer de navegação + alvos de toque ≥44px.
- **P3.4** Documentar o DS (Storybook/MDX) para o token voltar a ser **vinculante**, não aspiracional.

---

## Design Tokens canônicos (já existem — use, não reinvente)

Fonte: `REACT/src/design/tokens.js`. **Mantenha esta base** (escala Slate, semântica completa). A correção é *consolidar*, não trocar.

| Token | Valor | Uso |
|-------|-------|-----|
| `--ds-bg` | `#F8FAFC` (claro) / `#020617` (escuro) | fundo de página |
| `--ds-surface` | `#FFFFFF` / `#0F172A` | cards, painéis |
| `--ds-surface-elevated` | `#F1F5F9` / `#1E293B` | hover, aninhado |
| `--ds-border` | `#E2E8F0` / `#334155` | bordas |
| `--ds-text-primary` | `#0F172A` / `#F8FAFC` | texto principal |
| `--ds-text-secondary` | `#475569` / `#CBD5E1` | texto secundário |
| `--ds-primary` | `#2563EB` | **marca (única)** |
| `--ds-success` | `#16A34A` | Disponível |
| `--ds-danger` | `#DC2626` | Ocupada |
| `--ds-info` | `#0891B2` | Reservada |
| `--ds-warning` | `#D97706` | Manutenção |

Escala: espaçamento base 4px, radius `sm 4 / md 8 / lg 10 / xl 12`, tipografia `xs 12 → 5xl 48`, pesos 400/500/600/700. (Tudo em `tokens.js`.)

> **Nota de aceite de cor:** o card hoje usa verde `#22C55E`/`#87f0b2` — alinhar ao token `--ds-success` `#16A34A` (ou ao soft correspondente). Sem hex avulso.

---

## Mapa rápido arquivo → ações

| Arquivo | Ações |
|---------|-------|
| `components/PlacaCard/PlacaCard.jsx` | P0.1 mojibake · P0.2 usar `statusMap` · P1.3 nova anatomia · P1.4 status único |
| `components/PlacaCard/PlacaCard.css` | P1.3 remover faixa-de-cor/sombra pesada/sync-dot · P0.4 cor via token |
| `utils/statusMap.js` *(novo)* | P0.2 fonte única de status/severidade |
| `index.css` | P0.3 consolidar tokens · P0.4 marca · P1.5 tipografia mobile |
| `pages/Dashboard/DashboardPage.jsx` | P1.1 nova ordem (exceções no topo) |
| `components/dashboard/OverviewCards.jsx` | P1.1 hero vs compact |
| `components/dashboard/SmartAlerts.jsx` | P0.2 severidade traduzida · P1.2 renomear seção |
| `pages/Dashboard/Dashboard.css` | P0.5 modo claro via token · P0.4 cor · P2.2 tabela responsiva |
| `components/Sidebar/Sidebar.jsx` | P2.1 agrupar + acentos · mover Sync Ops |
| `components/Sidebar/Sidebar.css` | P0.4 cor de marca via token |
| `pages/Placas/PlacasPage.jsx` | P0.2 rótulos de filtro · P1.4 reusar status único · P3.2 paginação |

---

## Checklist de aceite (Definition of Done)

- [ ] Zero mojibake no repositório; CI valida encoding.
- [ ] Um único bloco define cores; tudo o mais referencia `--ds-*`. Nenhum hex de cor em CSS de componente.
- [ ] Uma só cor primária de marca em toda a UI.
- [ ] Modo claro e escuro corretos só trocando tokens (sem seletores de correção).
- [ ] Nenhum enum/severidade/estado cru no JSX — tudo via `statusMap`.
- [ ] Dashboard abre com exceções + métricas-herói antes dos KPIs secundários.
- [ ] PlacaCard: código 1×, sem ruído/animação por card, status via badge único, lê-se em <3s.
- [ ] Navegação agrupada, acentuação correta, dev tools segregados.
- [ ] Nenhum texto de conteúdo < 14px; nenhuma tabela com scroll horizontal em mobile.

---

## Arquivos neste bundle

- `Auditoria UX-UI.html` + `audit.css` — o relatório completo (Fases 1–4) para contexto/justificativa.
- `README.md` — este mapa de execução.

> Lembrete: o HTML é **referência de diagnóstico**, não código de produção. Toda implementação acontece em `REACT/src/…` seguindo os padrões já existentes do projeto.
