# REVIEW COMPLETO — V4 PAINEL InMidia
**Data:** 19 Mai 2026  
**Auditor:** Revisão técnica completa — Partes 1 a 5  
**Escopo:** `REACT/src/v4-painel/` — 183 arquivos

---

## 1. Resumo Executivo

O v4-painel representa uma fundação arquitetural sólida e visualmente enterprise para o novo InMidia. O isolamento de dependências externas é perfeito — zero imports funcionais de serviços reais, React Query ou contextos do sistema legado. A linguagem operacional é consistente. O design system é reutilizável e coerente.

Porém, foram identificados **3 problemas bloqueantes** para integração real e **14 problemas de médio/baixo risco** que devem ser endereçados antes ou durante a integração. O maior risco real é uma **inconsistência de campo em dados de alertas** que, se não corrigida, causará bugs silenciosos no momento em que o provider real for conectado.

---

## 2. Veredito Geral

**PARCIALMENTE PRONTO** para iniciar integração real.

A integração pode iniciar **apenas após corrigir os 3 problemas bloqueantes** listados abaixo. O restante pode ser feito em paralelo à integração sem risco estrutural.

---

## 3. Pontos Fortes

| Dimensão | Avaliação | Evidência |
|----------|-----------|-----------|
| Isolamento de dependências | ⭐⭐⭐⭐⭐ Perfeito | Zero imports de `services/`, `@tanstack`, `axios`, `AuthContext` nos arquivos `.jsx/.js` funcionais |
| Design system | ⭐⭐⭐⭐ Muito bom | Tokens CSS completos (`--v4p-*`), 9 componentes base coesos, `memo()` em todos |
| Foundation layer | ⭐⭐⭐⭐⭐ Excelente | 6 arquivos puros sem React, reutilizáveis por qualquer camada futura |
| Governança | ⭐⭐⭐⭐ Muito bom | `pageRegistry`, `featureFlags`, `integrationBoundaries`, `runtimeContracts` bem definidos |
| Linguagem operacional | ⭐⭐⭐⭐ Muito bom | Nenhum termo técnico exposto na UI em qualquer página |
| Padrão de roteamento | ⭐⭐⭐⭐ Muito bom | `renderPage()` switch-case em `V4Painel.jsx` — simples, testável, sem acoplamento com router |
| Contratos de integração | ⭐⭐⭐⭐ Muito bom | 7 contratos documentados com classificação por campo (`existente`, `derivado`, `novo`, `parcial`) |
| Cobertura de páginas | ⭐⭐⭐⭐ Muito bom | 8 de 11 páginas implementadas com dados mockados realistas |

---

## 4. Problemas Encontrados

### 4.1 BLOQUEANTES (corrigir antes da integração)

| ID | Problema | Evidência |
|----|---------|-----------|
| **B-01** | **Alert field naming mismatch: `read` vs `lido`** | `systemHealthMock.js` usa `read: false`. `alertsMockData.js` usa `lido: false`. O `OperationalStateProvider` filtra por `.read` — mas `SmartAlertsPanel` e `AlertsCenter` consomem `.lido`. São dois sistemas de alerta com schemas divergentes. |
| **B-02** | **`lastSyncLabel` é completamente estático** | `MOCK_SYSTEM_HEALTH.lastSyncLabel = 'há 42 segundos'` — string hardcoded que nunca muda. `MockRuntimeProvider` atualiza `lastSync` (Date) a cada 30s mas esse valor nunca é convertido para a label exibida na topbar. |
| **B-03** | **`DAY_BRIEF_CHIPS` na Dashboard é hardcode puro** | 7 chips no header da Dashboard (linhas 38-46 de `DashboardPage.jsx`) com valores como `'661 placas ativas'`, `'R$ 284.750'`, `'19 Mai 2026'` são constantes estáticas que nunca atualizam. Divergem do provider e dos KPIs abaixo deles. |

### 4.2 ALTO RISCO

