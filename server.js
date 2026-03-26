import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

app.post('/api/explore', async (req, res) => {
  const { city } = req.body;

  if (!city || typeof city !== 'string' || city.trim().length === 0) {
    return res.status(400).json({ error: 'Please provide a city name.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Demo mode: return mock data when no API key is configured
  if (!apiKey) {
    const cityName = city.trim();
    return res.json(getMockData(cityName));
  }

  const client = new Anthropic({ apiKey });

  const prompt = `You are an expert travel guide. For the city "${city.trim()}", provide travel recommendations in this exact JSON format (no markdown, raw JSON only):

{
  "city": "Full city name",
  "activities": [
    { "name": "...", "description": "...", "tip": "..." }
  ],
  "restaurants": [
    { "name": "...", "cuisine": "...", "description": "...", "tip": "..." }
  ],
  "walks": [
    { "name": "...", "distance": "...", "description": "...", "tip": "..." }
  ]
}

Rules:
- Provide exactly 5 items per category
- Keep descriptions to 1-2 sentences
- Tips should be practical and specific (best time to visit, booking advice, etc.)
- Only return the JSON, nothing else`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].text.trim();
    const data = JSON.parse(text);
    res.json(data);
  } catch (err) {
    if (err instanceof SyntaxError) {
      res.status(500).json({ error: 'Failed to parse AI response. Please try again.' });
    } else {
      res.status(500).json({ error: err.message || 'Something went wrong.' });
    }
  }
});

// ── Analytics page generator ────────────────────────────────────────────────
app.post('/api/analytics/generate', async (req, res) => {
  const { feature, goal } = req.body;

  if (!feature || !goal || typeof feature !== 'string' || typeof goal !== 'string') {
    return res.status(400).json({ error: 'feature and goal are required.' });
  }

  const slug = feature.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const analyticsDir = join(__dirname, 'public', 'analytics');
  const filePath = join(analyticsDir, `${slug}.html`);
  const publicUrl = `/analytics/${slug}.html`;

  // Page already exists — just return the link
  if (existsSync(filePath)) {
    return res.json({ exists: true, url: publicUrl, feature: feature.trim() });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: 'Set ANTHROPIC_API_KEY to generate analytics pages.' });
  }

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are an analytics page generator for a travel app called Travel AI.
Generate complete, self-contained HTML analytics pages for product features.

Design system (match exactly):
- Background: #f0f4f8 | Cards: white, border-radius:16px, box-shadow:0 2px 12px rgba(0,0,0,0.07)
- Primary blue: #1a56db | Dark blue: #0e3a8a | Amber: #d97706 | Green: #059669 | Purple: #7c3aed
- Font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- Header: gradient(135deg, #1a56db, #0e3a8a), white text, back link to ../index.html
- KPI cards: white, .kpi-label (0.8rem uppercase gray #718096), .kpi-value (2.2rem bold #1a202c), .kpi-sub (0.82rem #a0aec0)
- KPI grid: display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:1rem
- Charts grid: display:grid; grid-template-columns:1fr 1fr; gap:1.5rem (1fr on mobile)
- Chart.js: use CDN https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js

Page structure:
1. <header> with feature name, back link
2. .dashboard > .kpi-row (4-6 KPIs with seed numbers)
3. .charts-grid with 2-3 charts
4. A data note: "Demo data — connect your feature's event tracking to populate this with real user data"

Return ONLY the complete HTML document, nothing else.`;

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Feature: "${feature.trim()}"
Goal: "${goal.trim()}"

Generate an analytics page that tracks the most meaningful success metrics for this feature given its goal.
Include realistic seed data showing what healthy metrics look like.
Metrics should be specific to this exact feature and goal — not generic.`,
      }],
    });

    const html = message.content.find(b => b.type === 'text')?.text?.trim() ?? '';
    if (!html.startsWith('<!')) {
      throw new Error('Claude returned unexpected content');
    }

    mkdirSync(analyticsDir, { recursive: true });
    writeFileSync(filePath, html, 'utf8');

    res.json({ exists: false, url: publicUrl, feature: feature.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to generate analytics page.' });
  }
});

app.listen(PORT, () => {
  const mode = process.env.ANTHROPIC_API_KEY ? 'Live (Claude AI)' : 'Demo (mock data)';
  console.log(`Travel AI running at http://localhost:${PORT} — ${mode}`);
});

function getMockData(city) {
  return {
    city,
    activities: [
      { name: 'City History Museum', description: 'Explore centuries of local history through immersive exhibits and artefacts.', tip: 'Visit on weekday mornings to avoid crowds. Audio guides are free.' },
      { name: 'Central Cathedral', description: 'A stunning example of Gothic architecture dominating the city skyline.', tip: 'Climb the tower for panoramic views — book tickets online to skip the queue.' },
      { name: 'Old Town Quarter', description: 'Wander cobblestone streets lined with historic buildings and hidden courtyards.', tip: 'Join a free walking tour that departs from the main square at 10am and 2pm.' },
      { name: 'Contemporary Art Gallery', description: 'Rotating exhibitions showcasing the best of local and international modern art.', tip: 'First Sunday of the month is free entry for everyone.' },
      { name: 'Botanical Gardens', description: 'Over 5,000 plant species spread across beautifully landscaped themed gardens.', tip: 'The rose garden peaks in late spring — arrive early for the best light.' },
    ],
    restaurants: [
      { name: 'The Local Table', cuisine: 'Contemporary Local', description: 'Seasonal dishes made with produce sourced directly from nearby farms.', tip: 'Book at least a week ahead for weekend dinners — it fills up fast.' },
      { name: 'Spice Merchant', cuisine: 'Indian', description: 'Authentic regional curries and street food classics in a warm, buzzing atmosphere.', tip: 'The lunch thali is exceptional value and changes daily.' },
      { name: 'Harbour Fish & Grill', cuisine: 'Seafood', description: 'Fresh catch of the day served with a view of the waterfront.', tip: 'Sit outside on the terrace for the best views — request it when booking.' },
      { name: 'Pasta Nostra', cuisine: 'Italian', description: 'Hand-rolled pasta made fresh each morning paired with classic Italian wines.', tip: 'The truffle tagliatelle sells out quickly — ask if it is available when you arrive.' },
      { name: 'Night Market Bites', cuisine: 'Street Food', description: 'A lively food hall with vendors serving dishes from a dozen different cuisines.', tip: 'Busiest on Friday and Saturday evenings — go midweek for a relaxed experience.' },
    ],
    walks: [
      { name: 'Riverside Promenade', distance: '4 km loop', description: 'A flat, scenic path along the riverbank passing parks, bridges, and cafés.', tip: 'Best at sunrise or golden hour. Bikes can be hired at the main entrance.' },
      { name: 'Forest Hill Trail', distance: '7 km out & back', description: 'A gentle woodland trail rising to a hilltop viewpoint overlooking the city.', tip: 'Wear sturdy shoes after rain. The summit café is open weekends only.' },
      { name: 'Old City Walls Walk', distance: '3 km loop', description: 'Follow the original medieval city walls with interpretive signs along the way.', tip: 'Start at the North Gate — parking and bus stops nearby.' },
      { name: 'Canal Towpath Run', distance: '10 km one way', description: 'A flat, traffic-free path alongside the historic canal — ideal for runners.', tip: 'Run early to beat walkers and cyclists. Water fountains at km 3 and km 7.' },
      { name: 'Clifftop Coastal Path', distance: '5 km loop', description: 'Dramatic sea views along a well-maintained clifftop trail with wildflowers in season.', tip: 'Can be windy — bring a layer. Dogs welcome on leads.' },
    ],
  };
}
