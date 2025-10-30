require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const XLSX = require("xlsx");
const fs = require("fs");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// --- Archivo Excel ---
const excelFile = "candidatos.xlsx";
let workbook, worksheet;

// Si el archivo existe, lo abrimos; si no, lo creamos
if (fs.existsSync(excelFile)) {
  workbook = XLSX.readFile(excelFile);
  worksheet = workbook.Sheets["Candidatos"];
} else {
  workbook = XLSX.utils.book_new();
  worksheet = XLSX.utils.aoa_to_sheet([
    ["Nombre", "Correo", "Teléfono", "Puesto Deseado", "Experiencia"]
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Candidatos");
  XLSX.writeFile(workbook, excelFile);
}

// Función para guardar datos nuevos
function guardarCandidato(datos) {
  const hojaJSON = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  hojaJSON.push([
    datos.nombre,
    datos.correo,
    datos.telefono,
    datos.puesto,
    datos.experiencia
  ]);
  const nuevaHoja = XLSX.utils.aoa_to_sheet(hojaJSON);
  workbook.Sheets["Candidatos"] = nuevaHoja;
  XLSX.writeFile(workbook, excelFile);
}

// --- Manejo de conversación ---
const usuarios = {};

app.post("/webhook", (req, res) => {
  const from = req.body.From;
  const body = req.body.Body ? req.body.Body.trim() : "";

  if (!usuarios[from]) {
    usuarios[from] = { paso: 0, datos: {} };
  }

  const usuario = usuarios[from];
  let respuesta = "";

  switch (usuario.paso) {
    case 0:
      respuesta = "👋 ¡Hola! Soy el asistente de reclutamiento. ¿Cuál es tu nombre completo?";
      usuario.paso++;
      break;

    case 1:
      usuario.datos.nombre = body;
      respuesta = "Perfecto, ¿podrías compartir tu correo electrónico?";
      usuario.paso++;
      break;

    case 2:
      usuario.datos.correo = body;
      respuesta = "¿Cuál es tu número de teléfono?";
      usuario.paso++;
      break;

    case 3:
      usuario.datos.telefono = body;
      respuesta = "¿Para qué puesto deseas postularte?";
      usuario.paso++;
      break;

    case 4:
      usuario.datos.puesto = body;
      respuesta = "Cuéntame brevemente tu experiencia laboral.";
      usuario.paso++;
      break;

    case 5:
      usuario.datos.experiencia = body;
      guardarCandidato(usuario.datos);
      respuesta = "✅ Gracias, tus datos han sido registrados correctamente.";
      usuario.paso = 0;
      usuario.datos = {};
      break;

    default:
      respuesta = "No entendí eso 😅. Escribe 'Hola' para comenzar.";
  }

  res.set("Content-Type", "text/xml");
  res.send(`
    <Response>
      <Message>${respuesta}</Message>
    </Response>
  `);
});

// --- Iniciar servidor local ---
app.listen(3000, () => console.log("Servidor activo en http://localhost:3000"));