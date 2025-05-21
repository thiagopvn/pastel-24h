// js/auth.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginErrorP = document.getElementById('loginError'); // O <p> para erros de login no index.html
    const logoutButton = document.getElementById('logoutButton'); // Botão de logout presente em funcionario.html e admin.html

    // Spinner e texto do botão de login (do index.html)
    const btnLogin = document.getElementById('btnLogin'); // Assume que o botão de submit no index.html tem id="btnLogin"
    let loginSpinner = null;
    let buttonText = null;
    if (btnLogin) {
        loginSpinner = btnLogin.querySelector('#loginSpinner');
        buttonText = btnLogin.querySelector('.button-text');
    }

    /**
     * Gerencia o estado visual do botão de login (spinner e texto).
     * @param {boolean} isLoading - True se deve mostrar o estado de carregamento.
     */
    function setLoginButtonState(isLoading) {
        if (!btnLogin || !loginSpinner || !buttonText) return;

        if (isLoading) {
            buttonText.classList.add('hidden');
            loginSpinner.classList.remove('hidden');
            btnLogin.disabled = true;
        } else {
            buttonText.classList.remove('hidden');
            loginSpinner.classList.add('hidden');
            btnLogin.disabled = false;
        }
    }

    // Observador de estado de autenticação do Firebase
    // Este é o principal manipulador para redirecionamentos e verificações de estado
    auth.onAuthStateChanged(async (user) => {
        const currentPage = window.location.pathname.split('/').pop();

        if (user) {
            // Usuário está logado
            try {
                const userDocRef = db.collection('usuarios').doc(user.uid);
                const userDoc = await userDocRef.get();

                if (userDoc.exists) {
                    const userData = userDoc.data();
                    localStorage.setItem('userRole', userData.role);
                    localStorage.setItem('userName', userData.nome || user.displayName || user.email);
                    localStorage.setItem('userUID', user.uid); // Salva o UID do usuário logado

                    // Redirecionamento baseado na role e na página atual
                    if (userData.role === 'admin') {
                        if (currentPage !== 'admin.html') {
                            console.log("Redirecionando para admin.html");
                            window.location.href = 'admin.html';
                        }
                    } else if (userData.role === 'funcionario') {
                        if (currentPage !== 'funcionario.html') {
                            console.log("Redirecionando para funcionario.html");
                            window.location.href = 'funcionario.html';
                        }
                    } else {
                        // Role desconhecida ou não definida
                        console.error("Role de usuário desconhecida:", userData.role);
                        if(loginErrorP) loginErrorP.textContent = "Função de usuário não reconhecida. Contate o suporte.";
                        await auth.signOut(); // Força logout
                    }
                } else {
                    // Usuário autenticado no Firebase Auth, mas sem registro na coleção 'usuarios'
                    console.error("Usuário não encontrado na base de dados 'usuarios'. UID:", user.uid);
                    if(loginErrorP && (currentPage === 'index.html' || currentPage === '')) {
                         loginErrorP.textContent = "Usuário não registrado no sistema. Contate o administrador.";
                    } else if (currentPage !== 'index.html' && currentPage !== ''){
                        // Se já estiver em outra página e o doc sumir, alertar e deslogar
                        alert("Seu registro no sistema não foi encontrado. Você será deslogado.");
                    }
                    await auth.signOut(); // Força logout
                }
            } catch (error) {
                console.error("Erro ao buscar dados do usuário no Firestore:", error);
                if(loginErrorP && (currentPage === 'index.html' || currentPage === '')) {
                    loginErrorP.textContent = "Erro ao verificar dados do usuário. Tente novamente.";
                } else if (currentPage !== 'index.html' && currentPage !== ''){
                     alert("Erro ao verificar seus dados de usuário. Você será deslogado.");
                }
                await auth.signOut();
            } finally {
                // Garante que o botão de login seja resetado se o usuário estiver na página de login
                if (currentPage === 'index.html' || currentPage === '') {
                    setLoginButtonState(false);
                }
            }
        } else {
            // Usuário não está logado
            localStorage.removeItem('userRole');
            localStorage.removeItem('userName');
            localStorage.removeItem('userUID');
            localStorage.removeItem('currentTurnoId'); // Limpar turno ativo ao deslogar

            // Se não estiver na página de login e não estiver logado, redireciona para login
            // Exceto se a página for index.html ou a raiz (que também é index.html)
            if (currentPage !== 'index.html' && currentPage !== '') {
                console.log("Usuário não logado, redirecionando para index.html desde:", currentPage);
                window.location.href = 'index.html';
            }
            // Garante que o botão de login esteja no estado normal na página de login
            if (currentPage === 'index.html' || currentPage === '') {
                setLoginButtonState(false);
            }
        }
    });

    // Manipulador de formulário de Login (se existir na página atual)
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (loginErrorP) loginErrorP.textContent = ''; // Limpa erros anteriores
            setLoginButtonState(true); // Ativa o spinner

            const email = loginForm.email.value;
            const password = loginForm.password.value;

            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                // Sucesso! O onAuthStateChanged vai lidar com o fetch da role e o redirecionamento.
                // O estado do botão de login será gerenciado pelo onAuthStateChanged ao final.
                console.log("Login bem-sucedido para:", userCredential.user.email);

            } catch (error) {
                console.error("Erro de login:", error);
                let errorMessage = "Erro ao tentar fazer login. Tente novamente.";
                if (error.code) {
                    switch (error.code) {
                        case 'auth/user-not-found':
                        case 'auth/wrong-password':
                        case 'auth/invalid-credential': // Nova versão do Firebase SDK para credencial inválida
                            errorMessage = 'Email ou senha inválidos.';
                            break;
                        case 'auth/invalid-email':
                            errorMessage = 'O formato do email é inválido.';
                            break;
                        case 'auth/user-disabled':
                            errorMessage = 'Esta conta de usuário foi desabilitada.';
                            break;
                        case 'auth/too-many-requests':
                            errorMessage = 'Muitas tentativas de login. Tente novamente mais tarde.';
                            break;
                        default:
                            errorMessage = 'Ocorreu um erro inesperado. Código: ' + error.code;
                    }
                }
                if(loginErrorP) loginErrorP.textContent = errorMessage;
                setLoginButtonState(false); // Desativa o spinner e reabilita o botão
            }
        });
    }

    // Manipulador do Botão de Logout (se existir na página atual)
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            console.log("Tentando fazer logout...");
            logoutButton.disabled = true;
            logoutButton.textContent = "Saindo...";
            try {
                await auth.signOut();
                // O onAuthStateChanged cuidará da limpeza do localStorage e do redirecionamento para index.html
                console.log("Logout bem-sucedido.");
                // A linha abaixo é uma garantia, mas onAuthStateChanged deve cobrir
                // window.location.href = 'index.html';
            } catch (error) {
                console.error("Erro ao fazer logout:", error);
                alert("Erro ao tentar sair. Tente novamente.");
                logoutButton.disabled = false;
                logoutButton.textContent = "Sair";
            }
        });
    }
});

