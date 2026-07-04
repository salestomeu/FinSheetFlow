/**
 * Función para buscar, convertir y procesar archivos de Excel (.xlsx) de Banca March.
 */
/**
 * Función unificada para procesar archivos de Excel (.xlsx) de Banca March
 * Soporta tanto extractos de Cuentas como de Tarjetas de forma dinámica.
 */
const Folder = {
     procesarCarpeta() {
        const scriptProperties = PropertiesService.getScriptProperties();
        const FOLDER_ID = scriptProperties.getProperty('DRIVE_FOLDER_ID');
        const SPREADSHEET_ID = scriptProperties.getProperty('SPREADSHEET_ID');
        const CSV_SHEET_NAME = scriptProperties.getProperty('CSV_SHEET_NAME') || 'Historial_Banco';

        if (!FOLDER_ID || !SPREADSHEET_ID) {
            throw new Error("Error: FOLDER_ID o SPREADSHEET_ID no configurados.");
        }

        const folder = DriveApp.getFolderById(FOLDER_ID);
        const files = folder.getFiles();

        if (!files.hasNext()) return;

        const targetSpreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
        const targetSheet = targetSpreadsheet.getSheetByName(CSV_SHEET_NAME) || targetSpreadsheet.insertSheet(CSV_SHEET_NAME);

        if (targetSheet.getLastRow() === 0) {
            targetSheet.appendRow(["Fecha", "Descripción", "Importe", "UUID_Control", "Fecha Registro"]);
        }

        // Cargar hashes para la de-duplicación nativa
        const filasExistentes = targetSheet.getDataRange().getValues();
        const registroClaves = new Map();
        for (let i = 1; i < filasExistentes.length; i++) {
            const uuidExistente = filasExistentes[i][3];
            if (uuidExistente) registroClaves.set(uuidExistente, i + 1);
        }

        const mapaCategorias = Categorizador.cargarDiccionario();
        const conceptosAOmitir = obtenerConceptosAOmitir(targetSpreadsheet);

        while (files.hasNext()) {
            const file = files.next();
            const mimeType = file.getMimeType();
            const name = file.getName().toLowerCase();
            if (name.endsWith('.xlsx') || name.endsWith('.xls') || mimeType === "application/vnd.google-apps.spreadsheet") {
                ExtractorXLSX.procesar(file, targetSheet, registroClaves, conceptosAOmitir, mapaCategorias);
            } else if (mimeType === 'text/csv' || file.getName().toLowerCase().endsWith('.csv')) {
                ExtractorCsv.procesar(file, targetSheet, registroClaves, conceptosAOmitir, mapaCategorias);
            } else if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
                try {
                    // Llamamos a la función que ya tenemos construida pasándole el blob
                    Ticket.procesarTicketEInsertar(file.getBlob());

                    folder.removeFile(file);

                    Logger.log(`Ticket ${file.getName()} procesado correctamente.`);
                } catch (e) {
                    Logger.log(`Error procesando ${file.getName()}: ${e.toString()}`);
                }
            }
        }
    }
};