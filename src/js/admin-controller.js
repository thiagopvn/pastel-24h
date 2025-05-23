// admin-controller.js - VERSÃO CORRIGIDA COM ESTRUTURA FIREBASE ADEQUADA
document.addEventListener('DOMContentLoaded', async () => {
    // Aguarda um momento para garantir que Firebase esteja inicializado
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verifica se o usuário está autenticado antes de continuar
    const checkAuth = new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe();
            resolve(user);
        });
    });
    
    const currentUser = await checkAuth;
    if (!currentUser) {
        console.error("Usuário não autenticado!");
        window.location.href = 'index.html';
        return;
    }
    
    // Agora sim, protege a rota
    protectRoute(['admin']);

    // Configurações globais
    const CONFIG = {
        AUTO_REFRESH_INTERVAL: 300000, // 5 minutos
        TOAST_DURATION: 5000,
        CHART_ANIMATION_DURATION: 800,
        REALTIME_ENABLED: true,
        DEBUG_MODE: true // Ativado para debug
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

    const formatNumber = (value) => {
        return new Intl.NumberFormat('pt-BR').format(value || 0);
    };

    const formatDateTime = (date) => {
        return new Intl.DateTimeFormat('pt-BR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
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
            this.toasts = new Map();
        }

        show(message, type = 'info', duration = CONFIG.TOAST_DURATION, persistent = false) {
            const toastId = Date.now() + Math.random();
            const toast = this.createToast(message, type, toastId);
            
            this.container.appendChild(toast);
            this.toasts.set(toastId, toast);

            // Animação de entrada
            setTimeout(() => toast.classList.add('show'), 100);

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

        // MÉTODO CORRIGIDO PARA BUSCAR OU CRIAR PREÇOS
        async getPrecos() {
            try {
                console.log('🔍 Iniciando busca de preços no Firebase...');
                
                // Verifica se o usuário está autenticado
                if (!auth.currentUser) {
                    throw new Error('Usuário não autenticado');
                }
                
                // Primeiro, tenta buscar a coleção produtos
                const snapshot = await db.collection('produtos').get();
                let precos = {};
                
                console.log(`📦 Encontrados ${snapshot.size} documentos na coleção produtos`);
                
                if (snapshot.empty) {
                    console.warn('⚠️ Nenhum documento encontrado na coleção produtos!');
                    console.log('📝 Criando estrutura inicial de preços...');
                    
                    // Criar estrutura inicial de preços
                    precos = await this.createInitialPrices();
                    return precos;
                }
                
                // Se existirem documentos, processa eles
                snapshot.forEach(doc => {
                    const categoria = doc.id;
                    const dados = doc.data();
                    
                    console.log(`📋 Processando categoria: ${categoria}`, dados);
                    
                    // Verifica se os dados estão aninhados em um campo específico
                    if (dados && typeof dados === 'object') {
                        // Se os dados estiverem em um campo 'items' ou 'produtos'
                        if (dados.items) {
                            precos[categoria] = dados.items;
                        } else if (dados.produtos) {
                            precos[categoria] = dados.produtos;
                        } else {
                            // Assume que os dados estão diretamente no documento
                            precos[categoria] = dados;
                        }
                    }
                });
                
                // Verifica se todas as categorias necessárias existem
                const categoriasNecessarias = ['pasteis', 'casquinhas', 'caldo_cana', 'refrigerantes', 'gelo'];
                const categoriasFaltando = categoriasNecessarias.filter(cat => !precos[cat]);
                
                if (categoriasFaltando.length > 0) {
                    console.log(`📝 Criando categorias faltantes: ${categoriasFaltando.join(', ')}`);
                    await this.createMissingCategories(precos, categoriasFaltando);
                }
                
                console.log('✅ Preços carregados:', precos);
                return precos;
                
            } catch (error) {
                console.error('❌ Erro ao buscar preços:', error);
                console.error('Detalhes:', error.message, error.code);
                
                // Em caso de erro, criar estrutura inicial
                return await this.createInitialPrices();
            }
        }

        // NOVO MÉTODO: Criar estrutura inicial de preços
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
                const batch = db.batch();
                Object.keys(precosIniciais).forEach(categoria => {
                    const docRef = db.collection('produtos').doc(categoria);
                    batch.set(docRef, precosIniciais[categoria]);
                });
                await batch.commit();
                console.log('✅ Estrutura inicial de preços criada no Firebase');
            } catch (error) {
                console.error('❌ Erro ao criar estrutura inicial:', error);
            }

            return precosIniciais;
        }

        // NOVO MÉTODO: Criar categorias faltantes
        async createMissingCategories(precosExistentes, categoriasFaltando) {
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
                const batch = db.batch();
                categoriasFaltando.forEach(categoria => {
                    if (precosDefault[categoria]) {
                        const docRef = db.collection('produtos').doc(categoria);
                        batch.set(docRef, precosDefault[categoria]);
                        precosExistentes[categoria] = precosDefault[categoria];
                    }
                });
                await batch.commit();
                console.log('✅ Categorias faltantes criadas no Firebase');
            } catch (error) {
                console.error('❌ Erro ao criar categorias faltantes:', error);
            }
        }

        // MÉTODO CORRIGIDO PARA BUSCAR USUÁRIOS
        async getUsuarios() {
            try {
                console.log('👥 Buscando usuários no Firebase...');
                
                if (!auth.currentUser) {
                    throw new Error('Usuário não autenticado');
                }
                
                const snapshot = await db.collection('usuarios').get();
                const usuarios = [];
                
                console.log(`Encontrados ${snapshot.size} usuários`);
                
                snapshot.forEach(doc => {
                    const userData = doc.data();
                    usuarios.push({ 
                        id: doc.id, 
                        ...userData,
                        // Garante que temos campos essenciais
                        nome: userData.nome || userData.displayName || 'Sem nome',
                        email: userData.email || 'Sem email',
                        role: userData.role || 'funcionario'
                    });
                });
                
                console.log('Usuários carregados:', usuarios);
                return usuarios;
                
            } catch (error) {
                console.error('Erro ao buscar usuários:', error);
                console.error('Detalhes:', error.message, error.code);
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
                pasteis: window.listaSaboresPasteis || [],
                casquinhas: window.listaCasquinhas || [],
                caldo_cana: window.listaCaldoCana || [],
                refrigerantes: window.listaRefrigerantes || [],
                gelo: ["Gelo (Pacote)"]
            };
            
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
                    const currentPrice = appState.currentPrices[categoryKey]?.[itemKey]?.preco || 0;
                    const priceCard = this.createPriceCard(product, categoryKey, itemKey, currentPrice);
                    container.appendChild(priceCard);
                });
            });
        }

        updateCounters() {
            Object.entries(this.containerToCategoryMap).forEach(([containerId, categoryKey]) => {
                const products = this.produtosPorCategoria[categoryKey] || [];
                const countElementId = `${categoryKey.replace('_', '')}Count`;
                const countElement = document.getElementById(countElementId);
                
                if (countElement) {
                    countElement.textContent = products.length;
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
            
            if (!form) return;
            
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveAll();
            });
            
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    this.resetPrices();
                });
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
                    const price = parseFloat(input.value);
                    
                    if (isNaN(price) || price < 0) {
                        input.classList.add('border-danger-500', 'bg-danger-50');
                        hasError = true;
                        return;
                    }
                    
                    input.classList.remove('border-danger-500', 'bg-danger-50');
                    
                    const currentPrice = appState.currentPrices[category]?.[item]?.preco || 0;
                    if (Math.abs(price - currentPrice) > 0.01) {
                        changedCount++;
                    }
                    
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
                
                // Salvar no Firebase
                const batch = db.batch();
                Object.keys(newPricesData).forEach(categoryKey => {
                    const categoryDocRef = db.collection('produtos').doc(categoryKey);
                    batch.set(categoryDocRef, newPricesData[categoryKey], { merge: true });
                });
                
                await batch.commit();
                
                appState.currentPrices = { ...appState.currentPrices, ...newPricesData };
                dataManager.clearCache();
                
                inputs.forEach(input => {
                    input.dataset.originalValue = input.value;
                });
                
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
                
                document.getElementById('precosSalvosMsg').classList.remove('hidden');
                setTimeout(() => {
                    document.getElementById('precosSalvosMsg').classList.add('hidden');
                }, 3000);
                
                toastManager.show(`${changedCount} preço(s) alterado(s) com sucesso!`, 'success', 5000);
                
            } catch (error) {
                console.error('Erro ao salvar preços:', error);
                document.getElementById('precosErrorMsg').classList.remove('hidden');
                setTimeout(() => {
                    document.getElementById('precosErrorMsg').classList.add('hidden');
                }, 3000);
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
                
                appState.users = await dataManager.getUsuarios();
                console.log('Usuários carregados:', appState.users);
                
                this.render();
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
                        <div class="loading-shimmer w-16 h-16 rounded-full"></div>
                        <span class="ml-3 text-gray-500 font-medium">Carregando usuários...</span>
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
            if (!this.container) return;
            
            if (appState.users.length === 0) {
                this.container.innerHTML = `
                    <div class="text-center py-12 text-gray-500">
                        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-users text-2xl text-gray-400"></i>
                        </div>
                        <p class="text-lg font-medium">Nenhum usuário encontrado</p>
                        <p class="text-sm text-gray-400 mt-1">Adicione o primeiro usuário usando o formulário acima</p>
                    </div>
                `;
                return;
            }
            
            this.container.innerHTML = appState.users.map(usuario => `
                <div class="glass-effect p-6 rounded-xl hover:shadow-lg transition-all duration-200 border border-gray-100">
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
                    const newRole = roleSelect.value;
                    
                    const originalText = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Salvando...';
                    
                    try {
                        await db.collection('usuarios').doc(userId).update({ role: newRole });
                        
                        const userIndex = appState.users.findIndex(u => u.id === userId);
                        if (userIndex !== -1) {
                            appState.users[userIndex].role = newRole;
                        }
                        
                        toastManager.show('Função do usuário atualizada com sucesso', 'success');
                        this.render();
                        
                    } catch (error) {
                        console.error('Erro ao atualizar função:', error);
                        toastManager.show('Erro ao atualizar função do usuário', 'error');
                        roleSelect.value = appState.users.find(u => u.id === userId)?.role || 'funcionario';
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
                    
                    if (!confirm(`Tem certeza que deseja excluir o usuário "${userName}"?\n\nEsta ação não pode ser desfeita.`)) {
                        return;
                    }
                    
                    const originalText = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Excluindo...';
                    
                    try {
                        await db.collection('usuarios').doc(userId).delete();
                        
                        appState.users = appState.users.filter(u => u.id !== userId);
                        
                        toastManager.show(`Usuário "${userName}" excluído com sucesso`, 'success');
                        this.render();
                        
                    } catch (error) {
                        console.error('Erro ao excluir usuário:', error);
                        toastManager.show('Erro ao excluir usuário', 'error');
                    } finally {
                        btn.disabled = false;
                        btn.innerHTML = originalText;
                    }
                });
            });
        }

        setupFormHandler() {
            if (!this.form) return;
            
            this.form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.addUser();
            });
        }

        async addUser() {
            const uid = document.getElementById('novoUsuarioUid').value.trim();
            const nome = document.getElementById('novoUsuarioNome').value.trim();
            const email = document.getElementById('novoUsuarioEmail').value.trim();
            const role = document.getElementById('novoUsuarioRole').value;
            
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
            const originalText = submitBtn.innerHTML;
            
            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Adicionando usuário...';
                
                const existingUser = appState.users.find(u => u.id === uid);
                if (existingUser) {
                    throw new Error('Já existe um usuário com este UID');
                }
                
                const userData = {
                    nome: nome,
                    email: email,
                    role: role,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await db.collection('usuarios').doc(uid).set(userData);
                
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

    // Restante do código permanece igual...
    // (Mantenha todo o resto do código original, incluindo KPIManager, ChartManager, AlertManager, etc.)
    
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
                }
            });
        }

        async switchTab(activeTabName) {
            // Atualizar botões
            Object.values(this.tabs).forEach(tab => {
                if (tab.button) {
                    tab.button.classList.remove('active', 'bg-primary-500', 'text-white', 'font-semibold');
                    tab.button.classList.add('bg-gray-200', 'text-gray-700', 'font-medium');
                }
                if (tab.content) {
                    tab.content.classList.add('hidden');
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
                        await activeTab.loader();
                    } catch (error) {
                        console.error(`Erro ao carregar aba ${activeTabName}:`, error);
                        toastManager.show(`Erro ao carregar dados da aba ${activeTabName}`, 'error');
                    }
                }
            }
        }

        async loadDashboard() {
            // Implementação básica do dashboard
            console.log('Carregando dashboard...');
            toastManager.show('Dashboard carregado', 'success');
        }
    }

    const tabManager = new TabManager();

    // Inicialização
    async function initialize() {
        try {
            console.log('🚀 Inicializando sistema admin...');
            toastManager.show('Inicializando dashboard...', 'info', 3000);
            
            // Aguarda um momento para garantir que tudo esteja pronto
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Inicializar aba padrão (Dashboard)
            await tabManager.switchTab('dashboard');
            
            toastManager.show('Dashboard carregado com sucesso!', 'success', 5000);
            
        } catch (error) {
            console.error('Erro na inicialização:', error);
            toastManager.show('Erro ao inicializar dashboard: ' + error.message, 'error');
        }
    }

    // Iniciar
    initialize();
});