if (typeof window.STORAGE_KEYS === 'undefined') {
    window.STORAGE_KEYS = {
        USER: 'pastelaria_user_data',
        AUTH_STATE: 'pastelaria_auth_state',
        USER_ROLE: 'userRole',
        USER_NAME: 'userName',
        USER_UID: 'userUID',
        CURRENT_TURNO_ID: 'currentTurnoId',
        TURNO_DATA: 'turnoData',
        TURNO_STATUS: 'turnoStatus',
        LAST_CLOSED_TURNO: 'lastClosedTurno',
        PREVIOUS_TURNO_ID: 'previousTurnoId',
        TRANSFERRED_DATA: 'transferredData',
        APP_CONFIG: 'pastelaria_config',
        LAST_ROUTE: 'pastelaria_last_route',
        LAST_SYNC: 'pastelaria_last_sync',
        OFFLINE_DATA: 'pastelaria_offline_data',
        PERSISTED_TIMESTAMPS: 'pastelaria_persisted_timestamps'
    };
}

if (typeof window.listaSaboresPasteis === 'undefined') {
    window.listaSaboresPasteis = [
        "Carne com Queijo", "Carne", "Frango com Catupiry", "Frango com Queijo",
        "Carioca", "Pizza", "Palmito", "Queijo", "4 Queijos", "Bauru",
        "Calabresa", "Portuguesa", "Carne Seca", "Especial Carne Seca",
        "Especial de Carne", "Especial de Calabresa"
    ];
}

if (typeof window.listaCasquinhas === 'undefined') {
    window.listaCasquinhas = ["Casquinha Crua", "Casquinha Frita"];
}

if (typeof window.listaCaldoCana === 'undefined') {
    window.listaCaldoCana = [
        "Fardo de Cana", "Copo 300ml", "Copo 400ml", "Copo 500ml",
        "Garrafa 500ml", "Garrafa 1 Litro"
    ];
}

if (typeof window.listaRefrigerantes === 'undefined') {
    window.listaRefrigerantes = [
        "Coca-Cola", "Fanta Laranja", "Fanta Uva", "Guaraná", "Refri Limão",
        "Refri. Zero", "Itubaina", "Água", "Água c/ Gás",
        "Cerveja Longneck", "Cerveja Lata"
    ];
}

function setLocalItem(key, value, includeTimestamp = false) {
    try {
        let dataToStore = value;
        if (typeof value !== 'string') {
            if (includeTimestamp && typeof value === 'object' && value !== null) {
                dataToStore = { ...value, lastUpdated: new Date().toISOString() };
            }
            dataToStore = JSON.stringify(dataToStore);
        }
        localStorage.setItem(key, dataToStore);
        if (includeTimestamp) {
            recordTimestamp(key);
        }
        return true;
    } catch (error) {
        console.error(`Erro ao salvar item '${key}' no localStorage:`, error);
        return false;
    }
}

function getLocalItem(key, parseJson = true, defaultValue = null) {
    try {
        const value = localStorage.getItem(key);
        if (value === null) return defaultValue;
        if (parseJson) {
            try {
                return JSON.parse(value);
            } catch (parseError) {
                console.warn(`Valor em '${key}' não é um JSON válido:`, parseError);
                return value;
            }
        }
        return value;
    } catch (error) {
        console.error(`Erro ao recuperar item '${key}' do localStorage:`, error);
        return defaultValue;
    }
}

function removeLocalItem(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error(`Erro ao remover item '${key}' do localStorage:`, error);
        return false;
    }
}

function recordTimestamp(key) {
    try {
        const timestamps = getLocalItem(STORAGE_KEYS.PERSISTED_TIMESTAMPS, true, {});
        timestamps[key] = new Date().toISOString();
        setLocalItem(STORAGE_KEYS.PERSISTED_TIMESTAMPS, timestamps);
    } catch (error) {
        console.error("Erro ao registrar timestamp:", error);
    }
}

