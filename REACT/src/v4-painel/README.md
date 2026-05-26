# V4 Painel — InMidia

> Fundação arquitetural da próxima geração do painel operacional InMidia.

---

## O que é este módulo

O `v4-painel` é uma **ilha arquitetural isolada** dentro do projeto React. Ele contém a fundação visual, estrutural e operacional do novo painel enterprise, sem qualquer conexão com o sistema atual em produção.

**Não é:**
- Uma feature flag do sistema atual
- Uma refatoração do código existente
- Um experimento throwaway

**É:**
- A base permanente do próximo painel operacional
- Construída para durar — tokens, estados e shell não serão reescritos nas próximas etapas
- Visualmente pronta para produção desde o primeiro dia

---

## Isolamento arquitetural

Este módulo **não importa** nada de fora do próprio diretório `v4-painel/`, exceto React.

Proibido:
- `services/` reais
- React Query
- `AuthContext` ou qualquer contexto global
- Rotas reais ou react-router
- Endpoints ou APIs reais

Permitido:
- React + hooks padrão (useState, useCallback, useContext, useMemo, memo)
- CSS puro via classes `v4p-*`
- Mocks locais em `mock/`

---

## Uso de mocks

Todos os dados exibidos são mockados localmente. O `MockRuntimeProvider` simula:
- Estado de saúde dos módulos
- Alertas operacionais
- Métricas de desempenho
- Sincronização periódica (tick a cada 30s sem backend)
- Usuário logado

---

## Visão de produto

O painel transmite a sensação de um **centro operacional de mídia OOH enterprise**. Cada detalhe visual foi definido para comunicar:

- Controle e clareza operacional
- Inteligência comercial e de inventário
- Software de alto padrão — não template

---

## Estrutura

```
v4-painel/
├── styles/          Tokens CSS, tipografia, espaçamento, elevações, estados
├── foundation/      Definições puras: estados, severidade, prioridades, navegação
├── mock/            Dados simulados sem backend
├── providers/       Contexto global mockado (Theme, OperationalState, Runtime)
├── shell/           AppShell, Sidebar, Topbar, NavigationSection
├── design-system/   Componentes base reutilizáveis
├── docs/            Documentação técnica da fundação
├── V4Painel.jsx     Entry point principal
└── index.js         API pública do módulo
```

---

## Como visualizar

```jsx
// Em qualquer arquivo React temporário / rota de preview:
import V4Painel from './v4-painel/V4Painel';

export default function Preview() {
  return <V4Painel />;
}
```

O componente `V4Painel` já inclui todos os providers necessários.

---

## Etapas seguintes (Parte 2+)

1. **Dashboard Page** — composição das métricas e status em tela completa
2. **Operações Page** — mapa de pontos com status em tempo real
3. **Inventário Page** — lista de placas com filtros e densidade
4. **Integração real** — substituição de mocks por providers reais

> Esta etapa (Parte 1) termina aqui. A foundation está pronta.
