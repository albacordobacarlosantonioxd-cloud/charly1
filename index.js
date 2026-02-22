require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const YTDlpWrap = require('yt-dlp-wrap').default;
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const googleTTS = require('google-tts-api');

// --- CONFIGURACIÓN ---
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const NUMERO_BOT = process.env.NUMERO_BOT; // Ejemplo: 5219998887766
const RAPIDAPI_HOST = 'tiktok-video-no-watermark2.p.rapidapi.com';

const isWindows = process.platform === "win32";
const ffmpegPath = isWindows ? path.join(__dirname, 'ffmpeg.exe') : 'ffmpeg';
const ytDlpPath = isWindows ? path.join(__dirname, 'yt-dlp.exe') : 'yt-dlp';
const ytDlp = new YTDlpWrap(isWindows ? ytDlpPath : undefined);

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions'],
        executablePath: isWindows ? 'C:\\Users\\IK\\.cache\\puppeteer\\chrome\\win64-145.0.7632.77\\chrome-win64\\chrome.exe' : undefined
    }
});

// --- LÓGICA DE VINCULACIÓN ---
client.on('qr', qr => {
    console.log('📢 SI ESTÁS EN LOCAL, ESCANEA ESTO:');
    qrcode.generate(qr, {务mall: true });
});

client.on('ready', () => console.log('✅ ¡BOT MAESTRO ONLINE Y LISTO!'));

// --- COMANDOS Y LÓGICA ---
client.on('message', async msg => {
    const text = msg.body.toLowerCase();

    if (text === '.p' || text === '.ping') {
        const latency = Date.now() - (msg.timestamp * 1000);
        return msg.reply(`★ *¡Pong!*\n> *_Tiempo: ${latency}ms_*`);
    }

    if (text === '.reload') {
        await msg.reply('🚀 Reiniciando...');
        setTimeout(() => process.exit(), 2000);
    }

    if (text.startsWith('.tag')) {
        const chat = await msg.getChat();
        if (!chat.isGroup) return msg.reply('❌ Solo grupos.');
        let mentions = chat.participants.map(p => `${p.id.user}@c.us`);
        await client.sendMessage(msg.from, msg.body.slice(4).trim() || '📢 ¡Atención pendejos!', { mentions });
    }

    if (text.startsWith('.ai ')) {
        try {
            const res = await axios.post('https://api.mistral.ai/v1/chat/completions', {
                model: 'open-mistral-7b',
                messages: [{ role: "system", content: "Eres Bot Maestro, un bot mexicano grosero y vulgar." }, { role: "user", content: msg.body.slice(4) }]
            }, { headers: { 'Authorization': `Bearer ${MISTRAL_API_KEY}` } });
            return msg.reply(`🤖 *IA:* \n\n${res.data.choices[0].message.content}`);
        } catch (e) { return msg.reply('⚠️ IA muerta.'); }
    }

    if (text === '.s') {
        try {
            let targetMsg = msg.hasMedia ? msg : (msg.hasQuotedMsg ? await msg.getQuotedMessage() : null);
            if (targetMsg && targetMsg.hasMedia) {
                const media = await targetMsg.downloadMedia();
                await client.sendMessage(msg.from, media, { sendMediaAsSticker: true, stickerName: "Bot Maestro", stickerAuthor: "Pack" });
            }
        } catch (e) { msg.reply('⚠️ Error sticker.'); }
    }

    if (text.startsWith('.audio') || text.startsWith('.video')) {
        const isVideo = text.startsWith('.video');
        const query = msg.body.split(' ').slice(1).join(' ');
        if (!query) return msg.reply('❌ ¿Qué bajo?');
        const fileName = path.join(__dirname, `temp_${Date.now()}.${isVideo ? 'mp4' : 'mp3'}`);
        await msg.reply('⏳ Bajando...');
        try {
            let args = [`ytsearch1:${query}`, '-o', fileName];
            if (!isWindows) args.push('--ffmpeg-location', '/usr/bin/ffmpeg');
            isVideo ? args.push('-f', 'best[ext=mp4]') : args.push('-x', '--audio-format', 'mp3');
            const ytDlpProcess = ytDlp.exec(args, { windowsHide: true });
            await new Promise((res) => ytDlpProcess.on('close', res));
            if (fs.existsSync(fileName)) {
                const media = MessageMedia.fromFilePath(fileName);
                await client.sendMessage(msg.from, media, { unsafeMime: true });
                fs.unlinkSync(fileName);
            }
        } catch (e) { msg.reply('❌ Falló YT.'); }
    }

    if (text.startsWith('.tt ')) {
        const query = msg.body.slice(4);
        try {
            const options = { method: 'GET', url: `https://${RAPIDAPI_HOST}/feed/search`, params: { keywords: query, count: '1' }, headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': RAPIDAPI_HOST } };
            const response = await axios.request(options);
            if (response.data?.data?.videos?.length > 0) {
                const video = response.data.data.videos[0];
                const media = await MessageMedia.fromUrl(video.play || video.wmplay, { unsafeMime: true });
                await client.sendMessage(msg.from, media, { caption: `✅ *TikTok:* ${video.title}` });
            }
        } catch (e) { msg.reply('❌ TikTok falló.'); }
    }
});

// --- INICIALIZACIÓN CON CÓDIGO ---
client.initialize();

client.on('code', (code) => {
    console.log('------------------------------------');
    console.log('🔥 TU CÓDIGO DE VINCULACIÓN ES:', code);
    console.log('------------------------------------');
});

// Si usas Pairing Code, esta función se activa automáticamente al no haber sesión
setTimeout(async () => {
    if (!client.info) {
        try {
            const code = await client.requestPairingCode(NUMERO_BOT);
            console.log('🔥 TU CÓDIGO DE VINCULACIÓN ES:', code);
        } catch (err) {
            console.log('ℹ️ Esperando autenticación...');
        }
    }
}, 5000);