function getLastUpdateTime(key) {
    try {
        const timestamps = getLocalItem(STORAGE_KEYS.PERSISTED_TIMESTAMPS, true, {});
        const timestamp = timestamps[key];
        return timestamp ? new Date(timestamp) : null;
    } catch (error) {
        console.error("Erro ao verificar timestamp:", error);
        return null;
    }
}

function clearStaleData(maxAge = 86400000) {
    try {
        const now = new Date();
        const timestamps = getLocalItem(STORAGE_KEYS.PERSISTED_TIMESTAMPS, true, {});
        Object.entries(timestamps).forEach(([key, timestamp]) => {
            const updateTime = new Date(timestamp);
            if (now - updateTime > maxAge) {
                removeLocalItem(key);
                delete timestamps[key];
            }
        });
        setLocalItem(STORAGE_KEYS.PERSISTED_TIMESTAMPS, timestamps);
    } catch (error) {
        console.error("Erro ao limpar dados desatualizados:", error);
    }
}

function setLocalUser(user) {
    if (!user) return false;
    try {
        const userData = {
            uid: user.uid || '',
            email: user.email || '',
            displayName: user.displayName || '',
            role: user.role || localStorage.getItem(STORAGE_KEYS.USER_ROLE) || '',
            lastLogin: new Date().toISOString()
        };
        setLocalItem(STORAGE_KEYS.USER, userData, true);
        setLocalItem(STORAGE_KEYS.AUTH_STATE, 'true');
        setLocalItem(STORAGE_KEYS.USER_ROLE, userData.role);
        setLocalItem(STORAGE_KEYS.USER_NAME, userData.displayName || userData.email);
        setLocalItem(STORAGE_KEYS.USER_UID, userData.uid);
        return true;
    } catch (error) {
        console.error("Erro ao salvar usuário local:", error);
        return false;
    }
}

function getLocalUser() {
    try {
        const userData = getLocalItem(STORAGE_KEYS.USER, true, null);
        if (userData && userData.uid && (userData.email || userData.displayName)) {
            return userData;
        }
        return null;
    } catch (error) {
        console.error("Erro ao obter usuário local:", error);
        return null;
    }
}

function clearLocalUser() {
    try {
        removeLocalItem(STORAGE_KEYS.USER);
        removeLocalItem(STORAGE_KEYS.AUTH_STATE);
        removeLocalItem(STORAGE_KEYS.USER_ROLE);
        removeLocalItem(STORAGE_KEYS.USER_NAME);
        removeLocalItem(STORAGE_KEYS.USER_UID);
    } catch (error) {
        console.error("Erro ao limpar dados do usuário:", error);
    }
}

function setTurnoLocal(turnoData) {
    if (!turnoData || !turnoData.id) return false;
    try {
        setLocalItem(STORAGE_KEYS.CURRENT_TURNO_ID, turnoData.id);
        setLocalItem(STORAGE_KEYS.TURNO_DATA, turnoData, true);
        setLocalItem(STORAGE_KEYS.TURNO_STATUS, turnoData.status || 'desconhecido');
        return true;
    } catch (error) {
        console.error("Erro ao salvar turno local:", error);
        return false;
    }
}

function getTurnoLocal() {
    try {
        const turnoId = getLocalItem(STORAGE_KEYS.CURRENT_TURNO_ID, false);
        if (!turnoId) return null;
        const turnoData = getLocalItem(STORAGE_KEYS.TURNO_DATA, true, null);
        if (turnoData && turnoData.id === turnoId && turnoData.status) {
            return turnoData;
        }
        if (turnoId) {
            removeTurnoLocal();
        }
        return null;
    } catch (error) {
        console.error("Erro ao obter turno local:", error);
        return null;
    }
}

