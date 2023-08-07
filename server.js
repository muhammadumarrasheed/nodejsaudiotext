const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');

const API_TOKEN = "YOYR API KEY";
const API_BASE_URL = "https://api.assemblyai.com/v2";

const app = express();
app.use(express.static('public'));

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function(req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

app.post('/convertToText', upload.single('file'), async (req, res) => {
    const oggFilePath = `./uploads/${req.file.originalname}`;
    const mp3FilePath = `./output/${req.file.originalname.replace(".ogg", ".mp3")}`;

    ffmpeg.setFfmpegPath(require('@ffmpeg-installer/ffmpeg').path);
    ffmpeg()
        .input(oggFilePath)
        .audioQuality(96)
        .toFormat("mp3")
        .on('error', error => console.log(`Encoding Error: ${error.message}`))
        .on('end', async () => {
            console.log('Audio Transcoding succeeded !');

            // Upload the mp3 file to AssemblyAI
            const formData = new FormData();
            formData.append('file', fs.createReadStream(mp3FilePath));
            const uploadResponse = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                body: formData,
                headers: { Authorization: API_TOKEN },
            });
            const uploadData = await uploadResponse.json();
            const uploadUrl = uploadData["upload_url"];

            // Transcribe the audio
            const transcriptResponse = await fetch(`${API_BASE_URL}/transcript`, {
                method: 'POST',
                body: JSON.stringify({ audio_url: uploadUrl }),
                headers: {
                    Authorization: API_TOKEN,
                    'Content-Type': 'application/json',
                },
            });
            const transcriptData = await transcriptResponse.json();
            const transcriptId = transcriptData.id;
            const pollingEndpoint = `${API_BASE_URL}/transcript/${transcriptId}`;

            while (true) {
                const pollingResponse = await fetch(pollingEndpoint, { headers: { Authorization: API_TOKEN } });
                const transcriptionResult = await pollingResponse.json();

                if (transcriptionResult.status === "completed") {
                    res.json({ transcript: transcriptionResult.text });
                    break;
                } else if (transcriptionResult.status === "error") {
                    res.status(500).json({ error: transcriptionResult.error });
                    break;
                } else {
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
            }
        })
        .save(mp3FilePath);
});

const port = 3000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
