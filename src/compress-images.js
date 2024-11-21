const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const inputFolder = './images';
const outputFolder = './output';

const reduceFactor = 0.3; // Factor de reducción: 30%

const apiUrl = 'https://conexiones-star.concilbot.com/fileblocks';
const apiToken = '6ddc8107-5e4b-4f72-acd2-ce2e65cb1b4d'; // Reemplaza con tu token

async function uploadFileToBucket(filePath, fileName, mimeType) {
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), {
      filename: fileName,
      contentType: mimeType,
    });

    const response = await axios.post(apiUrl, form, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        ...form.getHeaders(),
      },
    });

    if (response.data && response.data.data && response.data.data.imgeUrlOpenWindows) {
      return response.data.data.imgeUrlOpenWindows;
    } else {
      throw new Error('La API no devolvió un enlace válido.');
    }
  } catch (error) {
    console.error(`Error subiendo el archivo ${fileName}:`, error.message);
    return null;
  }
}

async function processImages() {
  try {
    await fs.ensureDir(outputFolder);
    const files = await fs.readdir(inputFolder);

    const uploadedLinks = []; // Aquí se guardarán los enlaces devueltos

    for (const file of files) {
      const inputFile = path.join(inputFolder, file);
      const outputFile = path.join(outputFolder, path.parse(file).name + '.webp');

      if (path.extname(file).match(/\.(jpg|jpeg|png|bmp|tiff)$/i)) {
        try {
          const metadata = await sharp(inputFile).metadata();

          // Calcula las nuevas dimensiones
          const newWidth = Math.floor(metadata.width * (1 - reduceFactor));
          const newHeight = Math.floor(metadata.height * (1 - reduceFactor));

          // Redimensiona y convierte a WebP
          await sharp(inputFile)
            .resize({ width: newWidth, height: newHeight })
            .webp({ quality: 60 })
            .toFile(outputFile);

          console.log(`Procesado: ${file}`);

          // Sube la imagen optimizada al bucket
          const link = await uploadFileToBucket(
            outputFile,
            path.basename(outputFile),
            'image/webp'
          );

          if (link) {
            uploadedLinks.push(link); // Guarda el enlace si la subida fue exitosa
          }
        } catch (err) {
          console.error(`Error procesando ${file}:`, err);
        }
      } else {
        console.log(`Saltando archivo no válido: ${file}`);
      }
    }

    console.log('Procesamiento completado.');
    console.log('Enlaces de las imágenes subidas:', uploadedLinks);
  } catch (err) {
    console.error('Error leyendo la carpeta:', err);
  }
}

processImages();