| ID | Problema | Evidência |
|----|---------|-----------|
| **A-01** | **SVG gradient IDs duplicados** | `RevenueProjectionCard.jsx:30` define `id="rev-area-grad"`. `RevenueAnalytics.jsx:45` define `id="ra-grad"`. Se ambos aparecerem simultaneamente na mesma página, navegadores aplicarão o primeiro `<defs>` para os dois — gradiente incorreto silencioso. |
| **A-02** | **4 componentes chart completamente órfãos** | `OccupancyChart`, `RevenueChart`, `RegionalHeatChart`, `FunnelChart` existem em `components/charts/` mas não são importados por **nenhuma** página ou componente. Dead code confirmado. |
| **A-03** | **`useV4Theme` criado mas desconectado** | `ThemeProvider.jsx` fornece `density` via contexto, mas `AppShell.jsx:36` hardcoda `data-density="default"`. Nenhum componente usa `useV4Theme()`. O sistema de densidade existe na teoria mas é inoperante. |
| **A-04** | **`dashboardSections.js` criado mas nunca importado** | `pages/dashboard/dashboardSections.js` define `SECTION_CONFIG` e `DASHBOARD_HEADER` mas não há um único import desse arquivo no projeto. Arquivo fantasma. |

### 4.3 MÉDIO RISCO

| ID | Problema | Evidência |
|----|---------|-----------|
| **M-01** | **`pathFor` função definida mas nunca chamada** | `RevenueProjectionCard.jsx:18` — `const pathFor = (pts, startIndex) => ...` definida mas o SVG não a usa. |
| **M-02** | **`STATUS_MAP` e `pMap` dentro do render** | `InventoryPage.jsx:21,29` — dois objetos de mapeamento recriados em cada render. Deveriam ser constantes de módulo. |
| **M-03** | **`MOCK_PERIODS` importado mas não usado** | `DashboardPage.jsx:9` importa `MOCK_PERIODS` de `userMock.js`, mas não há referência no JSX. |
| **M-04** | **12 instâncias de mutação direta de DOM** | `onMouseEnter/onMouseLeave` mutam `e.currentTarget.style` em `ActionButton`, `InventoryTable`, `ContractsTable`, `AlertsCenter`, `RegionHeatmap`, `PreviewLauncher`. Bypassa React. |
| **M-05** | **Datas hardcoded que vencerão** | `"19 Mai 2026"` aparece em `DashboardPage.jsx:81`, `ExecutiveSummary.jsx:84`, `RevenueProjectionCard.jsx:81`. Após essa data a UI fica desatualizada. |
| **M-06** | **`componentRegistry.js` incompleto** | Registry lista 30 componentes, mas o sistema tem ~62. Componentes de `commercial/`, `contracts/`, `reports/`, `alerts/`, `preview/` não estão no registro. |
| **M-07** | **Ausência de Error Boundaries** | Nenhum `ErrorBoundary` no sistema. Um erro em `DashboardPage` derruba o shell inteiro. |
| **M-08** | **`MOCK_USER` hardcoded dentro do `AppShell`** | `AppShell.jsx:42-46` importa e usa `MOCK_USER` diretamente. Quando o `AuthProvider` real for criado, precisará modificar `AppShell` — viola o princípio de que o shell não deveria conhecer a fonte de dados do usuário. |

### 4.4 BAIXO RISCO

| ID | Problema | Evidência |
|----|---------|-----------|
| **L-01** | **Preview acessível via "Configurações"** | `V4Painel.jsx:68` mapeia `CONFIGURACOES` para `V4PreviewPage`. Em demos, usuários podem clicar em "Configurações" e ver o blueprint técnico interno. |
| **L-02** | **Naming confuso: `components/operational` vs `components/operations`** | Dois diretórios quase homônimos com propósitos distintos — `operational/` (usados pela Dashboard) e `operations/` (usados pela OperationsPage). Dificulta onboarding de novos devs. |
| **L-03** | **CSS de páginas com padrões repetitivos** | Cada `*Page.css` replica o mesmo padrão de classes (`.v4p-*-page`, `.v4p-*-header`, `.v4p-*-label`, `.v4p-*-grid`). Poderia ser consolidado em `styles/pages.css`. |
| **L-04** | **`useRuntimeSimulation` recebe nova referência a cada render** | `MockRuntimeProvider` passa `() => setLastSync(new Date())` como `onTick` a cada render. Como o efeito depende de `onTick`, o intervalo é cancelado e reiniciado a cada render do provider. |
| **L-05** | **Checklist de qualidade com todos os itens em `status:'pass'`** | Os 5 checklists têm `status:'pass'` hardcoded em todos os itens. Não refletem os problemas reais encontrados neste review (ex: `A-016` de acessibilidade deveria ser `warn`). O score de "100%" é artificialmente alto. |
| **L-06** | **`OperationalCard` do design system subutilizado** | `OperationalCard.jsx` foi criado como componente base mas nenhuma página real o utiliza — usam diretamente a classe CSS `v4p-surface-card`. |

