# Preview System — V4 Painel

O sistema de preview é uma página especial dentro do v4-painel que documenta e demonstra o estado completo do blueprint.

## Componentes

| Arquivo | Descrição |
|---------|-----------|
| `V4PreviewPage.jsx` | Página principal com tabs: Status, Launcher, Boundaries, Qualidade |
| `PreviewStatusPanel.jsx` | Painel de scores de qualidade com rings SVG e stats |
| `PreviewLauncher.jsx` | Navegador por fases do roadmap com status de cada página |
| `previewMockState.js` | Estado mockado do sistema para o preview |

## Como acessar

O preview está integrado ao V4Painel como a página `configuracoes` (temporariamente). Para acessar:

1. Navegue no sidebar para "Configurações"
2. A V4PreviewPage é renderizada com acesso ao status completo do sistema

## O que mostra

- **Status**: estado geral do blueprint, partes implementadas, qualidade
- **Launcher**: todas as páginas organizadas por fase de rollout, clicáveis
- **Boundaries**: política arquitetural — regras bloqueantes e recomendações
- **Qualidade**: scores detalhados por dimensão (visual, operacional, acessibilidade, etc.)

## Não confunda

O preview é uma ferramenta **interna de desenvolvimento**. Não é uma página de produto e não será exposta em produção. Será substituído por um sistema de preview interno mais robusto nas etapas de integração real.
