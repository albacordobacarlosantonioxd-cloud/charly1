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
const NUMERO_BOT = process.env.NUMERO_BOT;
const RAPIDAPI_HOST = 'tiktok-video-no-watermark2.p.rapidapi.com';

const isWindows = process.platform === "win32";
const ytDlp = new YTDlpWrap();

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        executablePath: isWindows 
            ? 'C:\\Users\\IK\\.cache\\puppeteer\\chrome\\win64-145.0.7632.77\\chrome-win64\\chrome.exe' 
            : undefined 
    }
});

// --- EVENTOS DE CONEXIÓN ---
client.on('ready', () => console.log('✅ BOT MAESTRO ONLINE'));
client.on('code', (code) => console.log('🔥 TU CÓDIGO DE VINCULACIÓN ES:', code));

// --- LÓGICA DE MENSAJES ---
client.on('message', async msg => {
    const text = msg.body.toLowerCase();

    // 1. EL MENÚ (.menu)
    if (text === '.menu' || text === '.help') {
        const menu = `╭─── *BOT MAESTRO* ───╮
│ 📌 *.p* - Ping del bot
│ 🎭 *.s* - Crear Sticker (envía o cita img)
│ 🤖 *.ai* [texto] - IA modo texto
│ 🎙️ *.v* [texto] - IA modo nota de voz
│ 🎵 *.audio* [búsqueda] - YouTube Audio
│ 🎥 *.video* [búsqueda] - YouTube Video
│ 📱 *.tt* [búsqueda/link] - TikTok
╰───────────────────╯`;
        return msg.reply(menu);
    }

    // 2. PING (.p)
    if (text === '.p') return msg.reply('★ *¡Pong!*');

    // 3. STICKERS (.s)
    if (text === '.s') {
        try {
            let targetMsg = msg.hasMedia ? msg : (msg.hasQuotedMsg ? await msg.getQuotedMessage() : null);
            if (targetMsg && targetMsg.hasMedia) {
                const media = await targetMsg.downloadMedia();
                await client.sendMessage(msg.from, media, { 
                    sendMediaAsSticker: true, 
                    stickerName: "Bot Maestro", 
                    stickerAuthor: "Pendejo Bot" 
                });
            } else {
                msg.reply('❌ ¡Manda una imagen o cita una, animal!');
            }
        } catch (e) { msg.reply('❌ Error al crear sticker.'); }
    }

    // 4. IA TEXTO (.ai) E IA VOZ (.v)
    if (text.startsWith('.ai ') || text.startsWith('.v ')) {
        const isVoice = text.startsWith('.v ');
        const prompt = msg.body.slice(isVoice ? 3 : 4);
        try {
            const res = await axios.post('https://api.mistral.ai/v1/chat/completions', {
                model: 'open-mistral-7b',
                messages: [
                    { role: "system", content: "Eres Bot Maestro, grosero y sarcástico." },
                    { role: "user", content: prompt }
                ]
            }, { headers: { 'Authorization': `Bearer ${MISTRAL_API_KEY}` } });

            const respuesta = res.data.choices[0].message.content;

            if (isVoice) {
                const url = googleTTS.getAudioUrl(respuesta, { lang: 'es', host: 'https://translate.google.com' });
                const media = await MessageMedia.fromUrl(url, { unsafeMime: true });
                return await client.sendMessage(msg.from, media, { sendAudioAsVoice: true });
            }
            return msg.reply(`🤖 ${respuesta}`);
        } catch (e) { return msg.reply('⚠️ IA caída.'); }
    }

    // 5. YOUTUBE (.audio / .video)
    if (text.startsWith('.audio ') || text.startsWith('.video ')) {
        const isVideo = text.startsWith('.video');
        const query = msg.body.split(' ').slice(1).join(' ');
        const fileName = path.join(__dirname, `temp_${Date.now()}.${isVideo ? 'mp4' : 'mp3'}`);
        
        try {
            msg.reply('⏳ Bajando tu mugre, espera...');
            let args = [`ytsearch1:${query}`, '-o', fileName];
            isVideo ? args.push('-f', 'best[ext=mp4]') : args.push('-x', '--audio-format', 'mp3');
            
            await ytDlp.execPromise(args);
            const media = MessageMedia.fromFilePath(fileName);
            await client.sendMessage(msg.from, media, { unsafeMime: true });
            fs.unlinkSync(fileName);
        } catch (e) { msg.reply('❌ No pude bajar eso de YouTube.'); }
    }

    // 6. TIKTOK (.tt)
    if (text.startsWith('.tt ')) {
        const query = msg.body.slice(4);
        try {
            const options = { 
                method: 'GET', url: `https://${RAPIDAPI_HOST}/feed/search`, 
                params: { keywords: query, count: '1' }, 
                headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': RAPIDAPI_HOST } 
            };
            const response = await axios.request(options);
            const video = response.data.data.videos[0];
            const media = await MessageMedia.fromUrl(video.play, { unsafeMime: true });
            await client.sendMessage(msg.from, media, { caption: video.title });
        } catch (e) { msg.reply('❌ Error en TikTok.'); }
    }
});

client.initialize();
setTimeout(async () => { if (!client.info) { try { await client.requestPairingCode(NUMERO_BOT); } catch (e) {} } }, 10000);