---

## 5. Riscos por Severidade

### 🔴 CRÍTICO
**Nenhum risco crítico** — zero imports de dependências reais. O isolamento é total.

### 🟠 ALTO
**B-01 — Alert field naming mismatch (`read` vs `lido`)**  
- **Evidência:** `OperationalStateProvider` → `alerts.filter(a => !a.read)` / `alertsMockData.js` → `lido: false`  
- **Impacto:** Na integração real, quando o provider real fornece alertas com um campo (`read` ou `lido`), metade das páginas exibirá comportamento incorreto silenciosamente  
- **Recomendação:** Unificar para `read` (inglês, mais compatível com APIs REST) ou `lido` (pt-BR, mais consistente com a linguagem do produto) — escolher um e corrigir **agora**  
- **Prioridade:** Imediata

**B-02 — `lastSyncLabel` estático**  
- **Evidência:** `MOCK_SYSTEM_HEALTH.lastSyncLabel = 'há 42 segundos'` — nunca muda  
- **Impacto:** A UI sempre mostrará "há 42 segundos" independentemente de quando a página foi carregada  
- **Recomendação:** Calcular label dinamicamente a partir de um `Date` no `OperationalStateProvider`  
- **Prioridade:** Imediata

### 🟡 ALTO-MÉDIO
**A-01 — SVG gradient IDs duplicados**  
- **Evidência:** `id="rev-area-grad"` em `RevenueProjectionCard.jsx` e `id="ra-grad"` em `RevenueAnalytics.jsx`  
- **Impacto:** Se ambos os componentes aparecerem na mesma página (ex: Dashboard + Reports), o segundo SVG usa o gradiente do primeiro — visual incorreto  
- **Recomendação:** Usar `useId()` do React 18 ou gerar ID único por instância  
- **Prioridade:** Antes da Fase 1

**A-02 — 4 componentes chart órfãos**  
- **Evidência:** `components/charts/*.jsx` — zero imports no projeto inteiro  
- **Impacto:** Aumentam bundle size sem uso, criam confusão no onboarding  
- **Recomendação:** Remover ou integrar nas páginas correspondentes  
- **Prioridade:** Antes da Fase 1

### 🟢 MÉDIO-BAIXO
**M-04 — Mutações diretas de DOM (12 instâncias)**  
- **Evidência:** `e.currentTarget.style.background = ...` em 6 arquivos  
- **Impacto:** Bypassa React, dificulta testes, pode causar inconsistências em modo strict  
- **Recomendação:** Substituir por estado local `isHovered` + estilo condicional  
- **Prioridade:** Durante integração

**M-07 — Ausência de Error Boundaries**  
- **Evidência:** Nenhum `componentDidCatch` ou `ErrorBoundary` em todo o sistema  
- **Impacto:** Um erro em componente de detalhe derruba a página inteira  
- **Recomendação:** Adicionar `ErrorBoundary` no nível de cada página  
- **Prioridade:** Antes da Fase 2

---

## 6. Review de Arquitetura

**Avaliação: APROVADO com ressalvas**

### Pontos fortes
- Separação de responsabilidades em camadas (L0→L5) é correta e bem implementada
- `AppShell` funciona em modo controlado e autônomo — correto para suportar integração futura
- O padrão `Mock → Contract → Provider Real` está documentado e é sólido
- O `renderPage(activeItemId, navigate)` é simples e testável sem overhead de router

