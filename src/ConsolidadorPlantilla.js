/**
 * Módulo especializado en la inyección de totales en la plantilla de presupuestos.
 * Cumple con la Ley de Demeter: Solo conoce y modifica su propio dominio (INGRESOS_GASTOS).
 */
const ConsolidadorPlantilla = {

    /**
     * Recibe los datos ya calculados e indexados y los plasma en el documento de presupuestos.
     * @param {Map<string, Map<string, number>>} mapaMesesCategorias Estructura de datos calculada en memoria.
     */
    inyectarTotales(mapaMesesCategorias) {
        const props = PropertiesService.getScriptProperties();
        const PRESUPUESTO_SPREADSHEET_ID = props.getProperty('INGRESOS_GASTOS');

        if (!PRESUPUESTO_SPREADSHEET_ID) {
            Logger.log("Error crítico: No se ha configurado la propiedad 'INGRESOS_GASTOS'.");
            return;
        }

        // 🔥 Único documento que abre y conoce este módulo
        const tsPresupuesto = SpreadsheetApp.openById(PRESUPUESTO_SPREADSHEET_ID);

        // Iteramos sobre los datos puros recibidos por parámetro
        for (let [nombrePestañaMes, mapaTotalesReales] of mapaMesesCategorias.entries()) {
            const hojaMes = tsPresupuesto.getSheetByName(nombrePestañaMes);
            if (!hojaMes) continue;

            Logger.log(`Escribiendo datos consolidados en Presupuestos -> Pestaña: ${nombrePestañaMes}`);
            const rangoPlantilla = hojaMes.getDataRange();
            const datosPlantilla = rangoPlantilla.getValues();

            const INDICE_COLUMNA_GASTOS = 6; // Columna G
            const NUM_COLUMNA_GASTOS = 9;

            for (let fila = 0; fila < datosPlantilla.length; fila++) {
                if (datosPlantilla[fila].length > INDICE_COLUMNA_GASTOS) {
                    const textoCelda = String(datosPlantilla[fila][INDICE_COLUMNA_GASTOS]).trim();

                    if (mapaTotalesReales.has(textoCelda)) {
                        let totalGasto = mapaTotalesReales.get(textoCelda);
                        if (totalGasto < 0) {
                            totalGasto = Math.abs(totalGasto);
                        }

                        // Escritura en el documento de presupuestos
                        hojaMes.getRange(fila + 1, NUM_COLUMNA_GASTOS).setValue(totalGasto);
                    }
                }
            }

            const sueldo = String(datosPlantilla[5][4]).trim();
            if (mapaTotalesReales.has(sueldo)) {
                let ingreso = mapaTotalesReales.get(sueldo);
                hojaMes.getRange(4, 5).setValue(ingreso);
            }
        }

        SpreadsheetApp.flush();
        Logger.log("Escritura aislada en el libro de Presupuestos completada con éxito.");
    }
};