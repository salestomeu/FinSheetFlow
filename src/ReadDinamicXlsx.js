const ExtractorDinamicXLSX = {
    procesar(file, targetSheet, registroClavesMap, conceptosAOmitir, mapaCategorias) {
        const name = file.getName().toLowerCase();
        const mimeType = file.getMimeType();

        const esExcelNativo = name.endsWith('.xlsx') || name.endsWith('.xls');
        const esGoogleSheetNativo = (mimeType === "application/vnd.google-apps.spreadsheet");

        if (!esExcelNativo && !esGoogleSheetNativo) {
            return 0;
        }

        let srcSpreadsheet = null;
        let esArchivoTemporal = false;
        let lineasInsertadas = 0;
        let lineasActualizadas = 0;

        try {
            if (esGoogleSheetNativo) {
                Logger.log(`Abriendo Google Sheet nativo: ${file.getName()}`);
                srcSpreadsheet = SpreadsheetApp.openById(file.getId());
                esArchivoTemporal = false;
            } else {
                Logger.log(`Convirtiendo binario Excel: ${file.getName()}`);
                const resource = {
                    name: "[TEMP] " + file.getName(),
                    mimeType: "application/vnd.google-apps.spreadsheet",
                    parents: [Config.FOLDER_ID]
                };

                const tempFile = Drive.Files.create(resource, file.getBlob());
                srcSpreadsheet = SpreadsheetApp.openById(tempFile.id);
                esArchivoTemporal = true;
            }

            const datosExcel = srcSpreadsheet.getSheets()[0].getDataRange().getValues();
            if (!datosExcel || datosExcel.length === 0) return 0;

            // 1. OBTENER CONFIGURACIONES DINÁMICAS
            const mapaConfig = Config.obtenerMapaConfiguracion();

            // 2. DETECTAR QUÉ PERFIL APLICA SEGÚN LA ESTRUCTURA DEL EXCEL
            let configAplicable = null;
            let filaInicioDatos = 0;

            for (const key in mapaConfig) {
                const conf = mapaConfig[key];
                if (conf.tipoFichero !== 'xlsx' && conf.tipoFichero !== 'xls') continue;
                Logger.log(`[Config] banco: "${conf.banco}"`);

                // Ajustamos a índice base 0
                const filaEncabezadoIdx = conf.encabezado > 0 ? (conf.encabezado - 1) : conf.titulo;

                if (datosExcel[filaEncabezadoIdx]) {
                    const filaEncabezado = datosExcel[filaEncabezadoIdx];
                    const numColumnasFila = filaEncabezado.length;

                    const coincideLongitud = (conf.longitud === 0 || numColumnasFila >= conf.longitud);

                    const valFecha = String(filaEncabezado[conf.posFecha] || "").toLowerCase();
                    const valDesc  = String(filaEncabezado[conf.posDescripcion] || "").toLowerCase();
                    const valImp   = String(filaEncabezado[conf.posImporte] || "").toLowerCase();

                    const esEncabezadoValido = valFecha.includes("fecha") ||
                        valDesc.includes("concepto") ||
                        valDesc.includes("descripción") ||
                        valDesc.includes("operación") ||
                        valImp.includes("importe");

                    Logger.log(`[Config] banco:: "${conf.banco}" ${coincideLongitud}  && ${esEncabezadoValido}`);
                    if (coincideLongitud && esEncabezadoValido) {
                        configAplicable = conf;
                        filaInicioDatos = conf.encabezado > 0 ? conf.encabezado : (conf.titulo + 1);
                        Logger.log(`[Config] Perfil detectado con éxito: "${conf.banco}" (Fila inicio datos: ${filaInicioDatos})`);
                        break;
                    }
                }
            }

            // Fallback por estructura
            if (!configAplicable) {
                for (const key in mapaConfig) {
                    const conf = mapaConfig[key];
                    if (conf.tipoFichero !== 'xlsx' && conf.tipoFichero !== 'xls') continue;

                    const filaEncabezadoIdx = conf.encabezado > 0 ? (conf.encabezado - 1) : conf.titulo;
                    if (datosExcel[filaEncabezadoIdx] && datosExcel[filaEncabezadoIdx].length >= conf.longitud) {
                        configAplicable = conf;
                        filaInicioDatos = conf.encabezado > 0 ? conf.encabezado : (conf.titulo + 1);
                        Logger.log(`[Config Fallback] Perfil asignado por estructura: "${conf.banco}"`);
                        break;
                    }
                }
            }

            if (!configAplicable) {
                Logger.log(`[Config Error] No se encontró ninguna configuración válida para el archivo XLSX.`);
                return 0;
            }

            const indiceFecha = configAplicable.posFecha;
            const indiceConcepto = configAplicable.posDescripcion;
            const indiceImporte = configAplicable.posImporte;

            // 3. PROCESAR FILAS A PARTIR DE LA FILA DE INICIO DINÁMICA
            for (let i = filaInicioDatos; i < datosExcel.length; i++) {
                const fila = datosExcel[i];
                if (!fila || fila.length === 0) continue;

                // Convertimos toda la fila a texto para hacer comprobaciones de seguridad globales
                const filaTextoCompleto = fila.map(c => String(c || "").toLowerCase().trim()).join(" ");

                // 🛑 FILTRO DE SEGURIDAD ABSOLUTO ANTI-SALDOS Y RESÚMENES DE TARJETA:
                // Si la fila contiene palabras de control de saldos/límites, la ignoramos de inmediato
                if (
                    filaTextoCompleto.includes("saldo") ||
                    filaTextoCompleto.includes("disponible") ||
                    filaTextoCompleto.includes("límite") ||
                    filaTextoCompleto.includes("limite") ||
                    filaTextoCompleto.includes("total a pagar") ||
                    filaTextoCompleto.includes("pago mínimo")
                ) {
                    Logger.log(`[XLSX] Omitiendo fila de resumen/saldo (Fila ${i + 1}): ${filaTextoCompleto.substring(0, 50)}...`);
                    continue;
                }

                const fechaRaw = fila[indiceFecha];
                const concepto = String(fila[indiceConcepto] || "").trim();
                const importeRaw = fila[indiceImporte];

                // Filtro para ignorar vacíos, títulos o repetidos de cabecera
                if (!fechaRaw || concepto === "" || concepto.toLowerCase().startsWith("total") || concepto.toLowerCase().includes("concepto")) continue;

                if (typeof debeOmitirseConcepto === "function" && debeOmitirseConcepto(concepto, conceptosAOmitir)) {
                    Logger.log(`[XLSX] Omitiendo movimiento por regla de exclusión: ${concepto}`);
                    continue;
                }

                // Parseo de fecha
                let fechaObjeto;
                if (fechaRaw instanceof Date) {
                    fechaObjeto = fechaRaw;
                } else if (typeof fechaRaw === 'string' && fechaRaw.includes('/')) {
                    const partes = fechaRaw.trim().split('/');
                    let anio = parseInt(partes[2], 10);
                    if (anio < 100) anio += 2000;
                    fechaObjeto = new Date(anio, parseInt(partes[1], 10) - 1, parseInt(partes[0], 10));
                } else if (!isNaN(Date.parse(fechaRaw))) {
                    fechaObjeto = new Date(fechaRaw);
                    if (fechaObjeto.getFullYear() < 2000) {
                        fechaObjeto.setFullYear(fechaObjeto.getFullYear() + 100);
                    }
                } else {
                    continue; // Si no hay una fecha válida en esa celda, no es un movimiento real
                }

                const fechaFormatoISO = Utilities.formatDate(fechaObjeto, targetSheet.getParent().getSpreadsheetTimeZone(), "yyyy-MM-dd");
                const categoriaAsignada = (typeof Categorizador !== "undefined" && Categorizador.asignarCategoria)
                    ? Categorizador.asignarCategoria(concepto, mapaCategorias)
                    : "Otros";

                // Normalización de importe
                let importeNumerico = 0;
                if (typeof importeRaw === 'number') {
                    importeNumerico = importeRaw;
                } else {
                    const strImp = String(importeRaw || "").trim();
                    importeNumerico = parseFloat(strImp.replace(/\./g, "").replace(",", "."));
                }

                if (isNaN(importeNumerico) || importeNumerico === 0) continue;

                // UUID de transacción único
                const uuidTransaccion = `${fechaFormatoISO}_${concepto}_${importeNumerico.toFixed(2)}`;

                // INSERCIÓN O ACTUALIZACIÓN EN LA HOJA DESTINO
                if (registroClavesMap.has(uuidTransaccion)) {
                    const numeroFilaDestino = registroClavesMap.get(uuidTransaccion);

                    targetSheet.getRange(numeroFilaDestino, 1).setValue(fechaFormatoISO);
                    targetSheet.getRange(numeroFilaDestino, 2).setValue(concepto);
                    targetSheet.getRange(numeroFilaDestino, 3).setValue(importeNumerico);
                    targetSheet.getRange(numeroFilaDestino, 5).setValue(new Date());
                    targetSheet.getRange(numeroFilaDestino, 6).setValue(categoriaAsignada);
                    lineasActualizadas++;
                } else {
                    targetSheet.appendRow([
                        fechaFormatoISO,
                        concepto,
                        importeNumerico,
                        uuidTransaccion,
                        new Date(),
                        categoriaAsignada
                    ]);
                    registroClavesMap.set(uuidTransaccion, targetSheet.getLastRow());
                    lineasInsertadas++;
                }
            }

            SpreadsheetApp.flush();
            Logger.log(`Fichero '${file.getName()}' finalizado. Insertados: ${lineasInsertadas}, Actualizados: ${lineasActualizadas}.`);

            file.setTrashed(true);

        } catch (error) {
            Logger.log(`Error procesando hoja de cálculo bancaria: ${error.toString()}`);
        } finally {
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