### Problemas arquiteturais
- **`MOCK_USER` dentro do `AppShell`**: O shell não deve conhecer a origem dos dados do usuário. Esse dado deve vir de prop ou de um `AuthContext` próprio do v4. É um acoplamento que precisará ser desfeito na Fase 1.
- **`useV4Theme` completamente desconectado**: O `ThemeProvider` existe mas não influencia nada no sistema atual. A densidade e o tema são opções mortas.
- **Dois diretórios homônimos**: `components/operational/` e `components/operations/` criam confusão de navegação para novos colaboradores. Convencionar nomes distintos reduz custo cognitivo.

### Isolamento — CONFIRMADO
```
✅ Nenhum import de services/ reais
✅ Nenhum import de @tanstack/react-query
✅ Nenhum import de axios ou fetch() direto
✅ Nenhum import de AuthContext do sistema legado
✅ Nenhum import de rotas do sistema legado
```

---

## 7. Review de UX/UI

**Avaliação: BOM com ponto de atenção em densidade da Dashboard**

### Pontos fortes
- Shell premium dark visualmente coerente e enterprise
- Sidebar compacta com estados ativos claros
- Topbar funcional com controles bem posicionados
- Hierarquia tipográfica clara em todas as páginas
- `StatusBadge` consistente em todos os estados operacionais

### Problemas de UX

**Dashboard — Sobrecarga de informação**  
A Dashboard tem **8 seções** com scroll extenso. Um executivo real que abrir a página pela primeira vez precisa rolar por: KPIs → Análise executiva → Receita/Ocupação → Pipeline/Alertas → Placas críticas/Contratos → Inventário ocioso → Timeline/Recomendações. Isso é muita informação vertical para uma "visão geral".  
**Recomendação:** Considerar um "hero block" acima da dobra com 3-4 indicadores críticos e deixar as seções detalhadas abaixo.

**Preview acessível via "Configurações"**  
Na sidebar, o item "Configurações" leva para a `V4PreviewPage` (blueprint técnico). Em uma demonstração real para clientes ou gestores, isso é inadequado.  
**Recomendação:** Mover o preview para uma rota separada não-navegável (ex: `/v4/preview` sem entrada no sidebar), ou adicionar um guard que só mostra para role `admin`.

**Inconsistência de alertas entre Dashboard e AlertsPage**  
A Dashboard tem `SmartAlertsPanel` (com alertas do provider) e a AlertsPage tem `AlertsCenter` (com alertas locais de `alertsMockData.js`). São dados diferentes, sem estado compartilhado. Um alerta descartado na AlertsPage não some da Dashboard.

**Sidebar item "Regiões" vs página "Mapa Operacional"**  
O nav label é "Regiões" mas o `h1` da página é "Mapa Operacional". Pequena inconsistência que confunde usuários durante a navegação.

---

## 8. Review de Design System

**Avaliação: MUITO BOM**

### Tokens
- Sistema de tokens completo e hierárquico: primitivas (`--p-*`) → semânticos (`--v4p-*`)
- Inter carregada via Google Fonts (depende de CDN — adicionar fallback)
- Material Symbols Rounded **não tem `<link>` no HTML** — os ícones dependem de CDN sem ser declarados

### Componentes
- 9 componentes base com `memo()` e responsabilidades claras
- `ActionButton` usa `onMouseEnter/Leave` para hover — padrão incorreto (ver M-04)
- `OperationalCard` criado mas subutilizado — as páginas usam classe CSS diretamente
- `LoadingState` tem `@keyframes v4p-skeleton` definido **inline** no JSX. Se múltiplas instâncias do componente existirem, esse style block é injetado N vezes no DOM

### Consistência
- CSS classes (`v4p-*`) e inline styles coexistem — inconsistência esperada num blueprint, mas deve ser consolidada antes da produção
- Estilos de hover via mutação DOM em 6 arquivos vs CSS hover declarativo em outros — padrão duplo

---

## 9. Review de Produto

**Avaliação: MUITO BOM como blueprint; algumas redundâncias a resolver**

### A proposta é clara?
Sim. O v4-painel comunica claramente "Central Operacional OOH" com inventário, operações, comercial e contratos integrados. A linguagem é enterprise e operacional.

