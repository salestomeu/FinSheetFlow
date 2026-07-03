/**
 * Módulo encargado de procesar archivos de hojas de cálculo de Banca March.
 * Soporta archivos .xlsx nativos y archivos ya convertidos a Google Sheets desde el móvil.
 */
const ExtractorXLSX = {
    procesar(file, targetSheet, registroClavesMap, conceptosAOmitir, mapaCategorias) {
        const name = file.getName().toLowerCase();
        const mimeType = file.getMimeType();

        // El archivo es válido si termina en .xlsx o si su tipo MIME interno es un Google Sheet nativo
        const esExcelNativo = name.endsWith('.xlsx') || name.endsWith('.xls');
        const esGoogleSheetNativo = (mimeType === "application/vnd.google-apps.spreadsheet");

        if (!esExcelNativo && !esGoogleSheetNativo) {
            return 0; // No es un formato soportado por este extractor
        }

        let srcSpreadsheet = null;
        let esArchivoTemporal = false;
        let lineasInsertadas = 0;
        let lineasActualizadas = 0;

        try {
            if (esGoogleSheetNativo) {
                // 📱 ESCENARIO MÓVIL: El archivo ya es un Google Sheet. Lo abrimos directamente por su ID.
                Logger.log(`Abriendo Google Sheet nativo (Subida móvil): ${file.getName()}`);
                srcSpreadsheet = SpreadsheetApp.openById(file.getId());
                esArchivoTemporal = false; // ⚠️ ¡Ojo! No debemos borrarlo antes de tiempo si falla el bucle
            } else {
                // 💻 ESCENARIO ESCRITORIO: Es un binario .xlsx plano. Requiere conversión asíncrona v3.
                Logger.log(`Convirtiendo y analizando binario Excel: ${file.getName()}`);
                const resource = {
                    name: "[TEMP] " + file.getName(),
                    mimeType: "application/vnd.google-apps.spreadsheet",
                    parents: [Config.FOLDER_ID] // O FOLDER_ID directo si no usas el módulo Config
                };

                const tempFile = Drive.Files.create(resource, file.getBlob());
                srcSpreadsheet = SpreadsheetApp.openById(tempFile.id);
                esArchivoTemporal = true; // Este sí es un residuo que hay que limpiar al terminar
            }

            // Leemos la primera pestaña del libro abierto (sea el temporal o el del móvil)
            const datosExcel = srcSpreadsheet.getSheets()[0].getDataRange().getValues();

            let filaCabeceraEncontrada = false;
            let indiceFecha = 0;
            let indiceConcepto = 3;
            let indiceImporte = 5;

            Logger.log(`Num Filas excel: ${datosExcel.length}`);
            for (const element of datosExcel) {
                const fila = element;
                if (!fila || fila.length === 0) continue;

                // DETECCIÓN DINÁMICA DE FORMATO
                if (!filaCabeceraEncontrada) {
                    const filaTexto = fila.map(celda => String(celda).trim().toLowerCase());

                    if (filaTexto.includes("concepto") || filaTexto.some(t => t.startsWith("f. operaci"))) {
                        filaCabeceraEncontrada = true;
                        indiceFecha = Math.max(filaTexto.findIndex(t => t.startsWith("f. operaci") || t.includes("fecha")), 0);
                        indiceConcepto = Math.max(filaTexto.indexOf("concepto"), 3);
                        indiceImporte = Math.max(filaTexto.indexOf("importe"), 5);
                        continue;
                    }
                    else if (filaTexto.includes("concept") ||
                        filaTexto.some(t => t.startsWith("transaction d."))
                    ) {
                        filaCabeceraEncontrada = true;
                        indiceFecha = filaTexto.indexOf("transaction d.") >= 0 ? filaTexto.indexOf("transaction d.") : 0;
                        indiceConcepto = filaTexto.indexOf("concept") >= 0 ? filaTexto.indexOf("concept") : 3;
                        indiceImporte = filaTexto.indexOf("amount") >= 0 ? filaTexto.indexOf("amount") : 5;
                        continue
                    }
                    continue;
                }

                const fechaRaw = String(fila[indiceFecha]).trim();
                const concepto = String(fila[indiceConcepto]).trim();
                const importeRaw = String(fila[indiceImporte]).trim();
                if (!fechaRaw || fechaRaw === "" || concepto === "" || concepto.toLowerCase().startsWith("total")) continue;

                if (debeOmitirseConcepto(concepto, conceptosAOmitir)) {
                    Logger.log(`[XLSX] Omitiendo movimiento por regla de exclusión: ${concepto}`);
                    continue;
                }
                // Parseo de la fecha (DD/MM/AAAA) con corrección de siglo
                let fechaObjeto;
                if (fechaRaw.includes('/')) {
                    const partes = fechaRaw.split('/');
                    let anio = parseInt(partes[2], 10);
                    if (anio < 100) anio += 2000;
                    fechaObjeto = new Date(anio, parseInt(partes[1], 10) - 1, parseInt(partes[0], 10));
                } else if (!isNaN(Date.parse(fechaRaw))) {
                    fechaObjeto = new Date(fechaRaw);
                    if (fechaObjeto.getFullYear() < 2000) {
                        fechaObjeto.setFullYear(fechaObjeto.getFullYear() + 100);
                    }
                } else {
                    continue;
                }
                const fechaFormatoISO = Utilities.formatDate(fechaObjeto, targetSheet.getParent().getSpreadsheetTimeZone(), "yyyy-MM-dd");
                const categoriaAsignada = Categorizador.asignarCategoria(concepto, mapaCategorias);
                const uuidTransaccion = `${fechaRaw}_${concepto}_${importeRaw}`;
                const importeNumerico = parseFloat(importeRaw.replace(",", "."));

                if (registroClavesMap.has(uuidTransaccion)) {
                    const numeroFilaDestino = registroClavesMap.get(uuidTransaccion);

                    // Actualizamos las columnas críticas (Concepto, Importe, Fecha Modificación, Categoría)
                    // Columna A (1): Fecha | B (2): Concepto | C (3): Importe | D (4): UUID | E (5): F. Registro | F (6): Categoría
                    targetSheet.getRange(numeroFilaDestino, 1).setValue(fechaFormatoISO);
                    targetSheet.getRange(numeroFilaDestino, 2).setValue(concepto);
                    targetSheet.getRange(numeroFilaDestino, 3).setValue(importeNumerico);
                    targetSheet.getRange(numeroFilaDestino, 5).setValue(new Date()); // Actualizamos marca de tiempo
                    targetSheet.getRange(numeroFilaDestino, 6).setValue(categoriaAsignada); // Recalcula categoría nueva
                    lineasActualizadas++;
                }else {
                    Logger.log(`write in target sheet`);
                    targetSheet.appendRow([
                        fechaFormatoISO,
                        concepto,
                        importeNumerico,
                        uuidTransaccion,
                        new Date(),
                        categoriaAsignada
                    ]);
                    lineasInsertadas++;
                }
            }

            SpreadsheetApp.flush();
            Logger.log(`Fichero '${file.getName()}' finalizado. Movimientos indexados: ${lineasInsertadas}.`);

            // Enviamos el archivo original de la carpeta drop a la papelera
            file.setTrashed(true);

        } catch (error) {
            Logger.log(`Error procesando hoja de cálculo bancaria: ${error.toString()}`);
        } finally {
            // 🚫 BORRADO SEGURO: Solo destruimos el archivo si se generó un [TEMP] intermedio.
            // Si era el del móvil, no lo borramos aquí porque arriba ya se le hizo un file.setTrashed(true) de forma limpia.
            if (esArchivoTemporal && srcSpreadsheet) {
                try {
                    DriveApp.getFileById(srcSpreadsheet.getId()).setTrashed(true);
                } catch (e) {
                    Logger.log(`Warning limpiando archivo temporal: ${e.toString()}`);
                }
            }
        }

        return lineasInsertadas + lineasActualizadas;
    }
};


