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
    const caixaDiferencaContainer = document.getElementById('caixaDiferencaContainer'); // Div que contém a diferença
    const divergenciaCaixaAlertaP = document.getElementById('divergenciaCaixaAlerta');
    const fechamentoDivergenciaAlertaGeralDiv = document.getElementById('fechamentoDivergenciaAlertaGeral');

    let currentTurnoId = localStorage.getItem('currentTurnoId');
    let productPrices = {}; 
    let turnoAbertoLocalmente = false; // Controla se o turno foi aberto na sessão atual do navegador

    // --- FUNÇÕES DE INICIALIZAÇÃO E ESTADO ---
    async function initializePage() {
        showLoadingState(true, "Carregando dados iniciais...");
        try {
            await loadProductPrices();
            populateProductTables(); // Popula tabelas com preços e estrutura
            await checkOpenTurno();   // Verifica se há um turno aberto no backend ou localmente
            setupEventListeners();
            setInitialPeriodo(); 
            if (!turnoAbertoLocalmente && !currentTurnoId) { // Se nenhum turno aberto
                toggleFormInputs(false); // Desabilita a maioria dos inputs
            }
        } catch (error) {
            console.error("Erro na inicialização da página:", error);
            showError("Falha ao inicializar a página. Verifique sua conexão ou contate o suporte.");
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
            // O status será atualizado por outras funções (checkOpenTurno, abrir, fechar)
            // Apenas reabilita botões se apropriado pelo estado atual
             if(btnAbrirTurno) btnAbrirTurno.disabled = !!currentTurnoId || turnoAbertoLocalmente;
             if(btnFecharTurno) btnFecharTurno.disabled = !currentTurnoId && !turnoAbertoLocalmente;
        }
    }
    
    function setInitialPeriodo() {
        if (turnoAbertoLocalmente || currentTurnoId) return; 
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
    
    async function checkOpenTurno() {
        showLoadingState(true, "Verificando turno...");
        
        try {
            // Primeiro, verifica se existe algum turno aberto no banco
            const turnosAbertosQuery = await db.collection('turnos').where('status', '==', 'aberto').get();
            
            if (!turnosAbertosQuery.empty) {
                // Existe um turno aberto
                const turnoAberto = turnosAbertosQuery.docs[0];
                currentTurnoId = turnoAberto.id;
                localStorage.setItem('currentTurnoId', currentTurnoId);
                
                const turnoData = turnoAberto.data();
                loadTurnoDataToForm(turnoData);
                populateTurnoDetails(turnoData.abertura);

                btnAbrirTurno.disabled = true;
                btnFecharTurno.disabled = false;
                turnoStatusP.textContent = `Turno ${currentTurnoId.split('_')[1]} de ${currentTurnoId.split('_')[0]} está aberto.`;
                turnoStatusP.className = 'text-center text-blue-600 font-semibold mb-4';
                turnoAbertoLocalmente = true;
                toggleFormInputs(true);
            } else if (localStorage.getItem('currentTurnoId')) {
                // Não há turno aberto no banco, mas existe no localStorage
                // Isso pode acontecer se o turno foi fechado em outro dispositivo
                resetFormAndState("Turno salvo localmente não encontrado ou já fechado no servidor.");
            } else {
                resetFormAndState(); // Nenhum turno aberto
            }
        } catch (error) {
            console.error("Erro ao verificar turno aberto no servidor:", error);
            resetFormAndState("Erro ao verificar turno. Tente recarregar.");
        }
        
        showLoadingState(false);
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
        currentTurnoId = null;
        localStorage.removeItem('currentTurnoId');
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

        // Limpa campos específicos de Gelo, se eles tiverem lógica própria de totalização
        const geloKey = 'gelo_pacote';
        const totalGeloDisplay = document.getElementById(`${geloKey}_total_item`);
        if (totalGeloDisplay) totalGeloDisplay.textContent = 'R$ 0.00';
        const totalFooterGelo = document.getElementById('totalGeloValor');
        if (totalFooterGelo) totalFooterGelo.textContent = 'R$ 0.00';
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
            
            // Verifica se já existe um turno aberto
            const turnosAbertosQuery = await db.collection('turnos').where('status', '==', 'aberto').get();
            if (!turnosAbertosQuery.empty) {
                showError("Já existe um turno aberto. É necessário fechar o turno atual antes de abrir um novo.");
                return;
            }
            
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
                const existingTurno = await db.collection('turnos').doc(turnoIdProposto).get();
                if (existingTurno.exists) {
                    showError(`Já existe um turno (${periodoSelecionado}) registrado para hoje (${dataAtual}).`);
                    showLoadingState(false);
                    btnAbrirTurno.disabled = false;
                    return;
                }
                
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

                // Carrega 'sobra' do turno anterior para 'entrada' do atual
                const estoqueAnterior = await getEstoqueInicial(dataAtual, periodoSelecionado);
                
                const initialItensData = collectItemData(true);

                const turnoDataToSave = {
                    abertura: aberturaDataObj,
                    status: 'aberto',
                    caixaInicial: caixaInicialVal,
                    itens: initialItensData.itens,
                    gelo: initialItensData.gelo,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                };

                await db.collection('turnos').doc(turnoIdProposto).set(turnoDataToSave);
                currentTurnoId = turnoIdProposto;
                localStorage.setItem('currentTurnoId', currentTurnoId);

                turnoAbertoLocalmente = true;
                btnAbrirTurno.disabled = true;
                btnFecharTurno.disabled = false;
                turnoStatusP.textContent = `Turno ${periodoSelecionado} de ${dataAtual} aberto com sucesso!`;
                turnoStatusP.className = 'text-center text-green-600 font-semibold mb-4';
                toggleFormInputs(true);
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
                const estoqueFinal = { itens: {}, gelo: {} };
                
                // Carrega dados dos itens
                if (dados.itens) {
                    Object.keys(dados.itens).forEach(cat => {
                        estoqueFinal.itens[cat] = {};
                        Object.keys(dados.itens[cat]).forEach(item => {
                            const sobra = dados.itens[cat][item].sobra || 0;
                            estoqueFinal.itens[cat][item] = { 
                                sobra: sobra,
                                entrada: sobra // Usa a sobra como entrada do próximo turno
                            };
                            
                            // Preenche o input de entrada e o torna readonly
                            const entradaInput = document.getElementById(`${item}_entrada`);
                            if (entradaInput) {
                                entradaInput.value = sobra;
                                entradaInput.readOnly = true;
                                entradaInput.classList.add('bg-gray-100');
                            }
                        });
                    });
                }
                
                // Carrega dados do gelo
                if (dados.gelo && dados.gelo.gelo_pacote) { 
                    const sobraGelo = dados.gelo.gelo_pacote.sobra || 0;
                    estoqueFinal.gelo.gelo_pacote = { 
                        sobra: sobraGelo,
                        entrada: sobraGelo // Usa a sobra como entrada do próximo turno
                    };
                    
                    // Preenche o input de entrada do gelo e o torna readonly
                    const geloEntradaInput = document.getElementById(`gelo_pacote_entrada`);
                    if (geloEntradaInput) {
                        geloEntradaInput.value = sobraGelo;
                        geloEntradaInput.readOnly = true;
                        geloEntradaInput.classList.add('bg-gray-100');
                    }
                }
                
                return estoqueFinal;
            }
            console.warn(`Estoque do turno anterior (${idTurnoAnterior}) não encontrado ou não fechado. Iniciando com estoque zero.`);
        } catch (error) {
            console.error("Erro ao buscar estoque do turno anterior:", error);
        }
        return { itens: {}, gelo: {} };
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

            // Pegar o caixa inicial que foi registrado na abertura
            // O caixaInicioInput pode ter sido alterado se não estivesse readonly após a abertura.
            // É mais seguro buscar do objeto do turno carregado ou, se for uma nova abertura, do valor que foi salvo.
            let caixaInicialDoTurno;
            const turnoDocAberto = await db.collection('turnos').doc(currentTurnoId).get();
            if (turnoDocAberto.exists) {
                caixaInicialDoTurno = turnoDocAberto.data().caixaInicial;
            } else {
                showError("Turno não encontrado no servidor para fechar. Contate o suporte.");
                showLoadingState(false);
                // Não reabilitar btnFecharTurno
                return;
            }


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
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                await db.collection('turnos').doc(currentTurnoId).update(turnoUpdateData);
                turnoStatusP.textContent = `Turno ${currentTurnoId.split('_')[1]} de ${currentTurnoId.split('_')[0]} fechado com sucesso.`;
                turnoStatusP.className = 'text-center text-green-600 font-semibold mb-4';
                
                resetFormAndState(); // Limpa o formulário e reseta o estado da UI
                localStorage.removeItem('currentTurnoId'); // Faz isso no resetFormAndState
                currentTurnoId = null; // Faz isso no resetFormAndState
                turnoAbertoLocalmente = false; // Faz isso no resetFormAndState

            } catch (error) {
                console.error("Erro ao fechar turno: ", error);
                showError("Falha ao fechar turno: " + error.message + ". O turno pode ainda estar aberto. Verifique e tente novamente ou contate o suporte.");
                // Não reabilitar btnFecharTurno, pois o estado é incerto. Usuário deve recarregar ou admin verificar.
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


    // --- CÁLCULOS E ATUALIZAÇÕES DINÂMICAS ---
    function setupEventListeners() {
        formTurno.addEventListener('input', (e) => {
            const target = e.target;
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

        // Caixa esperado = caixa inicial + dinheiro recebido em dinheiro
        const caixaEsperado = caixaInicial + dinheiroRecebido;
        const diferenca = caixaFinalContadoVal - caixaEsperado;

        caixaDiferencaInput.value = `R$ ${diferenca.toFixed(2)}`;
        
        let divergente = false;
        if (caixaDiferencaContainer) { // Verifica se o container existe
            if (Math.abs(diferenca) > 0.015) { // Aumentada a tolerância para 0.015
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
        const temDivergencia = diffValores > 0.015 || caixaDivergente;

        if (temDivergencia) {
            let message = "<strong>ATENÇÃO: DIVERGÊNCIAS DETECTADAS!</strong><br>";
            if (diffValores > 0.015) {
                message += `• Diferença entre Total Vendido Calculado (R$ ${totalVendidoCalc.toFixed(2)}) e Total Registrado em Pagamentos (R$ ${totalPagamentos.toFixed(2)}): <span class="font-bold">R$ ${(totalVendidoCalc - totalPagamentos).toFixed(2)}</span><br>`;
            }
            if (caixaDivergente) {
                const difCaixaVal = parseFloat(caixaDiferencaInput.value.replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.')) || 0;
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
                            }
                        }
                    });
                }
            });
        }
    }
});