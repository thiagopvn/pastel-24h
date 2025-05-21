document.addEventListener('DOMContentLoaded', async () => {
    // Elementos das abas
    const btnTabDashboard = document.getElementById('btnTabDashboard');
    const btnTabPrecos = document.getElementById('btnTabPrecos');
    const btnTabUsuarios = document.getElementById('btnTabUsuarios');
    
    const tabContentDashboard = document.getElementById('tabContentDashboard');
    const tabContentPrecos = document.getElementById('tabContentPrecos');
    const tabContentUsuarios = document.getElementById('tabContentUsuarios');
    
    const allTabsButtons = [btnTabDashboard, btnTabPrecos, btnTabUsuarios];
    const allTabsContents = [tabContentDashboard, tabContentPrecos, tabContentUsuarios];

    // Elementos da Aba de Preços
    const formPrecos = document.getElementById('formPrecos');
    const precosPasteisContainer = document.getElementById('precosPasteisContainer');
    const precosCasquinhasContainer = document.getElementById('precosCasquinhasContainer');
    const precosCaldoCanaContainer = document.getElementById('precosCaldoCanaContainer');
    const precosRefrigerantesContainer = document.getElementById('precosRefrigerantesContainer');
    const precosGeloContainer = document.getElementById('precosGeloContainer');
    const precosSalvosMsg = document.getElementById('precosSalvosMsg');
    const precosErrorMsg = document.getElementById('precosErrorMsg');
    
    // Elementos do Dashboard
    const vendasPorProdutoReportDiv = document.getElementById('vendasPorProdutoReport');
    const pagamentosReportDiv = document.getElementById('pagamentosReport');
    const divergenciasReportDiv = document.getElementById('divergenciasReport');
    const turnosIncompletosReportDiv = document.getElementById('turnosIncompletosReport');
    const dataFiltroDashboardInput = document.getElementById('dataFiltroDashboard');
    const btnFiltrarDashboard = document.getElementById('btnFiltrarDashboard');
    
    // Novo elemento para o relatório de transferências entre turnos
    const transferenciasTurnosReportDiv = document.createElement('div');
    transferenciasTurnosReportDiv.id = 'transferenciasTurnosReport';
    transferenciasTurnosReportDiv.className = 'md:col-span-2 bg-blue-50 p-5 rounded-lg shadow-sm border border-blue-200 report-card';
    if (turnosIncompletosReportDiv && turnosIncompletosReportDiv.parentNode) {
        turnosIncompletosReportDiv.parentNode.insertBefore(transferenciasTurnosReportDiv, turnosIncompletosReportDiv.nextSibling);
    }
    
    // Adiciona título ao relatório de transferências
    const tituloTransferencias = document.createElement('h3');
    tituloTransferencias.className = 'text-lg font-semibold text-blue-600 mb-3 pb-2 border-b border-blue-200 flex items-center';
    tituloTransferencias.innerHTML = '<i class="fas fa-exchange-alt mr-2"></i>Transferências entre Turnos';
    transferenciasTurnosReportDiv.appendChild(tituloTransferencias);
    
    // Conteúdo do relatório de transferências
    const conteudoTransferencias = document.createElement('div');
    conteudoTransferencias.className = 'text-sm space-y-2 report-list p-2 text-blue-700';
    transferenciasTurnosReportDiv.appendChild(conteudoTransferencias);

    // Elementos da Aba de Usuários
    const formNovoUsuario = document.getElementById('formNovoUsuario');
    const listaUsuariosContainer = document.getElementById('listaUsuariosContainer');
    const usuarioMsg = document.getElementById('usuarioMsg');
    // Campos do formulário de novo usuário
    const novoUsuarioUidInput = document.getElementById('novoUsuarioUid');
    const novoUsuarioNomeInput = document.getElementById('novoUsuarioNome');
    const novoUsuarioEmailInput = document.getElementById('novoUsuarioEmail');
    const novoUsuarioRoleSelect = document.getElementById('novoUsuarioRole');


    let currentPrices = {}; // Para carregar os preços atuais

    // --- NAVEGAÇÃO POR ABAS ---
    function switchTab(activeTabButton, activeTabContent) {
        allTabsButtons.forEach(btn => {
            btn.classList.remove('bg-orange-500', 'text-white', 'font-semibold');
            btn.classList.add('bg-gray-300', 'text-gray-700');
        });
        allTabsContents.forEach(content => content.classList.add('hidden'));

        activeTabButton.classList.add('bg-orange-500', 'text-white', 'font-semibold');
        activeTabButton.classList.remove('bg-gray-300', 'text-gray-700');
        activeTabContent.classList.remove('hidden');
    }

    if (btnTabDashboard) btnTabDashboard.addEventListener('click', () => {
        switchTab(btnTabDashboard, tabContentDashboard);
        loadDashboardData(dataFiltroDashboardInput.value || null); 
    });
    if (btnTabPrecos) btnTabPrecos.addEventListener('click', () => {
        switchTab(btnTabPrecos, tabContentPrecos);
        loadCurrentPrices();
    });
    if (btnTabUsuarios) btnTabUsuarios.addEventListener('click', () => {
        switchTab(btnTabUsuarios, tabContentUsuarios);
        loadUsuarios();
    });

    // --- GERENCIAMENTO DE PREÇOS ---
    function createPriceInput(itemDisplayName, categoryKey, itemKey, currentPriceValue) {
        const div = document.createElement('div');
        
        const label = document.createElement('label');
        label.htmlFor = `preco_${categoryKey}_${itemKey}`;
        label.className = 'block text-sm font-medium text-gray-700 mb-1';
        label.textContent = itemDisplayName;
        
        const input = document.createElement('input');
        input.type = 'number';
        input.id = `preco_${categoryKey}_${itemKey}`;
        input.name = `preco_${categoryKey}_${itemKey}`;
        input.step = '0.01';
        input.min = '0';
        input.required = true;
        input.className = 'mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm';
        input.value = currentPriceValue ? parseFloat(currentPriceValue).toFixed(2) : '0.00';
        input.dataset.categoryKey = categoryKey;
        input.dataset.itemKey = itemKey;

        div.appendChild(label);
        div.appendChild(input);
        return div;
    }

    async function loadCurrentPrices() {
        precosSalvosMsg.textContent = '';
        precosErrorMsg.textContent = '';
        precosPasteisContainer.innerHTML = '<p class="text-gray-500">Carregando preços de pastéis...</p>';
        // Limpar outros containers também...
        precosCasquinhasContainer.innerHTML = '';
        precosCaldoCanaContainer.innerHTML = '';
        precosRefrigerantesContainer.innerHTML = '';
        precosGeloContainer.innerHTML = '';


        try {
            const snapshot = await db.collection('produtos').get();
            currentPrices = {};
            snapshot.forEach(doc => {
                currentPrices[doc.id] = doc.data(); 
            });
            populatePriceForms();
        } catch (error) {
            console.error("Erro ao carregar preços:", error);
            precosErrorMsg.textContent = "Erro ao carregar preços atuais.";
            precosPasteisContainer.innerHTML = '<p class="text-red-500">Falha ao carregar preços.</p>';
        }
    }

    function populatePriceForms() {
        // Limpar mensagens e containers
        precosPasteisContainer.innerHTML = '';
        precosCasquinhasContainer.innerHTML = '';
        precosCaldoCanaContainer.innerHTML = '';
        precosRefrigerantesContainer.innerHTML = '';
        precosGeloContainer.innerHTML = '';
        precosErrorMsg.textContent = '';
        precosSalvosMsg.textContent = '';

        // Usar listas do shared.js se estiverem disponíveis globalmente ou importar
        const localListaSaboresPasteis = typeof listaSaboresPasteis !== 'undefined' ? listaSaboresPasteis : [];
        const localListaCasquinhas = typeof listaCasquinhas !== 'undefined' ? listaCasquinhas : [];
        const localListaCaldoCana = typeof listaCaldoCana !== 'undefined' ? listaCaldoCana : [];
        const localListaRefrigerantes = typeof listaRefrigerantes !== 'undefined' ? listaRefrigerantes : [];

        if (localListaSaboresPasteis.length === 0) {
            precosErrorMsg.textContent = "Listas de produtos não carregadas. Verifique shared.js.";
            return;
        }

        localListaSaboresPasteis.forEach(sabor => {
            const key = sabor.toLowerCase().replace(/\s+/g, '_').replace(/[ç]/g, 'c').replace(/[ãâáàä]/g, 'a').replace(/[éêèë]/g, 'e').replace(/[íìîï]/g, 'i').replace(/[óôõòö]/g, 'o').replace(/[úùûü]/g, 'u');
            precosPasteisContainer.appendChild(createPriceInput(sabor, 'pasteis', key, currentPrices.pasteis?.[key]?.preco));
        });
        localListaCasquinhas.forEach(casquinha => {
            const key = casquinha.toLowerCase().replace(/\s+/g, '_');
            precosCasquinhasContainer.appendChild(createPriceInput(casquinha, 'casquinhas', key, currentPrices.casquinhas?.[key]?.preco));
        });
        localListaCaldoCana.forEach(item => {
            const key = item.toLowerCase().replace(/\s+/g, '_').replace(/[ç]/g, 'c').replace(/\d+ml/, d => d.toLowerCase()).replace(/\d+litro/, d => d.toLowerCase());
            precosCaldoCanaContainer.appendChild(createPriceInput(item, 'caldo_cana', key, currentPrices.caldo_cana?.[key]?.preco));
        });
        localListaRefrigerantes.forEach(item => {
            const key = item.toLowerCase().replace(/\s+/g, '_').replace(/[ç]/g, 'c').replace(/\./g, '');
            precosRefrigerantesContainer.appendChild(createPriceInput(item, 'refrigerantes', key, currentPrices.refrigerantes?.[key]?.preco));
        });
        
        const geloKey = 'gelo_pacote';
        precosGeloContainer.appendChild(createPriceInput('Gelo (Pacote)', 'gelo', geloKey, currentPrices.gelo?.[geloKey]?.preco));
    }

    if (formPrecos) {
        formPrecos.addEventListener('submit', async (e) => {
            e.preventDefault();
            precosSalvosMsg.textContent = '';
            precosErrorMsg.textContent = '';
            
            const newPricesData = {};
            const inputs = formPrecos.querySelectorAll('input[type="number"]');
            let hasError = false;

            inputs.forEach(input => {
                const category = input.dataset.categoryKey;
                const item = input.dataset.itemKey;
                const price = parseFloat(input.value);

                if (isNaN(price) || price < 0) {
                    input.classList.add('border-red-500');
                    hasError = true;
                    return;
                }
                input.classList.remove('border-red-500');

                if (!newPricesData[category]) {
                    newPricesData[category] = {};
                }
                newPricesData[category][item] = { preco: price };
            });

            if (hasError) {
                precosErrorMsg.textContent = "Por favor, corrija os preços inválidos (devem ser números positivos).";
                return;
            }
            
            const saveButton = formPrecos.querySelector('button[type="submit"]');
            saveButton.disabled = true;
            saveButton.textContent = 'Salvando...';

            try {
                const batch = db.batch();
                Object.keys(newPricesData).forEach(categoryKey => {
                    const categoryDocRef = db.collection('produtos').doc(categoryKey);
                    batch.set(categoryDocRef, newPricesData[categoryKey], { merge: true }); 
                });
                await batch.commit();
                precosSalvosMsg.textContent = "Preços salvos com sucesso!";
                currentPrices = JSON.parse(JSON.stringify(newPricesData)); // Atualiza os preços locais (deep copy)
                setTimeout(() => { 
                    precosSalvosMsg.textContent = '';
                    saveButton.disabled = false;
                    saveButton.textContent = 'Salvar Alterações nos Preços';
                }, 3000);
            } catch (error) {
                console.error("Erro ao salvar preços:", error);
                precosErrorMsg.textContent = "Erro ao salvar preços: " + error.message;
                saveButton.disabled = false;
                saveButton.textContent = 'Salvar Alterações nos Preços';
            }
        });
    }
    
    // --- DASHBOARD ---
    if (btnFiltrarDashboard) {
        btnFiltrarDashboard.addEventListener('click', () => {
            loadDashboardData(dataFiltroDashboardInput.value || null);
        });
    }
    
    async function loadDashboardData(filterDate = null) {
        if (!vendasPorProdutoReportDiv) return; // Se não estiver na aba Dashboard
        vendasPorProdutoReportDiv.innerHTML = '<p class="text-gray-500 p-4 text-center">Carregando vendas por produto...</p>';
        pagamentosReportDiv.innerHTML = '<p class="text-gray-500 p-4 text-center">Carregando formas de pagamento...</p>';
        divergenciasReportDiv.innerHTML = '<p class="text-gray-500 p-4 text-center">Carregando divergências...</p>';
        turnosIncompletosReportDiv.innerHTML = '<p class="text-gray-500 p-4 text-center">Carregando turnos incompletos...</p>';
        conteudoTransferencias.innerHTML = '<p class="text-gray-500 p-4 text-center">Carregando dados de transferências entre turnos...</p>';

        try {
            let query = db.collection('turnos').where('status', '==', 'fechado'); // Apenas turnos fechados para relatórios de vendas
            
            // Filtro de Data
            let startDate = null;
            let endDate = null;

            if (filterDate) {
                startDate = `${filterDate}_Manhã`; // ID no formato YYYY-MM-DD_Periodo
                endDate = `${filterDate}_Noite`;
                query = query.orderBy(firebase.firestore.FieldPath.documentId())
                             .startAt(startDate)
                             .endAt(endDate);
            } else {
                // Default: Últimos 30 dias. Precisamos do formato YYYY-MM-DD para o ID
                const date30DaysAgo = new Date();
                date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);
                const startDateString = getFormattedDate(date30DaysAgo); // Usar a função de shared.js
                
                query = query.orderBy(firebase.firestore.FieldPath.documentId(), 'desc')
                             .where(firebase.firestore.FieldPath.documentId(), '>=', `${startDateString}_Manhã`); 
                             // O 'limit' seria útil aqui, mas complexifica.
                             // Para simplicidade, vamos pegar todos após essa data e filtrar no client se necessário.
                             // Firestore tem limites em queries complexas.
            }

            const snapshot = await query.get();
            const turnosFechados = [];
            snapshot.forEach(doc => turnosFechados.push({ id: doc.id, ...doc.data() }));
            
            if (turnosFechados.length === 0) {
                const msg = filterDate ? `Nenhum turno fechado encontrado para ${filterDate}.` : 'Nenhum turno fechado encontrado nos últimos 30 dias.';
                vendasPorProdutoReportDiv.innerHTML = `<p class="text-gray-600 p-4 text-center">${msg}</p>`;
                pagamentosReportDiv.innerHTML = `<p class="text-gray-600 p-4 text-center">${msg}</p>`;
                divergenciasReportDiv.innerHTML = `<p class="text-gray-600 p-4 text-center">${msg}</p>`;
                conteudoTransferencias.innerHTML = `<p class="text-gray-600 p-4 text-center">${msg}</p>`;
            } else {
                generateVendasPorProdutoReport(turnosFechados);
                generatePagamentosReport(turnosFechados);
                generateDivergenciasReport(turnosFechados);
                generateTransferenciasReport(turnosFechados); // Nova função para relatório de transferências
            }

            // Para turnos incompletos/abertos, fazemos uma query separada
            const openOrIncompleteQuery = db.collection('turnos').where('status', '==', 'aberto');
            const openSnapshot = await openOrIncompleteQuery.get();
            const turnosAbertos = [];
            openSnapshot.forEach(doc => turnosAbertos.push({id: doc.id, ...doc.data()}));
            
            // Adicionar lógica para identificar outros "incompletos" se necessário (ex: fechado mas sem campos essenciais)
            generateTurnosIncompletosReport(turnosAbertos, turnosFechados);


        } catch (error) {
            console.error("Erro ao carregar dados do dashboard:", error);
            const errorMsg = `<p class="text-red-500 p-4 text-center">Erro ao carregar dados: ${error.message}. Verifique as regras do Firestore.</p>`;
            vendasPorProdutoReportDiv.innerHTML = errorMsg;
            pagamentosReportDiv.innerHTML = errorMsg;
            divergenciasReportDiv.innerHTML = errorMsg;
            turnosIncompletosReportDiv.innerHTML = errorMsg;
            conteudoTransferencias.innerHTML = errorMsg;
        }
    }

    function formatItemKeyForDisplay(itemKey) {
        return itemKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    function generateVendasPorProdutoReport(turnos) {
        const vendas = {}; 
        turnos.forEach(turno => {
            if (turno.itens) {
                Object.values(turno.itens).forEach(categoryItems => { // Ex: categoryItems = turno.itens.pasteis
                    if (typeof categoryItems === 'object' && categoryItems !== null) {
                        Object.entries(categoryItems).forEach(([itemKey, itemData]) => {
                            if (itemData && typeof itemData.vendido === 'number' && typeof itemData.precoUnitario === 'number') {
                                const nomeAmigavel = formatItemKeyForDisplay(itemKey);
                                if (!vendas[nomeAmigavel]) vendas[nomeAmigavel] = { qtd: 0, valor: 0 };
                                vendas[nomeAmigavel].qtd += itemData.vendido;
                                vendas[nomeAmigavel].valor += itemData.vendido * itemData.precoUnitario;
                            }
                        });
                    }
                });
            }
            if (turno.gelo && turno.gelo.gelo_pacote) {
                const geloData = turno.gelo.gelo_pacote;
                if (typeof geloData.vendas === 'number' && typeof geloData.precoUnitario === 'number') {
                    const nomeAmigavelGelo = "Gelo (Pacote)";
                    if (!vendas[nomeAmigavelGelo]) vendas[nomeAmigavelGelo] = { qtd: 0, valor: 0 };
                    vendas[nomeAmigavelGelo].qtd += geloData.vendas;
                    vendas[nomeAmigavelGelo].valor += geloData.vendas * geloData.precoUnitario;
                }
            }
        });

        vendasPorProdutoReportDiv.innerHTML = '';
        if (Object.keys(vendas).length === 0) {
            vendasPorProdutoReportDiv.innerHTML = '<p class="text-gray-600 p-4 text-center">Nenhuma venda de produto registrada no período.</p>';
            return;
        }
        const ul = document.createElement('ul');
        ul.className = 'space-y-2';
        Object.entries(vendas).sort(([,a],[,b]) => b.valor - a.valor).forEach(([produto, data]) => { 
            if (data.qtd > 0) { // Mostrar apenas se houve vendas
                const li = document.createElement('li');
                li.className = 'flex justify-between items-center p-2 bg-white rounded shadow-xs';
                li.innerHTML = `<span>${produto}</span> <span class="font-semibold">${data.qtd} unid. - R$ ${data.valor.toFixed(2)}</span>`;
                ul.appendChild(li);
            }
        });
        vendasPorProdutoReportDiv.appendChild(ul);
    }

    function generatePagamentosReport(turnos) {
        const pagamentos = {
            dinheiro: 0, pixManual: 0, stoneDCV: 0, stoneVoucher: 0, pagbankDCV: 0
        };
        let totalGeralPagamentos = 0;

        turnos.forEach(turno => {
            if (turno.formasPagamento && typeof turno.formasPagamento === 'object') {
                Object.entries(turno.formasPagamento).forEach(([metodo, valor]) => {
                    if (pagamentos.hasOwnProperty(metodo) && typeof valor === 'number') {
                        pagamentos[metodo] += valor;
                        totalGeralPagamentos += valor;
                    }
                });
            }
        });
        
        pagamentosReportDiv.innerHTML = '';
        if (totalGeralPagamentos === 0) {
            pagamentosReportDiv.innerHTML = '<p class="text-gray-600 p-4 text-center">Nenhum pagamento registrado no período.</p>';
            return;
        }
        const ul = document.createElement('ul');
        ul.className = 'space-y-2';
        Object.entries(pagamentos).forEach(([metodo, valor]) => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-2 bg-white rounded shadow-xs';
            let nomeMetodo = metodo.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            if (nomeMetodo === 'Stone D C V') nomeMetodo = 'Stone D/C/V';
            if (nomeMetodo === 'Pagbank D C V') nomeMetodo = 'PagBank D/C/V';

            li.innerHTML = `<span>${nomeMetodo}</span> <span class="font-semibold">R$ ${valor.toFixed(2)}</span>`;
            ul.appendChild(li);
        });
        const liTotal = document.createElement('li');
        liTotal.className = 'font-bold mt-3 pt-3 border-t border-gray-300 flex justify-between items-center p-2';
        liTotal.innerHTML = `<span>TOTAL GERAL RECEBIDO</span> <span class="text-lg">R$ ${totalGeralPagamentos.toFixed(2)}</span>`;
        ul.appendChild(liTotal);
        pagamentosReportDiv.appendChild(ul);
    }

    function generateDivergenciasReport(turnosFechados) {
        divergenciasReportDiv.innerHTML = '';
        const ul = document.createElement('ul');
        ul.className = 'space-y-3';
        let hasDivergencias = false;

        turnosFechados.forEach(turno => {
            const vendidoCalc = turno.totalVendidoCalculadoFinal || 0;
            const pagamentosReg = turno.totalRegistradoPagamentosFinal || 0;
            const diffVendasPagamentos = vendidoCalc - pagamentosReg;

            const diffCaixa = turno.diferencaCaixaFinal || 0; 

            if (Math.abs(diffVendasPagamentos) > 0.01 || Math.abs(diffCaixa) > 0.01) {
                hasDivergencias = true;
                const li = document.createElement('li');
                li.className = 'p-3 bg-red-100 rounded shadow-xs border border-red-300';
                let dataHoraTurno = turno.id.split('_')[0]; // Pega a data do ID do turno
                if (turno.abertura && turno.abertura.hora) dataHoraTurno += ` ${turno.abertura.hora}`;

                let msg = `<div class="font-semibold text-red-700">Turno: ${dataHoraTurno} (${turno.id.split('_')[1]})</div>`;
                msg += `<div class="text-xs text-gray-600">Responsável Fechamento: ${turno.fechamento?.responsavelNome || 'N/A'}</div>`;
                
                if (Math.abs(diffVendasPagamentos) > 0.01) {
                    msg += `<p class="mt-1">Vendas (R$${vendidoCalc.toFixed(2)}) vs Pagamentos (R$${pagamentosReg.toFixed(2)}) = <span class="font-bold">R$${diffVendasPagamentos.toFixed(2)}</span></p>`;
                }
                if (Math.abs(diffCaixa) > 0.01) {
                    msg += `<p class="mt-1">Diferença Caixa Físico: <span class="font-bold">R$${diffCaixa.toFixed(2)}</span></p>`;
                }
                li.innerHTML = msg;
                ul.appendChild(li);
            }
        });

        if (!hasDivergencias) {
            divergenciasReportDiv.innerHTML = '<p class="text-green-600 p-4 text-center font-medium">Nenhuma divergência encontrada nos turnos fechados analisados. 🎉</p>';
        } else {
            divergenciasReportDiv.appendChild(ul);
        }
    }
    
    // NOVA FUNÇÃO: Gera relatório de transferências entre turnos
    function generateTransferenciasReport(turnosFechados) {
        conteudoTransferencias.innerHTML = '';
        const ul = document.createElement('ul');
        ul.className = 'space-y-3';
        let hasTransferencias = false;
        
        // Ordenar turnos por data de fechamento (mais recentes primeiro)
        const turnosOrdenados = [...turnosFechados].sort((a, b) => {
            if (a.closedAt && b.closedAt) {
                return b.closedAt.seconds - a.closedAt.seconds;
            }
            return 0;
        });
        
        // Procurar por turnos que contêm informações de transferência
        turnosOrdenados.forEach(turno => {
            // Verificar se este turno tem o campo turnoAnteriorId preenchido
            if (turno.turnoAnteriorId) {
                hasTransferencias = true;
                const li = document.createElement('li');
                li.className = 'p-3 bg-blue-50 rounded shadow-xs border border-blue-300';
                
                // Dados de data e hora do turno
                const dataHoraTurno = turno.id.split('_')[0];
                const periodoTurno = turno.id.split('_')[1];
                
                // Informações sobre o turno que recebeu a transferência
                let msg = `<div class="font-semibold text-blue-700">Transferência para o Turno: ${dataHoraTurno} (${periodoTurno})</div>`;
                msg += `<div class="text-xs text-gray-600">Turno Anterior: ${turno.turnoAnteriorId}</div>`;
                
                // Contador de itens transferidos
                let itensTransferidos = 0;
                
                // Verificar dados transferidos do turno anterior
                if (turno.dadosTransferidos) {
                    if (turno.dadosTransferidos.quantidadeItens) {
                        itensTransferidos = turno.dadosTransferidos.quantidadeItens;
                        msg += `<p class="mt-1 text-sm">Itens transferidos: <span class="font-semibold">${itensTransferidos}</span></p>`;
                    }
                    
                    if (turno.dadosTransferidos.caixaTransferido) {
                        msg += `<p class="mt-1 text-sm">Caixa transferido: <span class="font-semibold">R$ ${turno.caixaInicial?.toFixed(2) || '0.00'}</span></p>`;
                    }
                }
                
                // Responsável pela abertura do turno que recebeu a transferência
                msg += `<div class="text-xs text-gray-600 mt-1">Responsável: ${turno.abertura?.responsavelNome || 'N/A'}</div>`;
                
                li.innerHTML = msg;
                ul.appendChild(li);
            }
        });
        
        if (!hasTransferencias) {
            conteudoTransferencias.innerHTML = '<p class="text-blue-600 p-4 text-center font-medium">Nenhuma transferência entre turnos encontrada no período selecionado.</p>';
        } else {
            // Adicionar resumo de transferências
            const resumo = document.createElement('div');
            resumo.className = 'bg-white p-3 mb-3 rounded-lg shadow-sm';
            resumo.innerHTML = `
                <p class="text-sm font-medium text-blue-700">
                    ${ul.childElementCount} transferências encontradas no período
                </p>
            `;
            conteudoTransferencias.appendChild(resumo);
            conteudoTransferencias.appendChild(ul);
        }
    }
    
    function generateTurnosIncompletosReport(turnosAbertos, turnosFechados) {
        turnosIncompletosReportDiv.innerHTML = '';
        const ul = document.createElement('ul');
        ul.className = 'space-y-3';
        let hasIncompletos = false;

        turnosAbertos.forEach(turno => {
            hasIncompletos = true;
            const li = document.createElement('li');
            li.className = 'p-3 bg-yellow-100 rounded shadow-xs border border-yellow-300';
            let dataHoraAbertura = turno.id.split('_')[0]; // Data do ID
            if (turno.abertura && turno.abertura.hora) dataHoraAbertura += ` ${turno.abertura.hora}`;

            li.innerHTML = `<div class="font-semibold text-yellow-700">Turno Aberto: ${dataHoraAbertura} (${turno.id.split('_')[1]})</div>
                            <div class="text-xs text-gray-600">Responsável Abertura: ${turno.abertura?.responsavelNome || 'N/A'}</div>`;
            
            // Adicionar informação sobre dados transferidos de turno anterior, se houver
            if (turno.turnoAnteriorId) {
                li.innerHTML += `<div class="mt-1 text-xs text-blue-600">
                    <i class="fas fa-exchange-alt mr-1"></i> Recebeu dados do turno: ${turno.turnoAnteriorId}
                </div>`;
            }
            
            ul.appendChild(li);
        });
        
        // Adicional: Verificar turnos fechados que possam ter campos faltando (exemplo)
        turnosFechados.forEach(turno => {
            let camposFaltantesMsg = "";
            if (!turno.formasPagamento) camposFaltantesMsg += "Formas de Pagamento, ";
            if (turno.caixaFinalContado === undefined) camposFaltantesMsg += "Caixa Final Contado, ";
            // Adicionar mais verificações conforme necessário

            if (camposFaltantesMsg) {
                hasIncompletos = true;
                const li = document.createElement('li');
                 li.className = 'p-3 bg-yellow-100 rounded shadow-xs border border-yellow-300';
                camposFaltantesMsg = camposFaltantesMsg.slice(0, -2); // Remove última vírgula e espaço
                li.innerHTML = `<div class="font-semibold text-yellow-700">Turno Fechado com Dados Faltando: ${turno.id}</div>
                                <div class="text-xs text-gray-600">Responsável Fechamento: ${turno.fechamento?.responsavelNome || 'N/A'}</div>
                                <p class="mt-1 text-sm">Faltando: ${camposFaltantesMsg}</p>`;
                ul.appendChild(li);
            }
        });


        if (!hasIncompletos) {
            turnosIncompletosReportDiv.innerHTML = '<p class="text-green-600 p-4 text-center font-medium">Nenhum turno atualmente aberto ou incompleto encontrado.</p>';
        } else {
            turnosIncompletosReportDiv.appendChild(ul);
        }
    }
    
    // --- GERENCIAMENTO DE USUÁRIOS ---
    if (formNovoUsuario) {
        formNovoUsuario.addEventListener('submit', async (e) => {
            e.preventDefault();
            usuarioMsg.textContent = '';
            usuarioMsg.className = "text-sm mt-3 text-center font-medium";

            const uid = novoUsuarioUidInput.value.trim();
            const nome = novoUsuarioNomeInput.value.trim();
            const email = novoUsuarioEmailInput.value.trim();
            const role = novoUsuarioRoleSelect.value;

            if (!uid || !nome || !email) {
                usuarioMsg.textContent = "UID, Nome e Email são obrigatórios.";
                usuarioMsg.classList.add("text-red-500");
                return;
            }
            
            const addButton = formNovoUsuario.querySelector('button[type="submit"]');
            addButton.disabled = true;
            addButton.textContent = 'Registrando...';

            try {
                await db.collection('usuarios').doc(uid).set({
                    nome: nome,
                    email: email, 
                    role: role,
                    // createdAt: firebase.firestore.FieldValue.serverTimestamp() // Opcional
                });

                usuarioMsg.textContent = `Usuário ${nome} (${email}) registrado/atualizado no sistema com role ${role}.`;
                usuarioMsg.classList.add("text-green-600");
                formNovoUsuario.reset();
                loadUsuarios(); 
            } catch (error) {
                console.error("Erro ao registrar usuário no Firestore:", error);
                usuarioMsg.textContent = "Erro ao processar usuário: " + error.message;
                usuarioMsg.classList.add("text-red-500");
            } finally {
                 addButton.disabled = false;
                 addButton.textContent = 'Adicionar/Registrar Usuário no Sistema';
                 setTimeout(() => usuarioMsg.textContent = '', 5000);
            }
        });
    }
    
    async function loadUsuarios() {
        if (!listaUsuariosContainer) return;
        listaUsuariosContainer.innerHTML = '<p class="text-gray-500 p-4 text-center">Carregando usuários...</p>';
        try {
            const snapshot = await db.collection('usuarios').get();
            if (snapshot.empty) {
                listaUsuariosContainer.innerHTML = '<p class="text-gray-600 p-4 text-center">Nenhum usuário cadastrado no sistema Firestore.</p>';
                return;
            }
            
            listaUsuariosContainer.innerHTML = ''; 
            const ul = document.createElement('ul');
            ul.className = 'space-y-3';

            snapshot.forEach(doc => {
                const userData = doc.data();
                const userId = doc.id; // Este é o UID

                const li = document.createElement('li');
                li.className = 'p-4 bg-white rounded-lg shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0';
                
                const userInfoDiv = document.createElement('div');
                userInfoDiv.innerHTML = `<strong class="block text-gray-700">${userData.nome || 'Sem nome'}</strong>
                                         <span class="text-sm text-gray-500">${userData.email || 'Sem email'}</span>
                                         <span class="text-xs text-gray-400 block">UID: ${userId}</span>`;
                
                const controlsDiv = document.createElement('div');
                controlsDiv.className = 'flex items-center space-x-2 flex-wrap';

                const roleLabel = document.createElement('span');
                roleLabel.className = "text-sm mr-1";
                roleLabel.textContent = "Role:";
                controlsDiv.appendChild(roleLabel);

                const roleSelect = document.createElement('select');
                roleSelect.className = 'p-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-orange-500 focus:border-orange-500';
                roleSelect.dataset.userId = userId;
                ['funcionario', 'admin'].forEach(r => {
                    const option = document.createElement('option');
                    option.value = r;
                    option.textContent = r.charAt(0).toUpperCase() + r.slice(1);
                    if (userData.role === r) option.selected = true;
                    roleSelect.appendChild(option);
                });
                controlsDiv.appendChild(roleSelect);

                const saveRoleButton = document.createElement('button');
                saveRoleButton.textContent = 'Salvar Role';
                saveRoleButton.className = 'bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs shadow-sm transition duration-150';
                saveRoleButton.onclick = async () => {
                    const newRole = roleSelect.value;
                    saveRoleButton.textContent = 'Salvando...';
                    saveRoleButton.disabled = true;
                    try {
                        // Não permitir que o admin mude sua própria role para funcionário se for o único admin (regra de negócio, não de BD aqui)
                        if (auth.currentUser.uid === userId && newRole === 'funcionario') {
                             // Poderia verificar se existem outros admins antes de bloquear
                            alert("Você não pode rebaixar sua própria conta de admin para funcionário desta forma, se for o único administrador.");
                            roleSelect.value = userData.role; // Volta ao valor original
                            return;
                        }

                        await db.collection('usuarios').doc(userId).update({ role: newRole });
                        alert(`Role de ${userData.nome || userId} atualizada para ${newRole}.`);
                        userData.role = newRole; // Atualiza localmente para evitar recarregar tudo
                    } catch (err) {
                        console.error("Erro ao atualizar role:", err);
                        alert(`Erro ao atualizar role: ${err.message}`);
                        roleSelect.value = userData.role; // Volta ao valor original
                    } finally {
                        saveRoleButton.textContent = 'Salvar Role';
                        saveRoleButton.disabled = false;
                    }
                };
                controlsDiv.appendChild(saveRoleButton);
                
                const removeUserButton = document.createElement('button');
                removeUserButton.textContent = 'Remover';
                removeUserButton.className = 'bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-md text-xs shadow-sm transition duration-150';
                removeUserButton.title = "Remove o registro do usuário do Firestore (sistema de caixa). NÃO remove do Firebase Authentication."
                removeUserButton.onclick = async () => {
                    if (confirm(`Tem certeza que deseja remover ${userData.nome || userId} do sistema de caixa? Isso NÃO remove o login do Firebase Auth.`)) {
                        
                        if (auth.currentUser.uid === userId) {
                            alert("Você não pode remover a si mesmo do sistema.");
                            return;
                        }
                        removeUserButton.textContent = "Removendo...";
                        removeUserButton.disabled = true;
                        try {
                            await db.collection('usuarios').doc(userId).delete();
                            alert(`${userData.nome || userId} removido do sistema de caixa.`);
                            loadUsuarios(); 
                        } catch (err) {
                            console.error("Erro ao remover usuário:", err);
                            alert(`Erro ao remover usuário: ${err.message}`);
                            removeUserButton.textContent = 'Remover';
                            removeUserButton.disabled = false;
                        }
                    }
                };
                controlsDiv.appendChild(removeUserButton);

                li.appendChild(userInfoDiv);
                li.appendChild(controlsDiv);
                ul.appendChild(li);
            });
            listaUsuariosContainer.appendChild(ul);

        } catch (error) {
            console.error("Erro ao carregar usuários:", error);
            listaUsuariosContainer.innerHTML = `<p class="text-red-500 p-4 text-center">Erro ao carregar usuários: ${error.message}</p>`;
        }
    }

    // Inicialização da aba padrão
    if (btnTabDashboard && tabContentDashboard) { // Verifica se os elementos existem
        switchTab(btnTabDashboard, tabContentDashboard);
        loadDashboardData(); 
    } else if (allTabsButtons.length > 0 && allTabsContents.length > 0) { // Fallback para a primeira aba, se dashboard não for a padrão/existir
        switchTab(allTabsButtons[0], allTabsContents[0]);
        if(allTabsButtons[0].id === 'btnTabDashboard') loadDashboardData();
        if(allTabsButtons[0].id === 'btnTabPrecos') loadCurrentPrices();
        if(allTabsButtons[0].id === 'btnTabUsuarios') loadUsuarios();
    }
});

// Função getFormattedDate (de shared.js - se não estiver global, defina aqui)
if (typeof getFormattedDate === 'undefined') {
    function getFormattedDate(date = new Date()) {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
}