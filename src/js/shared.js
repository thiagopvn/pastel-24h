// js/shared.js

// Funções Utilitárias Globais

/**
 * Retorna a data atual formatada como YYYY-MM-DD.
 * @param {Date} date - Objeto Date opcional para formatar. Padrão é a data atual.
 * @returns {string} Data formatada.
 */
function getFormattedDate(date = new Date()) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Retorna a hora atual formatada como HH:MM.
 * @param {Date} date - Objeto Date opcional para formatar. Padrão é a hora atual.
 * @returns {string} Hora formatada.
 */
function getFormattedTime(date = new Date()) {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Retorna o nome do mês atual por extenso em português.
 * @returns {string} Nome do mês.
 */
function getCurrentMonth() {
    const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return months[new Date().getMonth()];
}

// --- LISTAS DE PRODUTOS ---
// Estas listas são usadas para popular as tabelas nas telas do funcionário e do administrador.

const listaSaboresPasteis = [
    'Carne com queijo', 'Carne', 'Frango com catupiry', 'Frango com queijo', 
    'Carioca', 'Pizza', 'Palmito', 'Queijo', '4 Queijo', 'Bauru', 
    'Calabresa', 'Portuguesa', 'Carne seca', 
    // Pastéis Especiais
    'Especial Carne Seca', 'Especial Carne', 'Especial Calabresa'
];

const listaCasquinhas = [
    'Casquinha crua', 'Casquinha frita'
];

const listaCaldoCana = [
    'Fardo de cana', 'Copo 300ml', 'Copo 400ml', 
    'Copo 500ml', 'Garrafa 500ml', 'Garrafa 1 litro'
]; // Removido espaço extra em 'Copo 300 ml' para consistência

const listaRefrigerantes = [
    'Coca-cola', 'Fanta Laranja', 'Fanta Uva', 'Guaraná', 
    'Refri Limão', 'Refri. Zero', 'Itubaina', 'Agua', 
    'Agua c/ Gás', 'Cerveja longneck', 'Cerveja lata'
];

// Helper para criar células de input nas tabelas (usado em funcionario-controller.js)
/**
 * Cria uma célula de tabela (<td>) contendo um input.
 * @param {string} type - Tipo do input (e.g., 'number', 'text').
 * @param {string} id - ID e name para o input.
 * @param {string} placeholder - Placeholder para o input.
 * @param {string|number} value - Valor inicial do input.
 * @param {boolean} readOnly - Se o input deve ser somente leitura.
 * @param {string} className - Classes CSS adicionais para o input.
 * @returns {HTMLTableCellElement} A célula <td> criada.
 */
function createInputCell(type, id, placeholder = '', value = '', readOnly = false, className = "w-full p-1 border border-gray-300 rounded text-sm shadow-sm") {
    const td = document.createElement('td');
    td.className = 'px-1 py-1 whitespace-nowrap'; // Adicionado whitespace-nowrap para melhor alinhamento
    const input = document.createElement('input');
    input.type = type;
    input.id = id;
    input.name = id;
    input.className = `${className} ${readOnly ? 'bg-gray-100 cursor-not-allowed' : 'bg-white focus:ring-orange-500 focus:border-orange-500'}`;
    input.placeholder = placeholder;
    input.value = value;
    if (readOnly) input.readOnly = true;
    if (type === 'number') {
        input.min = "0"; // Prevenir valores negativos para contagens
        input.step = "1"; // Default step para quantidades
        if (id.includes('preco') || id.includes('valor') || id.includes('caixa')) {
            input.step = "0.01"; // Para valores monetários
        }
    }
    td.appendChild(input);
    return td;
}

/**
 * Cria uma linha de produto (<tr>) para as tabelas de controle de estoque.
 * @param {string} itemName - Nome do produto para exibição.
 * @param {string} itemKey - Chave única do produto (usada para IDs de input).
 * @param {string} categoryKey - Chave da categoria do produto (usada para buscar preços).
 * @param {object} prices - Objeto contendo os preços dos produtos.
 * @param {boolean} isReadOnlyInitially - Se os campos devem ser somente leitura inicialmente.
 * @returns {HTMLTableRowElement} A linha <tr> criada.
 */
function createProductRow(itemName, itemKey, categoryKey, prices, isReadOnlyInitially = true) {
    const tr = document.createElement('tr');
    tr.className = 'border-b item-row hover:bg-orange-50 transition-colors duration-150';
    tr.dataset.itemKey = itemKey;
    tr.dataset.categoryKey = categoryKey; // Útil para identificar a categoria no JS

    const tdName = document.createElement('td');
    tdName.className = 'px-3 py-2 font-medium text-gray-800';
    tdName.textContent = itemName;
    tr.appendChild(tdName);

    // Colunas: Entrada, Sobra, Descarte, Consumo Func., Vendido
    tr.appendChild(createInputCell('number', `${itemKey}_entrada`, '0', '', isReadOnlyInitially));
    tr.appendChild(createInputCell('number', `${itemKey}_sobra`, '0', '', isReadOnlyInitially));
    tr.appendChild(createInputCell('number', `${itemKey}_descarte`, '0', '', isReadOnlyInitially));
    tr.appendChild(createInputCell('number', `${itemKey}_consumo`, '0', '', isReadOnlyInitially)); // Consumo de funcionário
    
    // Coluna Vendido (calculado, readonly)
    const tdVendido = document.createElement('td');
    tdVendido.className = 'px-1 py-1';
    const inputVendido = document.createElement('input');
    inputVendido.type = 'number';
    inputVendido.id = `${itemKey}_vendido`;
    inputVendido.name = `${itemKey}_vendido`;
    inputVendido.className = 'w-full p-1 border border-gray-300 rounded text-sm bg-gray-100 cursor-not-allowed shadow-sm';
    inputVendido.readOnly = true;
    inputVendido.value = '0';
    // Armazena o preço no dataset para fácil acesso nos cálculos
    inputVendido.dataset.price = prices[categoryKey]?.[itemKey]?.preco || 0;
    tdVendido.appendChild(inputVendido);
    tr.appendChild(tdVendido);

    // Coluna Preço Unitário (display)
    const tdPreco = document.createElement('td');
    tdPreco.className = 'px-3 py-2 text-sm text-gray-600 text-center'; // Adicionado text-center
    const precoUnit = prices[categoryKey]?.[itemKey]?.preco || 0;
    tdPreco.textContent = `R$ ${parseFloat(precoUnit).toFixed(2)}`;
    tdPreco.id = `${itemKey}_preco_display`;
    tr.appendChild(tdPreco);
    
    // Coluna Total Item (display)
    const tdTotalItem = document.createElement('td');
    tdTotalItem.className = 'px-3 py-2 text-sm text-gray-700 font-semibold text-right'; // Adicionado text-right
    tdTotalItem.id = `${itemKey}_total_item`;
    tdTotalItem.textContent = `R$ 0.00`;
    tr.appendChild(tdTotalItem);

    return tr;
}

/**
 * Helper para normalizar chaves de itens (usado para gerar IDs e chaves no Firebase).
 * Converte para minúsculas, substitui espaços por underscores, remove acentos e caracteres especiais.
 * @param {string} text - O texto a ser normalizado.
 * @returns {string} O texto normalizado como chave.
 */
function normalizeItemKey(text) {
    if (typeof text !== 'string') return '';
    return text
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/\s+/g, '_') // Substitui espaços por underscore
        .replace(/[^\w-]+/g, ''); // Remove caracteres não alfanuméricos (exceto underscore e hífen)
}


// Exemplo de uso para garantir que as funções estão disponíveis globalmente
// (ou podem ser exportadas se usar módulos no futuro)
if (typeof window !== 'undefined') {
    window.getFormattedDate = getFormattedDate;
    window.getFormattedTime = getFormattedTime;
    window.getCurrentMonth = getCurrentMonth;
    window.createInputCell = createInputCell;
    window.createProductRow = createProductRow;
    window.normalizeItemKey = normalizeItemKey;

    // Tornar as listas de produtos globais também para fácil acesso nos controllers
    window.listaSaboresPasteis = listaSaboresPasteis;
    window.listaCasquinhas = listaCasquinhas;
    window.listaCaldoCana = listaCaldoCana;
    window.listaRefrigerantes = listaRefrigerantes;
}

console.log("shared.js carregado e funções/listas configuradas.");