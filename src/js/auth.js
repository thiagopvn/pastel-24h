// auth.js - Sistema de autenticação e persistência de sessão aprimorado
// Implementa um sistema híbrido de persistência (Firebase Auth + localStorage)

// Constantes para armazenamento local
const LOCAL_USER_KEY = 'pastelaria_user_data';
const LOCAL_AUTH_KEY = 'pastelaria_auth_state';
const LOCAL_LAST_ROUTE = 'pastelaria_last_route';

document.addEventListener('DOMContentLoaded', () => {
    // Elementos de UI
    const loginForm = document.getElementById('loginForm');
    const loginErrorP = document.getElementById('loginError');
    const loginErrorContainer = document.getElementById('loginErrorContainer');
    const logoutButton = document.getElementById('logoutButton');
    const btnLogin = document.getElementById('btnLogin');
    
    let loginSpinner = null;
    let buttonText = null;
    if (btnLogin) {
        loginSpinner = btnLogin.querySelector('#loginSpinner');
        buttonText = btnLogin.querySelector('.button-text');
    }

    // Configurar persistência do Firebase Auth para LOCAL no início
    setupFirebasePersistence();

    // Evitar redirecionamentos repetidos
    let isRedirecting = false;
    let pendingRedirect = null;

    // Configurar monitores de estado de conexão
    setupConnectionMonitors();

    // Observador principal de autenticação do Firebase
    auth.onAuthStateChanged(async (user) => {
        if (isRedirecting) return; // Evita loops durante redirecionamentos
        
        // Detecta a página atual
        const currentPage = getCurrentPage();
        console.log("Página atual detectada:", currentPage);

        try {
            if (user) {
                // Usuário autenticado no Firebase
                console.log("Usuário autenticado:", user.uid);
                
                // Salva dados do usuário Firebase no localStorage
                saveUserToLocalStorage(user);
                
                // Verifica no Firestore os dados completos do usuário (role, etc)
                await syncUserDataWithFirestore(user);
                
                // Atualiza interface
                updateUserInterface(user);
                
                // Verifica se há redirecionamento pendente
                if (pendingRedirect) {
                    executeRedirect(pendingRedirect);
                    return;
                }
                
                // Redirecionamento baseado na role do usuário
                const userRole = localStorage.getItem('userRole');
                
                if (userRole === 'admin') {
                    if (currentPage !== 'admin') {
                        console.log("Redirecionando admin para admin.html de", currentPage);
                        executeRedirect('admin');
                        return;
                    }
                } else if (userRole === 'funcionario') {
                    if (currentPage !== 'funcionario') {
                        console.log("Redirecionando funcionário para funcionario.html de", currentPage);
                        executeRedirect('funcionario');
                        return;
                    }
                } else {
                    console.error("Role desconhecida:", userRole);
                    showLoginError("Função de usuário não reconhecida.");
                    await logoutUser();
                    return;
                }
            } else {
                // Usuário não autenticado no Firebase
                console.log("Nenhum usuário autenticado no Firebase");
                
                // Verifica se temos dados locais
                const localUser = getLocalUser();
                
                if (localUser && localUser.uid && navigator.onLine === false) {
                    // Se estiver offline e tivermos dados locais, usar temporariamente
                    console.log("Offline: usando dados de usuário armazenados localmente");
                    updateUserInterface(localUser);
                    
                    // Mostra mensagem avisando que está offline
                    showOfflineWarning();
                } else {
                    // Limpa dados locais
                    clearLocalUserData();
                    
                    // Se não estiver na página de login, redireciona
                    if (currentPage !== 'index.html') {
                        console.log("Redirecionando para index.html - não autenticado");
                        executeRedirect('index.html');
                        return;
                    } else {
                        // Na página de login, atualiza UI para status não-autenticado
                        resetLoginFormState();
                    }
                }
            }
        } catch (error) {
            console.error("Erro no gerenciamento de autenticação:", error);
            showLoginError("Erro ao verificar autenticação. Por favor, recarregue a página.");
        }
    });

    // Manipulador de login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideLoginError();
            setLoginButtonLoading(true);

            const email = loginForm.email.value.trim();
            const password = loginForm.password.value;

            // Validações básicas
            if (!email || !password) {
                showLoginError("Por favor, preencha todos os campos.");
                setLoginButtonLoading(false);
                return;
            }

            try {
                // Tenta fazer login e configurar persistência LOCAL
                await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                console.log("Login bem-sucedido");
                saveUserToLocalStorage(user);
                
                // O redirecionamento será feito pelo onAuthStateChanged
            } catch (error) {
                console.error("Erro de login:", error);
                handleLoginError(error);
                setLoginButtonLoading(false);
            }
        });
    }

    // Manipulador de logout
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            console.log("Fazendo logout");
            logoutButton.disabled = true;
            logoutButton.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i>Saindo...';
            
            try {
                // Salvar a página atual antes de fazer logout (para casos de relogin rápido)
                localStorage.setItem(LOCAL_LAST_ROUTE, getCurrentPage());
                
                await logoutUser();
                console.log("Logout bem-sucedido");
            } catch (error) {
                console.error("Erro ao fazer logout:", error);
                alert("Erro ao tentar sair. Tente novamente.");
                logoutButton.disabled = false;
                logoutButton.innerHTML = '<i class="fa fa-sign-out-alt mr-2"></i>Sair';
            }
        });
    }

    // === FUNÇÕES AUXILIARES ===

    // Configura persistência do Firebase Auth
    async function setupFirebasePersistence() {
        try {
            await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            console.log("Persistência Firebase Auth configurada para LOCAL");
        } catch (error) {
            console.error("Erro ao configurar persistência:", error);
        }
    }

    // Configura monitores de conexão para sincronização
    function setupConnectionMonitors() {
        window.addEventListener('online', async () => {
            console.log("Conexão restaurada. Sincronizando dados...");
            const localUser = getLocalUser();
            
            // Se tiver dados locais, mas Firebase não estiver autenticado,
            // tenta reautenticar silenciosamente
            if (localUser && localUser.email && !auth.currentUser) {
                try {
                    // Recarrega a página para forçar uma tentativa de reautenticação
                    // com os dados armazenados pelo Firebase
                    window.location.reload();
                } catch (error) {
                    console.error("Erro ao tentar reautenticar:", error);
                }
            }
        });
        
        window.addEventListener('offline', () => {
            console.log("Conexão perdida. Usando dados locais.");
            showOfflineWarning();
        });
    }

    // Verifica a página atual considerando URLs limpas
    function getCurrentPage() {
        const path = window.location.pathname;
        
        // Lógica para lidar com URLs limpas (como no Vercel)
        if (path === '/' || path === '/index' || path === '/index.html') {
            return 'index.html';
        } else if (path === '/admin' || path === '/admin.html') {
            return 'admin.html';
        } else if (path === '/funcionario' || path === '/funcionario.html') {
            return 'funcionario.html';
        }
        
        // Fallback para o método antigo
        return path.split('/').pop() || 'index.html';
    }

    // Executa redirecionamento com segurança
    function executeRedirect(page) {
        if (isRedirecting) return;
        
        isRedirecting = true;
        console.log(`Redirecionando para ${page}`);
        window.location.href = page;
        
        // Caso o redirecionamento falhe por algum motivo
        setTimeout(() => {
            isRedirecting = false;
        }, 5000);
    }

    // Salva dados do usuário no localStorage
    function saveUserToLocalStorage(user) {
        if (!user) return;
        
        try {
            const userData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || '',
                photoURL: user.photoURL || '',
                emailVerified: user.emailVerified,
                lastLogin: new Date().toISOString()
            };
            
            localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(userData));
            localStorage.setItem(LOCAL_AUTH_KEY, 'true');
            
            console.log("Dados do usuário salvos no localStorage");
        } catch (error) {
            console.error("Erro ao salvar usuário no localStorage:", error);
        }
    }

    // Obtém dados do usuário do localStorage
    function getLocalUser() {
        try {
            const userStr = localStorage.getItem(LOCAL_USER_KEY);
            if (!userStr) return null;
            
            return JSON.parse(userStr);
        } catch (error) {
            console.error("Erro ao recuperar usuário do localStorage:", error);
            return null;
        }
    }

    // Limpa dados locais do usuário
    function clearLocalUserData() {
        localStorage.removeItem(LOCAL_USER_KEY);
        localStorage.removeItem(LOCAL_AUTH_KEY);
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        localStorage.removeItem('userUID');
        localStorage.removeItem('currentTurnoId');
        // Não remove o lastRoute para permitir redirecionamento de volta
    }

    // Sincroniza dados do usuário com o Firestore
    async function syncUserDataWithFirestore(user) {
        if (!user) return null;
        
        try {
            const userDocRef = db.collection('usuarios').doc(user.uid);
            const userDoc = await userDocRef.get();

            if (userDoc.exists) {
                const userData = userDoc.data();
                localStorage.setItem('userRole', userData.role);
                localStorage.setItem('userName', userData.nome || user.displayName || user.email);
                localStorage.setItem('userUID', user.uid);
                
                console.log("Dados do usuário recuperados do Firestore:", userData.role);
                return userData;
            } else {
                console.error("Usuário não encontrado no Firestore:", user.uid);
                throw new Error("Usuário não registrado no sistema");
            }
        } catch (error) {
            console.error("Erro ao sincronizar com Firestore:", error);
            throw error;
        }
    }

    // Atualiza interface com dados do usuário
    function updateUserInterface(user) {
        const loggedInUserNameSpan = document.getElementById('loggedInUserName');
        if (loggedInUserNameSpan) {
            loggedInUserNameSpan.textContent = localStorage.getItem('userName') || 
                                               user.displayName || 
                                               user.email || 
                                               'Usuário';
        }
    }

    // Mostra aviso de modo offline
    function showOfflineWarning() {
        const offlineAlert = document.getElementById('offline-alert');
        
        if (!offlineAlert) {
            // Cria elemento de alerta se não existir
            const alert = document.createElement('div');
            alert.id = 'offline-alert';
            alert.className = 'fixed top-4 right-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md shadow-md z-50';
            alert.innerHTML = `
                <div class="flex items-center">
                    <div class="mr-2">
                        <svg class="h-6 w-6 text-yellow-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <p>Você está offline. Algumas funcionalidades podem estar limitadas.</p>
                </div>
            `;
            document.body.appendChild(alert);
            
            // Remove após 5 segundos
            setTimeout(() => {
                if (document.getElementById('offline-alert')) {
                    document.getElementById('offline-alert').remove();
                }
            }, 5000);
        }
    }

    // Configura estado de carregamento no botão de login
    function setLoginButtonLoading(isLoading) {
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

    // Reseta estado do formulário de login
    function resetLoginFormState() {
        if (loginForm) loginForm.reset();
        setLoginButtonLoading(false);
        hideLoginError();
    }

    // Exibe mensagem de erro no login
    function showLoginError(message) {
        if (!loginErrorP) return;
        
        loginErrorP.textContent = message;
        if (loginErrorContainer) {
            loginErrorContainer.classList.remove('hidden');
        }
    }

    // Oculta mensagem de erro no login
    function hideLoginError() {
        if (!loginErrorP) return;
        
        loginErrorP.textContent = '';
        if (loginErrorContainer) {
            loginErrorContainer.classList.add('hidden');
        }
    }

    // Manipula erros específicos de login
    function handleLoginError(error) {
        let errorMessage = "Erro ao fazer login.";
        
        if (error.code) {
            switch (error.code) {
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    errorMessage = 'Email ou senha inválidos.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Email inválido.';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'Conta desabilitada.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Muitas tentativas. Tente mais tarde.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Erro de conexão. Verifique sua internet.';
                    break;
                default:
                    errorMessage = `Erro: ${error.code}`;
            }
        }
        
        showLoginError(errorMessage);
    }

    // Função de logout seguro
    async function logoutUser() {
        clearLocalUserData();
        try {
            await auth.signOut();
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
            // Mesmo com erro, tenta forçar redirecionamento
            executeRedirect('index.html');
            throw error;
        }
    }
});

