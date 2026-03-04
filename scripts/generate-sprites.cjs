#!/usr/bin/env node
// Generate beaver cosmetic sprites using OpenAI DALL-E
const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.OPENAI_API_KEY;
const OUT_DIR = path.join(__dirname, '..', 'public', 'images', 'cosmetics');

// Ensure output directory exists
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE_STYLE = `A cute cartoon beaver mascot character, round face, big brown eyes, buck teeth, pink cheeks, friendly expression. Simple flat illustration style with bold outlines, suitable for a mobile game icon. Transparent/solid color background. Square composition, centered.`;

const SPRITES = [
  { id: 'hat-none', prompt: `${BASE_STYLE} The beaver has no hat, just its natural brown fur.` },
  { id: 'hat-cap', prompt: `${BASE_STYLE} The beaver is wearing a red baseball cap with a yellow "B" on front.` },
  { id: 'hat-hardhat', prompt: `${BASE_STYLE} The beaver is wearing a bright yellow construction hard hat.` },
  { id: 'hat-cowboy', prompt: `${BASE_STYLE} The beaver is wearing a brown leather cowboy hat with a wide brim.` },
  { id: 'hat-chef', prompt: `${BASE_STYLE} The beaver is wearing a tall white chef's toque hat.` },
  { id: 'hat-party', prompt: `${BASE_STYLE} The beaver is wearing a colorful party hat with confetti.` },
  { id: 'hat-crown', prompt: `${BASE_STYLE} The beaver is wearing a shiny golden royal crown with jewels.` },
  { id: 'hat-tophat', prompt: `${BASE_STYLE} The beaver is wearing a tall black top hat with a gold band.` },
  { id: 'color-classic', prompt: `${BASE_STYLE} The beaver has classic warm brown fur.` },
  { id: 'color-golden', prompt: `${BASE_STYLE} The beaver has golden honey-colored fur, like a golden retriever.` },
  { id: 'color-texas', prompt: `${BASE_STYLE} The beaver has bright burnt orange fur, Texas Longhorns orange.` },
  { id: 'color-midnight', prompt: `${BASE_STYLE} The beaver has dark midnight blue-black fur with a mysterious look.` },
  { id: 'color-albino', prompt: `${BASE_STYLE} The beaver has pure white albino fur with pink eyes and nose.` },
];

function generateImage(sprite) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'dall-e-3',
      prompt: sprite.prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/images/generations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message));
            return;
          }
          const url = json.data[0].url;
          resolve(url);
        } catch (e) {
          reject(new Error(`Parse error: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
      }
      const stream = fs.createWriteStream(filepath);
      res.pipe(stream);
      stream.on('finish', () => { stream.close(); resolve(); });
      stream.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log(`Generating ${SPRITES.length} beaver sprites...`);
  console.log(`Output: ${OUT_DIR}\n`);

  for (const sprite of SPRITES) {
    const outPath = path.join(OUT_DIR, `${sprite.id}.png`);
    if (fs.existsSync(outPath)) {
      console.log(`⏭️  ${sprite.id} — already exists, skipping`);
      continue;
    }
    console.log(`🎨 Generating ${sprite.id}...`);
    try {
      const url = await generateImage(sprite);
      await downloadImage(url, outPath);
      console.log(`✅ ${sprite.id} saved`);
    } catch (e) {
      console.error(`❌ ${sprite.id} failed: ${e.message}`);
    }
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\nDone! Sprites saved to public/images/cosmetics/');
}

main();
