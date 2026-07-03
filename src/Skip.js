/**
 * Obtiene el listado de conceptos a omitir desde la pestaña configurada.
 * @return {Set<string>} Conjunto de palabras o frases a omitir en minúsculas.
 */
function obtenerConceptosAOmitir(targetSpreadsheet) {
    const scriptProperties = PropertiesService.getScriptProperties();
    const OMITIR_SHEET_NAME = scriptProperties.getProperty('OMITIR_SHEET_NAME') || 'omitir';

    const conceptosSet = new Set();
    const sheetOmitir = targetSpreadsheet.getSheetByName(OMITIR_SHEET_NAME);

    if (!sheetOmitir) {
        Logger.log(`Aviso: No se encontró la pestaña '${OMITIR_SHEET_NAME}'. No se omitirá ningún concepto.`);
        return conceptosSet;
    }

    const lasFilas = sheetOmitir.getDataRange().getValues();
    // Asumimos que los conceptos están en la primera columna (Columna A)
    for (const element of lasFilas) {
        const concepto = String(element[0]).trim().toLowerCase();
        if (concepto !== "") {
            conceptosSet.add(concepto);
        }
    }

    return conceptosSet;
}

/**
 * Verifica si un concepto bancario debe ser omitido basándose en la lista negra.
 * @param {string} conceptoBanco El concepto extraído del archivo.
 * @param {Set<string>} conceptosAOmitir El conjunto de conceptos prohibidos.
 * @return {boolean} True si debe omitirse, False en caso contrario.
 */
function debeOmitirseConcepto(conceptoBanco, conceptosAOmitir) {
    if (conceptosAOmitir.size === 0) return false;

    const conceptoMinusc = conceptoBanco.toLowerCase();
    // Convierte el Set en array para evaluar si el concepto contiene la subcadena
    return Array.from(conceptosAOmitir).some(prohibido => conceptoMinusc.includes(prohibido));
}