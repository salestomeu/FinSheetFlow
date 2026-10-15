/**
 * Extractor dinámico para archivos CSV basado en las posiciones de la pestaña 'config'.
 */
const ExtractorCsv = {
    procesar(file, targetSheet, registroClavesMap, conceptosAOmitir, mapaCategorias) {
        let lineasInsertadas = 0;
        let lineasActualizadas = 0;

        try {
            Logger.log(`[CSV] 📄 Procesando archivo: ${file.getName()}`);

            const contenidoText = file.getBlob().getDataAsString('UTF-8');
            const lineas = Utilities.parseCsv(contenidoText);

            if (!lineas || lineas.length === 0) {
                Logger.log(`[CSV] ⚠️ El archivo '${file.getName()}' está vacío.`);
                return 0;
            }

            // 1. OBTENER CONFIGURACIONES DINÁMICAS
            const mapaConfig = Config.obtenerMapaConfiguracion();
            let configAplicable = null;

            // 2. DETECTOR DINÁMICO DE PERFIL (Compara el tipo de fichero 'csv' y las cabeceras)
            for (const key in mapaConfig) {
                const conf = mapaConfig[key];
                if (conf.tipoFichero !== 'csv') continue;

                // Fila del encabezado ajustada a índice base 0
                const filaEncabezadoIdx = conf.encabezado > 0 ? (conf.encabezado - 1) : conf.titulo;

                if (lineas[filaEncabezadoIdx]) {
                    const filaEncabezado = lineas[filaEncabezadoIdx];
                    const numColumnas = filaEncabezado.length;

                    const coincideLongitud = (conf.longitud === 0 || numColumnas >= conf.longitud);

                    // Validamos si las etiquetas de las columnas configuradas coinciden
                    const valFecha = String(filaEncabezado[conf.posFecha] || "").toLowerCase();
                    const valDesc  = String(filaEncabezado[conf.posDescripcion] || "").toLowerCase();
                    const valImp   = String(filaEncabezado[conf.posImporte] || "").toLowerCase();

                    const esEncabezadoValido = valFecha.includes("fecha") || valFecha.includes("date") ||
                        valDesc.includes("concepto") || valDesc.includes("description") || valDesc.includes("descripción") ||
                        valImp.includes("importe") || valImp.includes("amount");

                    if (coincideLongitud && esEncabezadoValido) {
                        configAplicable = conf;
                        Logger.log(`[CSV] 🎯 Perfil detectado por cabeceras: "${conf.banco}"`);
                        break;
                    }
                }
            }

            // Fallback: Si no coincide por etiquetas específicas, toma el primer perfil de tipo CSV
            if (!configAplicable) {
                for (const key in mapaConfig) {
                    if (mapaConfig[key].tipoFichero === 'csv') {
                        configAplicable = mapaConfig[key];
                        Logger.log(`[CSV] ⚠️ Perfil asignado por Fallback (Tipo CSV): "${configAplicable.banco}"`);
                        break;
                    }
                }
            }

            if (!configAplicable) {
                Logger.log(`[CSV] ❌ ERROR: No hay ninguna configuración de tipo 'csv' definida en la pestaña 'config'.`);
                return 0;
            }

            // 3. EXTRACCIÓN DINÁMICA DE POSICIONES DESDE CONFIG
            const indiceFecha       = configAplicable.posFecha;
            const indiceConcepto    = configAplicable.posDescripcion;
            const indiceImporte     = configAplicable.posImporte;
            const filaInicioDatos   = configAplicable.encabezado > 0 ? configAplicable.encabezado : (configAplicable.titulo + 1);

            Logger.log(`[CSV] 🛠️ Mapeo Dinámico Activo -> Fecha: Col ${indiceFecha} | Desc: Col ${indiceConcepto} | Importe: Col ${indiceImporte} | Fila Inicio: ${filaInicioDatos + 1}`);

            // 4. RECORRER LÍNEAS DE DATOS USANDO LAS POSICIONES MAPEADAS
            for (let j = filaInicioDatos; j < lineas.length; j++) {
                const fila = lineas[j];
                if (!fila || fila.length <= Math.max(indiceFecha, indiceConcepto, indiceImporte)) continue;

                // 🛑 FILTRO DE SEGURIDAD GLOBAL ANTI-SALDOS / RESÚMENES
                const filaTextoCompleto = fila.map(c => String(c || "").toLowerCase().trim()).join(" ");
                if (
                    filaTextoCompleto.includes("saldo") ||
                    filaTextoCompleto.includes("disponible") ||
                    filaTextoCompleto.includes("límite") ||
                    filaTextoCompleto.includes("limite") ||
                    filaTextoCompleto.includes("total a pagar")
                ) {
                    Logger.log(`  ├─ ⏩ [Fila ${j + 1}] Omitida por resumen/saldo: "${filaTextoCompleto.substring(0, 40)}..."`);
                    continue;
                }

                // LEEMOS DINÁMICAMENTE SEGÚN LAS POSICIONES DEL MAPA
                const fechaRaw   = String(fila[indiceFecha] || "").trim();
                const descripcion = String(fila[indiceConcepto] || "").trim();
                const importeRaw  = String(fila[indiceImporte] || "").trim();

                if (!fechaRaw || descripcion === "" || descripcion.toLowerCase().startsWith("total")) continue;

                if (typeof debeOmitirseConcepto === "function" && debeOmitirseConcepto(descripcion, conceptosAOmitir)) {
                    Logger.log(`  ├─ ⏩ [Fila ${j + 1}] Omitida por regla de exclusión: "${descripcion}"`);
                    continue;
                }

                // PARSEO ROBUSTO DE FECHA
                let fechaObjeto;
                if (fechaRaw.includes('/')) {
                    const partes = fechaRaw.split('/');
                    const dia = parseInt(partes[0], 10);
                    const mes = parseInt(partes[1], 10) - 1;
                    let anio = parseInt(partes[2], 10);
                    if (anio < 100) anio += 2000;

                    fechaObjeto = new Date(anio, mes, dia);
                } else if (!isNaN(Date.parse(fechaRaw))) {
                    fechaObjeto = new Date(fechaRaw);
                } else {
                    Logger.log(`  ├─ ⚠️ [Fila ${j + 1}] Formato de fecha no reconoscible: ${fechaRaw}`);
                    continue;
                }

                const fechaFormatoISO = Utilities.formatDate(fechaObjeto, targetSheet.getParent().getSpreadsheetTimeZone(), "yyyy-MM-dd");

                // NORMALIZACIÓN DINÁMICA DE IMPORTE
                let importeNumero = 0;
                if (importeRaw) {
                    let limpio = importeRaw.replace(/["']/g, "").replace(/\./g, "").replace(",", ".");
                    importeNumero = parseFloat(limpio);

                    if (isNaN(importeNumero)) {
                        importeNumero = 0;
                    }
                }

                if (importeNumero === 0) continue;

                const categoriaAsignada = (typeof Categorizador !== "undefined" && Categorizador.asignarCategoria)
                    ? Categorizador.asignarCategoria(descripcion, mapaCategorias)
                    : "Otros";

                // UUID ÚNICO Y CONSISTENTE
                const uuidTransaccion = `${fechaFormatoISO}_${descripcion}_${importeNumero.toFixed(2)}`;

                // 5. INSERCIÓN / ACTUALIZACIÓN EN HOJA DESTINO
                if (registroClavesMap.has(uuidTransaccion)) {
                    const numeroFilaDestino = registroClavesMap.get(uuidTransaccion);

                    targetSheet.getRange(numeroFilaDestino, 1).setValue(fechaFormatoISO);
                    targetSheet.getRange(numeroFilaDestino, 2).setValue(descripcion);
                    targetSheet.getRange(numeroFilaDestino, 3).setValue(importeNumero);
                    targetSheet.getRange(numeroFilaDestino, 5).setValue(new Date());
                    targetSheet.getRange(numeroFilaDestino, 6).setValue(categoriaAsignada);

                    lineasActualizadas++;
                    Logger.log(`  ├─ 🔄 [Actualizado] Fila ${numeroFilaDestino}: ${fechaFormatoISO} | ${descripcion} | ${importeNumero} €`);
                } else {
                    targetSheet.appendRow([
                        fechaFormatoISO,
                        descripcion,
                        importeNumero,
                        uuidTransaccion,
                        new Date(),
                        categoriaAsignada
                    ]);

                    registroClavesMap.set(uuidTransaccion, targetSheet.getLastRow());
                    lineasInsertadas++;
                    Logger.log(`  ├─ ➕ [Insertado] Nueva Fila ${targetSheet.getLastRow()}: ${fechaFormatoISO} | ${descripcion} | ${importeNumero} €`);
                }
            }

            SpreadsheetApp.flush();
            Logger.log(`[CSV] ✅ Archivo '${file.getName()}' finalizado. Insertados: ${lineasInsertadas} | Actualizados: ${lineasActualizadas}`);

            file.setTrashed(true);

        } catch (e) {
            Logger.log(`[CSV] ❌ Error crítico procesando el archivo CSV ${file.getName()}: ${e.toString()}`);
        }

        return lineasInsertadas + lineasActualizadas;
    }
};