function onOpen() {
    const ui = SpreadsheetApp.getUi();

    ui.createMenu('💼 FinSheetFlow')
        .addItem('📸 Cargar Tickets (IA)', 'menuCargarTickets')
        .addSeparator() // Línea divisoria muy elegante
        .addItem('🏦 Cargar American Express (CSV)', 'menuCargarAmex')
        .addItem('🏦 Cargar Banca March (XLSX)', 'menuCargarBancaMarch')
        .addToUi();
}

/**
 * Funciones puente que se ejecutan al pulsar cada botón del menú
 */
function menuCargarTickets() {
    // Aquí llamas a la función que dispara tu flujo Drop Folder o procesa la carpeta
    Folder.procesarCarpeta();
}

function menuCargarAmex() {
    SpreadsheetApp.getUi().alert('🏦 Importación Amex', 'Por favor, asegúrate de haber subido el extracto .csv antes de continuar.', SpreadsheetApp.getUi().ButtonSet.OK);

    Folder.procesarCarpeta();
}

function menuCargarBancaMarch() {
    SpreadsheetApp.getUi().alert('🏦 Importación Banca March', 'Por favor, asegúrate de haber subido el extracto .xlsx antes de continuar.', SpreadsheetApp.getUi().ButtonSet.OK);

    Folder.procesarCarpeta();
}