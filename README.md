# Pastel24h - Sistema de Gestão

Este é um projeto full-stack que utiliza Express.js para o backend e React (com Vite) para o frontend.

## Estrutura do Projeto

*   `/server`: Contém todo o código do backend em Express (rotas, autenticação, banco de dados).
*   `/client`: Contém todo o código do frontend em React.
*   `/dist`: Diretório de saída do build. O backend é compilado para `dist/index.js` e o frontend para `dist/public`.

## Pré-requisitos

*   Node.js (versão 20 ou superior)
*   npm ou um gerenciador de pacotes compatível

## Configuração

1.  **Instale as dependências:**
    ```sh
    npm install
    ```

2.  **Configure as Variáveis de Ambiente:**
    Crie um arquivo `.env` na raiz do projeto e adicione a seguinte variável. Ela é essencial para a segurança das sessões de usuário.
    ```
    # Gere uma chave segura com pelo menos 32 caracteres.
    # Você pode usar: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    SESSION_SECRET=sua_chave_secreta_super_segura_aqui
    ```

3.  **Prepare o Banco de Dados:**
    Rode a migração para criar as tabelas do banco de dados SQLite.
    ```sh
    npm run db:migrate
    ```

## Como Rodar

*   **Ambiente de Desenvolvimento (com Hot-Reload):**
    ```sh
    npm run dev
    ```
    Acesse `http://localhost:5000` no seu navegador. O servidor Express e o frontend Vite rodarão juntos.

*   **Ambiente de Produção:**
    1.  **Construa o projeto:**
        ```sh
        npm run build
        ```
    2.  **Inicie o servidor:**
        ```sh
        npm run start
        ```
        Acesse `http://localhost:5000` no seu navegador.
