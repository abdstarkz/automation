export class SocialMediaService {
  // Facebook/Instagram (Meta)
  async postToFacebook(accessToken: string, pageId: string, message: string, imageUrl?: string) {
    const url = `https://graph.facebook.com/v18.0/${pageId}/feed`;
    
    const body: any = {
      message,
      access_token: accessToken,
    };

    if (imageUrl) {
      body.link = imageUrl;
    }

    const response = await fetch(url, {
      method: 'POST',
      body: new URLSearchParams(body),
    });

    if (!response.ok) {
      throw new Error(`Facebook post failed: ${response.statusText}`);
    }

    return await response.json();
  }

  async postToInstagram(accessToken: string, accountId: string, imageUrl: string, caption: string) {
    // Step 1: Create container
    const containerUrl = `https://graph.facebook.com/v18.0/${accountId}/media`;
    const containerResponse = await fetch(containerUrl, {
      method: 'POST',
      body: new URLSearchParams({
        image_url: imageUrl,
        caption,
        access_token: accessToken,
      }),
    });

    const containerData = await containerResponse.json();
    const creationId = containerData.id;

    // Step 2: Publish
    const publishUrl = `https://graph.facebook.com/v18.0/${accountId}/media_publish`;
    const publishResponse = await fetch(publishUrl, {
      method: 'POST',
      body: new URLSearchParams({
        creation_id: creationId,
        access_token: accessToken,
      }),
    });

    return await publishResponse.json();
  }

  async getMetaInsights(accessToken: string, pageId: string, metrics: string[]) {
    const url = `https://graph.facebook.com/v18.0/${pageId}/insights`;
    const params = new URLSearchParams({
      metric: metrics.join(','),
      access_token: accessToken,
    });

    const response = await fetch(`${url}?${params}`);
    return await response.json();
  }

  // Twitter/X
  async postToTwitter(consumerKey: string, consumerSecret: string, accessToken: string, accessSecret: string, text: string) {
    // Using Twitter API v2
    const OAuth = require('oauth-1.0a');
    const crypto = require('crypto');

    const oauth = OAuth({
      consumer: { key: consumerKey, secret: consumerSecret },
      signature_method: 'HMAC-SHA1',
      hash_function(baseString: string, key: string) {
        return crypto.createHmac('sha1', key).update(baseString).digest('base64');
      },
    });

    const requestData = {
      url: 'https://api.twitter.com/2/tweets',
      method: 'POST',
    };

    const token = { key: accessToken, secret: accessSecret };
    const headers = oauth.toHeader(oauth.authorize(requestData, token));

    const response = await fetch(requestData.url, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    return await response.json();
  }

  // LinkedIn
  async postToLinkedIn(accessToken: string, personUrn: string, text: string) {
    const url = 'https://api.linkedin.com/v2/ugcPosts';
    
    const body = {
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    return await response.json();
  }
}