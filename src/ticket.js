// Cargar variables de entorno del usuario en Apps Script
const scriptProperties = PropertiesService.getScriptProperties();
const GEMINI_API_KEY = scriptProperties.getProperty('GEMINI_API_KEY');
const SHEET_NAME = scriptProperties.getProperty('SHEET_NAME') || 'Historial_Tickets';
const SPREADSHEET_ID = scriptProperties.getProperty('SPREADSHEET_ID');

const Ticket = {
    procesarTicketEInsertar(blobImagen) {

        if (!GEMINI_API_KEY) {
            throw new Error("Por favor, configura la propiedad GEMINI_API_KEY en la configuración del script.");
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        // Convertir la imagen a Base64 para el payload
        const base64Image = Utilities.base64Encode(blobImagen.getBytes());
        const mimeType = blobImagen.getContentType();

        const prompt = "Analiza minuciosamente la imagen de este ticket de compra de supermercado. " +
            "1. Identifica el nombre de la TIENDA (ej: Mercadona, Lidl, Carrefour, Eroski, Dia, Aldi, Hiper centro). " +
            "2. Busca la FECHA de emisión del ticket (suele estar en formato DD/MM/AAAA o DD-MM-YY junto a la hora). Conviértela SIEMPRE a formato YYYY-MM-DD. " +
            "3. Extrae la lista completa de productos (items), calcula sus precios y clasifícalos por Categoría (Comida, Limpieza, Ropa, Mascotas, Jardín, Muebles, Mantenimiento) y Tipo (Necesidad o Deseo). Aplica un criterio financiero estándar para el Tipo. " +
            "Asegúrate de rellenar absolutamente todos los campos del JSON Schema.";

        const payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {"inlineData": {"mimeType": mimeType, "data": base64Image}}
                ]
            }],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": {
                    "type": "object",
                    "properties": {
                        "fecha_compra": {
                            "type": "string",
                            "description": "Fecha del ticket en formato DD/MM/YYYY. Si no la encuentras o dudas, usa la fecha de hoy."
                        },
                        "tienda": {
                            "type": "string",
                            "enum": ["Mercadona", "Lidl", "Aldi", "Eroski", "Carrefour", "Hiper Centro", "Otros"]
                        },
                        "items": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "cantidad": {"type": "string"},
                                    "producto": {"type": "string"},
                                    "precio_unitario": {"type": "number"},
                                    "precio_total": {"type": "number"},
                                    "categoria": {"type": "string"},
                                    "tipo": {"type": "string"}
                                },
                                "required": ["cantidad", "producto", "precio_unitario", "precio_total", "categoria", "tipo"]
                            }
                        }
                    }
                },
                "thinkingConfig": {
                    "thinkingBudget": 0
                }
            }
        };

        const options = {
            "method": "post",
            "contentType": "application/json",
            "payload": JSON.stringify(payload)
        };

        const MAX_RETRIES = 5;
        let attempts = 0;
        let response;
        let success = false;

        while (attempts < MAX_RETRIES && !success) {
            try {
                attempts++;
                response = UrlFetchApp.fetch(url, options);

                // Si el código de respuesta es 200, salimos del bucle
                if (response.getResponseCode() === 200) {
                    success = true;
                }
            } catch (error) {
                Logger.log(`Intento ${attempts} fallido debido a saturación de la API (503/429).`);

                if (attempts >= MAX_RETRIES) {
                    throw new Error(`API de Gemini inaccesible tras ${MAX_RETRIES} intentos: ${error.toString()}`);
                }

                // Tiempo de espera exponencial: 2s, 4s, 8s...
                const waitTime = Math.pow(2, attempts) * 1000;
                Logger.log(`Esperando ${waitTime / 1000} segundos antes del siguiente intento...`);
                Utilities.sleep(waitTime); // Pausa nativa de Google Apps Script
            }
        }

        const jsonResponse = JSON.parse(response.getContentText());
// Parsear el JSON estructurado devuelto por la API de Gemini
        const resultadoText = jsonResponse.candidates[0].content.parts[0].text;
        const data = JSON.parse(resultadoText);

        if (!SPREADSHEET_ID) {
            throw new Error("Error: La propiedad SPREADSHEET_ID no está configurada.");
        }
        const targetSpreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
        const sheet = targetSpreadsheet.getSheetByName(SHEET_NAME) || targetSpreadsheet.insertSheet(SHEET_NAME);

// Ajustamos las cabeceras para reflejar los nuevos metadatos del ticket
        if (sheet.getLastRow() === 0) {
            sheet.appendRow(["Fecha Compra", "Tienda", "Cantidad", "Producto", "Precio Unitario", "Precio Total", "Categoría", "Tipo", "Fecha Registro"]);
        }


        const fechaRegistro = new Date(); // Timestamp local de cuando ejecutas la app

// Extraemos las variables globales que ha identificado el modelo
        const fechaCompra = data.fecha_compra || "No detectada";
        const tienda = data.tienda || "No detectada";

// Insertamos fila por fila asociando la cabecera del ticket a cada producto
        data.items.forEach(item => {
            sheet.appendRow([
                fechaCompra,
                tienda,
                item.cantidad,
                item.producto,
                item.precio_unitario,
                item.precio_total,
                item.categoria,
                item.tipo,
                fechaRegistro
            ]);
        });
    }
};