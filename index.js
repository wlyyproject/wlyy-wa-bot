
import makeWASocket, {
  useMultiFileAuthState,
  jidNormalizedUser,
  downloadVideoForSoundSticker,
  sendVideoAsSoundSticker
} from '@xbibzlibrary/whatsbibz';

function unwrapMessage(content) {
  while (content) {
    const wrapped =
      content.ephemeralMessage?.message ||
      content.viewOnceMessage?.message ||
      content.viewOnceMessageV2?.message ||
      content.documentWithCaptionMessage?.message;

    if (!wrapped) break;
    content = wrapped;
  }

  return content;
}

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState('auth');

  const sock = makeWASocket({
    auth: state,
    autoFollowChannel: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection }) => {
    if (connection === 'open') {
      console.log('Bot WhatsApp berhasil terhubung!');
    }

    if (connection === 'close') {
      console.log('Koneksi WhatsApp terputus.');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const message of messages) {
      try {
        if (!message.message || !message.key.remoteJid) continue;

        // Pesan dari bot sendiri hanya diproses di chat pribadi sendiri.
        if (message.key.fromMe) {
          const myJid = sock.user?.id
            ? jidNormalizedUser(sock.user.id)
            : null;

          if (
            !myJid ||
            jidNormalizedUser(message.key.remoteJid) !== myJid
          ) {
            continue;
          }
        }

        const content = unwrapMessage(message.message);

        const text = (
          content.conversation ||
          content.extendedTextMessage?.text ||
          content.videoMessage?.caption ||
          content.imageMessage?.caption ||
          ''
        ).trim();

        const command = text.toLowerCase();
        const jid = message.key.remoteJid;

        // Perintah ping
        if (command === '!ping') {
          await sock.sendMessage(jid, {
            text: 'pong'
          });
          continue;
        }

        // Perintah sticker suara
        if (command.startsWith('!sticker')) {
          const contextInfo =
            content.extendedTextMessage?.contextInfo ||
            content.videoMessage?.contextInfo;

          const quotedContent = contextInfo?.quotedMessage
            ? unwrapMessage(contextInfo.quotedMessage)
            : null;

          let incomingVideo = null;

          // Video langsung dengan caption !sticker
          if (content.videoMessage) {
            incomingVideo = message;
          }

          // Video yang dibalas dengan perintah !sticker
          else if (quotedContent?.videoMessage) {
            incomingVideo = {
              key: {
                remoteJid: jid,
                id: contextInfo.stanzaId,
                participant: contextInfo.participant,
                fromMe: false
              },
              message: quotedContent
            };
          }

          if (!incomingVideo) {
            await sock.sendMessage(jid, {
              text: 'Balas video dengan !sticker atau tulis !sticker pada caption video.'
            });
            continue;
          }

          await sock.sendMessage(jid, {
            text: 'Sedang membuat sticker...'
          });

          try {
            const video = await downloadVideoForSoundSticker(
              incomingVideo,
              {
                mediaHost: sock.getMediaHost()
              }
            );

            await sendVideoAsSoundSticker(
              sock,
              jid,
              video,
              {
                quoted: message,
                startSeconds: 0
              }
            );
          } catch (error) {
            console.error('Sticker error:', error);

            await sock.sendMessage(jid, {
              text: 'Gagal membuat sticker. Pastikan video memiliki suara dan formatnya didukung.'
            });
          }
        }
      } catch (error) {
        console.error('Message error:', error);
      }
    }
  });
}

startBot().catch(console.error);
          
