# 🥟 Pastel24h - Sistema Completo de Gestão de Turnos para Restaurantes

Sistema profissional de gestão de turnos desenvolvido especificamente para restaurantes que precisam de controle rigoroso de caixa, inventário detalhado, relatórios financeiros e gestão completa de colaboradores. O Pastel24h oferece uma solução completa que abrange desde o controle operacional diário até análises gerenciais avançadas.

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Funcionalidades Principais](#-funcionalidades-principais)
- [Início Rápido](#-início-rápido)
- [Arquitetura do Sistema](#️-arquitetura-do-sistema)
- [Funcionalidades Detalhadas](#-funcionalidades-detalhadas)
- [Estrutura do Banco de Dados](#️-estrutura-do-banco-de-dados)
- [Interface e Experiência do Usuário](#-interface-e-experiência-do-usuário)
- [Segurança e Controle de Acesso](#-segurança-e-controle-de-acesso)
- [Relatórios e Análises](#-relatórios-e-análises)
- [Tecnologias Utilizadas](#️-tecnologias-utilizadas)
- [Scripts e Comandos](#-scripts-e-comandos)
- [Deploy e Produção](#-deploy-e-produção)
- [Desenvolvimento](#-desenvolvimento)
- [Contribuição](#-contribuição)

## 🎯 Visão Geral

O **Pastel24h** é uma aplicação web full-stack projetada para resolver os desafios específicos da gestão operacional de restaurantes. O sistema oferece controle completo sobre turnos de trabalho, permitindo que funcionários registrem todas as atividades do estabelecimento enquanto administradores têm acesso a relatórios detalhados e ferramentas de gestão avançadas.

### Principais Problemas Resolvidos

- **Controle de Caixa Preciso**: Eliminação de divergências através de controle rigoroso de entrada e saída de dinheiro
- **Gestão de Inventário**: Rastreamento completo de produtos desde entrada até venda ou descarte
- **Transparência Operacional**: Timeline completa de todas as atividades realizadas no estabelecimento
- **Relatórios Automatizados**: Geração automática de relatórios financeiros e operacionais
- **Gestão de Pessoal**: Controle de horas trabalhadas e cálculo automático de pagamentos

## 🚀 Funcionalidades Principais

### Para Funcionários (Nível Operacional)

#### Gestão de Turnos
- **Abertura de Turno**: Registro detalhado do caixa inicial (notas e moedas separadamente)
- **Controle de Produtos**: Sistema completo de entrada, chegada, sobra, descarte e consumo interno
- **Múltiplos Métodos de Pagamento**: Dinheiro, PIX, Stone (cartão/débito/crédito/voucher), PagBank
- **Gestão de Colaboradores**: Registro de funcionários que auxiliaram durante o turno
- **Fechamento Inteligente**: Cálculo automático de divergências e validações antes do fechamento

#### Recursos Avançados para Funcionários
- **Interface Intuitiva**: Design otimizado para uso rápido durante o trabalho
- **Validações em Tempo Real**: Alertas sobre possíveis inconsistências
- **Histórico de Ações**: Visualização de todas as operações realizadas
- **Controle de Troco**: Gestão separada de notas e moedas

### Para Administradores (Nível Gerencial)

#### Dashboard Executivo
- **Visão Geral Financeira**: Resumo de vendas, métodos de pagamento e performance
- **Análise de Produtos**: Produtos mais vendidos, categorias de maior receita
- **Gestão de Divergências**: Identificação e análise de discrepâncias de caixa
- **Métricas de Performance**: KPIs operacionais e financeiros

#### Ferramentas Administrativas
- **Sistema de Correções**: Correção de turnos fechados com log completo de auditoria
- **Gestão de Usuários**: Criação, edição e controle de acesso de funcionários
- **Relatórios Semanais**: Cálculo automático de horas trabalhadas e valores a pagar
- **Timeline Global**: Registro cronológico de todas as atividades do sistema
- **Exportação Avançada**: Geração de PDFs detalhados e planilhas Excel

## 🏁 Início Rápido

### Pré-requisitos

- **Node.js 20** ou superior
- **npm** ou gerenciador de pacotes compatível
- **Git** para controle de versão

### Instalação Completa

1. **Clone o repositório e navegue para o diretório:**
```bash
git clone [seu-repositorio]
cd pastel24h
```

2. **Instale todas as dependências:**
```bash
npm install
```

3. **Configure as variáveis de ambiente:**
```bash
# Gera uma chave segura para sessões e cria o arquivo .env
echo "SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" > .env
```

4. **Inicialize o banco de dados:**
```bash
# Este comando cria todas as tabelas necessárias
npm run db:migrate
```

5. **Inicie o servidor de desenvolvimento:**
```bash
# Inicia o servidor com hot-reload na porta 5000
npm run dev
```

6. **Acesse a aplicação:**
   - Abra seu navegador em `http://localhost:5000`
   - Crie sua primeira conta de administrador
   - Comece a configurar produtos e usuários

## 🏗️ Arquitetura do Sistema

### Visão Arquitetural

O Pastel24h segue uma arquitetura de aplicação web moderna com separação clara entre frontend e backend, garantindo escalabilidade, manutenibilidade e performance.

#### Backend (Express.js + SQLite)

**Stack Principal:**
- **Express.js**: Framework web robusto para Node.js
- **SQLite + Drizzle ORM**: Banco de dados local com queries type-safe
- **Passport.js**: Sistema de autenticação com estratégias locais
- **Zod**: Validação de schemas e tipos TypeScript

**Características Técnicas:**
- **APIs RESTful**: Endpoints organizados por recursos com padrões consistentes
- **Autenticação Baseada em Sessão**: Segurança robusta com bcrypt e express-session
- **Middleware de Validação**: Validação automática de requests usando Zod schemas
- **Sistema de Permissões**: Controle granular baseado em roles (admin/funcionário)
- **WebSocket**: Atualizações em tempo real para sincronização de dados

#### Frontend (React + Vite)

**Stack Principal:**
- **React 18**: Framework moderno com hooks e context
- **TypeScript**: Tipagem estática para maior confiabilidade
- **Vite**: Build tool extremamente rápido para desenvolvimento
- **Wouter**: Roteamento leve e eficiente

**Bibliotecas de UI e Experiência:**
- **Shadcn/ui**: Componentes modernos e acessíveis
- **Tailwind CSS**: Framework CSS utilitário para styling
- **Radix UI**: Primitivos de UI acessíveis e customizáveis
- **Framer Motion**: Animações fluidas e responsivas
- **TanStack Query**: Gerenciamento inteligente de estado do servidor

**Recursos Avançados:**
- **Design Responsivo**: Interface otimizada para desktop, tablet e mobile
- **Progressive Web App**: Funciona offline e pode ser instalada
- **Otimização de Bundle**: Code splitting e lazy loading automático
- **Hot Module Replacement**: Desenvolvimento com feedback instantâneo

### Fluxo de Dados

```
Cliente → API Client → Express Routes → Middleware → Controllers → Drizzle ORM → SQLite
                                    ↓
WebSocket ← React Components ← TanStack Query ← JSON Response ← Business Logic
```

## 📊 Funcionalidades Detalhadas

### Sistema de Turnos Completo

#### Abertura de Turno
- **Validação de Caixa**: Verificação se existe caixa suficiente para operação
- **Registro Detalhado**: Separação entre notas e moedas para controle preciso
- **Herança de Caixa**: Opção de herdar o caixa final do turno anterior
- **Configuração Inicial**: Definição de colaboradores e observações

#### Durante o Turno
- **Entrada de Produtos**: Registro de mercadorias recebidas
- **Chegada**: Produtos que chegaram durante o turno
- **Vendas por Método**: Registro detalhado de cada venda por forma de pagamento
- **Consumo Interno**: Controle de produtos consumidos pela equipe
- **Descartes**: Registro de produtos perdidos ou danificados
- **Sangrias**: Retiradas de dinheiro do caixa com justificativa

#### Fechamento de Turno
- **Contagem Final**: Registro preciso do dinheiro em caixa
- **Cálculo de Divergências**: Comparação automática entre esperado e real
- **Validações**: Verificação de consistência antes do fechamento
- **Relatório Automático**: Geração de resumo completo do turno

### Controle de Inventário Avançado

#### Fórmula de Cálculo
O sistema utiliza uma fórmula matemática precisa para calcular vendas:

```
Quantidade Vendida = Entrada + Chegada - Sobra - Descarte - Consumo Interno
```

#### Categorias de Produtos
- **Pastéis Comuns**: Produtos do cardápio básico
- **Pastéis Especiais**: Itens premium ou sazonais
- **Caldo de Cana**: Bebidas naturais
- **Bebidas**: Refrigerantes, águas, sucos
- **Gelo**: Insumos para bebidas
- **Outros**: Produtos diversos

#### Controles Especiais
- **Estoque Mínimo**: Alertas automáticos para reposição
- **Precificação Dinâmica**: Ajuste de preços por produto
- **Ordenação Customizada**: Organização conforme fluxo de trabalho

### Sistema de Pagamentos Robusto

#### Métodos Aceitos
- **Dinheiro**: Controle tradicional com validação de troco
- **PIX**: Pagamentos instantâneos com taxas configuráveis
- **Stone Débito/Crédito/Voucher**: Integração com máquinas Stone
- **PagBank**: Suporte para cartões e pagamentos digitais

#### Recursos Financeiros
- **Taxas Configuráveis**: Definição de taxas por método de pagamento
- **Cálculo de Líquido**: Valores líquidos após descontos de taxas
- **Relatórios por Método**: Análise detalhada por forma de pagamento
- **Controle de Divergências**: Identificação automática de inconsistências

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais

#### Users (Usuários)
```sql
- id: Identificador único
- email: Login único do usuário
- password: Senha criptografada (bcrypt, 12 rounds)
- name: Nome completo
- role: admin | employee
- transportType: Tipo de transporte utilizado
- transportModeId: Referência ao modo de transporte
```

#### Shifts (Turnos)
```sql
- id: Identificador único do turno
- userId: Funcionário responsável
- startTime/endTime: Horários de início e fim
- initialCash/finalCash: Valores de caixa inicial e final
- initialCoins/finalCoins: Moedas separadamente
- gasExchange: Troca de gás realizada
- cashDivergence: Valor da divergência calculada
- status: open | closed
```

#### Products (Produtos)
```sql
- id: Identificador único
- name: Nome do produto
- category: Categoria (enum predefinido)
- price: Preço unitário
- minStock: Estoque mínimo recomendado
- sortOrder: Ordem de exibição
```

#### Shift Records (Registros do Turno)
```sql
- id: Identificador único
- shiftId: Referência ao turno
- productId: Produto registrado
- entrada/chegada/sobra/descarte/consumoInterno: Quantidades
- observations: Observações específicas
```

#### Timeline (Linha do Tempo)
```sql
- id: Identificador único
- action: Tipo de ação realizada
- details: Detalhes em JSON
- userId: Usuário que realizou a ação
- timestamp: Momento exato da ação
```

### Relacionamentos

O banco de dados utiliza relacionamentos bem definidos:
- **Users ↔ Shifts**: Um usuário pode ter vários turnos
- **Shifts ↔ Shift Records**: Um turno tem vários registros de produtos
- **Products ↔ Shift Records**: Um produto aparece em vários registros
- **Users ↔ Transport Modes**: Usuários têm modos de transporte
- **Shifts ↔ Corrections**: Turnos podem ter correções administrativas

## 💻 Interface e Experiência do Usuário

### Design System

#### Princípios de Design
- **Mobile-First**: Interface otimizada primeiro para dispositivos móveis
- **Acessibilidade**: Componentes seguem padrões WCAG 2.1
- **Consistência**: Design system unificado com Shadcn/ui
- **Performance**: Carregamento rápido e interações fluidas

#### Componentes Principais
- **Dashboard Cards**: Métricas visuais com ícones e cores semânticas
- **Data Tables**: Tabelas interativas com ordenação e filtros
- **Forms**: Formulários inteligentes com validação em tempo real
- **Charts**: Gráficos responsivos usando Recharts
- **Modals**: Diálogos contextuais para ações importantes

### Navegação e Fluxos

#### Para Funcionários
1. **Login** → **Dashboard** → **Abrir Turno** → **Registrar Atividades** → **Fechar Turno**
2. **Consulta de Histórico** → **Visualizar Turnos Anteriores**
3. **Gestão de Transporte** → **Configurar Meio de Transporte**

#### Para Administradores
1. **Login** → **Dashboard Admin** → **Visão Geral Financeira**
2. **Gestão** → **Usuários/Produtos/Relatórios/Correções**
3. **Análises** → **Relatórios Semanais/Timeline/Exportações**

## 🔐 Segurança e Controle de Acesso

### Autenticação
- **Estratégia Local**: Email e senha com Passport.js
- **Hash de Senhas**: bcrypt com 12 rounds de criptografia
- **Sessões Seguras**: express-session com store em memória
- **Cookies Seguros**: Configuração apropriada para produção

### Autorização
- **Role-Based Access Control (RBAC)**: Controle baseado em papéis
- **Middleware de Proteção**: Verificação automática de permissões
- **Rotas Protegidas**: Frontend e backend protegidos simultaneamente
- **Validação de Input**: Zod schemas em todos os endpoints

### Auditoria
- **Timeline Completa**: Log de todas as ações realizadas
- **Rastreamento de Mudanças**: Histórico de modificações em dados sensíveis
- **Sistema de Correções**: Trilha de auditoria para ajustes administrativos

## 📈 Relatórios e Análises

### Relatórios Operacionais
- **Resumo Diário**: Vendas, métodos de pagamento, divergências
- **Análise de Produtos**: Performance por categoria e item
- **Controle de Caixa**: Entradas, saídas e movimentações

### Relatórios Gerenciais
- **Relatórios Semanais**: Horas trabalhadas e cálculos de pagamento
- **Análise de Performance**: Comparativos entre períodos
- **Métricas de Eficiência**: KPIs operacionais e financeiros

### Exportações
- **PDF Detalhado**: Relatórios formatados para impressão
- **Excel Completo**: Planilhas com dados brutos para análise
- **Dados Estruturados**: JSON para integrações futuras

## 🛠️ Tecnologias Utilizadas

### Backend Technologies
- **Runtime**: Node.js 20+
- **Framework**: Express.js 4.21+
- **Database**: SQLite com Better-SQLite3
- **ORM**: Drizzle ORM com TypeScript
- **Authentication**: Passport.js + bcrypt
- **Validation**: Zod schemas
- **WebSocket**: ws library para tempo real

### Frontend Technologies
- **Framework**: React 18 com TypeScript
- **Build Tool**: Vite 5+ para desenvolvimento rápido
- **Routing**: Wouter para SPA routing
- **State Management**: TanStack Query v5
- **Styling**: Tailwind CSS + Shadcn/ui
- **UI Components**: Radix UI primitives
- **Charts**: Recharts para visualizações
- **Animations**: Framer Motion

### Development Tools
- **Package Manager**: npm
- **TypeScript**: Tipagem estática completa
- **ESBuild**: Build otimizado para produção
- **Cross-env**: Variáveis de ambiente cross-platform

### Export & Reports
- **PDF Generation**: jsPDF + AutoTable
- **Excel Export**: xlsx library
- **Date Handling**: date-fns para manipulação de datas

## 📋 Scripts e Comandos

### Desenvolvimento
```bash
# Servidor de desenvolvimento com hot-reload
npm run dev

# Verificação de tipos TypeScript (sem build)
npm run check
```

### Build e Produção
```bash
# Build completo (frontend + backend)
npm run build

# Build apenas do frontend (React + Vite)
npm run build:client

# Build apenas do backend (Express + esbuild)
npm run build:server

# Iniciar servidor de produção
npm run start
```

### Banco de Dados
```bash
# Gerar novas migrações a partir do schema
npm run db:generate

# Aplicar migrações pendentes (obrigatório na primeira execução)
npm run db:migrate
```

### Docker
```bash
# Construir imagem Docker
docker build -t pastel24h .

# Executar com Docker Compose (recomendado)
docker-compose up

# Executar imagem diretamente
docker run -p 5000:5000 -v ./data:/app/data pastel24h
```

## 🚢 Deploy e Produção

### Ambiente Docker (Recomendado)

O projeto inclui configuração completa para Docker:

```dockerfile
# Multi-stage build otimizado
FROM node:20-alpine AS builder
# Instala dependências e faz build

FROM node:20-alpine AS runtime
# Executa a aplicação com migrações automáticas
```

**Características:**
- **Multi-stage Build**: Otimização de tamanho da imagem
- **Migrações Automáticas**: Execução automática na inicialização
- **Volume Persistence**: Dados salvos em volume Docker
- **Health Checks**: Monitoramento de saúde do container

### Vercel Serverless

O projeto está preparado para deploy serverless:

```javascript
// api/index.js - Configuração para Vercel
export default (req, res) => {
  // Proxy para a aplicação Express
};
```

### Ambiente Tradicional

Para servidores tradicionais:

```bash
# Preparar ambiente
NODE_ENV=production npm ci --only=production
npm run build

# Executar
NODE_ENV=production npm start
```

## 👨‍💻 Desenvolvimento

### Configuração do Ambiente

1. **Instalar Node.js 20+** e npm
2. **Clonar o repositório** e instalar dependências
3. **Configurar .env** com SESSION_SECRET
4. **Executar migrações** do banco de dados
5. **Iniciar desenvolvimento** com `npm run dev`

### Estrutura de Pastas

```
pastel24h/
├── client/src/           # Frontend React
│   ├── components/       # Componentes reutilizáveis
│   ├── pages/           # Páginas da aplicação
│   ├── lib/             # Utilitários e lógica de negócio
│   └── hooks/           # React hooks customizados
├── server/              # Backend Express
│   ├── routes/          # Rotas da API
│   ├── lib/             # Lógica de negócio do servidor
│   └── middleware/      # Middlewares customizados
├── shared/              # Código compartilhado
│   └── schema.ts        # Schema do banco de dados
├── data/                # Banco de dados SQLite
├── migrations/          # Migrações do banco
└── api/                 # Configuração serverless
```

### Boas Práticas

- **TypeScript First**: Todo código em TypeScript
- **Componentização**: Componentes pequenos e reutilizáveis
- **Validação**: Zod schemas para todos os dados
- **Error Handling**: Tratamento robusto de erros
- **Performance**: Otimizações para carregamento rápido

### Testing Strategy

- **Type Safety**: TypeScript como primeira linha de defesa
- **Runtime Validation**: Zod schemas para validação em runtime
- **Manual Testing**: Testes manuais abrangentes para fluxos críticos
- **Database Validation**: Constraints e relacionamentos no banco

## 🤝 Contribuição

### Como Contribuir

1. **Fork** o repositório
2. **Crie uma branch** para sua feature (`git checkout -b feature/MinhaFeature`)
3. **Commit** suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. **Push** para a branch (`git push origin feature/MinhaFeature`)
5. **Abra um Pull Request** com descrição detalhada

### Padrões de Código

- **ESLint/Prettier**: Formatação automática
- **Conventional Commits**: Mensagens de commit padronizadas
- **TypeScript Strict**: Tipagem rigorosa
- **Component Testing**: Testes para componentes críticos

### Roadmap Futuro

- [ ] **API REST Pública**: Integração com sistemas externos
- [ ] **Relatórios Avançados**: Dashboards executivos
- [ ] **Mobile App**: Aplicativo nativo para smartphones
- [ ] **Integração Fiscal**: Conexão com sistemas de nota fiscal
- [ ] **Multi-tenant**: Suporte a múltiplos restaurantes
- [ ] **Analytics Avançado**: Machine learning para previsões

## 📞 Suporte e Documentação

### Recursos de Ajuda

- **Documentação Técnica**: CLAUDE.md para desenvolvedores
- **Issues do GitHub**: Relatar bugs ou sugerir melhorias
- **Wiki do Projeto**: Documentação detalhada de uso

### Contato

Para dúvidas, problemas ou sugestões:
- **GitHub Issues**: [Link para issues]
- **Email**: [email de contato]
- **Documentação**: Consulte o arquivo CLAUDE.md para detalhes técnicos

---

## 📄 Licença

Este projeto está licenciado sob a **MIT License** - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

**Desenvolvido com ❤️ para a gestão eficiente de restaurantes**

*Pastel24h - Transformando a gestão operacional em insights estratégicos*