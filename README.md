# ticket-flow-ai

Herramienta open-source para automatizar la extracción de datos de tickets de compra físicos mediante la API de Gemini (con salidas estructuradas JSON) y su inserción automática en una base de datos de Google Sheets.

La arquitectura está diseñada bajo el enfoque **"Drop Folder" (Carpeta Segura)**. El sistema no expone ningún endpoint ni URL pública en internet, operando de manera 100% privada e impenetrable mediante activadores internos basados en tiempo.

## ✨ Características
- **OCR Avanzado:** Extrae automáticamente la fecha de compra, el nombre del establecimiento comercial y los productos.
- **Categorización Inteligente:** Clasifica cada producto bajo reglas financieras (`Comida`, `Limpieza`, `Ropa`, `Mascotas`, `Jardín`, `Muebles`, `Mantenimiento`).
- **Control de Gastos:** Discierne entre `Necesidad` y `Deseo` para ayudar a optimizar el presupuesto mensual.
- **Privacidad:** Los datos viajan directamente entre tu almacenamiento/script y la API, sin intermediarios.

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


## 📐 JSON Schema Empleado
El modelo fuerza una respuesta estricta utilizando `responseSchema`. Puedes consultar la estructura exacta en los archivos del repositorio para adaptar los enumerados de categorías a tus propias necesidades de visualización o analítica.

## 📄 Licencia
Este proyecto está bajo la Licencia MIT. Siéntete libre de clonarlo, modificarlo y enviar tus Pull Requests.

* **☕ Invítame a un café:** Si este script te ha ahorrado tiempo, puedes apoyar el proyecto en [Ko-fi](https://ko-fi.com/tomeu).