### Páginas redundantes?
- **Dashboard + Comercial**: Ambas têm "Funil Comercial" (`CommercialFunnelCard`). O componente é idêntico. Na integração, verificar se faz sentido manter o funil completo na Dashboard ou apenas um KPI de receita.
- **Dashboard + Alertas**: SmartAlertsPanel na Dashboard e AlertsPage têm dados desconexos. Devem compartilhar o mesmo estado.
- **Dashboard + Operações**: `ActivityTimeline` na Dashboard e `OperationsFeed` em Operações cobrem o mesmo espaço de "atividade recente". Avaliar consolidação.

### Páginas que faltam (identificadas no roadmap mas sem data)?
- `Campanhas` — importante para o produto OOH, nenhuma estrutura ainda
- `Atividade/Auditoria` — necessário para compliance

### Dados mockados refletem a realidade?
Sim — placas com códigos `SP-2241`, regiões, receitas por região e contratos com nomes fictícios mas plausíveis para uma empresa OOH brasileira. O dataset é credível para demos.

---

## 10. Review de Código

**Avaliação: BOM com problemas pontuais corrigíveis**

### Problemas confirmados

| Arquivo | Problema |
|---------|---------|
| `DashboardPage.jsx:9` | `MOCK_PERIODS` importado e não usado |
| `DashboardPage.jsx:38-46` | `DAY_BRIEF_CHIPS` hardcode que diverge do provider |
| `DashboardPage.jsx:81` | Data `"19 Mai 2026"` hardcoded |
| `RevenueProjectionCard.jsx:18` | Função `pathFor` definida e nunca chamada |
| `RevenueProjectionCard.jsx:30` | `id="rev-area-grad"` duplicado se duas instâncias |
| `RevenueAnalytics.jsx:45` | `id="ra-grad"` duplicado se duas instâncias |
| `InventoryPage.jsx:21,29` | `STATUS_MAP` e `pMap` recriados a cada render |
| `MockRuntimeProvider.jsx:28` | Nova referência de `onTick` reinicia intervalo a cada render |
| `systemHealthMock.js:47,57,67` | Campo `read` (vs `lido` em alertsMockData) |
| `LoadingState.jsx` | `@keyframes` inline injetado N vezes |
| 6 arquivos (ver M-04) | `e.currentTarget.style` mutation |
| `dashboardSections.js` | Arquivo nunca importado (pode ser removido) |
| `components/charts/*.jsx` | 4 arquivos nunca importados (dead code) |

### Padrões positivos
- Todos os componentes são `memo()` — correto
- `useCallback` em handlers de navegação — correto
- `useMemo` em `filteredBoards` — correto
- Nenhum `useEffect` desnecessário detectado nas páginas
- `foundationalStates.js` é JS puro sem React — correto e reutilizável

---

## 11. Review de Governança

**Avaliação: APROVADO**

### pageRegistry.js
- Completo com 11 páginas, fases de rollout, feature flags e roles de acesso
- `path` dos registros (`/v4/dashboard`) diferem dos paths do router real futuro — isso é esperado mas deve ser alinhado antes da Fase 1

### componentRegistry.js
- **Incompleto** — lista 30 de ~62 componentes. Todos os componentes de `commercial/`, `contracts/`, `reports/`, `alerts/`, `preview/` estão ausentes. Deve ser completado.

### featureFlags.js
- Bem estruturado com fase, dependências, risco e team por flag
- Status atual de todos os flags é `disabled` ou `internal` — correto para um blueprint

### integrationBoundaries.js
- 6 hard boundaries bem definidos com enforcement e consequência
- `ALLOWED_IMPORTS` lista caminhos permitidos mas não há ferramenta que os enforce automaticamente (ESLint rules mencionadas mas não implementadas no projeto)

### runtimeContracts.js
- Contratos de provider bem definidos
- Falta o contrato do `RegionalDataProvider` (mapa/regiões) e do `ReportsDataProvider` como interfaces formais

### Quality checklists
- 72 critérios distribuídos em 5 dimensões
- **Problema:** Todos com `status:'pass'` hardcoded — os problemas B-01, A-01, A-02 identificados neste review não estão refletidos. O score de qualidade calculado (~95%) é artificialmente alto.

