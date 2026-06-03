# Sistema de Gerenciamento de Estacionamento

## 📌 Sobre o Projeto

Este projeto tem como objetivo desenvolver um sistema inteligente para controle de entrada e saída de veículos no estacionamento da faculdade utilizando QR Codes dinâmicos.

A proposta do sistema é tornar o gerenciamento das vagas mais rápido, organizado e automatizado, reduzindo filas e facilitando o controle das vagas disponíveis em tempo real.

Todo o funcionamento será integrado a um banco de dados responsável por armazenar e gerenciar as informações do estacionamento.

---

## ⚙️ Como o Sistema Funcionará

### 🚗 Entrada de Veículos

Ao chegar no estacionamento, o visitante encontrará uma tela exibindo um QR Code disponível referente a uma vaga livre.

O processo acontecerá da seguinte forma:

1. O visitante escaneia o QR Code utilizando o celular;
2. Após o escaneamento:
   - O sistema identificará qual vaga foi atribuída.
   - Um link será exibido para que o visitante possa baixar/salvar o QR Code em seu aparelho.
3. Assim que o QR Code for utilizado:
   - A vaga será marcada como **ocupada** no sistema.
   - Um novo QR Code será gerado automaticamente para o próximo visitante.

---

### 🚪 Saída de Veículos

Na saída do estacionamento, o visitante deverá apresentar o mesmo QR Code salvo anteriormente.

Após a leitura do código:

- o sistema registrará a saída do veículo;
- a vaga utilizada será marcada novamente como **disponível**;
- o histórico da utilização será armazenado no banco de dados.

---

## 🗄️ Gerenciamento de Dados

O sistema utilizará um banco de dados para armazenar todas as informações necessárias para o funcionamento da aplicação.

### 📋 Informações que serão armazenadas

- Identificação dos veículos;
- Código individual de cada vaga;
- QR Code correspondente a cada vaga;
- Status da vaga:
  - Disponível;
  - Ocupada;
- Tipos de vagas:
  - Visitante;
  - Funcionário;
  - Deficiente;
  - Idoso;
  - Entre outras;
- Quantidade total de vagas;
- Registro de entradas e saídas;
- Histórico de utilização do estacionamento;
- Horários de entrada e saída dos veículos.

---

## 🧩 Funcionalidades Principais

✔️ Controle automático das vagas
✔️ Geração dinâmica de QR Codes  
✔️ Registro de entrada e saída de veículos  
✔️ Atualização em tempo real das vagas disponíveis  
✔️ Gerenciamento de diferentes categorias de vagas  
✔️ Armazenamento de dados em banco de dados  
✔️ Histórico completo de utilização do estacionamento

---

## 🛠️ Tecnologias Previstas

### Front-end

- HTML
- CSS
- JavaScript + React/Next.js

### Back-end

- Next.js

### Banco de Dados

- Supabase

### Recursos adicionais

- API para geração e leitura de QR Codes

---

## 📂 Estrutura Inicial do Projeto

```bash
/estacionamento
│
├── /frontend
├── /backend
├── /database
├── /qrcodes
├── README.md
```

---

## 🗄️ Configuracao do Banco de Dados

### Usuario admin

O sistema exige um usuario admin na tabela `admin_users` com senha hasheada.

Para gerar uma hash bcrypt no terminal (Node.js):
```bash
node -e "console.log(require('bcryptjs').hashSync('sua-senha-aqui', 10))"
```

SQL de insert:
```sql
INSERT INTO admin_users (username, password_hash)
VALUES ('admin@exemplo.com', '<hash-gerada-acima>');
```

### Vagas de estacionamento

O sistema exige que as vagas existam na tabela `parking_spots` antes de funcionar.
Nao ha endpoint de CRUD de vagas — a insercao deve ser feita diretamente no banco.

SQL de insert (exemplo para 10 vagas):
```sql
INSERT INTO parking_spots (code, status) VALUES
(1,  'disponivel'),
(2,  'disponivel'),
(3,  'disponivel'),
(4,  'disponivel'),
(5,  'disponivel'),
(6,  'disponivel'),
(7,  'disponivel'),
(8,  'disponivel'),
(9,  'disponivel'),
(10, 'disponivel');
```

**Desenvolvimento local:** as migrations do Drizzle ja criam as tabelas. Pode-se inserir os dados seed manualmente ou via script. Producao (Supabase) requer insercao manual ou script de seed.

---

## 🌐 API Routes

### `GET /api/sse/entrada`
SSE endpoint que envia QR codes em tempo real para a tela de entrada.

Mantém conexão SSE aberta. A cada escaneamento de QR Code, envia a próxima vaga disponível com QR já gerado. O QR code na tela de entrada codifica `/entrada/confirmar?token=<uuid>`.

