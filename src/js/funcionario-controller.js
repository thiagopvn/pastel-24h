document.addEventListener('DOMContentLoaded', async () => {
    // --- ELEMENTOS DA UI ---
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

    const caixaInicioInput = document.getElementById('caixaInicio');
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

    // === FUNÇÕES DE FORMATAÇÃO DE MOEDA ===
    
    /**
     * Aplica máscara de moeda brasileira ao input
     * Corrige o problema de conversão incorreta (378 -> 37800)
     */
    function applyCurrencyMask(input) {
        // Remove tudo que não é número
        let value = input.value.replace(/[^\d]/g, '');
        
        // Se estiver vazio, define como 0
        if (value === '') {
            input.value = formatToBRL(0);
            return 0;
        }
        
        // Converte para centavos (divide por 100)
        let numericValue = parseFloat(value) / 100;
        
        // Formata para moeda brasileira
        input.value = formatToBRL(numericValue);
        
        return numericValue;
    }

    /**
     * Converte valor formatado em moeda para número
     */
    function parseCurrencyToNumber(formattedValue) {
        if (!formattedValue) return 0;
        
        // Remove símbolos de moeda e converte vírgula para ponto
        const cleaned = formattedValue
            .replace(/[R$\s]/g, '')
            .replace(/\./g, '')
            .replace(',', '.');
        
        return parseFloat(cleaned) || 0;
    }

    /**
     * Formata número para moeda brasileira
     */
    function formatToBRL(value) {
        const numValue = parseFloat(value) || 0;
        return numValue.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    }

    /**
     * Configura máscara de moeda para um campo
     */
    function setupCurrencyMask(inputElement) {
        if (!inputElement) return;
        
        // Aplica máscara ao digitar
        inputElement.addEventListener('input', function() {
            applyCurrencyMask(this);
            // Atualiza cálculos após aplicar máscara
            setTimeout(() => {
                updatePaymentTotalsAndDivergence();
            }, 100);
        });
        
        // Aplica máscara ao perder foco
        inputElement.addEventListener('blur', function() {
            applyCurrencyMask(this);
            updatePaymentTotalsAndDivergence();
        });
        
        // Aplica formatação inicial se já tiver valor
        if (inputElement.value && !inputElement.readOnly) {
            applyCurrencyMask(inputElement);
        }
    }

    // === FUNÇÕES DE PERSISTÊNCIA LOCAL ===
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

    // === FUNÇÕES DE INICIALIZAÇÃO E ESTADO ===
    async function initializePage() {
        // Prevenção contra chamadas recursivas
        if (isInitializing) return;
        isInitializing = true;
        
        showLoadingState(true, "Carregando dados iniciais...");
        try {
            await loadProductPrices();
            populateProductTables();
            
            // NOVO: Configura máscaras de moeda
            setupAllCurrencyMasks();
            
            // Verificar e armazenar dados do último turno fechado para transferência
            await carregarDadosTurnoAnterior();
            
            // Verifica se existe um turno em andamento, primeiro localmente e depois no Firestore
            const localTurno = getTurnoLocal();
            
            if (localTurno && localTurno.status === 'aberto') {
                // Temos um turno guardado localmente, vamos verificar se ele ainda existe no Firestore
                await checkAndSyncTurnoWithFirestore(localTurno.id);
            } else {
                // Caso não haja turno local, busca no Firestore (pode haver um aberto em outro dispositivo)
                await checkOpenTurnoInFirestore();
            }
            
            // Configura listener para mudanças no Firestore
            setupTurnoListener();
            
            setupEventListeners();
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

    // NOVA FUNÇÃO: Carrega dados do último turno fechado
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

    // Novo método para estabelecer um listener em tempo real no Firestore
    function setupTurnoListener() {
        // Cancela qualquer listener anterior
        if (unsubscribeTurnoListener) {
            unsubscribeTurnoListener();
        }

        // Não configura listener se não houver turno aberto
        if (!currentTurnoId) return;

        // Configura listener para o documento do turno atual
        unsubscribeTurnoListener = db.collection('turnos').doc(currentTurnoId)
            .onSnapshot((doc) => {
                if (doc.exists) {
                    const turnoData = doc.data();
                    if (turnoData.status === 'aberto') {
                        // Atualiza os dados locais se houver mudanças
                        saveTurnoLocal({ id: doc.id, ...turnoData });
                        
                        // Só atualiza o formulário se estiver diferente ou se for primeiro carregamento
                        if (!turnoAbertoLocalmente) {
                            loadTurnoDataToForm(turnoData);
                            populateTurnoDetails(turnoData.abertura);
                            turnoAbertoLocalmente = true;
                            toggleFormInputs(true);
                            btnAbrirTurno.disabled = true;
                            btnFecharTurno.disabled = false;
                            turnoStatusP.textContent = `Turno ${currentTurnoId.split('_')[1]} de ${currentTurnoId.split('_')[0]} está aberto.`;
                            turnoStatusP.className = 'text-center text-blue-600 font-semibold mb-4';
                        }
                    } else if (turnoData.status === 'fechado') {
                        // Turno foi fechado em outro dispositivo/sessão
                        removeTurnoLocal();
                        resetFormAndState("Turno foi fechado em outro dispositivo/sessão.");
                    }
                } else {
                    // Documento não existe mais - algo errado aconteceu
                    removeTurnoLocal();
                    resetFormAndState("Turno não encontrado no servidor. Pode ter sido removido.");
                }
            }, (error) => {
                console.error("Erro no listener do turno:", error);
            });
    }

    // Verifica e sincroniza com Firestore um turno salvo localmente
    async function checkAndSyncTurnoWithFirestore(turnoId) {
        try {
            const turnoDoc = await db.collection('turnos').doc(turnoId).get();
            
            if (turnoDoc.exists) {
                const turnoData = turnoDoc.data();
                
                if (turnoData.status === 'aberto') {
                    // Turno ainda está aberto no Firestore
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
                    // Turno fechado no servidor
                    removeTurnoLocal();
                    resetFormAndState("O turno foi fechado em outra sessão.");
                }
            } else {
                // Turno não existe mais no Firestore
                removeTurnoLocal();
                resetFormAndState("Turno salvo localmente não existe mais no servidor.");
            }
        } catch (error) {
            console.error("Erro ao verificar turno no Firestore:", error);
            
            // Se offline, usa dados locais com alerta
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

    // Verifica se há turnos abertos no Firestore
    async function checkOpenTurnoInFirestore() {
        try {
            // Recupera o usuário atual
            const user = auth.currentUser;
            if (!user) {
                showError("Usuário não autenticado. Faça login novamente.");
                return;
            }

            // Busca turnos abertos para o usuário atual
            const turnosQuery = await db.collection('turnos')
                .where('status', '==', 'aberto')
                .where('abertura.responsavelId', '==', user.uid)
                .get();

            if (!turnosQuery.empty) {
                // Encontrou um turno aberto
                const turnoDoc = turnosQuery.docs[0];
                const turnoData = turnoDoc.data();
                currentTurnoId = turnoDoc.id;
                
                // Salva localmente
                saveTurnoLocal({ id: turnoDoc.id, ...turnoData });
                
                // Carrega no formulário
                loadTurnoDataToForm(turnoData);
                populateTurnoDetails(turnoData.abertura);
                
                btnAbrirTurno.disabled = true;
                btnFecharTurno.disabled = false;
                turnoStatusP.textContent = `Turno ${turnoDoc.id.split('_')[1]} de ${turnoDoc.id.split('_')[0]} está aberto.`;
                turnoStatusP.className = 'text-center text-blue-600 font-semibold mb-4';
                turnoAbertoLocalmente = true;
                toggleFormInputs(true);
            } else {
                // Não há turno aberto
                resetFormAndState("Nenhum turno aberto encontrado.");
            }
        } catch (error) {
            console.error("Erro ao verificar turnos abertos no Firestore:", error);
            resetFormAndState("Erro ao verificar turnos abertos. Verifique sua conexão.");
        }
    }

    // Método adaptado para usar os novos métodos
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
        if (turnoAbertoLocalmente || currentTurnoId) return; // Não muda se já houver um turno
        const currentHour = new Date().getHours();
        if (currentHour >= 6 && currentHour < 14) {
            turnoPeriodoSelect.value = 'Manhã';
        } else if (currentHour >= 14 && currentHour < 22) {
            turnoPeriodoSelect.value = 'Tarde';
        } else { 
            turnoPeriodoSelect.value = 'Noite'; 
        }
    }

    async function loadProductPrices() {
        try {
            const snapshot = await db.collection('produtos').get();
            productPrices = {}; // Limpa antes de preencher
            snapshot.forEach(doc => {
                productPrices[doc.id] = doc.data();
            });
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
    
    function populateProductTables() {
        tabelaPasteisBody.innerHTML = '';
        tabelaCasquinhasBody.innerHTML = '';
        tabelaCaldoCanaBody.innerHTML = '';
        tabelaRefrigerantesBody.innerHTML = '';
        tabelaGeloBody.innerHTML = '';

        const localListaSaboresPasteis = typeof listaSaboresPasteis !== 'undefined' ? listaSaboresPasteis : [];
        localListaSaboresPasteis.forEach(sabor => {
            const key = sabor.toLowerCase().replace(/\s+/g, '_').replace(/[ç]/g, 'c').replace(/[ãâáàä]/g, 'a').replace(/[éêèë]/g, 'e').replace(/[íìîï]/g, 'i').replace(/[óôõòö]/g, 'o').replace(/[úùûü]/g, 'u');
            const row = createProductRowWithChegadas(sabor, key, 'pasteis', productPrices, true); // Inicialmente readonly
            tabelaPasteisBody.appendChild(row);
        });

        const localListaCasquinhas = typeof listaCasquinhas !== 'undefined' ? listaCasquinhas : [];
        localListaCasquinhas.forEach(casquinha => {
            const key = casquinha.toLowerCase().replace(/\s+/g, '_');
            const row = createProductRowWithChegadas(casquinha, key, 'casquinhas', productPrices, true);
            tabelaCasquinhasBody.appendChild(row);
        });

        const localListaCaldoCana = typeof listaCaldoCana !== 'undefined' ? listaCaldoCana : [];
        localListaCaldoCana.forEach(item => {
            const key = item.toLowerCase().replace(/\s+/g, '_').replace(/[ç]/g, 'c').replace(/\d+ml/, d => d.toLowerCase()).replace(/\d+litro/, d => d.toLowerCase());
            const row = createProductRowWithChegadas(item, key, 'caldo_cana', productPrices, true);
            tabelaCaldoCanaBody.appendChild(row);
        });

        const localListaRefrigerantes = typeof listaRefrigerantes !== 'undefined' ? listaRefrigerantes : [];
        localListaRefrigerantes.forEach(item => {
            const key = item.toLowerCase().replace(/\s+/g, '_').replace(/[ç]/g, 'c').replace(/\./g, '');
            const row = createProductRowWithChegadas(item, key, 'refrigerantes', productPrices, true);
            tabelaRefrigerantesBody.appendChild(row);
        });
        
        // GELO COM NOVA ESTRUTURA (Entrada + Chegadas)
        const geloKey = 'gelo_pacote';
        const trGelo = document.createElement('tr');
        trGelo.className = 'border-b item-row';
        trGelo.dataset.itemKey = geloKey;
        trGelo.dataset.categoryKey = 'gelo'; 
        
        const tdGeloName = document.createElement('td');
        tdGeloName.className = 'px-2 py-2 font-medium';
        tdGeloName.textContent = 'Gelo (Pacote)';
        trGelo.appendChild(tdGeloName);
        
        // Gelo: entrada, chegadas, sobra, vendas, consumo_interno
        trGelo.appendChild(createInputCell('number', `${geloKey}_entrada`, '0', '', true, "w-full p-1 border rounded text-sm")); // entrada
        trGelo.appendChild(createInputCell('number', `${geloKey}_chegadas`, '0', '', true, "w-full p-1 border rounded text-sm col-chegadas")); // chegadas
        trGelo.appendChild(createInputCell('number', `${geloKey}_sobra`, '0', '', true, "w-full p-1 border rounded text-sm"));   // sobra
        const tdVendasGelo = createInputCell('number', `${geloKey}_vendas`, '0', '', true, "w-full p-1 border rounded text-sm"); // vendas
        tdVendasGelo.querySelector('input').dataset.isGeloVenda = "true"; // Marcação para event listener
        trGelo.appendChild(tdVendasGelo);
        trGelo.appendChild(createInputCell('number', `${geloKey}_consumo_interno`, '0', '', true, "w-full p-1 border rounded text-sm"));// consumo_interno
        
        const tdPrecoGelo = document.createElement('td');
        tdPrecoGelo.className = 'px-2 py-2 text-sm text-gray-600';
        const precoGeloUnit = productPrices.gelo?.[geloKey]?.preco || 0;
        tdPrecoGelo.textContent = formatToBRL(precoGeloUnit);
        tdPrecoGelo.id = `${geloKey}_preco_display`;
        trGelo.appendChild(tdPrecoGelo);
        
        const tdTotalGelo = document.createElement('td');
        tdTotalGelo.className = 'px-2 py-2 text-sm text-gray-700 font-semibold';
        tdTotalGelo.id = `${geloKey}_total_item`; 
        tdTotalGelo.textContent = formatToBRL(0);
        trGelo.appendChild(tdTotalGelo);
        
        tabelaGeloBody.appendChild(trGelo);
    }

    // NOVA FUNÇÃO: Cria linha de produto com coluna CHEGADAS
    function createProductRowWithChegadas(itemName, itemKey, categoryKey, prices, isReadOnly = false) {
        const tr = document.createElement('tr');
        tr.className = 'border-b item-row hover:bg-orange-50 transition-colors duration-150';
        tr.dataset.itemKey = itemKey;
        tr.dataset.categoryKey = categoryKey;

        const tdName = document.createElement('td');
        tdName.className = 'px-3 py-2 font-medium text-gray-800';
        tdName.textContent = itemName;
        tr.appendChild(tdName);

        // Entrada (do turno anterior)
        tr.appendChild(createInputCell('number', `${itemKey}_entrada`, '0', '', isReadOnly));
        
        // NOVA COLUNA: Chegadas (editável durante o turno)
        const tdChegadas = createInputCell('number', `${itemKey}_chegadas`, '0', '', isReadOnly, "w-full p-1 border rounded text-sm");
        tdChegadas.classList.add('col-chegadas'); // Destaque visual
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

    // NOVA FUNÇÃO: Adiciona indicador visual para campos transferidos do turno anterior
    function adicionarIndicadorCampoTransferido(elemento, origem) {
        if (!elemento) return;
        
        // Adiciona classe de estilo para destacar visualmente
        elemento.classList.add('bg-blue-50', 'border-blue-300');
        
        // Armazena informação de que este campo veio do turno anterior
        elemento.dataset.transferidoDoTurno = origem || 'turno-anterior';
        elemento.dataset.valorOriginal = elemento.value;
        
        // Adiciona um pequeno indicador visual ao lado do campo
        const parentElement = elemento.parentElement;
        if (parentElement && !parentElement.querySelector('.indicador-transferido')) {
            const indicador = document.createElement('span');
            indicador.className = 'indicador-transferido text-xs text-blue-600 ml-1';
            indicador.innerHTML = '<i class="fas fa-exchange-alt"></i>';
            indicador.title = 'Valor transferido do turno anterior - Não editável';
            parentElement.appendChild(indicador);
        }
        
        // Rastreia este campo para validação
        const campoId = elemento.id || `campo-${Math.random().toString(36).substring(2, 9)}`;
        camposTransferidosAnterior[campoId] = {
            elemento: elemento,
            valorOriginal: elemento.value
        };
    }

    function toggleFormInputs(isTurnoOpenForEditing) {
        // Habilita/Desabilita todos os campos do formulário de acordo com o estado do turno
        const allInputsAndSelects = formTurno.querySelectorAll('input, select');
        allInputsAndSelects.forEach(el => {
            if (el.id === 'turnoPeriodo') {
                el.disabled = isTurnoOpenForEditing; // Período só editável antes de abrir
                if(el.disabled) el.classList.add('bg-gray-200'); else el.classList.remove('bg-gray-200');
                return;
            }
             // Campos de ID do turno são sempre readonly, mas podem precisar de estilo
            if (['turnoMes', 'turnoData', 'turnoResponsavel', 'turnoHora'].includes(el.id)) {
                 el.classList.add('bg-gray-100'); // Sempre aparência de não editável
                return; // Não precisa mudar readOnly, já é por padrão.
            }
             // Campos de "Vendido" e "Total Item" são sempre calculados e não-editáveis diretamente
            if (el.id.endsWith('_vendido') || el.id.endsWith('_total_item')) {
                el.readOnly = true;
                el.classList.add('bg-gray-100');
                return;
            }
            
            // Se o campo foi transferido do turno anterior, ele deve permanecer readonly
            if (el.dataset.transferidoDoTurno) {
                el.readOnly = true;
                return;
            }

            // Lógica geral para os demais campos
            el.readOnly = !isTurnoOpenForEditing;
            if (el.readOnly) {
                el.classList.add('bg-gray-100'); // Aparência de desabilitado
                el.classList.remove('focus:ring-orange-500', 'focus:border-orange-500'); // Remove foco visual
            } else {
                el.classList.remove('bg-gray-100');
                el.classList.add('focus:ring-orange-500', 'focus:border-orange-500');
            }
        });
         // Após abrir o turno, 'entrada' deve ficar readonly, mas 'chegadas' editável
         if (turnoAbertoLocalmente || currentTurnoId) { // Significa que o turno está "em andamento"
            if(caixaInicioInput) caixaInicioInput.readOnly = true;
            if(caixaInicioInput) caixaInicioInput.classList.add('bg-gray-100');
            
            // Entrada fica readonly (vem do turno anterior)
            document.querySelectorAll('input[id$="_entrada"]').forEach(inp => {
                inp.readOnly = true;
                inp.classList.add('bg-gray-100');
            });
            
            // Chegadas ficam editáveis durante o turno (se não for transferido)
            document.querySelectorAll('input[id$="_chegadas"]').forEach(inp => {
                if (!inp.dataset.transferidoDoTurno) {
                    inp.readOnly = false;
                    inp.classList.remove('bg-gray-100');
                    inp.classList.add('focus:ring-orange-500', 'focus:border-orange-500');
                }
            });
        } else { // Se nenhum turno aberto, entrada e chegadas estão disponíveis para o "Abrir Turno"
             if(caixaInicioInput) caixaInicioInput.readOnly = false;
             if(caixaInicioInput) caixaInicioInput.classList.remove('bg-gray-100');
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
        
        // Limpar totais e campos calculados para garantir que não haja lixo visual
        document.querySelectorAll('input[id$="_vendido"]').forEach(el => el.value = '0');
        document.querySelectorAll('input[id$="_chegadas"]').forEach(el => el.value = '0'); // NOVO: limpar chegadas
        document.querySelectorAll('td[id$="_total_item"]').forEach(el => el.textContent = formatToBRL(0));
        if(totalVendidoTurnoCalculadoInput) totalVendidoTurnoCalculadoInput.value = formatToBRL(0);
        if(totalRegistradoPagamentosInput) totalRegistradoPagamentosInput.value = formatToBRL(0);
        if(caixaDiferencaInput) caixaDiferencaInput.value = formatToBRL(0);
        if(caixaDiferencaContainer) caixaDiferencaContainer.className = "p-3 rounded-md"; // Reseta cor de fundo

        document.querySelectorAll('td[id^="total"]').forEach(el => {
            if (el.id.includes('Vendido')) el.textContent = '0';
            else if (el.id.includes('Valor')) el.textContent = formatToBRL(0);
        });
        if (divergenciaCaixaAlertaP) divergenciaCaixaAlertaP.textContent = '';
        if (fechamentoDivergenciaAlertaGeralDiv) fechamentoDivergenciaAlertaGeralDiv.classList.add('hidden');
        if (fechamentoDivergenciaAlertaGeralDiv) fechamentoDivergenciaAlertaGeralDiv.textContent = '';
        
        // Limpa campos específicos de Gelo
        const geloKey = 'gelo_pacote';
        const totalGeloDisplay = document.getElementById(`${geloKey}_total_item`);
        if (totalGeloDisplay) totalGeloDisplay.textContent = formatToBRL(0);
        const totalFooterGelo = document.getElementById('totalGeloValor');
        if (totalFooterGelo) totalFooterGelo.textContent = formatToBRL(0);
        
        // Remove todos os indicadores de campos transferidos
        document.querySelectorAll('.indicador-transferido').forEach(el => el.remove());
        document.querySelectorAll('[data-transferido-do-turno]').forEach(el => {
            el.removeAttribute('data-transferido-do-turno');
            el.removeAttribute('data-valor-original');
            el.classList.remove('bg-blue-50', 'border-blue-300');
        });
        camposTransferidosAnterior = {};
        
        calculateAll(); // Garante que os totais gerais sejam zerados
    }
    
    function populateTurnoDetails(aberturaData) {
        turnoMesInput.value = aberturaData.mes;
        turnoDataInput.value = aberturaData.data;
        turnoResponsavelInput.value = aberturaData.responsavelNome;
        turnoHoraInput.value = aberturaData.hora;
        turnoPeriodoSelect.value = aberturaData.periodo;
        turnoPeriodoSelect.disabled = true; // Não pode mudar período após abrir
        turnoPeriodoSelect.classList.add('bg-gray-200');
    }

    // === FUNÇÕES DE CONTROLE DE CAIXA ===

    /**
     * CORRIGIDO: Soma campos de pagamento, atualiza total registrado e calcula divergência
     */
    function updatePaymentTotalsAndDivergence() {
        console.log("🔄 Atualizando totais de pagamento e divergências...");
        
        // Elementos dos campos de pagamento
        const paymentInputs = {
            dinheiro: document.getElementById('pagamentoDinheiro'),
            pixManual: document.getElementById('pagamentoPixManual'),
            stoneDCV: document.getElementById('pagamentoStoneDCV'),
            stoneVoucher: document.getElementById('pagamentoStoneVoucher'),
            pagbankDCV: document.getElementById('pagamentoPagBankDCV')
        };
        
        // Soma todos os valores de pagamento
        let totalRegistrado = 0;
        const paymentValues = {};
        
        Object.entries(paymentInputs).forEach(([key, input]) => {
            if (input) {
                const value = parseCurrencyToNumber(input.value);
                paymentValues[key] = value;
                totalRegistrado += value;
            }
        });
        
        // Atualiza o campo "Total Registrado"
        if (totalRegistradoPagamentosInput) {
            totalRegistradoPagamentosInput.value = formatToBRL(totalRegistrado);
        }
        
        // Calcula divergência com total vendido
        const totalVendido = parseCurrencyToNumber(totalVendidoTurnoCalculadoInput?.value || '0');
        const divergenciaVendas = totalVendido - totalRegistrado;
        
        console.log(`📊 Total Vendido: ${formatToBRL(totalVendido)}`);
        console.log(`💰 Total Registrado: ${formatToBRL(totalRegistrado)}`);
        console.log(`⚖️ Divergência: ${formatToBRL(divergenciaVendas)}`);
        
        // Atualiza display de divergência de vendas vs pagamentos
        updateSalesDivergenceDisplay(divergenciaVendas, totalVendido, totalRegistrado);
        
        // Atualiza também a diferença de caixa físico
        updatePhysicalCashDifference();
        
        return {
            totalRegistrado,
            totalVendido,
            divergenciaVendas,
            paymentValues
        };
    }

    /**
     * NOVO: Atualiza display de divergência entre vendas e pagamentos
     */
    function updateSalesDivergenceDisplay(divergencia, totalVendido, totalRegistrado) {
        let alertContainer = document.getElementById('salesDivergenceAlert');
        
        // Cria o container se não existir
        if (!alertContainer) {
            alertContainer = document.createElement('div');
            alertContainer.id = 'salesDivergenceAlert';
            alertContainer.className = 'mt-4 p-4 rounded-lg border';
            
            // Adiciona após o campo Total Registrado
            const totalRegistradoParent = totalRegistradoPagamentosInput?.parentElement?.parentElement;
            if (totalRegistradoParent) {
                totalRegistradoParent.insertAdjacentElement('afterend', alertContainer);
            }
        }
        
        if (Math.abs(divergencia) < 0.01) {
            // Sem divergência - sinal verde
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
        } else {
            // Com divergência - sinal vermelho
            alertContainer.className = 'mt-4 p-4 rounded-lg border bg-red-50 border-red-300';
            const diferenca = Math.abs(divergencia);
            const tipo = divergencia > 0 ? 'faltam nos pagamentos' : 'sobram nos pagamentos';
            
            alertContainer.innerHTML = `
                <div class="text-red-700">
                    <div class="flex items-center mb-2">
                        <i class="fas fa-exclamation-triangle mr-2 text-lg"></i>
                        <strong>🚨 Divergência detectada!</strong>
                    </div>
                    <div class="text-sm bg-white bg-opacity-50 p-3 rounded">
                        <div class="grid grid-cols-2 gap-2">
                            <div>📈 <strong>Total Vendido:</strong></div>
                            <div>${formatToBRL(totalVendido)}</div>
                            <div>💳 <strong>Total Pagamentos:</strong></div>
                            <div>${formatToBRL(totalRegistrado)}</div>
                            <div>⚖️ <strong>Diferença:</strong></div>
                            <div class="font-bold text-red-600">${formatToBRL(diferenca)} (${tipo})</div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * CORRIGIDO: Compara caixa físico contado vs (caixa inicial + pagamentos em dinheiro)
     */
    function updatePhysicalCashDifference() {
        console.log("🏦 Atualizando diferença de caixa físico...");
        
        // Pega os valores
        const caixaInicial = parseCurrencyToNumber(caixaInicioInput?.value || '0');
        const pagamentoDinheiro = parseCurrencyToNumber(pagamentoDinheiroInput?.value || '0');
        const caixaFinalContado = parseCurrencyToNumber(caixaFinalContadoInput?.value || '0');
        
        // Calcula o que deveria ter no caixa físico
        const caixaEsperado = caixaInicial + pagamentoDinheiro;
        
        // Calcula a diferença
        const diferencaCaixa = caixaFinalContado - caixaEsperado;
        
        console.log(`💰 Caixa Inicial: ${formatToBRL(caixaInicial)}`);
        console.log(`💵 Pagamento Dinheiro: ${formatToBRL(pagamentoDinheiro)}`);
        console.log(`🎯 Caixa Esperado: ${formatToBRL(caixaEsperado)}`);
        console.log(`🔢 Caixa Contado: ${formatToBRL(caixaFinalContado)}`);
        console.log(`⚖️ Diferença: ${formatToBRL(diferencaCaixa)}`);
        
        // Atualiza o display
        if (caixaDiferencaInput) {
            caixaDiferencaInput.value = formatToBRL(diferencaCaixa);
        }
        
        if (caixaDiferencaContainer && divergenciaCaixaAlertaP) {
            if (Math.abs(diferencaCaixa) < 0.01) {
                // Sem diferença - verde
                caixaDiferencaContainer.className = 'p-4 rounded-lg bg-green-50 border border-green-300';
                divergenciaCaixaAlertaP.className = 'text-sm mt-2 text-green-700 font-medium';
                divergenciaCaixaAlertaP.innerHTML = `
                    <i class="fas fa-check-circle mr-1"></i>
                    ✅ Caixa físico confere perfeitamente! (${formatToBRL(caixaFinalContado)})
                `;
            } else {
                // Com diferença - vermelho ou amarelo
                const isPositive = diferencaCaixa > 0;
                const bgClass = isPositive ? 'bg-yellow-50 border-yellow-300' : 'bg-red-50 border-red-300';
                const textClass = isPositive ? 'text-yellow-700' : 'text-red-700';
                const tipo = isPositive ? 'sobra' : 'falta';
                const icon = isPositive ? 'fa-info-circle' : 'fa-exclamation-triangle';
                const emoji = isPositive ? '⚠️' : '🚨';
                
                caixaDiferencaContainer.className = `p-4 rounded-lg ${bgClass}`;
                divergenciaCaixaAlertaP.className = `text-sm mt-2 ${textClass} font-medium`;
                divergenciaCaixaAlertaP.innerHTML = `
                    <i class="fas ${icon} mr-1"></i>
                    ${emoji} ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} de ${formatToBRL(Math.abs(diferencaCaixa))} no caixa físico
                    <br><small class="opacity-75">Esperado: ${formatToBRL(caixaEsperado)} | Contado: ${formatToBRL(caixaFinalContado)}</small>
                `;
            }
        }
        
        return {
            caixaInicial,
            pagamentoDinheiro,
            caixaEsperado,
            caixaFinalContado,
            diferencaCaixa,
            isValid: Math.abs(diferencaCaixa) < 0.01
        };
    }

    /**
     * Configura máscaras de moeda para todos os campos monetários
     */
    function setupAllCurrencyMasks() {
        console.log("🎭 Configurando máscaras de moeda...");
        
        const currencyFields = [
            'caixaInicio',
            'pagamentoDinheiro',
            'pagamentoPixManual', 
            'pagamentoStoneDCV',
            'pagamentoStoneVoucher',
            'pagamentoPagBankDCV',
            'caixaFinalContado'
        ];
        
        currencyFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                setupCurrencyMask(field);
                console.log(`✅ Máscara configurada para: ${fieldId}`);
            }
        });
    }

    // === AÇÕES DE TURNO ===
    if (btnAbrirTurno) {
        btnAbrirTurno.addEventListener('click', async () => {
            clearError();
            const caixaInicialVal = parseCurrencyToNumber(caixaInicioInput.value);
            if (isNaN(caixaInicialVal) || caixaInicialVal < 0) {
                showError("Caixa Inicial inválido. Por favor, insira um valor numérico positivo ou zero.");
                caixaInicioInput.focus();
                caixaInicioInput.classList.add('border-red-500');
                return;
            }
            caixaInicioInput.classList.remove('border-red-500');

            const dataAtual = getFormattedDate();
            const periodoSelecionado = turnoPeriodoSelect.value;
            const turnoIdProposto = `${dataAtual}_${periodoSelecionado}`;

            showLoadingState(true, "Abrindo turno...");

            try {
                // Verificação adicional: transação para garantir que não exista outro turno aberto
                await db.runTransaction(async (transaction) => {
                    // Verificar se o turno proposto já existe
                    const turnoRef = db.collection('turnos').doc(turnoIdProposto);
                    const turnoDoc = await transaction.get(turnoRef);
                    
                    if (turnoDoc.exists) {
                        throw new Error(`Já existe um turno (${periodoSelecionado}) registrado para hoje (${dataAtual}).`);
                    }
                    
                    // Verificar se há algum outro turno aberto para este funcionário
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
                    
                    // Se chegou aqui, está tudo ok
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

                populateTurnoDetails(aberturaDataObj); // Atualiza os campos de Mês, Data, Hora, Período no form

                // MODIFICADO: Usar o turno anterior para preencher entradas e caixa inicial
                const estoqueAnterior = await getEstoqueInicial(dataAtual, periodoSelecionado);
                
                // TRANSFERÊNCIA AUTOMÁTICA: Preenche as entradas dos itens com base no estoque anterior
                let itensTransferidosCount = 0;
                
                Object.keys(estoqueAnterior.itens || {}).forEach(categoryKey => {
                    Object.keys(estoqueAnterior.itens[categoryKey] || {}).forEach(itemKey => {
                        const inputEntrada = document.getElementById(`${itemKey}_entrada`);
                        if (inputEntrada) {
                            const sobraAnterior = estoqueAnterior.itens[categoryKey][itemKey].sobra || 0;
                            inputEntrada.value = sobraAnterior;
                                    
                            // Marca como transferido para validação e estilo visual
                            adicionarIndicadorCampoTransferido(inputEntrada, estoqueAnterior.turnoId);
                            itensTransferidosCount++;
                        }
                    });
                });
                        
                const inputEntradaGelo = document.getElementById(`gelo_pacote_entrada`);
                if (inputEntradaGelo && estoqueAnterior.gelo?.gelo_pacote?.sobra) {
                    inputEntradaGelo.value = estoqueAnterior.gelo.gelo_pacote.sobra;
                            
                    // Marca como transferido para validação e estilo visual
                    adicionarIndicadorCampoTransferido(inputEntradaGelo, estoqueAnterior.turnoId);
                    itensTransferidosCount++;
                }
                        
                // TRANSFERÊNCIA AUTOMÁTICA: Se tiver caixa final no turno anterior, usar como caixa inicial
                if (estoqueAnterior.caixaFinal !== undefined && caixaInicioInput) {
                    caixaInicioInput.value = formatToBRL(estoqueAnterior.caixaFinal);
                            
                    // Marca como transferido para validação e estilo visual
                    adicionarIndicadorCampoTransferido(caixaInicioInput, estoqueAnterior.turnoId);
                }

                if (estoqueAnterior.turnoId) {
                    adicionarResumoTurnoAnterior(estoqueAnterior.turnoId, estoqueAnterior);
                }

                const initialItensData = collectItemData(true); // Coleta apenas entradas, chegadas e preços unitários

                const turnoDataToSave = {
                    abertura: aberturaDataObj,
                    status: 'aberto',
                    caixaInicial: parseCurrencyToNumber(caixaInicioInput.value) || 0,
                    itens: initialItensData.itens,
                    gelo: initialItensData.gelo,
                    turnoAnteriorId: estoqueAnterior.turnoId, // Armazena o ID do turno anterior para rastreabilidade
                    dadosTransferidos: {
                        quantidadeItens: itensTransferidosCount,
                        caixaTransferido: estoqueAnterior.caixaFinal !== undefined,
                        formasPagamentoAnterior: Object.keys(estoqueAnterior.formasPagamento || {}).length > 0,
                        trocaGasAnterior: estoqueAnterior.trocaGas === 'sim'
                    },
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                };

                // Salva no Firestore
                await db.collection('turnos').doc(turnoIdProposto).set(turnoDataToSave);
                
                // Salva localmente
                saveTurnoLocal({
                    id: turnoIdProposto,
                    ...turnoDataToSave
                });
                
                turnoAbertoLocalmente = true;
                btnAbrirTurno.disabled = true;
                btnFecharTurno.disabled = false;
                        
                // Mensagem de status com informação sobre os dados transferidos
                let statusMsg = `Turno ${periodoSelecionado} de ${dataAtual} aberto com sucesso!`;
                if (itensTransferidosCount > 0 || estoqueAnterior.caixaFinal !== undefined) {
                    statusMsg += ` Dados transferidos: ${itensTransferidosCount} item(ns)`;
                    if (estoqueAnterior.caixaFinal !== undefined) {
                        statusMsg += ` e caixa inicial (${formatToBRL(estoqueAnterior.caixaFinal)})`;
                    }
                }
                turnoStatusP.textContent = statusMsg;
                turnoStatusP.className = 'text-center text-green-600 font-semibold mb-4';
                
                toggleFormInputs(true); // Habilita campos para fechamento, entradas ficam readonly, chegadas editáveis
                
                // Ativa listener para mudanças remotas
                setupTurnoListener();
                
                calculateAll();
                        
            } catch (error) {
                console.error("Erro ao abrir turno: ", error);
                showError("Falha ao abrir turno: " + error.message + ". Verifique suas permissões ou contate o suporte.");
                resetFormAndState("Erro ao tentar abrir o turno."); // Reseta se a abertura falhar
            } finally {
                showLoadingState(false);
            }
        });
    }
    
    async function getEstoqueInicial(dataTurnoAtual, periodoTurnoAtual) {
        let dataAnterior = dataTurnoAtual;
        let periodoAnterior;

        const diaAtualDate = new Date(dataTurnoAtual.replace(/-/g, '/')); // Safari friendly date

        if (periodoTurnoAtual === "Manhã") {
            periodoAnterior = "Noite";
            const ontem = new Date(diaAtualDate);
            ontem.setDate(ontem.getDate() - 1); 
            dataAnterior = getFormattedDate(ontem); 
        } else if (periodoTurnoAtual === "Tarde") {
            periodoAnterior = "Manhã";
        } else { // Noite
            periodoAnterior = "Tarde";
        }
        const idTurnoAnterior = `${dataAnterior}_${periodoAnterior}`;

        try {
            const turnoAnteriorDoc = await db.collection('turnos').doc(idTurnoAnterior).get();
            if (turnoAnteriorDoc.exists && turnoAnteriorDoc.data().status === 'fechado') {
                const dados = turnoAnteriorDoc.data();
                const estoqueFinal = { 
                    itens: {}, 
                    gelo: {}, 
                    turnoId: idTurnoAnterior,
                    caixaFinal: null,  // NOVO: Para transferir caixa
                    formasPagamento: dados.formasPagamento || {},
                    trocaGas: dados.trocaGas || 'nao',
                    totalVendidoCalculado: dados.totalVendidoCalculadoFinal,
                    totalRegistradoPagamentos: dados.totalRegistradoPagamentosFinal,
                    diferencaCaixa: dados.diferencaCaixaFinal,
                    fechamentoData: dados.fechamento || {},
                    fechamentoTimestamp: dados.closedAt || null
                };
                
                // Transfere itens do inventário (apenas SOBRA vai para próxima ENTRADA)
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
                
                // Transfere gelo (apenas SOBRA vai para próxima ENTRADA)
                if (dados.gelo && dados.gelo.gelo_pacote) { 
                    estoqueFinal.gelo.gelo_pacote = { 
                        sobra: dados.gelo.gelo_pacote.sobra || 0,
                        precoUnitario: dados.gelo.gelo_pacote.precoUnitario,
                        vendas: dados.gelo.gelo_pacote.vendas,
                        totalItemValor: dados.gelo.gelo_pacote.totalItemValor,
                        chegadas: dados.gelo.gelo_pacote.chegadas || 0
                    };
                }
                
                // NOVO: TRANSFERÊNCIA DE CAIXA - Pegar o caixa final do turno anterior
                if (dados.caixaFinalContado !== undefined) {
                    estoqueFinal.caixaFinal = dados.caixaFinalContado;
                    console.log(`💰 Transferindo caixa: ${formatToBRL(dados.caixaFinalContado)} do turno ${idTurnoAnterior}`);
                }
                
                return estoqueFinal;
            }
            console.warn(`Estoque do turno anterior (${idTurnoAnterior}) não encontrado ou não fechado. Iniciando com estoque zero.`);
        } catch (error) {
            console.error("Erro ao buscar estoque do turno anterior:", error);
        }
        return { 
            itens: {}, 
            gelo: {}, 
            turnoId: null, 
            caixaFinal: null,
            formasPagamento: {},
            trocaGas: 'nao',
            totalVendidoCalculado: 0,
            totalRegistradoPagamentos: 0,
            diferencaCaixa: 0,
            fechamentoData: {},
            fechamentoTimestamp: null
        };
    }

    // 2. Adicionar função para criar resumo do turno anterior
    function adicionarResumoTurnoAnterior(turnoAnteriorId, estoqueAnterior) {
        if (!turnoAnteriorId) return;
        
        // Remover resumo anterior se existir
        const resumoExistente = document.getElementById('resumoTurnoAnterior');
        if (resumoExistente) {
            resumoExistente.remove();
        }
        
        // Criar um elemento para mostrar informações do turno anterior
        const resumoContainer = document.createElement('div');
        resumoContainer.id = 'resumoTurnoAnterior';
        resumoContainer.className = 'bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6 fade-in';
        
        // Título do resumo
        const titulo = document.createElement('h3');
        titulo.className = 'text-lg font-semibold text-blue-700 mb-2 flex items-center';
        titulo.innerHTML = '<i class="fas fa-exchange-alt mr-2"></i> Resumo do Turno Anterior';
        resumoContainer.appendChild(titulo);
        
        // Detalhes do turno anterior
        const detalhes = document.createElement('div');
        detalhes.className = 'text-sm grid grid-cols-1 md:grid-cols-2 gap-4';
        
        // Coluna da esquerda: Informações gerais
        const colEsquerda = document.createElement('div');
        colEsquerda.className = 'space-y-1';
        
        // Formatar data do turno anterior para exibição
        const [dataAnterior, periodoAnterior] = turnoAnteriorId.split('_');
        const dataFormatada = dataAnterior.split('-').reverse().join('/');
        
        // ID do turno anterior
        const idTurno = document.createElement('p');
        idTurno.innerHTML = `<strong>Turno:</strong> ${periodoAnterior} de ${dataFormatada}`;
        colEsquerda.appendChild(idTurno);
        
        // Responsável pelo fechamento
        if (estoqueAnterior.fechamentoData && estoqueAnterior.fechamentoData.responsavelNome) {
            const responsavel = document.createElement('p');
            responsavel.innerHTML = `<strong>Fechado por:</strong> ${estoqueAnterior.fechamentoData.responsavelNome}`;
            colEsquerda.appendChild(responsavel);
        }
        
        // Hora do fechamento
        if (estoqueAnterior.fechamentoData && estoqueAnterior.fechamentoData.hora) {
            const hora = document.createElement('p');
            hora.innerHTML = `<strong>Horário:</strong> ${estoqueAnterior.fechamentoData.hora}`;
            colEsquerda.appendChild(hora);
        }
        
        // Caixa final do turno anterior
        if (estoqueAnterior.caixaFinal !== undefined) {
            const caixaFinal = document.createElement('p');
            caixaFinal.className = 'text-green-700 font-medium';
            caixaFinal.innerHTML = `<strong>Caixa Final:</strong> ${formatToBRL(estoqueAnterior.caixaFinal)}`;
            colEsquerda.appendChild(caixaFinal);
        }
        
        // Informação sobre troca de gás
        if (estoqueAnterior.trocaGas === 'sim') {
            const trocaGas = document.createElement('p');
            trocaGas.className = 'text-orange-700 font-medium mt-2 bg-orange-50 p-1 rounded';
            trocaGas.innerHTML = '<i class="fas fa-fire mr-1"></i> <strong>Houve troca de botijão no turno anterior</strong>';
            colEsquerda.appendChild(trocaGas);
        }
        
        detalhes.appendChild(colEsquerda);
        
        // Coluna da direita: Valores de vendas e pagamentos
        const colDireita = document.createElement('div');
        colDireita.className = 'space-y-1';
        
        // Total vendido no turno anterior
        if (estoqueAnterior.totalVendidoCalculado) {
            const totalVendido = document.createElement('p');
            totalVendido.innerHTML = `<strong>Total Vendido:</strong> ${formatToBRL(estoqueAnterior.totalVendidoCalculado)}`;
            colDireita.appendChild(totalVendido);
        }
        
        // Total registrado em pagamentos
        if (estoqueAnterior.totalRegistradoPagamentos) {
            const totalPagamentos = document.createElement('p');
            totalPagamentos.innerHTML = `<strong>Total Pagamentos:</strong> ${formatToBRL(estoqueAnterior.totalRegistradoPagamentos)}`;
            colDireita.appendChild(totalPagamentos);
        }
        
        // Diferença de caixa
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
        
        // Adicionar formas de pagamento em um único elemento para economizar espaço
        if (estoqueAnterior.formasPagamento && Object.keys(estoqueAnterior.formasPagamento).length > 0) {
            const pagamentos = document.createElement('div');
            pagamentos.className = 'mt-2 bg-white bg-opacity-50 p-2 rounded';
            
            const pagamentosTitle = document.createElement('p');
            pagamentosTitle.className = 'text-blue-800 font-medium';
            pagamentosTitle.innerHTML = '<i class="fas fa-credit-card mr-1"></i> <strong>Formas de Pagamento:</strong>';
            pagamentos.appendChild(pagamentosTitle);
            
            const pagamentosList = document.createElement('ul');
            pagamentosList.className = 'grid grid-cols-2 gap-x-2 text-xs mt-1';
            
            // Mapeamento de nomes para exibição mais amigável
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
        
        // Adicionar botão para fechar o resumo
        const btnFechar = document.createElement('button');
        btnFechar.type = 'button';
        btnFechar.className = 'text-blue-600 hover:text-blue-800 text-xs mt-3 flex items-center';
        btnFechar.innerHTML = '<i class="fas fa-times-circle mr-1"></i> Fechar resumo';
        btnFechar.onclick = () => resumoContainer.remove();
        resumoContainer.appendChild(btnFechar);
        
        // Adicionar o resumo ao formulário
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
            if (Math.abs(totalVendidoCalc - totalPagamentos) > 0.015) { // Tolerância aumentada um pouco
                divergenciaValorDetected = true;
            }
            
            const { isValid: caixaValido, diferencaCaixa } = updatePhysicalCashDifference(); // Retorna se o caixa físico tem divergência
            
            fechamentoDivergenciaAlertaGeralDiv.classList.add('hidden');
            fechamentoDivergenciaAlertaGeralDiv.textContent = '';
            
            let confirmMsg = "Você está prestes a fechar o turno.";
            if (divergenciaValorDetected || !caixaValido) {
                let alertText = "ATENÇÃO: Divergências encontradas!\n";
                if (divergenciaValorDetected) {
                    alertText += `- Total Vendido (${formatToBRL(totalVendidoCalc)}) difere do Total de Pagamentos (${formatToBRL(totalPagamentos)}). Diferença: ${formatToBRL(totalVendidoCalc - totalPagamentos)}\n`;
                }
                if (!caixaValido) {
                    alertText += `- Diferença no caixa físico: ${formatToBRL(Math.abs(diferencaCaixa))}\n`;
                }
                alertText += "\nDeseja continuar e fechar o turno mesmo assim? As divergências serão registradas.";
                
                fechamentoDivergenciaAlertaGeralDiv.innerHTML = alertText.replace(/\n/g, '<br>'); // Mostra na UI também
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
                // Não reabilitar o btnFecharTurno aqui, pois o estado do turno no DB pode ser incerto.
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
            const caixaFinalContadoVal = parseCurrencyToNumber(caixaFinalContadoInput.value);
            const caixaDiferencaVal = Math.abs(diferencaCaixa);

            // Verificação de turno aberto remoto via transação atômica
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
                    
                    // Pegar o caixa inicial que foi registrado na abertura
                    const caixaInicialDoTurno = turnoData.caixaInicial;

                    const turnoUpdateData = {
                        status: 'fechado',
                        fechamento: fechamentoDataObj,
                        itens: dadosColetados.itens,
                        gelo: dadosColetados.gelo, 
                        trocaGas: document.getElementById('trocaGas').value,
                        caixaInicial: caixaInicialDoTurno, // Usar o caixa inicial da abertura
                        caixaFinalContado: caixaFinalContadoVal,
                        formasPagamento: formasPagamentoObj,
                        totalVendidoCalculadoFinal: totalVendidoCalc,
                        totalRegistradoPagamentosFinal: totalPagamentos,
                        diferencaCaixaFinal: caixaDiferencaVal,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        closedAt: firebase.firestore.FieldValue.serverTimestamp() // Adiciona timestamp de fechamento para consultas
                    };
                    
                    // Atualiza o documento dentro da transação
                    transaction.update(turnoRef, turnoUpdateData);
                    
                    return {
                        ...turnoData,
                        ...turnoUpdateData
                    };
                });
                
                turnoStatusP.textContent = `Turno ${currentTurnoId.split('_')[1]} de ${currentTurnoId.split('_')[0]} fechado com sucesso.`;
                turnoStatusP.className = 'text-center text-green-600 font-semibold mb-4';
                
                // Remover dados locais
                removeTurnoLocal();
                
                // Cancela o listener
                if (unsubscribeTurnoListener) {
                    unsubscribeTurnoListener();
                    unsubscribeTurnoListener = null;
                }
                
                // ADICIONADO: Atualizar os dados do turno anterior para o próximo que será aberto
                await carregarDadosTurnoAnterior();
                
                resetFormAndState("Turno fechado com sucesso! Você já pode abrir um novo turno.");

            } catch (error) {
                console.error("Erro ao fechar turno: ", error);
                showError("Falha ao fechar turno: " + error.message + ". O turno pode ainda estar aberto. Verifique e tente novamente ou contate o suporte.");
                // Recarrega os dados do turno para garantir sincronização
                await checkOpenTurno();
            } finally {
                showLoadingState(false);
            }
        });
    }
    
    function validateRequiredFieldsForClosure() {
        let isValid = true;
        const fieldsToValidate = [];

        // Campos de Itens: Chegadas, Sobra, Descarte, Consumo Func.
        document.querySelectorAll('.item-row').forEach(row => {
            const itemKey = row.dataset.itemKey;
            const itemFields = itemKey === 'gelo_pacote' ? ['chegadas', 'sobra', 'vendas', 'consumo_interno'] : ['chegadas', 'sobra', 'descarte', 'consumo'];
            itemFields.forEach(fieldSuffix => {
                fieldsToValidate.push(document.getElementById(`${itemKey}_${fieldSuffix}`));
            });
        });

        // Campos de Caixa e Pagamento
        fieldsToValidate.push(
            caixaInicioInput, 
            caixaFinalContadoInput,
            pagamentoDinheiroInput,
            document.getElementById('pagamentoPixManual'),
            document.getElementById('pagamentoStoneDCV'),
            document.getElementById('pagamentoStoneVoucher'),
            document.getElementById('pagamentoPagBankDCV')
        );
        
        fieldsToValidate.forEach(input => {
            if (input) { // Verifica se o input existe
                const value = input.type === 'text' ? parseCurrencyToNumber(input.value) : parseFloat(input.value);
                if (input.value.trim() === '' || isNaN(value)) {
                    input.classList.add('border-red-500');
                    isValid = false;
                } else {
                    input.classList.remove('border-red-500');
                }
            }
        });
        
        return isValid;
    }

    // NOVA FUNÇÃO: Validar se valores transferidos não foram alterados
    function validarCamposTransferidos(event) {
        const target = event.target;
        if (target && target.dataset && target.dataset.transferidoDoTurno) {
            const valorOriginal = target.dataset.valorOriginal;
            
            // Verificar se o valor foi alterado
            if (valorOriginal !== undefined && target.value !== valorOriginal) {
                // Restaurar o valor original
                target.value = valorOriginal;
                
                // Adicionar animação de "shake" para feedback visual
                target.classList.add('shake-animation');
                setTimeout(() => {
                    target.classList.remove('shake-animation');
                }, 500);
                
                // Exibir mensagem de erro
                const msgErro = `O campo "${target.name || target.id}" foi transferido do turno anterior e não pode ser alterado.`;
                
                // Usar showError se disponível, caso contrário criar um alerta flutuante
                if (typeof showError === 'function') {
                    showError(msgErro);
                } else {
                    // Criar alerta visual temporário
                    const alerta = document.createElement('div');
                    alerta.className = 'alerta-campo-transferido';
                    alerta.innerHTML = `
                        <div class="flex items-center">
                            <i class="fas fa-exclamation-circle mr-2"></i>
                            <span>${msgErro}</span>
                        </div>
                    `;
                    document.body.appendChild(alerta);
                    
                    // Remover o alerta após alguns segundos
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

    // === CÁLCULOS E ATUALIZAÇÕES DINÂMICAS ===
    function setupEventListeners() {
        formTurno.addEventListener('input', (e) => {
            const target = e.target;
            
            // NOVA VALIDAÇÃO: Verificar se está tentando alterar um campo transferido do turno anterior
            if (!validarCamposTransferidos(e)) {
                e.preventDefault();
                return;
            }
            
            if (target.closest('.item-row') && target.type === 'number') {
                const row = target.closest('.item-row');
                const itemKey = row.dataset.itemKey;

                if (target.id.startsWith(itemKey)) { // Garante que o input é de um item
                     target.classList.remove('border-red-500'); // Limpa erro ao digitar
                    if (target.dataset.isGeloVenda === "true") {
                        calculateGeloTotal(row);
                    } else {
                        calculateItemRow(row);
                    }
                    calculateTotals(); // Recalcula todos os totais agregados
                }
            } else if (target.classList.contains('payment-input') || target.id.includes('pagamento')) {
                // CORRIGIDO: Atualiza totais quando campos de pagamento mudam
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
        });
    }
    
    // NOVA LÓGICA DE CÁLCULO: Entrada + Chegadas - Sobra - Descarte - Consumo = Vendido
    function calculateItemRow(rowElement) {
        const itemKey = rowElement.dataset.itemKey;
        if (!itemKey || itemKey === 'gelo_pacote') return; // Gelo tem cálculo separado

        const entrada = parseFloat(document.getElementById(`${itemKey}_entrada`)?.value) || 0;
        const chegadas = parseFloat(document.getElementById(`${itemKey}_chegadas`)?.value) || 0; // NOVO
        const sobra = parseFloat(document.getElementById(`${itemKey}_sobra`)?.value) || 0;
        const descarte = parseFloat(document.getElementById(`${itemKey}_descarte`)?.value) || 0;
        const consumo = parseFloat(document.getElementById(`${itemKey}_consumo`)?.value) || 0;
        
        const vendidoInput = document.getElementById(`${itemKey}_vendido`);
        
        // NOVA FÓRMULA: (Entrada + Chegadas) - Sobra - Descarte - Consumo = Vendido
        let vendidoCalculado = (entrada + chegadas) - sobra - descarte - consumo;
        
        if (vendidoCalculado < 0) {
            // Se negativo, podemos mostrar um alerta ou apenas zerar.
            // Por ora, zeramos para evitar valores negativos em "vendido".
            vendidoCalculado = 0; 
            // Poderia adicionar uma classe de erro visual nos inputs que causaram isso.
        }
        
        if (vendidoInput) vendidoInput.value = vendidoCalculado;

        const totalItemDisplay = document.getElementById(`${itemKey}_total_item`);
        if (totalItemDisplay && vendidoInput) {
            const precoUnitario = parseFloat(vendidoInput.dataset.price) || 0;
            const totalItemValor = vendidoCalculado * precoUnitario;
            totalItemDisplay.textContent = formatToBRL(totalItemValor);
        }
    }
    
    // NOVA LÓGICA PARA GELO: Vendas são informadas diretamente, não calculadas
    function calculateGeloTotal(rowElement) {
        const itemKey = rowElement.dataset.itemKey; // Deve ser 'gelo_pacote'
        if(itemKey !== 'gelo_pacote') return;

        const vendasGeloInput = document.getElementById(`${itemKey}_vendas`);
        const vendasGelo = parseFloat(vendasGeloInput?.value) || 0;
        
        const precoDisplay = document.getElementById(`${itemKey}_preco_display`); 
        const totalItemDisplay = document.getElementById(`${itemKey}_total_item`);

        if (precoDisplay && totalItemDisplay) {
            const precoGeloTexto = precoDisplay.textContent; 
            const precoUnitarioGelo = parseCurrencyToNumber(precoGeloTexto);
            const totalGeloValor = vendasGelo * precoUnitarioGelo;
            totalItemDisplay.textContent = formatToBRL(totalGeloValor);
        }
    }
    
    function calculateTotals() {
        let totalPasteisComunsVendido = 0, totalPasteisComunsValor = 0;
        let totalPasteisEspeciaisVendido = 0, totalPasteisEspeciaisValor = 0;
        let totalCasquinhasVendido = 0, totalCasquinhasValor = 0;
        let totalCaldoCanaVendido = 0, totalCaldoCanaValor = 0;
        let totalRefrigerantesVendido = 0, totalRefrigerantesValor = 0;
        
        // PASTÉIS E CASQUINHAS
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
        
        // CALDO DE CANA
        const localListaCaldoCana = typeof listaCaldoCana !== 'undefined' ? listaCaldoCana : [];
        localListaCaldoCana.forEach(item => {
            const key = item.toLowerCase().replace(/\s+/g, '_').replace(/[ç]/g, 'c').replace(/\d+ml/, d => d.toLowerCase()).replace(/\d+litro/, d => d.toLowerCase());
            totalCaldoCanaVendido += parseFloat(document.getElementById(`${key}_vendido`)?.value) || 0;
            totalCaldoCanaValor += parseCurrencyToNumber(document.getElementById(`${key}_total_item`)?.textContent);
        });
        document.getElementById('totalCaldoCanaVendido').textContent = totalCaldoCanaVendido;
        document.getElementById('totalCaldoCanaValor').textContent = formatToBRL(totalCaldoCanaValor);

        // REFRIGERANTES
        const localListaRefrigerantes = typeof listaRefrigerantes !== 'undefined' ? listaRefrigerantes : [];
        localListaRefrigerantes.forEach(item => {
            const key = item.toLowerCase().replace(/\s+/g, '_').replace(/[ç]/g, 'c').replace(/\./g, '');
            totalRefrigerantesVendido += parseFloat(document.getElementById(`${key}_vendido`)?.value) || 0;
            totalRefrigerantesValor += parseCurrencyToNumber(document.getElementById(`${key}_total_item`)?.textContent);
        });
        document.getElementById('totalRefrigerantesVendido').textContent = totalRefrigerantesVendido;
        document.getElementById('totalRefrigerantesValor').textContent = formatToBRL(totalRefrigerantesValor);

        // GELO (valor total de vendas de gelo)
        const totalGeloValorVenda = parseCurrencyToNumber(document.getElementById(`gelo_pacote_total_item`)?.textContent);
        document.getElementById('totalGeloValor').textContent = formatToBRL(totalGeloValorVenda);

        // TOTAL VENDIDO NO TURNO (CALCULADO PELOS ITENS) - AGORA CONSIDERA CHEGADAS
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

    // CORRIGIDO: Usa nova função de controle de caixa
    function updateTotalRegistradoPagamentos() {
        updatePaymentTotalsAndDivergence();
    }
    
    // CORRIGIDO: Usa nova função de controle de caixa
    function updateCaixaDiferenca() {
        return updatePhysicalCashDifference();
    }
    
    // CORRIGIDO: Verifica divergências gerais do fechamento
    function checkFechamentoDivergencia() {
        if (!totalVendidoTurnoCalculadoInput || !totalRegistradoPagamentosInput) return;

        const totalVendidoCalc = parseCurrencyToNumber(totalVendidoTurnoCalculadoInput.value);
        const totalPagamentos = parseCurrencyToNumber(totalRegistradoPagamentosInput.value);
        const { isValid: caixaValido, diferencaCaixa } = updatePhysicalCashDifference();

        const diffValores = Math.abs(totalVendidoCalc - totalPagamentos);
        const temDivergenciaVendas = diffValores > 0.01;

        if (temDivergenciaVendas || !caixaValido) {
            let message = "<strong>🚨 ATENÇÃO: DIVERGÊNCIAS DETECTADAS!</strong><br><br>";
            
            if (temDivergenciaVendas) {
                message += `<div class="bg-white bg-opacity-50 p-3 rounded mb-2">`;
                message += `📊 <strong>Vendas vs Pagamentos:</strong><br>`;
                message += `• Total Vendido: ${formatToBRL(totalVendidoCalc)}<br>`;
                message += `• Total Pagamentos: ${formatToBRL(totalPagamentos)}<br>`;
                message += `• <span class="font-bold text-lg">Diferença: ${formatToBRL(totalVendidoCalc - totalPagamentos)}</span>`;
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

    // --- COLETA DE DADOS DO FORMULÁRIO ---
    function collectItemData(isOpeningTurno) {
        const data = { itens: {}, gelo: {} };
        
        // Loop pelas seções de itens principais (pasteis, caldo, refris, casquinhas)
        document.querySelectorAll('.item-section[data-category]').forEach(section => {
            const categoryKey = section.dataset.category;
            if (!['pasteis', 'casquinhas', 'caldo_cana', 'refrigerantes'].includes(categoryKey)) return; // Processa apenas essas categorias aqui

            data.itens[categoryKey] = {};
            section.querySelectorAll('.item-row').forEach(row => {
                const itemKey = row.dataset.itemKey;
                const entrada = parseFloat(document.getElementById(`${itemKey}_entrada`)?.value) || 0;
                const chegadas = parseFloat(document.getElementById(`${itemKey}_chegadas`)?.value) || 0; // NOVO
                // Usar productPrices carregado para pegar o preço unitário
                const precoUnitario = productPrices[categoryKey]?.[itemKey]?.preco || 0;

                if (isOpeningTurno) {
                    data.itens[categoryKey][itemKey] = {
                        entrada: entrada,
                        chegadas: chegadas, // NOVO: salvar chegadas na abertura (geralmente 0)
                        precoUnitario: precoUnitario
                    };
                } else { 
                    const sobra = parseFloat(document.getElementById(`${itemKey}_sobra`)?.value) || 0;
                    const descarte = parseFloat(document.getElementById(`${itemKey}_descarte`)?.value) || 0;
                    const consumo = parseFloat(document.getElementById(`${itemKey}_consumo`)?.value) || 0;
                    const vendido = parseFloat(document.getElementById(`${itemKey}_vendido`)?.value) || 0;
                    
                    data.itens[categoryKey][itemKey] = {
                        entrada: entrada,
                        chegadas: chegadas, // NOVO: salvar chegadas no fechamento
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

        // Coleta de Gelo - MODIFICADO para incluir chegadas
        const geloKey = 'gelo_pacote';
        const geloEntrada = parseFloat(document.getElementById(`${geloKey}_entrada`)?.value) || 0;
        const geloChegadas = parseFloat(document.getElementById(`${geloKey}_chegadas`)?.value) || 0; // NOVO
        const precoUnitarioGelo = productPrices.gelo?.[geloKey]?.preco || 0;

        if (isOpeningTurno) {
             data.gelo[geloKey] = {
                entrada: geloEntrada,
                chegadas: geloChegadas, // NOVO: salvar chegadas de gelo na abertura (geralmente 0)
                precoUnitario: precoUnitarioGelo
             };
        } else {
            const geloSobra = parseFloat(document.getElementById(`${geloKey}_sobra`)?.value) || 0;
            const geloVendas = parseFloat(document.getElementById(`${geloKey}_vendas`)?.value) || 0; 
            const geloConsumoInterno = parseFloat(document.getElementById(`${geloKey}_consumo_interno`)?.value) || 0;
            data.gelo[geloKey] = {
                entrada: geloEntrada,
                chegadas: geloChegadas, // NOVO: salvar chegadas de gelo no fechamento
                sobra: geloSobra,
                vendas: geloVendas, 
                consumoInterno: geloConsumoInterno,
                precoUnitario: precoUnitarioGelo,
                totalItemValor: geloVendas * precoUnitarioGelo // Valor das vendas de gelo
            };
        }
        return data;
    }
    
    function loadTurnoDataToForm(turnoData) {
        if (!turnoData) return;
        
        if (caixaInicioInput) {
            caixaInicioInput.value = formatToBRL(turnoData.caixaInicial || 0);
        }
    
        if (turnoData.itens) {
            Object.keys(turnoData.itens).forEach(categoryKey => {
                if(turnoData.itens[categoryKey]) {
                    Object.keys(turnoData.itens[categoryKey]).forEach(itemKey => {
                        const item = turnoData.itens[categoryKey][itemKey];
                        if (item) {
                            const entradaInput = document.getElementById(`${itemKey}_entrada`);
                            if (entradaInput) entradaInput.value = item.entrada || 0;
                            
                            // NOVO: Carregar chegadas
                            const chegadasInput = document.getElementById(`${itemKey}_chegadas`);
                            if (chegadasInput) chegadasInput.value = item.chegadas || 0;
        
                            if (turnoData.status === 'fechado' || turnoAbertoLocalmente) { // Preenche mais se for para fechar
                                 const sobraInput = document.getElementById(`${itemKey}_sobra`);
                                 if (sobraInput) sobraInput.value = item.sobra || 0;
                                 const descarteInput = document.getElementById(`${itemKey}_descarte`);
                                 if (descarteInput) descarteInput.value = item.descarte || 0;
                                 const consumoInput = document.getElementById(`${itemKey}_consumo`);
                                 if (consumoInput) consumoInput.value = item.consumo || 0;
                                 
                                 // Preencher o dataset do preço no input de vendido se não existir ao carregar
                                 const vendidoInput = document.getElementById(`${itemKey}_vendido`);
                                 if (vendidoInput && item.precoUnitario && !vendidoInput.dataset.price) {
                                     vendidoInput.dataset.price = item.precoUnitario;
                                     // Atualiza também o display do preço na tabela, se aplicável (ou é feito ao popular tabelas)
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
            
            // NOVO: Carregar chegadas de gelo
            const geloChegadasInput = document.getElementById(`gelo_pacote_chegadas`);
            if (geloChegadasInput) geloChegadasInput.value = geloItem.chegadas || 0;

            if (turnoData.status === 'fechado' || turnoAbertoLocalmente) {
                const geloSobraInput = document.getElementById(`gelo_pacote_sobra`);
                if (geloSobraInput) geloSobraInput.value = geloItem.sobra || 0;
                const geloVendasInput = document.getElementById(`gelo_pacote_vendas`);
                if (geloVendasInput) geloVendasInput.value = geloItem.vendas || 0;
                const geloConsumoInput = document.getElementById(`gelo_pacote_consumo_interno`);
                if (geloConsumoInput) geloConsumoInput.value = geloItem.consumoInterno || 0;
                // Preço do Gelo
                 const precoGeloInputVendido = document.getElementById(`gelo_pacote_total_item`); // O total, não o 'vendido' input
                 const precoGeloDisplay = document.getElementById(`gelo_pacote_preco_display`);
                 if (geloItem.precoUnitario && precoGeloDisplay) {
                     precoGeloDisplay.textContent = formatToBRL(parseFloat(geloItem.precoUnitario));
                 }
            }
        }

        if (turnoData.status === 'fechado') { // Se o turno já veio fechado do DB (raro, mas possível)
            document.getElementById('trocaGas').value = turnoData.trocaGas || 'nao';
            if (turnoData.formasPagamento) {
                Object.keys(turnoData.formasPagamento).forEach(key => {
                    const inputId = 'pagamento' + key.charAt(0).toUpperCase() + key.slice(1);
                    const inputEl = document.getElementById(inputId);
                    if (inputEl) inputEl.value = formatToBRL(turnoData.formasPagamento[key] || 0);
                });
            }
            if(caixaFinalContadoInput) caixaFinalContadoInput.value = formatToBRL(turnoData.caixaFinalContado || 0);
        }
        calculateAll(); 
    }

    // --- MENSAGENS DE ERRO/STATUS ---
    function showError(message) {
        errorMessagesP.textContent = message;
        errorMessagesP.classList.remove('hidden');
    }

    function clearError() {
        errorMessagesP.textContent = '';
        errorMessagesP.classList.add('hidden');
    }
    
    // --- INICIALIZAÇÃO ---
    // Adicionar event listener para detectar status de conectividade
    window.addEventListener('online', function() {
        console.log('Online - sincronizando dados...');
        checkOpenTurno(); // Sincroniza quando ficar online novamente
    });
    
    window.addEventListener('offline', function() {
        console.log('Offline - usando dados locais...');
        if (currentTurnoId) {
            turnoStatusP.textContent = "Você está offline. Usando dados locais do turno.";
            turnoStatusP.className = 'text-center text-yellow-600 font-semibold mb-4';
        }
    });

    // Detecta se o usuário está saindo da página e salva os dados
    window.addEventListener('beforeunload', function() {
        // O localStorage já deve estar sendo atualizado ao longo do uso,
        // mas podemos fazer uma última verificação aqui se necessário
        if (turnoAbertoLocalmente && currentTurnoId) {
            // Os dados principais já devem estar salvos, mas poderia adicionar
            // uma última sincronização se necessário
        }
    });
    
    // Inicializa a página e carrega os dados necessários
    initializePage();
});

// Helpers de shared.js (inclua shared.js antes deste script)
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