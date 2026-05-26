Documentação do Projeto InMidia (API & Frontend)Este documento detalha a arquitetura, fluxo de dados, rotas e componentes dos sistemas backend (API) e frontend (React) do projeto InMidia.Parte 1: Análise do Backend (API - api-inmidiav3)A API é construída em Node.js com Express e Mongoose (MongoDB), seguindo uma arquitetura robusta de Model-Service-Controller.1.1. Arquitetura e PadrõesPonto de Entrada (server.js): Inicializa o Express, conecta-se ao MongoDB (dbMongo.js), aplica middlewares globais (Helmet, CORS, JSON parser), e regista as rotas.Models (models/): Define os Schemas do Mongoose para todas as entidades de dados (User, Placa, Cliente, Aluguel, PropostaInterna, Contrato, Regiao, Empresa).Services (services/): Contém toda a lógica de negócio. Os serviços são responsáveis por interagir com os Models, executar validações de negócio (ex: verificar conflitos de aluguel) e usar Transações Mongoose para garantir a integridade dos dados (ex: aluguelService.js, empresaService.js).Controllers (controllers/): Camada fina que liga as rotas aos serviços. São responsáveis por extrair dados do req (body, params), chamar o serviço apropriado e enviar a resposta (res) ou delegar erros (next).Routes (routes/): Define os endpoints HTTP, associa-os aos controllers e aplica middlewares de autenticação, autorização e validação.Middlewares (middlewares/):authMiddleware.js: Valida o JWT e anexa req.user.adminAuthMiddleware.js: Valida se req.user.role === 'admin'.apiKeyAuthMiddleware.js: Valida o x-api-key para rotas públicas.uploadMiddleware.js: Configura multer e multer-s3 (R2) para upload de imagens.errorHandler.js: Middleware global que captura erros (especialmente AppError) e formata respostas de erro para dev/prod.Validators (validators/): Usam express-validator para sanitizar e validar dados de entrada. authValidator.js fornece um handleValidationErrors centralizado que passa erros formatados para o errorHandler.1.2. Modelos de Dados (Entidades Principais)ModeloFicheiroDescriçãoRelações PrincipaisEmpresaEmpresa.jsEntidade central. Contém nome, cnpj, dados de endereço e chaves de API.User (1:N), Placa (1:N), Cliente (1:N), etc.UserUser.jsUtilizador do sistema. Tem role ('user' ou 'admin').Empresa (N:1)ClienteCliente.jsO cliente final (anunciante). Contém dados de contacto e campos para PDF.Empresa (N:1), Aluguel (1:N), PropostaInterna (1:N)RegiaoRegiao.jsUma região geográfica (ex: "Zona Sul").Empresa (N:1), Placa (1:N)PlacaPlaca.jsO outdoor. Contém numero_placa, coordenadas, imagem, disponivel.Empresa (N:1), Regiao (N:1), Aluguel (1:N)AluguelAluguel.jsRegisto de locação. Define data_inicio e data_fim.Placa (N:1), Cliente (N:1), Empresa (N:1)PropostaInternaPropostaInterna.jsRascunho de proposta. Contém array de placas, datas e valorTotal.Cliente (N:1), Empresa (N:1), Placa (N:M)ContratoContrato.jsDocumento formal gerado a partir de uma PI.PropostaInterna (1:1), Cliente (N:1), Empresa (N:1)1.3. Análise de MiddlewaresMiddlewareFicheiroFunçãohelmetserver.js(Global) Adiciona headers de segurança HTTP (OWASP).corsserver.js(Global) Permite requisições cross-origin (do Frontend).express.jsonserver.js(Global) Faz o parse de body application/json.express.staticserver.js(Global) Serve ficheiros estáticos da pasta public/ (ex: logo para PDFs).authenticateTokenauthMiddleware.jsVerifica o Authorization: Bearer <token> JWT. Anexa req.user se válido.adminAuthMiddlewareadminAuthMiddleware.jsVerifica se req.user.role === 'admin'. Bloqueia acesso se não for.apiKeyAuthMiddlewareapiKeyAuthMiddleware.jsVerifica o header x-api-key. Compara o prefixo e o hash (bcrypt) com a Empresa no DB. Anexa req.empresa.upload.single(field)uploadMiddleware.jsMiddleware do Multer/S3. Trata upload de multipart/form-data para o R2. Anexa req.file.rateLimitauth.js(Específico da Rota) Limita tentativas de login (/auth/login).*ValidationRules()validators/*.js(Específico da Rota) Cadeia de validação do express-validator.handleValidationErrorsvalidators/authValidator.js(Específico da Rota) Coleta erros do express-validator e cria um AppError (400).errorHandlererrorHandler.js(Global) Middleware final. Captura todos os erros (via next(err)), formata a resposta de erro (JSON).1.4. Mapa de Rotas da API (Endpoints)Abaixo está um mapa completo de todas as rotas expostas pela API, seus middlewares e os dados esperados.Prefixo Público (Sem Auth): /apiRotaMétodoDescriçãoMiddlewaresParâmetros/Body/empresas/registerPOSTRegista uma nova Empresa e seu Utilizador Admin.registerValidationRules, handleValidationErrorsBody: nome_empresa, cnpj, nome, sobrenome, username, email, passwordPrefixo Público (Sem Auth): /api/v1RotaMétodoDescriçãoMiddlewaresParâmetros/Body/statusGETHealth check da API.N/AN/A/docsGETExibe a documentação Swagger (UI).swaggerUiN/A/auth/loginPOSTAutentica um utilizador.loginLimiter, validateLogin, handleValidationErrorsBody: email, password/auth/forgot-passwordPOSTSolicita reset de senha.validateForgotPassword, handleValidationErrorsBody: email/auth/reset-password/:tokenPOSTEfetiva o reset de senha.validateResetPassword, handleValidationErrorsParams: token, Body: newPassword/auth/verify-token/:tokenGETVerifica a validade de um token de reset.validateVerifyToken, handleValidationErrorsParams: tokenPrefixo Protegido por API Key: /api/public (Middleware: apiKeyAuthMiddleware)RotaMétodoDescriçãoMiddlewaresParâmetros/Body/placas/disponiveisGETLista placas com disponivel: true.apiKeyAuthMiddlewareN/APrefixo Protegido por JWT: /api/v1 (Middleware Base: authenticateToken)Rotas de Utilizador (/user)| Rota | Método | Descrição | Middlewares | Parâmetros/Body || :--- | :--- | :--- | :--- | :--- || /me | GET | Obtém o perfil do utilizador logado. | auth | N/A || /me | PUT | Atualiza o perfil do utilizador logado. | auth, (validation), handleValidationErrors | Body: nome?, sobrenome?, username?, email?, password? || /me/empresa | GET | Obtém detalhes da empresa do utilizador (Admin). | auth | N/A || /me/empresa/regenerate-api-key | POST | Regenera a API key da empresa (Admin). | auth, (validation), handleValidationErrors | Body: password |Rotas de Empresa (/empresa)| Rota | Método | Descrição | Middlewares | Parâmetros/Body || :--- | :--- | :--- | :--- | :--- || /details | GET | Obtém detalhes públicos da empresa. | auth | N/A || /details | PUT | Atualiza detalhes da empresa. | auth, updateEmpresaRules, handleValidationErrors | Body: nome?, cnpj?, endereco?, bairro?, cidade?, telefone? |Rotas de Admin (/admin) (Middlewares Base: authenticateToken, adminAuthMiddleware)| Rota | Método | Descrição | Middlewares | Parâmetros/Body || :--- | :--- | :--- | :--- | :--- || /users | GET | Lista todos os utilizadores da empresa. | auth, admin | N/A || /users | POST | Cria um novo utilizador na empresa. | auth, admin, validateUserCreation, handleValidationErrors | Body: username, email, password, nome, sobrenome, role? || /users/:id/role | PUT | Altera a role de um utilizador. | auth, admin, validateRoleUpdate, handleValidationErrors | Params: id, Body: role || /users/:id | DELETE| Apaga um utilizador. | auth, admin, validateIdParam, handleValidationErrors | Params: id |Rotas de Regiões (/regioes)| Rota | Método | Descrição | Middlewares | Parâmetros/Body || :--- | :--- | :--- | :--- | :--- || / | GET | Lista todas as regiões da empresa. | auth | N/A || / | POST | Cria uma nova região. | auth, validateRegiaoBody, handleValidationErrors | Body: nome || /:id | PUT | Atualiza uma região. | auth, validateIdParam, validateRegiaoBody, handleValidationErrors | Params: id, Body: nome || /:id | DELETE| Apaga uma região. | auth, validateIdParam, handleValidationErrors | Params: id |Rotas de Clientes (/clientes)| Rota | Método | Descrição | Middlewares | Parâmetros/Body || :--- | :--- | :--- | :--- | :--- || / | GET | Lista todos os clientes (com paginação). | auth | Query: page?, limit? || / | POST | Cria um novo cliente. | auth, upload.single('logo'), validateClienteBody, handleValidationErrors | FormData: nome, email, cnpj?, telefone?, endereco?, bairro?, cidade?, responsavel?, segmento?, logo? || /:id | GET | Obtém um cliente por ID. | auth, validateIdParam, handleValidationErrors | Params: id || /:id | PUT | Atualiza um cliente. | auth, upload.single('logo'), validateIdParam, validateClienteBody, handleValidationErrors | Params: id, FormData: (mesmo do POST) || /:id | DELETE| Apaga um cliente. | auth, validateIdParam, handleValidationErrors | Params: id |Rotas de Placas (/placas)| Rota | Método | Descrição | Middlewares | Parâmetros/Body || :--- | :--- | :--- | :--- | :--- || / | GET | Lista todas as placas (com filtros/paginação). | auth | Query: page?, limit?, sortBy?, order?, regiao_id?, disponivel?, search? || / | POST | Cria uma nova placa. | auth, upload.single('imagem'), placaValidationRules, handleValidationErrors | FormData: numero_placa, regiao, coordenadas?, nomeDaRua?, tamanho?, imagem? || /locations | GET | Lista coordenadas de todas as placas. | auth | N/A || /disponiveis | GET | Lista placas disponíveis num período (para Modal PI). | auth | Query: dataInicio, dataFim || /:id | GET | Obtém uma placa por ID. | auth, validateIdParam, handleValidationErrors | Params: id || /:id | PUT | Atualiza uma placa. | auth, upload.single('imagem'), validateIdParam, placaValidationRules, handleValidationErrors | Params: id, FormData: (mesmo do POST) || /:id | DELETE| Apaga uma placa. | auth, validateIdParam, handleValidationErrors | Params: id || /:id/disponibilidade | PATCH | Alterna o status disponivel (manutenção). | auth, validateIdParam, handleValidationErrors | Params: id |Rotas de Aluguéis (/alugueis)| Rota | Método | Descrição | Middlewares | Parâmetros/Body || :--- | :--- | :--- | :--- | :--- || / | POST | Cria um novo aluguel (reserva). | auth, validateAluguel, handleValidationErrors | Body: placa_id, cliente_id, data_inicio, data_fim || /:id | DELETE| Apaga (cancela) um aluguel. | auth, validateIdParam, handleValidationErrors | Params: id || /placa/:placaId | GET | Lista histórico de aluguéis de uma placa. | auth, validatePlacaIdParam, handleValidationErrors | Params: placaId |Rotas de Propostas Internas (PIs) (/pis)| Rota | Método | Descrição | Middlewares | Parâmetros/Body || :--- | :--- | :--- | :--- | :--- || / | GET | Lista PIs (com filtros/paginação). | auth | Query: page?, limit?, sortBy?, order?, status?, clienteId? || / | POST | Cria uma nova PI. | auth, piValidationRules, handleValidationErrors | Body: clienteId, tipoPeriodo, dataInicio, dataFim, valorTotal, descricao, placas?, formaPagamento? || /:id | GET | Obtém uma PI por ID. | auth, validateIdParam, handleValidationErrors | Params: id || /:id | PUT | Atualiza uma PI. | auth, validateIdParam, piValidationRules, handleValidationErrors | Params: id, Body: (mesmo do POST) || /:id | DELETE| Apaga uma PI. | auth, validateIdParam, handleValidationErrors | Params: id || /:id/download| GET | Baixa o PDF da PI. | auth, validateIdParam, handleValidationErrors | Params: id |Rotas de Contratos (/contratos)| Rota | Método | Descrição | Middlewares | Parâmetros/Body || :--- | :--- | :--- | :--- | :--- || / | GET | Lista Contratos (com filtros/paginação). | auth | Query: page?, limit?, sortBy?, order?, status?, clienteId? || / | POST | Cria um Contrato a partir de uma PI. | auth, validateContratoCreateBody, handleValidationErrors | Body: piId || /:id | GET | Obtém um Contrato por ID. | auth, validateIdParam, handleValidationErrors | Params: id || /:id | PUT | Atualiza um Contrato (ex: status). | auth, validateIdParam, validateContratoUpdateBody, handleValidationErrors | Params: id, Body: status? || /:id | DELETE| Apaga um Contrato (se rascunho). | auth, validateIdParam, handleValidationErrors | Params: id || /:id/download| GET | Baixa o PDF do Contrato. | auth, validateIdParam, handleValidationErrors | Params: id |Rotas de Relatórios (/relatorios)| Rota | Método | Descrição | Middlewares | Parâmetros/Body || :--- | :--- | :--- | :--- | :--- || /placas-por-regiao | GET | Dados para gráfico de placas por região. | auth | N/A || /dashboard-summary | GET | Dados para os cards do Dashboard. | auth | N/A || /ocupacao-por-periodo | GET | JSON de ocupação (para página Relatórios). | auth, validateDateRange | Query: data_inicio, data_fim || /export/ocupacao-por-periodo | GET | PDF de ocupação. | auth, validateDateRange | Query: data_inicio, data_fim |Parte 2: Análise do Frontend (inmidia-react)O frontend é construído em React (Vite) e utiliza react-router-dom para navegação, react-hook-form para formulários, e @tanstack/react-query para gestão de estado do servidor (data fetching e caching).2.1. Arquitetura e PadrõesPonto de Entrada (main.jsx): Renderiza o App e envolve-o com todos os providers globais:QueryClientProvider: Habilita o React Query.BrowserRouter: Habilita o react-router-dom.AuthProvider: Fornece dados de utilizador e token.ConfirmationProvider: Fornece um modal de confirmação global.Gestão de Estado Global:Autenticação (AuthContext.jsx): Armazena user, token, isAuthenticated, e isLoading (para verificação inicial). Sincroniza com localStorage e fornece login(), logout(), updateUser().Estado do Servidor (React Query): Quase todos os dados da API (placas, clientes, regiões, etc.) são geridos pelo React Query (useQuery).Modais de Confirmação (ConfirmationContext.jsx): O hook useConfirmation() retorna uma função que exibe um modal de confirmação global (ConfirmationModal.jsx) e retorna uma Promessa (resolvida ao confirmar, rejeitada ao cancelar).API Service (services/api.js): Ponto central para todas as chamadas axios.apiClient: Instância centralizada do Axios.Request Interceptor: Adiciona o token JWT (lido do localStorage) a todas as rotas protegidas.Response Interceptor: Crucial para a estabilidade. Trata erros 401 (Unauthorized) executando um logout forçado e redirecionamento para /login. Também trata erros 500 e erros de Blob (como PDFs) de forma assíncrona.Roteamento (App.jsx):Suspense/lazy: Todas as páginas são carregadas dinamicamente (lazy-loaded).ProtectedRoute: Verifica isAuthenticated do AuthContext antes de permitir o acesso ao MainLayout.AdminRoute: Verifica user.role === 'admin' antes de permitir acesso a rotas de admin.MainLayout: Renderiza a Sidebar e o Header fixos, e um <Outlet /> para o conteúdo da página.Refatoração Estrutural: A navegação foi centralizada. ClientesPage, PIsPage, e ContratosPage não são mais rotas de nível superior; elas agora são renderizadas dentro do <Outlet /> da EmpresaSettingsPage (rota /empresa-settings). A Sidebar (Sidebar.jsx) reflete isso, apontando o link "Empresa" para /empresa-settings.2.2. Mapeamento de Rotas e ComponentesRota (Frontend)Componente(s)ProteçãoDescrição/<Navigate to="/status">PúblicaRedireciona para a página de status./statusApiStatusPagePúblicaHealth check da API./loginLoginPagePúblicaFormulário de login./empresa-registerRegisterPagePúblicaFormulário de registo de nova empresa/admin./forgot-passwordForgotPasswordPagePúblicaFormulário para solicitar reset de senha./dashboardMainLayout > DashboardPageProtegidaExibe cards de resumo e gráficos./placasMainLayout > PlacasPageProtegidaLista, filtra e gere PlacaCard./placas/novoMainLayout > PlacaFormPageProtegidaFormulário para criar nova placa./placas/editar/:idMainLayout > PlacaFormPageProtegidaFormulário para editar placa (modo edição)./placas/:idMainLayout > PlacaDetailsPageProtegidaDetalhes da placa, mapa e histórico de aluguéis./regioesMainLayout > RegioesPageProtegidaTabela de CRUD (Criar, Ler, Atualizar, Apagar) para Regiões./mapMainLayout > MapPageProtegidaMapa Leaflet com todas as placas./relatoriosMainLayout > RelatoriosPageProtegidaFiltros de data e gráficos de ocupação./userMainLayout > UserPageProtegidaFormulário para o utilizador logado editar o seu perfil./empresa-settingsMainLayout > EmpresaSettingsPageProtegidaLayout de abas (com <Outlet />) para gestão da empresa./empresa-settings/detalhes... > EmpresaDetalhesProtegida(Aba 1) Formulário para editar dados da empresa (nome, cnpj, etc.)./empresa-settings/clientes... > ClientesPageProtegida(Aba 2) Tabela de CRUD para Clientes./empresa-settings/propostas... > PIsPageProtegida(Aba 3) Tabela de CRUD para Propostas Internas (PIs)./empresa-settings/contratos... > ContratosPageProtegida(Aba 4) Tabela de CRUD para Contratos./empresa-settings/api... > EmpresaApiKeyAdmin(Aba 5) Gestão da API Key (apenas Admin)./admin-usersMainLayout > AdminUsersPageAdminTabela de CRUD para Utilizadores (apenas Admin).*NotFoundPagePúblicaPágina 404.2.3. Análise Focada: PIModalForm.jsx (Componente Complexo)Este é o componente mais complexo do frontend, gerindo um formulário de 3 etapas.Estrutura:PIModalForm (Pai): Controla o useForm (RHF) para todos os campos. Controla o estado da etapa (currentStep). Busca clientes (para a Etapa 1).PIFormStep1_Cliente (Filho): Recebe register, errors, clientes. Auto-preenche campos responsavel e segmento (via setValue) quando o cliente muda.PIFormStep3_Valores (Filho): Recebe register, errors. Controla dataInicio, dataFim, valorTotal. A dataFim é calculada automaticamente com base na dataInicio e tipoPeriodo.PIModalFormPlacaSelector (Filho): Recebe control (RHF) para se ligar ao campo placas. Crucialmente, também recebe dataInicio e dataFim (lidos via watch no Pai) como props.Fluxo de Dados (Problemático):O PIModalForm (Pai) usa watch para observar dataInicio e dataFim (que são definidos na Etapa 3).Esses valores são passados como props para a PIModalFormPlacaSelector (Etapa 2).A PIModalFormPlacaSelector (Etapa 2) usa essas props na queryKey do seu useQuery para fetchPlacasDisponiveis.useQuery(['placasDisponiveis', dataInicio, dataFim], ...)Identificação da Inconsistência:Dependência não linear: A Etapa 2 (Seleção de Placas) depende de dados que são definidos na Etapa 3 (Datas).Usabilidade: O utilizador está na Etapa 2, mas a lista de placas disponíveis depende dos valores de dataInicio e dataFim que ele só irá preencher (ou confirmar) na Etapa 3.Como Funciona (Apesar da Estranheza): O useForm no PIModalForm (Pai) é inicializado com defaultValues, incluindo uma dataInicio (o dia de hoje). A PIFormStep3_Valores (Etapa 3) calcula automaticamente a dataFim. Como o watch está no componente Pai, esses valores estão sempre disponíveis e são passados para a Etapa 2.O Risco: Se o utilizador for para a Etapa 3, alterar a data de início, e depois voltar para a Etapa 2, o watch no Pai irá atualizar, as props da Etapa 2 mudarão, a queryKey mudará, e o useQuery para fetchPlacasDisponiveis será re-executado, atualizando a lista de placas. Embora funcional, este fluxo é "escondido" e pode ser confuso.Sugestão de Melhoria:Reordenar Etapas: A solução mais limpa seria reordenar as etapas no PIModalForm.jsx:Etapa 1: PIFormStep1_Cliente (Cliente e Descrição)Etapa 2: PIFormStep3_Valores (Datas, Período, Valor, Pgto)Etapa 3: PIModalFormPlacaSelector (Seleção de Placas)Justificativa: Desta forma, quando o utilizador chega à Etapa 3 (Seleção de Placas), as dataInicio e dataFim já foram definidas e validadas na etapa anterior, criando um fluxo de dados linear e mais intuitivo.Parte 3: Fluxogramas (Mermaid)3.1. Fluxograma: API - Fluxo de Requisição Protegida (Ex: GET /placas)Snippet de códigosequenceDiagram
    participant FE as Frontend (React)
    participant API as API (Express)
    participant AuthMW as authMiddleware
    participant PlacaRoute as Placa Routes
    participant PlacaCtrl as placaController
    participant PlacaSvc as placaService
    participant DB as MongoDB (Mongoose)

    FE->>+API: GET /api/v1/placas (com Token JWT)
    API->>+AuthMW: authenticateToken(req)
    AuthMW->>AuthMW: Verifica JWT
    AuthMW-->>-API: OK (anexa req.user)
    API->>+PlacaRoute: (Match Rota GET /)
    PlacaRoute->>+PlacaCtrl: getAllPlacasController(req)
    PlacaCtrl->>+PlacaSvc: getAllPlacas(req.user.empresaId, req.query)
    PlacaSvc->>+DB: Placa.find({empresa: id})
    DB-->>-PlacaSvc: [placasDocs]
    PlacaSvc->>+DB: Aluguel.find({placa: {$in: [...]}})
    DB-->>-PlacaSvc: [alugueisAtivos]
    PlacaSvc-->>-PlacaCtrl: { data: [placasComCliente], pagination: {...} }
    PlacaCtrl-->>-API: res.status(200).json(...)
    API-->>-FE: Resposta JSON 200 OK
3.2. Fluxograma: API - Estrutura de Roteamento e MiddlewaresSnippet de códigograph TD
    A[Requisição HTTP] --> B{server.js};
    B --> C[Middlewares Globais (Helmet, CORS, etc.)];
    C --> D{Router Principal};

    D -- Rota /api/empresas/register --> E[publicRegisterRoutes.js];
    E --> F[Validators (empresaValidator)];
    F --> G[handleValidationErrors];
    G --> H[empresaController];
    H --> I[empresaService];
    I --> J[MongoDB (Transação)];

    D -- Rota /api/v1/auth/* --> K[auth.js];
    K --> L[Rate Limiter (Login)];
    L --> M[Validators (authValidator)];
    M --> N[handleValidationErrors];
    N --> O[authController];
    O --> P[authService];

    D -- Rota /api/v1/* --> Q[authMiddleware (JWT)];
    Q -- Falha (401/403) --> Z[errorHandler];
    Q -- Sucesso --> R{Router /v1};

    R -- /admin/* --> S[adminAuthMiddleware (Role)];
    S -- Falha (403) --> Z;
    S -- Sucesso --> T[adminRoutes.js];
    T --> U[adminController];
    U --> V[adminService];

    R -- /placas/* --> W[placas.js];
    W -- / (POST) ou /:id (PUT) --> X[upload.single('imagem')];
    X --> Y[placaController];
    W -- Outras rotas --> Y[placaController];
    Y --> AA[placaService];

    R -- /clientes/* --> AB[clienteRoutes.js];
    AB -- POST/PUT --> AC[upload.single('logo')];
    AC --> AD[clienteController];
    AB -- GET/DELETE --> AD[clienteController];
    AD --> AE[clienteService];
    
    R -- /pis/*, /contratos/*, /relatorios/*, etc. --> AF[Outras Rotas...];
    
    D -- Rota /api/public/* --> AG[apiKeyAuthMiddleware (X-API-Key)];
    AG -- Falha (401/403) --> Z;
    AG -- Sucesso --> AH[publicApiRoutes.js];
    AH --> AI[publicApiController];
    AI --> AJ[publicApiService];

    subgraph "Tratamento de Erros"
        direction TB
        G -- Erro de Validação --> Z
        N -- Erro de Validação --> Z
        T -- Erro de Validação --> Z
        W -- Erro de Validação --> Z
        AB -- Erro de Validação --> Z
        
        V -- Erro (AppError) --> Z[errorHandler];
        P -- Erro (AppError) --> Z;
        AA -- Erro (AppError) --> Z;
        AE -- Erro (AppError) --> Z;
        I -- Erro (AppError) --> Z;
        AJ -- Erro (AppError) --> Z;
    end
3.3. Fluxograma: Frontend - Fluxo de Dados (Ex: PIModalForm)Snippet de códigograph TD
    subgraph PIsPage.jsx
        A[Botão "Criar PI"] -- Click --> B(Abrir Modal);
    end

    subgraph PIModalForm.jsx (Pai)
        B --> C{Formulário RHF (useForm)};
        C -- Watch(dataInicio, dataFim) --> D[Valores de Data];
        C -- control --> E[Campo 'placas'];
        C -- register --> F[Outros Campos];
        
        G[useQuery(['clientes'])] --> H[Clientes];
        
        C -- onSubmit --> S[api.js::createPI];
    end

    subgraph PIFormStep1_Cliente.jsx (Etapa 1)
        C --> I[Render Etapa 1];
        H --> I;
        I -- Seleciona Cliente --> C;
    end
    
    subgraph PIModalFormPlacaSelector.jsx (Etapa 2)
        C -- props --> J[Render Etapa 2];
        D -- props (dataInicio, dataFim) --> J;
        E -- props (control) --> J;
        
        J --> K[useQuery(['regioes'])];
        J --> L[useQuery(['placas', 'all'])];
        J --> M[useQuery(['placasDisponiveis', dataInicio, dataFim])];
        
        K & L & M --> N[Listas de Placas];
        N -- Seleciona Placas --> E;
    end
    
    subgraph PIFormStep3_Valores.jsx (Etapa 3)
        C -- props --> O[Render Etapa 3];
        F -- register --> O;
        O -- Altera Data Início --> D;
        O -- Altera Tipo Período --> D;
    end
    
    S -- POST /api/v1/pis --> T[Backend];
Parte 4: Planeamento de Manutenção e Evolução4.1. Estratégia de Atualização (Novas Funcionalidades)O projeto está bem estruturado para expansão.Para adicionar uma nova funcionalidade (ex: "Sistema de Faturas"):Backend:Model: Criar models/Fatura.js (Schema: pi, cliente, empresa, valor, dataVencimento, status).Service: Criar services/faturaService.js. Implementar a lógica de negócio (ex: createFaturaFromPI(piId), listFaturas(empresaId), marcarComoPaga(faturaId)).Controller: Criar controllers/faturaController.js (CRUD básico: create, getAll, updateStatus).Routes: Criar routes/faturaRoutes.js. Proteger com authenticateToken. Adicionar validações (express-validator).Server.js: Registar a rota: app.use('/api/v1/faturas', faturaRoutes);.Frontend:API: Adicionar fetchFaturas, createFatura, updateFaturaStatus ao services/api.js.Componente: Criar pages/Faturas/FaturasPage.jsx.Query: Usar useQuery(['faturas', filters]) para buscar os dados.Mutations: Usar useMutation para updateFaturaStatus.Roteamento: Adicionar a nova página ao App.jsx (provavelmente dentro do layout de /empresa-settings como uma nova aba).4.2. Rastreamento e Correção de BugsBackend: O errorHandler.js é o ponto nevrálgico.Erros Operacionais (4xx): Erros de validação (do validators/) ou de lógica (do services/ via new AppError()) são tratados e retornam JSON claros para o frontend.Erros de Programador (5xx): Qualquer erro não capturado (ex: null.property) é apanhado pelo errorHandler, logado (com stack trace) e retorna uma mensagem genérica "Erro interno" (em produção).Correção: A maioria dos bugs de lógica de negócio deve ser corrigida nos ficheiros services/.Frontend: O api.js (interceptor de resposta) é o ponto principal.Erros 401: Tratados globalmente (logout).Erros 400/409 (Validação): As mutações (ex: createClienteMutation) devem usar o onError para passar os erros da API (ex: error.response.data.errors) para o setError do react-hook-form. (Isto já está a ser feito corretamente em ClientesPage.jsx e AdminUsersPage.jsx).Erros 500: São capturados pelo useQuery ou useMutation e exibidos ao utilizador via useToast.4.3. Boas Práticas RecomendadasBackend (Manter):Transações: Continuar a usar transações (como em aluguelService.js) para operações de escrita complexas que envolvem múltiplos modelos (ex: criar Aluguel e atualizar Placa).Validação na Rota: Manter a validação (express-validator) na camada de Rotas, antes de chegar ao Controller.Lógica no Serviço: Manter os Controllers "magros" (thin) e a lógica de negócio nos Services.Tratamento de Erros: Usar AppError para todos os erros de negócio esperados.Frontend (Manter e Melhorar):React Query: Excelente escolha. Continuar a usar useQuery para data fetching e useMutation para data modification. Usar queryClient.invalidateQueries para manter os dados sincronizados após mutações.api.js Centralizado: Manter um único local para todas as definições de chamadas Axios.Formulários: react-hook-form é excelente. Continuar a usá-lo para todos os formulários.Melhoria (PIModalForm): Reordenar as etapas do PIModalForm para (1) Cliente, (2) Datas/Valores, (3) Placas. Isso tornará o fluxo de dados (dataInicio/dataFim -> fetchPlacasDisponiveis) linear e mais fácil de manter.Variáveis de Ambiente: O frontend (utils/config.js) lê VITE_API_URL do .env local. O backend (config/config.js) lê MONGODB_URI, JWT_SECRET, etc. Manter esta separação é crucial.Parte 5: Subprompt para Atualização Incremental(Para si, quando precisar que eu atualize esta documentação)Plaintext[INSTRUÇÃO DE ATUALIZAÇÃO - PROJETO INMIDIA]

Com base na análise completa e documentação do projeto InMidia (API Backend e Frontend React) que você gerou anteriormente, receba as seguintes atualizações.

Eu forneci [novos ficheiros / alterações em ficheiros existentes].

**Minhas Alterações:**
(Cole aqui o conteúdo dos novos ficheiros ou descreva as alterações nos ficheiros existentes. Ex: "Adicionei o ficheiro 'services/faturaService.js'..." ou "Modifiquei 'controllers/placaController.js' para adicionar...")

**Ficheiros Atualizados:**
[Cole o conteúdo completo dos ficheiros novos ou modificados aqui]

**Sua Tarefa:**
1.  Analise o novo código fornecido.
2.  Atualize de forma incremental a documentação existente (listas de rotas, análise de componentes, fluxogramas) para refletir estas novas alterações.
3.  Indique especificamente o que foi alterado na documentação e nos fluxogramas.
4.  Se a alteração introduzir inconsistências, aponte-as.