---

## 12. Review do Preview

**Avaliação: FUNCIONAL com riscos de contexto**

### Pontos positivos
- `V4PreviewPage` com 4 tabs (Status, Launcher, Boundaries, Qualidade) é informativa e útil para a equipe de desenvolvimento
- `PreviewLauncher` permite navegar por todas as páginas organizadas por fase
- `PreviewStatusPanel` com score rings SVG é visualmente adequado

### Problemas
- **Acessado via "Configurações"**: Usuário comum clicando em "Configurações" vê uma página técnica de blueprint. Deveria ser protegido por role ou separado do fluxo normal.
- **`onNavigate` recebida do V4Painel**: O preview pode navegar para outras páginas via o launcher — isso é positivo, mas cria um acoplamento onde uma página de "configurações" controla o estado de navegação do app inteiro.
- **Score de qualidade artificialmente alto**: O dashboard de qualidade mostrará ~95%+ mesmo com os problemas B-01 e A-01 existindo, porque os checklists têm `status:'pass'` hardcoded.
- **`previewMockState.js`** importa `getOverallQualityScore` que por sua vez importa todos os 5 checklists — chain de imports pesada apenas para a página de preview.

---

## 13. Review dos Contratos Futuros

| Contrato | Status | Observação |
|----------|--------|-----------|
| `dashboard.contract.js` | ✅ **Pronto** | Completo — inventário, receita, contratos, alertas, regional, atividade, recomendações. Bem classificado. |
| `inventory.contract.js` | ✅ **Pronto** | Completo — shape de placa com todos os campos derivados documentados |
| `operations.contract.js` | ✅ **Pronto** | Bem documentado — módulos, feed, sync. Menciona SSE corretamente |
| `commercial.contract.js` | ✅ **Pronto** | Pipeline e oportunidades bem definidos |
| `contracts.contract.js` | ✅ **Pronto** | Completo com cálculo de `probabilidadeRenovacao` explicado |
| `reports.contract.js` | ⚠️ **Precisa refinamento** | Falta: estratégia de paginação para histórico longo, polling strategy vs SSE, formato de datas no export, campos de auth/permissão por tipo de relatório |
| `alerts.contract.js` | ⚠️ **Precisa refinamento** | Falta: estratégia de reconexão SSE, max alerts por página, campos de escalation, SLA timer como campo numérico (não apenas string) |

**Lacunas transversais em todos os contratos:**
- Nenhum contrato documenta tratamento de erros (401, 403, 500)
- Nenhum documenta estratégia de paginação cursor vs offset
- Nenhum documenta headers de autenticação esperados
- Nenhum documenta o comportamento de fallback quando o endpoint retorna dados parciais

---

## 14. Checklist Antes da Integração

### 🔴 Obrigatório (bloqueante)
- [ ] **B-01** Unificar campo de alertas para `read` (boolean) em TODOS os mocks e providers  
- [ ] **B-02** Tornar `lastSyncLabel` dinâmico — calcular a partir de `Date` no `OperationalStateProvider`  
- [ ] **B-03** Substituir `DAY_BRIEF_CHIPS` por valores derivados do `useOperationalState()` provider  

### 🟠 Alta prioridade (antes da Fase 1)
- [ ] **A-01** Corrigir IDs de gradiente SVG — usar `useId()` do React 18 ou prefixar com hash único  
- [ ] **A-02** Remover ou integrar os 4 componentes chart órfãos  
- [ ] Adicionar `<link>` do Material Symbols Rounded no `public/index.html`  
- [ ] **A-03** Conectar `useV4Theme` ao `AppShell` — remover `data-density="default"` hardcoded  
- [ ] Adicionar Error Boundaries em cada página  

### 🟡 Média prioridade (durante a integração)
- [ ] Remover `MOCK_PERIODS` do import em `DashboardPage.jsx`  
- [ ] Remover `dashboardSections.js` não utilizado  
- [ ] Mover `STATUS_MAP` e `pMap` para constantes de módulo em `InventoryPage.jsx`  
- [ ] Substituir `e.currentTarget.style` por `useState(isHovered)` nos 6 arquivos  
- [ ] Mover `@keyframes v4p-skeleton` do JSX inline para `styles/states.css`  
- [ ] Completar `componentRegistry.js` com os 32 componentes ausentes  
- [ ] Corrigir `useRuntimeSimulation` — envolver `onTick` em `useCallback` no `MockRuntimeProvider`  
- [ ] Remover `pathFor` não utilizada em `RevenueProjectionCard.jsx`  

