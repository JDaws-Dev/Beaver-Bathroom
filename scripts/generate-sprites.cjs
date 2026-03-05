#!/usr/bin/env node
// Generate consistent beaver cosmetic sprites using OpenAI GPT Image Edit API
// Step 1: Generate ONE base beaver with DALL-E 3
// Step 2: Use gpt-image-1 edit API to create hat/color variants from that base
const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.OPENAI_API_KEY;
const OUT_DIR = path.join(__dirname, '..', 'public', 'images', 'cosmetics');
const BASE_PATH = path.join(OUT_DIR, 'hat-none.png');

fs.mkdirSync(OUT_DIR, { recursive: true });

// Step 1: Generate base beaver (hat-none / color-classic are the same base)
const BASE_PROMPT = `A cute cartoon beaver mascot character portrait, head and upper body visible. Round face, big warm brown eyes, prominent buck teeth with a friendly smile, rosy pink cheeks, small round ears on top. Classic warm brown fur. Simple flat illustration style with bold black outlines, solid light tan/cream background. Square composition, character centered and filling most of the frame. Game mascot style, appealing and charming. No hat, no accessories.`;

// Step 2: Edit variants - hats modify the top of the head, colors modify fur
const VARIANTS = [
  { id: 'hat-cap', prompt: 'Add a red baseball cap with a yellow letter "B" on the front to this beaver character. Keep everything else exactly the same - same face, same expression, same pose, same background.' },
  { id: 'hat-hardhat', prompt: 'Add a bright yellow construction safety hard hat on top of this beaver character\'s head. Keep everything else exactly the same - same face, same expression, same pose, same background.' },
  { id: 'hat-cowboy', prompt: 'Add a brown leather cowboy hat with a wide brim on top of this beaver character\'s head. Keep everything else exactly the same - same face, same expression, same pose, same background.' },
  { id: 'hat-chef', prompt: 'Add a tall white chef\'s toque (chef hat) on top of this beaver character\'s head. Keep everything else exactly the same - same face, same expression, same pose, same background.' },
  { id: 'hat-party', prompt: 'Add a colorful cone-shaped birthday party hat with polka dots and a pom-pom on top of this beaver character\'s head. Keep everything else exactly the same - same face, same expression, same pose, same background.' },
  { id: 'hat-crown', prompt: 'Add a shiny golden royal crown with red and blue jewels on top of this beaver character\'s head. Keep everything else exactly the same - same face, same expression, same pose, same background.' },
  { id: 'hat-tophat', prompt: 'Add a tall black top hat with a gold band on top of this beaver character\'s head. Keep everything else exactly the same - same face, same expression, same pose, same background.' },
  { id: 'color-golden', prompt: 'Change this beaver character\'s fur color from brown to a warm golden honey color, like a golden retriever. Keep everything else exactly the same - same face, same expression, same pose, same hat (none), same background, same art style.' },
  { id: 'color-texas', prompt: 'Change this beaver character\'s fur color from brown to bright burnt orange (Texas Longhorns orange). Keep everything else exactly the same - same face, same expression, same pose, same hat (none), same background, same art style.' },
  { id: 'color-midnight', prompt: 'Change this beaver character\'s fur color from brown to dark midnight blue-black. Keep everything else exactly the same - same face, same expression, same pose, same hat (none), same background, same art style.' },
  { id: 'color-albino', prompt: 'Change this beaver character\'s fur color from brown to pure white (albino), and make the eyes pinkish-red. Keep everything else exactly the same - same face, same expression, same pose, same hat (none), same background, same art style.' },
];

function generateBase() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'dall-e-3',
      prompt: BASE_PROMPT,
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
          if (json.error) return reject(new Error(json.error.message));
          resolve(json.data[0].url);
        } catch (e) {
          reject(new Error(`Parse error: ${data.slice(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function editImage(baseImagePath, prompt) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const imageData = fs.readFileSync(baseImagePath);

    // Build multipart form data
    const parts = [];

    // image file
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="image"; filename="base.png"\r\n` +
      `Content-Type: image/png\r\n\r\n`
    );
    parts.push(imageData);
    parts.push('\r\n');

    // prompt
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="prompt"\r\n\r\n` +
      `${prompt}\r\n`
    );

    // model
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="model"\r\n\r\n` +
      `gpt-image-1\r\n`
    );

    // size
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="size"\r\n\r\n` +
      `1024x1024\r\n`
    );

    parts.push(`--${boundary}--\r\n`);

    // Combine into buffer
    const buffers = parts.map(p => typeof p === 'string' ? Buffer.from(p) : p);
    const body = Buffer.concat(buffers);

    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/images/edits',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message));
          // gpt-image-1 returns base64 by default
          if (json.data[0].b64_json) {
            resolve({ type: 'base64', data: json.data[0].b64_json });
          } else if (json.data[0].url) {
            resolve({ type: 'url', data: json.data[0].url });
          } else {
            reject(new Error('No image data in response'));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${data.slice(0, 300)}`));
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
  if (!API_KEY) {
    console.error('Set OPENAI_API_KEY environment variable');
    process.exit(1);
  }

  // Step 1: Generate or reuse base beaver
  if (!fs.existsSync(BASE_PATH)) {
    console.log('Step 1: Generating base beaver (hat-none)...');
    try {
      const url = await generateBase();
      await downloadImage(url, BASE_PATH);
      console.log('Base beaver saved!\n');
    } catch (e) {
      console.error('Failed to generate base:', e.message);
      process.exit(1);
    }
  } else {
    console.log('Step 1: Base beaver already exists, reusing.\n');
  }

  // Copy base as color-classic (they're the same)
  const classicPath = path.join(OUT_DIR, 'color-classic.png');
  if (!fs.existsSync(classicPath)) {
    fs.copyFileSync(BASE_PATH, classicPath);
    console.log('Copied base as color-classic.\n');
  }

  // Step 2: Generate variants by editing the base
  console.log(`Step 2: Generating ${VARIANTS.length} variants from base...\n`);

  for (const variant of VARIANTS) {
    const outPath = path.join(OUT_DIR, `${variant.id}.png`);
    if (fs.existsSync(outPath)) {
      console.log(`Skip ${variant.id} — already exists`);
      continue;
    }
    console.log(`Editing: ${variant.id}...`);
    try {
      const result = await editImage(BASE_PATH, variant.prompt);
      if (result.type === 'base64') {
        fs.writeFileSync(outPath, Buffer.from(result.data, 'base64'));
      } else {
        await downloadImage(result.data, outPath);
      }
      console.log(`Done: ${variant.id}`);
    } catch (e) {
      console.error(`FAIL: ${variant.id} — ${e.message}`);
    }
    // Rate limit delay
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\nAll sprites saved to public/images/cosmetics/');
}

main();
