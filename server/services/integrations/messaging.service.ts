export class MessagingService {
  // Discord
  async sendDiscord(webhookUrl: string, content: string, username?: string, embeds?: any[]) {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        username,
        embeds,
      }),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.statusText}`);
    }

    return { success: true };
  }

  // Telegram
  async sendTelegram(botToken: string, chatId: string, message: string, parseMode?: string) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: parseMode,
      }),
    });

    if (!response.ok) {
      throw new Error(`Telegram send failed: ${response.statusText}`);
    }

    return await response.json();
  }

  // Slack
  async sendSlack(token: string, channel: string, text: string, blocks?: any[]) {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel,
        text,
        blocks,
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      throw new Error(`Slack send failed: ${data.error}`);
    }

    return data;
  }

  async createSlackChannel(token: string, name: string, isPrivate = false) {
    const response = await fetch('https://slack.com/api/conversations.create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        is_private: isPrivate,
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      throw new Error(`Slack channel creation failed: ${data.error}`);
    }

    return data.channel;
  }

  // WhatsApp (via Twilio)
  async sendWhatsApp(accountSid: string, authToken: string, from: string, to: string, message: string) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
      body: new URLSearchParams({
        From: `whatsapp:${from}`,
        To: `whatsapp:${to}`,
        Body: message,
      }),
    });

    if (!response.ok) {
      throw new Error(`WhatsApp send failed: ${response.statusText}`);
    }

    return await response.json();
  }
}