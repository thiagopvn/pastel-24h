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
    let unsubscribeTurnoListener = null; // Para armazenar a função de cancelamento do listener
    let turnoAnteriorData = null; // Para armazenar dados do turno anterior
    let camposTransferidosAnterior = {}; // Para rastreamento de campos transferidos

    // --- FUNÇÕES DE PERSISTÊNCIA LOCAL ---
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

    // --- FUNÇÕES DE INICIALIZAÇÃO E ESTADO ---
    async function initializePage() {
        // Prevenção contra chamadas recursivas
        if (isInitializing) return;
        isInitializing = true;
        
        showLoadingState(true, "Carregando dados iniciais...");
        try {
            await loadProductPrices();
            populateProductTables();
            
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
            const row = createProductRow(sabor, key, 'pasteis', productPrices, true); // Inicialmente readonly
            tabelaPasteisBody.appendChild(row);
        });

        const localListaCasquinhas = typeof listaCasquinhas !== 'undefined' ? listaCasquinhas : [];
        localListaCasquinhas.forEach(casquinha => {
            const key = casquinha.toLowerCase().replace(/\s+/g, '_');
            const row = createProductRow(casquinha, key, 'casquinhas', productPrices, true);
            tabelaCasquinhasBody.appendChild(row);
        });

        const localListaCaldoCana = typeof listaCaldoCana !== 'undefined' ? listaCaldoCana : [];
        localListaCaldoCana.forEach(item => {
            const key = item.toLowerCase().replace(/\s+/g, '_').replace(/[ç]/g, 'c').replace(/\d+ml/, d => d.toLowerCase()).replace(/\d+litro/, d => d.toLowerCase());
            const row = createProductRow(item, key, 'caldo_cana', productPrices, true);
            tabelaCaldoCanaBody.appendChild(row);
        });

        const localListaRefrigerantes = typeof listaRefrigerantes !== 'undefined' ? listaRefrigerantes : [];
        localListaRefrigerantes.forEach(item => {
            const key = item.toLowerCase().replace(/\s+/g, '_').replace(/[ç]/g, 'c').replace(/\./g, '');
            const row = createProductRow(item, key, 'refrigerantes', productPrices, true);
            tabelaRefrigerantesBody.appendChild(row);
        });
        
        const geloKey = 'gelo_pacote';
        const trGelo = document.createElement('tr');
        trGelo.className = 'border-b item-row';
        trGelo.dataset.itemKey = geloKey;
        trGelo.dataset.categoryKey = 'gelo'; 
        
        const tdGeloName = document.createElement('td');
        tdGeloName.className = 'px-2 py-2 font-medium';
        tdGeloName.textContent = 'Gelo (Pacote)';
        trGelo.appendChild(tdGeloName);
        
        // Gelo usa a função createInputCell, mas as colunas são específicas
        trGelo.appendChild(createInputCell('number', `${geloKey}_entrada`, '0', '', true, "w-full p-1 border rounded text-sm")); // entrada
        trGelo.appendChild(createInputCell('number', `${geloKey}_sobra`, '0', '', true, "w-full p-1 border rounded text-sm"));   // sobra
        const tdVendasGelo = createInputCell('number', `${geloKey}_vendas`, '0', '', true, "w-full p-1 border rounded text-sm"); // vendas
        tdVendasGelo.querySelector('input').dataset.isGeloVenda = "true"; // Marcação para event listener
        trGelo.appendChild(tdVendasGelo);
        trGelo.appendChild(createInputCell('number', `${geloKey}_consumo_interno`, '0', '', true, "w-full p-1 border rounded text-sm"));// consumo_interno (o de funcionario é diferente)
        
        const tdPrecoGelo = document.createElement('td');
        tdPrecoGelo.className = 'px-2 py-2 text-sm text-gray-600';
        const precoGeloUnit = productPrices.gelo?.[geloKey]?.preco || 0;
        tdPrecoGelo.textContent = `R$ ${precoGeloUnit.toFixed(2)}`;
        tdPrecoGelo.id = `${geloKey}_preco_display`;
        trGelo.appendChild(tdPrecoGelo);
        
        const tdTotalGelo = document.createElement('td');
        tdTotalGelo.className = 'px-2 py-2 text-sm text-gray-700 font-semibold';
        tdTotalGelo.id = `${geloKey}_total_item`; 
        tdTotalGelo.textContent = `R$ 0.00`;
        trGelo.appendChild(tdTotalGelo);
        
        tabelaGeloBody.appendChild(trGelo);
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
         // Após abrir o turno, 'entrada' e 'caixaInicial' devem ficar readonly.
         if (turnoAbertoLocalmente || currentTurnoId) { // Significa que o turno está "em andamento"
            if(caixaInicioInput) caixaInicioInput.readOnly = true;
            if(caixaInicioInput) caixaInicioInput.classList.add('bg-gray-100');
            document.querySelectorAll('input[id$="_entrada"]').forEach(inp => {
                inp.readOnly = true;
                inp.classList.add('bg-gray-100');
            });
        } else { // Se nenhum turno aberto, caixa inicial e entradas estão disponíveis para o "Abrir Turno"
             if(caixaInicioInput) caixaInicioInput.readOnly = false;
             if(caixaInicioInput) caixaInicioInput.classList.remove('bg-gray-100');
             document.querySelectorAll('input[id$="_entrada"]').forEach(inp => {
                inp.readOnly = false;
                inp.classList.remove('bg-gray-100');
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
        document.querySelectorAll('td[id$="_total_item"]').forEach(el => el.textContent = 'R$ 0.00');
        if(totalVendidoTurnoCalculadoInput) totalVendidoTurnoCalculadoInput.value = 'R$ 0.00';
        if(totalRegistradoPagamentosInput) totalRegistradoPagamentosInput.value = 'R$ 0.00';
        if(caixaDiferencaInput) caixaDiferencaInput.value = 'R$ 0.00';
        if(caixaDiferencaContainer) caixaDiferencaContainer.className = "p-3 rounded-md"; // Reseta cor de fundo

        document.querySelectorAll('td[id^="total"]').forEach(el => {
            if (el.id.includes('Vendido')) el.textContent = '0';
            else if (el.id.includes('Valor')) el.textContent = 'R$ 0.00';
        });
        if (divergenciaCaixaAlertaP) divergenciaCaixaAlertaP.textContent = '';
        if (fechamentoDivergenciaAlertaGeralDiv) fechamentoDivergenciaAlertaGeralDiv.classList.add('hidden');
        if (fechamentoDivergenciaAlertaGeralDiv) fechamentoDivergenciaAlertaGeralDiv.textContent = '';
        
        // Limpa campos específicos de Gelo
        const geloKey = 'gelo_pacote';
        const totalGeloDisplay = document.getElementById(`${geloKey}_total_item`);
        if (totalGeloDisplay) totalGeloDisplay.textContent = 'R$ 0.00';
        const totalFooterGelo = document.getElementById('totalGeloValor');
        if (totalFooterGelo) totalFooterGelo.textContent = 'R$ 0.00';
        
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

    // --- AÇÕES DE TURNO ---
    if (btnAbrirTurno) {
        btnAbrirTurno.addEventListener('click', async () => {
    clearError();
    const caixaInicialVal = parseFloat(caixaInicioInput.value);
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
            caixaInicioInput.value = estoqueAnterior.caixaFinal;
                    
                    // Marca como transferido para validação e estilo visual
                    adicionarIndicadorCampoTransferido(caixaInicioInput, estoqueAnterior.turnoId);
            }


                if (estoqueAnterior.turnoId) {
                adicionarResumoTurnoAnterior(estoqueAnterior.turnoId, estoqueAnterior);
                }

                const initialItensData = collectItemData(true); // Coleta apenas entradas e preços unitários

                const turnoDataToSave = {
            abertura: aberturaDataObj,
            status: 'aberto',
            caixaInicial: parseFloat(caixaInicioInput.value) || 0,
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
                statusMsg += ` e caixa inicial (R$ ${estoqueAnterior.caixaFinal.toFixed(2)})`;
            }
        }
        turnoStatusP.textContent = statusMsg;
        turnoStatusP.className = 'text-center text-green-600 font-semibold mb-4';
        
        toggleFormInputs(true); // Habilita campos para fechamento, entradas ficam readonly
        
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

        function melhorarVisualizacaoTransferencia() {
    // Adicionar badge de "transferido" aos campos
    document.querySelectorAll('[data-transferido-do-turno]').forEach(elemento => {
        // Verificar se já existe um marcador
        if (!elemento.parentElement.querySelector('.marcador-transferencia')) {
            // Adicionar classe para destaque visual
            elemento.classList.add('campo-transferido');
            
            // Garantir que o elemento pai tenha position relative para o posicionamento do badge
            if (window.getComputedStyle(elemento.parentElement).position === 'static') {
                elemento.parentElement.style.position = 'relative';
            }
            
            // Criar e adicionar o marcador
            const marcador = document.createElement('span');
            marcador.className = 'marcador-transferencia';
            marcador.innerHTML = '<i class="fas fa-sync-alt" style="font-size: 8px;"></i>';
            marcador.title = 'Valor transferido do turno anterior';
            
            elemento.parentElement.appendChild(marcador);
            
            // Adicionar evento para exibir tooltip ao passar o mouse
            elemento.addEventListener('mouseover', () => {
                const tooltip = document.createElement('div');
                tooltip.className = 'bg-blue-800 text-white text-xs px-2 py-1 rounded absolute z-10 -mt-10';
                tooltip.textContent = 'Campo transferido do turno anterior';
                tooltip.style.left = '50%';
                tooltip.style.transform = 'translateX(-50%)';
                tooltip.id = 'tooltip-transferencia';
                
                // Remover tooltip existente se houver
                const existingTooltip = document.getElementById('tooltip-transferencia');
                if (existingTooltip) existingTooltip.remove();
                
                elemento.parentElement.appendChild(tooltip);
            });
            
            elemento.addEventListener('mouseout', () => {
                const tooltip = document.getElementById('tooltip-transferencia');
                if (tooltip) tooltip.remove();
            });
        }
    });
}

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
                caixaFinal: null,  // Inicializa o campo para caixa final
                // Adicionando novos campos para transferência
                formasPagamento: dados.formasPagamento || {},
                trocaGas: dados.trocaGas || 'nao',
                totalVendidoCalculado: dados.totalVendidoCalculadoFinal,
                totalRegistradoPagamentos: dados.totalRegistradoPagamentosFinal,
                diferencaCaixa: dados.diferencaCaixaFinal,
                fechamentoData: dados.fechamento || {},
                fechamentoTimestamp: dados.closedAt || null
            };
            
            // Transfere itens do inventário
            if (dados.itens) {
                Object.keys(dados.itens).forEach(cat => {
                    estoqueFinal.itens[cat] = {};
                    Object.keys(dados.itens[cat]).forEach(item => {
                        estoqueFinal.itens[cat][item] = { 
                          sobra: dados.itens[cat][item].sobra || 0,
                          // Adicionando outros dados que podem ser úteis
                          precoUnitario: dados.itens[cat][item].precoUnitario,
                          vendido: dados.itens[cat][item].vendido,
                          totalItemValor: dados.itens[cat][item].totalItemValor
                        };
                    });
                });
            }
            
            // Transfere gelo
            if (dados.gelo && dados.gelo.gelo_pacote) { 
                estoqueFinal.gelo.gelo_pacote = { 
                    sobra: dados.gelo.gelo_pacote.sobra || 0,
                    precoUnitario: dados.gelo.gelo_pacote.precoUnitario,
                    vendas: dados.gelo.gelo_pacote.vendas,
                    totalItemValor: dados.gelo.gelo_pacote.totalItemValor
                };
            }
            
            // TRANSFERÊNCIA DE CAIXA: Pegar o caixa final do turno anterior
            if (dados.caixaFinalContado !== undefined) {
                estoqueFinal.caixaFinal = dados.caixaFinalContado;
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
        caixaFinal.innerHTML = `<strong>Caixa Final:</strong> R$ ${estoqueAnterior.caixaFinal.toFixed(2)}`;
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
        totalVendido.innerHTML = `<strong>Total Vendido:</strong> R$ ${estoqueAnterior.totalVendidoCalculado.toFixed(2)}`;
        colDireita.appendChild(totalVendido);
    }
    
    // Total registrado em pagamentos
    if (estoqueAnterior.totalRegistradoPagamentos) {
        const totalPagamentos = document.createElement('p');
        totalPagamentos.innerHTML = `<strong>Total Pagamentos:</strong> R$ ${estoqueAnterior.totalRegistradoPagamentos.toFixed(2)}`;
        colDireita.appendChild(totalPagamentos);
    }
    
    // Diferença de caixa
    if (estoqueAnterior.diferencaCaixa !== undefined) {
        const diferencaCaixa = document.createElement('p');
        if (Math.abs(estoqueAnterior.diferencaCaixa) > 0.01) {
            diferencaCaixa.className = estoqueAnterior.diferencaCaixa > 0 ? 'text-green-700' : 'text-red-700';
            diferencaCaixa.innerHTML = `<strong>Diferença de Caixa:</strong> R$ ${estoqueAnterior.diferencaCaixa.toFixed(2)}`;
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
                li.innerHTML = `${nomeAmigavel[metodo] || metodo}: <span class="font-medium">R$ ${valor.toFixed(2)}</span>`;
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
            
            const totalVendidoCalc = parseFloat(totalVendidoTurnoCalculadoInput.value.replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.')) || 0;
            const totalPagamentos = parseFloat(totalRegistradoPagamentosInput.value.replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.')) || 0;

            let divergenciaValorDetected = false;
            if (Math.abs(totalVendidoCalc - totalPagamentos) > 0.015) { // Tolerância aumentada um pouco
                divergenciaValorDetected = true;
            }
            
            const { divergente: divergenciaCaixaFisico } = updateCaixaDiferenca(); // Retorna se o caixa físico tem divergência
            
            fechamentoDivergenciaAlertaGeralDiv.classList.add('hidden');
            fechamentoDivergenciaAlertaGeralDiv.textContent = '';
            
            let confirmMsg = "Você está prestes a fechar o turno.";
            if (divergenciaValorDetected || divergenciaCaixaFisico) {
                let alertText = "ATENÇÃO: Divergências encontradas!\n";
                if (divergenciaValorDetected) {
                    alertText += `- Total Vendido (R$ ${totalVendidoCalc.toFixed(2)}) difere do Total de Pagamentos (R$ ${totalPagamentos.toFixed(2)}). Diferença: R$ ${(totalVendidoCalc - totalPagamentos).toFixed(2)}\n`;
                }
                if (divergenciaCaixaFisico) {
                     const difCaixaVal = parseFloat(caixaDiferencaInput.value.replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.')) || 0;
                    alertText += `- Diferença no caixa físico: R$ ${difCaixaVal.toFixed(2)}\n`;
                }
                alertText += "\nDeseja continuar e fechar o turno mesmo assim? As divergências serão registradas.";
                
                fechamentoDivergenciaAlertaGeralDiv.textContent = alertText.replace(/\n/g, '<br>'); // Mostra na UI também
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
                dinheiro: parseFloat(document.getElementById('pagamentoDinheiro').value) || 0,
                pixManual: parseFloat(document.getElementById('pagamentoPixManual').value) || 0,
                stoneDCV: parseFloat(document.getElementById('pagamentoStoneDCV').value) || 0,
                stoneVoucher: parseFloat(document.getElementById('pagamentoStoneVoucher').value) || 0,
                pagbankDCV: parseFloat(document.getElementById('pagamentoPagBankDCV').value) || 0,
            };
            const caixaFinalContadoVal = parseFloat(caixaFinalContadoInput.value) || 0;
            const caixaDiferencaVal = parseFloat(caixaDiferencaInput.value.replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.')) || 0;

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

        // Campos de Itens: Sobra, Descarte, Consumo Func.
        document.querySelectorAll('.item-row').forEach(row => {
            const itemKey = row.dataset.itemKey;
            const itemFields = itemKey === 'gelo_pacote' ? ['sobra', 'vendas', 'consumo_interno'] : ['sobra', 'descarte', 'consumo'];
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
                if (input.value.trim() === '' || (input.type === "number" && isNaN(parseFloat(input.value)))) {
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

const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
        20%, 40%, 60%, 80% { transform: translateX(3px); }
    }
    .shake-animation {
        animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
    }
`;
document.head.appendChild(shakeStyle);

    // --- CÁLCULOS E ATUALIZAÇÕES DINÂMICAS ---
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
            } else if (target.classList.contains('payment-input')) {
                target.classList.remove('border-red-500');
                updateTotalRegistradoPagamentos();
                checkFechamentoDivergencia(); 
            } else if (['caixaInicio', 'caixaFinalContado', 'pagamentoDinheiro'].includes(target.id)) {
                target.classList.remove('border-red-500');
                updateCaixaDiferenca();
                checkFechamentoDivergencia(); 
            }
        });
    }
    
    function calculateItemRow(rowElement) {
        const itemKey = rowElement.dataset.itemKey;
        if (!itemKey || itemKey === 'gelo_pacote') return; // Gelo tem cálculo separado

        const entrada = parseFloat(document.getElementById(`${itemKey}_entrada`)?.value) || 0;
        const sobra = parseFloat(document.getElementById(`${itemKey}_sobra`)?.value) || 0;
        const descarte = parseFloat(document.getElementById(`${itemKey}_descarte`)?.value) || 0;
        const consumo = parseFloat(document.getElementById(`${itemKey}_consumo`)?.value) || 0;
        
        const vendidoInput = document.getElementById(`${itemKey}_vendido`);
        let vendidoCalculado = entrada - sobra - descarte - consumo;
        
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
            totalItemDisplay.textContent = `R$ ${totalItemValor.toFixed(2)}`;
        }
    }
    
    function calculateGeloTotal(rowElement) {
        const itemKey = rowElement.dataset.itemKey; // Deve ser 'gelo_pacote'
        if(itemKey !== 'gelo_pacote') return;

        const vendasGeloInput = document.getElementById(`${itemKey}_vendas`);
        const vendasGelo = parseFloat(vendasGeloInput?.value) || 0;
        
        const precoDisplay = document.getElementById(`${itemKey}_preco_display`); 
        const totalItemDisplay = document.getElementById(`${itemKey}_total_item`);

        if (precoDisplay && totalItemDisplay) {
            const precoGeloTexto = precoDisplay.textContent; 
            const precoUnitarioGelo = parseFloat(precoGeloTexto.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
            const totalGeloValor = vendasGelo * precoUnitarioGelo;
            totalItemDisplay.textContent = `R$ ${totalGeloValor.toFixed(2)}`;
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
            const valor = parseFloat(document.getElementById(`${key}_total_item`)?.textContent.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
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
            const valor = parseFloat(document.getElementById(`${key}_total_item`)?.textContent.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
            totalCasquinhasVendido += vendido;
            totalCasquinhasValor += valor;
        });

        document.getElementById('totalPasteisComunsVendido').textContent = totalPasteisComunsVendido;
        document.getElementById('totalPasteisComunsValor').textContent = `R$ ${totalPasteisComunsValor.toFixed(2)}`;
        document.getElementById('totalPasteisEspeciaisVendido').textContent = totalPasteisEspeciaisVendido;
        document.getElementById('totalPasteisEspeciaisValor').textContent = `R$ ${totalPasteisEspeciaisValor.toFixed(2)}`;
        document.getElementById('totalCasquinhasVendido').textContent = totalCasquinhasVendido;
        document.getElementById('totalCasquinhasValor').textContent = `R$ ${totalCasquinhasValor.toFixed(2)}`;
        
        const totalGeralPasteisVendido = totalPasteisComunsVendido + totalPasteisEspeciaisVendido; 
        const totalGeralPasteisValor = totalPasteisComunsValor + totalPasteisEspeciaisValor;
        document.getElementById('totalGeralPasteisVendido').textContent = totalGeralPasteisVendido;
        document.getElementById('totalGeralPasteisValor').textContent = `R$ ${totalGeralPasteisValor.toFixed(2)}`;
        
        // CALDO DE CANA
        const localListaCaldoCana = typeof listaCaldoCana !== 'undefined' ? listaCaldoCana : [];
        localListaCaldoCana.forEach(item => {
            const key = item.toLowerCase().replace(/\s+/g, '_').replace(/[ç]/g, 'c').replace(/\d+ml/, d => d.toLowerCase()).replace(/\d+litro/, d => d.toLowerCase());
            totalCaldoCanaVendido += parseFloat(document.getElementById(`${key}_vendido`)?.value) || 0;
            totalCaldoCanaValor += parseFloat(document.getElementById(`${key}_total_item`)?.textContent.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
        });
        document.getElementById('totalCaldoCanaVendido').textContent = totalCaldoCanaVendido;
        document.getElementById('totalCaldoCanaValor').textContent = `R$ ${totalCaldoCanaValor.toFixed(2)}`;

        // REFRIGERANTES
        const localListaRefrigerantes = typeof listaRefrigerantes !== 'undefined' ? listaRefrigerantes : [];
        localListaRefrigerantes.forEach(item => {
            const key = item.toLowerCase().replace(/\s+/g, '_').replace(/[ç]/g, 'c').replace(/\./g, '');
            totalRefrigerantesVendido += parseFloat(document.getElementById(`${key}_vendido`)?.value) || 0;
            totalRefrigerantesValor += parseFloat(document.getElementById(`${key}_total_item`)?.textContent.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
        });
        document.getElementById('totalRefrigerantesVendido').textContent = totalRefrigerantesVendido;
        document.getElementById('totalRefrigerantesValor').textContent = `R$ ${totalRefrigerantesValor.toFixed(2)}`;

        // GELO (valor total de vendas de gelo)
        const totalGeloValorVenda = parseFloat(document.getElementById(`gelo_pacote_total_item`)?.textContent.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
        document.getElementById('totalGeloValor').textContent = `R$ ${totalGeloValorVenda.toFixed(2)}`;


        // TOTAL VENDIDO NO TURNO (CALCULADO PELOS ITENS)
        const granTotalVendidoValor = totalGeralPasteisValor + totalCasquinhasValor + totalCaldoCanaValor + totalRefrigerantesValor + totalGeloValorVenda;
        totalVendidoTurnoCalculadoInput.value = `R$ ${granTotalVendidoValor.toFixed(2)}`;

        updateTotalRegistradoPagamentos(); 
        updateCaixaDiferenca(); 
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
        let total = 0;
        document.querySelectorAll('.payment-input').forEach(input => {
            total += parseFloat(input.value) || 0;
        });
        totalRegistradoPagamentosInput.value = `R$ ${total.toFixed(2)}`;
    }
    
    function updateCaixaDiferenca() {
        const caixaInicial = parseFloat(caixaInicioInput.value) || 0;
        const dinheiroRecebido = parseFloat(pagamentoDinheiroInput.value) || 0;
        const caixaFinalContadoVal = parseFloat(caixaFinalContadoInput.value) || 0;

        const caixaEsperado = caixaInicial + dinheiroRecebido;
        const diferenca = caixaFinalContadoVal - caixaEsperado;

        caixaDiferencaInput.value = `R$ ${diferenca.toFixed(2)}`;
        
        let divergente = false;
        if (caixaDiferencaContainer) { // Verifica se o container existe
            if (Math.abs(diferenca) > 0.01) {
                divergente = true;
                divergenciaCaixaAlertaP.textContent = `Divergência de R$ ${diferenca.toFixed(2)} no caixa físico.`;
                caixaDiferencaContainer.className = 'p-3 rounded-md ' + (diferenca > 0 ? 'bg-green-100 border border-green-300' : 'bg-red-100 border border-red-300');
                divergenciaCaixaAlertaP.className = 'text-xs mt-1 font-semibold ' + (diferenca > 0 ? 'text-green-700' : 'text-red-700');
            } else {
                divergenciaCaixaAlertaP.textContent = 'Caixa físico confere.';
                caixaDiferencaContainer.className = 'p-3 rounded-md bg-green-100 border border-green-300';
                divergenciaCaixaAlertaP.className = 'text-xs mt-1 text-green-700';
            }
        }
        return { divergente: divergente, diferenca: diferenca };
    }
    
    function checkFechamentoDivergencia() {
        if (!totalVendidoTurnoCalculadoInput || !totalRegistradoPagamentosInput) return;

        const totalVendidoCalc = parseFloat(totalVendidoTurnoCalculadoInput.value.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
        const totalPagamentos = parseFloat(totalRegistradoPagamentosInput.value.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
        const { divergente: caixaDivergente } = updateCaixaDiferenca(); 

        const diffValores = Math.abs(totalVendidoCalc - totalPagamentos);

        if (diffValores > 0.015 || caixaDivergente) {
            let message = "<strong>ATENÇÃO: DIVERGÊNCIAS DETECTADAS!</strong><br>";
            if (diffValores > 0.015) {
                message += `• Diferença entre Total Vendido Calculado (R$ ${totalVendidoCalc.toFixed(2)}) e Total Registrado em Pagamentos (R$ ${totalPagamentos.toFixed(2)}): <span class="font-bold">R$ ${(totalVendidoCalc - totalPagamentos).toFixed(2)}</span><br>`;
            }
            if (caixaDivergente) {
                const difCaixaVal = parseFloat(caixaDiferencaInput.value.replace(/[^\d,.-]/g, '').replace('.', '.')) || 0;
                message += `• Diferença no caixa físico (Dinheiro): <span class="font-bold">R$ ${difCaixaVal.toFixed(2)}</span>`;
            }
            fechamentoDivergenciaAlertaGeralDiv.innerHTML = message;
            fechamentoDivergenciaAlertaGeralDiv.classList.remove('hidden');
            fechamentoDivergenciaAlertaGeralDiv.className = 'mt-6 p-4 bg-red-100 border border-red-400 rounded-md text-red-700 font-semibold text-left leading-relaxed';
        } else {
            fechamentoDivergenciaAlertaGeralDiv.textContent = 'Todos os valores de fechamento parecem conferir. 🎉';
            fechamentoDivergenciaAlertaGeralDiv.classList.remove('hidden', 'bg-red-100', 'border-red-400', 'text-red-700');
            fechamentoDivergenciaAlertaGeralDiv.className = 'mt-6 p-4 bg-green-100 border border-green-400 rounded-md text-green-700 font-semibold text-center';
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
                // Usar productPrices carregado para pegar o preço unitário
                const precoUnitario = productPrices[categoryKey]?.[itemKey]?.preco || 0;

                if (isOpeningTurno) {
                    data.itens[categoryKey][itemKey] = {
                        entrada: entrada,
                        precoUnitario: precoUnitario
                    };
                } else { 
                    const sobra = parseFloat(document.getElementById(`${itemKey}_sobra`)?.value) || 0;
                    const descarte = parseFloat(document.getElementById(`${itemKey}_descarte`)?.value) || 0;
                    const consumo = parseFloat(document.getElementById(`${itemKey}_consumo`)?.value) || 0;
                    const vendido = parseFloat(document.getElementById(`${itemKey}_vendido`)?.value) || 0;
                    
                    data.itens[categoryKey][itemKey] = {
                        entrada: entrada,
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

        // Coleta de Gelo
        const geloKey = 'gelo_pacote';
        const geloEntrada = parseFloat(document.getElementById(`${geloKey}_entrada`)?.value) || 0;
        const precoUnitarioGelo = productPrices.gelo?.[geloKey]?.preco || 0;

        if (isOpeningTurno) {
             data.gelo[geloKey] = {
                entrada: geloEntrada,
                precoUnitario: precoUnitarioGelo
             };
        } else {
            const geloSobra = parseFloat(document.getElementById(`${geloKey}_sobra`)?.value) || 0;
            const geloVendas = parseFloat(document.getElementById(`${geloKey}_vendas`)?.value) || 0; 
            const geloConsumoInterno = parseFloat(document.getElementById(`${geloKey}_consumo_interno`)?.value) || 0;
            
            data.gelo[geloKey] = {
                entrada: geloEntrada,
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
        
        caixaInicioInput.value = turnoData.caixaInicial || 0;
    
        if (turnoData.itens) {
            Object.keys(turnoData.itens).forEach(categoryKey => {
                if(turnoData.itens[categoryKey]) {
                    Object.keys(turnoData.itens[categoryKey]).forEach(itemKey => {
                        const item = turnoData.itens[categoryKey][itemKey];
                        if (item) {
                            const entradaInput = document.getElementById(`${itemKey}_entrada`);
                            if (entradaInput) entradaInput.value = item.entrada || 0;
        
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
                                     if(precoDisplay) precoDisplay.textContent = `R$ ${parseFloat(item.precoUnitario).toFixed(2)}`;
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
                     precoGeloDisplay.textContent = `R$ ${parseFloat(geloItem.precoUnitario).toFixed(2)}`;
                 }
            }
        }

        if (turnoData.status === 'fechado') { // Se o turno já veio fechado do DB (raro, mas possível)
            document.getElementById('trocaGas').value = turnoData.trocaGas || 'nao';
            if (turnoData.formasPagamento) {
                Object.keys(turnoData.formasPagamento).forEach(key => {
                    const inputId = 'pagamento' + key.charAt(0).toUpperCase() + key.slice(1);
                    const inputEl = document.getElementById(inputId);
                    if (inputEl) inputEl.value = turnoData.formasPagamento[key] || 0;
                });
            }
            if(caixaFinalContadoInput) caixaFinalContadoInput.value = turnoData.caixaFinalContado || 0;
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
if (typeof createProductRow === 'undefined') {
    function createProductRow(itemName, itemKey, categoryKey, prices, isReadOnly = false) {
        const tr = document.createElement('tr');
        tr.className = 'border-b item-row hover:bg-orange-50 transition-colors duration-150';
        tr.dataset.itemKey = itemKey;
        tr.dataset.categoryKey = categoryKey;

        const tdName = document.createElement('td');
        tdName.className = 'px-3 py-2 font-medium text-gray-800';
        tdName.textContent = itemName;
        tr.appendChild(tdName);

        tr.appendChild(createInputCell('number', `${itemKey}_entrada`, '0', '', isReadOnly));
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
        tdPreco.textContent = `R$ ${parseFloat(precoUnit).toFixed(2)}`;
        tdPreco.id = `${itemKey}_preco_display`;
        tr.appendChild(tdPreco);
        
        const tdTotalItem = document.createElement('td');
        tdTotalItem.className = 'px-3 py-2 text-sm text-gray-700 font-semibold text-right';
        tdTotalItem.id = `${itemKey}_total_item`;
        tdTotalItem.textContent = `R$ 0.00`;
        tr.appendChild(tdTotalItem);

        return tr;
    }
}