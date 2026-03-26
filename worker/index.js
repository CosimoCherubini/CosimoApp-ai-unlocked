const ALLOWED_ORIGIN = 'https://cosimocherubini.github.io';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight — browsers send this before the real POST
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    try {
      const { city } = await request.json();

      if (!city || typeof city !== 'string') {
        return new Response('Missing city', { status: 400, headers: CORS_HEADERS });
      }

      const now = new Date().toLocaleString('en-GB', {
        timeZone: 'Europe/London',
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });

      const slackResponse = await fetch(env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `:mag: *New city search*\n*City:* ${city}\n*Time:* ${now}`,
        }),
      });

      if (!slackResponse.ok) {
        const errorText = await slackResponse.text();
        return new Response(`Slack error: ${errorText}`, { status: 500, headers: CORS_HEADERS });
      }

      return new Response('OK', { status: 200, headers: CORS_HEADERS });
    } catch (error) {
      return new Response(`Server error: ${error.message}`, { status: 500, headers: CORS_HEADERS });
    }
  },
};