**Conexão persistente:** quando não há vagas disponíveis, o evento `error` é enviado mas a conexão **permanece aberta**, aguardando uma saída liberar vaga. Ao receber notificação de saída (`GET /api/saida`), o servidor tenta preparar uma nova entrada automaticamente.

**Headers:** `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`

**Eventos:**

| Evento | Payload | Descrição |
|--------|---------|-----------|
| `vaga_ocupada` | `{ spot, token, qrDataUrl }` | Vaga disponível com QR code (data URI) |
| `error` | `{ error }` | Nenhuma vaga disponível no momento (conexão não fecha) |

**Resposta 200 (evento `vaga_ocupada`):**
```json
{ "spot": { "id": 1, "code": 1, "status": "disponivel" }, "token": "uuid", "qrDataUrl": "data:image/png;base64,..." }
```

**Resposta 200 (evento `error`):**
```json
{ "error": "Nao ha vagas disponiveis no momento" }
```

---

### `GET /api/vagas`
Retorna todas as vagas do estacionamento com seus códigos e status. Requer autenticação de administrador via cookie `auth_token`.

**Resposta 200:**
```json
{ "success": true, "total": 3, "spots": [{ "id": 1, "code": 1, "status": "disponivel" }, { "id": 2, "code": 2, "status": "ocupada" }, { "id": 3, "code": 3, "status": "disponivel" }] }
```

**Resposta 401:**
```json
{ "error": "Nao autorizado" }
```

**Resposta 500:**
```json
{ "success": false, "error": "Erro ao buscar vagas" }
```

---

### `GET /api/confirmar?token=<uuid>`
Confirma a entrada do veículo após escaneamento do QR Code.

Cria o registro de entrada no banco, marca a vaga como ocupada e dispara evento SSE para gerar novo QR.

**Parâmetros query:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `token` | string | Sim | Token UUID único da sessão |

**Resposta 200:**
```json
{ "entry": { "id": 1, "spotId": 1, "token": "uuid", "entryTime": "2025-01-01T00:00:00.000Z", "exitTime": null } }
```

**Resposta 400:**
```json
{ "error": "Token é obrigatório" }
```

**Resposta 409:**
```json
{ "error": "Este token ja foi utilizado" }
```

**Resposta 503:**
```json
{ "error": "Nenhuma vaga disponivel no momento" }
```

---

### `GET /api/saida?token=<uuid>`
Registra a saída do veículo. Libera a vaga, marca exit_time na entrada e notifica o SSE de entrada para gerar novo QR.

**Parâmetros query:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `token` | string | Sim | Token UUID da sessão (mesmo do QR de saída) |

**Resposta 200:**
```json
{ "entry": { "id": 1, "spotId": 1, "token": "uuid", "entryTime": "2025-01-01T00:00:00.000Z", "exitTime": "2025-01-01T12:00:00.000Z" } }
```

**Resposta 400:**
```json
{ "error": "Token é obrigatório" }
```

**Resposta 404:**
```json
{ "error": "Token invalido ou saida ja processada" }
```

---

### `POST /api/admin/login`
Autentica o administrador com username e senha. Retorna um cookie httpOnly (`auth_token`) com JWT.

**Headers:** `Content-Type: application/json`

**Parâmetros body:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `username` | string | Sim | Nome de usuário do administrador |
| `password` | string | Sim | Senha do administrador |

**Resposta 200:**
```json
{ "success": true }
```

**Resposta 400:**
```json
{ "error": "Username e senha sao obrigatorios" }
```

**Resposta 401:**
```json
{ "error": "Credenciais invalidas" }
```

**Cookie setado:** `auth_token` (httpOnly, secure em produção, sameSite lax, path /, maxAge 7 dias)

---

### `GET /entrada/confirmar?token=<uuid>` (Página)
Página que o visitante acessa ao escanear o QR Code na entrada.

Faz fetch para `/api/confirmar?token=<uuid>` e, em caso de sucesso, exibe um QR Code de saída para o visitante guardar.

---

### `GET /api/swagger`
Retorna a especificacao OpenAPI 3.0 em JSON, gerada automaticamente a partir dos comentarios JSDoc nas rotas.

**Resposta 200:**
```json
{ "openapi": "3.0.0", "info": { ... }, "paths": { ... } }
```

---

## 📖 Swagger UI

Acesse `/api-docs` no navegador para explorar a API interativamente via Swagger UI.

A documentacao e gerada automaticamente pelos comentarios `@swagger` nos arquivos de rota em `src/app/api/`.

---

## 👨‍💻 Equipe de Desenvolvimento

Projeto desenvolvido para fins acadêmicos e práticos por estudantes do curso de Ciência da Computação.

---

<footer align="center">

<h5>“Nosso objetivo é resolver os problemas do estacionamento da faculdade, os do resto do mundo ficam para a próxima versão.” 🌟</h5>

</footer>
