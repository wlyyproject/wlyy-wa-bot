
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

  const phoneNumber = (process.env.WHATSAPP_PHONE || '')
    .replace(/\D/g, '');

  const sock = makeWASocket({
    auth: state,
    autoFollowChannel: false
  });

  let pairingRequested = false;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !state.creds.registered) {
      if (!phoneNumber) {
        console.log('Nomor belum diatur. Tambahkan WHATSAPP_PHONE di Railway.');
      } else if (!pairingRequested) {
        pairingRequested = true;

        try {
          const code = await sock.requestPairingCode(phoneNumber);

          console.log('\n==============================');
          console.log('KODE PAIRING WHATSAPP:');
          console.log(code);
          console.log('==============================\n');
          console.log('Masukkan kode tersebut di WhatsApp.');
        } catch (error) {
          console.error('Gagal meminta kode pairing:', error?.message || error);
        }
      }
    }

    if (connection === 'open') {
      console.log('WhatsApp bot berhasil terhubung!');
    }

    if (connection === 'close') {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      if (statusCode !== DisconnectReason.loggedOut) {
        console.log('Mencoba menghubungkan ulang...');
        setTimeout(() => startBot(), 3000);
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

        if (command === '!ping') {
          await sock.sendMessage(
            jid,
            { text: 'pong' },
            { quoted: message }
          );
          continue;
        }

        if (command === '!sticker') {
          try {
            const videoMessage =
              content.videoMessage ||
              content.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;

            if (!videoMessage) {
              await sock.sendMessage(
                jid,
                {
                  text: 'Kirim video dengan caption !sticker atau balas video dengan !sticker.'
                },
                { quoted: message }
              );
              continue;
            }

            await sock.sendMessage(
              jid,
              { text: 'Sedang membuat sticker...' },
              { quoted: message }
            );

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
              { quoted: message }
            );

          } catch (error) {
            console.error('Sticker gagal:', error?.code || error);

            await sock.sendMessage(
              jid,
              {
                text: 'Gagal membuat sound sticker. Pastikan video MP4/MOV memiliki suara.'
              },
              { quoted: message }
            );
          }
        }

      } catch (error) {
        console.error('Kesalahan pesan:', error);
      }
    }
  });
}

startBot().catch(console.error);
