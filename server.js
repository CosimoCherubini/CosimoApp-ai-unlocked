import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
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
