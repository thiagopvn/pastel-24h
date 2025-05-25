// migration-script.js
async function migrateProductPrices() {
    const oldToNewMapping = {
        // Pastéis
        "frango": "frango_com_queijo", // Se era genérico
        "especial_de_frango": null, // Remover se não usado mais
        // Casquinhas
        "casquinha_simples": "casquinha_crua",
        "casquinha_com_cobertura": "casquinha_frita",
        "casquinha_com_granulado": null, // Remover
        // Caldo de cana
        "caldo_de_cana_300ml": "copo_300ml",
        "caldo_de_cana_500ml": "copo_500ml",
        "caldo_de_cana_700ml": "garrafa_500ml",
        "caldo_de_cana_1litro": "garrafa_1_litro",
        // Refrigerantes
        "coca_cola_350ml": "coca_cola",
        "coca_cola_600ml": null,
        "coca_cola_2l": null,
        "guarana_350ml": "guarana",
        "guarana_600ml": null,
        "guarana_2l": null,
        "fanta_laranja_350ml": "fanta_laranja",
        "fanta_laranja_600ml": null,
        "fanta_laranja_2l": null,
        "fanta_uva_350ml": "fanta_uva",
        "sprite_350ml": "refri_limao",
        "agua_mineral_500ml": "agua"
    };

    // Executar migração...
}