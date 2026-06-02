# Arquitetura Multi-Tenant — LoteiraWeb

> Documento de planejamento para expansão do sistema para múltiplos clientes.
> Quando for retomar, leia este arquivo completo antes de iniciar qualquer implementação.

---

## Visão Geral

Cada cliente terá:
- Seu próprio administrador (usuário Supabase)
- Seus próprios tokens de acesso
- Seus próprios bolões e jogos
- Sua própria chave PIX
- Seu próprio número de WhatsApp conectado (sessão Baileys independente)

Tudo no mesmo banco de dados, isolado por `cliente_id` via Row Level Security (RLS) do Supabase.

---

## Estado Atual do Sistema

### Tabelas existentes relevantes

| Tabela | Descrição |
|---|---|
| `jogos` | Apostas registradas. Tem `bolao_id`, `user_id`, `codigo_autenticacao` |
| `boloes` | Bolões/pools. Tem `modalidade`, `data_sorteio`, `valor_cota`, `status` |
| `tokens_acesso` | Tokens alternativos de login (sem Supabase Auth) |
| `chave_pix` | Chave PIX única para receber pagamentos |
| `config_automatico` | Configuração de envio automático pelo WhatsApp |

### Auth atual
- Login via `supabase.auth.signInWithPassword()` (email/senha)
- Login alternativo via `tokens_acesso` (valida token na tabela, seta cookie `token_acesso_ok=1`)
- Admin identificado pela env `NEXT_PUBLIC_ADMIN_EMAILS`
- Middleware em `proxy.ts` protege todas as rotas

### WhatsApp atual
- Singleton: uma instância global Baileys, um número, uma sessão
- Sessão salva em pasta local (credenciais do Baileys)
- Endpoint de QR Code, status e envio operam nessa instância única

---

## O que Precisa ser Criado

### 1. Tabela `clientes`

```sql
create table public.clientes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  email       text not null unique,        -- email do admin principal
  plano       text default 'basico',       -- para futuras restrições por plano
  ativo       boolean default true,
  criado_em   timestamptz default now()
);
```

### 2. Tabela `admin_clientes` (liga usuário Supabase ao cliente)

```sql
create table public.admin_clientes (
  user_id     uuid references auth.users(id) on delete cascade,
  cliente_id  uuid references public.clientes(id) on delete cascade,
  role        text default 'admin',        -- 'admin' | 'super_admin'
  primary key (user_id, cliente_id)
);
```

### 3. Adicionar `cliente_id` nas tabelas existentes

```sql
-- boloes
alter table public.boloes add column cliente_id uuid references public.clientes(id);

-- tokens_acesso
alter table public.tokens_acesso add column cliente_id uuid references public.clientes(id);

-- chave_pix
alter table public.chave_pix add column cliente_id uuid references public.clientes(id);

-- config_automatico
alter table public.config_automatico add column cliente_id uuid references public.clientes(id);

-- jogos herda o cliente via bolao_id, não precisa de coluna direta
-- mas pode adicionar para consultas diretas se necessário
```

### 4. Índices

```sql
create index on public.boloes(cliente_id);
create index on public.tokens_acesso(cliente_id);
create index on public.chave_pix(cliente_id);
create index on public.config_automatico(cliente_id);
```

---

## Row Level Security (RLS)

O Supabase usa o JWT do usuário logado para filtrar dados automaticamente.

### Estratégia

1. Ao logar, o `user_id` do Supabase Auth é conhecido
2. O middleware busca o `cliente_id` do usuário na tabela `admin_clientes`
3. Esse `cliente_id` é injetado no contexto (cookie seguro ou claim no JWT)
4. As políticas RLS usam esse valor para filtrar

### Políticas de exemplo

```sql
-- boloes: cliente só vê os próprios
create policy "boloes por cliente"
  on public.boloes for all
  using (cliente_id = (
    select cliente_id from public.admin_clientes
    where user_id = auth.uid()
    limit 1
  ));

-- mesma lógica para chave_pix, tokens_acesso, config_automatico
```

> **Atenção:** Para o login via token (sem Supabase Auth), o `cliente_id` virá de outro mecanismo
> — provavelmente um cookie ou campo na tabela `tokens_acesso` que identifica o cliente.

---

## WhatsApp Multi-Sessão

### Estado atual (singleton)

```typescript
// Hoje — uma instância global
let sock: WASocket | null = null
let qrCode: string | null = null
let status: 'disconnected' | 'connecting' | 'connected' = 'disconnected'
```

### Como ficará (pool de sessões)

