const crypto = require('crypto');

function parseChannelPollLink(link) {
  if (!link) return null;
  // Matches https://whatsapp.com/channel/<inviteCode>/<serverId>
  const m = String(link).trim().match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)(?:\/(\d+))?/i);
  if (!m) return null;
  return { inviteCode: m[1], serverId: m[2] || null };
}

async function resolveNewsletterJidFromInvite(socket, inviteCode) {
  const meta = await socket.newsletterMetadata('invite', inviteCode);
  if (!meta || !meta.id) throw new Error('Could not resolve channel from link (invalid/expired invite?)');
  return meta.id;
}

async function findPollMessageInChannel(socket, jid, inviteCode, serverId, extractNewsletterServerId) {
  if (!serverId) {
    throw new Error('Link must include the message id — use "Copy Link" on the poll message itself, not the channel invite link');
  }
  let list = null;
  try {
    const raw = await socket.newsletterFetchMessages('jid', jid, 100, 0);
    list = Array.isArray(raw) ? raw : (raw?.messages || raw?.data || null);
  } catch (e) {}
  if (!list) {
    try {
      const raw = await socket.newsletterFetchMessages('invite', inviteCode, 100, 0);
      list = Array.isArray(raw) ? raw : (raw?.messages || raw?.data || null);
    } catch (e) {}
  }
  if (!list) throw new Error('Failed to fetch channel messages (bot may need to follow the channel first)');

  const found = list.find(m => {
    const id = extractNewsletterServerId(m);
    return id && String(id) === String(serverId);
  });
  if (!found) throw new Error('Poll message not found in recent channel history — it may be too old, or this bot session has not synced the channel yet');
  return found;
}

function getPollCreationContent(msg) {
  const content = msg?.message || msg;
  return content?.pollCreationMessage || content?.pollCreationMessageV2 || content?.pollCreationMessageV3 || null;
}

async function voteOnChannelPoll(socket, jid, pollMsg, optionIndex, jidNormalizedUser, extractNewsletterServerId) {
  let encryptPollVote;
  try { ({ encryptPollVote } = require('baileys')); } catch (e) {}
  if (typeof encryptPollVote !== 'function') {
    throw new Error('Installed "baileys" package does not export encryptPollVote — update the baileys package to a version that supports poll voting');
  }

  const pollCreation = getPollCreationContent(pollMsg);
  if (!pollCreation || !Array.isArray(pollCreation.options) || !pollCreation.options.length) {
    throw new Error('Could not read poll options from the fetched message');
  }
  if (optionIndex < 1 || optionIndex > pollCreation.options.length) {
    throw new Error(`vote must be between 1 and ${pollCreation.options.length} for this poll`);
  }
  const optionName = pollCreation.options[optionIndex - 1].optionName;

  const pollEncKey = pollMsg?.message?.messageContextInfo?.messageSecret || pollMsg?.messageContextInfo?.messageSecret;
  if (!pollEncKey) throw new Error('Poll message is missing its encryption secret — cannot cast a vote on it');

  const pollMsgId = pollMsg?.key?.id || extractNewsletterServerId(pollMsg);
  const pollCreatorJid = pollMsg?.key?.participant || pollMsg?.participant || jid;
  const voterJid = jidNormalizedUser(socket.user.id);

  const { encPayload, encIv } = encryptPollVote(
    { selectedOptions: [crypto.createHash('sha256').update(optionName).digest()] },
    { pollEncKey, pollCreatorJid, pollMsgId, voterJid }
  );

  const messageId = crypto.randomBytes(8).toString('hex').toUpperCase();
  await socket.relayMessage(jid, {
    pollUpdateMessage: {
      pollCreationMessageKey: { remoteJid: jid, id: String(pollMsgId), fromMe: false, participant: pollCreatorJid },
      vote: { encPayload, encIv },
      senderTimestampMs: Date.now()
    }
  }, { messageId });

  return { optionVoted: optionName };
}

function setupChannelPollVote(router, deps) {
  const { activeSockets, extractNewsletterServerId, jidNormalizedUser, delay } = deps;

  router.get('/channelpollvote', async (req, res) => {
    const { link, vote, number } = req.query;
    if (!link) return res.status(400).send({ error: 'link is required — the WhatsApp channel poll message link' });
    const voteNumber = parseInt(vote, 10);
    if (!voteNumber || voteNumber < 1) return res.status(400).send({ error: 'vote is required — 1 for the 1st option, 2 for the 2nd, etc.' });

    // If ?number= is given, vote with only that one session.
    // Otherwise vote with EVERY currently active bot session.
    let sessionNumbers;
    if (number) {
      sessionNumbers = [number.replace(/[^0-9]/g, '')];
    } else {
      sessionNumbers = Array.from(activeSockets.keys());
    }
    if (!sessionNumbers.length) return res.status(400).send({ error: 'No active bot session — pass ?number= or connect a session first' });

    const parsed = parseChannelPollLink(link);
    if (!parsed) return res.status(400).send({ error: 'Could not parse that as a whatsapp.com/channel/... link' });

    // Resolve the channel jid + fetch the poll message ONCE using the first
    // available session — no need to repeat this per bot.
    const firstSocket = activeSockets.get(sessionNumbers[0]);
    if (!firstSocket) return res.status(404).send({ error: `No active session for ${sessionNumbers[0]}` });

    let jid, pollMsg;
    try {
      jid = await resolveNewsletterJidFromInvite(firstSocket, parsed.inviteCode);
      pollMsg = await findPollMessageInChannel(firstSocket, jid, parsed.inviteCode, parsed.serverId, extractNewsletterServerId);
    } catch (e) {
      console.error('[channelpollvote] resolve error:', e?.message || e);
      return res.status(500).send({ error: e.message || 'Failed to resolve poll message' });
    }

    const results = [];
    for (const sessionNumber of sessionNumbers) {
      const socket = activeSockets.get(sessionNumber);
      if (!socket) {
        results.push({ number: sessionNumber, ok: false, error: 'Session not active' });
        continue;
      }
      try {
        const result = await voteOnChannelPoll(socket, jid, pollMsg, voteNumber, jidNormalizedUser, extractNewsletterServerId);
        results.push({ number: sessionNumber, ok: true, votedOption: result.optionVoted });
      } catch (e) {
        console.error(`[channelpollvote] ${sessionNumber} error:`, e?.message || e);
        results.push({ number: sessionNumber, ok: false, error: e.message || 'Vote failed' });
      }
  
      await delay(800);
    }

    const votedCount = results.filter(r => r.ok).length;
    res.status(200).send({
      status: 'ok',
      jid,
      voted: votedCount,
      total: results.length,
      results
    });
  });
}

module.exports = { setupChannelPollVote };
