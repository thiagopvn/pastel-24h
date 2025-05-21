/**
 * shared.js - Funções compartilhadas robustas para o sistema Pastelaria 24h
 * Implementa manipulação de localStorage, formatação, utilidades de UI e sincronização de dados
 */

// ===== CONSTANTES =====
// Chaves para armazenamento local - centralizadas para evitar inconsistências
const STORAGE_KEYS = {
    // Dados de usuário
    USER: 'pastelaria_user_data',
    AUTH_STATE: 'pastelaria_auth_state',
    USER_ROLE: 'userRole',
    USER_NAME: 'userName',
    USER_UID: 'userUID',
    
    // Dados de turno
    CURRENT_TURNO_ID: 'currentTurnoId',
    TURNO_DATA: 'turnoData',
    TURNO_STATUS: 'turnoStatus',
    LAST_CLOSED_TURNO: 'lastClosedTurno',
    
    // Configuração e estado do sistema
    APP_CONFIG: 'pastelaria_config',
    LAST_ROUTE: 'pastelaria_last_route',
    LAST_SYNC: 'pastelaria_last_sync',
    OFFLINE_DATA: 'pastelaria_offline_data',
    PERSISTED_TIMESTAMPS: 'pastelaria_persisted_timestamps'
};

// Templates de sabores e produtos
const listaSaboresPasteis = [
    "Carne",
    "Frango",
    "Queijo",
    "Pizza",
    "Bauru",
    "Calabresa",
    "Palmito",
    "Especial de Carne",
    "Especial de Frango",
    "Especial de Calabresa"
];

const listaCasquinhas = [
    "Casquinha Simples",
    "Casquinha com Cobertura",
    "Casquinha com Granulado"
];

const listaCaldoCana = [
    "Caldo de Cana 300ml",
    "Caldo de Cana 500ml",
    "Caldo de Cana 700ml",
    "Caldo de Cana 1litro"
];

const listaRefrigerantes = [
    "Coca-Cola 350ml",
    "Coca-Cola 600ml",
    "Coca-Cola 2L",
    "Guaraná 350ml",
    "Guaraná 600ml",
    "Guaraná 2L",
    "Fanta Laranja 350ml",
    "Fanta Laranja 600ml",
    "Fanta Laranja 2L",
    "Fanta Uva 350ml",
    "Sprite 350ml",
    "Água Mineral 500ml"
];

// ===== MANIPULAÇÃO DO LOCALSTORAGE =====

/**
 * Salva um item no localStorage com tratamento de erro
 * @param {string} key - Chave para armazenamento
 * @param {any} value - Valor a ser armazenado (será convertido para JSON se não for string)
 * @param {boolean} includeTimestamp - Se deve incluir timestamp de quando foi salvo
 * @returns {boolean} - Sucesso da operação
 */
function setLocalItem(key, value, includeTimestamp = false) {
    try {
        let dataToStore = value;
        
        // Se não for string, converte para JSON
        if (typeof value !== 'string') {
            // Se incluir timestamp, adiciona campo lastUpdated
            if (includeTimestamp && typeof value === 'object' && value !== null) {
                dataToStore = {
                    ...value,
                    lastUpdated: new Date().toISOString()
                };
            }
            dataToStore = JSON.stringify(dataToStore);
        }
        
        localStorage.setItem(key, dataToStore);
        
        // Se estiver incluindo timestamp, registra a atualização
        if (includeTimestamp) {
            recordTimestamp(key);
        }
        
        return true;
    } catch (error) {
        console.error(`Erro ao salvar item '${key}' no localStorage:`, error);
        return false;
    }
}

/**
 * Recupera um item do localStorage com tratamento de erro
 * @param {string} key - Chave do item
 * @param {boolean} parseJson - Se deve converter de JSON para objeto
 * @param {any} defaultValue - Valor padrão caso não exista ou haja erro
 * @returns {any} - Item recuperado ou valor padrão
 */
