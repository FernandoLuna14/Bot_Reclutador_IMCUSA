const express = require('express');
const { google } = require('googleapis');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de Google Sheets MEJORADA
const auth = new google.auth.GoogleAuth({
    credentials: {
        type: process.env.GOOGLE_TYPE,
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: process.env.GOOGLE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
        token_uri: process.env.GOOGLE_TOKEN_URI || "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const spreadsheetId = process.env.SPREADSHEET_ID;

// Almacenamiento temporal de estados
const estados = {};
const vacantes = ["Desarrollador Full Stack", "Diseñador UX/UI", "Marketing Digital", "Ventas"];

// Función para guardar en Google Sheets (VERSIÓN MEJORADA CON DEBUGGING)
async function guardarEnSheets(datos) {
    try {
        console.log('🔧 Intentando guardar en Sheets:', datos);
        
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });

        const timestamp = new Date().toLocaleString('es-MX', {
            timeZone: 'America/Mexico_City'
        });

        const fila = [
            timestamp,
            datos.nombre || '',
            datos.telefono || '',
            datos.email || '',
            datos.vacante || '',
            datos.experiencia || '',
            'Nuevo'
        ];

        console.log('📝 Fila a guardar:', fila);
        console.log('📋 Spreadsheet ID:', spreadsheetId);

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId,
            range: 'Sheet1!A:G',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [fila]
            }
        });

        console.log('✅ ÉXITO: Datos guardados en Google Sheets');
        console.log('📊 Respuesta de Sheets:', response.data);
        
        return true;
    } catch (error) {
        console.error('❌ ERROR al guardar en Google Sheets:');
        console.error('📌 Mensaje:', error.message);
        console.error('📌 Código:', error.code);
        if (error.response) {
            console.error('📌 Detalles:', error.response.data);
        }
        return false;
    }
}

// Webhook de Twilio
app.post('/webhook', async (req, res) => {
    const { From, Body } = req.body;
    const telefono = From.replace('whatsapp:', '');
    const mensaje = Body.trim().toLowerCase();

    console.log(`📱 Mensaje recibido de ${telefono}: ${mensaje}`);

    // Inicializar estado si no existe
    if (!estados[telefono]) {
        estados[telefono] = {
            paso: 'inicio',
            datos: {}
        };
    }

    let respuesta = '';

    // Lógica de conversación
    switch (estados[telefono].paso) {
        case 'inicio':
            if (mensaje === 'hola' || mensaje === 'hi' || mensaje === 'holi') {
                estados[telefono].paso = 'solicitar_nombre';
                respuesta = '¡Hola! Bienvenido al proceso de reclutamiento de Grupo IMCUSA. ¿Cuál es tu nombre completo?';
            } else {
                respuesta = 'Por favor, escribe "Hola" para comenzar el proceso de reclutamiento.';
            }
            break;

        case 'solicitar_nombre':
            estados[telefono].datos.nombre = Body.trim();
            estados[telefono].paso = 'solicitar_telefono';
            respuesta = `Mucho gusto, ${Body.trim()}. ¿Cuál es tu número de teléfono?`;
            break;

        case 'solicitar_telefono':
            estados[telefono].datos.telefono = Body.trim();
            estados[telefono].paso = 'solicitar_email';
            respuesta = 'Gracias. ¿Cuál es tu correo electrónico?';
            break;

        case 'solicitar_email':
            estados[telefono].datos.email = Body.trim();
            estados[telefono].paso = 'solicitar_vacante';
            const listaVacantes = vacantes.map((v, i) => `${i + 1}. ${v}`).join('\n');
            respuesta = `Perfecto. ¿Para qué vacante te interesa aplicar?\n\n${listaVacantes}\n\nResponde con el número de la vacante (1-${vacantes.length})`;
            break;

        case 'solicitar_vacante':
            const numeroVacante = parseInt(mensaje);
            if (numeroVacante >= 1 && numeroVacante <= vacantes.length) {
                estados[telefono].datos.vacante = vacantes[numeroVacante - 1];
                estados[telefono].paso = 'solicitar_experiencia';
                respuesta = `Excelente elección: ${vacantes[numeroVacante - 1]}. ¿Cuéntame brevemente sobre tu experiencia profesional?`;
            } else {
                respuesta = 'Por favor, selecciona un número válido de la lista.';
            }
            break;

        case 'solicitar_experiencia':
            estados[telefono].datos.experiencia = Body.trim();
            
            console.log('💾 Guardando datos completos:', estados[telefono].datos);
            
            // GUARDAR EN GOOGLE SHEETS
            const guardadoExitoso = await guardarEnSheets(estados[telefono].datos);
            
            if (guardadoExitoso) {
                respuesta = `¡Gracias por completar tu registro! 🎉\n\nHemos recibido tu información para la vacante de ${estados[telefono].datos.vacante}. Nos pondremos en contacto contigo pronto.\n\n*Resumen de tu registro:*\nNombre: ${estados[telefono].datos.nombre}\nTeléfono: ${estados[telefono].datos.telefono}\nEmail: ${estados[telefono].datos.email}\nVacante: ${estados[telefono].datos.vacante}`;
            } else {
                respuesta = '¡Gracias por tu información! Hubo un error al guardar, pero nos pondremos en contacto contigo.';
            }
            
            // Reiniciar estado
            delete estados[telefono];
            break;

        default:
            respuesta = 'Por favor, escribe "Hola" para comenzar.';
    }

    console.log(`🤖 Respuesta enviada: ${respuesta}`);
    res.set('Content-Type', 'text/plain');
    res.send(respuesta);
});

// Ruta de salud para Render
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.listen(port, () => {
    console.log(`🤖 Bot de reclutamiento IMCUSA ejecutándose en puerto ${port}`);
    console.log(`📊 Google Sheets configurado con ID: ${spreadsheetId}`);
});