### 🟢 Baixa prioridade (após integração)
- [ ] Mover `V4PreviewPage` para uma rota não-sidebar com guard de role  
- [ ] Renomear `components/operational/` para `components/dashboard-widgets/` ou consolidar com `components/operations/`  
- [ ] Consolidar CSS de páginas em `styles/pages.css`  
- [ ] Atualizar checklists de qualidade com o status real dos itens  
- [ ] Completar contratos de `reports` e `alerts` com estratégia de erros e paginação  
- [ ] Desacoplar `MOCK_USER` do `AppShell` — receber como prop `user`  
- [ ] Substituir datas hardcoded por `new Date().toLocaleDateString('pt-BR', {...})`  

---

## 15. Plano de Correção Recomendado

### Sprint pré-integração (estimado: 1-2 dias de dev)

**Dia 1 — Bloqueantes:**
1. Unificar campo de alertas → escolher `lido` (mais alinhado com a linguagem do produto), atualizar `systemHealthMock.js` e `OperationalStateProvider`
2. Tornar `lastSyncLabel` dinâmico no provider (calcular elapsed time a partir de `Date`)
3. Conectar `DAY_BRIEF_CHIPS` ao provider via `useOperationalState()`
4. Corrigir SVG gradient IDs com `useId()`

**Dia 2 — Alto risco:**
5. Remover os 4 componentes chart órfãos (ou documentar quando serão usados)
6. Adicionar `<link>` do Material Symbols no HTML
7. Adicionar 1 Error Boundary cobrindo todas as páginas no `AppShell`
8. Mover `STATUS_MAP` para constante de módulo, remover `MOCK_PERIODS` do import

---

## 16. Ordem Ideal para Integração

```
Fase 1 — Dashboard (após corrigir bloqueantes)
  → Menor risco de negócio, maior visibilidade executiva
  → Provider: DashboardDataProvider + AuthProvider
  → Validação: métricas do sistema legado vs novo lado a lado

Fase 2 — Alertas (em paralelo com Inventário)
  → Alta urgência operacional, dados relativamente simples
  → Provider: AlertsDataProvider via SSE

Fase 2b — Inventário
  → Maior volume de dados (847 placas), necessita paginação
  → Provider: InventoryDataProvider com cursor-based pagination

Fase 3 — Operações
  → Depende de SSE operacional — mais complexo
  → Provider: OperationsDataProvider com fallback para polling

Fase 4 — Comercial + Contratos
  → Dados mais sensíveis, lógica de negócio mais rica
  → Providers separados por domínio

Fase 5 — Relatórios + Mapa
  → Mapa precisa de decisão sobre biblioteca geográfica
  → Relatórios dependem de job system para exportação
```

---

## 17. Conclusão Final

O v4-painel está **arquiteturalmente sólido** e **visualmente pronto** para se tornar o novo InMidia. O isolamento é perfeito, a linguagem é correta, a governança é bem estruturada, e os contratos de integração são suficientes para guiar o backend.

**Os 3 problemas bloqueantes são de baixa complexidade técnica** — podem ser corrigidos em menos de um dia de desenvolvimento e não envolvem mudanças estruturais. São problemas de coerência de dados, não de arquitetura.

**Após as correções bloqueantes, a integração real pode começar com segurança pela Fase 1 (Dashboard)**. O risco de regressão no sistema legado é zero — os dois sistemas são completamente isolados e o rollout é controlado por feature flags.

> **Veredito:** PARCIALMENTE pronto. Corrigir os 3 bloqueantes e o risco A-01 (SVG IDs). A integração pode iniciar em seguida.

---

*Revisão gerada com base em leitura direta de 183 arquivos — sem execução de build.*  
*Evidências documentadas com número de linha e nome de arquivo para reprodução direta.*