function getLocalItem(key, parseJson = true, defaultValue = null) {
    try {
        const value = localStorage.getItem(key);
        
        if (value === null) return defaultValue;
        
        if (parseJson) {
            try {
                return JSON.parse(value);
            } catch (parseError) {
                // Se não conseguir parsear, retorna o valor como string
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

/**
 * Remove um item do localStorage com tratamento de erro
 * @param {string} key - Chave do item a ser removido
 * @returns {boolean} - Sucesso da operação
 */
function removeLocalItem(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        console.error(`Erro ao remover item '${key}' do localStorage:`, error);
        return false;
    }
}

/**
 * Registra timestamp de atualização
 * @param {string} key - Chave que foi atualizada 
 */
function recordTimestamp(key) {
    try {
        const timestamps = getLocalItem(STORAGE_KEYS.PERSISTED_TIMESTAMPS, true, {});
        timestamps[key] = new Date().toISOString();
        setLocalItem(STORAGE_KEYS.PERSISTED_TIMESTAMPS, timestamps);
    } catch (error) {
        console.error("Erro ao registrar timestamp:", error);
    }
}

/**
 * Verifica quando foi a última atualização de uma chave
 * @param {string} key - Chave a verificar
 * @returns {Date|null} - Data da última atualização ou null
 */
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

/**
 * Limpa dados desatualizados do localStorage (mais antigos que maxAge)
 * @param {number} maxAge - Idade máxima dos dados em milissegundos
 */
function clearStaleData(maxAge = 86400000) { // Padrão: 1 dia
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

// ===== FUNÇÕES ESPECÍFICAS DE USUÁRIO =====

/**
 * Salva dados do usuário no localStorage com tratamento de erro
 * @param {Object} user - Objeto de usuário (Firebase ou personalizado)
 * @returns {boolean} - Sucesso da operação
 */
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
        
        // Salva dados completos do usuário
        setLocalItem(STORAGE_KEYS.USER, userData, true);
        
        // Atualiza o estado de autenticação
        setLocalItem(STORAGE_KEYS.AUTH_STATE, 'true');
        
        // Salva também campos individuais para acesso rápido
        setLocalItem(STORAGE_KEYS.USER_ROLE, userData.role);
        setLocalItem(STORAGE_KEYS.USER_NAME, userData.displayName || userData.email);
        setLocalItem(STORAGE_KEYS.USER_UID, userData.uid);
        
        return true;
    } catch (error) {
        console.error("Erro ao salvar usuário local:", error);
        return false;
    }
}

/**
 * Recupera dados do usuário do localStorage com validação
 * @returns {Object|null} - Objeto usuário ou null se não existir
 */
function getLocalUser() {
    try {
        const userData = getLocalItem(STORAGE_KEYS.USER, true, null);
        
        // Validação básica dos dados
        if (userData && userData.uid && (userData.email || userData.displayName)) {
            return userData;
        }
        
        return null;
    } catch (error) {
        console.error("Erro ao obter usuário local:", error);
        return null;
    }
}

/**
 * Limpa os dados do usuário do localStorage
 */
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

// ===== FUNÇÕES ESPECÍFICAS DE TURNO =====

/**
 * Salva os dados do turno atual no localStorage
 * @param {Object} turnoData - Dados do turno
 * @returns {boolean} - Sucesso da operação
 */
function setTurnoLocal(turnoData) {
    if (!turnoData || !turnoData.id) return false;
    
    try {
        // Salva o ID para acesso rápido
        setLocalItem(STORAGE_KEYS.CURRENT_TURNO_ID, turnoData.id);
        
        // Salva os dados completos
        setLocalItem(STORAGE_KEYS.TURNO_DATA, turnoData, true);
        
        // Salva o status para verificação rápida
        setLocalItem(STORAGE_KEYS.TURNO_STATUS, turnoData.status || 'desconhecido');
        
        return true;
    } catch (error) {
        console.error("Erro ao salvar turno local:", error);
        return false;
    }
}

/**
 * Recupera dados do turno do localStorage com validação
 * @returns {Object|null} - Objeto do turno ou null
 */
function getTurnoLocal() {
    try {
        // Verifica primeiro o ID por eficiência
        const turnoId = getLocalItem(STORAGE_KEYS.CURRENT_TURNO_ID, false);
        if (!turnoId) return null;
        
        // Recupera os dados completos
        const turnoData = getLocalItem(STORAGE_KEYS.TURNO_DATA, true, null);
        
        // Validação básica dos dados
        if (turnoData && turnoData.id === turnoId && turnoData.status) {
            return turnoData;
        }
        
        // Se tiver ID mas dados inconsistentes, limpa tudo
        if (turnoId) {
            removeTurnoLocal();
        }
        
        return null;
    } catch (error) {
        console.error("Erro ao obter turno local:", error);
        return null;
    }
}

/**
 * Remove os dados do turno atual do localStorage
 */
function removeTurnoLocal() {
    try {
        const turnoAtual = getTurnoLocal();
        
        // Se o turno estiver fechado, salva como último fechado antes de remover
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

/**
 * Verifica se existe um turno aberto no localStorage
 * @returns {boolean} - Verdadeiro se existe turno aberto
 */
function hasTurnoAbertoLocal() {
    try {
        const status = getLocalItem(STORAGE_KEYS.TURNO_STATUS, false);
        return status === 'aberto';
    } catch (error) {
        console.error("Erro ao verificar status do turno:", error);
        return false;
    }
}

/**
 * Recupera os dados do último turno fechado
 * @returns {Object|null} - Dados do último turno ou null
 */
function getLastClosedTurno() {
    return getLocalItem(STORAGE_KEYS.LAST_CLOSED_TURNO, true, null);
}

// ===== FUNÇÕES DE FORMATAÇÃO DE DATA E HORA =====

/**
 * Formata data atual ou fornecida no formato YYYY-MM-DD
 * @param {Date} [date] - Objeto Date (opcional, usa data atual se não fornecido)
 * @returns {string} - Data formatada
 */
function getFormattedDate(date = new Date()) {
    try {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error("Erro ao formatar data:", error);
        // Retorna data atual como fallback
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
}

/**
 * Formata hora atual ou fornecida no formato HH:MM
 * @param {Date} [date] - Objeto Date (opcional, usa hora atual se não fornecido)
 * @returns {string} - Hora formatada
 */
function getFormattedTime(date = new Date()) {
    try {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch (error) {
        console.error("Erro ao formatar hora:", error);
        // Retorna hora atual como fallback
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
}

/**
 * Retorna o nome do mês atual em português
 * @param {Date} [date] - Objeto Date (opcional, usa data atual se não fornecido)
 * @returns {string} - Nome do mês
 */
function getCurrentMonth(date = new Date()) {
    try {
        const months = [
            "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
            "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ];
        return months[date.getMonth()];
    } catch (error) {
        console.error("Erro ao obter mês atual:", error);
        return "Mês desconhecido";
    }
}

/**
 * Formata um timestamp ISO em data e hora legíveis
 * @param {string} isoString - String de data no formato ISO
 * @returns {string} - Data e hora formatadas para exibição
 */
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

/**
 * Retorna a época do dia com base na hora
 * @param {Date} [date] - Objeto Date (opcional, usa data atual se não fornecido)
 * @returns {string} - 'Manhã', 'Tarde' ou 'Noite'
 */
function getPeriodOfDay(date = new Date()) {
    try {
        const hours = date.getHours();
        
        if (hours >= 6 && hours < 14) {
            return 'Manhã';
        } else if (hours >= 14 && hours < 22) {
            return 'Tarde';
        } else {
            return 'Noite';
        }
    } catch (error) {
        console.error("Erro ao determinar período do dia:", error);
        return "Período desconhecido";
    }
}

// ===== FUNÇÕES DE INTERFACE DO USUÁRIO =====

/**
 * Cria uma célula de input para tabelas
 * @param {string} type - Tipo do input (number, text, etc)
 * @param {string} id - ID do elemento
 * @param {string} [placeholder] - Placeholder do input
 * @param {string} [value] - Valor inicial
 * @param {boolean} [readOnly] - Se o input é somente leitura
 * @param {string} [className] - Classes adicionais do input
 * @returns {HTMLTableCellElement} - Célula TD com input configurado
 */
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

/**
 * Cria uma linha para um produto na tabela
 * @param {string} itemName - Nome do item
 * @param {string} itemKey - Chave do item (slug)
 * @param {string} categoryKey - Categoria do item
 * @param {Object} prices - Objeto de preços
 * @param {boolean} isReadOnly - Se os inputs são somente leitura
 * @returns {HTMLTableRowElement} - Linha TR configurada
 */
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

/**
 * Formata um valor para exibição como moeda (R$)
 * @param {number} value - Valor a ser formatado
 * @param {number} [decimals] - Número de casas decimais
 * @returns {string} - Valor formatado (ex: "R$ 123,45")
 */
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

/**
 * Extrai valor numérico de uma string formatada como moeda
 * @param {string} formattedValue - Valor formatado (ex: "R$ 123,45")
 * @returns {number} - Valor numérico
 */
function extractNumberFromFormattedCurrency(formattedValue) {
    try {
        if (!formattedValue) return 0;
        
        // Remove tudo exceto números, vírgulas e pontos
        const normalized = formattedValue.replace(/[^\d,.-]/g, '')
            .replace('.', '') // Remove ponto de milhar
            .replace(',', '.'); // Converte vírgula decimal para ponto
            
        return parseFloat(normalized) || 0;
    } catch (error) {
        console.error("Erro ao extrair número de valor formatado:", error);
        return 0;
    }
}

// ===== FUNÇÕES DE STATUS DE CONEXÃO =====

/**
 * Verifica se o dispositivo está online
 * @returns {boolean} - Status de conexão
 */
function isOnline() {
    return navigator.onLine;
}

/**
 * Registra listener para quando a conectividade mudar
 * @param {Function} onlineCallback - Função a chamar quando ficar online
 * @param {Function} offlineCallback - Função a chamar quando ficar offline
 * @returns {Object} - Funções para remover os listeners
 */
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

// ===== EXPORTAÇÃO DAS FUNÇÕES =====
// Verifica se estamos em um ambiente que suporta `window` (browser)
if (typeof window !== 'undefined') {
    // Define variáveis e funções como globais
    window.STORAGE_KEYS = STORAGE_KEYS;
    
    // Listas
    window.listaSaboresPasteis = listaSaboresPasteis;
    window.listaCasquinhas = listaCasquinhas;
    window.listaCaldoCana = listaCaldoCana;
    window.listaRefrigerantes = listaRefrigerantes;
    
    // Funções de localStorage
    window.setLocalItem = setLocalItem;
    window.getLocalItem = getLocalItem;
    window.removeLocalItem = removeLocalItem;
    window.clearStaleData = clearStaleData;
    
    // Funções de usuário
    window.setLocalUser = setLocalUser;
    window.getLocalUser = getLocalUser;
    window.clearLocalUser = clearLocalUser;
    
    // Funções de turno
    window.setTurnoLocal = setTurnoLocal;
    window.getTurnoLocal = getTurnoLocal;
    window.removeTurnoLocal = removeTurnoLocal;
    window.hasTurnoAbertoLocal = hasTurnoAbertoLocal;
    window.getLastClosedTurno = getLastClosedTurno;
    
    // Funções de formatação de data e hora
    window.getFormattedDate = getFormattedDate;
    window.getFormattedTime = getFormattedTime;
    window.getCurrentMonth = getCurrentMonth;
    window.formatDateTimeForDisplay = formatDateTimeForDisplay;
    window.getPeriodOfDay = getPeriodOfDay;
    
    // Funções de UI
    window.createInputCell = createInputCell;
    window.createProductRow = createProductRow;
    window.formatCurrency = formatCurrency;
    window.extractNumberFromFormattedCurrency = extractNumberFromFormattedCurrency;
    
    // Funções de conectividade
    window.isOnline = isOnline;
    window.setupConnectivityListeners = setupConnectivityListeners;
    
    // Log de carregamento
    console.log("shared.js carregado com funções aprimoradas de manipulação do localStorage e utilitários diversos.");
}

// Limpa dados potencialmente obsoletos a cada carregamento da página
clearStaleData(7 * 86400000); // 7 dias