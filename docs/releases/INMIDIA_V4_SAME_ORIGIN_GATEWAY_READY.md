# InMidia V4 - Same-Origin Gateway Ready Release

Release candidate para consolidacao da arquitetura InMidia V4 orientada a same-origin, backend enterprise hardened, API publica de integracao e readiness para gateway/edge.

## Versao proposta

- Tag alvo: `v4.2.0-gateway-ready`
- Tipo: release estavel de arquitetura
- Branch base: `main`

## Escopo arquitetural consolidado

### 1) Same-origin architecture (Frontend)

- Frontend preparado para operar com base relativa em producao (`/api/v1`) via configuracao de ambiente.
- Configuracao de API centralizada para reduzir hardcodes e inconsistencias de rota.
- Ajustes para compatibilidade de SSE quando a base da API for relativa (sem dependencia de URL absoluta).
- Estrutura alinhada para reverse proxy (OLS/Nginx/Coolify) com roteamento interno para backend.

### 2) Backend hardening (Enterprise)

- `trust proxy` habilitado para ambientes com proxy reverso e cabecalhos `x-forwarded-*`.
- Request correlation com `request-id` para rastreabilidade ponta a ponta.
- SSE hardened para melhor resiliencia operacional e observabilidade.
- Upload hardened com validacoes e limites mais robustos para ambiente produtivo.
- `proxy.utils` para normalizacao de comportamento em topologias de gateway/proxy.
- Melhorias de graceful shutdown para reduzir risco de conexoes penduradas em restart/rolling update.
- Reforco de observabilidade (logs, metrica e eventos estruturados).

### 3) Public Integration API

- Arquitetura da API publica consolidada (rotas, contratos e presenters).
- Controle de autenticacao via API key para integracoes externas.
- Rate limit dedicado para endpoints publicos.
- Pronto para exposicao controlada via gateway com politica de seguranca explicita.

### 4) Gateway and edge cache readiness

- Design orientado a deploy por gateway (Cloudflare/edge + proxy local).
- Endpoints e middlewares preparados para cacheability controlada na borda.
- Compatibilidade com topologia same-origin para reduzir CORS cross-site em producao.

## Readiness de plataforma

### Cloudflare readiness

- Compatibilidade com encaminhamento por proxy reverso e headers de origem.
- Base same-origin favorece postura de seguranca (cookies, CORS e roteamento).

### OLS/Coolify readiness

- Roteamento frontend/backend alinhado para proxy em ambiente de app hosting.
- Estrategia operacional compatível com publish sem acoplamento ao dominio hardcoded.

## Validacao tecnica da release

- Frontend build: `npm run build` (REACT) - OK
- Backend typecheck: `npm run typecheck` (BECKEND) - OK
- Backend build: `npm run build` (BECKEND) - OK
- Backend testes principais de contratos: `npm run test:contracts` - OK
- Observacao: `npm test` completo apresentou falhas de timeout em testes de integracao dependentes de MongoMemoryServer (ambiente de teste), sem bloquear compilacao dos artefatos da release.

## Rollback strategy

- Rollback preservado por historico Git e tags anteriores (sem sobrescrita).
- Reversao imediata por checkout de tag/commit anterior estavel.
- Nao ha remocao de mecanismos de compatibilidade de rota legada nesta release.

## Guardrails aplicados nesta publicacao

- Sem alteracao de regras de negocio de dominio.
- Sem sobrescrever tags antigas.
- Sem reescrever historico (`rebase --onto`, reset destrutivo ou force-push em branch principal).
- Sem deploy de infraestrutura durante este processo (apenas versionamento GitHub).

## Fase 3 infra readiness

Esta release deixa o repositorio pronto para avancar para Fase 3 de infraestrutura (gateway/edge/proxy) com base tecnica consolidada, observabilidade reforcada e trilha de rollback segura.
