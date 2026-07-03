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
    }
};