# InMidia V4

Regras obrigatórias:

- Placa é ativo físico
- Cliente não pode ser persistido na placa
- Receita não pode ser persistida na placa
- Dados comerciais vêm de contratos/Temporal Engine
- Multi-tenant obrigatório
- Não quebrar compatibilidade JetEngine
- Não criar endpoints paralelos sem necessidade
- Priorizar AppShell V4
- Priorizar Sync Core
- Evitar componentes V3


# SKILL ORCHESTRATION

Para qualquer tarefa complexa, utilizar múltiplas skills simultaneamente.

---

## Auditoria Backend

Executar nesta ordem:

1. brainstorming
2. backend review
3. typescript-expert
4. systematic-debugging
5. supabase-postgres-best-practices
6. webapp-testing
7. mcp-builder

Resultado esperado:

* arquitetura
* segurança
* performance
* escalabilidade
* dívida técnica
* testes
* plano de correção

---

## Investigação de Bug

Executar:

1. systematic-debugging
2. typescript-expert
3. webapp-testing

Obrigatório identificar:

* causa raiz
* impacto
* reprodução
* correção
* prevenção

Nunca parar no sintoma.

---

## Revisão de Código

Executar:

1. typescript-expert
2. brainstorming
3. webapp-testing

Avaliar:

* legibilidade
* manutenibilidade
* acoplamento
* complexidade
* cobertura

---

## Banco de Dados

Executar:

1. supabase-postgres-best-practices

Mesmo em MongoDB avaliar:

* índices
* scans completos
* agregações
* paginação
* isolamento multi-tenant
* consistência de dados

---

## APIs

Executar:

1. frontend-design
2. web-design-guidelines
3. typescript-expert

Validar:

* DTOs
* contratos
* responses
* versionamento
* backward compatibility

---

## Integrações

Executar:

1. mcp-builder
2. brainstorming

Avaliar:

* acoplamento
* resiliência
* retries
* observabilidade
* falhas externas

---

## Testes

Executar:

1. webapp-testing

Validar:

* unitários
* integração
* contrato
* E2E
* regressão

Toda feature nova deve possuir testes proporcionais ao risco.
