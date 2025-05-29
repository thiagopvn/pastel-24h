document.addEventListener('DOMContentLoaded', async () => {

    // Garantir função formatCurrency global
    if (typeof window.formatCurrency !== 'function') {
        window.formatCurrency = function(value, decimals = 2) {
            try {
                const valueNumber = parseFloat(value);
                if (isNaN(valueNumber)) return 'R$ 0,00';
                
                return `R$ ${valueNumber.toFixed(decimals).replace('.', ',')}`;
            } catch (error) {
                console.error("Erro ao formatar moeda:", error);
                return 'R$ 0,00';
            }
        };
    }

    console.log("🚀 Iniciando admin-controller.js v2.0");
    
    // Verificações iniciais do Firebase
    if (typeof firebase === 'undefined') {
        console.error("❌ Firebase não está definido. Verifique se os scripts Firebase foram carregados.");
        alert("Erro crítico: Firebase não está carregado. Verifique sua conexão com a internet ou contate o suporte.");
        return;
    }

    if (typeof auth === 'undefined' || typeof db === 'undefined') {
        console.error("❌ auth ou db não estão definidos. Verifique firebase-config.js");
        alert("Erro crítico: Configuração do Firebase incompleta. Contate o suporte.");
        return;
    }

    console.log("🔍 Testando conexão com Firestore...");
    try {
        const testDoc = await db.collection('produtos').doc('pasteis').get();
        console.log("✅ Conexão com Firestore OK. Documento existe?", testDoc.exists);
    } catch (error) {
        console.error("❌ Erro ao conectar com Firestore:", error);
        alert("Erro ao conectar com o banco de dados. Verifique sua conexão.");
    }

    console.log("🔍 Verificando autenticação...");
    const waitForAuth = new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe();
            resolve(user);
        });
    });
    
    try {
        const currentUser = await waitForAuth;
        
        if (!currentUser) {
            console.error("❌ Usuário não autenticado");
            alert("Sessão expirada ou usuário não autenticado. Redirecionando para login...");
            window.location.href = 'index.html';
            return;
        }
        
        console.log("✅ Usuário autenticado:", currentUser.email, "UID:", currentUser.uid);
        
        try {
            const userDoc = await db.collection('usuarios').doc(currentUser.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                console.log("✅ Dados do usuário:", userData);
                if (userData.role !== 'admin') {
                    console.error("❌ Usuário não é admin");
                    alert("Acesso negado. Apenas administradores podem acessar esta página.");
                    window.location.href = 'funcionario.html';
                    return;
                }
            } else {
                console.warn("⚠️ Documento do usuário não encontrado em 'usuarios'");
            }
        } catch (error) {
            console.error("❌ Erro ao verificar role do usuário:", error);
        }
        
    } catch (error) {
        console.error("❌ Erro ao verificar autenticação:", error);
        alert("Erro ao verificar autenticação. Tente recarregar a página.");
        return;
    }

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    // Classe NotificationManager
    class NotificationManager {
        constructor() {
            this.container = document.getElementById('toast-container');
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.id = 'toast-container';
                this.container.className = 'fixed top-4 right-4 z-50 space-y-2';
                document.body.appendChild(this.container);
            }
        }

        showMessage(message, type = 'info', duration = 5000) {
            console.log(`[${type.toUpperCase()}] ${message}`);
            
            const toast = document.createElement('div');
            toast.className = `toast bg-white border-l-4 rounded-lg shadow-lg p-4 mb-2 transform transition-all duration-300`;
            
            const colors = {
                success: 'border-green-500 text-green-800',
                error: 'border-red-500 text-red-800',
                warning: 'border-yellow-500 text-yellow-800',
                info: 'border-blue-500 text-blue-800'
            };
            
            const icons = {
                success: 'fa-check-circle',
                error: 'fa-exclamation-circle',
                warning: 'fa-exclamation-triangle',
                info: 'fa-info-circle'
            };
            
            toast.classList.add(...colors[type].split(' '));
            
            toast.innerHTML = `
                <div class="flex items-center">
                    <i class="fas ${icons[type]} mr-3"></i>
                    <span class="flex-1">${message}</span>
                    <button class="ml-2 text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            
            this.container.appendChild(toast);
            
            toast.querySelector('button').addEventListener('click', () => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => toast.remove(), 300);
            });
            
            setTimeout(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(0)';
            }, 10);
            
            if (duration > 0) {
                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateX(100%)';
                    setTimeout(() => toast.remove(), 300);
                }, duration);
            }
            
            return toast;
        }
    }

    const notifications = new NotificationManager();
    window.notifications = notifications;
    
    const appState = {
        currentPrices: {},
        users: []
    };

    // Classe PriceManager atualizada
    class PriceManager {
        constructor() {
            this.containers = {
                precosPasteisContainer: document.getElementById('precosPasteisContainer'),
                precosCasquinhasContainer: document.getElementById('precosCasquinhasContainer'), 
                precosCaldoCanaContainer: document.getElementById('precosCaldoCanaContainer'),
                precosRefrigerantesContainer: document.getElementById('precosRefrigerantesContainer'),
                precosGeloContainer: document.getElementById('precosGeloContainer')
            };
            
            const missingContainers = Object.entries(this.containers)
                .filter(([key, element]) => !element)
                .map(([key]) => key);
                
            if (missingContainers.length > 0) {
                console.warn(`⚠️ Containers não encontrados: ${missingContainers.join(', ')}`);
            }

            // Listas originais de produtos
            this.produtosOriginais = {
                pasteis: [
                    "Carne com Queijo", "Carne", "Frango com Catupiry", "Frango com Queijo",
                    "Carioca", "Pizza", "Palmito", "Queijo", "4 Queijos", "Bauru",
                    "Calabresa", "Portuguesa", "Carne Seca", "Especial Carne Seca",
                    "Especial de Carne", "Especial de Calabresa"
                ],
                casquinhas: ["Casquinha Crua", "Casquinha Frita"],
                caldo_cana: ["Fardo de Cana", "Copo 300ml", "Copo 400ml", "Copo 500ml", "Garrafa 500ml", "Garrafa 1 Litro"],
                refrigerantes: [
                    "Coca-Cola", "Fanta Laranja", "Fanta Uva", "Guaraná",
                    "Refri Limão", "Refri. Zero", "Itubaina", "Água",
                    "Água c/ Gás", "Cerveja Longneck", "Cerveja Lata"
                ],
                gelo: ["Gelo (Pacote)"]
            };

            // Produtos normalizados para as chaves
            this.produtosPorCategoria = {};
            Object.entries(this.produtosOriginais).forEach(([categoria, produtos]) => {
                this.produtosPorCategoria[categoria] = produtos.map(produto => 
                    this.normalizeKey(produto)
                );
            });

            this.containerToCategoryMap = {
                precosPasteisContainer: 'pasteis',
                precosCasquinhasContainer: 'casquinhas',
                precosCaldoCanaContainer: 'caldo_cana',
                precosRefrigerantesContainer: 'refrigerantes',
                precosGeloContainer: 'gelo'
            };
        }

        // Nova função para normalizar chaves
        normalizeKey(text) {
            let normalized = text.toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[ç]/g, 'c')
                .replace(/[ãâáàä]/g, 'a')
                .replace(/[éêèë]/g, 'e')
                .replace(/[íìîï]/g, 'i')
                .replace(/[óôõòö]/g, 'o')
                .replace(/[úùûü]/g, 'u')
                .replace(/\./g, '') // Remove pontos
                .replace(/\//g, '_') // Substitui / por _
                .replace(/[\(\)]/g, ''); // Remove parênteses

            // Tratamento especial para gelo
            if (normalized === 'gelo_pacote') {
                return 'gelo_pacote';
            }
            
            return normalized;
        }

        formatCurrency(value) {
            const valueNumber = parseFloat(value);
            if (isNaN(valueNumber)) return 'R$ 0,00';
            return `R$ ${valueNumber.toFixed(2).replace('.', ',')}`;
        }

        async load() {
            console.log("🔄 Iniciando carregamento de preços...");
            notifications.showMessage("Carregando preços...", "info");
            this.clearContainers();
            
            try {
                // Garantir estrutura no Firebase
                await this.ensureFirebaseStructure();
                
                const precos = await this.fetchPrices();
                appState.currentPrices = precos;
                
                if (Object.keys(precos).length === 0) {
                    console.warn("⚠️ Nenhum preço encontrado, usando valores padrão");
                    this.populateWithDefaults();
                    return;
                }
                
                console.log("✅ Preços carregados:", precos);
                this.populateForms();
                this.setupFormHandler();
                this.updateCounters();
                
                notifications.showMessage("Preços carregados com sucesso!", "success");
            } catch (error) {
                console.error("❌ Erro ao carregar preços:", error);
                notifications.showMessage(`Erro ao carregar preços: ${error.message}`, "error");
                this.populateWithDefaults();
            }
        }

        async ensureFirebaseStructure() {
            console.log("🔨 Verificando estrutura do Firebase...");
            const categorias = ['pasteis', 'casquinhas', 'caldo_cana', 'refrigerantes', 'gelo'];
            
            for (const categoria of categorias) {
                const docRef = db.collection('produtos').doc(categoria);
                const doc = await docRef.get();
                
                if (!doc.exists) {
                    console.log(`📝 Criando documento para categoria: ${categoria}`);
                    const defaultPrices = this.getDefaultPrices();
                    const categoryData = {};
                    
                    // Converter estrutura de { key: { preco: value } } para { key: value }
                    Object.entries(defaultPrices[categoria] || {}).forEach(([key, data]) => {
                        categoryData[key] = data.preco;
                    });
                    
                    await docRef.set(categoryData);
                    console.log(`✅ Documento criado para ${categoria}`);
                }
            }
        }

        clearContainers() {
            Object.values(this.containers).forEach(container => {
                if (container) {
                    container.innerHTML = '<div class="text-center p-4 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando preços...</div>';
                }
            });
        }

        async fetchPrices() {
            console.log("🔍 Buscando preços no Firebase...");
            const precos = {};
            
            try {
                console.log("📂 Listando todos os documentos na coleção 'produtos':");
                const produtosSnapshot = await db.collection('produtos').get();
                produtosSnapshot.forEach(doc => {
                    console.log(`  - Documento: ${doc.id}`);
                });
                
                const categorias = Object.keys(this.produtosPorCategoria);
                
                for (const categoria of categorias) {
                    console.log(`\n📂 Buscando categoria: ${categoria}`);
                    precos[categoria] = {};
                    
                    try {
                        const categoriaDoc = await db.collection('produtos').doc(categoria).get();
                        
                        if (categoriaDoc.exists) {
                            const data = categoriaDoc.data();
                            console.log(`✅ Documento '${categoria}' encontrado. Campos:`, Object.keys(data));
                            
                            const produtosEsperados = this.produtosPorCategoria[categoria];
                            console.log(`📋 Produtos esperados em ${categoria}:`, produtosEsperados);
                            
                            produtosEsperados.forEach(produtoKey => {
                                if (data.hasOwnProperty(produtoKey)) {
                                    const valor = data[produtoKey];
                                    console.log(`  ✓ ${produtoKey}: ${valor} (tipo: ${typeof valor})`);
                                    
                                    if (typeof valor === 'number') {
                                        precos[categoria][produtoKey] = { preco: valor };
                                    } else if (typeof valor === 'object' && valor !== null && valor.preco !== undefined) {
                                        precos[categoria][produtoKey] = { preco: parseFloat(valor.preco) };
                                    } else {
                                        console.warn(`  ⚠️ ${produtoKey}: formato inesperado:`, valor);
                                        precos[categoria][produtoKey] = { preco: 0 };
                                    }
                                } else {
                                    console.warn(`  ❌ ${produtoKey}: não encontrado no documento`);
                                    precos[categoria][produtoKey] = { preco: 0 };
                                }
                            });
                            
                        } else {
                            console.error(`❌ Documento '${categoria}' não encontrado na coleção 'produtos'`);
                            this.produtosPorCategoria[categoria].forEach(produto => {
                                precos[categoria][produto] = { preco: 0 };
                            });
                        }
                    } catch (error) {
                        console.error(`❌ Erro ao buscar categoria ${categoria}:`, error);
                        console.error("Detalhes do erro:", error.code, error.message);
                        this.produtosPorCategoria[categoria].forEach(produto => {
                            precos[categoria][produto] = { preco: 0 };
                        });
                    }
                }
                
                let totalProdutos = 0;
                let produtosComPreco = 0;
                Object.values(precos).forEach(categoria => {
                    Object.values(categoria).forEach(item => {
                        totalProdutos++;
                        if (item.preco > 0) produtosComPreco++;
                    });
                });
                
                console.log(`\n📊 Resumo: ${produtosComPreco}/${totalProdutos} produtos com preço definido`);
                return precos;
                
            } catch (error) {
                console.error("❌ Erro geral ao buscar preços:", error);
                console.error("Tipo de erro:", error.name);
                console.error("Código do erro:", error.code);
                console.error("Mensagem:", error.message);
                throw error;
            }
        }

        populateForms() {
            console.log("🎨 Populando formulários com os preços...");
            
            Object.entries(this.containers).forEach(([containerId, container]) => {
                if (!container) {
                    console.warn(`⚠️ Container ${containerId} não encontrado`);
                    return;
                }
                
                const categoryKey = this.containerToCategoryMap[containerId];
                if (!categoryKey) {
                    console.warn(`⚠️ Categoria não mapeada para ${containerId}`);
                    return;
                }
                
                const productsOriginal = this.produtosOriginais[categoryKey] || [];
                const productsKeys = this.produtosPorCategoria[categoryKey] || [];
                
                container.innerHTML = '';
                
                if (productsKeys.length === 0) {
                    container.innerHTML = '<div class="text-center p-4 text-gray-500">Nenhum produto nesta categoria</div>';
                    return;
                }
                
                console.log(`📋 Populando ${productsKeys.length} produtos na categoria ${categoryKey}`);
                
                productsKeys.forEach((productKey, index) => {
                    const itemKey = productKey;
                    const displayName = productsOriginal[index] || this.formatProductName(productKey);
                    
                    let currentPrice = 0;
                    if (appState.currentPrices[categoryKey] && 
                        appState.currentPrices[categoryKey][itemKey] && 
                        appState.currentPrices[categoryKey][itemKey].preco !== undefined) {
                        currentPrice = appState.currentPrices[categoryKey][itemKey].preco;
                    }
                    
                    console.log(`  - ${displayName} (${productKey}): R$ ${currentPrice}`);
                    
                    const priceCard = this.createPriceCard(displayName, categoryKey, itemKey, currentPrice);
                    container.appendChild(priceCard);
                });
            });
        }

        formatProductName(productKey) {
            return productKey
                .replace(/_/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase())
                .replace(/De /g, 'de ')
                .replace(/Com /g, 'com ')
                .replace(/\d+ml/g, match => match.toUpperCase())
                .replace(/\d+l/g, match => match.toUpperCase());
        }

        updateCounters() {
            console.log("🔢 Atualizando contadores...");
            
            Object.entries(this.containerToCategoryMap).forEach(([containerId, categoryKey]) => {
                const categoryId = containerId.replace('precos', '').replace('Container', '');
                
                const possibleIds = [
                    `${categoryKey}Count`,
                    `${categoryKey.replace('_', '')}Count`,
                    `${categoryId}Count`,
                    `${categoryId.toLowerCase()}Count`
                ];
                
                let counterElement = null;
                
                for (const id of possibleIds) {
                    const element = document.getElementById(id);
                    if (element) {
                        counterElement = element;
                        console.log(`✅ Contador encontrado: ${id}`);
                        break;
                    }
                }
                
                if (counterElement) {
                    const products = this.produtosPorCategoria[categoryKey] || [];
                    counterElement.textContent = products.length;
                    console.log(`📊 Contador ${counterElement.id}: ${products.length} produtos`);
                } else {
                    console.warn(`⚠️ Contador não encontrado para categoria ${categoryKey}. IDs tentados:`, possibleIds);
                }
            });
        }

        createPriceCard(itemDisplayName, categoryKey, itemKey, currentPriceValue) {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'price-card bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-lg hover:border-primary-200 transition-all duration-300 transform hover:-translate-y-1';
            
            // Cabeçalho do card
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
            
            // Seção de input com ícones
            const inputContainer = document.createElement('div');
            inputContainer.className = 'relative mb-4';
            
            const inputLabel = document.createElement('label');
            inputLabel.htmlFor = `preco_${categoryKey}_${itemKey}`;
            inputLabel.className = 'block text-sm font-medium text-gray-700 mb-2';
            inputLabel.innerHTML = '<i class="fas fa-dollar-sign mr-1 text-primary-500"></i>Preço Unitário';
            
            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'price-input-wrapper';
            
            const input = document.createElement('input');
            input.type = 'number';
            input.id = `preco_${categoryKey}_${itemKey}`;
            input.name = `preco_${categoryKey}_${itemKey}`;
            input.step = '0.01';
            input.min = '0';
            input.required = true;
            input.className = 'w-full border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 text-lg font-semibold py-3';
            input.value = parseFloat(currentPriceValue).toFixed(2);
            input.placeholder = '0.00';
            input.dataset.categoryKey = categoryKey;
            input.dataset.itemKey = itemKey;
            input.dataset.originalValue = parseFloat(currentPriceValue).toFixed(2);
            
            const currencyWrapper = document.createElement('div');
            currencyWrapper.className = 'currency-wrapper';
            currencyWrapper.innerHTML = '<span class="text-gray-500 font-semibold text-lg">R$</span>';
            
            const checkWrapper = document.createElement('div');
            checkWrapper.className = 'check-wrapper';
            checkWrapper.innerHTML = '<i class="fas fa-check text-success-500 text-lg"></i>';
            
            // Adicionar elementos na ordem correta
            inputWrapper.appendChild(currencyWrapper);
            inputWrapper.appendChild(input);
            inputWrapper.appendChild(checkWrapper);
            
            // Informações de valor atual
            const infoDiv = document.createElement('div');
            infoDiv.className = 'bg-gray-50 p-3 rounded-lg';
            
            const currentValueDiv = document.createElement('div');
            currentValueDiv.className = 'flex items-center justify-between text-sm';
            
            const currentLabel = document.createElement('span');
            currentLabel.className = 'text-gray-600';
            currentLabel.textContent = 'Valor atual:';
            
            const currentValueSpan = document.createElement('span');
            currentValueSpan.className = 'font-bold text-primary-600 text-lg';
            currentValueSpan.textContent = this.formatCurrency(currentPriceValue);
            
            currentValueDiv.appendChild(currentLabel);
            currentValueDiv.appendChild(currentValueSpan);
            infoDiv.appendChild(currentValueDiv);
            
            // Event listeners para os inputs
            input.addEventListener('input', () => {
                const newValue = parseFloat(input.value) || 0;
                currentValueSpan.textContent = this.formatCurrency(newValue);
                
                const originalValue = parseFloat(input.dataset.originalValue);
                if (Math.abs(newValue - originalValue) > 0.01) {
                    checkWrapper.classList.add('show');
                    cardDiv.classList.add('ring-2', 'ring-primary-200', 'bg-primary-50');
                } else {
                    checkWrapper.classList.remove('show');
                    cardDiv.classList.remove('ring-2', 'ring-primary-200', 'bg-primary-50');
                }
            });
            
            input.addEventListener('focus', () => {
                cardDiv.classList.add('ring-2', 'ring-primary-300');
            });
            
            input.addEventListener('blur', () => {
                cardDiv.classList.remove('ring-2', 'ring-primary-300');
            });
            
            // Montar estrutura final
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
                console.warn("⚠️ Formulário 'formPrecos' não encontrado");
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
                console.warn("⚠️ Botão 'resetPricesBtn' não encontrado");
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
            
            notifications.showMessage('Preços resetados para valores originais', 'info');
        }

        async saveAll() {
            const saveButton = document.querySelector('#formPrecos button[type="submit"]');
            if (!saveButton) {
                notifications.showMessage('Botão de salvar não encontrado', 'error');
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
                
                // Coletar todos os preços alterados
                const updatesByCategory = {};
                
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
                    
                    // Verificar se o preço mudou
                    const categoryData = appState.currentPrices[category] || {};
                    const itemData = categoryData[item] || {};
                    const currentPrice = itemData.preco || 0;
                    
                    if (Math.abs(price - currentPrice) > 0.01) {
                        changedCount++;
                        
                        // Agrupar por categoria
                        if (!updatesByCategory[category]) {
                            updatesByCategory[category] = {};
                        }
                        // Salvar diretamente como campo
                        updatesByCategory[category][item] = price;
                    }
                    
                    // Adicionar à estrutura de dados para salvar
                    if (!newPricesData[category]) {
                        newPricesData[category] = {};
                    }
                    
                    newPricesData[category][item] = { preco: price };
                });
                
                if (hasError) {
                    throw new Error('Alguns preços são inválidos. Verifique os campos destacados em vermelho.');
                }
                
                if (changedCount === 0) {
                    notifications.showMessage('Nenhuma alteração foi detectada nos preços.', 'info');
                    return;
                }
                
                console.log('Salvando novos preços:', updatesByCategory);
                console.log(`${changedCount} itens alterados`);
                
                // Salvar no Firebase na estrutura correta (campos diretos no documento)
                const batch = db.batch();
                
                for (const [category, updates] of Object.entries(updatesByCategory)) {
                    const docRef = db.collection('produtos').doc(category);
                    console.log(`Atualizando documento produtos/${category} com:`, updates);
                    batch.update(docRef, updates);
                }
                
                await batch.commit();
                console.log("✅ Preços salvos com sucesso no Firebase");
                
                // Atualizar o estado local
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
                
                // Atualizar valores originais nos inputs
                inputs.forEach(input => {
                    const category = input.dataset.categoryKey;
                    const item = input.dataset.itemKey;
                    
                    if (category && item && newPricesData[category] && newPricesData[category][item]) {
                        input.dataset.originalValue = newPricesData[category][item].preco.toFixed(2);
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
                
                // Mostrar mensagem de sucesso
                const mensagemSucesso = document.getElementById('precosSalvosMsg');
                if (mensagemSucesso) {
                    mensagemSucesso.classList.remove('hidden');
                    setTimeout(() => {
                        mensagemSucesso.classList.add('hidden');
                    }, 3000);
                }
                
                notifications.showMessage(`${changedCount} preço(s) alterado(s) com sucesso!`, 'success');
                
            } catch (error) {
                console.error("❌ Erro ao salvar preços:", error);
                
                // Mostrar mensagem de erro
                const mensagemErro = document.getElementById('precosErrorMsg');
                if (mensagemErro) {
                    mensagemErro.classList.remove('hidden');
                    setTimeout(() => {
                        mensagemErro.classList.add('hidden');
                    }, 3000);
                }
                
                notifications.showMessage('Erro ao salvar preços: ' + error.message, 'error');
                
            } finally {
                saveButton.disabled = false;
                saveButton.innerHTML = originalText;
            }
        }

        getDefaultPrices() {
            return {
                pasteis: {
                    carne_com_queijo: { preco: 8.00 },
                    carne: { preco: 8.00 },
                    frango_com_catupiry: { preco: 8.00 },
                    frango_com_queijo: { preco: 8.00 },
                    carioca: { preco: 8.00 },
                    pizza: { preco: 8.00 },
                    palmito: { preco: 8.00 },
                    queijo: { preco: 8.00 },
                    '4_queijos': { preco: 8.00 },
                    bauru: { preco: 8.00 },
                    calabresa: { preco: 8.00 },
                    portuguesa: { preco: 8.00 },
                    carne_seca: { preco: 10.00 },
                    especial_carne_seca: { preco: 10.00 },
                    especial_de_carne: { preco: 10.00 },
                    especial_de_calabresa: { preco: 10.00 }
                },
                casquinhas: {
                    casquinha_crua: { preco: 3.00 },
                    casquinha_frita: { preco: 4.00 }
                },
                caldo_cana: {
                    fardo_de_cana: { preco: 15.00 },
                    copo_300ml: { preco: 5.00 },
                    copo_400ml: { preco: 6.00 },
                    copo_500ml: { preco: 7.00 },
                    garrafa_500ml: { preco: 8.00 },
                    garrafa_1_litro: { preco: 12.00 }
                },
                refrigerantes: {
                    'coca-cola': { preco: 5.00 },
                    fanta_laranja: { preco: 5.00 },
                    fanta_uva: { preco: 5.00 },
                    guarana: { preco: 5.00 },
                    refri_limao: { preco: 5.00 },
                    refri_zero: { preco: 5.00 },
                    itubaina: { preco: 5.00 },
                    agua: { preco: 3.00 },
                    agua_c_gas: { preco: 4.00 },
                    cerveja_longneck: { preco: 8.00 },
                    cerveja_lata: { preco: 6.00 }
                },
                gelo: {
                    gelo_pacote: { preco: 5.00 }
                }
            };
        }

        populateWithDefaults() {
            console.log("📝 Usando preços padrão...");
            const defaultPrices = this.getDefaultPrices();
            appState.currentPrices = defaultPrices;
            
            Object.entries(this.containers).forEach(([containerId, container]) => {
                if (!container) return;
                
                const categoryKey = this.containerToCategoryMap[containerId];
                if (!categoryKey) return;
                
                const productsOriginal = this.produtosOriginais[categoryKey] || [];
                const productsKeys = this.produtosPorCategoria[categoryKey] || [];
                
                container.innerHTML = '';
                
                if (productsKeys.length === 0) {
                    container.innerHTML = '<div class="text-center p-4 text-gray-500">Nenhum produto nesta categoria</div>';
                    return;
                }
                
                productsKeys.forEach((productKey, index) => {
                    const itemKey = productKey;
                    const displayName = productsOriginal[index] || this.formatProductName(productKey);
                    const defaultPrice = (defaultPrices[categoryKey] && defaultPrices[categoryKey][itemKey]) 
                        ? defaultPrices[categoryKey][itemKey].preco 
                        : 0;
                    
                    const priceCard = this.createPriceCard(displayName, categoryKey, itemKey, defaultPrice);
                    container.appendChild(priceCard);
                });
            });
            
            this.updateCounters();
            this.setupFormHandler();
        }
    }
class UserManager {
    constructor() {
        this.container = document.getElementById('listaUsuariosContainer');
        this.form = document.getElementById('formNovoUsuario');
        this.showInactive = false;
        
        if (!this.container) {
            console.warn("Container 'listaUsuariosContainer' não encontrado");
        }
        
        if (!this.form) {
            console.warn("Formulário 'formNovoUsuario' não encontrado");
        }
    }

    async ensureUserStatusField() {
        try {
            const batch = db.batch();
            const snapshot = await db.collection('usuarios').get();
            let updated = 0;
            
            snapshot.forEach(doc => {
                const data = doc.data();
                
                if (!data.hasOwnProperty('status')) {
                    const status = (data.active === false || data.deletedAt) ? 'inativo' : 'ativo';
                    batch.update(doc.ref, { status: status });
                    updated++;
                }
            });
            
            if (updated > 0) {
                await batch.commit();
            }
        } catch (error) {
            throw error;
        }
    }

    sortUsers(sortBy, order = 'asc') {
        const compareFunction = (a, b) => {
            let valueA, valueB;
            
            switch(sortBy) {
                case 'name':
                    valueA = (a.nome || '').toLowerCase();
                    valueB = (b.nome || '').toLowerCase();
                    break;
                    
                case 'email':
                    valueA = (a.email || '').toLowerCase();
                    valueB = (b.email || '').toLowerCase();
                    break;
                    
                case 'role':
                    valueA = a.role || 'funcionario';
                    valueB = b.role || 'funcionario';
                    break;
                    
                case 'date':
                    valueA = a.createdAt?.toDate?.() || new Date(0);
                    valueB = b.createdAt?.toDate?.() || new Date(0);
                    return order === 'asc' ? valueA - valueB : valueB - valueA;
                    
                default:
                    return 0;
            }
            
            if (order === 'asc') {
                return valueA.localeCompare(valueB, 'pt-BR');
            } else {
                return valueB.localeCompare(valueA, 'pt-BR');
            }
        };
        
        appState.users.sort(compareFunction);
    }

    updateBulkActions() {
        const checkedBoxes = document.querySelectorAll('.user-checkbox:checked');
        const bulkActionsContainer = document.getElementById('bulkActions');
        
        if (bulkActionsContainer) {
            if (checkedBoxes.length > 0) {
                bulkActionsContainer.classList.remove('hidden');
                
                const counter = bulkActionsContainer.querySelector('.selected-count');
                if (counter) {
                    counter.textContent = `${checkedBoxes.length} selecionado(s)`;
                }
            } else {
                bulkActionsContainer.classList.add('hidden');
            }
        }
    }

    async fetchUsers() {
        if (!auth.currentUser) {
            throw new Error("Usuário não autenticado");
        }
        
        try {
            const snapshot = await db.collection('usuarios').get();
            const users = [];
            
            snapshot.forEach(doc => {
                const userData = doc.data();
                
                const isInactive = userData.status === 'inativo' || 
                                   userData.active === false || 
                                   userData.deletedAt !== undefined;
                
                if (!this.showInactive && isInactive) {
                    return;
                }
                
                users.push({
                    id: doc.id,
                    nome: userData.nome || userData.displayName || userData.name || 'Sem nome',
                    email: userData.email || 'Sem email',
                    role: userData.role || 'funcionario',
                    status: userData.status || (isInactive ? 'inativo' : 'ativo'),
                    createdAt: userData.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
                    deletedAt: userData.deletedAt || null
                });
            });
            
            users.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
            return users;
            
        } catch (error) {
            throw error;
        }
    }

    async reactivateUser(userId) {
        try {
            await db.collection('usuarios').doc(userId).update({
                status: 'ativo',
                active: true,
                reactivatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                reactivatedBy: auth.currentUser.uid
            });
            
            await db.collection('audit_logs').add({
                action: 'user_reactivated',
                targetUserId: userId,
                performedBy: auth.currentUser.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            notifications.showMessage('Usuário reativado com sucesso', 'success');
            await this.load();
            
        } catch (error) {
            notifications.showMessage('Erro ao reativar usuário', 'error');
            throw error;
        }
    }

    async load() {
        notifications.showMessage("Carregando usuários...", "info");
        
        this.showLoading();
        
        try {
            await this.ensureUserStatusField();
            
            const users = await this.fetchUsers();
            appState.users = users;
            
            if (users.length === 0) {
                this.showEmpty();
            } else {
                this.renderUsers();
            }
            
            this.setupFormHandler();
            this.setupPasswordHandlers();
            
            notifications.showMessage("Usuários carregados com sucesso!", "success");
            
        } catch (error) {
            notifications.showMessage(`Erro ao carregar usuários: ${error.message}`, "error");
            this.showError(error.message);
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

    showError(message) {
        if (this.container) {
            this.container.innerHTML = `
                <div class="text-center py-12 text-red-500">
                    <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-exclamation-triangle text-2xl"></i>
                    </div>
                    <p class="text-lg font-medium">Erro ao carregar usuários</p>
                    <p class="text-sm text-gray-400 mt-1">${message || "Verifique sua conexão e tente novamente"}</p>
                    <button onclick="userManager.load()" class="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600">
                        Tentar novamente
                    </button>
                </div>
            `;
        }
    }

    renderUsers() {
        if (!this.container) return;
        
        const totalCount = document.getElementById('totalUsersCount');
        if (totalCount) {
            totalCount.textContent = appState.users.length;
        }
        
        if (appState.users.length === 0) {
            this.container.innerHTML = `
                <div class="text-center py-12 text-gray-500">
                    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-users text-2xl text-gray-400"></i>
                    </div>
                    <p class="text-lg font-medium">Nenhum usuário encontrado</p>
                    <p class="text-sm text-gray-400 mt-1">
                        ${this.showInactive ? 'Não há usuários cadastrados' : 'Todos os usuários estão inativos'}
                    </p>
                </div>
            `;
            return;
        }
        
        this.container.innerHTML = appState.users.map(usuario => {
            const isInactive = usuario.status === 'inativo';
            const isCurrentUser = usuario.id === auth.currentUser.uid;
            
            return `
                <div class="glass-effect p-6 rounded-xl hover:shadow-lg transition-all duration-200 border border-gray-100 mb-4 ${isInactive ? 'opacity-60' : ''}" 
                     data-uid="${usuario.id}"
                     data-status="${usuario.status || 'ativo'}">
                     
                    <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
                        <div class="flex items-center space-x-4 flex-1">
                            ${!isCurrentUser ? `
                                <input type="checkbox" 
                                       class="user-checkbox w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" 
                                       data-uid="${usuario.id}">
                            ` : '<div class="w-4"></div>'}
                            
                            <div class="flex items-center space-x-4 flex-1">
                                <div class="w-14 h-14 bg-gradient-to-br ${isInactive ? 'from-gray-400 to-gray-500' : 'from-primary-500 to-primary-600'} rounded-full flex items-center justify-center shadow-lg">
                                    <i class="fas fa-user text-white text-lg"></i>
                                </div>
                                
                                <div class="flex-1">
                                    <h4 class="text-lg font-semibold text-gray-800 flex items-center">
                                        ${usuario.nome || 'Nome não informado'}
                                        ${isInactive ? '<span class="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">Inativo</span>' : ''}
                                        ${isCurrentUser ? '<span class="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">Você</span>' : ''}
                                    </h4>
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
                                        ${usuario.deletedAt ? `
                                            <span class="text-xs text-gray-400">
                                                <i class="fas fa-clock mr-1"></i>
                                                Inativado ${this.formatRelativeTime(usuario.deletedAt)}
                                            </span>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex items-center space-x-3">
                            ${!isCurrentUser ? `
                                ${isInactive ? `
                                    <button class="restore-user-btn bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md" 
                                            data-user-id="${usuario.id}" 
                                            data-user-name="${usuario.nome}"
                                            title="Reativar usuário">
                                        <i class="fas fa-undo mr-1"></i>Reativar
                                    </button>
                                ` : `
                                    <button class="edit-user-btn bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md" 
                                            data-user-id="${usuario.id}" 
                                            data-user-name="${usuario.nome}"
                                            data-user-role="${usuario.role}"
                                            title="Editar função do usuário">
                                        <i class="fas fa-edit mr-1"></i>Editar
                                    </button>
                                    
                                    <button class="delete-user-btn bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md" 
                                            data-user-id="${usuario.id}" 
                                            data-user-name="${usuario.nome}"
                                            data-user-email="${usuario.email}"
                                            title="Excluir usuário">
                                        <i class="fas fa-trash mr-1"></i>Excluir
                                    </button>
                                `}
                            ` : `
                                <button class="bg-gray-300 text-gray-500 px-4 py-2 rounded-lg text-sm font-medium shadow-sm cursor-not-allowed" 
                                        disabled 
                                        title="Não é possível excluir seu próprio usuário">
                                    <i class="fas fa-shield-alt mr-1"></i>Protegido
                                </button>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        this.attachEventListeners();
    }

    formatRelativeTime(timestamp) {
        if (!timestamp) return '';
        
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `há ${days} dia${days > 1 ? 's' : ''}`;
        if (hours > 0) return `há ${hours} hora${hours > 1 ? 's' : ''}`;
        if (minutes > 0) return `há ${minutes} minuto${minutes > 1 ? 's' : ''}`;
        return 'agora mesmo';
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
        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const userId = btn.dataset.userId;
                const userName = btn.dataset.userName;
                const userEmail = btn.dataset.userEmail || '';
                
                if (userId === auth.currentUser.uid) {
                    notifications.showMessage(
                        'Você não pode excluir seu próprio usuário', 
                        'warning'
                    );
                    return;
                }
                
                const confirmDelete = confirm(
                    `ATENÇÃO: Deseja excluir o usuário?\n\n` +
                    `Nome: ${userName}\n` +
                    `Email: ${userEmail}\n` +
                    `ID: ${userId.substring(0, 8)}...\n\n` +
                    `Esta ação irá:\n` +
                    `• Desativar o acesso do usuário ao sistema\n` +
                    `• Manter os registros históricos\n` +
                    `• Esta ação pode ser revertida por um administrador\n\n` +
                    `Confirmar exclusão?`
                );
                
                if (!confirmDelete) {
                    return;
                }
                
                const originalHTML = btn.innerHTML;
                const originalClasses = btn.className;
                const row = btn.closest('div[data-uid]');
                
                try {
                    btn.disabled = true;
                    btn.className = 'bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-not-allowed opacity-50';
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Excluindo...';
                    
                    if (row) {
                        row.style.opacity = '0.5';
                        row.style.pointerEvents = 'none';
                    }
                    
                    const currentUserDoc = await db.collection('usuarios').doc(auth.currentUser.uid).get();
                    if (!currentUserDoc.exists) {
                        throw new Error('Seus dados não foram encontrados. Faça login novamente.');
                    }
                    
                    const currentUserData = currentUserDoc.data();
                    if (currentUserData.role !== 'admin') {
                        throw new Error('Apenas administradores podem excluir usuários');
                    }
                    
                    const targetUserDoc = await db.collection('usuarios').doc(userId).get();
                    if (!targetUserDoc.exists) {
                        throw new Error('Usuário não encontrado. Ele pode já ter sido excluído.');
                    }
                    
                    const targetUserData = targetUserDoc.data();
                    
                    await db.collection('usuarios').doc(userId).update({
                        status: 'inativo',
                        active: false,
                        deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        deletedBy: auth.currentUser.uid,
                        deletedByEmail: auth.currentUser.email,
                        deletedByName: currentUserData.nome || auth.currentUser.email,
                        _originalData: {
                            ...targetUserData,
                            preservedAt: new Date().toISOString()
                        }
                    });
                    
                    try {
                        await db.collection('audit_logs').add({
                            action: 'user_soft_delete',
                            targetUserId: userId,
                            targetUserName: userName,
                            targetUserEmail: userEmail,
                            targetUserRole: targetUserData.role,
                            performedBy: auth.currentUser.uid,
                            performedByEmail: auth.currentUser.email,
                            performedByName: currentUserData.nome || auth.currentUser.email,
                            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                            ip: 'browser',
                            userAgent: navigator.userAgent,
                            details: {
                                method: 'soft_delete',
                                reason: 'Admin dashboard deletion',
                                canBeRestored: true
                            }
                        });
                    } catch (auditError) {
                    }
                    
                    if (row) {
                        row.style.transition = 'all 0.5s ease-out';
                        row.style.transform = 'translateX(100%)';
                        row.style.opacity = '0';
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    appState.users = appState.users.filter(u => u.id !== userId);
                    
                    notifications.showMessage(
                        `Usuário "${userName}" foi desativado com sucesso`, 
                        'success',
                        5000
                    );
                    
                    setTimeout(() => {
                        this.renderUsers();
                    }, 100);
                    
                } catch (error) {
                    if (row) {
                        row.style.opacity = '1';
                        row.style.pointerEvents = 'auto';
                        row.style.transform = 'translateX(0)';
                    }
                    
                    let errorMessage = 'Erro ao excluir usuário';
                    
                    if (error.code === 'permission-denied') {
                        errorMessage = 'Você não tem permissão para excluir usuários';
                    } else if (error.code === 'not-found') {
                        errorMessage = 'Usuário não encontrado';
                    } else if (error.message) {
                        errorMessage = error.message;
                    }
                    
                    notifications.showMessage(errorMessage, 'error', 6000);
                    
                } finally {
                    if (btn && btn.parentElement) {
                        btn.disabled = false;
                        btn.className = originalClasses;
                        btn.innerHTML = originalHTML;
                    }
                }
            });
        });
        
        document.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const userId = btn.dataset.userId;
                const userName = btn.dataset.userName;
                
                const newRole = prompt(
                    `Editar função do usuário "${userName}"\n\n` +
                    `Digite:\n` +
                    `- "admin" para Administrador\n` +
                    `- "funcionario" para Funcionário\n\n` +
                    `Função atual: ${btn.dataset.userRole || 'funcionario'}`
                );
                
                if (!newRole || (newRole !== 'admin' && newRole !== 'funcionario')) {
                    if (newRole) {
                        notifications.showMessage('Função inválida. Use "admin" ou "funcionario"', 'warning');
                    }
                    return;
                }
                
                try {
                    await db.collection('usuarios').doc(userId).update({
                        role: newRole,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedBy: auth.currentUser.uid
                    });
                    
                    notifications.showMessage(`Função de "${userName}" atualizada para ${newRole}`, 'success');
                    this.load();
                    
                } catch (error) {
                    notifications.showMessage('Erro ao editar usuário', 'error');
                }
            });
        });
        
        document.querySelectorAll('.restore-user-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const userId = btn.dataset.userId;
                const userName = btn.dataset.userName;
                
                if (!confirm(`Restaurar o usuário "${userName}"?`)) {
                    return;
                }
                
                try {
                    await db.collection('usuarios').doc(userId).update({
                        status: 'ativo',
                        active: true,
                        restoredAt: firebase.firestore.FieldValue.serverTimestamp(),
                        restoredBy: auth.currentUser.uid
                    });
                    
                    notifications.showMessage(`Usuário "${userName}" restaurado com sucesso`, 'success');
                    this.load();
                    
                } catch (error) {
                    notifications.showMessage('Erro ao restaurar usuário', 'error');
                }
            });
        });
        
        const refreshBtn = document.getElementById('refreshUsers');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const originalHTML = refreshBtn.innerHTML;
                
                refreshBtn.disabled = true;
                refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Atualizando...';
                
                try {
                    await this.load();
                    notifications.showMessage('Lista de usuários atualizada', 'success', 3000);
                } catch (error) {
                    notifications.showMessage('Erro ao atualizar lista', 'error');
                } finally {
                    refreshBtn.disabled = false;
                    refreshBtn.innerHTML = originalHTML;
                }
            });
        }
        
        const filterInput = document.getElementById('filterUsers');
        if (filterInput) {
            let filterTimeout;
            
            filterInput.addEventListener('input', (e) => {
                clearTimeout(filterTimeout);
                const searchTerm = e.target.value.toLowerCase().trim();
                
                filterTimeout = setTimeout(() => {
                    const userCards = document.querySelectorAll('[data-uid]');
                    let visibleCount = 0;
                    
                    userCards.forEach(card => {
                        const nome = (card.querySelector('h4')?.textContent || '').toLowerCase();
                        const email = (card.querySelector('p')?.textContent || '').toLowerCase();
                        const uid = card.dataset.uid.toLowerCase();
                        
                        if (!searchTerm || nome.includes(searchTerm) || email.includes(searchTerm) || uid.includes(searchTerm)) {
                            card.classList.remove('hidden');
                            card.style.display = '';
                            visibleCount++;
                        } else {
                            card.classList.add('hidden');
                            card.style.display = 'none';
                        }
                    });
                    
                    const noResultsMsg = document.getElementById('noSearchResults');
                    if (visibleCount === 0 && searchTerm) {
                        if (!noResultsMsg) {
                            const msg = document.createElement('div');
                            msg.id = 'noSearchResults';
                            msg.className = 'text-center py-8 text-gray-500';
                            msg.innerHTML = `
                                <i class="fas fa-search text-4xl mb-2"></i>
                                <p>Nenhum usuário encontrado para "${searchTerm}"</p>
                            `;
                            this.container.appendChild(msg);
                        }
                    } else if (noResultsMsg) {
                        noResultsMsg.remove();
                    }
                    
                    const counterElement = document.getElementById('userSearchCount');
                    if (counterElement) {
                        counterElement.textContent = `${visibleCount} usuário(s) encontrado(s)`;
                    }
                }, 300);
            });
            
            filterInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    filterInput.value = '';
                    filterInput.dispatchEvent(new Event('input'));
                }
            });
        }
        
        document.querySelectorAll('[data-sort]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const sortBy = btn.dataset.sort;
                const currentOrder = btn.dataset.order || 'asc';
                const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';
                
                const icon = btn.querySelector('i');
                if (icon) {
                    icon.className = newOrder === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
                }
                
                btn.dataset.order = newOrder;
                
                this.sortUsers(sortBy, newOrder);
                this.renderUsers();
                
                btn.classList.add('text-primary-600');
                setTimeout(() => btn.classList.remove('text-primary-600'), 2000);
            });
        });
        
        const toggleInactive = document.getElementById('toggleInactiveUsers');
        if (toggleInactive) {
            toggleInactive.addEventListener('change', async (e) => {
                this.showInactive = e.target.checked;
                await this.load();
                
                notifications.showMessage(
                    this.showInactive ? 'Mostrando todos os usuários' : 'Mostrando apenas usuários ativos',
                    'info',
                    3000
                );
            });
        }
        
        const selectAllCheckbox = document.getElementById('selectAllUsers');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const checkboxes = document.querySelectorAll('.user-checkbox');
                checkboxes.forEach(cb => cb.checked = e.target.checked);
                this.updateBulkActions();
            });
        }
        
        document.querySelectorAll('.user-checkbox').forEach(cb => {
            cb.addEventListener('change', () => {
                this.updateBulkActions();
            });
        });
        
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                const filterInput = document.getElementById('filterUsers');
                if (filterInput) {
                    filterInput.focus();
                    filterInput.select();
                }
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                const refreshBtn = document.getElementById('refreshUsers');
                if (refreshBtn) {
                    refreshBtn.click();
                }
            }
        });
    }

    setupFormHandler() {
        if (!this.form) return;
        
        this.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createUser();
        });
    }

    setupPasswordHandlers() {
        const btnGerarSenha = document.getElementById('btnGerarSenha');
        if (btnGerarSenha) {
            btnGerarSenha.addEventListener('click', () => {
                const senha = this.generatePassword();
                document.getElementById('novoUsuarioSenha').value = senha;
                document.getElementById('novoUsuarioConfirmarSenha').value = senha;
                notifications.showMessage(`Senha gerada: ${senha}`, 'info', 8000);
            });
        }

        const senhaInput = document.getElementById('novoUsuarioSenha');
        const confirmarSenhaInput = document.getElementById('novoUsuarioConfirmarSenha');
        
        if (confirmarSenhaInput && senhaInput) {
            confirmarSenhaInput.addEventListener('input', () => {
                if (confirmarSenhaInput.value !== senhaInput.value) {
                    confirmarSenhaInput.setCustomValidity('As senhas não coincidem');
                } else {
                    confirmarSenhaInput.setCustomValidity('');
                }
            });
        }
    }

    generatePassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%';
        let password = '';
        for (let i = 0; i < 10; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    async createUser() {
        const nomeInput = document.getElementById('novoUsuarioNome');
        const emailInput = document.getElementById('novoUsuarioEmail');
        const senhaInput = document.getElementById('novoUsuarioSenha');
        const confirmarSenhaInput = document.getElementById('novoUsuarioConfirmarSenha');
        const roleSelect = document.getElementById('novoUsuarioRole');
        
        if (!nomeInput || !emailInput || !senhaInput || !confirmarSenhaInput || !roleSelect) {
            notifications.showMessage('Formulário incompleto. Recarregue a página e tente novamente.', 'error');
            return;
        }
        
        const nome = nomeInput.value.trim();
        const email = emailInput.value.trim();
        const senha = senhaInput.value;
        const confirmarSenha = confirmarSenhaInput.value;
        const role = roleSelect.value;
        
        if (!nome || !email || !senha || !confirmarSenha) {
            notifications.showMessage('Todos os campos são obrigatórios', 'warning');
            return;
        }
        
        if (senha !== confirmarSenha) {
            notifications.showMessage('As senhas não coincidem', 'warning');
            return;
        }
        
        if (senha.length < 6) {
            notifications.showMessage('A senha deve ter no mínimo 6 caracteres', 'warning');
            return;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            notifications.showMessage('Email inválido', 'warning');
            return;
        }
        
        const submitBtn = document.getElementById('btnAdicionarUsuario');
        const buttonText = submitBtn.querySelector('.button-text');
        const spinner = document.getElementById('addUserSpinner');
        
        try {
            submitBtn.disabled = true;
            buttonText.classList.add('hidden');
            spinner.classList.remove('hidden');
            
            const secondaryApp = firebase.initializeApp(firebaseConfig, 'Secondary');
            const secondaryAuth = secondaryApp.auth();
            
            try {
                const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, senha);
                const newUser = userCredential.user;
                
                await newUser.updateProfile({
                    displayName: nome
                });
                
                await db.collection('usuarios').doc(newUser.uid).set({
                    nome: nome,
                    email: email,
                    role: role,
                    status: 'ativo',
                    active: true,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }); 
                
                await secondaryAuth.signOut();
                
                appState.users.push({
                    id: newUser.uid,
                    nome: nome,
                    email: email,
                    role: role,
                    status: 'ativo',
                    createdAt: { toDate: () => new Date() }
                });
                
                notifications.showMessage(`Usuário "${nome}" criado com sucesso!`, 'success');
                this.form.reset();
                this.renderUsers();
                
            } finally {
                await secondaryApp.delete();
            }
            
        } catch (error) {
            let errorMessage = 'Erro ao criar usuário';
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'Este email já está em uso';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Email inválido';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Senha muito fraca. Use pelo menos 6 caracteres';
                    break;
                default:
                    errorMessage = error.message || errorMessage;
            }
            
            notifications.showMessage(errorMessage, 'error');
        } finally {
            submitBtn.disabled = false;
            buttonText.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
    }
}

    // Gerenciador de Abas
    class TabManager {
        constructor() {
            this.tabs = {
                dashboard: {
                    button: document.getElementById('btnTabDashboard'),
                    content: document.getElementById('tabContentDashboard')
                },
                precos: {
                    button: document.getElementById('btnTabPrecos'),
                    content: document.getElementById('tabContentPrecos')
                },
                usuarios: {
                    button: document.getElementById('btnTabUsuarios'),
                    content: document.getElementById('tabContentUsuarios')
                }
                
            };
            
            Object.entries(this.tabs).forEach(([tabName, tab]) => {
                if (!tab.button) {
                    console.warn(`⚠️ Botão da aba '${tabName}' não encontrado`);
                }
                if (!tab.content) {
                    console.warn(`⚠️ Conteúdo da aba '${tabName}' não encontrado`);
                }
            });
            
            this.setupTabEvents();
        }

        setupTabEvents() {
            Object.entries(this.tabs).forEach(([tabName, tab]) => {
                if (tab.button) {
                    tab.button.addEventListener('click', () => {
                        this.switchTab(tabName);
                    });
                }
            });
        }

        switchTab(tabName) {
            console.log(`🔄 Trocando para aba: ${tabName}`);
            
            // Desativar todas as abas
            Object.values(this.tabs).forEach(tab => {
                if (tab.button) {
                    tab.button.classList.remove('active', 'bg-primary-500', 'text-white', 'font-semibold');
                    tab.button.classList.add('bg-gray-200', 'text-gray-700', 'font-medium');
                }
                if (tab.content) {
                    tab.content.classList.add('hidden');
                }
            });
            
            // Ativar a aba selecionada
            const selectedTab = this.tabs[tabName];
            if (selectedTab) {
                if (selectedTab.button) {
                    selectedTab.button.classList.remove('bg-gray-200', 'text-gray-700', 'font-medium');
                    selectedTab.button.classList.add('active', 'bg-primary-500', 'text-white', 'font-semibold');
                }
                if (selectedTab.content) {
                    selectedTab.content.classList.remove('hidden');
                }
                
                // Carregar dados da aba
                this.loadTabData(tabName);
            }
        }

        async loadTabData(tabName) {
            console.log(`📂 Carregando dados da aba: ${tabName}`);
            
            try {
                switch(tabName) {
                    case 'precos':
                        const priceManager = new PriceManager();
                        await priceManager.load();
                        window.priceManager = priceManager;
                        break;
                        
                    case 'usuarios':
                        const userManager = new UserManager();
                        await userManager.load();
                        window.userManager = userManager;
                        break;
                        
                    case 'dashboard':
                        notifications.showMessage("Dashboard carregado", "success");
                        break;
                }
            } catch (error) {
                console.error(`❌ Erro ao carregar dados da aba ${tabName}:`, error);
                notifications.showMessage(`Erro ao carregar aba ${tabName}: ${error.message}`, "error");
            }
        }
    }

    // Inicialização
    function initialize() {
        console.log("🚀 Inicializando o sistema administrativo...");
        
        try {
            // Inicializar gerenciador de abas
            const tabManager = new TabManager();
            window.tabManager = tabManager;
            
            // Inicializar na aba dashboard por padrão
            tabManager.switchTab('dashboard');
            document.querySelectorAll('.tab-button').forEach(button => {
                button.addEventListener('click', () => {
                    const tabName = button.id.replace('btnTab', '').toLowerCase();
                    tabManager.switchTab(tabName);
                });
            });
            const urlParams = new URLSearchParams(window.location.search);
            const tabParam = urlParams.get('tab');
            if (tabParam && ['dashboard', 'precos', 'usuarios'].includes(tabParam)) {
                tabManager.switchTab(tabParam);
            }
            notifications.showMessage("Sistema administrativo inicializado com sucesso!", "success");
        } catch (error) {
            console.error("❌ Erro na inicialização:", error);
            notifications.showMessage(`Erro na inicialização: ${error.message}`, "error");
        }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(initialize, 0);
    } else {
        document.addEventListener('DOMContentLoaded', initialize);
    }
    initialize();
});