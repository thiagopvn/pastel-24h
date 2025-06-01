document.addEventListener('DOMContentLoaded', async () => {
    const btnAbrirTurno = document.getElementById('btnAbrirTurno');
    const btnFecharTurno = document.getElementById('btnFecharTurno');
    const formTurno = document.getElementById('formTurno');
    const turnoStatusP = document.getElementById('turnoStatus');
    const errorMessagesP = document.getElementById('errorMessages');
    
    const turnoMesInput = document.getElementById('turnoMes');
    const turnoDataInput = document.getElementById('turnoData');
    const turnoResponsavelInput = document.getElementById('turnoResponsavel');
    const turnoHoraInput = document.getElementById('turnoHora');
    const turnoPeriodoSelect = document.getElementById('turnoPeriodo');

    const tabelaPasteisBody = document.getElementById('tabelaPasteis');
    const tabelaCasquinhasBody = document.getElementById('tabelaCasquinhas');
    const tabelaCaldoCanaBody = document.getElementById('tabelaCaldoCana');
    const tabelaRefrigerantesBody = document.getElementById('tabelaRefrigerantes');
    const tabelaGeloBody = document.getElementById('tabelaGelo'); 

    const caixaInicialDinheiroInput = document.getElementById('caixaInicialDinheiro');
    const caixaInicialMoedasInput = document.getElementById('caixaInicialMoedas');
    const caixaFinalDinheiroInput = document.getElementById('caixaFinalDinheiro');
    const caixaFinalMoedasInput = document.getElementById('caixaFinalMoedas');
    const totalVendidoTurnoCalculadoInput = document.getElementById('totalVendidoTurnoCalculado');
    const pagamentoDinheiroInput = document.getElementById('pagamentoDinheiro');
    const totalRegistradoPagamentosInput = document.getElementById('totalRegistradoPagamentos');
    const caixaFinalContadoInput = document.getElementById('caixaFinalContado');
    const caixaDiferencaInput = document.getElementById('caixaDiferenca');
    const caixaDiferencaContainer = document.getElementById('caixaDiferencaContainer'); 
    const divergenciaCaixaAlertaP = document.getElementById('divergenciaCaixaAlerta');
    const fechamentoDivergenciaAlertaGeralDiv = document.getElementById('fechamentoDivergenciaAlertaGeral');

    let currentTurnoId = localStorage.getItem('currentTurnoId');
    let productPrices = {}; 
    let turnoAbertoLocalmente = false; 
    let isInitializing = false;
    let unsubscribeTurnoListener = null;
    let turnoAnteriorData = null;
    let camposTransferidosAnterior = {};
    let funcionariosColaboradores = [];
    let listaFuncionariosDisponiveis = [];

    const LIMITES_ESTOQUE_MINIMO = {
        'fardo_de_cana': 4,
        'copo_300ml': 20,
        'copo_400ml': 20,
        'copo_500ml': 20,
        'garrafa_500ml': 6,
        'garrafa_1_litro': 6,
        'coca-cola': 12,
        'fanta_laranja': 8,
        'fanta_uva': 8,
        'guarana': 8,
        'refri_limao': 8,
        'refri_zero': 8,
        'itubaina': 8,
        'agua': 12,
        'agua_c_gas': 6,
        'cerveja_longneck': 6,
        'cerveja_lata': 6,
        'gelo_pacote': 10
    };

    async function getValoresPadraoCaixa() {
        try {
            const configDoc = await db.collection('config').doc('cashControl').get();
            
            if (configDoc.exists) {
                const data = configDoc.data();
                return {
                    dinheiro: data.dinheiro || 0,
                    moedas: data.moedas || 0
                };
            }
            
            const valoresPadrao = { dinheiro: 200, moedas: 50 };
            await db.collection('config').doc('cashControl').set({
                ...valoresPadrao,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return valoresPadrao;
        } catch (error) {
            console.error("Erro ao buscar valores padrão de caixa:", error);
            return { dinheiro: 200, moedas: 50 };
        }
    }

    function verificarEstoqueBaixo(itemKey, sobra) {
        const alertaExistente = document.getElementById(`alerta-estoque-${itemKey}`);
        if (alertaExistente) {
            alertaExistente.classList.add('removing');
            setTimeout(() => alertaExistente.remove(), 300);
        }
        
        const limite = LIMITES_ESTOQUE_MINIMO[itemKey];
        if (!limite) return;
        if (sobra === '' || sobra === null || sobra === undefined) return;
        const sobraNum = parseFloat(sobra) || 0;
        if (sobraNum < limite && sobraNum >= 0) {
            setTimeout(() => {
                const inputSobra = document.getElementById(`${itemKey}_sobra`);
                if (!inputSobra) return;
                
                const row = inputSobra.closest('tr');
                if (!row) return;
                
                if (document.getElementById(`alerta-estoque-${itemKey}`)) return;
                const alertaRow = document.createElement('tr');
                alertaRow.id = `alerta-estoque-${itemKey}`;
                alertaRow.className = 'alerta-estoque-baixo';
                alertaRow.innerHTML = `
                    <td colspan="9" class="p-0">
                        <div class="mx-4 my-2">
                            <div class="bg-gradient-to-r from-red-50 to-red-100 border border-red-300 rounded-lg p-3 shadow-md">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center">
                                        <div class="flex-shrink-0">
                                            <div class="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                                                <i class="fas fa-exclamation-triangle text-white"></i>
                                            </div>
                                        </div>
                                        <div class="ml-3">
                                            <h3 class="text-sm font-bold text-red-800 uppercase tracking-wide">
                                                ESTOQUE BAIXO, FAVOR PROVIDENCIAR REPOSIÇÃO
                                            </h3>
                                            <p class="text-xs text-red-600 mt-0.5">
                                                Quantidade atual: <span class="font-bold">${sobraNum}</span> | 
                                                Mínimo recomendado: <span class="font-bold">${limite}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <button onclick="this.closest('.alerta-estoque-baixo').classList.add('removing'); setTimeout(() => this.closest('.alerta-estoque-baixo').remove(), 300);" 
                                            class="text-red-400 hover:text-red-600 transition-colors duration-200">
                                        <i class="fas fa-times-circle text-lg"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </td>
                `;
                row.insertAdjacentElement('afterend', alertaRow);
            }, 500);
        }
    }

    function validarConsistenciaItem(itemKey, campoAlterado) {
        const entrada = parseFloat(document.getElementById(`${itemKey}_entrada`)?.value) || 0;
        const chegadas = parseFloat(document.getElementById(`${itemKey}_chegadas`)?.value) || 0;
        const sobra = parseFloat(document.getElementById(`${itemKey}_sobra`)?.value) || 0;
        const descarte = parseFloat(document.getElementById(`${itemKey}_descarte`)?.value) || 0;
        const consumo = parseFloat(document.getElementById(`${itemKey}_consumo`)?.value) || 0;
        
        const disponivel = entrada + chegadas;
        const errors = [];
        let campoCorrigido = false;
        
        if (sobra > disponivel) {
            errors.push(`Sobra (${sobra}) não pode ser maior que o disponível (${disponivel})`);
            if (campoAlterado === 'sobra') {
                document.getElementById(`${itemKey}_sobra`).value = disponivel;
                campoCorrigido = true;
            }
        }
        
        const totalSaidas = sobra + descarte + consumo;
        if (totalSaidas > disponivel) {
            const excesso = totalSaidas - disponivel;
            errors.push(`Total de saídas (${totalSaidas}) excede o disponível (${disponivel}) em ${excesso} unidades`);
            
            if (campoAlterado === 'descarte') {
                const maxDescarte = disponivel - sobra - consumo;
                document.getElementById(`${itemKey}_descarte`).value = Math.max(0, maxDescarte);
                campoCorrigido = true;
            } else if (campoAlterado === 'consumo') {
                const maxConsumo = disponivel - sobra - descarte;
                document.getElementById(`${itemKey}_consumo`).value = Math.max(0, maxConsumo);
                campoCorrigido = true;
            }
        }
        
        ['entrada', 'chegadas', 'sobra', 'descarte', 'consumo'].forEach(campo => {
            const input = document.getElementById(`${itemKey}_${campo}`);
            if (input && parseFloat(input.value) < 0) {
                errors.push(`${campo} não pode ser negativo`);
                input.value = 0;
                campoCorrigido = true;
            }
        });
        
        return { errors, campoCorrigido };
    }

    function validarConsistenciaGelo(campoAlterado) {
        const itemKey = 'gelo_pacote';
        const entrada = parseFloat(document.getElementById(`${itemKey}_entrada`)?.value) || 0;
        const chegadas = parseFloat(document.getElementById(`${itemKey}_chegadas`)?.value) || 0;
        const sobra = parseFloat(document.getElementById(`${itemKey}_sobra`)?.value) || 0;
        const vendas = parseFloat(document.getElementById(`${itemKey}_vendas`)?.value) || 0;
        
        const disponivel = entrada + chegadas;
        const errors = [];
        let campoCorrigido = false;
        
        if (sobra > disponivel) {
            errors.push(`Sobra de gelo (${sobra}) não pode ser maior que o disponível (${disponivel})`);
            if (campoAlterado === 'sobra') {
                document.getElementById(`${itemKey}_sobra`).value = disponivel;
                campoCorrigido = true;
            }
        }
        
        const maxVendas = disponivel - sobra;
        if (vendas > maxVendas) {
            errors.push(`Vendas de gelo (${vendas}) não podem exceder ${maxVendas} pacotes`);
            if (campoAlterado === 'vendas') {
                document.getElementById(`${itemKey}_vendas`).value = Math.max(0, maxVendas);
                campoCorrigido = true;
            }
        }
        
        const consumoInterno = disponivel - sobra - vendas;
        if (consumoInterno < 0) {
            errors.push(`Configuração inválida: consumo interno seria negativo (${consumoInterno})`);
            if (campoAlterado === 'vendas') {
                const maxVendasAjustado = disponivel - sobra;
                document.getElementById(`${itemKey}_vendas`).value = Math.max(0, maxVendasAjustado);
                campoCorrigido = true;
            }
        }
        
        return { errors, campoCorrigido };
    }

    function mostrarAlertaValidacao(itemKey, errors) {
        const alertaExistente = document.getElementById(`alerta-validacao-${itemKey}`);
        if (alertaExistente) {
            alertaExistente.remove();
        }
        
        if (errors.length === 0) return;
        
        const itemRow = document.querySelector(`tr[data-item-key="${itemKey}"]`);
        if (!itemRow) return;
        
        const alertaRow = document.createElement('tr');
        alertaRow.id = `alerta-validacao-${itemKey}`;
        alertaRow.className = 'alerta-validacao fade-in';
        alertaRow.innerHTML = `
            <td colspan="9" class="p-0">
                <div class="mx-4 my-2">
                    <div class="bg-gradient-to-r from-red-50 to-red-100 border border-red-400 rounded-lg p-3 shadow-md">
                        <div class="flex items-start">
                            <div class="flex-shrink-0">
                                <div class="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                                    <i class="fas fa-exclamation-triangle text-white"></i>
                                </div>
                            </div>
                            <div class="ml-3 flex-1">
                                <h3 class="text-sm font-bold text-red-800 uppercase tracking-wide mb-1">
                                    ERRO DE VALIDAÇÃO - VALORES INCONSISTENTES
                                </h3>
                                <ul class="text-xs text-red-700 space-y-1">
                                    ${errors.map(error => `<li>• ${error}</li>`).join('')}
                                </ul>
                                <p class="text-xs text-red-600 mt-2 font-medium">
                                    Os valores foram ajustados automaticamente para manter a consistência.
                                </p>
                            </div>
                            <button onclick="this.closest('.alerta-validacao').remove();" 
                                    class="text-red-400 hover:text-red-600 transition-colors duration-200 ml-2">
                                <i class="fas fa-times-circle text-lg"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </td>
        `;
        
        itemRow.insertAdjacentElement('afterend', alertaRow);
        
        setTimeout(() => {
            alertaRow.classList.add('fade-out');
            setTimeout(() => alertaRow.remove(), 300);
        }, 5000);
    }

    function validarTodosItens() {
        const errors = [];
        
        document.querySelectorAll('.item-row').forEach(row => {
            const itemKey = row.dataset.itemKey;
            if (itemKey === 'gelo_pacote') {
                const result = validarConsistenciaGelo();
                if (result.errors.length > 0) {
                    errors.push({ item: 'Gelo', errors: result.errors });
                }
            } else {
                const result = validarConsistenciaItem(itemKey, '');
                if (result.errors.length > 0) {
                    const itemName = row.querySelector('td:first-child')?.textContent || itemKey;
                    errors.push({ item: itemName, errors: result.errors });
                }
            }
        });
        
        return errors;
    }

    function adicionarIndicadorLimite(inputElement, limiteMaximo) {
        if (!inputElement) return;
        
        const wrapper = inputElement.parentElement;
        if (!wrapper) return;
        
        const indicadorExistente = wrapper.querySelector('.limite-indicador');
        if (indicadorExistente) {
            indicadorExistente.remove();
        }
        
        if (limiteMaximo <= 0) return;
        
        const indicador = document.createElement('span');
        indicador.className = 'limite-indicador absolute right-8 top-1/2 transform -translate-y-1/2 text-xs text-gray-500';
        indicador.innerHTML = `<i class="fas fa-info-circle"></i> Máx: ${limiteMaximo}`;
        
        wrapper.style.position = 'relative';
        wrapper.appendChild(indicador);
        
        const valorAtual = parseFloat(inputElement.value) || 0;
        if (valorAtual >= limiteMaximo) {
            inputElement.classList.add('at-limit');
        } else {
            inputElement.classList.remove('at-limit');
        }
    }

    function adicionarTooltipAjuda() {
    const tooltips = {
        'entrada': 'Quantidade inicial do turno (transferida do turno anterior)',
        'chegadas': 'Quantidade que chegou durante o turno',
        'sobra': 'Quantidade que sobrou no final do turno (não pode exceder entrada + chegadas)',
        'descarte': 'Quantidade descartada ou perdida durante o turno',
        'consumo': 'Quantidade consumida por funcionários',
        'vendas': 'Quantidade vendida de gelo (apenas para gelo)',
        'vendido': 'Calculado automaticamente: (entrada + chegadas) - sobra - descarte - consumo',
        'consumo_interno': 'Consumo interno de gelo (calculado automaticamente)'
    };
    
    document.querySelectorAll('input[type="number"]').forEach(input => {
        const id = input.id;
        if (!id) return;
        
        let tooltipText = '';
        Object.entries(tooltips).forEach(([key, text]) => {
            if (id.endsWith(`_${key}`)) {
                tooltipText = text;
            }
        });
        
        if (tooltipText) {
            input.title = tooltipText;
            input.setAttribute('data-tooltip', tooltipText);
            
            let th = null;
            const table = input.closest('table');
            if (table) {
                const headerText = getColumnNameFromId(id);
                const allThs = table.querySelectorAll('th');
                for (const thEl of allThs) {
                    if (thEl.textContent.includes(headerText)) {
                        th = thEl;
                        break;
                    }
                }
            }
            
            if (th && !th.querySelector('.help-icon')) {
                const helpIcon = document.createElement('span');
                helpIcon.className = 'help-icon ml-1 text-gray-400 hover:text-gray-600 cursor-help inline-block';
                helpIcon.innerHTML = '<i class="fas fa-question-circle text-xs"></i>';
                helpIcon.title = tooltipText;
                th.appendChild(helpIcon);
            }
        }
    });
    
    function getColumnNameFromId(id) {
        if (id.includes('_entrada')) return 'Entrada';
        if (id.includes('_chegadas')) return 'Chegadas';
        if (id.includes('_sobra')) return 'Sobra';
        if (id.includes('_descarte')) return 'Descarte';
        if (id.includes('_consumo_interno')) return 'Consumo Interno';
        if (id.includes('_consumo')) return 'Consumo Func.';
        if (id.includes('_vendas')) return 'Vendas';
        if (id.includes('_vendido')) return 'Vendido';
        return '';
    }
}

    function atualizarLimitesVisuais(itemKey) {
        if (!itemKey) return;
        
        const entrada = parseFloat(document.getElementById(`${itemKey}_entrada`)?.value) || 0;
        const chegadas = parseFloat(document.getElementById(`${itemKey}_chegadas`)?.value) || 0;
        const sobra = parseFloat(document.getElementById(`${itemKey}_sobra`)?.value) || 0;
        const descarte = parseFloat(document.getElementById(`${itemKey}_descarte`)?.value) || 0;
        const consumo = parseFloat(document.getElementById(`${itemKey}_consumo`)?.value) || 0;
        
        const disponivel = entrada + chegadas;
        
        if (disponivel === 0) {
            ['sobra', 'descarte', 'consumo', 'vendas'].forEach(campo => {
                const input = document.getElementById(`${itemKey}_${campo}`);
                if (input) {
                    const wrapper = input.parentElement;
                    const indicador = wrapper?.querySelector('.limite-indicador');
                    if (indicador) indicador.remove();
                }
            });
            return;
        }
        
        const sobraInput = document.getElementById(`${itemKey}_sobra`);
        if (sobraInput) {
            adicionarIndicadorLimite(sobraInput, disponivel);
        }
        
        const descarteInput = document.getElementById(`${itemKey}_descarte`);
        if (descarteInput) {
            const maxDescarte = Math.max(0, disponivel - sobra - consumo);
            adicionarIndicadorLimite(descarteInput, maxDescarte);
        }
        
        const consumoInput = document.getElementById(`${itemKey}_consumo`);
        if (consumoInput) {
            const maxConsumo = Math.max(0, disponivel - sobra - descarte);
            adicionarIndicadorLimite(consumoInput, maxConsumo);
        }
        
        if (itemKey === 'gelo_pacote') {
            const vendasInput = document.getElementById(`${itemKey}_vendas`);
            if (vendasInput) {
                const maxVendas = Math.max(0, disponivel - sobra);
                adicionarIndicadorLimite(vendasInput, maxVendas);
            }
            
            const consumoInternoInput = document.getElementById(`${itemKey}_consumo_interno`);
            if (consumoInternoInput) {
                const vendas = parseFloat(document.getElementById(`${itemKey}_vendas`)?.value) || 0;
                const consumoInterno = Math.max(0, disponivel - sobra - vendas);
                
                if (consumoInterno > 10) {
                    consumoInternoInput.classList.add('bg-yellow-100', 'border-yellow-300');
                } else {
                    consumoInternoInput.classList.remove('bg-yellow-100', 'border-yellow-300');
                }
            }
        }
        
        ['sobra', 'descarte', 'consumo', 'vendas'].forEach(campo => {
            const input = document.getElementById(`${itemKey}_${campo}`);
            if (input) {
                const valor = parseFloat(input.value) || 0;
                const wrapper = input.parentElement;
                const indicador = wrapper?.querySelector('.limite-indicador');
                
                if (indicador) {
                    const limiteTexto = indicador.textContent.match(/Máx: (\d+)/);
                    if (limiteTexto) {
                        const limite = parseInt(limiteTexto[1]);
                        if (valor >= limite) {
                            input.classList.add('at-limit');
                            indicador.classList.add('text-orange-600', 'font-semibold');
                        } else {
                            input.classList.remove('at-limit');
                            indicador.classList.remove('text-orange-600', 'font-semibold');
                        }
                    }
                }
            }
        });
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    const validarComDebounce = debounce((itemKey, campoAlterado) => {
        if (!itemKey) return;
        
        let validationResult;
        if (itemKey === 'gelo_pacote') {
            validationResult = validarConsistenciaGelo(campoAlterado);
        } else {
            validationResult = validarConsistenciaItem(itemKey, campoAlterado);
        }
        
        if (validationResult && validationResult.errors.length > 0) {
            mostrarAlertaValidacao(itemKey, validationResult.errors);
        }
        atualizarLimitesVisuais(itemKey);
    }, 500);

    function applyCurrencyMask(input) {
        let value = input.value.replace(/[^\d]/g, '');
        if (value === '') {
            input.value = formatToBRL(0);
            return 0;
        }
        let numericValue = parseFloat(value) / 100;
        input.value = formatToBRL(numericValue);
        return numericValue;
    }

    function parseCurrencyToNumber(formattedValue) {
        if (!formattedValue) return 0;
        const cleaned = formattedValue
            .replace(/[R$\s]/g, '')
            .replace(/\./g, '')
            .replace(',', '.');
        return parseFloat(cleaned) || 0;
    }

    function formatToBRL(value) {
        const numValue = parseFloat(value) || 0;
        return numValue.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    }

    function setupCurrencyMask(inputElement) {
        if (!inputElement) return;
        
        inputElement.addEventListener('input', function() {
            applyCurrencyMask(this);
            setTimeout(() => {
                updatePaymentTotalsAndDivergence();
            }, 100);
        });
        
        inputElement.addEventListener('blur', function() {
            applyCurrencyMask(this);
            updatePaymentTotalsAndDivergence();
        });
        
        if (inputElement.value && !inputElement.readOnly) {
            applyCurrencyMask(inputElement);
        }
    }

    function saveTurnoLocal(turnoData) {
        if (!turnoData) return;
        localStorage.setItem('currentTurnoId', turnoData.id);
        localStorage.setItem('turnoData', JSON.stringify(turnoData));
        currentTurnoId = turnoData.id;
    }

    function getTurnoLocal() {
        const turnoId = localStorage.getItem('currentTurnoId');
        if (!turnoId) return null;
        
        try {
            const turnoData = JSON.parse(localStorage.getItem('turnoData') || '{}');
            if (turnoData && turnoData.id === turnoId) {
                return turnoData;
            }
        } catch (e) {
            console.error("Erro ao carregar dados do turno do localStorage:", e);
        }
        return null;
    }

    function removeTurnoLocal() {
        localStorage.removeItem('currentTurnoId');
        localStorage.removeItem('turnoData');
        currentTurnoId = null;
        turnoAbertoLocalmente = false;
    }

    async function initializePage() {
        if (isInitializing) return;
        isInitializing = true;
        
        showLoadingState(true, "Carregando dados iniciais...");
        try {
            await loadProductPrices();
            populateProductTables();
            setupPriceListener();
            setupAllCurrencyMasks();
            
            await carregarListaFuncionarios();
            
            await carregarDadosTurnoAnterior();
            
            const localTurno = getTurnoLocal();
            
            if (localTurno && localTurno.status === 'aberto') {
                await checkAndSyncTurnoWithFirestore(localTurno.id);
            } else {
                await checkOpenTurnoInFirestore();
            }
            
            setupTurnoListener();
            setupEventListeners();
            adicionarTooltipAjuda();
            setInitialPeriodo();
            
            if (!turnoAbertoLocalmente && !currentTurnoId) {
                toggleFormInputs(false);
            }
        } catch (error) {
            console.error("Erro na inicialização da página:", error);
            showError("Falha ao inicializar a página. Verifique sua conexão ou contate o suporte.");
        } finally {
            showLoadingState(false);
            isInitializing = false;
        }
    }

    async function carregarListaFuncionarios() {
        try {
            if (!auth.currentUser) {
                console.error("Usuário não autenticado ao carregar funcionários");
                showError("Usuário não autenticado. Faça login novamente.");
                return;
            }

            console.log("Carregando lista de funcionários...");
            
            const snapshot = await db.collection('usuarios')
                .where('role', '==', 'funcionario')
                .get();
            
            listaFuncionariosDisponiveis = [];
            const currentUserId = auth.currentUser?.uid;
            
            if (snapshot.empty) {
                console.log("Nenhum funcionário encontrado");
                return;
            }
            
            snapshot.forEach(doc => {
                try {
                    const data = doc.data();
                    if (doc.id !== currentUserId && data) {
                        listaFuncionariosDisponiveis.push({
                            id: doc.id,
                            nome: data.nome || data.email || 'Funcionário sem nome',
                            email: data.email || ''
                        });
                    }
                } catch (err) {
                    console.error(`Erro ao processar funcionário ${doc.id}:`, err);
                }
            });
            
            console.log(`${listaFuncionariosDisponiveis.length} funcionários disponíveis carregados`);
            
        } catch (error) {
            console.error("Erro ao carregar lista de funcionários:", error);
            
            if (error.code === 'permission-denied') {
                showError("Erro de permissão ao carregar funcionários. Contate o administrador para atualizar as permissões do Firebase.");
            } else {
                showError("Erro ao carregar lista de funcionários. Verifique sua conexão.");
            }
            
            listaFuncionariosDisponiveis = [];
        }
    }

    function adicionarFuncionarioColaborador() {
        const container = document.getElementById('funcionariosColaboradoresContainer');
        if (!container) return;
        
        const funcionarioId = `funcionario_${Date.now()}`;
        
        const funcionarioDiv = document.createElement('div');
        funcionarioDiv.className = 'bg-white p-4 rounded-lg border border-gray-200 shadow-sm';
        funcionarioDiv.id = funcionarioId;
        
        const optionsHtml = listaFuncionariosDisponiveis.map(f => 
            `<option value="${f.id}">${f.nome} (${f.email})</option>`
        ).join('');
        
        funcionarioDiv.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <h4 class="text-md font-semibold text-gray-700 flex items-center">
                    <i class="fas fa-user mr-2"></i>
                    Funcionário Colaborador
                </h4>
                <button type="button" onclick="removerFuncionarioColaborador('${funcionarioId}')" 
                        class="text-red-500 hover:text-red-700 transition-colors">
                    <i class="fas fa-times-circle"></i>
                </button>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        <i class="fas fa-user-circle mr-1"></i>Selecione o Funcionário
                    </label>
                    <select id="${funcionarioId}_select" 
                            class="w-full p-2 border border-gray-300 rounded-lg focus:ring-pastel-orange-500 focus:border-pastel-orange-500">
                        <option value="">-- Selecione um funcionário --</option>
                        ${optionsHtml}
                    </select>
                </div>
                
                <div class="md:col-span-2">
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        <i class="fas fa-utensils mr-1"></i>O que consumiu? (Detalhe os itens)
                    </label>
                    <textarea id="${funcionarioId}_consumo" 
                              rows="2"
                              placeholder="Ex: 1 Pastel de Carne, 1 Caldo 300ml"
                              class="w-full p-2 border border-gray-300 rounded-lg focus:ring-pastel-orange-500 focus:border-pastel-orange-500"></textarea>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        <i class="fas fa-bus mr-1"></i>Meio de Transporte
                    </label>
                    <select id="${funcionarioId}_transporte" 
                            class="w-full p-2 border border-gray-300 rounded-lg focus:ring-pastel-orange-500 focus:border-pastel-orange-500">
                        <option value="">-- Selecione --</option>
                        <option value="onibus">Ônibus</option>
                        <option value="metro">Metrô</option>
                        <option value="trem">Trem</option>
                        <option value="carro">Carro Próprio</option>
                        <option value="moto">Moto</option>
                        <option value="bicicleta">Bicicleta</option>
                        <option value="ape">A pé</option>
                        <option value="carona">Carona</option>
                        <option value="uber">Uber/99/Táxi</option>
                    </select>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">
                        <i class="fas fa-clock mr-1"></i>Horas Trabalhadas
                    </label>
                    <input type="number" 
                           id="${funcionarioId}_horas" 
                           min="0" 
                           max="24" 
                           step="0.5"
                           placeholder="Ex: 8"
                           class="w-full p-2 border border-gray-300 rounded-lg focus:ring-pastel-orange-500 focus:border-pastel-orange-500">
                </div>
            </div>
        `;
        
        container.appendChild(funcionarioDiv);
        funcionariosColaboradores.push(funcionarioId);
    }

    window.removerFuncionarioColaborador = function(funcionarioId) {
        const elemento = document.getElementById(funcionarioId);
        if (elemento) {
            elemento.remove();
            funcionariosColaboradores = funcionariosColaboradores.filter(id => id !== funcionarioId);
        }
    }

    function coletarDadosFuncionariosColaboradores() {
        const dados = [];
        if (!funcionariosColaboradores || funcionariosColaboradores.length === 0) {
            console.log("Nenhum funcionário colaborador para coletar dados");
            return dados;
        }
        
        funcionariosColaboradores.forEach(funcionarioId => {
            try {
                const selectElement = document.getElementById(`${funcionarioId}_select`);
                const consumoElement = document.getElementById(`${funcionarioId}_consumo`);
                const transporteElement = document.getElementById(`${funcionarioId}_transporte`);
                const horasElement = document.getElementById(`${funcionarioId}_horas`);
                if (selectElement && selectElement.value) {
                    const funcionarioSelecionado = listaFuncionariosDisponiveis.find(f => f.id === selectElement.value);
                    
                    if (!funcionarioSelecionado) {
                        console.warn(`Funcionário ${selectElement.value} não encontrado na lista`);
                        return;
                    }
                    const dadosFuncionario = {
                        funcionarioId: selectElement.value,
                        funcionarioNome: funcionarioSelecionado.nome || 'Nome não disponível',
                        consumo: consumoElement?.value || '',
                        transporte: transporteElement?.value || '',
                        horasTrabalhadas: parseFloat(horasElement?.value) || 0,
                        registradoPor: {
                            id: auth.currentUser?.uid || '',
                            nome: localStorage.getItem('userName') || auth.currentUser?.email || 'Usuário desconhecido'
                        },
                        dataRegistro: new Date().toISOString()
                    };
                    if (dadosFuncionario.funcionarioId) {
                        dados.push(dadosFuncionario);
                        console.log(`Dados coletados para funcionário: ${dadosFuncionario.funcionarioNome}`);
                    }
                }
            } catch (err) {
                console.error(`Erro ao coletar dados do funcionário ${funcionarioId}:`, err);
            }
        });
        console.log(`Total de ${dados.length} funcionário(s) com dados coletados`);
        return dados;
    }

    async function salvarDadosFuncionariosColaboradores(turnoId, dadosFuncionarios) {
        if (!dadosFuncionarios || dadosFuncionarios.length === 0) return;
        
        try {
            const batch = db.batch();
            
            for (const funcionarioData of dadosFuncionarios) {
                if (!funcionarioData.funcionarioId) {
                    console.warn("Funcionário sem ID, pulando...");
                    continue;
                }
                
                const turnoRef = db.collection('turnos').doc(turnoId);
                const turnoDoc = await turnoRef.get();
                
                if (!turnoDoc.exists) {
                    throw new Error("Turno não encontrado");
                }
                
                const turnoData = turnoDoc.data();
                if (!turnoData.funcionariosColaboradores) {
                    turnoData.funcionariosColaboradores = [];
                }
                
                turnoData.funcionariosColaboradores.push({
                    funcionarioId: funcionarioData.funcionarioId,
                    funcionarioNome: funcionarioData.funcionarioNome,
                    consumo: funcionarioData.consumo,
                    transporte: funcionarioData.transporte,
                    horasTrabalhadas: funcionarioData.horasTrabalhadas,
                    registradoPor: funcionarioData.registradoPor,
                    dataRegistro: funcionarioData.dataRegistro
                });
                
                batch.update(turnoRef, {
                    funcionariosColaboradores: turnoData.funcionariosColaboradores,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            await batch.commit();
            console.log(`Dados de ${dadosFuncionarios.length} funcionário(s) colaborador(es) salvos com sucesso`);
            
        } catch (error) {
            console.error("Erro ao salvar dados dos funcionários colaboradores:", error);
            throw error;
        }
    }

    async function carregarDadosTurnoAnterior() {
        showLoadingState(true, "Verificando turnos anteriores...");
        try {
            const turnoAnteriorRef = await db.collection('turnos')
                .where('status', '==', 'fechado')
                .orderBy('fechamento.hora', 'desc')
                .limit(1)
                .get();
                
            if (!turnoAnteriorRef.empty) {
                const doc = turnoAnteriorRef.docs[0];
                turnoAnteriorData = { id: doc.id, ...doc.data() };
                console.log("Dados do turno anterior recuperados:", turnoAnteriorData.id);
                return true;
            } else {
                console.log("Nenhum turno anterior fechado encontrado");
                turnoAnteriorData = null;
                return false;
            }
        } catch (error) {
            console.error("Erro ao carregar dados do turno anterior:", error);
            turnoAnteriorData = null;
            return false;
        } finally {
            showLoadingState(false);
        }
    }

    function setupTurnoListener() {
        if (unsubscribeTurnoListener) {
            unsubscribeTurnoListener();
        }

        if (!currentTurnoId) return;

        unsubscribeTurnoListener = db.collection('turnos').doc(currentTurnoId)
            .onSnapshot((doc) => {
                if (doc.exists) {
                    const turnoData = doc.data();
                    if (turnoData.status === 'aberto') {
                        saveTurnoLocal({ id: doc.id, ...turnoData });
                        
                        if (!turnoAbertoLocalmente) {
                            loadTurnoDataToForm(turnoData);
                            populateTurnoDetails(turnoData.abertura);
                            turnoAbertoLocalmente = true;
                            toggleFormInputs(true);
                            btnAbrirTurno.disabled = true;
                            btnFecharTurno.disabled = false;
                            const periodoExibicao = currentTurnoId.split('_')[1].replace(/-/g, ' ');
                            turnoStatusP.textContent = `Turno ${periodoExibicao} de ${currentTurnoId.split('_')[0]} está aberto.`;
                            turnoStatusP.className = 'text-center text-blue-600 font-semibold mb-4';
                        }
                    } else if (turnoData.status === 'fechado') {
                        removeTurnoLocal();
                        resetFormAndState("Turno foi fechado em outro dispositivo/sessão.");
                    }
                } else {
                    removeTurnoLocal();
                    resetFormAndState("Turno não encontrado no servidor. Pode ter sido removido.");
                }
            }, (error) => {
                console.error("Erro no listener do turno:", error);
            });
    }

    async function checkAndSyncTurnoWithFirestore(turnoId) {
        try {
            const turnoDoc = await db.collection('turnos').doc(turnoId).get();
            
            if (turnoDoc.exists) {
                const turnoData = turnoDoc.data();
                
                if (turnoData.status === 'aberto') {
                    saveTurnoLocal({ id: turnoDoc.id, ...turnoData });
                    loadTurnoDataToForm(turnoData);
                    populateTurnoDetails(turnoData.abertura);
                    
                    btnAbrirTurno.disabled = true;
                    btnFecharTurno.disabled = false;
                    turnoStatusP.textContent = `Turno ${turnoId.split('_')[1]} de ${turnoId.split('_')[0]} está aberto.`;
                    turnoStatusP.className = 'text-center text-blue-600 font-semibold mb-4';
                    turnoAbertoLocalmente = true;
                    toggleFormInputs(true);
                } else {
                    removeTurnoLocal();
                    resetFormAndState("O turno foi fechado em outra sessão.");
                }
            } else {
                removeTurnoLocal();
                resetFormAndState("Turno salvo localmente não existe mais no servidor.");
            }
        } catch (error) {
            console.error("Erro ao verificar turno no Firestore:", error);
            
            const localTurno = getTurnoLocal();
            if (localTurno) {
                loadTurnoDataToForm(localTurno);
                populateTurnoDetails(localTurno.abertura);
                turnoAbertoLocalmente = true;
                toggleFormInputs(true);
                btnAbrirTurno.disabled = true;
                btnFecharTurno.disabled = false;
                turnoStatusP.textContent = `Turno ${localTurno.id.split('_')[1]} está aberto. (DADOS LOCAIS - SEM CONEXÃO)`;
                turnoStatusP.className = 'text-center text-yellow-600 font-semibold mb-4';
                showError("Usando dados locais do turno. Reconecte à internet para sincronizar.");
            } else {
                resetFormAndState("Erro ao verificar turno e nenhum dado local disponível.");
            }
        }
    }

    async function checkOpenTurnoInFirestore() {
        try {
            const user = auth.currentUser;
            if (!user) {
                showError("Usuário não autenticado. Faça login novamente.");
                return;
            }

            const turnosQuery = await db.collection('turnos')
                .where('status', '==', 'aberto')
                .where('abertura.responsavelId', '==', user.uid)
                .get();

            if (!turnosQuery.empty) {
                const turnoDoc = turnosQuery.docs[0];
                const turnoData = turnoDoc.data();
                currentTurnoId = turnoDoc.id;
                
                saveTurnoLocal({ id: turnoDoc.id, ...turnoData });
                
                loadTurnoDataToForm(turnoData);
                populateTurnoDetails(turnoData.abertura);
                
                btnAbrirTurno.disabled = true;
                btnFecharTurno.disabled = false;
                turnoStatusP.textContent = `Turno ${turnoDoc.id.split('_')[1]} de ${turnoDoc.id.split('_')[0]} está aberto.`;
                turnoStatusP.className = 'text-center text-blue-600 font-semibold mb-4';
                turnoAbertoLocalmente = true;
                toggleFormInputs(true);
            } else {
                resetFormAndState("Nenhum turno aberto encontrado.");
            }
        } catch (error) {
            console.error("Erro ao verificar turnos abertos no Firestore:", error);
            resetFormAndState("Erro ao verificar turnos abertos. Verifique sua conexão.");
        }
    }

    async function checkOpenTurno() {
        showLoadingState(true, "Verificando turno...");
        try {
            if (currentTurnoId) {
                await checkAndSyncTurnoWithFirestore(currentTurnoId);
            } else {
                await checkOpenTurnoInFirestore();
            }
        } catch (error) {
            console.error("Erro ao verificar turno aberto:", error);
            resetFormAndState("Erro ao verificar turno. Tente recarregar.");
        } finally {
            showLoadingState(false);
        }
    }

    function showLoadingState(isLoading, message = "") {
        if (isLoading) {
            turnoStatusP.textContent = message || "Processando...";
            turnoStatusP.classList.remove('text-blue-600', 'text-green-600', 'text-red-600');
            turnoStatusP.classList.add('text-gray-500');
            if(btnAbrirTurno) btnAbrirTurno.disabled = true;
            if(btnFecharTurno) btnFecharTurno.disabled = true;
        } else {
            if(btnAbrirTurno) btnAbrirTurno.disabled = !!currentTurnoId || turnoAbertoLocalmente;
            if(btnFecharTurno) btnFecharTurno.disabled = !currentTurnoId && !turnoAbertoLocalmente;
        }
    }
    
    function setInitialPeriodo() {
        if (turnoAbertoLocalmente || currentTurnoId) return;
        
        const currentHour = new Date().getHours();
        
        const turnos = [
            { value: "Manhã", inicio: 6, fim: 14 },
            { value: "Manhã-07-15", inicio: 7, fim: 15 },
            { value: "Manhã-07-19", inicio: 7, fim: 19 },
            { value: "Tarde", inicio: 14, fim: 22 },
            { value: "Tarde-14-21", inicio: 14, fim: 21 },
            { value: "Tarde-14-22", inicio: 14, fim: 22 },
            { value: "Noite", inicio: 22, fim: 6 },
            { value: "Noite-21-07", inicio: 21, fim: 7 },
            { value: "Noite-19-2330", inicio: 19, fim: 23.5 },
            { value: "Noite-19-07", inicio: 19, fim: 7 }
        ];
        
        let turnoSelecionado = "Manhã";
        
        for (const turno of turnos) {
            if (turno.inicio < turno.fim) {
                if (currentHour >= turno.inicio && currentHour < turno.fim) {
                    turnoSelecionado = turno.value;
                    break;
                }
            } else {
                if (currentHour >= turno.inicio || currentHour < turno.fim) {
                    turnoSelecionado = turno.value;
                    break;
                }
            }
        }
        
        turnoPeriodoSelect.value = turnoSelecionado;
    }

    async function loadProductPrices() {
        try {
            const snapshot = await db.collection('produtos').get();
            productPrices = {};
            
            snapshot.forEach(doc => {
                const categoria = doc.id;
                productPrices[categoria] = {};
                
                const data = doc.data();
                Object.entries(data).forEach(([key, value]) => {
                    if (typeof value === 'number') {
                        productPrices[categoria][key] = { preco: value };
                    } else if (typeof value === 'object' && value !== null) {
                        productPrices[categoria][key] = value;
                    }
                });
            });
            
            console.log("✅ Preços carregados com sucesso:", productPrices);
            
            if (Object.keys(productPrices).length === 0) {
                showError("Preços dos produtos não foram encontrados. Funcionalidades limitadas. Contate o administrador.");
                return false;
            }
            return true;
        } catch (error) {
            console.error("Erro ao carregar preços: ", error);
            showError("Erro ao carregar preços dos produtos. Tente recarregar a página.");
            return false;
        }
    }

    function setupPriceListener() {
        console.log("🔄 Configurando listener para atualizações de preços...");
        db.collection('produtos').onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'modified') {
                    const categoria = change.doc.id;
                    const data = change.doc.data();
                    
                    console.log(`✅ Atualizando preços da categoria: ${categoria}`);
                    
                    if (!productPrices[categoria]) productPrices[categoria] = {};
                    
                    Object.entries(data).forEach(([key, value]) => {
                        if (typeof value === 'number') {
                            productPrices[categoria][key] = { preco: value };
                        } else if (typeof value === 'object' && value !== null) {
                            productPrices[categoria][key] = value;
                        }
                        
                        const precoDisplay = document.getElementById(`${key}_preco_display`);
                        if (precoDisplay) {
                            const precoUnit = typeof value === 'number' ? value : (value?.preco || 0);
                            precoDisplay.textContent = formatToBRL(precoUnit);
                            
                            const vendidoInput = document.getElementById(`${key}_vendido`);
                            if (vendidoInput) {
                                vendidoInput.dataset.price = precoUnit;
                            }
                            
                            console.log(`  - ${key}: atualizado para ${formatToBRL(precoUnit)}`);
                        }
                    });
                    
                    calculateAll();
                    
                    turnoStatusP.textContent = "Preços atualizados pelo administrador. Totais recalculados.";
                    turnoStatusP.className = 'text-center text-green-600 font-semibold mb-4';
                    setTimeout(() => {
                        if (currentTurnoId) {
                            const periodoExibicao = currentTurnoId.split('_')[1].replace(/-/g, ' ');
                            turnoStatusP.textContent = `Turno ${periodoExibicao} de ${currentTurnoId.split('_')[0]} está aberto.`;
                            turnoStatusP.className = 'text-center text-blue-600 font-semibold mb-4';
                        } else {
                            turnoStatusP.textContent = "Nenhum turno aberto.";
                            turnoStatusP.className = 'text-center text-gray-600 font-semibold mb-4';
                        }
                    }, 5000);
                }
            });
        }, error => {
            console.error("Erro no listener de preços:", error);
        });
    }
    
    function populateProductTables() {
        tabelaPasteisBody.innerHTML = '';
        tabelaCasquinhasBody.innerHTML = '';
        tabelaCaldoCanaBody.innerHTML = '';
        tabelaRefrigerantesBody.innerHTML = '';
        tabelaGeloBody.innerHTML = '';

        const localListaSaboresPasteis = [
            "Carne com Queijo",
            "Carne", 
            "Frango com Catupiry",
            "Frango com Queijo",
            "Carioca",
            "Pizza",
            "Palmito",
            "Queijo",
            "4 Queijos",
            "Bauru",
            "Calabresa",
            "Portuguesa",
            "Carne Seca",
            "Especial Carne Seca",
            "Especial de Carne",
            "Especial de Calabresa"
        ];
        
        localListaSaboresPasteis.forEach((sabor, index) => {
            const key = sabor.toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[ç]/g, 'c')
                .replace(/[ãâáàä]/g, 'a')
                .replace(/[éêèë]/g, 'e')
                .replace(/[íìîï]/g, 'i')
                .replace(/[óôõòö]/g, 'o')
                .replace(/[úùûü]/g, 'u')
                .replace(/4_queijos/g, '4_queijos');
            
            const row = createProductRowWithChegadas(sabor, key, 'pasteis', productPrices, true);
            
            if (index === 12) {
                row.classList.add('border-t-4', 'border-orange-400', 'pt-2');
                
                const separatorRow = document.createElement('tr');
                separatorRow.className = 'bg-orange-100';
                separatorRow.innerHTML = `
                    <td colspan="9" class="text-center font-bold text-orange-700 py-1 text-sm">
                        === PASTÉIS ESPECIAIS ===
                    </td>
                `;
                tabelaPasteisBody.appendChild(separatorRow);
            }
            
            tabelaPasteisBody.appendChild(row);
        });

        const localListaCasquinhas = [
            "Casquinha Crua",
            "Casquinha Frita"
        ];
        
        const casquinhaTitleRow = document.createElement('tr');
        casquinhaTitleRow.className = 'bg-blue-100';
        casquinhaTitleRow.innerHTML = `
            <td colspan="9" class="text-center font-bold text-blue-700 py-1 text-sm">
                === CASQUINHAS ===
            </td>
        `;
        tabelaCasquinhasBody.appendChild(casquinhaTitleRow);
        
        localListaCasquinhas.forEach(casquinha => {
            const key = casquinha.toLowerCase().replace(/\s+/g, '_');
            const row = createProductRowWithChegadas(casquinha, key, 'casquinhas', productPrices, true);
            tabelaCasquinhasBody.appendChild(row);
        });

        const localListaCaldoCana = [
            "Fardo de Cana",
            "Copo 300ml",
            "Copo 400ml",
            "Copo 500ml", 
            "Garrafa 500ml",
            "Garrafa 1 Litro"
        ];
        
        localListaCaldoCana.forEach((item, index) => {
            const key = item.toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[ç]/g, 'c')
                .replace(/ml/g, 'ml')
                .replace(/litro/g, 'litro');
            
            const row = createProductRowWithChegadas(item, key, 'caldo_cana', productPrices, true);
            
            if (index === 0) {
                row.classList.add('bg-green-50');
            }
            
            tabelaCaldoCanaBody.appendChild(row);
        });

        const localListaRefrigerantes = [
            "Coca-Cola",
            "Fanta Laranja",
            "Fanta Uva",
            "Guaraná",
            "Refri Limão",
            "Refri. Zero",
            "Itubaina",
            "Água",
            "Água c/ Gás",
            "Cerveja Longneck",
            "Cerveja Lata"
        ];
        
        localListaRefrigerantes.forEach((item, index) => {
            const key = item.toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[ç]/g, 'c')
                .replace(/[ãâáàä]/g, 'a')
                .replace(/[éêèë]/g, 'e')
                .replace(/[íìîï]/g, 'i')
                .replace(/[óôõòö]/g, 'o')
                .replace(/[úùûü]/g, 'u')
                .replace(/\./g, '')
                .replace(/\//g, '_');
            
            const row = createProductRowWithChegadas(item, key, 'refrigerantes', productPrices, true);
            
            if (index === 9) {
                row.classList.add('border-t-2', 'border-yellow-400', 'pt-1');
                
                const beerSeparator = document.createElement('tr');
                beerSeparator.className = 'bg-yellow-50';
                beerSeparator.innerHTML = `
                    <td colspan="9" class="text-center text-yellow-700 py-1 text-xs font-medium">
                        🍺 Bebidas Alcoólicas
                    </td>
                `;
                
                tabelaRefrigerantesBody.appendChild(beerSeparator);
            }

            tabelaRefrigerantesBody.appendChild(row);
        });
        
        const geloKey = 'gelo_pacote';
        const trGelo = document.createElement('tr');
        trGelo.className = 'border-b item-row bg-blue-50 hover:bg-blue-100 transition-colors duration-150';
        trGelo.dataset.itemKey = geloKey;
        trGelo.dataset.categoryKey = 'gelo';
        
        const tdGeloName = document.createElement('td');
        tdGeloName.className = 'px-2 py-2 font-medium text-blue-800';
        tdGeloName.innerHTML = '<i class="fas fa-cube mr-1"></i>Gelo (Pacote)';
        trGelo.appendChild(tdGeloName);
        
        trGelo.appendChild(createInputCell('number', `${geloKey}_entrada`, '0', '', true, "w-full p-1 border rounded text-sm"));
        trGelo.appendChild(createInputCell('number', `${geloKey}_chegadas`, '0', '', true, "w-full p-1 border rounded text-sm col-chegadas"));
        trGelo.appendChild(createInputCell('number', `${geloKey}_sobra`, '0', '', true, "w-full p-1 border rounded text-sm"));
        
        const tdVendasGelo = createInputCell('number', `${geloKey}_vendas`, '0', '', true, "w-full p-1 border rounded text-sm");
        tdVendasGelo.querySelector('input').dataset.isGeloVenda = "true";
        trGelo.appendChild(tdVendasGelo);
        const tdConsumoGelo = createInputCell('number', `${geloKey}_consumo_interno`, '0', '', true, "w-full p-1 border rounded text-sm bg-gray-200 cursor-not-allowed");
        const consumoInput = tdConsumoGelo.querySelector('input');
        consumoInput.readOnly = true;
        consumoInput.title = "Calculado automaticamente: (Entrada + Chegadas) - Sobra - Vendas";
        trGelo.appendChild(tdConsumoGelo);
        
        const tdPrecoGelo = document.createElement('td');
        tdPrecoGelo.className = 'px-2 py-2 text-sm text-gray-600 text-center';
        const precoGeloUnit = productPrices.gelo?.[geloKey]?.preco || 0;
        tdPrecoGelo.textContent = formatToBRL(precoGeloUnit);
        tdPrecoGelo.id = `${geloKey}_preco_display`;
        trGelo.appendChild(tdPrecoGelo);
        
        const tdTotalGelo = document.createElement('td');
        tdTotalGelo.className = 'px-2 py-2 text-sm text-gray-700 font-semibold text-right';
        tdTotalGelo.id = `${geloKey}_total_item`;
        tdTotalGelo.textContent = formatToBRL(0);
        trGelo.appendChild(tdTotalGelo);
        
        tabelaGeloBody.appendChild(trGelo);
        
        console.log("✅ Tabelas populadas com sucesso!");
        console.log("📊 Resumo:");
        console.log(`  - Pastéis: ${localListaSaboresPasteis.length} itens (12 comuns + 4 especiais)`);
        console.log(`  - Casquinhas: ${localListaCasquinhas.length} itens`);
        console.log(`  - Caldo de Cana: ${localListaCaldoCana.length} itens`);
        console.log(`  - Refrigerantes: ${localListaRefrigerantes.length} itens`);
        console.log(`  - Gelo: 1 item especial`);
        
        const precosAusentes = [];
        
        localListaSaboresPasteis.forEach(sabor => {
            const key = sabor.toLowerCase().replace(/\s+/g, '_').replace(/[ç]/g, 'c')
                .replace(/[ãâáàä]/g, 'a').replace(/[éêèë]/g, 'e')
                .replace(/[íìîï]/g, 'i').replace(/[óôõòö]/g, 'o')
                .replace(/[úùûü]/g, 'u');
            if (!productPrices.pasteis?.[key]?.preco) {
                precosAusentes.push(`pasteis/${key}`);
            }
        });
        
        if (precosAusentes.length > 0) {
            console.warn("⚠️ Produtos sem preço definido:", precosAusentes);
            showError(`Atenção: ${precosAusentes.length} produtos estão sem preço definido. Contacte o administrador.`);
        }
    }

    function createSpecialProductRow(itemName, itemKey, categoryKey, prices, highlightColor = 'yellow') {
        const row = createProductRowWithChegadas(itemName, itemKey, categoryKey, prices, true);
        row.classList.add(`bg-${highlightColor}-50`, `hover:bg-${highlightColor}-100`);
        return row;
    }

    function addSubtotalRow(tableBody, label, idPrefix) {
        const subtotalRow = document.createElement('tr');
        subtotalRow.className = 'bg-gray-100 font-semibold';
        subtotalRow.innerHTML = `
            <td colspan="6" class="px-3 py-2 text-right">${label}:</td>
            <td id="${idPrefix}Vendido" class="px-2 py-2 text-center">0</td>
            <td></td>
            <td id="${idPrefix}Valor" class="px-2 py-2 text-right">R$ 0,00</td>
        `;
        tableBody.appendChild(subtotalRow);
        return subtotalRow;
    }

    function createProductRowWithChegadas(itemName, itemKey, categoryKey, prices, isReadOnly = false) {
        const tr = document.createElement('tr');
        tr.className = 'border-b item-row hover:bg-orange-50 transition-colors duration-150';
        tr.dataset.itemKey = itemKey;
        tr.dataset.categoryKey = categoryKey;

        const tdName = document.createElement('td');
         tdName.className = 'px-3 py-2 font-medium text-gray-800 sticky left-0 bg-white z-5';
        tdName.textContent = itemName;
        tr.appendChild(tdName);

        tr.appendChild(createInputCell('number', `${itemKey}_entrada`, '0', '', isReadOnly));
        
        const tdChegadas = createInputCell('number', `${itemKey}_chegadas`, '0', '', isReadOnly, "w-full p-1 border rounded text-sm");
        tdChegadas.classList.add('col-chegadas');
        tr.appendChild(tdChegadas);
        
        tr.appendChild(createInputCell('number', `${itemKey}_sobra`, '0', '', isReadOnly));
        tr.appendChild(createInputCell('number', `${itemKey}_descarte`, '0', '', isReadOnly));
        tr.appendChild(createInputCell('number', `${itemKey}_consumo`, '0', '', isReadOnly));
        
        const tdVendido = document.createElement('td');
        tdVendido.className = 'px-1 py-1';
        const inputVendido = document.createElement('input');
        inputVendido.type = 'number';
        inputVendido.id = `${itemKey}_vendido`;
        inputVendido.name = `${itemKey}_vendido`;
        inputVendido.className = 'w-full p-1 border border-gray-300 rounded text-sm bg-gray-100 cursor-not-allowed shadow-sm';
        inputVendido.readOnly = true;
        inputVendido.value = '0';
        inputVendido.dataset.price = prices[categoryKey]?.[itemKey]?.preco || 0;
        tdVendido.appendChild(inputVendido);
        tr.appendChild(tdVendido);

        const tdPreco = document.createElement('td');
        tdPreco.className = 'px-3 py-2 text-sm text-gray-600 text-center';
        const precoUnit = prices[categoryKey]?.[itemKey]?.preco || 0;
        tdPreco.textContent = formatToBRL(parseFloat(precoUnit));
        tdPreco.id = `${itemKey}_preco_display`;
        tr.appendChild(tdPreco);
        
        const tdTotalItem = document.createElement('td');
        tdTotalItem.className = 'px-3 py-2 text-sm text-gray-700 font-semibold text-right';
        tdTotalItem.id = `${itemKey}_total_item`;
        tdTotalItem.textContent = formatToBRL(0);
        tr.appendChild(tdTotalItem);

        return tr;
    }

    function adicionarIndicadorCampoTransferido(elemento, origem) {
        if (!elemento) return;
        
        elemento.classList.add('campo-transferido', 'bg-blue-50', 'border-blue-300');
        
        elemento.dataset.transferidoDoTurno = origem || 'turno-anterior';
        elemento.dataset.valorOriginal = elemento.value;
        
        elemento.readOnly = true;
        
        let wrapper = elemento.parentElement;
        if (!wrapper.classList.contains('campo-bloqueado-wrapper')) {
            wrapper = document.createElement('div');
            wrapper.className = 'campo-bloqueado-wrapper';
            
            elemento.parentNode.insertBefore(wrapper, elemento);
            wrapper.appendChild(elemento);
            
            const lockIcon = document.createElement('i');
            lockIcon.className = 'fas fa-lock lock-icon';
            lockIcon.title = 'Valor transferido do turno anterior - Não editável';
            wrapper.appendChild(lockIcon);
        }
        
        const containerPai = wrapper.parentElement;
        if (containerPai && !containerPai.querySelector('.indicador-transferido')) {
            const indicador = document.createElement('span');
            indicador.className = 'indicador-transferido text-xs text-blue-600 ml-1';
            indicador.innerHTML = '<i class="fas fa-exchange-alt"></i>';
            indicador.title = 'Valor transferido do turno anterior';
            containerPai.appendChild(indicador);
        }
        
        const campoId = elemento.id || `campo-${Math.random().toString(36).substring(2, 9)}`;
        camposTransferidosAnterior[campoId] = {
            elemento: elemento,
            valorOriginal: elemento.value
        };
    }

    function toggleFormInputs(isTurnoOpenForEditing) {
        const allInputsAndSelects = formTurno.querySelectorAll('input, select');
        allInputsAndSelects.forEach(el => {
            if (el.id === 'turnoPeriodo') {
                el.disabled = isTurnoOpenForEditing;
                if(el.disabled) el.classList.add('bg-gray-200'); else el.classList.remove('bg-gray-200');
                return;
            }
            if (['turnoMes', 'turnoData', 'turnoResponsavel', 'turnoHora'].includes(el.id)) {
                el.classList.add('bg-gray-100');
                return;
            }
            if (el.id.endsWith('_vendido') || el.id.endsWith('_total_item')) {
                el.readOnly = true;
                el.classList.add('bg-gray-100');
                return;
            }
            if (el.id === 'gelo_pacote_consumo_interno') {
                el.readOnly = true;
                el.classList.add('bg-gray-200', 'cursor-not-allowed');
                return;
            }
            
            if (el.dataset.transferidoDoTurno) {
                el.readOnly = true;
                return;
            }

            el.readOnly = !isTurnoOpenForEditing;
            if (el.readOnly) {
                el.classList.add('bg-gray-100');
                el.classList.remove('focus:ring-orange-500', 'focus:border-orange-500');
            } else {
                el.classList.remove('bg-gray-100');
                el.classList.add('focus:ring-orange-500', 'focus:border-orange-500');
            }
        });
        if (turnoAbertoLocalmente || currentTurnoId) {
            if(caixaInicialDinheiroInput) {
                caixaInicialDinheiroInput.readOnly = true;
                caixaInicialDinheiroInput.classList.add('bg-gray-100');
            }
            if(caixaInicialMoedasInput) {
                caixaInicialMoedasInput.readOnly = true;
                caixaInicialMoedasInput.classList.add('bg-gray-100');
            }
            
            document.querySelectorAll('input[id$="_entrada"]').forEach(inp => {
                inp.readOnly = true;
                inp.classList.add('bg-gray-100');
            });
            
            document.querySelectorAll('input[id$="_chegadas"]').forEach(inp => {
                if (!inp.dataset.transferidoDoTurno) {
                    inp.readOnly = false;
                    inp.classList.remove('bg-gray-100');
                    inp.classList.add('focus:ring-orange-500', 'focus:border-orange-500');
                }
            });
        } else {
            if(caixaInicialDinheiroInput) {
                caixaInicialDinheiroInput.readOnly = false;
                caixaInicialDinheiroInput.classList.remove('bg-gray-100');
            }
            if(caixaInicialMoedasInput) {
                caixaInicialMoedasInput.readOnly = false;
                caixaInicialMoedasInput.classList.remove('bg-gray-100');
            }
            document.querySelectorAll('input[id$="_entrada"], input[id$="_chegadas"]').forEach(inp => {
                if (!inp.dataset.transferidoDoTurno) {
                    inp.readOnly = false;
                    inp.classList.remove('bg-gray-100');
                }
            });
        }
    }
    
    function resetFormAndState(statusMessage = 'Nenhum turno aberto.') {
        formTurno.reset();
        setInitialPeriodo();
        turnoMesInput.value = '';
        turnoDataInput.value = '';
        turnoResponsavelInput.value = '';
        turnoHoraInput.value = '';
        
        btnAbrirTurno.disabled = false;
        btnFecharTurno.disabled = true;
        removeTurnoLocal();
        turnoAbertoLocalmente = false;
        
        turnoStatusP.textContent = statusMessage;
        if (statusMessage.toLowerCase().includes("erro")) {
            turnoStatusP.className = 'text-center text-red-600 font-semibold mb-4';
        } else {
            turnoStatusP.className = 'text-center text-gray-600 font-semibold mb-4';
        }

        clearError();
        toggleFormInputs(false); 
        
        document.querySelectorAll('input[id$="_vendido"]').forEach(el => el.value = '0');
        document.querySelectorAll('input[id$="_chegadas"]').forEach(el => el.value = '0');
        document.querySelectorAll('td[id$="_total_item"]').forEach(el => el.textContent = formatToBRL(0));
        if(totalVendidoTurnoCalculadoInput) totalVendidoTurnoCalculadoInput.value = formatToBRL(0);
        if(totalRegistradoPagamentosInput) totalRegistradoPagamentosInput.value = formatToBRL(0);
        if(caixaDiferencaInput) caixaDiferencaInput.value = formatToBRL(0);
        if(caixaDiferencaContainer) caixaDiferencaContainer.className = "p-3 rounded-md";

        document.querySelectorAll('td[id^="total"]').forEach(el => {
            if (el.id.includes('Vendido')) el.textContent = '0';
            else if (el.id.includes('Valor')) el.textContent = formatToBRL(0);
        });
        if (divergenciaCaixaAlertaP) divergenciaCaixaAlertaP.textContent = '';
        if (fechamentoDivergenciaAlertaGeralDiv) fechamentoDivergenciaAlertaGeralDiv.classList.add('hidden');
        if (fechamentoDivergenciaAlertaGeralDiv) fechamentoDivergenciaAlertaGeralDiv.textContent = '';
        
        const geloKey = 'gelo_pacote';
        const totalGeloDisplay = document.getElementById(`${geloKey}_total_item`);
        if (totalGeloDisplay) totalGeloDisplay.textContent = formatToBRL(0);
        const totalFooterGelo = document.getElementById('totalGeloValor');
        if (totalFooterGelo) totalFooterGelo.textContent = formatToBRL(0);
        
        document.querySelectorAll('.indicador-transferido').forEach(el => el.remove());
        document.querySelectorAll('[data-transferido-do-turno]').forEach(el => {
            el.removeAttribute('data-transferido-do-turno');
            el.removeAttribute('data-valor-original');
            el.classList.remove('bg-blue-50', 'border-blue-300');
        });
        camposTransferidosAnterior = {};
        funcionariosColaboradores = [];
        const containerFuncionarios = document.getElementById('funcionariosColaboradoresContainer');
        if (containerFuncionarios) {
            containerFuncionarios.innerHTML = '';
        }
        
        document.querySelectorAll('.alerta-estoque-baixo').forEach(alerta => {
            alerta.remove();
        });
        
        calculateAll();
    }
    
    function populateTurnoDetails(aberturaData) {
        turnoMesInput.value = aberturaData.mes;
        turnoDataInput.value = aberturaData.data;
        turnoResponsavelInput.value = aberturaData.responsavelNome;
        turnoHoraInput.value = aberturaData.hora;
        turnoPeriodoSelect.value = aberturaData.periodo;
        turnoPeriodoSelect.disabled = true;
        turnoPeriodoSelect.classList.add('bg-gray-200');
    }

    function updatePaymentTotalsAndDivergence() {
        console.log("🔄 Atualizando totais de pagamento e divergências...");
        
        const paymentInputs = {
            dinheiro: document.getElementById('pagamentoDinheiro'),
            pixManual: document.getElementById('pagamentoPixManual'),
            stoneDCV: document.getElementById('pagamentoStoneDCV'),
            stoneVoucher: document.getElementById('pagamentoStoneVoucher'),
            pagbankDCV: document.getElementById('pagamentoPagBankDCV')
        };
        
        let totalRegistrado = 0;
        const paymentValues = {};
        
        Object.entries(paymentInputs).forEach(([key, input]) => {
            if (input) {
                const value = parseCurrencyToNumber(input.value);
                paymentValues[key] = value;
                totalRegistrado += value;
            }
        });
        
        if (totalRegistradoPagamentosInput) {
            totalRegistradoPagamentosInput.value = formatToBRL(totalRegistrado);
        }
        
        const totalVendido = parseCurrencyToNumber(totalVendidoTurnoCalculadoInput?.value || '0');
        const divergenciaVendas = totalVendido - totalRegistrado;
        
        console.log(`📊 Total Vendido: ${formatToBRL(totalVendido)}`);
        console.log(`💰 Total Registrado: ${formatToBRL(totalRegistrado)}`);
        console.log(`⚖️ Divergência: ${formatToBRL(divergenciaVendas)}`);
        
        updateSalesDivergenceDisplay(divergenciaVendas, totalVendido, totalRegistrado);
        
        updatePhysicalCashDifference();
        
        return {
            totalRegistrado,
            totalVendido,
            divergenciaVendas,
            paymentValues
        };
    }

    function updateSalesDivergenceDisplay(divergencia, totalVendido, totalRegistrado) {
        let alertContainer = document.getElementById('salesDivergenceAlert');
        
        if (!alertContainer) {
            alertContainer = document.createElement('div');
            alertContainer.id = 'salesDivergenceAlert';
            alertContainer.className = 'mt-4 p-4 rounded-lg border';
            
            const totalRegistradoParent = totalRegistradoPagamentosInput?.parentElement?.parentElement;
            if (totalRegistradoParent) {
                totalRegistradoParent.insertAdjacentElement('afterend', alertContainer);
            }
        }
        
        if (Math.abs(divergencia) < 0.01) {
            alertContainer.className = 'mt-4 p-4 rounded-lg border bg-green-50 border-green-300';
            alertContainer.innerHTML = `
                <div class="flex items-center text-green-700">
                    <i class="fas fa-check-circle mr-2 text-lg"></i>
                    <div>
                        <strong>✅ Valores conferem perfeitamente!</strong>
                        <div class="text-sm mt-1">
                            Vendas: ${formatToBRL(totalVendido)} = Pagamentos: ${formatToBRL(totalRegistrado)}
                        </div>
                    </div>
                </div>
            `;
        } else if (divergencia > 0) {
            alertContainer.className = 'mt-4 p-4 rounded-lg border bg-red-50 border-red-300';
            alertContainer.innerHTML = `
                <div class="text-red-700">
                    <div class="flex items-center mb-2">
                        <i class="fas fa-exclamation-triangle mr-2 text-lg"></i>
                        <strong>🚨QUEBRA DE CAIXA. DIVERGÊNCIA DETECTADA! FAVOR REVISAR AS CONTAGENS</strong>
                    </div>
                    <div class="text-sm bg-white bg-opacity-50 p-3 rounded">
                        <div class="grid grid-cols-2 gap-2">
                            <div>📈 <strong>Total Vendido:</strong></div>
                            <div>${formatToBRL(totalVendido)}</div>
                            <div>💳 <strong>Total Pagamentos:</strong></div>
                            <div>${formatToBRL(totalRegistrado)}</div>
                            <div>⚖️ <strong>Diferença:</strong></div>
                            <div class="font-bold text-red-600">${formatToBRL(Math.abs(divergencia))} (faltam nos pagamentos)</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            alertContainer.className = 'mt-4 p-4 rounded-lg border bg-green-50 border-green-300';
            alertContainer.innerHTML = `
                <div class="flex items-center text-green-700">
                    <i class="fas fa-check-circle mr-2 text-lg"></i>
                    <div>
                        <strong>✅ Valores conferem perfeitamente</strong>
                        <div class="text-sm mt-1">
                            Vendas: ${formatToBRL(totalVendido)} | Pagamentos: ${formatToBRL(totalRegistrado)}
                        </div>
                    </div>
                </div>
            `;
        }
    }

    function updatePhysicalCashDifference() {
        console.log("🏦 Atualizando diferença de caixa físico...");
        
        const caixaInicialDinheiro = parseCurrencyToNumber(caixaInicialDinheiroInput?.value || '0');
        const caixaInicialMoedas = parseCurrencyToNumber(caixaInicialMoedasInput?.value || '0');
        const caixaInicial = caixaInicialDinheiro + caixaInicialMoedas;
        
        const pagamentoDinheiro = parseCurrencyToNumber(pagamentoDinheiroInput?.value || '0');
        
        const caixaFinalDinheiro = parseCurrencyToNumber(caixaFinalDinheiroInput?.value || '0');
        const caixaFinalMoedas = parseCurrencyToNumber(caixaFinalMoedasInput?.value || '0');
        const caixaFinalContado = caixaFinalDinheiro + caixaFinalMoedas;
        const caixaEsperado = caixaInicial + pagamentoDinheiro;
        const diferencaCaixa = caixaFinalContado - caixaEsperado;
        
        console.log(`💰 Caixa Inicial: Dinheiro ${formatToBRL(caixaInicialDinheiro)} + Moedas ${formatToBRL(caixaInicialMoedas)} = ${formatToBRL(caixaInicial)}`);
        console.log(`💵 Pagamento Dinheiro: ${formatToBRL(pagamentoDinheiro)}`);
        console.log(`🎯 Caixa Esperado: ${formatToBRL(caixaEsperado)}`);
        console.log(`🔢 Caixa Contado: Dinheiro ${formatToBRL(caixaFinalDinheiro)} + Moedas ${formatToBRL(caixaFinalMoedas)} = ${formatToBRL(caixaFinalContado)}`);
        console.log(`⚖️ Diferença: ${formatToBRL(diferencaCaixa)}`);
        if (caixaDiferencaInput) {
            caixaDiferencaInput.value = formatToBRL(diferencaCaixa);
        }
        checkForLowCashValues(caixaFinalDinheiro, caixaFinalMoedas);
        
        if (caixaDiferencaContainer && divergenciaCaixaAlertaP) {
            if (Math.abs(diferencaCaixa) < 0.01) {
                caixaDiferencaContainer.className = 'p-4 rounded-lg bg-green-50 border border-green-300';
                divergenciaCaixaAlertaP.className = 'text-sm mt-2 text-green-700 font-medium';
                divergenciaCaixaAlertaP.innerHTML = `
                    <i class="fas fa-check-circle mr-1"></i>
                    ✅ Caixa físico confere perfeitamente! (${formatToBRL(caixaFinalContado)})
                `;
            } else if (diferencaCaixa < 0) {
                caixaDiferencaContainer.className = 'p-4 rounded-lg bg-red-50 border border-red-300';
                divergenciaCaixaAlertaP.className = 'text-sm mt-2 text-red-700 font-medium';
                divergenciaCaixaAlertaP.innerHTML = `
                    <i class="fas fa-exclamation-triangle mr-1"></i>
                    🚨 Falta de ${formatToBRL(Math.abs(diferencaCaixa))} no caixa físico. Favor revisar a contagem.
                    <br><small class="opacity-75">Esperado: ${formatToBRL(caixaEsperado)} | Contado: ${formatToBRL(caixaFinalContado)}</small>
                `;
            } else {
                caixaDiferencaContainer.className = 'p-4 rounded-lg bg-green-50 border border-green-300';
                divergenciaCaixaAlertaP.className = 'text-sm mt-2 text-green-700 font-medium';
                divergenciaCaixaAlertaP.innerHTML = `
                    <i class="fas fa-check-circle mr-1"></i>
                    ✅ Sobra de ${formatToBRL(diferencaCaixa)} no caixa. 
                    <br><small class="opacity-75">Esperado: ${formatToBRL(caixaEsperado)} | Contado: ${formatToBRL(caixaFinalContado)}</small>
                `;
            }
        }
        return {
            caixaInicial,
            caixaInicialDinheiro,
            caixaInicialMoedas,
            pagamentoDinheiro,
            caixaEsperado,
            caixaFinalContado,
            caixaFinalDinheiro,
            caixaFinalMoedas,
            diferencaCaixa,
            isValid: diferencaCaixa >= -0.01
        };
    }

    function checkForLowCashValues(dinheiro, moedas) {
        const dinheiroInput = document.getElementById('caixaFinalDinheiro');
        const moedasInput = document.getElementById('caixaFinalMoedas');
        
        removeExistingCashAlerts();
        
        if (dinheiro < 200) {
            showLowCashAlert(dinheiroInput, 'dinheiro', dinheiro);
        }
        
        if (moedas < 20) {
            showLowCashAlert(moedasInput, 'moedas', moedas);
        }
    }

    function removeExistingCashAlerts() {
        document.querySelectorAll('.cash-alert').forEach(alert => {
            alert.remove();
        });
        
        const dinheiroInput = document.getElementById('caixaFinalDinheiro');
        const moedasInput = document.getElementById('caixaFinalMoedas');
        
        if (dinheiroInput) {
            dinheiroInput.classList.remove('border-red-500', 'bg-red-50');
        }
        
        if (moedasInput) {
            moedasInput.classList.remove('border-red-500', 'bg-red-50');
        }
    }

    function showLowCashAlert(inputElement, type, value) {
        if (!inputElement) return;
        
        inputElement.classList.add('border-red-500', 'bg-red-50');
        
        const alertDiv = document.createElement('div');
        alertDiv.className = 'cash-alert mt-2 p-2 bg-red-100 text-red-800 text-xs rounded flex items-start';
        alertDiv.dataset.alertType = type;
        
        const icon = type === 'dinheiro' ? 'fa-money-bill-wave' : 'fa-coins';
        const typeName = type === 'dinheiro' ? 'Dinheiro' : 'Moedas';
        const threshold = type === 'dinheiro' ? 'R$ 200,00' : 'R$ 20,00';
        
        alertDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle mt-0.5 mr-1"></i>
            <div>
                <strong>Alerta: ${typeName} abaixo do recomendado!</strong><br>
                Valor atual: ${formatToBRL(value)}<br>
                Valor mínimo recomendado: ${threshold}
            </div>
        `;
        
        const parent = inputElement.parentElement;
        if (parent) {
            parent.appendChild(alertDiv);
        }
    }

    function setupAllCurrencyMasks() {
        
         const currencyFields = [
            'caixaInicialDinheiro',
            'caixaInicialMoedas',
            'pagamentoDinheiro',
            'pagamentoPixManual', 
            'pagamentoStoneDCV',
            'pagamentoStoneVoucher',
            'pagamentoPagBankDCV',
            'caixaFinalDinheiro',
            'caixaFinalMoedas'
        ];
        
        currencyFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                setupCurrencyMask(field);
                console.log(`✅ Máscara configurada para: ${fieldId}`);
            }
        });
    }

    if (btnAbrirTurno) {
        btnAbrirTurno.addEventListener('click', async () => {
            clearError();
            
            const caixaInicialDinheiro = parseCurrencyToNumber(caixaInicialDinheiroInput?.value || '0');
            const caixaInicialMoedas = parseCurrencyToNumber(caixaInicialMoedasInput?.value || '0');
            
            if (isNaN(caixaInicialDinheiro) || caixaInicialDinheiro < 0) {
                showError("Valor de dinheiro inicial inválido. Por favor, insira um valor numérico positivo ou zero.");
                caixaInicialDinheiroInput?.focus();
                caixaInicialDinheiroInput?.classList.add('border-red-500');
                return;
            }
            
            if (isNaN(caixaInicialMoedas) || caixaInicialMoedas < 0) {
                showError("Valor de moedas inicial inválido. Por favor, insira um valor numérico positivo ou zero.");
                caixaInicialMoedasInput?.focus();
                caixaInicialMoedasInput?.classList.add('border-red-500');
                return;
            }
            
            caixaInicialDinheiroInput?.classList.remove('border-red-500');
            caixaInicialMoedasInput?.classList.remove('border-red-500');

            const dataAtual = getFormattedDate();
            const periodoSelecionado = turnoPeriodoSelect.value;
            const turnoIdProposto = `${dataAtual}_${periodoSelecionado}`;

            showLoadingState(true, "Abrindo turno...");

            try {
                await db.runTransaction(async (transaction) => {
                    const turnoRef = db.collection('turnos').doc(turnoIdProposto);
                    const turnoDoc = await transaction.get(turnoRef);
                    
                    if (turnoDoc.exists) {
                        throw new Error(`Já existe um turno (${periodoSelecionado}) registrado para hoje (${dataAtual}).`);
                    }
                    
                    const user = auth.currentUser;
                    if (!user) {
                        throw new Error("Usuário não logado. Faça login novamente.");
                    }
                    
                    const turnosQuery = await db.collection('turnos')
                        .where('status', '==', 'aberto')
                        .where('abertura.responsavelId', '==', user.uid)
                        .get();
                    
                    if (!turnosQuery.empty) {
                        throw new Error("Você já possui um turno aberto. Feche-o antes de abrir um novo.");
                    }
                    
                    return true;
                });
                
                const user = auth.currentUser;
                if (!user) {
                    showError("Usuário não logado. Faça login novamente.");
                    showLoadingState(false);
                    btnAbrirTurno.disabled = false;
                    return;
                }
                
                const responsavelNome = localStorage.getItem('userName') || user.displayName || user.email;
                const aberturaDataObj = {
                    mes: getCurrentMonth(),
                    data: dataAtual,
                    responsavelId: user.uid,
                    responsavelNome: responsavelNome,
                    hora: getFormattedTime(),
                    periodo: periodoSelecionado,
                };

                populateTurnoDetails(aberturaDataObj);

                const estoqueAnterior = await getEstoqueInicial(dataAtual, periodoSelecionado);
                
                let valorInicialDinheiro = caixaInicialDinheiro;
                let valorInicialMoedas = caixaInicialMoedas;
                
                if (estoqueAnterior.caixaFinalDinheiro !== null && estoqueAnterior.caixaFinalMoedas !== null) {
                    valorInicialDinheiro = estoqueAnterior.caixaFinalDinheiro;
                    valorInicialMoedas = estoqueAnterior.caixaFinalMoedas;
                    
                    caixaInicialDinheiroInput.value = formatToBRL(valorInicialDinheiro);
                    caixaInicialMoedasInput.value = formatToBRL(valorInicialMoedas);
                    
                    adicionarIndicadorCampoTransferido(caixaInicialDinheiroInput, estoqueAnterior.turnoId);
                    adicionarIndicadorCampoTransferido(caixaInicialMoedasInput, estoqueAnterior.turnoId);
                } else if (valorInicialDinheiro === 0 && valorInicialMoedas === 0) {
                    const valoresPadrao = await getValoresPadraoCaixa();
                    valorInicialDinheiro = valoresPadrao.dinheiro;
                    valorInicialMoedas = valoresPadrao.moedas;
                    
                    caixaInicialDinheiroInput.value = formatToBRL(valorInicialDinheiro);
                    caixaInicialMoedasInput.value = formatToBRL(valorInicialMoedas);
                }
                
                let itensTransferidosCount = 0;
                
                Object.keys(estoqueAnterior.itens || {}).forEach(categoryKey => {
                    Object.keys(estoqueAnterior.itens[categoryKey] || {}).forEach(itemKey => {
                        const inputEntrada = document.getElementById(`${itemKey}_entrada`);
                        if (inputEntrada) {
                            const sobraAnterior = estoqueAnterior.itens[categoryKey][itemKey].sobra || 0;
                            inputEntrada.value = sobraAnterior;
                                    
                            adicionarIndicadorCampoTransferido(inputEntrada, estoqueAnterior.turnoId);
                            itensTransferidosCount++;
                        }
                    });
                });
                        
                const inputEntradaGelo = document.getElementById(`gelo_pacote_entrada`);
                if (inputEntradaGelo && estoqueAnterior.gelo?.gelo_pacote?.sobra) {
                    inputEntradaGelo.value = estoqueAnterior.gelo.gelo_pacote.sobra;
                            
                    adicionarIndicadorCampoTransferido(inputEntradaGelo, estoqueAnterior.turnoId);
                    itensTransferidosCount++;
                }

                if (estoqueAnterior.turnoId) {
                    adicionarResumoTurnoAnterior(estoqueAnterior.turnoId, estoqueAnterior);
                }

                const initialItensData = collectItemData(true);

                const turnoDataToSave = {
                    abertura: aberturaDataObj,
                    status: 'aberto',
                    caixaInicial: valorInicialDinheiro + valorInicialMoedas,
                    caixaInicialDinheiro: valorInicialDinheiro,
                    caixaInicialMoedas: valorInicialMoedas,
                    itens: initialItensData.itens,
                    gelo: initialItensData.gelo,
                    turnoAnteriorId: estoqueAnterior.turnoId,
                    dadosTransferidos: {
                        quantidadeItens: itensTransferidosCount,
                        caixaTransferido: estoqueAnterior.caixaFinal !== undefined,
                        formasPagamentoAnterior: Object.keys(estoqueAnterior.formasPagamento || {}).length > 0,
                        trocaGasAnterior: estoqueAnterior.trocaGas === 'sim'
                    },
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                };

                await db.collection('turnos').doc(turnoIdProposto).set(turnoDataToSave);
                
                saveTurnoLocal({
                    id: turnoIdProposto,
                    ...turnoDataToSave
                });
                
                turnoAbertoLocalmente = true;
                btnAbrirTurno.disabled = true;
                btnFecharTurno.disabled = false;
                        
                let statusMsg = `Turno ${periodoSelecionado} de ${dataAtual} aberto com sucesso!`;
                if (itensTransferidosCount > 0 || estoqueAnterior.caixaFinal !== undefined) {
                    statusMsg += ` Dados transferidos: ${itensTransferidosCount} item(ns)`;
                    if (estoqueAnterior.caixaFinal !== undefined) {
                        statusMsg += ` e caixa inicial (Dinheiro: ${formatToBRL(valorInicialDinheiro)} + Moedas: ${formatToBRL(valorInicialMoedas)})`;
                    }
                }
                turnoStatusP.textContent = statusMsg;
                turnoStatusP.className = 'text-center text-green-600 font-semibold mb-4';
                
                toggleFormInputs(true);
                
                setupTurnoListener();
                
                calculateAll();
                        
            } catch (error) {
                console.error("Erro ao abrir turno: ", error);
                showError("Falha ao abrir turno: " + error.message + ". Verifique suas permissões ou contate o suporte.");
                resetFormAndState("Erro ao tentar abrir o turno.");
            } finally {
                showLoadingState(false);
            }
        });
    }
    
    async function getEstoqueInicial(dataTurnoAtual, periodoTurnoAtual) {
        try {
            const user = auth.currentUser;
            if (!user) {
                console.error("Usuário não autenticado ao buscar turno anterior");
                try {
                    await auth.currentUser?.getIdToken(true);
                    console.log("Token de autenticação renovado com sucesso");
                } catch (authError) {
                    console.error("Erro ao renovar token:", authError);
                    throw new Error("Sessão expirada. Faça login novamente.");
                }
            }

            console.log("Buscando último turno fechado para transferência de estoque...");
            
            const turnosRef = await db.collection('turnos')
                .where('status', '==', 'fechado')
                .orderBy('closedAt', 'desc')
                .limit(1)
                .get();
                
            if (!turnosRef.empty) {
                const turnoDoc = turnosRef.docs[0];
                const dados = turnoDoc.data();
                
                console.log(`✅ Turno anterior encontrado: ${turnoDoc.id} (fechado em: ${dados.fechamento?.hora || 'N/A'})`);
                
                const estoqueFinal = { 
                    itens: {}, 
                    gelo: {}, 
                    turnoId: turnoDoc.id,
                    caixaFinal: null,
                    caixaFinalDinheiro: null,
                    caixaFinalMoedas: null,
                    formasPagamento: dados.formasPagamento || {},
                    trocaGas: dados.trocaGas || 'nao',
                    totalVendidoCalculado: dados.totalVendidoCalculadoFinal,
                    totalRegistradoPagamentos: dados.totalRegistradoPagamentosFinal,
                    diferencaCaixa: dados.diferencaCaixaFinal,
                    fechamentoData: dados.fechamento || {},
                    fechamentoTimestamp: dados.closedAt || null
                };
                
                if (dados.itens) {
                    Object.keys(dados.itens).forEach(cat => {
                        estoqueFinal.itens[cat] = {};
                        Object.keys(dados.itens[cat]).forEach(item => {
                            estoqueFinal.itens[cat][item] = { 
                              sobra: dados.itens[cat][item].sobra || 0,
                              precoUnitario: dados.itens[cat][item].precoUnitario,
                              vendido: dados.itens[cat][item].vendido,
                              totalItemValor: dados.itens[cat][item].totalItemValor,
                              chegadas: dados.itens[cat][item].chegadas || 0
                            };
                        });
                    });
                }
                
                if (dados.gelo && dados.gelo.gelo_pacote) { 
                    estoqueFinal.gelo.gelo_pacote = { 
                        sobra: dados.gelo.gelo_pacote.sobra || 0,
                        precoUnitario: dados.gelo.gelo_pacote.precoUnitario,
                        vendas: dados.gelo.gelo_pacote.vendas,
                        totalItemValor: dados.gelo.gelo_pacote.totalItemValor,
                        chegadas: dados.gelo.gelo_pacote.chegadas || 0
                    };
                }
                
                if (dados.caixaFinalDinheiro !== undefined && dados.caixaFinalMoedas !== undefined) {
                    estoqueFinal.caixaFinalDinheiro = dados.caixaFinalDinheiro;
                    estoqueFinal.caixaFinalMoedas = dados.caixaFinalMoedas;
                    estoqueFinal.caixaFinal = dados.caixaFinalDinheiro + dados.caixaFinalMoedas;
                    console.log(`💰 Transferindo caixa: Dinheiro ${formatToBRL(dados.caixaFinalDinheiro)} + Moedas ${formatToBRL(dados.caixaFinalMoedas)}`);
                } else if (dados.caixaFinalContado !== undefined) {
                    estoqueFinal.caixaFinal = dados.caixaFinalContado;
                    estoqueFinal.caixaFinalDinheiro = dados.caixaFinalContado * 0.9;
                    estoqueFinal.caixaFinalMoedas = dados.caixaFinalContado * 0.1;
                    console.log(`💰 Transferindo caixa (formato antigo): ${formatToBRL(dados.caixaFinalContado)}`);
                }
                
                return estoqueFinal;
            } else {
                console.log("⚠️ Nenhum turno fechado encontrado no sistema. Iniciando com estoque zero.");
            }
        } catch (error) {
            console.error("❌ Erro ao buscar último turno fechado:", error);
            
            if (error.code === 'permission-denied') {
                console.warn("⚠️ Erro de permissão ao acessar turnos. Iniciando com estoque zero.");
            } else {
                throw error;
            }
        }
        
        return { 
            itens: {}, 
            gelo: {}, 
            turnoId: null, 
            caixaFinal: null,
            caixaFinalDinheiro: null,
            caixaFinalMoedas: null,
            formasPagamento: {},
            trocaGas: 'nao',
            totalVendidoCalculado: 0,
            totalRegistradoPagamentos: 0,
            diferencaCaixa: 0,
            fechamentoData: {},
            fechamentoTimestamp: null
        };
    }

    function adicionarResumoTurnoAnterior(turnoAnteriorId, estoqueAnterior) {
        if (!turnoAnteriorId) return;
        
        const resumoExistente = document.getElementById('resumoTurnoAnterior');
        if (resumoExistente) {
            resumoExistente.remove();
        }
        
        const resumoContainer = document.createElement('div');
        resumoContainer.id = 'resumoTurnoAnterior';
        resumoContainer.className = 'bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6 fade-in';
        
        const titulo = document.createElement('h3');
        titulo.className = 'text-lg font-semibold text-blue-700 mb-2 flex items-center';
        titulo.innerHTML = '<i class="fas fa-exchange-alt mr-2"></i> Resumo do Turno Anterior';
        resumoContainer.appendChild(titulo);
        
        const detalhes = document.createElement('div');
        detalhes.className = 'text-sm grid grid-cols-1 md:grid-cols-2 gap-4';
        
        const colEsquerda = document.createElement('div');
        colEsquerda.className = 'space-y-1';
        
        const [dataAnterior, periodoAnterior] = turnoAnteriorId.split('_');
        const dataFormatada = dataAnterior.split('-').reverse().join('/');
        
        const idTurno = document.createElement('p');
        idTurno.innerHTML = `<strong>Turno:</strong> ${periodoAnterior} de ${dataFormatada}`;
        colEsquerda.appendChild(idTurno);
        
        if (estoqueAnterior.fechamentoData && estoqueAnterior.fechamentoData.responsavelNome) {
            const responsavel = document.createElement('p');
            responsavel.innerHTML = `<strong>Fechado por:</strong> ${estoqueAnterior.fechamentoData.responsavelNome}`;
            colEsquerda.appendChild(responsavel);
        }
        
        if (estoqueAnterior.fechamentoData && estoqueAnterior.fechamentoData.hora) {
            const hora = document.createElement('p');
            hora.innerHTML = `<strong>Horário:</strong> ${estoqueAnterior.fechamentoData.hora}`;
            colEsquerda.appendChild(hora);
        }
        
        if (estoqueAnterior.caixaFinal !== undefined) {
            const caixaFinal = document.createElement('p');
            caixaFinal.className = 'text-green-700 font-medium';
            caixaFinal.innerHTML = `<strong>Caixa Final:</strong> ${formatToBRL(estoqueAnterior.caixaFinal)}`;
            colEsquerda.appendChild(caixaFinal);
        }
        
        if (estoqueAnterior.trocaGas === 'sim') {
            const trocaGas = document.createElement('p');
            trocaGas.className = 'text-orange-700 font-medium mt-2 bg-orange-50 p-1 rounded';
            trocaGas.innerHTML = '<i class="fas fa-fire mr-1"></i> <strong>Houve troca de botijão no turno anterior</strong>';
            colEsquerda.appendChild(trocaGas);
        }
        
        detalhes.appendChild(colEsquerda);
        
        const colDireita = document.createElement('div');
        colDireita.className = 'space-y-1';
        
        if (estoqueAnterior.totalVendidoCalculado) {
            const totalVendido = document.createElement('p');
            totalVendido.innerHTML = `<strong>Total Vendido:</strong> ${formatToBRL(estoqueAnterior.totalVendidoCalculado)}`;
            colDireita.appendChild(totalVendido);
        }
        
        if (estoqueAnterior.totalRegistradoPagamentos) {
            const totalPagamentos = document.createElement('p');
            totalPagamentos.innerHTML = `<strong>Total Pagamentos:</strong> ${formatToBRL(estoqueAnterior.totalRegistradoPagamentos)}`;
            colDireita.appendChild(totalPagamentos);
        }
        
        if (estoqueAnterior.diferencaCaixa !== undefined) {
            const diferencaCaixa = document.createElement('p');
            if (Math.abs(estoqueAnterior.diferencaCaixa) > 0.01) {
                diferencaCaixa.className = estoqueAnterior.diferencaCaixa > 0 ? 'text-green-700' : 'text-red-700';
                diferencaCaixa.innerHTML = `<strong>Diferença de Caixa:</strong> ${formatToBRL(estoqueAnterior.diferencaCaixa)}`;
            } else {
                diferencaCaixa.innerHTML = `<strong>Diferença de Caixa:</strong> Sem diferença`;
            }
            colDireita.appendChild(diferencaCaixa);
        }
        
        if (estoqueAnterior.formasPagamento && Object.keys(estoqueAnterior.formasPagamento).length > 0) {
            const pagamentos = document.createElement('div');
            pagamentos.className = 'mt-2 bg-white bg-opacity-50 p-2 rounded';
            
            const pagamentosTitle = document.createElement('p');
            pagamentosTitle.className = 'text-blue-800 font-medium';
            pagamentosTitle.innerHTML = '<i class="fas fa-credit-card mr-1"></i> <strong>Formas de Pagamento:</strong>';
            pagamentos.appendChild(pagamentosTitle);
            
            const pagamentosList = document.createElement('ul');
            pagamentosList.className = 'grid grid-cols-2 gap-x-2 text-xs mt-1';
            
            const nomeAmigavel = {
                dinheiro: "Dinheiro",
                pixManual: "PIX Manual",
                stoneDCV: "Stone D/C/V",
                stoneVoucher: "Stone Voucher",
                pagbankDCV: "PagBank D/C/V"
            };
            
            Object.entries(estoqueAnterior.formasPagamento).forEach(([metodo, valor]) => {
                if (valor > 0) {
                    const li = document.createElement('li');
                    li.innerHTML = `${nomeAmigavel[metodo] || metodo}: <span class="font-medium">${formatToBRL(valor)}</span>`;
                    pagamentosList.appendChild(li);
                }
            });
            
            pagamentos.appendChild(pagamentosList);
            colDireita.appendChild(pagamentos);
        }
        
        detalhes.appendChild(colDireita);
        resumoContainer.appendChild(detalhes);
        
        const btnFechar = document.createElement('button');
        btnFechar.type = 'button';
        btnFechar.className = 'text-blue-600 hover:text-blue-800 text-xs mt-3 flex items-center';
        btnFechar.innerHTML = '<i class="fas fa-times-circle mr-1"></i> Fechar resumo';
        btnFechar.onclick = () => resumoContainer.remove();
        resumoContainer.appendChild(btnFechar);
        
        const formTurno = document.getElementById('formTurno');
        if (formTurno && formTurno.firstChild) {
            formTurno.insertBefore(resumoContainer, formTurno.firstChild);
        }
        
        return resumoContainer;
    }

    if (btnFecharTurno) {
        btnFecharTurno.addEventListener('click', async () => {
            clearError();
            if (!currentTurnoId || !turnoAbertoLocalmente) {
                showError("Nenhum turno aberto para fechar ou dados do turno não carregados.");
                return;
            }

            if (!validateRequiredFieldsForClosure()) {
                 showError("Preencha todos os campos obrigatórios ('Caixa Inicial', 'Caixa Final Contado', campos de itens e formas de pagamento) antes de fechar.");
                 return;
            }
            
            const totalVendidoCalc = parseCurrencyToNumber(totalVendidoTurnoCalculadoInput.value);
            const totalPagamentos = parseCurrencyToNumber(totalRegistradoPagamentosInput.value);

            let divergenciaValorDetected = false;
            if ((totalVendidoCalc - totalPagamentos) > 0.015) {
                divergenciaValorDetected = true;
            }

            const { diferencaCaixa } = updatePhysicalCashDifference();
            const caixaComProblema = diferencaCaixa < -0.015;
            
            fechamentoDivergenciaAlertaGeralDiv.classList.add('hidden');
            fechamentoDivergenciaAlertaGeralDiv.textContent = '';
            
            let confirmMsg = "Você está prestes a fechar o turno.";
            if (divergenciaValorDetected || caixaComProblema) {
                let alertText = "ATENÇÃO: Divergências encontradas!\n";
                if (divergenciaValorDetected) {
                    alertText += `- Faltam ${formatToBRL(totalVendidoCalc - totalPagamentos)} nos pagamentos\n`;
                }
                if (caixaComProblema) {
                    alertText += `- Falta ${formatToBRL(Math.abs(diferencaCaixa))} no caixa físico\n`;
                }
                alertText += "\nDeseja continuar e fechar o turno mesmo assim? As divergências serão registradas.";
                    
                fechamentoDivergenciaAlertaGeralDiv.innerHTML = alertText.replace(/\n/g, '<br>');
                fechamentoDivergenciaAlertaGeralDiv.classList.remove('hidden');
                
                if (!confirm(alertText)) {
                    return; 
                }
            } else {
                 if (!confirm(confirmMsg + " Todos os valores parecem corretos. Confirmar fechamento?")) {
                     return;
                 }
            }

            showLoadingState(true, "Fechando turno...");
            btnFecharTurno.disabled = true;

            const user = auth.currentUser;
            if (!user) {
                showError("Sessão expirada ou usuário deslogado. Faça login novamente para fechar o turno.");
                 showLoadingState(false);
                return;
            }

            const fechamentoDataObj = {
                hora: getFormattedTime(),
                responsavelId: user.uid, 
                responsavelNome: localStorage.getItem('userName') || user.displayName || user.email
            };

            const dadosColetados = collectItemData(false); 
            
            const formasPagamentoObj = {
                dinheiro: parseCurrencyToNumber(document.getElementById('pagamentoDinheiro').value),
                pixManual: parseCurrencyToNumber(document.getElementById('pagamentoPixManual').value),
                stoneDCV: parseCurrencyToNumber(document.getElementById('pagamentoStoneDCV').value),
                stoneVoucher: parseCurrencyToNumber(document.getElementById('pagamentoStoneVoucher').value),
                pagbankDCV: parseCurrencyToNumber(document.getElementById('pagamentoPagBankDCV').value),
            };
            
            const caixaFinalDinheiro = parseCurrencyToNumber(caixaFinalDinheiroInput?.value || '0');
            const caixaFinalMoedas = parseCurrencyToNumber(caixaFinalMoedasInput?.value || '0');
            const caixaFinalContadoVal = caixaFinalDinheiro + caixaFinalMoedas;
            const caixaDiferencaVal = Math.abs(diferencaCaixa);

            const dadosFuncionariosColaboradores = coletarDadosFuncionariosColaboradores();

            let funcionariosIncompletos = false;
            dadosFuncionariosColaboradores.forEach(func => {
                if (!func.consumo || !func.transporte || func.horasTrabalhadas === 0) {
                    funcionariosIncompletos = true;
                }
            });

            if (funcionariosIncompletos) {
                showError("Por favor, preencha todos os dados dos funcionários colaboradores (consumo, transporte e horas).");
                showLoadingState(false);
                btnFecharTurno.disabled = false;
                return;
            }

            try {
                await db.runTransaction(async (transaction) => {
                    const turnoRef = db.collection('turnos').doc(currentTurnoId);
                    const turnoDoc = await transaction.get(turnoRef);
                    
                    if (!turnoDoc.exists) {
                        throw new Error("Turno não existe mais no servidor.");
                    }
                    
                    const turnoData = turnoDoc.data();
                    if (turnoData.status !== 'aberto') {
                        throw new Error("Turno já foi fechado em outra sessão.");
                    }
                    
                    const caixaInicialDoTurno = turnoData.caixaInicial;

                    const turnoUpdateData = {
                        status: 'fechado',
                        fechamento: fechamentoDataObj,
                        itens: dadosColetados.itens,
                        gelo: dadosColetados.gelo, 
                        trocaGas: document.getElementById('trocaGas').value,
                        caixaInicial: caixaInicialDoTurno,
                        caixaFinalContado: caixaFinalContadoVal,
                        formasPagamento: formasPagamentoObj,
                        totalVendidoCalculadoFinal: totalVendidoCalc,
                        totalRegistradoPagamentosFinal: totalPagamentos,
                        diferencaCaixaFinal: caixaDiferencaVal,
                        funcionariosColaboradores: dadosFuncionariosColaboradores,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        closedAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
                    transaction.update(turnoRef, turnoUpdateData);
                    
                    return {
                        ...turnoData,
                        ...turnoUpdateData
                    };
                });

                if (dadosFuncionariosColaboradores.length > 0) {
                    await salvarDadosFuncionariosColaboradores(currentTurnoId, dadosFuncionariosColaboradores);
                }
                
                const periodoExibicao = currentTurnoId.split('_')[1].replace(/-/g, ' ');
                turnoStatusP.textContent = `Turno ${periodoExibicao} de ${currentTurnoId.split('_')[0]} fechado com sucesso!`;
                turnoStatusP.className = 'text-center text-green-600 font-semibold mb-4';
                
                removeTurnoLocal();
                
                if (unsubscribeTurnoListener) {
                    unsubscribeTurnoListener();
                    unsubscribeTurnoListener = null;
                }
                
                await carregarDadosTurnoAnterior();
                
                resetFormAndState("Turno fechado com sucesso! Você já pode abrir um novo turno.");

            } catch (error) {
                console.error("Erro ao fechar turno: ", error);
                showError("Falha ao fechar turno: " + error.message + ". O turno pode ainda estar aberto. Verifique e tente novamente ou contate o suporte.");
                await checkOpenTurno();
            } finally {
                showLoadingState(false);
            }
        });
    }
    
    function validateRequiredFieldsForClosure() {
        let isValid = true;
        const fieldsToValidate = [];
        const invalidFields = [];

        document.querySelectorAll('.item-row').forEach(row => {
            const itemKey = row.dataset.itemKey;
            const itemFields = itemKey === 'gelo_pacote' ? ['chegadas', 'sobra', 'vendas', 'consumo_interno'] : ['chegadas', 'sobra', 'descarte', 'consumo'];
            itemFields.forEach(fieldSuffix => {
                fieldsToValidate.push(document.getElementById(`${itemKey}_${fieldSuffix}`));
            });
        });

         fieldsToValidate.push(
            caixaInicialDinheiroInput,
            caixaInicialMoedasInput,
            caixaFinalContadoInput,
            pagamentoDinheiroInput,
            document.getElementById('pagamentoPixManual'),
            document.getElementById('pagamentoStoneDCV'),
            document.getElementById('pagamentoStoneVoucher'),
            document.getElementById('pagamentoPagBankDCV')
        );
        
        fieldsToValidate.forEach(input => {
            if (input) {
                const value = input.type === 'text' ? parseCurrencyToNumber(input.value) : parseFloat(input.value);
                if (input.value.trim() === '' || isNaN(value)) {
                    // Adiciona múltiplas classes para destaque máximo
                    input.classList.add('border-red-500', 'border-2', 'bg-red-50', 'ring-2', 'ring-red-300', 'ring-opacity-50');
                    input.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.3)';
                    
                    // Adiciona animação de shake
                    input.classList.add('shake-animation');
                    setTimeout(() => {
                        input.classList.remove('shake-animation');
                    }, 500);
                    
                    // Adiciona ícone de alerta se não existir
                    const parent = input.parentElement;
                    if (parent && !parent.querySelector('.error-icon')) {
                        const errorIcon = document.createElement('span');
                        errorIcon.className = 'error-icon absolute right-2 top-1/2 transform -translate-y-1/2 text-red-500';
                        errorIcon.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
                        errorIcon.style.pointerEvents = 'none';
                        parent.style.position = 'relative';
                        parent.appendChild(errorIcon);
                    }
                    
                    invalidFields.push(input);
                    isValid = false;
                } else {
                    // Remove todas as classes de erro
                    input.classList.remove('border-red-500', 'border-2', 'bg-red-50', 'ring-2', 'ring-red-300', 'ring-opacity-50', 'shake-animation');
                    input.style.boxShadow = '';
                    
                    // Remove ícone de erro se existir
                    const parent = input.parentElement;
                    const errorIcon = parent?.querySelector('.error-icon');
                    if (errorIcon) {
                        errorIcon.remove();
                    }
                }
            }
        });
        
        // Se houver campos inválidos, rola até o primeiro
        if (invalidFields.length > 0) {
            const firstInvalidField = invalidFields[0];
            
            // Encontra o fieldset ou seção pai para dar contexto
            const section = firstInvalidField.closest('fieldset') || firstInvalidField.closest('.bg-white');
            if (section) {
                section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
            // Foca no primeiro campo inválido após um pequeno delay
            setTimeout(() => {
                firstInvalidField.focus();
            }, 300);
            
            // Mostra tooltip temporário no primeiro campo
            showFieldErrorTooltip(firstInvalidField, 'Campo obrigatório');
        }
        
        // Destaca também as seções que contêm campos inválidos
        document.querySelectorAll('fieldset').forEach(fieldset => {
            const camposInvalidos = fieldset.querySelectorAll('.border-red-500');
            if (camposInvalidos.length > 0) {
                fieldset.classList.add('border-red-300', 'bg-red-50', 'bg-opacity-30');
                
                // Adiciona contador de campos inválidos na legenda
                const legend = fieldset.querySelector('legend');
                if (legend && !legend.querySelector('.error-count')) {
                    const errorCount = document.createElement('span');
                    errorCount.className = 'error-count ml-2 text-red-600 text-sm font-normal';
                    errorCount.textContent = `(${camposInvalidos.length} campo${camposInvalidos.length > 1 ? 's' : ''} obrigatório${camposInvalidos.length > 1 ? 's' : ''})`;
                    legend.appendChild(errorCount);
                }
            } else {
                fieldset.classList.remove('border-red-300', 'bg-red-50', 'bg-opacity-30');
                const errorCount = fieldset.querySelector('.error-count');
                if (errorCount) {
                    errorCount.remove();
                }
            }
        });
        
        return isValid;
    }
    
    // Nova função para mostrar tooltip de erro em campo específico
    function showFieldErrorTooltip(field, message) {
        // Remove tooltip existente se houver
        const existingTooltip = document.querySelector('.field-error-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
        
        const tooltip = document.createElement('div');
        tooltip.className = 'field-error-tooltip absolute z-50 bg-red-600 text-white text-xs rounded py-1 px-2 pointer-events-none';
        tooltip.textContent = message;
        tooltip.style.whiteSpace = 'nowrap';
        
        // Posiciona o tooltip
        const rect = field.getBoundingClientRect();
        tooltip.style.left = `${rect.left}px`;
        tooltip.style.top = `${rect.bottom + 5}px`;
        
        document.body.appendChild(tooltip);
        
        // Remove após 3 segundos
        setTimeout(() => {
            tooltip.classList.add('fade-out');
            setTimeout(() => {
                tooltip.remove();
            }, 300);
        }, 3000);
    }

    function validarCamposTransferidos(event) {
        const target = event.target;
        if (target && target.dataset && target.dataset.transferidoDoTurno) {
            const valorOriginal = target.dataset.valorOriginal;
            
            if (valorOriginal !== undefined && target.value !== valorOriginal) {
                target.value = valorOriginal;
                
                target.classList.add('shake-animation');
                setTimeout(() => {
                    target.classList.remove('shake-animation');
                }, 500);
                
                const msgErro = `O campo "${target.name || target.id}" foi transferido do turno anterior e não pode ser alterado.`;
                
                if (typeof showError === 'function') {
                    showError(msgErro);
                } else {
                    const alerta = document.createElement('div');
                    alerta.className = 'alerta-campo-transferido';
                    alerta.innerHTML = `
                        <div class="flex items-center">
                            <i class="fas fa-exclamation-circle mr-2"></i>
                            <span>${msgErro}</span>
                        </div>
                    `;
                    document.body.appendChild(alerta);
                    
                    setTimeout(() => {
                        alerta.style.opacity = '0';
                        setTimeout(() => alerta.remove(), 300);
                    }, 3000);
                }
                
                return false;
            }
        }
        return true;
    }

    function setupEventListeners() {
    formTurno.addEventListener('input', (e) => {
        const target = e.target;
        
        if (!validarCamposTransferidos(e)) {
            e.preventDefault();
            return;
        }
        
        if (target.closest('.item-row') && target.type === 'number') {
            const row = target.closest('.item-row');
            const itemKey = row.dataset.itemKey;
            
            // Identificar qual campo foi alterado
            let campoAlterado = '';
            if (target.id.endsWith('_entrada')) campoAlterado = 'entrada';
            else if (target.id.endsWith('_chegadas')) campoAlterado = 'chegadas';
            else if (target.id.endsWith('_sobra')) campoAlterado = 'sobra';
            else if (target.id.endsWith('_descarte')) campoAlterado = 'descarte';
            else if (target.id.endsWith('_consumo')) campoAlterado = 'consumo';
            else if (target.id.endsWith('_vendas')) campoAlterado = 'vendas';
            
            // Aplicar validação apropriada
            let validationResult;
            if (itemKey === 'gelo_pacote') {
                validationResult = validarConsistenciaGelo(campoAlterado);
            } else if (campoAlterado) {
                validationResult = validarConsistenciaItem(itemKey, campoAlterado);
            }
            
            // Mostrar alertas se houver erros
            if (validationResult && validationResult.errors.length > 0) {
                mostrarAlertaValidacao(itemKey, validationResult.errors);
                
                // Vibrar o campo se foi corrigido
                if (validationResult.campoCorrigido) {
                    target.classList.add('shake-animation', 'border-red-500', 'bg-red-50');
                    setTimeout(() => {
                        target.classList.remove('shake-animation', 'border-red-500', 'bg-red-50');
                    }, 1000);
                }
            }
            
            // Continuar com o cálculo normal
            if (target.id.startsWith(itemKey)) {
                target.classList.remove('border-red-500');
                if (target.dataset.isGeloVenda === "true") {
                    calculateGeloTotal(row);
                } else {
                    calculateItemRow(row);
                }
                calculateTotals();
            }
        } else if (target.classList.contains('payment-input') || target.id.includes('pagamento')) {
            target.classList.remove('border-red-500');
            setTimeout(() => {
                updatePaymentTotalsAndDivergence();
            }, 100);
        } else if (['caixaInicio', 'caixaFinalContado'].includes(target.id)) {
            target.classList.remove('border-red-500');
            setTimeout(() => {
                updatePhysicalCashDifference();
                checkFechamentoDivergencia();
            }, 100);
        }
        
        if (target.id && target.id.includes('_sobra')) {
            const itemKey = target.id.replace('_sobra', '');
            verificarEstoqueBaixo(itemKey, target.value);
        }
    });
    
    formTurno.addEventListener('blur', (e) => {
        const target = e.target;
        
        if (target.id && target.id.includes('_sobra')) {
            const itemKey = target.id.replace('_sobra', '');
            setTimeout(() => {
                verificarEstoqueBaixo(itemKey, target.value);
            }, 100);
        }
    }, true);

    const btnAdicionarFuncionario = document.getElementById('btnAdicionarFuncionario');
    if (btnAdicionarFuncionario) {
        btnAdicionarFuncionario.addEventListener('click', adicionarFuncionarioColaborador);
    }
}
    function calculateItemRow(rowElement) {
    const itemKey = rowElement.dataset.itemKey;
    if (!itemKey || itemKey === 'gelo_pacote') return;
    const entrada = parseFloat(document.getElementById(`${itemKey}_entrada`)?.value) || 0;
    const chegadas = parseFloat(document.getElementById(`${itemKey}_chegadas`)?.value) || 0;
    const sobra = parseFloat(document.getElementById(`${itemKey}_sobra`)?.value) || 0;
    const descarte = parseFloat(document.getElementById(`${itemKey}_descarte`)?.value) || 0;
    const consumo = parseFloat(document.getElementById(`${itemKey}_consumo`)?.value) || 0;
    verificarEstoqueBaixo(itemKey, sobra);
    const vendidoInput = document.getElementById(`${itemKey}_vendido`);
    let vendidoCalculado = (entrada + chegadas) - sobra - descarte - consumo;
    if (vendidoCalculado < 0) {
        vendidoCalculado = 0; 
    }
    if (vendidoInput) vendidoInput.value = vendidoCalculado;
    const totalItemDisplay = document.getElementById(`${itemKey}_total_item`);
    if (totalItemDisplay && vendidoInput) {
        const precoUnitario = parseFloat(vendidoInput.dataset.price) || 0;
        const totalItemValor = vendidoCalculado * precoUnitario;
        totalItemDisplay.textContent = formatToBRL(totalItemValor);
    }
    atualizarLimitesVisuais(itemKey);
}
    
   function calculateGeloTotal(rowElement) {
    const itemKey = rowElement.dataset.itemKey;
    if(itemKey !== 'gelo_pacote') return;
    const entradaGelo = parseFloat(document.getElementById(`${itemKey}_entrada`)?.value) || 0;
    const chegadasGelo = parseFloat(document.getElementById(`${itemKey}_chegadas`)?.value) || 0;
    const sobraGelo = parseFloat(document.getElementById(`${itemKey}_sobra`)?.value) || 0;
    const vendasGeloInput = document.getElementById(`${itemKey}_vendas`);
    const vendasGelo = parseFloat(vendasGeloInput?.value) || 0;
    
    const consumoInternoCalculado = (entradaGelo + chegadasGelo) - sobraGelo - vendasGelo;
    const consumoInternoInput = document.getElementById(`${itemKey}_consumo_interno`);
    if (consumoInternoInput) {
        consumoInternoInput.value = Math.max(0, consumoInternoCalculado);
    }
    
    verificarEstoqueBaixo(itemKey, sobraGelo);
    
    const precoDisplay = document.getElementById(`${itemKey}_preco_display`);
    const totalItemDisplay = document.getElementById(`${itemKey}_total_item`);
    const totalGeloFooter = document.getElementById('totalGeloValor');
    
    if (precoDisplay && totalItemDisplay) {
        const precoGeloTexto = precoDisplay.textContent;
        const precoUnitarioGelo = parseCurrencyToNumber(precoGeloTexto);
        const totalGeloValor = vendasGelo * precoUnitarioGelo;
        totalItemDisplay.textContent = formatToBRL(totalGeloValor);
        if (totalGeloFooter) {
            totalGeloFooter.textContent = formatToBRL(totalGeloValor);
        }
        calculateTotals();
        console.log(`📊 Gelo: ${vendasGelo} pacotes x ${formatToBRL(precoUnitarioGelo)} = ${formatToBRL(totalGeloValor)}`);
        console.log(`❄️ Consumo interno calculado: ${Math.max(0, consumoInternoCalculado)} pacotes`);
    }
    atualizarLimitesVisuais(itemKey);
}
    
    function calculateTotals() {
        let totalPasteisComunsVendido = 0, totalPasteisComunsValor = 0;
        let totalPasteisEspeciaisVendido = 0, totalPasteisEspeciaisValor = 0;
        let totalCasquinhasVendido = 0, totalCasquinhasValor = 0;
        let totalCaldoCanaVendido = 0, totalCaldoCanaValor = 0;
        let totalRefrigerantesVendido = 0, totalRefrigerantesValor = 0;
        
        const localListaSaboresPasteis = typeof listaSaboresPasteis !== 'undefined' ? listaSaboresPasteis : [];
        localListaSaboresPasteis.forEach(sabor => {
            const key = sabor.toLowerCase().replace(/\s+/g, '_').replace(/[ç]/g, 'c').replace(/[ãâáàä]/g, 'a').replace(/[éêèë]/g, 'e').replace(/[íìîï]/g, 'i').replace(/[óôõòö]/g, 'o').replace(/[úùûü]/g, 'u');
            const vendido = parseFloat(document.getElementById(`${key}_vendido`)?.value) || 0;
            const valor = parseCurrencyToNumber(document.getElementById(`${key}_total_item`)?.textContent);
            if (sabor.toLowerCase().includes('especial')) {
                totalPasteisEspeciaisVendido += vendido;
                totalPasteisEspeciaisValor += valor;
            } else {
                totalPasteisComunsVendido += vendido;
                totalPasteisComunsValor += valor;
            }
        });
        const localListaCasquinhas = typeof listaCasquinhas !== 'undefined' ? listaCasquinhas : [];
        localListaCasquinhas.forEach(casquinha => {
            const key = casquinha.toLowerCase().replace(/\s+/g, '_');
            const vendido = parseFloat(document.getElementById(`${key}_vendido`)?.value) || 0;
            const valor = parseCurrencyToNumber(document.getElementById(`${key}_total_item`)?.textContent);
            totalCasquinhasVendido += vendido;
            totalCasquinhasValor += valor;
        });

        document.getElementById('totalPasteisComunsVendido').textContent = totalPasteisComunsVendido;
        document.getElementById('totalPasteisComunsValor').textContent = formatToBRL(totalPasteisComunsValor);
        document.getElementById('totalPasteisEspeciaisVendido').textContent = totalPasteisEspeciaisVendido;
        document.getElementById('totalPasteisEspeciaisValor').textContent = formatToBRL(totalPasteisEspeciaisValor);
        document.getElementById('totalCasquinhasVendido').textContent = totalCasquinhasVendido;
        document.getElementById('totalCasquinhasValor').textContent = formatToBRL(totalCasquinhasValor);
        
        const totalGeralPasteisVendido = totalPasteisComunsVendido + totalPasteisEspeciaisVendido; 
        const totalGeralPasteisValor = totalPasteisComunsValor + totalPasteisEspeciaisValor;
        document.getElementById('totalGeralPasteisVendido').textContent = totalGeralPasteisVendido;
        document.getElementById('totalGeralPasteisValor').textContent = formatToBRL(totalGeralPasteisValor);
        
        const localListaCaldoCana = typeof listaCaldoCana !== 'undefined' ? listaCaldoCana : [];
        localListaCaldoCana.forEach(item => {
            const key = item.toLowerCase().replace(/\s+/g, '_').replace(/[ç]/g, 'c').replace(/\d+ml/, d => d.toLowerCase()).replace(/\d+litro/, d => d.toLowerCase());
            totalCaldoCanaVendido += parseFloat(document.getElementById(`${key}_vendido`)?.value) || 0;
            totalCaldoCanaValor += parseCurrencyToNumber(document.getElementById(`${key}_total_item`)?.textContent);
        });
        document.getElementById('totalCaldoCanaVendido').textContent = totalCaldoCanaVendido;
        document.getElementById('totalCaldoCanaValor').textContent = formatToBRL(totalCaldoCanaValor);

        const localListaRefrigerantes = typeof listaRefrigerantes !== 'undefined' ? listaRefrigerantes : [];
        localListaRefrigerantes.forEach(item => {
            const key = item.toLowerCase().replace(/\s+/g, '_').replace(/[ç]/g, 'c').replace(/\./g, '');
            totalRefrigerantesVendido += parseFloat(document.getElementById(`${key}_vendido`)?.value) || 0;
            totalRefrigerantesValor += parseCurrencyToNumber(document.getElementById(`${key}_total_item`)?.textContent);
        });
        document.getElementById('totalRefrigerantesVendido').textContent = totalRefrigerantesVendido;
        document.getElementById('totalRefrigerantesValor').textContent = formatToBRL(totalRefrigerantesValor);

        const totalGeloValorVenda = parseCurrencyToNumber(document.getElementById(`gelo_pacote_total_item`)?.textContent);
        document.getElementById('totalGeloValor').textContent = formatToBRL(totalGeloValorVenda);

        const granTotalVendidoValor = totalGeralPasteisValor + totalCasquinhasValor + totalCaldoCanaValor + totalRefrigerantesValor + totalGeloValorVenda;
        totalVendidoTurnoCalculadoInput.value = formatToBRL(granTotalVendidoValor);

        updatePaymentTotalsAndDivergence(); 
        checkFechamentoDivergencia(); 
    }
    
    function calculateAll() { 
        document.querySelectorAll('#tabelaPasteis .item-row, #tabelaCasquinhas .item-row, #tabelaCaldoCana .item-row, #tabelaRefrigerantes .item-row').forEach(row => {
            calculateItemRow(row);
        });
        const geloRow = document.querySelector('#tabelaGelo .item-row');
        if (geloRow) calculateGeloTotal(geloRow);
        calculateTotals();
    }

    function updateTotalRegistradoPagamentos() {
        updatePaymentTotalsAndDivergence();
    }
    
    function updateCaixaDiferenca() {
        return updatePhysicalCashDifference();
    }
    
    function checkFechamentoDivergencia() {
        if (!totalVendidoTurnoCalculadoInput || !totalRegistradoPagamentosInput) return;

        const totalVendidoCalc = parseCurrencyToNumber(totalVendidoTurnoCalculadoInput.value);
        const totalPagamentos = parseCurrencyToNumber(totalRegistradoPagamentosInput.value);
        const { isValid: caixaValido, diferencaCaixa } = updatePhysicalCashDifference();

        const diffValores = Math.abs(totalVendidoCalc - totalPagamentos);
        const temProblemaVendas = (totalVendidoCalc - totalPagamentos) > 0.01; // Falta pagamento
        const temProblemaCaixa = diferencaCaixa < -0.01; // Falta no caixa

        if (temProblemaVendas || temProblemaCaixa) {
            let message = "<strong>🚨 ATENÇÃO: DIVERGÊNCIAS DETECTADAS!</strong><br><br>";
            
            if (temProblemaVendas) {
                message += `<div class="bg-white bg-opacity-50 p-3 rounded mb-2">`;
                message += `📊 <strong>Vendas vs Pagamentos:</strong><br>`;
                message += `• Total Vendido: ${formatToBRL(totalVendidoCalc)}<br>`;
                message += `• Total Pagamentos: ${formatToBRL(totalPagamentos)}<br>`;
                message += `• <span class="font-bold text-lg">Faltam: ${formatToBRL(totalVendidoCalc - totalPagamentos)}</span>`;
                message += `</div>`;
            }

                if (temProblemaCaixa) {
                    message += `<div class="bg-white bg-opacity-50 p-3 rounded">`;
                    message += `🏦 <strong>Caixa Físico:</strong><br>`;
                    message += `• <span class="font-bold text-lg">Falta: ${formatToBRL(Math.abs(diferencaCaixa))}</span>`;
                    message += `</div>`;
                }
            
            if (!caixaValido) {
                message += `<div class="bg-white bg-opacity-50 p-3 rounded">`;
                message += `🏦 <strong>Caixa Físico:</strong><br>`;
                message += `• <span class="font-bold text-lg">Diferença: ${formatToBRL(Math.abs(diferencaCaixa))}</span>`;
                message += `</div>`;
            }
            
            fechamentoDivergenciaAlertaGeralDiv.innerHTML = message;
            fechamentoDivergenciaAlertaGeralDiv.classList.remove('hidden');
            fechamentoDivergenciaAlertaGeralDiv.className = 'mt-6 p-5 bg-red-100 border-l-4 border-red-500 text-red-700 text-left leading-relaxed';
        } else {
            fechamentoDivergenciaAlertaGeralDiv.innerHTML = `
                <div class="text-center">
                    <i class="fas fa-check-circle text-2xl mb-2"></i>
                    <div class="font-bold">✅ Todos os valores conferem perfeitamente! 🎉</div>
                    <div class="text-sm mt-2 opacity-75">
                        Vendas: ${formatToBRL(totalVendidoCalc)} | Pagamentos: ${formatToBRL(totalPagamentos)} | Caixa: OK
                    </div>
                </div>
            `;
            fechamentoDivergenciaAlertaGeralDiv.classList.remove('hidden');
            fechamentoDivergenciaAlertaGeralDiv.className = 'mt-6 p-5 bg-green-100 border-l-4 border-green-500 text-green-700 text-center';
        }
    }

    function collectItemData(isOpeningTurno) {
        const data = { itens: {}, gelo: {} };
        
        document.querySelectorAll('.item-section[data-category]').forEach(section => {
            const categoryKey = section.dataset.category;
            if (!['pasteis', 'casquinhas', 'caldo_cana', 'refrigerantes'].includes(categoryKey)) return;

            data.itens[categoryKey] = {};
            section.querySelectorAll('.item-row').forEach(row => {
                const itemKey = row.dataset.itemKey;
                const entrada = parseFloat(document.getElementById(`${itemKey}_entrada`)?.value) || 0;
                const chegadas = parseFloat(document.getElementById(`${itemKey}_chegadas`)?.value) || 0;
                const precoUnitario = productPrices[categoryKey]?.[itemKey]?.preco || 0;

                if (isOpeningTurno) {
                    data.itens[categoryKey][itemKey] = {
                        entrada: entrada,
                        chegadas: chegadas,
                        precoUnitario: precoUnitario
                    };
                } else { 
                    const sobra = parseFloat(document.getElementById(`${itemKey}_sobra`)?.value) || 0;
                    const descarte = parseFloat(document.getElementById(`${itemKey}_descarte`)?.value) || 0;
                    const consumo = parseFloat(document.getElementById(`${itemKey}_consumo`)?.value) || 0;
                    const vendido = parseFloat(document.getElementById(`${itemKey}_vendido`)?.value) || 0;
                    
                    data.itens[categoryKey][itemKey] = {
                        entrada: entrada,
                        chegadas: chegadas,
                        sobra: sobra,
                        descarte: descarte,
                        consumo: consumo,
                        vendido: vendido,
                        precoUnitario: precoUnitario, 
                        totalItemValor: vendido * precoUnitario
                    };
                }
            });
        });

        const geloKey = 'gelo_pacote';
        const geloEntrada = parseFloat(document.getElementById(`${geloKey}_entrada`)?.value) || 0;
        const geloChegadas = parseFloat(document.getElementById(`${geloKey}_chegadas`)?.value) || 0;
        const precoUnitarioGelo = productPrices.gelo?.[geloKey]?.preco || 0;

        if (isOpeningTurno) {
             data.gelo[geloKey] = {
                entrada: geloEntrada,
                chegadas: geloChegadas,
                precoUnitario: precoUnitarioGelo
             };
        } else {
            const geloSobra = parseFloat(document.getElementById(`${geloKey}_sobra`)?.value) || 0;
            const geloVendas = parseFloat(document.getElementById(`${geloKey}_vendas`)?.value) || 0; 
            const geloConsumoInterno = parseFloat(document.getElementById(`${geloKey}_consumo_interno`)?.value) || 0;
                const consumoCalculado = Math.max(0, (geloEntrada + geloChegadas) - geloSobra - geloVendas);

                data.gelo[geloKey] = {
                    entrada: geloEntrada,
                    chegadas: geloChegadas,
                    sobra: geloSobra,
                    vendas: geloVendas, 
                    consumoInterno: consumoCalculado, // Usar o valor recalculado
                    precoUnitario: precoUnitarioGelo,
                    totalItemValor: geloVendas * precoUnitarioGelo
                };
        }
        return data;
    }
    
    function loadTurnoDataToForm(turnoData) {
    if (!turnoData) return;
    
    // Carregar valores de caixa inicial
    if (turnoData.caixaInicialDinheiro !== undefined && turnoData.caixaInicialMoedas !== undefined) {
        // Novo formato com separação
        if (caixaInicialDinheiroInput) {
            caixaInicialDinheiroInput.value = formatToBRL(turnoData.caixaInicialDinheiro);
        }
        if (caixaInicialMoedasInput) {
            caixaInicialMoedasInput.value = formatToBRL(turnoData.caixaInicialMoedas);
        }
    } else if (turnoData.caixaInicial !== undefined) {
        // Formato antigo - dividir proporcionalmente
        const valorTotal = turnoData.caixaInicial || 0;
        if (caixaInicialDinheiroInput) {
            caixaInicialDinheiroInput.value = formatToBRL(valorTotal * 0.9);
        }
        if (caixaInicialMoedasInput) {
            caixaInicialMoedasInput.value = formatToBRL(valorTotal * 0.1);
        }
    }
    
        if (turnoData.itens) {
        Object.keys(turnoData.itens).forEach(categoryKey => {
            if(turnoData.itens[categoryKey]) {
                Object.keys(turnoData.itens[categoryKey]).forEach(itemKey => {
                    const item = turnoData.itens[categoryKey][itemKey];
                    if (item) {
                        const entradaInput = document.getElementById(`${itemKey}_entrada`);
                        if (entradaInput) entradaInput.value = item.entrada || 0;
                        
                        const chegadasInput = document.getElementById(`${itemKey}_chegadas`);
                        if (chegadasInput) chegadasInput.value = item.chegadas || 0;
    
                        if (turnoData.status === 'fechado' || turnoAbertoLocalmente) {
                             const sobraInput = document.getElementById(`${itemKey}_sobra`);
                             if (sobraInput) sobraInput.value = item.sobra || 0;
                             const descarteInput = document.getElementById(`${itemKey}_descarte`);
                             if (descarteInput) descarteInput.value = item.descarte || 0;
                             const consumoInput = document.getElementById(`${itemKey}_consumo`);
                             if (consumoInput) consumoInput.value = item.consumo || 0;
                             
                             const vendidoInput = document.getElementById(`${itemKey}_vendido`);
                             if (vendidoInput && item.precoUnitario && !vendidoInput.dataset.price) {
                                 vendidoInput.dataset.price = item.precoUnitario;
                                 const precoDisplay = document.getElementById(`${itemKey}_preco_display`);
                                 if(precoDisplay) precoDisplay.textContent = formatToBRL(parseFloat(item.precoUnitario));
                                 }
                            }
                        }
                    });
                }
            });
        }
        
         if (turnoData.gelo && turnoData.gelo.gelo_pacote) {
        const geloItem = turnoData.gelo.gelo_pacote;
        const geloEntradaInput = document.getElementById(`gelo_pacote_entrada`);
        if (geloEntradaInput) geloEntradaInput.value = geloItem.entrada || 0;
        
        const geloChegadasInput = document.getElementById(`gelo_pacote_chegadas`);
        if (geloChegadasInput) geloChegadasInput.value = geloItem.chegadas || 0;

        if (turnoData.status === 'fechado' || turnoAbertoLocalmente) {
            const geloSobraInput = document.getElementById(`gelo_pacote_sobra`);
            if (geloSobraInput) geloSobraInput.value = geloItem.sobra || 0;
            const geloVendasInput = document.getElementById(`gelo_pacote_vendas`);
            if (geloVendasInput) geloVendasInput.value = geloItem.vendas || 0;
            const geloConsumoInput = document.getElementById(`gelo_pacote_consumo_interno`);
            if (geloConsumoInput) geloConsumoInput.value = geloItem.consumoInterno || 0;
             const precoGeloDisplay = document.getElementById(`gelo_pacote_preco_display`);
             if (geloItem.precoUnitario && precoGeloDisplay) {
                 precoGeloDisplay.textContent = formatToBRL(parseFloat(geloItem.precoUnitario));
             }
        }
    }

         if (turnoData.status === 'fechado') {
        document.getElementById('trocaGas').value = turnoData.trocaGas || 'nao';
        if (turnoData.formasPagamento) {
            Object.keys(turnoData.formasPagamento).forEach(key => {
                const inputId = 'pagamento' + key.charAt(0).toUpperCase() + key.slice(1);
                const inputEl = document.getElementById(inputId);
                if (inputEl) inputEl.value = formatToBRL(turnoData.formasPagamento[key] || 0);
            });
        }
            if (turnoData.caixaFinalDinheiro !== undefined && turnoData.caixaFinalMoedas !== undefined) {
            // Novo formato
            if (caixaFinalDinheiroInput) {
                caixaFinalDinheiroInput.value = formatToBRL(turnoData.caixaFinalDinheiro);
            }
            if (caixaFinalMoedasInput) {
                caixaFinalMoedasInput.value = formatToBRL(turnoData.caixaFinalMoedas);
            }
        } else if (caixaFinalContadoInput && turnoData.caixaFinalContado !== undefined) {
            // Formato antigo - dividir proporcionalmente
            const valorTotal = turnoData.caixaFinalContado || 0;
            if (caixaFinalDinheiroInput) {
                caixaFinalDinheiroInput.value = formatToBRL(valorTotal * 0.9);
            }
            if (caixaFinalMoedasInput) {
                caixaFinalMoedasInput.value = formatToBRL(valorTotal * 0.1);
            }
        }
    }
    
    calculateAll();
}

    function showError(message) {
        errorMessagesP.textContent = message;
        errorMessagesP.classList.remove('hidden');
    }

    function clearError() {
        errorMessagesP.textContent = '';
        errorMessagesP.classList.add('hidden');
    }
    
    window.addEventListener('online', function() {
        console.log('Online - sincronizando dados...');
        checkOpenTurno();
    });
    
    window.addEventListener('offline', function() {
        console.log('Offline - usando dados locais...');
        if (currentTurnoId) {
            turnoStatusP.textContent = "Você está offline. Usando dados locais do turno.";
            turnoStatusP.className = 'text-center text-yellow-600 font-semibold mb-4';
        }
    });

    window.addEventListener('beforeunload', function() {
        if (turnoAbertoLocalmente && currentTurnoId) {
        }
    });
    
    initializePage();
});

// Função para gerenciar indicadores de scroll
function setupScrollIndicators() {
    document.querySelectorAll('.table-scroll-container').forEach(container => {
        const scrollable = container.querySelector('.scrollable-table');
        const leftIndicator = container.querySelector('.scroll-indicator.left');
        const rightIndicator = container.querySelector('.scroll-indicator.right');
        
        if (!scrollable || !leftIndicator || !rightIndicator) return;
        
        function updateIndicators() {
            const scrollLeft = scrollable.scrollLeft;
            const scrollWidth = scrollable.scrollWidth;
            const clientWidth = scrollable.clientWidth;
            
            // Mostrar/ocultar indicadores baseado na posição do scroll
            leftIndicator.style.display = scrollLeft > 10 ? 'block' : 'none';
            rightIndicator.style.display = 
                scrollLeft < (scrollWidth - clientWidth - 10) ? 'block' : 'none';
        }
        
        // Atualizar indicadores no scroll
        scrollable.addEventListener('scroll', updateIndicators);
        
        // Atualizar no resize
        window.addEventListener('resize', updateIndicators);
        
        // Verificar inicial
        setTimeout(updateIndicators, 100);
    });
}

// Chamar após carregar as tabelas
setupScrollIndicators();

if (typeof getFormattedDate === 'undefined') {
    function getFormattedDate(date = new Date()) {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
}
if (typeof getFormattedTime === 'undefined') {
    function getFormattedTime(date = new Date()) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
}
if (typeof getCurrentMonth === 'undefined') {
    function getCurrentMonth() {
        const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        return months[new Date().getMonth()];
    }
}
if (typeof createInputCell === 'undefined') {
    function createInputCell(type, id, placeholder = '', value = '', readOnly = false, className = "w-full p-1 border rounded text-sm") {
        const td = document.createElement('td');
        td.className = 'px-1 py-1 whitespace-nowrap';
        const input = document.createElement('input');
        input.type = type;
        input.id = id;
        input.name = id;
        input.className = `${className} ${readOnly ? 'bg-gray-100 cursor-not-allowed' : 'bg-white focus:ring-orange-500 focus:border-orange-500'}`;
        input.placeholder = placeholder;
        input.value = value;
        if (readOnly) input.readOnly = true;
        if (type === 'number') {
            input.min = "0";
            input.step = "1";
            if (id.includes('preco') || id.includes('valor') || id.includes('caixa')) {
                input.step = "0.01";
            }
        }
        td.appendChild(input);
        return td;
    }
}