function removeTurnoLocal() {
    try {
        const turnoAtual = getTurnoLocal();
        if (turnoAtual && turnoAtual.status === 'fechado') {
            setLocalItem(STORAGE_KEYS.LAST_CLOSED_TURNO, turnoAtual, true);
        }
        removeLocalItem(STORAGE_KEYS.CURRENT_TURNO_ID);
        removeLocalItem(STORAGE_KEYS.TURNO_DATA);
        removeLocalItem(STORAGE_KEYS.TURNO_STATUS);
    } catch (error) {
        console.error("Erro ao remover turno local:", error);
    }
}

function hasTurnoAbertoLocal() {
    try {
        const status = getLocalItem(STORAGE_KEYS.TURNO_STATUS, false);
        return status === 'aberto';
    } catch (error) {
        console.error("Erro ao verificar status do turno:", error);
        return false;
    }
}

function getLastClosedTurno() {
    return getLocalItem(STORAGE_KEYS.LAST_CLOSED_TURNO, true, null);
}

function salvarInfoTurnoAnterior(turnoAnteriorId, dadosTransferidos = {}) {
    try {
        if (!turnoAnteriorId) return false;
        setLocalItem(STORAGE_KEYS.PREVIOUS_TURNO_ID, turnoAnteriorId);
        setLocalItem(STORAGE_KEYS.TRANSFERRED_DATA, {
            turnoAnteriorId: turnoAnteriorId,
            dadosTransferidos: dadosTransferidos,
            dataTransferencia: new Date().toISOString()
        }, true);
        return true;
    } catch (error) {
        console.error("Erro ao salvar informações do turno anterior:", error);
        return false;
    }
}

function obterInfoTurnoAnterior() {
    try {
        return getLocalItem(STORAGE_KEYS.TRANSFERRED_DATA, true, null);
    } catch (error) {
        console.error("Erro ao obter informações do turno anterior:", error);
        return null;
    }
}

function isCampoTransferido(elemento) {
    if (!elemento) return false;
    return elemento.hasAttribute('data-transferido-do-turno');
}

function adicionarIndicadorCampoTransferido(elemento, origem) {
    if (!elemento) return;
    elemento.classList.add('bg-blue-50', 'border-blue-300');
    elemento.dataset.transferidoDoTurno = origem || 'turno-anterior';
    elemento.dataset.valorOriginal = elemento.value;
    const parentElement = elemento.parentElement;
    if (parentElement && !parentElement.querySelector('.indicador-transferido')) {
        const indicador = document.createElement('span');
        indicador.className = 'indicador-transferido text-xs text-blue-600 ml-1';
        indicador.innerHTML = '<i class="fas fa-exchange-alt"></i>';
        indicador.title = 'Valor transferido do turno anterior - Não editável';
        parentElement.appendChild(indicador);
    }
}

function validarCamposTransferidos(event) {
    const target = event.target;
    if (target && target.dataset && target.dataset.transferidoDoTurno) {
        const valorOriginal = target.dataset.valorOriginal;
        if (valorOriginal !== undefined && target.value !== valorOriginal) {
            target.value = valorOriginal;
            const errorMessage = `O campo "${target.name || target.id}" foi preenchido automaticamente com dados do turno anterior e não pode ser alterado.`;
            if (typeof showError === 'function') {
                showError(errorMessage);
            } else {
                console.error(`Tentativa de alterar campo transferido: ${target.name || target.id}`);
                alert(errorMessage);
            }
            return false;
        }
    }
    return true;
}

