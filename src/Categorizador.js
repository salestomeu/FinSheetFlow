/**
 * Módulo encargado de clasificar los movimientos bancarios en categorías.
 */
const Categorizador = {
    /**
     * Lee la pestaña del diccionario y genera un mapa en memoria.
     * Estructura esperada en el Sheets: Columna A (Concepto/Palabra clave) | Columna B (Categoría)
     * @return {Map<string, string>} Mapa de { palabraClave: categoria }
     */
    cargarDiccionario() {
        const props = PropertiesService.getScriptProperties();
        // Reutiliza SPREADSHEET_ID si no se configura uno independiente
        const targetId =  props.getProperty('SPREADSHEET_ID');
        const nombrePestaña =  'Categorias';

        const mapaCategorias = new Map();

        try {
            const ts = SpreadsheetApp.openById(targetId);
            const sheet = ts.getSheetByName(nombrePestaña);

            if (!sheet) {
                Logger.log(`Aviso: No se encontró la pestaña '${nombrePestaña}'. Los movimientos irán sin categoría.`);
                return mapaCategorias;
            }

            const filas = sheet.getDataRange().getValues();

            // Empezamos en i = 1 para saltarnos la cabecera del diccionario
            for (let i = 1; i < filas.length; i++) {
                const palabraClave = String(filas[i][1]).trim().toLowerCase();
                const categoria = String(filas[i][0]).trim();

                if (palabraClave !== "" && categoria !== "") {
                    mapaCategorias.set(palabraClave, categoria);
                }
            }

            Logger.log(`Diccionario de categorización cargado con éxito. Reglas indexadas: ${mapaCategorias.size}`);
        } catch (e) {
            Logger.log(`Error al cargar el diccionario de categorías: ${e.toString()}`);
        }

        return mapaCategorias;
    },

    /**
     * Busca si el concepto del banco coincide con alguna regla del diccionario.
     * @param {string} conceptoBanco Texto del movimiento del banco.
     * @param {Map<string, string>} mapaCategorias Diccionario cargado en memoria.
     * @return {string} La categoría asignada o "Otros" si no hay coincidencia.
     */
    asignarCategoria(conceptoBanco, mapaCategorias) {
        if (!conceptoBanco || mapaCategorias.size === 0){
            Logger.log(`⚠️ Alerta: El mapa de categorías llegó vacío a asignarCategoria para el concepto: "${conceptoBanco}"`);
            return "Otros";
        }


        const textoBajo = conceptoBanco.toLowerCase();

        // Iteramos sobre las llaves del mapa (las palabras clave)
        for (let [palabraClave, categoria] of mapaCategorias.entries()) {
            if (textoBajo.includes(palabraClave)) {
                return categoria; // Devuelve la primera coincidencia que encuentre
            }
        }
        Logger.log(`❌ SIN MATCH: El concepto "${conceptoBanco}" no coincide con ninguna regla. Va a "Otros".`);
        return "Otros"; // Categoría por defecto si el banco trae un comercio nuevo
    }
};