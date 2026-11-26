
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  downloadVideoForSoundSticker,
  sendVideoAsSoundSticker,
  jidNormalizedUser
} from '@xbibzlibrary/whatsbibz';

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState('auth');

  const sock = makeWASocket({
    auth: state,
    autoFollowChannel: false,
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log('WhatsApp bot berhasil terhubung!');
    }

    if (connection === 'close') {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      if (statusCode !== DisconnectReason.loggedOut) {
        console.log('Mencoba menghubungkan ulang...');
        startBot();
      } else {
        console.log('Sesi WhatsApp logout. Hubungkan ulang.');
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const message of messages) {
      try {
        if (!message.message || !message.key.remoteJid) continue;

        const jid = message.key.remoteJid;

        // Pesan sendiri hanya diproses di chat pribadi sendiri.
        if (message.key.fromMe) {
          const myJid = jidNormalizedUser(sock.user.id);

          if (jidNormalizedUser(jid) !== myJid) {
            continue;
          }
        }

        const content = message.message;

        const text = (
          content.conversation ||
          content.extendedTextMessage?.text ||
          content.videoMessage?.caption ||
          ''
        ).trim();

        const command = text.toLowerCase();

        // PING
        if (command === '!ping') {
          await sock.sendMessage(jid, {
            text: 'pong'
          }, { quoted: message });

          continue;
        }

        // SOUND STICKER
        if (command === '!sticker') {
          try {
            const videoMessage =
              content.videoMessage ||
              content.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;

            if (!videoMessage) {
              await sock.sendMessage(jid, {
                text: 'Kirim video dengan caption !sticker atau balas video dengan !sticker.'
              }, { quoted: message });

              continue;
            }

            await sock.sendMessage(jid, {
              text: 'Sedang membuat sticker...'
            }, { quoted: message });

            const video = await downloadVideoForSoundSticker(
              message,
              {
                mediaHost: sock.getMediaHost?.()
              }
            );

            await sendVideoAsSoundSticker(
              sock,
              jid,
              video,
              {
                quoted: message
              }
            );

          } catch (error) {
            console.error(
              'Sticker gagal:',
              error?.code || 'UNKNOWN_ERROR'
            );

            await sock.sendMessage(jid, {
              text: 'Gagal membuat sound sticker. Pastikan video MP4/MOV memiliki suara.'
            }, { quoted: message });
          }
        }

      } catch (error) {
        console.error('Kesalahan pesan:', error);
      }
    }
  });
}

startBot().catch(console.error);
