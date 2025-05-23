// admin-controller.js - VERSÃO CORRIGIDA PARA ESTRUTURA CORRETA DO FIREBASE
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Iniciando admin-controller.js");
    
    // Verifica se os módulos Firebase estão disponíveis
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

    // Estado de autenticação
    console.log("🔍 Verificando autenticação...");
    
    // Espera a autenticação ser verificada
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
        
        console.log("✅ Usuário autenticado:", currentUser.email);
        protectRoute(['admin']);
        
    } catch (error) {
        console.error("❌ Erro ao verificar autenticação:", error);
        alert("Erro ao verificar autenticação. Tente recarregar a página.");
        return;
    }

    // Formatadores
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    // Sistema de notificações
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
            
            // Cores por tipo
            const colors = {
                success: 'border-green-500 text-green-800',
                error: 'border-red-500 text-red-800',
                warning: 'border-yellow-500 text-yellow-800',
                info: 'border-blue-500 text-blue-800'
            };
            
            // Ícones por tipo
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
            
            // Adicionar ao container
            this.container.appendChild(toast);
            
            // Botão de fechar
            toast.querySelector('button').addEventListener('click', () => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => toast.remove(), 300);
            });
            
            // Animar entrada
            setTimeout(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(0)';
            }, 10);
            
            // Auto-remover após duração
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
    window.notifications = notifications; // Disponibiliza globalmente

    // Estado da aplicação
    const appState = {
        currentPrices: {},
        users: []
    };

    // Gerenciador de Preços CORRIGIDO
    class PriceManager {
        constructor() {
            this.containers = {
                precosPasteisContainer: document.getElementById('precosPasteisContainer'),
                precosCasquinhasContainer: document.getElementById('precosCasquinhasContainer'), 
                precosCaldoCanaContainer: document.getElementById('precosCaldoCanaContainer'),
                precosRefrigerantesContainer: document.getElementById('precosRefrigerantesContainer'),
                precosGeloContainer: document.getElementById('precosGeloContainer')
            };
            
            // Verificar se todos os containers existem
            const missingContainers = Object.entries(this.containers)
                .filter(([key, element]) => !element)
                .map(([key]) => key);
                
            if (missingContainers.length > 0) {
                console.warn(`⚠️ Containers não encontrados: ${missingContainers.join(', ')}`);
            }
            
            // Lista de produtos por categoria
            this.produtosPorCategoria = {
                pasteis: [
                    "carne", "frango", "queijo", "pizza", "bauru", "calabresa", "palmito",
                    "especial_de_carne", "especial_de_frango", "especial_de_calabresa"
                ],
                casquinhas: [
                    "casquinha_simples", "casquinha_com_cobertura", "casquinha_com_granulado"
                ],
                caldo_cana: [
                    "caldo_de_cana_300ml", "caldo_de_cana_500ml", "caldo_de_cana_700ml", "caldo_de_cana_1litro"
                ],
                refrigerantes: [
                    "coca_cola_350ml", "coca_cola_600ml", "coca_cola_2l", "guarana_350ml", "guarana_600ml", 
                    "guarana_2l", "fanta_laranja_350ml", "fanta_laranja_600ml", "fanta_laranja_2l", "fanta_uva_350ml", 
                    "sprite_350ml", "agua_mineral_500ml"
                ],
                gelo: ["gelo_pacote"]
            };
            
            // Mapeamento de container para categoria
            this.containerToCategoryMap = {
                precosPasteisContainer: 'pasteis',
                precosCasquinhasContainer: 'casquinhas',
                precosCaldoCanaContainer: 'caldo_cana',
                precosRefrigerantesContainer: 'refrigerantes',
                precosGeloContainer: 'gelo'
            };
        }

        async load() {
            console.log("🔄 Iniciando carregamento de preços...");
            notifications.showMessage("Carregando preços...", "info");
            
            // Limpar containers
            this.clearContainers();
            
            try {
                // Carregar preços com a estrutura correta
                const precos = await this.fetchPrices();
                appState.currentPrices = precos;
                
                // Verificar se os preços foram carregados corretamente
                if (Object.keys(precos).length === 0) {
                    throw new Error("Nenhum preço encontrado no banco de dados");
                }
                
                console.log("✅ Preços carregados:", precos);
                
                // Preencher formulários
                this.populateForms();
                this.setupFormHandler();
                this.updateCounters();
                
                notifications.showMessage("Preços carregados com sucesso!", "success");
                
            } catch (error) {
                console.error("❌ Erro ao carregar preços:", error);
                notifications.showMessage(`Erro ao carregar preços: ${error.message}`, "error");
                
                // Fallback para preços padrão
                this.populateWithDefaults();
            }
        }

        clearContainers() {
            Object.values(this.containers).forEach(container => {
                if (container) {
                    container.innerHTML = '<div class="text-center p-4 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Carregando preços...</div>';
                }
            });
        }

        // MÉTODO CORRIGIDO PARA A ESTRUTURA REAL DO FIREBASE
        async fetchPrices() {
            console.log("🔍 Buscando preços no Firebase...");
            
            const precos = {};
            
            try {
                // Para cada categoria, buscar o documento
                const categorias = Object.keys(this.produtosPorCategoria);
                
                for (const categoria of categorias) {
                    console.log(`📂 Buscando produtos da categoria: ${categoria}`);
                    precos[categoria] = {};
                    
                    try {
                        // Buscar diretamente o documento da categoria
                        const categoriaDoc = await db.collection('produtos').doc(categoria).get();
                        
                        if (categoriaDoc.exists) {
                            const data = categoriaDoc.data();
                            console.log(`📄 Dados encontrados no documento ${categoria}:`, Object.keys(data).length, 'produtos');
                            
                            // Extrair preços do documento
                            Object.keys(data).forEach(key => {
                                if (typeof data[key] === 'object' && data[key] !== null && data[key].preco !== undefined) {
                                    precos[categoria][key] = { preco: parseFloat(data[key].preco) || 0 };
                                    console.log(`  ✓ ${key}: R$ ${data[key].preco}`);
                                } else if (typeof data[key] === 'number') {
                                    precos[categoria][key] = { preco: parseFloat(data[key]) || 0 };
                                    console.log(`  ✓ ${key}: R$ ${data[key]}`);
                                }
                            });
                        } else {
                            console.warn(`⚠️ Documento '${categoria}' não encontrado na coleção 'produtos'`);
                        }
                    } catch (error) {
                        console.error(`❌ Erro ao buscar categoria ${categoria}:`, error);
                    }
                }
                
                // Verificar se encontramos preços
                let totalProdutos = 0;
                Object.values(precos).forEach(categoria => {
                    totalProdutos += Object.keys(categoria).length;
                });
                
                console.log(`📊 Total de produtos com preços: ${totalProdutos}`);
                
                if (totalProdutos === 0) {
                    throw new Error("Nenhum produto com preço foi encontrado no banco de dados");
                }
                
                return precos;
                
            } catch (error) {
                console.error("❌ Erro ao buscar preços:", error);
                throw error;
            }
        }

        // Restante dos métodos permanece o mesmo...
        populateForms() {
            Object.entries(this.containers).forEach(([containerId, container]) => {
                if (!container) return;
                
                const categoryKey = this.containerToCategoryMap[containerId];
                if (!categoryKey) return;
                
                const products = this.produtosPorCategoria[categoryKey] || [];
                
                container.innerHTML = '';
                
                if (products.length === 0) {
                    container.innerHTML = '<div class="text-center p-4 text-gray-500">Nenhum produto nesta categoria</div>';
                    return;
                }
                
                console.log(`📋 Populando ${products.length} produtos na categoria ${categoryKey}`);
                
                products.forEach(product => {
                    const itemKey = product; // Já está no formato correto
                    
                    // Buscar preço no estado da aplicação
                    let currentPrice = 0;
                    
                    if (appState.currentPrices[categoryKey] && 
                        appState.currentPrices[categoryKey][itemKey] && 
                        appState.currentPrices[categoryKey][itemKey].preco !== undefined) {
                        currentPrice = appState.currentPrices[categoryKey][itemKey].preco;
                    }
                    
                    console.log(`  - Produto: ${product}, Key: ${itemKey}, Preço: ${currentPrice}`);
                    
                    // Formatar nome para exibição
                    const displayName = this.formatProductName(product);
                    
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
            Object.entries(this.containerToCategoryMap).forEach(([containerId, categoryKey]) => {
                const categoryId = containerId.replace('precos', '').replace('Container', '');
                
                // Tentar diferentes possibilidades de ID para o contador
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
                        break;
                    }
                }
                
                if (counterElement) {
                    const products = this.produtosPorCategoria[categoryKey] || [];
                    counterElement.textContent = products.length;
                    console.log(`📊 Contador ${counterElement.id}: ${products.length} produtos`);
                } else {
                    console.warn(`⚠️ Contador não encontrado para categoria ${categoryKey}`);
                }
            });
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

        // MÉTODO CORRIGIDO PARA SALVAR NA ESTRUTURA CORRETA
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
                        updatesByCategory[category][`${item}.preco`] = price;
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
                
                // Salvar no Firebase na estrutura correta (campos no documento)
                const batch = db.batch();
                
                for (const [category, updates] of Object.entries(updatesByCategory)) {
                    const docRef = db.collection('produtos').doc(category);
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
        }

        populateWithDefaults() {
            const defaultPrices = this.getDefaultPrices();
            
            Object.entries(this.containers).forEach(([containerId, container]) => {
                if (!container) return;
                
                const categoryKey = this.containerToCategoryMap[containerId];
                if (!categoryKey) return;
                
                const products = this.produtosPorCategoria[categoryKey] || [];
                
                container.innerHTML = '';
                
                if (products.length === 0) {
                    container.innerHTML = '<div class="text-center p-4 text-gray-500">Nenhum produto nesta categoria</div>';
                    return;
                }
                
                products.forEach(product => {
                    const itemKey = product;
                    const defaultPrice = (defaultPrices[categoryKey] && defaultPrices[categoryKey][itemKey]) 
                        ? defaultPrices[categoryKey][itemKey].preco 
                        : 0;
                    
                    const displayName = this.formatProductName(product);
                    const priceCard = this.createPriceCard(displayName, categoryKey, itemKey, defaultPrice);
                    container.appendChild(priceCard);
                });
            });
            
            this.updateCounters();
        }
    }

    // Gerenciador de Usuários CORRIGIDO
    class UserManager {
        constructor() {
            this.container = document.getElementById('listaUsuariosContainer');
            this.form = document.getElementById('formNovoUsuario');
            
            if (!this.container) {
                console.warn("⚠️ Container 'listaUsuariosContainer' não encontrado");
            }
            
            if (!this.form) {
                console.warn("⚠️ Formulário 'formNovoUsuario' não encontrado");
            }
        }

        async load() {
            console.log("🔄 Iniciando carregamento de usuários...");
            notifications.showMessage("Carregando usuários...", "info");
            
            // Mostrar carregamento
            this.showLoading();
            
            try {
                // Buscar usuários
                const users = await this.fetchUsers();
                appState.users = users;
                
                // Verificar se usuários foram carregados
                if (users.length === 0) {
                    console.warn("⚠️ Nenhum usuário encontrado");
                    this.showEmpty();
                } else {
                    console.log("✅ Usuários carregados:", users);
                    this.renderUsers();
                }
                
                // Configurar manipulador de formulário
                this.setupFormHandler();
                
                notifications.showMessage("Usuários carregados com sucesso!", "success");
                
            } catch (error) {
                console.error("❌ Erro ao carregar usuários:", error);
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

        // MÉTODO CORRIGIDO PARA BUSCAR USUÁRIOS
        async fetchUsers() {
            console.log("🔍 Buscando usuários no Firebase...");
            
            // Verificação de autenticação
            if (!auth.currentUser) {
                console.error("❌ Usuário não autenticado ao buscar usuários");
                throw new Error("Usuário não autenticado");
            }
            
            try {
                // Buscar da coleção 'usuarios'
                console.log("🔍 Buscando da coleção 'usuarios'...");
                const snapshot = await db.collection('usuarios').get();
                
                console.log(`📊 Encontrados ${snapshot.size} documentos na coleção 'usuarios'`);
                
                const users = [];
                
                snapshot.forEach(doc => {
                    const userData = doc.data();
                    
                    // Garantir que os dados tenham os campos necessários
                    users.push({
                        id: doc.id,
                        nome: userData.nome || userData.displayName || userData.name || 'Sem nome',
                        email: userData.email || 'Sem email',
                        role: userData.role || 'funcionario',
                        createdAt: userData.createdAt || firebase.firestore.Timestamp.now()
                    });
                });
                
                // Se não encontrou nenhum usuário, criar o atual como admin
                if (users.length === 0) {
                    console.log("🔨 Nenhum usuário encontrado. Criando usuário atual como admin...");
                    
                    const currentUser = auth.currentUser;
                    const currentUserData = {
                        nome: currentUser.displayName || currentUser.email || 'Administrador',
                        email: currentUser.email,
                        role: 'admin',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
                    // Salvar o usuário atual no Firestore
                    await db.collection('usuarios').doc(currentUser.uid).set(currentUserData);
                    
                    users.push({
                        id: currentUser.uid,
                        ...currentUserData,
                        createdAt: firebase.firestore.Timestamp.now()
                    });
                    
                    console.log("✅ Usuário atual salvo como admin no Firestore");
                }
                
                return users;
                
            } catch (error) {
                console.error("❌ Erro ao buscar usuários:", error);
                throw error;
            }
        }

        renderUsers() {
            if (!this.container) return;
            
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
                            
                            ${usuario.id !== auth.currentUser.uid ? `
                                <button class="delete-user-btn bg-danger-500 hover:bg-danger-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md" 
                                        data-user-id="${usuario.id}" 
                                        data-user-name="${usuario.nome}">
                                    <i class="fas fa-trash mr-1"></i>Excluir
                                </button>
                            ` : `
                                <button class="bg-gray-300 text-gray-500 px-4 py-2 rounded-lg text-sm font-medium shadow-sm cursor-not-allowed" 
                                        disabled title="Não é possível excluir seu próprio usuário">
                                    <i class="fas fa-trash mr-1"></i>Excluir
                                </button>
                            `}
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
                        notifications.showMessage('Seletor de função não encontrado', 'error');
                        return;
                    }
                    
                    const newRole = roleSelect.value;
                    
                    const originalText = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Salvando...';
                    
                    try {
                        // Atualizar no Firebase
                        await db.collection('usuarios').doc(userId).update({ role: newRole });
                        
                        // Atualizar no estado local
                        const userIndex = appState.users.findIndex(u => u.id === userId);
                        if (userIndex !== -1) {
                            appState.users[userIndex].role = newRole;
                        }
                        
                        notifications.showMessage('Função do usuário atualizada com sucesso', 'success');
                        this.renderUsers();
                        
                    } catch (error) {
                        console.error("❌ Erro ao atualizar função:", error);
                        notifications.showMessage('Erro ao atualizar função: ' + error.message, 'error');
                        
                        // Reverter a mudança no select
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
                        notifications.showMessage('Você não pode excluir seu próprio usuário', 'warning');
                        return;
                    }
                    
                    if (!confirm(`Tem certeza que deseja excluir o usuário "${userName}"?\n\nEsta ação não pode ser desfeita.`)) {
                        return;
                    }
                    
                    const originalText = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Excluindo...';
                    
                    try {
                        // Excluir no Firebase
                        await db.collection('usuarios').doc(userId).delete();
                        
                        // Atualizar no estado local
                        appState.users = appState.users.filter(u => u.id !== userId);
                        
                        notifications.showMessage(`Usuário "${userName}" excluído com sucesso`, 'success');
                        this.renderUsers();
                        
                    } catch (error) {
                        console.error("❌ Erro ao excluir usuário:", error);
                        notifications.showMessage('Erro ao excluir usuário: ' + error.message, 'error');
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
            // Verificar se os campos obrigatórios existem
            const uidInput = document.getElementById('novoUsuarioUid');
            const nomeInput = document.getElementById('novoUsuarioNome');
            const emailInput = document.getElementById('novoUsuarioEmail');
            const roleSelect = document.getElementById('novoUsuarioRole');
            
            if (!uidInput || !nomeInput || !emailInput || !roleSelect) {
                notifications.showMessage('Formulário incompleto. Recarregue a página e tente novamente.', 'error');
                return;
            }
            
            const uid = uidInput.value.trim();
            const nome = nomeInput.value.trim();
            const email = emailInput.value.trim();
            const role = roleSelect.value;
            
            if (!uid || !nome || !email) {
                notifications.showMessage('Todos os campos são obrigatórios', 'warning');
                return;
            }
            
            if (uid.length < 20) {
                notifications.showMessage('UID inválido. Certifique-se de copiar o UID completo do Firebase Console', 'warning');
                return;
            }
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                notifications.showMessage('Email inválido', 'warning');
                return;
            }
            
            const submitBtn = this.form.querySelector('button[type="submit"]');
            if (!submitBtn) {
                notifications.showMessage('Botão de envio não encontrado', 'error');
                return;
            }
            
            const originalText = submitBtn.innerHTML;
            
            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Adicionando usuário...';
                
                // Verificar se já existe um usuário com este UID
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
                
                // Salvar no Firebase
                await db.collection('usuarios').doc(uid).set(userData);
                
                // Adicionar ao estado local
                appState.users.push({
                    id: uid,
                    ...userData,
                    createdAt: { toDate: () => new Date() }
                });
                
                notifications.showMessage(`Usuário "${nome}" adicionado com sucesso`, 'success');
                this.form.reset();
                this.renderUsers();
                
            } catch (error) {
                console.error("❌ Erro ao adicionar usuário:", error);
                notifications.showMessage('Erro ao adicionar usuário: ' + error.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }
    }

    // Gerenciador de Abas Aprimorado
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
            
            // Verificar se os elementos existem
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
                        // Implementação básica do dashboard aqui
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
        console.log("🚀 Inicializando o sistema...");
        
        try {
            // Inicializar gerenciador de abas
            const tabManager = new TabManager();
            window.tabManager = tabManager;
            
            // Inicializar na aba dashboard por padrão
            tabManager.switchTab('dashboard');
            
            // Adicionar eventos para os botões de aba
            document.querySelectorAll('.tab-button').forEach(button => {
                button.addEventListener('click', () => {
                    const tabName = button.id.replace('btnTab', '').toLowerCase();
                    tabManager.switchTab(tabName);
                });
            });
            
            // Verificar URL para possível aba inicial
            const urlParams = new URLSearchParams(window.location.search);
            const tabParam = urlParams.get('tab');
            if (tabParam && ['dashboard', 'precos', 'usuarios'].includes(tabParam)) {
                tabManager.switchTab(tabParam);
            }
            
            // Mensagem de inicialização concluída
            notifications.showMessage("Sistema inicializado com sucesso!", "success");
            
        } catch (error) {
            console.error("❌ Erro na inicialização:", error);
            notifications.showMessage(`Erro na inicialização: ${error.message}`, "error");
        }
    }

    // Verificar se a página foi carregada corretamente antes de inicializar
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(initialize, 0);
    } else {
        document.addEventListener('DOMContentLoaded', initialize);
    }

    // Iniciar o sistema
    initialize();
});