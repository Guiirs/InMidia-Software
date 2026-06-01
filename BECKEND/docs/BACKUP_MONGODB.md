# Backup Automático do MongoDB — InMidia V4

Script: `scripts/backup-mongodb.ts`  
Comando: `npm run backup:mongo`

---

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `MONGODB_URI` | — | **Obrigatória.** String de conexão do MongoDB. |
| `BACKUP_DIR` | `/app/backups` | Diretório local onde os backups são salvos. |
| `BACKUP_RETENTION_DAYS` | `7` | Dias de retenção. Arquivos mais antigos são removidos automaticamente. |
| `BACKUP_OFFSITE_ENABLED` | `false` | Reservado para upload offsite futuro (S3/R2). |
| `BACKUP_PROVIDER` | `local` | Provedor offsite: `local` \| `s3` \| `r2`. |

Adicione ao seu `.env`:

```env
BACKUP_DIR=/app/backups
BACKUP_RETENTION_DAYS=7
BACKUP_OFFSITE_ENABLED=false
BACKUP_PROVIDER=local
```

---

## Como rodar manualmente

```bash
# Na raiz de BECKEND:
npm run backup:mongo
```

Saída esperada:

```
[backup] Starting MongoDB backup — 2026-06-01-03-00-00
[backup] Source:      mongodb+srv://****@cluster.mongodb.net/...
[backup] Destination: /app/backups
[backup] Retention:   7 days
[backup] Running mongodump...
[backup] Compressing archive...
[backup] Backup created: /app/backups/inmidia-mongodb-backup-2026-06-01-03-00-00.tar.gz
[backup] Retention cleanup: 0 file(s) removed (older than 7 days).
[backup] Backup completed successfully.
```

---

## Pré-requisito: mongodb-database-tools

O script usa `mongodump`, que faz parte do pacote `mongodb-database-tools`.

**Em Docker (Dockerfile):**

```dockerfile
RUN apt-get update && apt-get install -y wget gnupg && \
    wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | apt-key add - && \
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" \
      > /etc/apt/sources.list.d/mongodb-org-7.0.list && \
    apt-get update && apt-get install -y mongodb-database-tools && \
    rm -rf /var/lib/apt/lists/*
```

**Em Ubuntu/Debian VPS:**

```bash
sudo apt-get install -y mongodb-database-tools
```

---

## Como agendar no Coolify / VPS

### Cron via crontab (VPS)

```bash
crontab -e
```

Adicione (executa às 03:00 todo dia):

```cron
0 3 * * * cd /app && npm run backup:mongo >> /app/logs/backup-mongo.log 2>&1
```

### Cron via Docker (docker-compose ou Coolify)

Crie um serviço de cron separado no compose:

```yaml
services:
  backup:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - .:/app
      - /app/backups:/app/backups
      - /app/logs:/app/logs
    environment:
      - MONGODB_URI=${MONGODB_URI}
      - BACKUP_DIR=/app/backups
      - BACKUP_RETENTION_DAYS=7
    entrypoint: >
      sh -c "echo '0 3 * * * cd /app && npm run backup:mongo >> /app/logs/backup-mongo.log 2>&1'
             | crontab - && crond -f"
    restart: unless-stopped
```

### Scheduler do Coolify

Em **Services → Add Service → Cron Job**:

- **Command:** `npm run backup:mongo`
- **Schedule:** `0 3 * * *`
- **Working directory:** `/app`

---

## Como verificar se o backup foi criado

```bash
ls -lh /app/backups/
# ou
ls -lh /app/backups/ | grep inmidia-mongodb-backup
```

Verificar o log:

```bash
tail -50 /app/logs/backup-mongo.log
```

---

## Como restaurar um backup

```bash
# Descompactar
tar -xzf /app/backups/inmidia-mongodb-backup-YYYY-MM-DD-HH-mm-ss.tar.gz -C /tmp/

# Restaurar com mongorestore
mongorestore \
  --uri="$MONGODB_URI" \
  --drop \
  /tmp/inmidia-mongodb-backup-YYYY-MM-DD-HH-mm-ss/
```

> `--drop` apaga as coleções existentes antes de restaurar. Use com cuidado em produção.
> Omita `--drop` para fazer merge (restauração incremental).

---

## Retenção automática

Após cada backup bem-sucedido, o script lista todos os arquivos `inmidia-mongodb-backup-*.tar.gz`
no `BACKUP_DIR` e remove os que têm mais de `BACKUP_RETENTION_DAYS` dias.
O backup recém-criado nunca é removido na mesma execução.

---

## Preparação para offsite futuro (S3 / R2)

O script já lê `BACKUP_OFFSITE_ENABLED` e `BACKUP_PROVIDER`. Para ativar o upload offsite:

1. Implemente `uploadOffsite()` em `scripts/backup-mongodb.ts` usando `@aws-sdk/client-s3`
   (já presente nas dependências do projeto).
2. Configure as variáveis `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
   (já documentadas no `.env.example`).
3. Defina `BACKUP_OFFSITE_ENABLED=true` e `BACKUP_PROVIDER=r2` no ambiente.

---

## Segurança

> **AVISO:** Os arquivos de backup contêm todos os dados do banco, incluindo dados sensíveis
> de clientes, tokens, e informações de negócio. Nunca os exponha publicamente.

- Mantenha `BACKUP_DIR` fora de diretórios servidos pelo nginx/caddy.
- Aplique permissões restritivas: `chmod 700 /app/backups`.
- Em produção, configure upload offsite para storage privado com criptografia em repouso.
- Rotacione backups off-site para uma conta/bucket separado com acesso restrito.
- Nunca commite arquivos `.tar.gz` de backup no repositório (já coberto pelo `.gitignore`).
