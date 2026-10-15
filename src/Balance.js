function ejecutarPipelineBancario(month) {
    // ... (Toda tu lógica inicial de procesar archivos CSV y XLSX en la carpeta drop)

    // =================================================================
    // 📈 FASE DE LECTURA Y AGREGACIÓN (Espacio Global / Main)
    // =================================================================
    Logger.log("Iniciando fase de lectura analítica de históricos...");

    const tsHistorico = SpreadsheetApp.openById(Config.SPREADSHEET_ID);
    const hojaHistorialBanco = tsHistorico.getSheetByName(Config.CSV_SHEET_NAME);
    const hojaHistorialTickets = tsHistorico.getSheetByName('Historial_Tickets');

    const mesesEspanol = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    const mapaMesesCategorias = new Map();

    // A. Procesar Datos de Tickets de la IA (Solo Lectura)
    /*if (hojaHistorialTickets) {
        const tickets = hojaHistorialTickets.getDataRange().getValues();
        for (let i = 1; i < tickets.length; i++) {
            const fechaCelda = tickets[i][0];
            const importe = parseFloat(tickets[i][4]);
            const categoria = String(tickets[i][5] || "Otros").trim();

            if (fechaCelda instanceof Date && !isNaN(importe)) {
                const nombreMesKey = mesesEspanol[fechaCelda.getMonth()];
                if (!mapaMesesCategorias.has(nombreMesKey)) mapaMesesCategorias.set(nombreMesKey, new Map());

                const mapaDelMes = mapaMesesCategorias.get(nombreMesKey);
                mapaDelMes.set(categoria, (mapaDelMes.get(categoria) || 0) - Math.abs(importe));
            }
        }
    }*/

    // B. Procesar Datos de Banco con Filtro Anti-Duplicados (Solo Lectura)
    if (hojaHistorialBanco) {
        const transaccionesBanco = hojaHistorialBanco.getDataRange().getValues();
        const setTotalesTicketsMapeados = new Set();

        if (hojaHistorialTickets) {
            const tickets = hojaHistorialTickets.getDataRange().getValues();
            for (let i = 1; i < tickets.length; i++) {
                const fechaCelda = tickets[i][0];
                const importeFila = parseFloat(tickets[i][4]);
                if (fechaCelda instanceof Date && !isNaN(importeFila)) {
                    setTotalesTicketsMapeados.add(`${mesesEspanol[fechaCelda.getMonth()]}_${Math.abs(importeFila).toFixed(2)}`);
                }
            }
        }

        for (let i = 1; i < transaccionesBanco.length; i++) {
            const fechaCelda = transaccionesBanco[i][0];
            const importe = parseFloat(transaccionesBanco[i][2]);
            const descripcion = String(transaccionesBanco[i][1]).toLowerCase();
            const categoria = String(transaccionesBanco[i][5] || "Otros").trim();

            if (fechaCelda instanceof Date && !isNaN(importe)) {
                const nombreMesKey = mesesEspanol[fechaCelda.getMonth()];
                const claveDuplicado = `${nombreMesKey}_${Math.abs(importe).toFixed(2)}`;
                const esSupermercado = descripcion.includes("mercadona") || descripcion.includes("hiper centro") || descripcion.includes("lidl") || descripcion.includes("aldi");

                //if (esSupermercado && setTotalesTicketsMapeados.has(claveDuplicado)) continue;

                if (!mapaMesesCategorias.has(nombreMesKey)) mapaMesesCategorias.set(nombreMesKey, new Map());
                const mapaDelMes = mapaMesesCategorias.get(nombreMesKey);
                mapaDelMes.set(categoria, (mapaDelMes.get(categoria) || 0) + importe);
            }
        }
    }

    // =================================================================
    // 🧪 MODO PRUEBA / INYECCIÓN POR MES
    // =================================================================
    const mapaPruebaUnMes = new Map();

    if (mapaMesesCategorias.has(month)) {
        Logger.log(`🧪 MODO PRUEBA: Set de datos aislado de forma exclusiva para la pestaña ${month}.`);
        mapaPruebaUnMes.set(month, mapaMesesCategorias.get(month));

        // Inyectamos el mapa filtrado para ese mes específico
        ConsolidadorPlantilla.inyectarTotales(mapaPruebaUnMes);
    } else {
        Logger.log(`⚠️ Aviso Prueba: El mapa analítico no ha recopilado ninguna transacción fechada en ${month}.`);
    }

    // Para procesar todos los meses completos (sin aislamiento), descomentarías la siguiente línea:
    // ConsolidadorPlantilla.inyectarTotales(mapaMesesCategorias);
}