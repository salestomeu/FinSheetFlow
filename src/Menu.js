function onOpen() {
    const ui = SpreadsheetApp.getUi();

    ui.createMenu('💼 FinSheetFlow')
        .addItem('📸 Cargar', 'menuCargarTickets')
        .addToUi();
}

/**
 * Funciones puente que se ejecutan al pulsar cada botón del menú
 */
function menuCargarTickets() {
    // Aquí llamas a la función que dispara tu flujo Drop Folder o procesa la carpeta
    Folder.procesarCarpeta();
    ejecutarPipelineBancario("Octubre");
}