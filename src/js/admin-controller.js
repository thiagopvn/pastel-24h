// admin-controller.js - VERSÃO CORRIGIDA
document.addEventListener('DOMContentLoaded', async () => {
    // Validação inicial para garantir que Firebase está pronto
    if (!firebase || !firebase.app || !db || !auth) {
        console.error("🚫 Firebase não inicializado corretamente. Verifique as importações.");
        alert("Erro crítico: Firebase não inicializado. Recarregue a página ou contate o suporte.");
        return;
    }
    
    console.log("🔍 Verificando Firebase e autenticação...");
    
    // Espera a autenticação estar pronta antes de continuar (mais robusto)
    const checkAuth = new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe(); // Importante: desinscreve para evitar vazamentos de memória
            console.log("🔐 Status de autenticação verificado:", user ? "Usuário autenticado" : "Usuário não autenticado");
            resolve(user);
        });
    });
    
    const currentUser = await checkAuth;
    if (!currentUser) {
        console.error("❌ Usuário não autenticado!");
        window.location.href = 'index.html';
        return;
    }
    
    console.log("✅ Usuário autenticado:", currentUser.email);
    
    // Agora sim, protege a rota
    protectRoute(['admin']);

    // Configurações globais
    const CONFIG = {
        AUTO_REFRESH_INTERVAL: 300000, // 5 minutos
        TOAST_DURATION: 5000,
        CHART_ANIMATION_DURATION: 800,
        REALTIME_ENABLED: true,
        DEBUG_MODE: true
    };

    // Formatadores
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    const formatPercent = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'percent',
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }).format((value || 0) / 100);
    };

    // Estado global da aplicação
    let appState = {
        currentData: {
            vendas: 0,
            ticket: 0,
            pedidos: 0,
            divergencias: 0,
            caixa: 0,
            lucro: 0,
            turnos: [],
            alertas: [],
            timeline: []
        },
        filters: {
            period: 'today',
            startDate: null,
            endDate: null,
            turno: '',
            pagamento: '',
            funcionario: ''
        },
        charts: {
            payment: null,
            products: null,
            salesHours: null
        },
        realTimeListeners: [],
        currentPrices: {},
        users: []
    };

    // Sistema de Toast/Notificações
    class ToastManager {
        constructor() {
            this.container = document.getElementById('toast-container');
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.id = 'toast-container';
                this.container.className = 'fixed top-4 right-4 z-50 space-y-2';
                document.body.appendChild(this.container);
            }
            this.toasts = new Map();
        }

        show(message, type = 'info', duration = CONFIG.TOAST_DURATION, persistent = false) {
            const toastId = Date.now() + Math.random();
            const toast = this.createToast(message, type, toastId);
            
            this.container.appendChild(toast);
            this.toasts.set(toastId, toast);

            // Animação de entrada
            setTimeout(() => toast.classList.add('show'), 10);

            if (!persistent) {
                setTimeout(() => this.hide(toastId), duration);
            }

            return toastId;
        }

        createToast(message, type, id) {
            const toast = document.createElement('div');
            toast.className = `toast bg-white border-l-4 rounded-lg shadow-lg p-4 mb-2 transform transition-all duration-300 opacity-0 translate-x-full`;
            
            const colors = {
                success: 'border-success-500 text-success-800',
                error: 'border-danger-500 text-danger-800',
                warning: 'border-warning-500 text-warning-800',
                info: 'border-blue-500 text-blue-800'
            };
            
            const icons = {
                success: 'fa-check-circle',
                error: 'fa-exclamation-circle',
                warning: 'fa-exclamation-triangle',
                info: 'fa-info-circle'
            };
            
            toast.classList.add(...colors[type].split(' '));
            toast.dataset.toastId = id;
            
            toast.innerHTML = `
                <div class="flex items-center">
                    <i class="fas ${icons[type]} mr-3 text-lg"></i>
                    <span class="flex-1 font-medium">${message}</span>
                    <button onclick="toastManager.hide('${id}')" class="ml-2 text-gray-400 hover:text-gray-600 transition-colors">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            
            return toast;
        }

        hide(toastId) {
            const toast = this.toasts.get(toastId);
            if (toast) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (toast.parentElement) {
                        toast.parentElement.removeChild(toast);
                    }
                    this.toasts.delete(toastId);
                }, 300);
            }
        }

        clear() {
            this.toasts.forEach((toast, id) => this.hide(id));
        }
    }

    const toastManager = new ToastManager();
    window.toastManager = toastManager; // Exporta globalmente para debug

    // Gerenciador de Dados CORRIGIDO
    class DataManager {
        constructor() {
            this.cache = new Map();
            this.cacheTimeout = 60000; // 1 minuto
        }

        async getTurnos(filters = {}) {
            const cacheKey = JSON.stringify(filters);
            const cached = this.cache.get(cacheKey);
            
            if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                return cached.data;
            }

            try {
                let query = db.collection('turnos').where('status', '==', 'fechado');
                
                if (filters.startDate && filters.endDate) {
                    const startId = `${filters.startDate}_Manhã`;
                    const endId = `${filters.endDate}_Noite`;
                    query = query.orderBy(firebase.firestore.FieldPath.documentId())
                                 .startAt(startId)
                                 .endAt(endId);
                } else {
                    const date30DaysAgo = new Date();
                    date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);
                    const startDateString = date30DaysAgo.toISOString().split('T')[0];
                    query = query.orderBy(firebase.firestore.FieldPath.documentId(), 'desc')
                                 .where(firebase.firestore.FieldPath.documentId(), '>=', `${startDateString}_Manhã`);
                }

                const snapshot = await query.get();
                const turnos = [];
                snapshot.forEach(doc => {
                    const data = { id: doc.id, ...doc.data() };
                    
                    // Aplicar filtros adicionais
                    if (filters.turno && !data.id.includes(filters.turno)) return;
                    if (filters.funcionario && data.abertura?.responsavelNome !== filters.funcionario) return;
                    
                    turnos.push(data);
                });

                this.cache.set(cacheKey, { data: turnos, timestamp: Date.now() });
                return turnos;
                
            } catch (error) {
                console.error('Erro ao buscar turnos:', error);
                throw error;
            }
        }

        async getTurnosAbertos() {
            try {
                const snapshot = await db.collection('turnos').where('status', '==', 'aberto').get();
                const turnos = [];
                snapshot.forEach(doc => turnos.push({ id: doc.id, ...doc.data() }));
                return turnos;
            } catch (error) {
                console.error('Erro ao buscar turnos abertos:', error);
                return [];
            }
        }

        // MÉTODO COMPLETAMENTE REESCRITO para carregar preços do Firebase
        async getPrecos() {
            try {
                console.log('🔍 Iniciando busca de preços no Firebase...');
                
                if (!auth.currentUser) {
                    throw new Error('Usuário não autenticado');
                }
                
                const produtosRef = db.collection('produtos');
                const snapshot = await produtosRef.get();
                
                console.log(`📦 Encontrados ${snapshot.size} documentos na coleção produtos`);
                
                // Se não houver documentos, cria estrutura inicial
                if (snapshot.empty) {
                    console.warn('⚠️ Nenhum documento encontrado na coleção produtos!');
                    return await this.createInitialPrices();
                }
                
                // Resultado final para armazenar os preços
                let precos = {};
                
                // Armazena as categorias encontradas para verificação posterior
                const categoriasEncontradas = [];
                
                // Processa cada documento da coleção
                snapshot.forEach(doc => {
                    const categoriaId = doc.id;
                    categoriasEncontradas.push(categoriaId);
                    
                    const dadosCategoria = doc.data();
                    console.log(`📋 Processando categoria: ${categoriaId}`);
                    
                    // Verifica se os dados estão no formato esperado
                    if (!dadosCategoria || typeof dadosCategoria !== 'object') {
                        console.warn(`⚠️ Categoria ${categoriaId} não contém dados válidos`);
                        precos[categoriaId] = {};
                        return;
                    }
                    
                    // Identifica o formato dos dados
                    if (this.temProdutosComPreco(dadosCategoria)) {
                        // O documento já contém produtos com preços diretamente
                        precos[categoriaId] = dadosCategoria;
                    } else if (dadosCategoria.items && typeof dadosCategoria.items === 'object') {
                        // Os produtos estão dentro de um objeto "items"
                        precos[categoriaId] = dadosCategoria.items;
                    } else if (dadosCategoria.produtos && typeof dadosCategoria.produtos === 'object') {
                        // Os produtos estão dentro de um objeto "produtos"
                        precos[categoriaId] = dadosCategoria.produtos;
                    } else {
                        // Formato desconhecido, usar como está
                        console.warn(`⚠️ Formato desconhecido para categoria ${categoriaId}, usando dados brutos`);
                        precos[categoriaId] = dadosCategoria;
                    }
                });
                
                // Verifica se todas as categorias necessárias existem
                const categoriasNecessarias = ['pasteis', 'casquinhas', 'caldo_cana', 'refrigerantes', 'gelo'];
                const categoriasFaltando = categoriasNecessarias.filter(cat => !categoriasEncontradas.includes(cat));
                
                if (categoriasFaltando.length > 0) {
                    console.log(`📝 Criando categorias faltantes: ${categoriasFaltando.join(', ')}`);
                    await this.criarCategoriasFaltantes(precos, categoriasFaltando);
                }
                
                // Normaliza os dados para garantir que todos os produtos tenham estrutura consistente
                precos = this.normalizarDadosPrecos(precos);
                
                console.log('✅ Preços carregados com sucesso');
                return precos;
                
            } catch (error) {
                console.error('❌ Erro ao buscar preços:', error);
                console.error('Detalhes:', error.message, error.code);
                
                // Em caso de erro, criar estrutura inicial
                toastManager.show("Erro ao carregar preços. Criando estrutura básica.", "warning");
                return await this.createInitialPrices();
            }
        }

        // Verifica se um objeto contém produtos com preço (pelo menos 1 item)
        temProdutosComPreco(obj) {
            if (!obj || typeof obj !== 'object') return false;
            
            for (const key in obj) {
                const item = obj[key];
                if (item && typeof item === 'object' && 
                    (item.preco !== undefined || item.precoUnitario !== undefined)) {
                    return true;
                }
            }
            return false;
        }

        // Normaliza os dados de preços para um formato uniforme
        normalizarDadosPrecos(precos) {
            const resultado = {};
            
            Object.keys(precos).forEach(categoria => {
                resultado[categoria] = {};
                const itens = precos[categoria];
                
                Object.keys(itens).forEach(itemKey => {
                    const item = itens[itemKey];
                    
                    if (typeof item === 'object') {
                        // Se já tiver um objeto com preco, usa-o
                        if (item.preco !== undefined) {
                            resultado[categoria][itemKey] = { 
                                ...item,
                                preco: parseFloat(item.preco) || 0
                            };
                        } 
                        // Se tiver precoUnitario, converte para preco
                        else if (item.precoUnitario !== undefined) {
                            resultado[categoria][itemKey] = { 
                                ...item,
                                preco: parseFloat(item.precoUnitario) || 0
                            };
                        } 
                        // Caso não tenha preco nem precoUnitario, cria objeto com preco 0
                        else {
                            resultado[categoria][itemKey] = { 
                                ...item,
                                preco: 0
                            };
                        }
                    } 
                    // Se for um valor numérico direto, converte para objeto com preco
                    else if (typeof item === 'number') {
                        resultado[categoria][itemKey] = { preco: item };
                    } 
                    // Outro caso, assume preco 0
                    else {
                        resultado[categoria][itemKey] = { preco: 0 };
                    }
                });
            });
            
            return resultado;
        }

        // MÉTODO CORRIGIDO: Criar estrutura inicial de preços
        async createInitialPrices() {
            const precosIniciais = {
                pasteis: {
                    carne: { preco: 8.00 },
                    frango: { preco: 8.00 },
                    queijo: { preco: 8.00 },
                    pizza: { preco: 8.00 },
                    bauru: { preco: 8.00 },
                    calabresa: { preco: 8.00 },
                    palmito: { preco: 8.00 },
                    especial_de_carne: { preco: 10.00 },
                    especial_de_frango: { preco: 10.00 },
                    especial_de_calabresa: { preco: 10.00 }
                },
                casquinhas: {
                    casquinha_simples: { preco: 3.00 },
                    casquinha_com_cobertura: { preco: 4.00 },
                    casquinha_com_granulado: { preco: 4.50 }
                },
                caldo_cana: {
                    caldo_de_cana_300ml: { preco: 5.00 },
                    caldo_de_cana_500ml: { preco: 7.00 },
                    caldo_de_cana_700ml: { preco: 9.00 },
                    caldo_de_cana_1litro: { preco: 12.00 }
                },
                refrigerantes: {
                    coca_cola_350ml: { preco: 5.00 },
                    coca_cola_600ml: { preco: 7.00 },
                    coca_cola_2l: { preco: 12.00 },
                    guarana_350ml: { preco: 5.00 },
                    guarana_600ml: { preco: 7.00 },
                    guarana_2l: { preco: 12.00 },
                    fanta_laranja_350ml: { preco: 5.00 },
                    fanta_laranja_600ml: { preco: 7.00 },
                    fanta_laranja_2l: { preco: 12.00 },
                    fanta_uva_350ml: { preco: 5.00 },
                    sprite_350ml: { preco: 5.00 },
                    agua_mineral_500ml: { preco: 3.00 }
                },
                gelo: {
                    gelo_pacote: { preco: 5.00 }
                }
            };

            // Salvar no Firebase
            try {
                console.log('🔧 Criando estrutura inicial de preços...');
                const batch = db.batch();
                
                Object.keys(precosIniciais).forEach(categoria => {
                    const docRef = db.collection('produtos').doc(categoria);
                    batch.set(docRef, precosIniciais[categoria]);
                });
                
                await batch.commit();
                console.log('✅ Estrutura inicial de preços criada no Firebase');
                toastManager.show("Preços iniciais criados com sucesso", "success");
            } catch (error) {
                console.error('❌ Erro ao criar estrutura inicial:', error);
                toastManager.show("Erro ao criar preços iniciais", "error");
            }

            return precosIniciais;
        }

        // MÉTODO REESCRITO: Criar categorias faltantes
        async criarCategoriasFaltantes(precosExistentes, categoriasFaltando) {
            const precosDefault = {
                pasteis: {
                    carne: { preco: 8.00 },
                    frango: { preco: 8.00 },
                    queijo: { preco: 8.00 },
                    pizza: { preco: 8.00 },
                    bauru: { preco: 8.00 },
                    calabresa: { preco: 8.00 },
                    palmito: { preco: 8.00 },
                    especial_de_carne: { preco: 10.00 },
                    especial_de_frango: { preco: 10.00 },
                    especial_de_calabresa: { preco: 10.00 }
                },
                casquinhas: {
                    casquinha_simples: { preco: 3.00 },
                    casquinha_com_cobertura: { preco: 4.00 },
                    casquinha_com_granulado: { preco: 4.50 }
                },
                caldo_cana: {
                    caldo_de_cana_300ml: { preco: 5.00 },
                    caldo_de_cana_500ml: { preco: 7.00 },
                    caldo_de_cana_700ml: { preco: 9.00 },
                    caldo_de_cana_1litro: { preco: 12.00 }
                },
                refrigerantes: {
                    coca_cola_350ml: { preco: 5.00 },
                    coca_cola_600ml: { preco: 7.00 },
                    coca_cola_2l: { preco: 12.00 },
                    guarana_350ml: { preco: 5.00 },
                    guarana_600ml: { preco: 7.00 },
                    guarana_2l: { preco: 12.00 },
                    fanta_laranja_350ml: { preco: 5.00 },
                    fanta_laranja_600ml: { preco: 7.00 },
                    fanta_laranja_2l: { preco: 12.00 },
                    fanta_uva_350ml: { preco: 5.00 },
                    sprite_350ml: { preco: 5.00 },
                    agua_mineral_500ml: { preco: 3.00 }
                },
                gelo: {
                    gelo_pacote: { preco: 5.00 }
                }
            };

            try {
                console.log(`🔧 Criando ${categoriasFaltando.length} categorias faltantes...`);
                const batch = db.batch();
                
                categoriasFaltando.forEach(categoria => {
                    if (precosDefault[categoria]) {
                        const docRef = db.collection('produtos').doc(categoria);
                        batch.set(docRef, precosDefault[categoria]);
                        
                        // Adiciona ao objeto de preços existentes
                        precosExistentes[categoria] = precosDefault[categoria];
                    }
                });
                
                await batch.commit();
                console.log('✅ Categorias faltantes criadas com sucesso');
                toastManager.show(`${categoriasFaltando.length} categorias criadas`, "success");
            } catch (error) {
                console.error('❌ Erro ao criar categorias faltantes:', error);
                toastManager.show("Erro ao criar categorias faltantes", "error");
            }
        }

        // MÉTODO COMPLETAMENTE REESCRITO para buscar usuários
        async getUsuarios() {
            try {
                console.log('👥 Buscando usuários no Firebase...');
                
                if (!auth.currentUser) {
                    throw new Error('Usuário não autenticado');
                }
                
                // Tenta buscar da coleção 'usuarios'
                const snapshot = await db.collection('usuarios').get();
                
                if (snapshot.empty) {
                    console.warn('⚠️ Nenhum usuário encontrado na coleção usuarios');
                    return [];
                }
                
                console.log(`✅ Encontrados ${snapshot.size} usuários`);
                
                const usuarios = [];
                
                snapshot.forEach(doc => {
                    const userData = doc.data();
                    
                    // Garante que os dados têm os campos necessários
                    const usuario = { 
                        id: doc.id, 
                        ...userData,
                        nome: userData.nome || userData.displayName || 'Sem nome',
                        email: userData.email || 'Sem email',
                        role: userData.role || 'funcionario'
                    };
                    
                    usuarios.push(usuario);
                });
                
                console.log('Usuários carregados:', usuarios);
                return usuarios;
                
            } catch (error) {
                console.error('❌ Erro ao buscar usuários:', error);
                console.error('Detalhes:', error.message, error.code);
                
                // Tenta recuperar o usuário atual como fallback
                try {
                    const user = auth.currentUser;
                    if (user) {
                        console.log('⚠️ Usando apenas o usuário atual como fallback');
                        return [{
                            id: user.uid,
                            nome: user.displayName || user.email || 'Usuário Atual',
                            email: user.email || 'email@exemplo.com',
                            role: 'admin' // Assume admin já que está na página de admin
                        }];
                    }
                } catch (e) {
                    console.error('Erro ao tentar usar fallback:', e);
                }
                
                return [];
            }
        }

        clearCache() {
            this.cache.clear();
        }
    }

    const dataManager = new DataManager();
    window.dataManager = dataManager; // Exporta para debug

    // Gerenciador de Preços CORRIGIDO
    class PriceManager {
        constructor() {
            this.containers = {
                precosPasteisContainer: 'precosPasteisContainer',
                precosCasquinhasContainer: 'precosCasquinhasContainer', 
                precosCaldoCanaContainer: 'precosCaldoCanaContainer',
                precosRefrigerantesContainer: 'precosRefrigerantesContainer',
                precosGeloContainer: 'precosGeloContainer'
            };
            
            this.produtosPorCategoria = {
                pasteis: [
                    "Carne", "Frango", "Queijo", "Pizza", "Bauru", "Calabresa", "Palmito",
                    "Especial de Carne", "Especial de Frango", "Especial de Calabresa"
                ],
                casquinhas: [
                    "Casquinha Simples", "Casquinha com Cobertura", "Casquinha com Granulado"
                ],
                caldo_cana: [
                    "Caldo de Cana 300ml", "Caldo de Cana 500ml", "Caldo de Cana 700ml", "Caldo de Cana 1litro"
                ],
                refrigerantes: [
                    "Coca-Cola 350ml", "Coca-Cola 600ml", "Coca-Cola 2L", "Guaraná 350ml", "Guaraná 600ml", 
                    "Guaraná 2L", "Fanta Laranja 350ml", "Fanta Laranja 600ml", "Fanta Laranja 2L", "Fanta Uva 350ml", 
                    "Sprite 350ml", "Água Mineral 500ml"
                ],
                gelo: ["Gelo (Pacote)"]
            };
            
            // Verifica se existem listas definidas globalmente e usa elas, se disponíveis
            if (typeof window.listaSaboresPasteis !== 'undefined') {
                this.produtosPorCategoria.pasteis = window.listaSaboresPasteis;
            }
            if (typeof window.listaCasquinhas !== 'undefined') {
                this.produtosPorCategoria.casquinhas = window.listaCasquinhas;
            }
            if (typeof window.listaCaldoCana !== 'undefined') {
                this.produtosPorCategoria.caldo_cana = window.listaCaldoCana;
            }
            if (typeof window.listaRefrigerantes !== 'undefined') {
                this.produtosPorCategoria.refrigerantes = window.listaRefrigerantes;
            }
            
            this.containerToCategoryMap = {
                precosPasteisContainer: 'pasteis',
                precosCasquinhasContainer: 'casquinhas',
                precosCaldoCanaContainer: 'caldo_cana',
                precosRefrigerantesContainer: 'refrigerantes',
                precosGeloContainer: 'gelo'
            };
        }

        async load() {
            try {
                console.log('🔄 Iniciando carregamento de preços...');
                toastManager.show('Carregando preços...', 'info', 2000);
                
                // Limpa containers primeiro
                this.clearContainers();
                
                // Busca preços do Firebase
                appState.currentPrices = await dataManager.getPrecos();
                console.log('Preços obtidos:', appState.currentPrices);
                
                // Popular formulários
                this.populateForms();
                this.setupFormHandler();
                
                // Atualizar contadores
                this.updateCounters();
                
                toastManager.show('Preços carregados com sucesso', 'success');
                
            } catch (error) {
                console.error('Erro ao carregar preços:', error);
                toastManager.show('Erro ao carregar preços: ' + error.message, 'error');
                
                // Mesmo com erro, popula com valores padrão
                this.populateWithDefaults();
            }
        }

        clearContainers() {
            Object.values(this.containers).forEach(containerId => {
                const container = document.getElementById(containerId);
                if (container) {
                    container.innerHTML = '<div class="text-center p-4 text-gray-500">Carregando...</div>';
                }
            });
        }

        populateWithDefaults() {
            // Popula com preços zerados se não conseguir carregar do Firebase
            Object.entries(this.containers).forEach(([containerKey, containerId]) => {
                const container = document.getElementById(containerId);
                if (!container) return;
                
                const categoryKey = this.containerToCategoryMap[containerKey];
                const products = this.produtosPorCategoria[categoryKey] || [];
                
                container.innerHTML = '';
                
                products.forEach(product => {
                    const itemKey = this.generateItemKey(product);
                    const priceCard = this.createPriceCard(product, categoryKey, itemKey, 0);
                    container.appendChild(priceCard);
                });
            });
            
            this.updateCounters();
        }

        populateForms() {
            Object.entries(this.containers).forEach(([containerKey, containerId]) => {
                const container = document.getElementById(containerId);
                if (!container) {
                    console.warn(`Container ${containerId} não encontrado`);
                    return;
                }
                
                const categoryKey = this.containerToCategoryMap[containerKey];
                container.innerHTML = '';
                
                const products = this.produtosPorCategoria[categoryKey] || [];
                console.log(`Populando ${categoryKey} com ${products.length} produtos`);
                
                if (products.length === 0) {
                    container.innerHTML = '<div class="text-center p-4 text-gray-500">Nenhum produto nesta categoria</div>';
                    return;
                }
                
                products.forEach(product => {
                    const itemKey = this.generateItemKey(product);
                    
                    // Busca o preço do Firebase
                    const categoryPrecos = appState.currentPrices[categoryKey] || {};
                    const itemPreco = categoryPrecos[itemKey] || {};
                    const currentPrice = itemPreco.preco || 0;
                    
                    console.log(`  - Item: ${product}, Key: ${itemKey}, Preço: ${currentPrice}`);
                    
                    const priceCard = this.createPriceCard(product, categoryKey, itemKey, currentPrice);
                    container.appendChild(priceCard);
                });
            });
        }

        updateCounters() {
            Object.entries(this.containerToCategoryMap).forEach(([containerId, categoryKey]) => {
                const products = this.produtosPorCategoria[categoryKey] || [];
                
                // Remove o "precos" do início e "Container" do final
                const countIdBase = containerId.replace('precos', '').replace('Container', '');
                
                // Tenta diferentes formatos possíveis para o ID do contador
                const possibleIds = [
                    `${categoryKey.replace('_', '')}Count`,
                    `${countIdBase}Count`,
                    `${countIdBase.toLowerCase()}Count`
                ];
                
                let countElement = null;
                for (const id of possibleIds) {
                    countElement = document.getElementById(id);
                    if (countElement) break;
                }
                
                if (countElement) {
                    countElement.textContent = products.length;
                } else {
                    console.warn(`Contador não encontrado para ${categoryKey} (tentados: ${possibleIds.join(', ')})`);
                }
            });
        }

        generateItemKey(itemName) {
            return itemName.toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, '_')
                .replace(/[()]/g, '')
                .replace(/\./g, '')
                .replace(/\d+ml/g, d => d.toLowerCase())
                .replace(/\d+litro/g, d => d.toLowerCase())
                .replace(/\d+l/g, d => d.toLowerCase());
        }

        createPriceCard(itemDisplayName, categoryKey, itemKey, currentPriceValue) {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'price-card bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-primary-200 transition-all duration-300 transform hover:-translate-y-1';
            
            const headerDiv = document.createElement('div');
            headerDiv.className = 'flex items-center justify-between mb-4';
            
            const productIcon = document.createElement('div');
            productIcon.className = 'w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center';
            
            const iconClass = this.getProductIcon(categoryKey);
            productIcon.innerHTML = `<i class="${iconClass} text-primary-600"></i>`;
            
            const titleDiv = document.createElement('div');
            titleDiv.className = 'flex-1 ml-3';
            
            const label = document.createElement('h3');
            label.className = 'text-sm font-semibold text-gray-800 mb-1';
            label.textContent = itemDisplayName;
            
            const keyLabel = document.createElement('p');
            keyLabel.className = 'text-xs text-gray-500';
            keyLabel.textContent = `ID: ${itemKey}`;
            
            titleDiv.appendChild(label);
            titleDiv.appendChild(keyLabel);
            headerDiv.appendChild(productIcon);
            headerDiv.appendChild(titleDiv);
            
            const inputContainer = document.createElement('div');
            inputContainer.className = 'relative mb-4';
            
            const inputLabel = document.createElement('label');
            inputLabel.htmlFor = `preco_${categoryKey}_${itemKey}`;
            inputLabel.className = 'block text-sm font-medium text-gray-700 mb-2';
            inputLabel.innerHTML = '<i class="fas fa-dollar-sign mr-1 text-primary-500"></i>Preço Unitário';
            
            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'relative';
            
            const input = document.createElement('input');
            input.type = 'number';
            input.id = `preco_${categoryKey}_${itemKey}`;
            input.name = `preco_${categoryKey}_${itemKey}`;
            input.step = '0.01';
            input.min = '0';
            input.required = true;
            input.className = 'w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 text-lg font-semibold';
            input.value = parseFloat(currentPriceValue).toFixed(2);
            input.placeholder = '0.00';
            input.dataset.categoryKey = categoryKey;
            input.dataset.itemKey = itemKey;
            input.dataset.originalValue = parseFloat(currentPriceValue).toFixed(2);
            
            const currencySymbol = document.createElement('div');
            currencySymbol.className = 'absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold text-lg';
            currencySymbol.textContent = 'R$';
            
            const changeIndicator = document.createElement('div');
            changeIndicator.className = 'absolute right-3 top-1/2 transform -translate-y-1/2 opacity-0 transition-opacity duration-200';
            changeIndicator.innerHTML = '<i class="fas fa-check text-success-500 text-lg"></i>';
            
            inputWrapper.appendChild(currencySymbol);
            inputWrapper.appendChild(input);
            inputWrapper.appendChild(changeIndicator);
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'bg-gray-50 p-3 rounded-lg';
            
            const currentValueDiv = document.createElement('div');
            currentValueDiv.className = 'flex items-center justify-between text-sm';
            
            const currentLabel = document.createElement('span');
            currentLabel.className = 'text-gray-600';
            currentLabel.textContent = 'Valor atual:';
            
            const currentValueSpan = document.createElement('span');
            currentValueSpan.className = 'font-bold text-primary-600 text-lg';
            currentValueSpan.textContent = formatCurrency(currentPriceValue);
            
            currentValueDiv.appendChild(currentLabel);
            currentValueDiv.appendChild(currentValueSpan);
            infoDiv.appendChild(currentValueDiv);
            
            // Event listeners
            input.addEventListener('input', () => {
                const newValue = parseFloat(input.value) || 0;
                currentValueSpan.textContent = formatCurrency(newValue);
                
                const originalValue = parseFloat(input.dataset.originalValue);
                if (Math.abs(newValue - originalValue) > 0.01) {
                    changeIndicator.classList.remove('opacity-0');
                    cardDiv.classList.add('ring-2', 'ring-primary-200', 'bg-primary-50');
                } else {
                    changeIndicator.classList.add('opacity-0');
                    cardDiv.classList.remove('ring-2', 'ring-primary-200', 'bg-primary-50');
                }
            });
            
            input.addEventListener('focus', () => {
                cardDiv.classList.add('ring-2', 'ring-primary-300');
            });
            
            input.addEventListener('blur', () => {
                cardDiv.classList.remove('ring-2', 'ring-primary-300');
            });
            
            inputContainer.appendChild(inputLabel);
            inputContainer.appendChild(inputWrapper);
            
            cardDiv.appendChild(headerDiv);
            cardDiv.appendChild(inputContainer);
            cardDiv.appendChild(infoDiv);
            
            return cardDiv;
        }

        getProductIcon(categoryKey) {
            const icons = {
                pasteis: 'fas fa-utensils',
                casquinhas: 'fas fa-ice-cream',
                caldo_cana: 'fas fa-glass-whiskey',
                refrigerantes: 'fas fa-bottle-water',
                gelo: 'fas fa-cube'
            };
            return icons[categoryKey] || 'fas fa-tag';
        }

        setupFormHandler() {
            const form = document.getElementById('formPrecos');
            const resetBtn = document.getElementById('resetPricesBtn');
            
            if (!form) {
                console.warn('Formulário de preços não encontrado no DOM');
                return;
            }
            
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveAll();
            });
            
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    this.resetPrices();
                });
            } else {
                console.warn('Botão de reset não encontrado no DOM');
            }
        }

        resetPrices() {
            const inputs = document.querySelectorAll('#formPrecos input[type="number"]');
            
            inputs.forEach(input => {
                const originalValue = input.dataset.originalValue;
                if (originalValue) {
                    input.value = originalValue;
                    input.dispatchEvent(new Event('input'));
                }
            });
            
            toastManager.show('Preços resetados para valores originais', 'info');
        }

        async saveAll() {
            const saveButton = document.querySelector('#formPrecos button[type="submit"]');
            if (!saveButton) {
                toastManager.show('Botão de salvar não encontrado', 'error');
                return;
            }
            
            const originalText = saveButton.innerHTML;
            
            try {
                saveButton.disabled = true;
                saveButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Salvando preços...';
                
                const newPricesData = {};
                const inputs = document.querySelectorAll('#formPrecos input[type="number"]');
                let hasError = false;
                let changedCount = 0;
                
                inputs.forEach(input => {
                    const category = input.dataset.categoryKey;
                    const item = input.dataset.itemKey;
                    
                    if (!category || !item) {
                        console.warn('Input sem categoria ou item key:', input);
                        return;
                    }
                    
                    const price = parseFloat(input.value);
                    
                    if (isNaN(price) || price < 0) {
                        input.classList.add('border-danger-500', 'bg-danger-50');
                        hasError = true;
                        return;
                    }
                    
                    input.classList.remove('border-danger-500', 'bg-danger-50');
                    
                    // Verifica se o preço mudou
                    const categoryData = appState.currentPrices[category] || {};
                    const itemData = categoryData[item] || {};
                    const currentPrice = itemData.preco || 0;
                    
                    if (Math.abs(price - currentPrice) > 0.01) {
                        changedCount++;
                    }
                    
                    // Adiciona à estrutura de dados para salvar
                    if (!newPricesData[category]) {
                        newPricesData[category] = {};
                    }
                    
                    newPricesData[category][item] = { preco: price };
                });
                
                if (hasError) {
                    throw new Error('Alguns preços são inválidos. Verifique os campos destacados em vermelho.');
                }
                
                if (changedCount === 0) {
                    toastManager.show('Nenhuma alteração foi detectada nos preços.', 'info');
                    return;
                }
                
                console.log('Salvando novos preços:', newPricesData);
                console.log(`${changedCount} itens alterados`);
                
                // Salvar no Firebase
                const batch = db.batch();
                Object.keys(newPricesData).forEach(categoryKey => {
                    const categoryDocRef = db.collection('produtos').doc(categoryKey);
                    batch.set(categoryDocRef, newPricesData[categoryKey], { merge: true });
                });
                
                await batch.commit();
                console.log('✅ Preços salvos com sucesso no Firebase');
                
                // Atualiza o estado local
                Object.keys(newPricesData).forEach(categoryKey => {
                    if (!appState.currentPrices[categoryKey]) {
                        appState.currentPrices[categoryKey] = {};
                    }
                    
                    Object.keys(newPricesData[categoryKey]).forEach(itemKey => {
                        if (!appState.currentPrices[categoryKey][itemKey]) {
                            appState.currentPrices[categoryKey][itemKey] = {};
                        }
                        
                        appState.currentPrices[categoryKey][itemKey].preco = 
                            newPricesData[categoryKey][itemKey].preco;
                    });
                });
                
                // Limpa cache do DataManager
                dataManager.clearCache();
                
                // Atualiza valores originais nos inputs
                inputs.forEach(input => {
                    const category = input.dataset.categoryKey;
                    const item = input.dataset.itemKey;
                    
                    if (category && item && newPricesData[category] && newPricesData[category][item]) {
                        input.dataset.originalValue = newPricesData[category][item].preco;
                    }
                });
                
                // Efeito visual de sucesso
                inputs.forEach(input => {
                    const card = input.closest('.price-card');
                    if (card) {
                        card.classList.remove('ring-2', 'ring-primary-200', 'bg-primary-50');
                        card.classList.add('ring-2', 'ring-success-200', 'bg-success-50');
                        
                        setTimeout(() => {
                            card.classList.remove('ring-2', 'ring-success-200', 'bg-success-50');
                        }, 2000);
                    }
                });
                
                // Mostra mensagem de sucesso
                const mensagemSucesso = document.getElementById('precosSalvosMsg');
                if (mensagemSucesso) {
                    mensagemSucesso.classList.remove('hidden');
                    setTimeout(() => {
                        mensagemSucesso.classList.add('hidden');
                    }, 3000);
                }
                
                toastManager.show(`${changedCount} preço(s) alterado(s) com sucesso!`, 'success', 5000);
                
            } catch (error) {
                console.error('Erro ao salvar preços:', error);
                
                // Mostra mensagem de erro
                const mensagemErro = document.getElementById('precosErrorMsg');
                if (mensagemErro) {
                    mensagemErro.classList.remove('hidden');
                    setTimeout(() => {
                        mensagemErro.classList.add('hidden');
                    }, 3000);
                }
                
                toastManager.show('Erro ao salvar preços: ' + error.message, 'error');
            } finally {
                saveButton.disabled = false;
                saveButton.innerHTML = originalText;
            }
        }
    }

    const priceManager = new PriceManager();
    window.priceManager = priceManager;

    // Gerenciador de Usuários CORRIGIDO
    class UserManager {
        constructor() {
            this.container = document.getElementById('listaUsuariosContainer');
            this.form = document.getElementById('formNovoUsuario');
        }

        async load() {
            try {
                console.log('👥 Iniciando carregamento de usuários...');
                toastManager.show('Carregando usuários...', 'info', 2000);
                
                // Limpa container primeiro
                this.showLoading();
                
                // Busca usuários no Firebase
                appState.users = await dataManager.getUsuarios();
                console.log('Usuários carregados:', appState.users);
                
                if (appState.users.length === 0) {
                    console.warn('⚠️ Nenhum usuário encontrado no Firestore');
                    this.showEmpty();
                } else {
                    this.render();
                }
                
                this.setupFormHandler();
                
                toastManager.show('Usuários carregados com sucesso', 'success');
                
            } catch (error) {
                console.error('Erro ao carregar usuários:', error);
                toastManager.show('Erro ao carregar usuários: ' + error.message, 'error');
                this.showError();
            }
        }

        showLoading() {
            if (this.container) {
                this.container.innerHTML = `
                    <div class="flex items-center justify-center p-10">
                        <div class="text-center">
                            <div class="inline-block animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full mb-4"></div>
                            <p class="text-gray-600">Carregando usuários...</p>
                        </div>
                    </div>
                `;
            }
        }

        showEmpty() {
            if (this.container) {
                this.container.innerHTML = `
                    <div class="text-center py-12 text-gray-500">
                        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-users text-2xl text-gray-400"></i>
                        </div>
                        <p class="text-lg font-medium">Nenhum usuário encontrado</p>
                        <p class="text-sm text-gray-400 mt-1">Adicione o primeiro usuário usando o formulário acima</p>
                    </div>
                `;
            }
        }

        showError() {
            if (this.container) {
                this.container.innerHTML = `
                    <div class="text-center py-12 text-red-500">
                        <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-exclamation-triangle text-2xl"></i>
                        </div>
                        <p class="text-lg font-medium">Erro ao carregar usuários</p>
                        <p class="text-sm text-gray-400 mt-1">Verifique sua conexão e tente novamente</p>
                        <button onclick="userManager.load()" class="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">
                            Tentar novamente
                        </button>
                    </div>
                `;
            }
        }

        render() {
            if (!this.container) {
                console.warn('Container de usuários não encontrado no DOM');
                return;
            }
            
            if (appState.users.length === 0) {
                this.showEmpty();
                return;
            }
            
            this.container.innerHTML = appState.users.map(usuario => `
                <div class="glass-effect p-6 rounded-xl hover:shadow-lg transition-all duration-200 border border-gray-100 mb-4">
                    <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
                        <div class="flex-1 flex items-center space-x-4">
                            <div class="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center shadow-lg">
                                <i class="fas fa-user text-white text-lg"></i>
                            </div>
                            <div class="flex-1">
                                <h4 class="text-lg font-semibold text-gray-800">${usuario.nome || 'Nome não informado'}</h4>
                                <p class="text-gray-600">${usuario.email || 'Email não informado'}</p>
                                <div class="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                                    <span class="flex items-center">
                                        <i class="fas fa-fingerprint mr-1"></i>
                                        <code class="bg-gray-100 px-2 py-1 rounded text-xs">${usuario.id.substring(0, 8)}...</code>
                                    </span>
                                    <span class="px-3 py-1 rounded-full text-xs font-medium ${this.getRoleBadgeClass(usuario.role)}">
                                        <i class="fas ${this.getRoleIcon(usuario.role)} mr-1"></i>
                                        ${this.getRoleText(usuario.role)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex items-center space-x-3">
                            <div class="flex items-center space-x-2">
                                <label class="text-sm font-medium text-gray-700">Função:</label>
                                <select class="user-role-select px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" 
                                        data-user-id="${usuario.id}">
                                    <option value="funcionario" ${usuario.role === 'funcionario' ? 'selected' : ''}>Funcionário</option>
                                    <option value="admin" ${usuario.role === 'admin' ? 'selected' : ''}>Administrador</option>
                                </select>
                            </div>
                            
                            <button class="save-role-btn bg-success-500 hover:bg-success-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md" 
                                    data-user-id="${usuario.id}">
                                <i class="fas fa-save mr-1"></i>Salvar
                            </button>
                            
                            <button class="delete-user-btn bg-danger-500 hover:bg-danger-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md" 
                                    data-user-id="${usuario.id}" 
                                    data-user-name="${usuario.nome}">
                                <i class="fas fa-trash mr-1"></i>Excluir
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
            
            this.attachEventListeners();
        }

        getRoleBadgeClass(role) {
            return role === 'admin' ? 
                'bg-danger-100 text-danger-800' : 
                'bg-blue-100 text-blue-800';
        }

        getRoleIcon(role) {
            return role === 'admin' ? 'fa-user-shield' : 'fa-user';
        }

        getRoleText(role) {
            return role === 'admin' ? 'Administrador' : 'Funcionário';
        }

        attachEventListeners() {
            document.querySelectorAll('.save-role-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const userId = btn.dataset.userId;
                    const roleSelect = document.querySelector(`select[data-user-id="${userId}"]`);
                    if (!roleSelect) {
                        toastManager.show('Seletor de função não encontrado', 'error');
                        return;
                    }
                    
                    const newRole = roleSelect.value;
                    
                    const originalText = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Salvando...';
                    
                    try {
                        // Atualiza no Firebase
                        await db.collection('usuarios').doc(userId).update({ role: newRole });
                        
                        // Atualiza no estado local
                        const userIndex = appState.users.findIndex(u => u.id === userId);
                        if (userIndex !== -1) {
                            appState.users[userIndex].role = newRole;
                        }
                        
                        toastManager.show('Função do usuário atualizada com sucesso', 'success');
                        this.render();
                        
                    } catch (error) {
                        console.error('Erro ao atualizar função:', error);
                        toastManager.show('Erro ao atualizar função do usuário: ' + error.message, 'error');
                        
                        // Reverte a mudança no select
                        const originalRole = appState.users.find(u => u.id === userId)?.role || 'funcionario';
                        if (roleSelect) {
                            roleSelect.value = originalRole;
                        }
                    } finally {
                        btn.disabled = false;
                        btn.innerHTML = originalText;
                    }
                });
            });
            
            document.querySelectorAll('.delete-user-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const userId = btn.dataset.userId;
                    const userName = btn.dataset.userName;
                    
                    // Não permitir excluir o próprio usuário
                    if (userId === auth.currentUser.uid) {
                        toastManager.show('Você não pode excluir seu próprio usuário', 'warning');
                        return;
                    }
                    
                    if (!confirm(`Tem certeza que deseja excluir o usuário "${userName}"?\n\nEsta ação não pode ser desfeita.`)) {
                        return;
                    }
                    
                    const originalText = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Excluindo...';
                    
                    try {
                        // Exclui no Firebase
                        await db.collection('usuarios').doc(userId).delete();
                        
                        // Atualiza no estado local
                        appState.users = appState.users.filter(u => u.id !== userId);
                        
                        toastManager.show(`Usuário "${userName}" excluído com sucesso`, 'success');
                        this.render();
                        
                    } catch (error) {
                        console.error('Erro ao excluir usuário:', error);
                        toastManager.show('Erro ao excluir usuário: ' + error.message, 'error');
                    } finally {
                        btn.disabled = false;
                        btn.innerHTML = originalText;
                    }
                });
            });
        }

        setupFormHandler() {
            if (!this.form) {
                console.warn('Formulário de novo usuário não encontrado no DOM');
                return;
            }
            
            this.form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.addUser();
            });
        }

        async addUser() {
            // Verifica se os campos obrigatórios existem
            const uidInput = document.getElementById('novoUsuarioUid');
            const nomeInput = document.getElementById('novoUsuarioNome');
            const emailInput = document.getElementById('novoUsuarioEmail');
            const roleSelect = document.getElementById('novoUsuarioRole');
            
            if (!uidInput || !nomeInput || !emailInput || !roleSelect) {
                toastManager.show('Formulário incompleto. Recarregue a página e tente novamente.', 'error');
                return;
            }
            
            const uid = uidInput.value.trim();
            const nome = nomeInput.value.trim();
            const email = emailInput.value.trim();
            const role = roleSelect.value;
            
            if (!uid || !nome || !email) {
                toastManager.show('Todos os campos são obrigatórios', 'warning');
                return;
            }
            
            if (uid.length < 20) {
                toastManager.show('UID inválido. Certifique-se de copiar o UID completo do Firebase Console', 'warning');
                return;
            }
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                toastManager.show('Email inválido', 'warning');
                return;
            }
            
            const submitBtn = this.form.querySelector('button[type="submit"]');
            if (!submitBtn) {
                toastManager.show('Botão de envio não encontrado', 'error');
                return;
            }
            
            const originalText = submitBtn.innerHTML;
            
            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Adicionando usuário...';
                
                // Verifica se já existe um usuário com este UID
                const existingUser = appState.users.find(u => u.id === uid);
                if (existingUser) {
                    throw new Error('Já existe um usuário com este UID');
                }
                
                // Dados do usuário
                const userData = {
                    nome: nome,
                    email: email,
                    role: role,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                // Salva no Firebase
                await db.collection('usuarios').doc(uid).set(userData);
                
                // Adiciona ao estado local
                appState.users.push({
                    id: uid,
                    ...userData,
                    createdAt: { toDate: () => new Date() }
                });
                
                toastManager.show(`Usuário "${nome}" adicionado com sucesso`, 'success');
                this.form.reset();
                this.render();
                
            } catch (error) {
                console.error('Erro ao adicionar usuário:', error);
                toastManager.show('Erro ao adicionar usuário: ' + error.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    }

    const userManager = new UserManager();
    window.userManager = userManager;
    
    // Gerenciador de Abas CORRIGIDO
    class TabManager {
        constructor() {
            this.tabs = {
                dashboard: {
                    button: document.getElementById('btnTabDashboard'),
                    content: document.getElementById('tabContentDashboard'),
                    loader: () => this.loadDashboard()
                },
                precos: {
                    button: document.getElementById('btnTabPrecos'),
                    content: document.getElementById('tabContentPrecos'),
                    loader: () => priceManager.load()
                },
                usuarios: {
                    button: document.getElementById('btnTabUsuarios'),
                    content: document.getElementById('tabContentUsuarios'),
                    loader: () => userManager.load()
                }
            };
            
            this.setupTabs();
        }

        setupTabs() {
            Object.entries(this.tabs).forEach(([tabName, tab]) => {
                if (tab.button) {
                    tab.button.addEventListener('click', () => {
                        this.switchTab(tabName);
                    });
                } else {
                    console.warn(`Botão para aba ${tabName} não encontrado`);
                }
            });
        }

        async switchTab(activeTabName) {
            console.log(`🔄 Alterando para aba: ${activeTabName}`);
            
            // Atualizar botões e conteúdo
            Object.entries(this.tabs).forEach(([tabName, tab]) => {
                if (tab.button) {
                    tab.button.classList.remove('active', 'bg-primary-500', 'text-white', 'font-semibold');
                    tab.button.classList.add('bg-gray-200', 'text-gray-700', 'font-medium');
                }
                
                if (tab.content) {
                    tab.content.classList.add('hidden');
                } else {
                    console.warn(`Conteúdo para aba ${tabName} não encontrado`);
                }
            });
            
            const activeTab = this.tabs[activeTabName];
            if (activeTab) {
                if (activeTab.button) {
                    activeTab.button.classList.remove('bg-gray-200', 'text-gray-700', 'font-medium');
                    activeTab.button.classList.add('active', 'bg-primary-500', 'text-white', 'font-semibold');
                }
                
                if (activeTab.content) {
                    activeTab.content.classList.remove('hidden');
                }
                
                // Carregar dados da aba
                if (activeTab.loader) {
                    try {
                        toastManager.show(`Carregando aba ${activeTabName}...`, 'info', 2000);
                        await activeTab.loader();
                    } catch (error) {
                        console.error(`Erro ao carregar aba ${activeTabName}:`, error);
                        toastManager.show(`Erro ao carregar dados da aba ${activeTabName}: ${error.message}`, 'error');
                    }
                }
            } else {
                console.error(`Aba ${activeTabName} não encontrada`);
            }
        }

        async loadDashboard() {
            console.log('📊 Carregando dashboard...');
            // Implementação básica do dashboard
            toastManager.show('Dashboard carregado', 'success');
            // Se quiser implementar funcionalidade de dashboard, faça aqui
        }
    }

    const tabManager = new TabManager();
    window.tabManager = tabManager;

    // Inicialização
    async function initialize() {
        try {
            console.log('🚀 Inicializando sistema admin...');
            toastManager.show('Inicializando dashboard...', 'info', 3000);
            
            // Aguarda um momento para garantir que tudo esteja pronto
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Inicializar aba padrão (Dashboard)
            await tabManager.switchTab('dashboard');
            
            // Pré-carrega dados de preços e usuários em segundo plano
            setTimeout(async () => {
                try {
                    console.log('🔄 Pré-carregando dados em segundo plano...');
                    await dataManager.getPrecos();
                    await dataManager.getUsuarios();
                    console.log('✅ Pré-carregamento concluído');
                } catch (error) {
                    console.error('Erro no pré-carregamento:', error);
                }
            }, 2000);
            
            toastManager.show('Dashboard carregado com sucesso!', 'success', 5000);
            
        } catch (error) {
            console.error('Erro na inicialização:', error);
            toastManager.show('Erro ao inicializar dashboard: ' + error.message, 'error');
        }
    }

    // Iniciar o sistema
    initialize();
});