// Função de proteção de rota melhorada
function protectRoute(allowedRoles) {
    console.log("protectRoute chamado para:", allowedRoles);
    
    // Verifica se o usuário está logado
    const isLoggedIn = localStorage.getItem('LOCAL_AUTH_KEY') === 'true' || auth.currentUser;
    const userRole = localStorage.getItem('userRole');
    
    if (!isLoggedIn) {
        console.log("Usuário não autenticado, redirecionando para login");
        window.location.href = 'index.html';
        return;
    }
    
    // Verifica se tem permissão para acessar a página
    if (!allowedRoles.includes(userRole)) {
        console.log(`Acesso negado: role '${userRole}' não permitida para esta página`);
        
        // Redireciona com base na role
        if (userRole === 'admin') {
            window.location.href = 'admin.html';
        } else if (userRole === 'funcionario') {
            window.location.href = 'funcionario.html';
        } else {
            // Caso haja alguma inconsistência, volta para o login
            window.location.href = 'index.html';
        }
        return;
    }
    
    // Usuário autenticado e autorizado, atualiza a interface
    const loggedInUserNameSpan = document.getElementById('loggedInUserName');
    if (loggedInUserNameSpan) {
        loggedInUserNameSpan.textContent = localStorage.getItem('userName') || "Usuário";
    }
}

// Retorna o usuário atual (do Firebase ou localStorage)
function getCurrentUser() {
    const firebaseUser = auth.currentUser;
    if (firebaseUser) return firebaseUser;
    
    // Se não encontrar no Firebase, tenta no localStorage
    try {
        const userStr = localStorage.getItem('pastelaria_user_data');
        return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
        console.error('Erro ao obter usuário local:', e);
        return null;
    }
}

// Exporta funções globalmente
if (typeof window !== 'undefined') {
    window.protectRoute = protectRoute;
    window.getCurrentUser = getCurrentUser;
}

console.log("auth.js carregado corretamente com sistema de persistência híbrido.");