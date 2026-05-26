# src/legacy/

Arquivos confirmados como **não utilizados** por nenhuma rota ativa do gateway.

## Regras

- Nenhum arquivo aqui deve ser importado por código de produção.
- Cada arquivo mantém `// @ts-nocheck` porque não vale a pena corrigir código morto.
- **Prazo para remoção definitiva: 2026-11-01** (após confirmar que nenhum deploy depende deles).
- Antes de remover, verificar se há scripts de migração ou ferramentas offline que os usam.

## Baseline @ts-nocheck (atualizado ARCH-5)

Baseline atual: **12 arquivos** (reduzido de 20 na ARCH-4).

### Corrigidos na ARCH-5 ✅
| Arquivo | Erros removidos |
|---------|----------------|
| src/modules/biweeks/bi-week.controller.ts | 3 (req.params cast) |
| src/modules/public-api/public-api.controller.ts | 1 (ObjectId.toString) |
| src/modules/users/user.service.ts | 3 (unknown catch, array access, optional chain) |
| src/shared/services/pdf/pdf.footer.ts | 1 (import não usado) |
| src/shared/services/pdf/pdf.header.ts | 1 (import não usado) |
| src/shared/services/pdf/pdf.programacao.ts | 2 (imports não usados) |
| src/shared/services/pdf/pdf.totalizacao.ts | 1 (import não usado) |
| src/shared/utils/xlsx-to-pdf.converter.ts | 1 (import não usado) |

### Corrigidos na ARCH-6 ✅
| Arquivo | Erros removidos |
|---------|----------------|
| src/modules/empresas/empresa.service.ts | 1 (Object.keys()[0] ?? fallback) |
| src/modules/system/scripts/script-runner.service.ts | 5 (interface RunScriptOptions, param tipo, duration, requireErr unknown) |
| src/modules/propostas-internas/pi.controller.ts | 14 (import path errado + AuthReq = Request & IAuthRequest) |

### Corrigidos na ARCH-7 ✅
| Arquivo | Erros removidos |
|---------|----------------|
| src/PISystemGen/generator.ts | 5 (uuid/logger/PiGenJob não usados, params → _params) |
| src/PISystemGen/jobManager.ts | 2 (buffer não usado → void, resultUrl null → undefined) |
| src/PISystemGen/controller.ts | 3 (logger não usado, AuthenticatedRequest conflitante → type alias, user cast, return void) |
| src/PISystemGen/routes.ts | 1 (resolvido pelo fix do controller.ts — Promise<void>) |

### Corrigidos na ARCH-8 ✅
| Arquivo | Erros removidos |
|---------|----------------|
| src/modules/webhooks/webhook.controller.ts | 8 (AuthReq = Request & IAuthRequest, req.params.x as string) |
| src/modules/webhooks/webhook.service.ts | 38 (tipos locais criados: WebhookEventPayload, WebhookCreateData, WebhookUpdateData, WebhookDispatchPayload; catch error: any; delete via unknown; response → void) |

### Corrigidos na ARCH-9 ✅
| Arquivo | Erros removidos |
|---------|----------------|
| src/modules/whatsapp/whatsapp.controller.ts | 4 (AuthReq + unused _req prefix) |
| src/modules/whatsapp/whatsapp.service.ts | 42 (qrcode-terminal types, import inexistente, catch:any, client! null assertions, placa→placaId, message:Message, spread condicional, noUncheckedIndexedAccess !) |
| src/types/qrcode-terminal.d.ts | CRIADO — tipos mínimos para qrcode-terminal |

### Corrigidos na ARCH-10 ✅
| Arquivo | Erros removidos |
|---------|----------------|
| src/modules/propostas-internas/pi.service.ts | 114 (imports, params, catch:any, NormalizedPeriod, query Record<string,unknown>, dadosParaAtualizar, populate casts, placa/cliente aliases, piAny pattern) |
| src/modules/propostas-internas/pi.controller.ts | 6 (req.params.id as string — noUncheckedIndexedAccess) |

### ✅ TODOS OS ARQUIVOS ATIVOS ESTÃO LIVRES DE @ts-nocheck
Baseline final: 0 arquivos ativos com @ts-nocheck.
src/legacy/ mantém 21 arquivos com @ts-nocheck — aguardando remoção definitiva em 2026-11-01.
| src/PISystemGen/*.ts (4 files) | ~12 | sprint-q3 |

## Como mover um arquivo de volta

1. Remova o `@ts-nocheck`
2. Corrija todos os erros TypeScript
3. Execute `npm run typecheck:active`
4. Execute `npm run test:integration`
5. Mova-o de volta para o módulo original
6. Atualize este README
