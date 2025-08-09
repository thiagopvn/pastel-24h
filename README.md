# Pastel24h - Sistema de Gestão de Turnos

Sistema completo de gestão de turnos para restaurantes, com controle de caixa, inventário, relatórios e gestão de colaboradores.

## 🚀 Início Rápido

### Pré-requisitos

- Node.js 20 ou superior
- npm ou gerenciador de pacotes compatível

### Instalação

1. **Clone o repositório e instale as dependências:**
```bash
git clone [seu-repositorio]
cd pastel24h
npm install
```

2. **Configure as variáveis de ambiente:**
```bash
# Crie o arquivo .env com uma chave segura para sessões
echo "SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" > .env
```

3. **Inicialize o banco de dados:**
```bash
npm run db:migrate
```

4. **Inicie o servidor de desenvolvimento:**
```bash
npm run dev
```

O sistema estará disponível em `http://localhost:5000`

## 📋 Funcionalidades

### Para Funcionários
- **Gestão de Turno**: Abertura e fechamento de turnos com controle de caixa
- **Controle de Produtos**: Registro de entrada, saída, descarte e consumo interno
- **Múltiplos Pagamentos**: Dinheiro, PIX, Stone (cartão/voucher), PagBank
- **Colaboradores**: Registro de funcionários que auxiliaram no turno
- **Relatórios**: Visualização de vendas e divergências de caixa

### Para Administradores
- **Dashboard Completo**: Visão geral de vendas, produtos e performance
- **Gestão de Usuários**: Criação e gerenciamento de contas de funcionários
- **Correções**: Sistema de correções para turnos fechados
- **Relatórios Semanais**: Cálculo automático de pagamentos e horas trabalhadas
- **Exportação**: Geração de PDFs e planilhas Excel
- **Timeline**: Registro completo de todas as atividades do sistema
- **Ajustes de Caixa**: Controle de sangrias e ajustes

## 🏗️ Arquitetura

### Backend (Express.js + SQLite)
- **Autenticação**: Passport.js com sessões e bcrypt para segurança
- **ORM**: Drizzle ORM para queries type-safe
- **API REST**: Endpoints protegidos com controle de acesso por papel (admin/funcionário)
- **Validação**: Schemas Zod para validação de dados

### Frontend (React + Vite)
- **Roteamento**: Wouter para navegação SPA
- **Estado**: TanStack Query para gerenciamento de estado do servidor
- **UI**: Shadcn/ui com Tailwind CSS e Radix UI
- **Gráficos**: Recharts para visualização de dados
- **Exportação**: jsPDF e xlsx para geração de documentos

## 📦 Scripts Disponíveis

### Desenvolvimento
```bash
npm run dev          # Servidor de desenvolvimento com hot-reload
npm run check        # Verificação de tipos TypeScript
```

### Produção
```bash
npm run build        # Build completo (frontend + backend)
npm run start        # Inicia servidor de produção
```

### Banco de Dados
```bash
npm run db:generate  # Gera novas migrações
npm run db:migrate   # Aplica migrações pendentes
```

### Docker
```bash
docker build -t pastel24h .     # Cria imagem Docker
docker-compose up               # Inicia com Docker Compose
```

## 🗄️ Estrutura do Banco de Dados

- **users**: Contas de usuários com papéis e configurações
- **shifts**: Turnos com controle de caixa e status
- **products**: Produtos com categorias e preços
- **shift_records**: Registros de produtos durante turnos
- **shift_payments**: Detalhamento de pagamentos por método
- **transport_modes**: Opções de transporte para funcionários
- **weekly_reports**: Relatórios semanais de pagamento
- **timeline**: Log de atividades do sistema
- **corrections**: Correções administrativas
- **cash_adjustments**: Sangrias e ajustes de caixa

## 🔐 Segurança

- Senhas criptografadas com bcrypt (12 rounds)
- Sessões seguras com express-session
- Controle de acesso baseado em papéis
- Validação de entrada com Zod
- Proteção contra SQL injection via Drizzle ORM

## 📱 Interface Responsiva

O sistema é totalmente responsivo e otimizado para uso em:
- Desktop para gestão administrativa
- Tablets para pontos de venda
- Smartphones para consultas rápidas

## 🛠️ Tecnologias Principais

- **Backend**: Express.js, Passport.js, Drizzle ORM, SQLite
- **Frontend**: React 18, TypeScript, Vite, TanStack Query
- **UI/UX**: Shadcn/ui, Tailwind CSS, Radix UI, Framer Motion
- **Relatórios**: Recharts, jsPDF, xlsx
- **DevOps**: Docker, Docker Compose, Vercel-ready

## 📈 Cálculos e Regras de Negócio

### Fórmula de Vendas
```
Vendido = Entrada + Chegada - Sobra - Descarte - Consumo Interno
```

### Divergência de Caixa
```
Divergência = Caixa Final - (Caixa Inicial + Vendas em Dinheiro)
```

### Taxas de Transação
- Configuráveis por método de pagamento
- Cálculo automático de valores líquidos
- Relatórios detalhados por período

## 🚢 Deploy

### Docker
```bash
# Build e execução
docker build -t pastel24h .
docker run -p 5000:5000 -v ./data:/app/data pastel24h
```

### Vercel
O projeto está preparado para deploy serverless no Vercel através do arquivo `/api/index.js`.

### Produção Manual
```bash
npm run build
NODE_ENV=production npm start
```

## 📝 Licença

MIT

## 🤝 Contribuindo

1. Fork o projeto
2. Crie sua feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📞 Suporte

Para dúvidas ou problemas, abra uma issue no GitHub.