function getFormattedDate(date = new Date()) {
    try {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error("Erro ao formatar data:", error);
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
}

function getFormattedTime(date = new Date()) {
    try {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch (error) {
        console.error("Erro ao formatar hora:", error);
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
}

function getCurrentMonth(date = new Date()) {
    try {
        const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        return months[date.getMonth()];
    } catch (error) {
        console.error("Erro ao obter mês atual:", error);
        return "Mês desconhecido";
    }
}

function formatDateTimeForDisplay(isoString) {
    try {
        const date = new Date(isoString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (error) {
        console.error("Erro ao formatar data e hora:", error);
        return "Data inválida";
    }
}

function getPeriodOfDay(date = new Date()) {
    try {
        const hours = date.getHours();
        if (hours >= 6 && hours < 14) return 'Manhã';
        else if (hours >= 14 && hours < 22) return 'Tarde';
        else return 'Noite';
    } catch (error) {
        console.error("Erro ao determinar período do dia:", error);
        return "Período desconhecido";
    }
}

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

function formatCurrency(value, decimals = 2) {
    try {
        const valueNumber = parseFloat(value);
        if (isNaN(valueNumber)) return 'R$ 0,00';
        return `R$ ${valueNumber.toFixed(decimals).replace('.', ',')}`;
    } catch (error) {
        console.error("Erro ao formatar moeda:", error);
        return 'R$ 0,00';
    }
}

function extractNumberFromFormattedCurrency(formattedValue) {
    try {
        if (!formattedValue) return 0;
        const normalized = formattedValue.replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.');
        return parseFloat(normalized) || 0;
    } catch (error) {
        console.error("Erro ao extrair número de valor formatado:", error);
        return 0;
    }
}

function showError(message, containerId = 'errorMessages') {
    try {
        const container = document.getElementById(containerId);
        if (container) {
            container.textContent = message;
            container.classList.remove('hidden');
            container.classList.add('text-red-600', 'font-medium', 'p-3', 'bg-red-100', 'border', 'border-red-300', 'rounded-md');
            container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            console.error(message);
            alert(message);
        }
    } catch (error) {
        console.error("Erro ao exibir mensagem:", error);
        alert(message);
    }
}

function clearError(containerId = 'errorMessages') {
    try {
        const container = document.getElementById(containerId);
        if (container) {
            container.textContent = '';
            container.classList.add('hidden');
        }
    } catch (error) {
        console.error("Erro ao limpar mensagem:", error);
    }
}

function isOnline() {
    return navigator.onLine;
}

function setupConnectivityListeners(onlineCallback, offlineCallback) {
    window.addEventListener('online', onlineCallback);
    window.addEventListener('offline', offlineCallback);
    return {
        cleanup: () => {
            window.removeEventListener('online', onlineCallback);
            window.removeEventListener('offline', offlineCallback);
        }
    };
}

function criarResumoTransferencia(turnoOrigemId, turnoDestinoId, dadosTransferidos) {
    const container = document.createElement('div');
    container.className = 'turno-anterior-resumo';
    const titulo = document.createElement('h4');
    titulo.textContent = 'Transferência Entre Turnos';
    container.appendChild(titulo);
    const origemInfo = document.createElement('p');
    origemInfo.innerHTML = `<strong>Turno origem:</strong> ${turnoOrigemId || 'Desconhecido'}`;
    container.appendChild(origemInfo);
    const destinoInfo = document.createElement('p');
    destinoInfo.innerHTML = `<strong>Turno destino:</strong> ${turnoDestinoId || 'Atual'}`;
    container.appendChild(destinoInfo);
    if (dadosTransferidos) {
        const contagem = document.createElement('p');
        contagem.innerHTML = `<strong>Itens transferidos:</strong> <span class="transferencia-contagem">${dadosTransferidos.quantidadeItens || 0}</span>`;
        container.appendChild(contagem);
        if (dadosTransferidos.caixaTransferido) {
            const caixaInfo = document.createElement('p');
            caixaInfo.innerHTML = `<strong>Caixa transferido:</strong> <span class="transferencia-contagem">Sim</span>`;
            container.appendChild(caixaInfo);
        }
        if (dadosTransferidos.chegadasTotais) {
            const chegadasInfo = document.createElement('p');
            chegadasInfo.innerHTML = `<strong>Total de chegadas registradas:</strong> <span class="transferencia-contagem">${dadosTransferidos.chegadasTotais}</span>`;
            container.appendChild(chegadasInfo);
        }
    }
    return container;
}

function calcularTotalChegadas(turnoData) {
    let totalChegadas = 0;
    if (turnoData.itens) {
        Object.values(turnoData.itens).forEach(categoria => {
            Object.values(categoria).forEach(item => {
                if (item.chegadas && typeof item.chegadas === 'number') {
                    totalChegadas += item.chegadas;
                }
            });
        });
    }
    if (turnoData.gelo && turnoData.gelo.gelo_pacote && turnoData.gelo.gelo_pacote.chegadas) {
        totalChegadas += turnoData.gelo.gelo_pacote.chegadas;
    }
    return totalChegadas;
}

function validarCalculoVendas(itemData) {
    const entrada = itemData.entrada || 0;
    const chegadas = itemData.chegadas || 0;
    const sobra = itemData.sobra || 0;
    const descarte = itemData.descarte || 0;
    const consumo = itemData.consumo || 0;
    const vendido = itemData.vendido || 0;
    const vendidoCalculado = (entrada + chegadas) - sobra - descarte - consumo;
    const diferenca = vendido - vendidoCalculado;
    return {
        vendidoCalculado,
        vendidoRegistrado: vendido,
        diferenca,
        isValid: Math.abs(diferenca) < 0.01,
        detalhes: { entrada, chegadas, sobra, descarte, consumo, formula: `(${entrada} + ${chegadas}) - ${sobra} - ${descarte} - ${consumo} = ${vendidoCalculado}` }
    };
}

if (typeof window !== 'undefined') {
    window.STORAGE_KEYS = STORAGE_KEYS;
    window.listaSaboresPasteis = listaSaboresPasteis;
    window.listaCasquinhas = listaCasquinhas;
    window.listaCaldoCana = listaCaldoCana;
    window.listaRefrigerantes = listaRefrigerantes;
    window.setLocalItem = setLocalItem;
    window.getLocalItem = getLocalItem;
    window.removeLocalItem = removeLocalItem;
    window.clearStaleData = clearStaleData;
    window.setLocalUser = setLocalUser;
    window.getLocalUser = getLocalUser;
    window.clearLocalUser = clearLocalUser;
    window.setTurnoLocal = setTurnoLocal;
    window.getTurnoLocal = getTurnoLocal;
    window.removeTurnoLocal = removeTurnoLocal;
    window.hasTurnoAbertoLocal = hasTurnoAbertoLocal;
    window.getLastClosedTurno = getLastClosedTurno;
    window.salvarInfoTurnoAnterior = salvarInfoTurnoAnterior;
    window.obterInfoTurnoAnterior = obterInfoTurnoAnterior;
    window.isCampoTransferido = isCampoTransferido;
    window.adicionarIndicadorCampoTransferido = adicionarIndicadorCampoTransferido;
    window.validarCamposTransferidos = validarCamposTransferidos;
    window.criarResumoTransferencia = criarResumoTransferencia;
    window.getFormattedDate = getFormattedDate;
    window.getFormattedTime = getFormattedTime;
    window.getCurrentMonth = getCurrentMonth;
    window.formatDateTimeForDisplay = formatDateTimeForDisplay;
    window.getPeriodOfDay = getPeriodOfDay;
    window.createInputCell = createInputCell;
    window.createProductRow = createProductRow;
    window.createProductRowWithChegadas = createProductRowWithChegadas;
    window.formatCurrency = formatCurrency;
    window.extractNumberFromFormattedCurrency = extractNumberFromFormattedCurrency;
    window.showError = showError;
    window.clearError = clearError;
    window.isOnline = isOnline;
    window.setupConnectivityListeners = setupConnectivityListeners;
    window.calcularTotalChegadas = calcularTotalChegadas;
    window.validarCalculoVendas = validarCalculoVendas;
    console.log("shared.js v2.1 carregado com suporte a controle de chegadas de estoque.");
}

clearStaleData(7 * 86400000);