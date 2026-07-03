# FinSheetFlow

**FinSheetFlow** es un motor *open-source* y *serverless* desarrollado en Google Apps Script que automatiza por completo la gestión de tus finanzas personales directamente en Google Sheets.

---

### 📸 OCR de Tickets con IA (Gemini API)
*   **OCR Avanzado:** Extrae automáticamente la fecha de compra, el nombre del establecimiento comercial y el desglose de productos desde una imagen (`.jpg`, `.png`) o archivo `.pdf`.
*   **Categorización Inteligente:** Clasifica cada producto bajo reglas financieras configurables (`Comida`, `Limpieza`, `Ropa`, `Mascotas`, `Jardín`, `Muebles`, `Mantenimiento`).
*   **Control de Gastos:** Discierne entre `Necesidad` y `Deseo` aplicando principios de la ley de Pareto para ayudarte a optimizar el presupuesto mensual.

### 🏦 Parseadores Bancarios Nativos
Permite procesar, limpiar y estructurar archivos de extractos reales sin intermediarios opacos:
*   **American Express (`.csv`)**
*   **Banca March (`.xlsx`)**

### 🔒 Privacidad 
Los datos viajan directamente entre tu almacenamiento/script de Google y la API de Google AI Studio. **Sin servidores intermedios, sin bases de datos externas de terceros y sin ceder tu información financiera.**

---
## 🛠️ Arquitectura y Funcionamiento

El flujo de datos opera de forma pasiva y eficiente en los servidores de Google:

1. **Captura:** Subes una imagen (`.jpg`, `.png`) o un archivo `.pdf` desde tu móvil u ordenador a una carpeta específica de Google Drive.
2. **Orquestación:** Un activador temporal (*Time-driven Trigger*) despierta la función principal del script de manera interna cada cierto tiempo (ej. cada hora).
3. **Ingesta:** El script escanea la carpeta. Si está vacía, se apaga en milisegundos sin consumir cuotas. Si detecta archivos, extrae sus blobs binarios.
4. **Procesamiento de IA:** El script codifica el archivo y lo envía a la API de Gemini mediante una petición optimizada (Modo de baja latencia con `thinkingBudget: 0`) junto a un prompt especializado y un **JSON Schema**.
5. **Estructuración:** Gemini procesa el archivo visual, extrae los datos e introduce las categorías y el tipo de gasto (*Necesidad / Deseo* aplicando principios de la ley de Pareto).
6. **Indexación:** El script parsea la respuesta e inserta las filas en tiempo real en la pestaña correspondiente de Google Sheets. Una vez completado con éxito, el archivo original se envía a la papelera de Drive para mantener la carpeta limpia.

## 🛠️ Requisitos e Instalación

### 1. Obtén una API Key gratuita en Google AI Studio (Gemini API).
* ** Accede a **[Google AI Studio](https://aistudio.google.com/)** con tu cuenta de Google.
* ** Haz clic en el botón **"Get API key"** en la esquina superior izquierda.
* ** Haz clic en **"Create API key"**. Selecciona *Create API key in new project* si es tu primera vez.
* ** Copia la cadena de texto generada (empieza por `AIzaSy...`). *Nota: La capa gratuita permite hasta 1.500 peticiones diarias, ideal para este entorno.*
### 2. Infraestructura en Google Drive y Sheets.
* **Carpeta de Entrada (Drop Folder):** Crea una carpeta en Google Drive donde subirás tus tickets. Copia su ID de la URL del navegador (la cadena alfanumérica que va después de `folders/`).
* **Hoja de Cálculo (Google Sheets):** Crea un archivo de Google Sheets nuevo. Copia su ID de la URL (la cadena larga entre `/d/` y `/edit`). Dentro del libro, crea una pestaña o define el nombre que quieras usar para almacenar el historial (ej: `Historial_Tickets`).
### 3. Ve a `Extensiones > Apps Script`, borra el código por defecto y pega el contenido de `src/ticket.js`.
### 4. En la configuración del Script (icono de engranaje), añade las siguientes **Propiedades del script**:
    - `GEMINI_API_KEY`: Tu clave privada de la API.
    - `SHEET_NAME`: Nombre de la pestaña (opcional, por defecto `Historial_Tickets`).
    - `DRIVE_FOLDER_ID`: Identificador de la carpeta
    - `SPREADSHEET_ID`: Identificador del Google Sheet
---

## ☕ Soporte y Contribuciones

Este proyecto es y seguirá siendo **100% de código abierto**. Si los parseadores bancarios o o la integración de Gemini te facilita la organización diaria:

*   **Invítame a un café** en mi página de [Ko-fi](https://ko-fi.com/tomeu) 
*   Reporta fallos o abre un **Pull Request** si detectas cambios en los formatos de los extractos de los bancos. ¡Toda ayuda es bienvenida!

---

## ⚠️ Exención de Responsabilidad Financiera y Legal (Disclaimer)

**FinSheetFlow** es una herramienta de automatización de datos de código abierto y uso personal.

* **No es asesoramiento financiero:** El software, los informes generados y las plantillas visuales asociadas se proporcionan únicamente con fines informativos y organizativos. En ningún caso constituyen asesoramiento financiero, legal, fiscal o de inversión.
* **Responsabilidad de los datos:** Los parseadores bancarios y el motor de IA (Gemini) dependen de estructuras de terceros que pueden cambiar sin previo aviso. Es responsabilidad exclusiva del usuario verificar la exactitud de los datos importados (fechas, importes y categorías) antes de tomar cualquier decisión económica.
* **Limitación de responsabilidad:** El autor no se hace responsable de posibles errores en el código, fallos en las importaciones, pérdida de datos, alucinaciones de la IA o de cualquier perjuicio económico directo o indirecto derivado del uso de este software. El uso de esta herramienta se realiza bajo el propio riesgo del usuario.

---

## 📄 Licencia
Este proyecto está bajo la Licencia MIT. Siéntete libre de clonarlo, modificarlo y enviar tus Pull Requests.

* **☕ Invítame a un café:** Si este script te ha ahorrado tiempo, puedes apoyar el proyecto en [Ko-fi](https://ko-fi.com/tomeu).