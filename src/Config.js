/**
 * Configuración global del entorno del pipeline.
 */
const Config = {
    get FOLDER_ID() {
        return PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
    },
    get SPREADSHEET_ID() {
        return PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    },
    get CSV_SHEET_NAME() {
        return PropertiesService.getScriptProperties().getProperty('CSV_SHEET_NAME') || 'Historial_Banco';
    },
    get OMITIR_SHEET_NAME() {
        return PropertiesService.getScriptProperties().getProperty('OMITIR_SHEET_NAME') || 'omitir';
    },

    /**
     * Inicializa las hojas destino y devuelve la pestaña del histórico banco.
     */
    obtenerHojaDestino() {
        if (!this.SPREADSHEET_ID) throw new Error("SPREADSHEET_ID no configurado.");
        const ts = SpreadsheetApp.openById(this.SPREADSHEET_ID);
        const hoja = ts.getSheetByName(this.CSV_SHEET_NAME) || ts.insertSheet(this.CSV_SHEET_NAME);

        if (hoja.getLastRow() === 0) {
            hoja.appendRow(["Fecha", "Descripción", "Importe", "UUID_Control", "Fecha Registro"]);
        }
        return hoja;
    },

    /**
     * Carga el set de hashes existentes en la hoja para evitar duplicados.
     */
    cargarRegistroClaves(hoja) {
        const filas = hoja.getDataRange().getValues();
        const registro = new Set();
        for (let i = 1; i < filas.length; i++) {
            const uuid = filas[i][3];
            if (uuid) registro.add(uuid);
        }
        return registro;
    },

    /**
     * Lee la pestaña 'config' y genera un mapa estructurado con las posiciones de cada extractor.
     * @return {Object} Mapa de configuraciones indexado por "Banco"
     */
    obtenerMapaConfiguracion() {
        const spreadsheet = SpreadsheetApp.openById(Config.SPREADSHEET_ID);
        const hojaConfig = spreadsheet.getSheetByName("config");

        if (!hojaConfig) {
            throw new Error("No se encontró la pestaña 'config'. Asegúrate de que el nombre sea exacto.");
        }

        const valoresColumnaA = hojaConfig.getRange("A1:A100").getValues();
        let filaFinBancos = 0;

        for (let i = 0; i < valoresColumnaA.length; i++) {
            if (String(valoresColumnaA[i][0]).trim() === "Tiendas") {
                filaFinBancos = i + 1; // Fila exacta en base 1
                break;
            }
        }

        if (filaFinBancos === 0) {
            filaFinBancos = hojaConfig.getLastRow();
        }

        // Leemos desde la fila 2 hasta justo antes de "Tiendas"
        const numFilas = filaFinBancos - 2;
        if (numFilas <= 0) return {};

        const datosBancos = hojaConfig.getRange(2, 1, numFilas, 8).getValues();
        const mapaConfig = {};

        for (let i = 0; i < datosBancos.length; i++) {
            const fila = datosBancos[i];

            // Saltamos si la fila está vacía o si coincide con la cabecera
            if (!fila[0] || String(fila[0]).trim() === "Bancos") continue;

            const banco          = String(fila[0]).trim(); // Limpia espacios extra (ej: "Banca March Tarjetas")
            const tipoFichero    = String(fila[1]).trim().toLowerCase(); // "xlsx" o "csv"
            const titulo         = parseInt(fila[2], 10);
            const encabezado     = parseInt(fila[3], 10);
            const posFecha       = parseInt(fila[4], 10);
            const posDescripcion = parseInt(fila[5], 10);
            const posImporte     = parseInt(fila[6], 10);
            const longitud       = parseInt(fila[7], 10);

            mapaConfig[banco] = {
                banco: banco,
                tipoFichero: tipoFichero,
                titulo: isNaN(titulo) ? 0 : titulo,
                encabezado: isNaN(encabezado) ? 0 : encabezado,
                posFecha: isNaN(posFecha) ? 0 : posFecha,
                posDescripcion: isNaN(posDescripcion) ? 0 : posDescripcion,
                posImporte: isNaN(posImporte) ? 0 : posImporte,
                longitud: isNaN(longitud) ? 0 : longitud
            };
        }

        // 🔍 LOG DE SALIDA COMPLETO EN CONSOLA
        Logger.log("==========================================");
        Logger.log(`📋 [obtenerMapaConfiguracion] Mapa generado con ${Object.keys(mapaConfig).length} elementos:`);
        Logger.log(JSON.stringify(mapaConfig, null, 2));
        Logger.log("==========================================");

        return mapaConfig;
    },
    /**
     * Busca y devuelve el valor configurado para el mes en la pestaña 'config'.
     * @return {string} El nombre del mes (ej: "Septiembre") o cadena vacía si no se encuentra.
     */
    obtenerMesConfiguracion() {
        const spreadsheet = SpreadsheetApp.openById(Config.SPREADSHEET_ID);
        const hojaConfig = spreadsheet.getSheetByName("config");

        if (!hojaConfig) {
            throw new Error("No se encontró la pestaña 'config'.");
        }

        // Leemos un rango suficiente de las primeras columnas (A y B)
        const datosConfig = hojaConfig.getRange("A1:B100").getValues();

        for (let i = 0; i < datosConfig.length; i++) {
            const clave = String(datosConfig[i][0]).trim().toLowerCase();

            // Si encontramos la etiqueta "mes" en la columna A
            if (clave === "mes") {
                const valorMes = String(datosConfig[i][1]).trim();
                Logger.log(`[Config] Mes detectado: "${valorMes}"`);
                return valorMes;
            }
        }

        Logger.log("[Config] No se encontró la clave 'Mes' en la pestaña config.");
        return "";
    }



};