/**
 * Protege uma rota, verificando se o usuário logado tem uma das roles permitidas.
 * Se não estiver logado ou não tiver a role correta, redireciona para a página de login.
 * Também atualiza o nome do usuário logado na UI, se o elemento existir.
 * @param {string[]} allowedRoles - Array de strings contendo as roles permitidas (ex: ['admin', 'funcionario']).
 */
function protectRoute(allowedRoles) {
    // Este onAuthStateChanged é específico para proteção de rota e atualização da UI interna.
    auth.onAuthStateChanged(user => {
        const loggedInUserNameSpan = document.getElementById('loggedInUserName');

        if (user) {
            const userRole = localStorage.getItem('userRole');
            const userName = localStorage.getItem('userName');

            if (loggedInUserNameSpan && userName) {
                loggedInUserNameSpan.textContent = userName;
            } else if (loggedInUserNameSpan) {
                // Se o nome não estiver no localStorage, mas o usuário estiver logado, buscar no Firestore (melhoria futura)
                // Por enquanto, usa o UID ou um placeholder se o nome não foi salvo corretamente.
                loggedInUserNameSpan.textContent = user.uid.substring(0, 6) + "..."; 
            }

            if (!userRole || !allowedRoles.includes(userRole)) {
                console.warn(`Acesso não autorizado para a rota. Role: ${userRole}, Permitidas: ${allowedRoles}. Redirecionando...`);
                // Força logout se a role for inválida ou não existir para evitar loop de redirecionamento se algo der errado
                auth.signOut().then(() => {
                    // localStorage já será limpo pelo onAuthStateChanged principal
                    console.log("Deslogado devido à role inválida ou ausente.");
                    window.location.href = 'index.html';
                }).catch(error => {
                     console.error("Erro ao deslogar por role inválida:", error);
                     window.location.href = 'index.html'; // Garante o redirecionamento
                });
            }
        } else {
            // Usuário não logado tentando acessar uma página protegida
            const currentPage = window.location.pathname.split('/').pop();
            if (currentPage !== 'index.html' && currentPage !== '') {
                 console.log("Usuário não logado tentando acessar página protegida, redirecionando para index.html.");
                 window.location.href = 'index.html';
            }
            if (loggedInUserNameSpan) {
                loggedInUserNameSpan.textContent = "Visitante"; // Ou limpa, se preferir
            }
        }
    });
}

// Disponibiliza protectRoute globalmente para ser chamada no inline script das páginas
if (typeof window !== 'undefined') {
    window.protectRoute = protectRoute;
}

console.log("auth.js carregado e observadores configurados.");