```typescript
interface ClienteSession {
  sock:      WASocket | null
  qrCode:    string | null
  status:    'disconnected' | 'connecting' | 'connected'
  clienteId: string
}

const sessions = new Map<string, ClienteSession>()

function getSession(clienteId: string): ClienteSession {
  if (!sessions.has(clienteId)) {
    sessions.set(clienteId, { sock: null, qrCode: null, status: 'disconnected', clienteId })
  }
  return sessions.get(clienteId)!
}
```

### Pastas de sessão separadas

```
whatsapp-sessions/
  cliente_abc123/    ← credenciais Baileys do cliente A (número dele)
  cliente_def456/    ← credenciais Baileys do cliente B (número dele)
```

Hoje a pasta é fixa (ex: `auth_info_baileys/`). Com multi-tenant:
```typescript
const sessionPath = `whatsapp-sessions/${clienteId}`
// passa para o useMultiFileAuthState(sessionPath)
```

### Endpoints afetados

Todos os endpoints de WhatsApp precisam receber `clienteId`:

| Endpoint atual | Adaptação |
|---|---|
| `GET /api/whatsapp/qr` | `GET /api/whatsapp/qr?clienteId=xxx` |
| `GET /api/whatsapp/status` | `GET /api/whatsapp/status?clienteId=xxx` |
| `POST /api/whatsapp/connect` | `POST /api/whatsapp/connect` + `{ clienteId }` no body |
| `POST /api/whatsapp/disconnect` | `POST /api/whatsapp/disconnect` + `{ clienteId }` no body |
| Envio de mensagens | Busca `getSession(clienteId)` antes de enviar |

---

## Middleware (`proxy.ts`)

O middleware atual só verifica se o usuário está autenticado. Com multi-tenant, precisa também:

1. Identificar o `cliente_id` do usuário logado
2. Armazená-lo em cookie seguro (httpOnly) ou em claim customizado do JWT Supabase
3. Disponibilizar para as API routes e server components

```typescript
// Exemplo: após autenticar, busca o cliente
const { data: adminCliente } = await supabase
  .from('admin_clientes')
  .select('cliente_id')
  .eq('user_id', user.id)
  .single()

// Armazena em cookie para uso nas rotas
response.cookies.set('cliente_id', adminCliente.cliente_id, { httpOnly: true })
```

---

## Painel Super-Admin

Uma rota separada (ex: `/super-admin`) acessível apenas ao dono do sistema (você).

### Funcionalidades

- Listar todos os clientes (ativo/inativo)
- Criar novo cliente (gera usuário Supabase + entrada em `clientes` + `admin_clientes`)
- Desativar cliente (flag `ativo = false`, bloqueia acesso sem deletar dados)
- Ver resumo de cada cliente (quantos bolões, jogos, status do WhatsApp)

### Proteção da rota

Identificado pela env `NEXT_PUBLIC_ADMIN_EMAILS` existente, ou por uma role `super_admin` na tabela `admin_clientes`.

---

## Ordem de Implementação Recomendada

```
Fase 1 — Banco de dados
  [ ] Criar tabela clientes
  [ ] Criar tabela admin_clientes
  [ ] Adicionar cliente_id nas tabelas existentes
  [ ] Configurar RLS para todas as tabelas
  [ ] Migrar dados existentes para um cliente padrão

Fase 2 — Autenticação e contexto
  [ ] Atualizar middleware (proxy.ts) para resolver cliente_id
  [ ] Adaptar login via token (tokens_acesso) para incluir cliente_id
  [ ] Remover dependência de NEXT_PUBLIC_ADMIN_EMAILS (usar admin_clientes)

Fase 3 — WhatsApp
  [ ] Refatorar singleton para Map de sessões
  [ ] Separar pastas de sessão por cliente_id
  [ ] Atualizar todos os endpoints de WhatsApp
  [ ] Atualizar UI de conexão do WhatsApp para exibir status por cliente

Fase 4 — Painel Super-Admin
  [ ] Criar rota /super-admin protegida
  [ ] Tela de listagem e criação de clientes
  [ ] Tela de status geral (bolões, jogos, WhatsApp por cliente)
```

---

## Pontos de Atenção

- **Dados existentes:** ao migrar, todos os registros atuais precisam receber o `cliente_id` do primeiro cliente (o atual)
- **Login via token:** esse fluxo não usa Supabase Auth, então o `cliente_id` precisa vir da tabela `tokens_acesso` diretamente
- **WhatsApp em produção:** sessões Baileys ficam na memória do processo Node. Se o servidor reiniciar, todas as sessões são perdidas e os clientes precisam reconectar. Considerar persistência das sessões ativas em banco
- **Isolamento de arquivos:** se houver upload de imagens ou arquivos por cliente no futuro, as pastas também precisam ser separadas por `cliente_id`
