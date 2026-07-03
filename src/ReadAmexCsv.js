/**
 * Función principal para buscar y procesar archivos CSV en la carpeta Drop.
 */
const ExtractorCsv = {
    procesar(file, targetSheet, registroClavesMap, conceptosAOmitir, mapaCategorias) {
        let lineasInsertadas = 0;
        let lineasActualizadas = 0;
        try {
            const contenidoText = file.getBlob().getDataAsString('UTF-8');

            // Parsear el CSV de forma defensiva usando expresiones regulares
            const lineas = Utilities.parseCsv(contenidoText);

            // Iteramos las líneas del CSV (saltándonos la cabecera del archivo en el índice 0)
            for (let j = 1; j < lineas.length; j++) {
                const fila = lineas[j];
                if (fila.length < 3) continue; // Saltarse líneas vacías

                const fechaRaw = fila[0].trim();
                const descripcion = fila[1].trim();
                const importe = fila[2].trim();

                if (debeOmitirseConcepto(descripcion, conceptosAOmitir)) {
                    Logger.log(`[CSV] Omitiendo movimiento por regla de exclusión: ${descripcion}`);
                    continue;
                }

                // 1. NORMALIZACIÓN DE FECHA: Convertir "DD/MM/AAAA" a un Objeto Date real
                let fechaObjeto;
                if (fechaRaw.includes('/')) {
                    const partes = fechaRaw.split('/');
                    // Ojo: En JavaScript los meses van de 0 a 11 (Enero es 0, Mayo es 4)
                    const dia = parseInt(partes[0], 10);
                    const mes = parseInt(partes[1], 10) - 1;
                    const anio = parseInt(partes[2], 10);

                    fechaObjeto = new Date(anio, mes, dia);
                } else {
                    // Fallback por si en algún CSV del futuro viene como YYYY-MM-DD
                    fechaObjeto = new Date(fechaRaw);
                }

                let importeNumero = 0;
                if (importe) {
                    // 1. Quitamos comillas que puedan venir del CSV
                    let limpio = importe.replace(/["']/g, "");
                    // 2. Reemplazamos la coma decimal por un punto decimal operativo para JavaScript
                    limpio = limpio.replace(",", ".");
                    // 3. Lo parseamos a número flotante nativo
                    importeNumero = parseFloat(limpio);

                    // Control de seguridad: si no es un número válido (NaN), lo dejamos como 0 o el original
                    if (isNaN(importeNumero)) {
                        importeNumero = 0;
                    } else {
                        importeNumero = importeNumero * -1;
                    }
                }

                const categoriaAsignada = Categorizador.asignarCategoria(descripcion, mapaCategorias);

                // Creamos un identificador único sintético para esta transacción
                const uuidTransaccion = `${fechaRaw}_${descripcion}_${importe}`;


                if (registroClavesMap.has(uuidTransaccion)){
                    const numeroFilaDestino = registroClavesMap.get(uuidTransaccion);
                    targetSheet.getRange(numeroFilaDestino, 1).setValue(fechaObjeto);
                    targetSheet.getRange(numeroFilaDestino, 2).setValue(descripcion);
                    targetSheet.getRange(numeroFilaDestino, 3).setValue(importeNumerico);
                    targetSheet.getRange(numeroFilaDestino, 5).setValue(new Date()); // Actualizamos marca de tiempo
                    targetSheet.getRange(numeroFilaDestino, 6).setValue(categoriaAsignada); // Recalcula categoría nueva
                    lineasActualizadas++;
                } else{
                    // Si es único, lo guardamos en el Sheets
                    targetSheet.appendRow([
                        fechaObjeto,
                        descripcion,
                        importeNumero,
                        uuidTransaccion, // Guardamos el hash para futuras ejecuciones
                        new Date(),
                        categoriaAsignada// Timestamp
                    ]);
                    registroClavesMap.set(uuidTransaccion, targetSheet.getLastRow())
                    lineasInsertadas++;
                }

            }

            SpreadsheetApp.flush();
            Logger.log(`Archivo CSV '${file.getName()}' procesado. Líneas nuevas: ${lineasInsertadas}.`);

            // 3. ELIMINACIÓN SEGURA: Una vez procesado sin errores, va a la papelera
            file.setTrashed(true);

        } catch (e) {
            Logger.log(`Error crítico procesando el archivo CSV ${file.getName()}: ${e.toString()}`);
        }
        return lineasInsertadas + lineasActualizadas;
    }
};
