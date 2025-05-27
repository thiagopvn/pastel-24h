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
    let funcionariosColaboradores = [];
    let listaFuncionariosDisponiveis = [];

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
        
        trGelo.appendChild(createInputCell('number', `${geloKey}_consumo_interno`, '0', '', true, "w-full p-1 border rounded text-sm"));
        
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
        tdName.className = 'px-3 py-2 font-medium text-gray-800';
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
            if(caixaInicioInput) caixaInicioInput.readOnly = true;
            if(caixaInicioInput) caixaInicioInput.classList.add('bg-gray-100');
            
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
        } else {
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

    function updatePhysicalCashDifference() {
        console.log("🏦 Atualizando diferença de caixa físico...");
        
        const caixaInicial = parseCurrencyToNumber(caixaInicioInput?.value || '0');
        const pagamentoDinheiro = parseCurrencyToNumber(pagamentoDinheiroInput?.value || '0');
        const caixaFinalContado = parseCurrencyToNumber(caixaFinalContadoInput?.value || '0');
        
        const caixaEsperado = caixaInicial + pagamentoDinheiro;
        
        const diferencaCaixa = caixaFinalContado - caixaEsperado;
        
        console.log(`💰 Caixa Inicial: ${formatToBRL(caixaInicial)}`);
        console.log(`💵 Pagamento Dinheiro: ${formatToBRL(pagamentoDinheiro)}`);
        console.log(`🎯 Caixa Esperado: ${formatToBRL(caixaEsperado)}`);
        console.log(`🔢 Caixa Contado: ${formatToBRL(caixaFinalContado)}`);
        console.log(`⚖️ Diferença: ${formatToBRL(diferencaCaixa)}`);
        
        if (caixaDiferencaInput) {
            caixaDiferencaInput.value = formatToBRL(diferencaCaixa);
        }
        
        if (caixaDiferencaContainer && divergenciaCaixaAlertaP) {
            if (Math.abs(diferencaCaixa) < 0.01) {
                caixaDiferencaContainer.className = 'p-4 rounded-lg bg-green-50 border border-green-300';
                divergenciaCaixaAlertaP.className = 'text-sm mt-2 text-green-700 font-medium';
                divergenciaCaixaAlertaP.innerHTML = `
                    <i class="fas fa-check-circle mr-1"></i>
                    ✅ Caixa físico confere perfeitamente! (${formatToBRL(caixaFinalContado)})
                `;
            } else {
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
                        
                if (estoqueAnterior.caixaFinal !== undefined && caixaInicioInput) {
                    caixaInicioInput.value = formatToBRL(estoqueAnterior.caixaFinal);
                            
                    adicionarIndicadorCampoTransferido(caixaInicioInput, estoqueAnterior.turnoId);
                }

                if (estoqueAnterior.turnoId) {
                    adicionarResumoTurnoAnterior(estoqueAnterior.turnoId, estoqueAnterior);
                }

                const initialItensData = collectItemData(true);

                const turnoDataToSave = {
                    abertura: aberturaDataObj,
                    status: 'aberto',
                    caixaInicial: parseCurrencyToNumber(caixaInicioInput.value) || 0,
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
                        statusMsg += ` e caixa inicial (${formatToBRL(estoqueAnterior.caixaFinal)})`;
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
                
                if (dados.caixaFinalContado !== undefined) {
                    estoqueFinal.caixaFinal = dados.caixaFinalContado;
                    console.log(`💰 Transferindo caixa: ${formatToBRL(dados.caixaFinalContado)} do turno ${turnoDoc.id}`);
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
            if (Math.abs(totalVendidoCalc - totalPagamentos) > 0.015) {
                divergenciaValorDetected = true;
            }
            
            const { isValid: caixaValido, diferencaCaixa } = updatePhysicalCashDifference();
            
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
            const caixaFinalContadoVal = parseCurrencyToNumber(caixaFinalContadoInput.value);
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

        document.querySelectorAll('.item-row').forEach(row => {
            const itemKey = row.dataset.itemKey;
            const itemFields = itemKey === 'gelo_pacote' ? ['chegadas', 'sobra', 'vendas', 'consumo_interno'] : ['chegadas', 'sobra', 'descarte', 'consumo'];
            itemFields.forEach(fieldSuffix => {
                fieldsToValidate.push(document.getElementById(`${itemKey}_${fieldSuffix}`));
            });
        });

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
            if (input) {
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
        });

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
    }
    
    function calculateGeloTotal(rowElement) {
        const itemKey = rowElement.dataset.itemKey;
        if(itemKey !== 'gelo_pacote') return;

        const vendasGeloInput = document.getElementById(`${itemKey}_vendas`);
        const vendasGelo = parseFloat(vendasGeloInput?.value) || 0;
        
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
        }
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
            data.gelo[geloKey] = {
                entrada: geloEntrada,
                chegadas: geloChegadas,
                sobra: geloSobra,
                vendas: geloVendas, 
                consumoInterno: geloConsumoInterno,
                precoUnitario: precoUnitarioGelo,
                totalItemValor: geloVendas * precoUnitarioGelo
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
                 const precoGeloInputVendido = document.getElementById(`gelo_pacote_total_item`);
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
            if(caixaFinalContadoInput) caixaFinalContadoInput.value = formatToBRL(turnoData.caixaFinalContado || 0);
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