#!/usr/bin/env node
// Generate combo beaver cosmetic sprites using OpenAI GPT Image Edit API
// Produces: combo-{hat}-{shirt}.png for all hat×shirt combos
//           {acc-id}.png for accessory overlays
//           {special-id}.png for special full-look sprites
const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.OPENAI_API_KEY;
const OUT_DIR = path.join(__dirname, '..', 'public', 'images', 'cosmetics');
const BASE_PATH = path.join(OUT_DIR, 'base.png');

fs.mkdirSync(OUT_DIR, { recursive: true });

// Base beaver: head + upper body, plain red polo shirt, no hat
const BASE_PROMPT = `A cute cartoon beaver mascot character, head and upper body portrait. Round face, big warm brown eyes, prominent buck teeth with a friendly smile, rosy pink cheeks, small round ears on top of head. Classic warm brown fur. Wearing a plain red polo shirt. Simple flat illustration style with bold black outlines, solid light tan/cream background. Square composition, character centered. Game mascot style, appealing and charming. No hat, no accessories on head.`;

const KEEP_SAME = 'Keep everything else exactly the same - same face, same expression, same pose, same background, same art style.';

// === SHIRT EDITS: applied to base to create shirt variants ===
const SHIRTS = [
  { id: 'shirt-polo', prompt: `Make sure this beaver is wearing a red polo shirt with a collar. Also remove any hat from the head. ${KEEP_SAME}` },
  { id: 'shirt-none', prompt: `Remove the shirt from this beaver character so the beaver's bare brown fur chest is showing. No shirt, no clothing on body. Also remove any hat. ${KEEP_SAME}` },
  { id: 'shirt-artios', prompt: `Change this beaver's shirt to a white t-shirt with "ARTIOS" written in colorful letters on the front. Also remove any hat from the head. ${KEEP_SAME}` },
  { id: 'shirt-overalls', prompt: `Change this beaver's clothing to blue denim overalls with metal clasps over a white t-shirt. Also remove any hat from the head. ${KEEP_SAME}` },
  { id: 'shirt-hawaiian', prompt: `Change this beaver's shirt to a bright colorful Hawaiian shirt with tropical flowers and palm trees pattern. Also remove any hat from the head. ${KEEP_SAME}` },
  { id: 'shirt-lab-coat', prompt: `Change this beaver's clothing to a white laboratory coat over a blue shirt, like a scientist or health inspector. Also remove any hat from the head. ${KEEP_SAME}` },
  { id: 'shirt-camo', prompt: `Change this beaver's shirt to a military-style camouflage vest in green, brown and tan pattern. Also remove any hat from the head. ${KEEP_SAME}` },
  { id: 'shirt-flannel', prompt: `Change this beaver's shirt to a red and black plaid lumberjack flannel shirt. Also remove any hat from the head. ${KEEP_SAME}` },
  { id: 'shirt-raincoat', prompt: `Change this beaver's clothing to a bright yellow raincoat with buttons. Also remove any hat from the head. ${KEEP_SAME}` },
  { id: 'shirt-jersey', prompt: `Change this beaver's shirt to a sports jersey - red and white with number 82 on the front. Also remove any hat from the head. ${KEEP_SAME}` },
  { id: 'shirt-hoodie', prompt: `Change this beaver's shirt to a cozy gray hoodie sweatshirt with the hood down. Also remove any hat from the head. ${KEEP_SAME}` },
  { id: 'shirt-tuxedo', prompt: `Change this beaver's shirt to a formal black tuxedo vest with a white dress shirt and black bow tie. Also remove any hat from the head. ${KEEP_SAME}` },
];

// === HAT EDITS: applied on top of each shirt variant ===
const HATS = [
  { id: 'hat-none', prompt: `Remove any hat from this beaver character's head. The beaver should have no hat, just bare fur on top. ${KEEP_SAME}` },
  { id: 'hat-cap', prompt: `Add a red baseball cap with a yellow letter "B" on the front to this beaver character. ${KEEP_SAME}` },
  { id: 'hat-visor', prompt: `Add a white sun visor on this beaver character's head. The visor has a curved brim shading the eyes but no top, so the beaver's fur is visible on top. ${KEEP_SAME}` },
  { id: 'hat-hardhat', prompt: `Add a bright yellow construction safety hard hat on top of this beaver character's head. ${KEEP_SAME}` },
  { id: 'hat-beanie', prompt: `Add a cozy knitted red and white striped beanie/winter hat on this beaver character's head. ${KEEP_SAME}` },
  { id: 'hat-cowboy', prompt: `Add a brown leather cowboy hat with a wide brim on top of this beaver character's head. ${KEEP_SAME}` },
  { id: 'hat-sombrero', prompt: `Add a large colorful Mexican sombrero with festive embroidery on this beaver character's head. ${KEEP_SAME}` },
  { id: 'hat-chef', prompt: `Add a tall white chef's toque (chef hat) on top of this beaver character's head. ${KEEP_SAME}` },
  { id: 'hat-party', prompt: `Add a colorful cone-shaped birthday party hat with polka dots and a pom-pom on top to this beaver character's head. ${KEEP_SAME}` },
  { id: 'hat-viking', prompt: `Add a metal Viking helmet with curved horns on the sides on this beaver character's head. ${KEEP_SAME}` },
  { id: 'hat-crown', prompt: `Add a shiny golden royal crown with red and blue jewels on top of this beaver character's head. ${KEEP_SAME}` },
  { id: 'hat-tophat', prompt: `Add a tall black top hat with a gold band on top of this beaver character's head. ${KEEP_SAME}` },
];

// === ACCESSORIES: small overlay items generated separately ===
const ACCESSORIES = [
  { id: 'acc-sunglasses', prompt: `Generate a simple pair of cool black sunglasses, front view, floating on a plain transparent/white background. Flat cartoon style with bold black outlines. Just the sunglasses, nothing else. Game item icon style.` },
  { id: 'acc-bandana', prompt: `Generate a red cowboy bandana/kerchief, flat front view, floating on a plain transparent/white background. Flat cartoon style with bold black outlines. Just the bandana, nothing else. Game item icon style.` },
  { id: 'acc-bowtie', prompt: `Generate a fancy black bow tie, front view, floating on a plain transparent/white background. Flat cartoon style with bold black outlines. Just the bow tie, nothing else. Game item icon style.` },
  { id: 'acc-gold-chain', prompt: `Generate a thick gold chain necklace in a U shape, front view, floating on a plain transparent/white background. Flat cartoon style with bold black outlines. Just the chain, nothing else. Game item icon style.` },
  { id: 'acc-monocle', prompt: `Generate a round monocle with a thin gold chain, front view, floating on a plain transparent/white background. Flat cartoon style with bold black outlines. Just the monocle, nothing else. Game item icon style.` },
  { id: 'acc-headphones', prompt: `Generate large over-ear DJ headphones in black, front view, floating on a plain transparent/white background. Flat cartoon style with bold black outlines. Just the headphones, nothing else. Game item icon style.` },
  { id: 'acc-scarf', prompt: `Generate a cozy striped scarf in red and white, draped in a U shape, floating on a plain transparent/white background. Flat cartoon style with bold black outlines. Just the scarf, nothing else. Game item icon style.` },
  { id: 'acc-tool-belt', prompt: `Generate a brown leather tool belt with wrenches and screwdrivers, front view, floating on a plain transparent/white background. Flat cartoon style with bold black outlines. Just the belt, nothing else. Game item icon style.` },
];

// === SPECIAL: full outfit overrides, edited from base ===
const SPECIALS = [
  { id: 'special-superhero', prompt: `Transform this beaver into a superhero! Add a blue cape, a red mask over the eyes, and a yellow star emblem on the chest. ${KEEP_SAME}` },
  { id: 'special-disco', prompt: `Transform this beaver into a disco dancer! Add a shiny sequined jacket, an afro wig, and disco ball earrings. Flashy 70s style. ${KEEP_SAME}` },
  { id: 'special-santa', prompt: `Transform this beaver into Santa Claus! Add a red Santa hat with white trim, a white fluffy beard, and a red coat with white fur trim. ${KEEP_SAME}` },
  { id: 'special-uncle-sam', prompt: `Transform this beaver into Uncle Sam! Add a tall red-white-blue striped top hat with stars, and a blue coat with star-spangled vest. ${KEEP_SAME}` },
  { id: 'special-zombie', prompt: `Transform this beaver into a zombie! Make the fur grayish-green, add dark circles under glowing green eyes, torn clothing, and stitches on the face. ${KEEP_SAME}` },
  { id: 'special-astronaut', prompt: `Transform this beaver into an astronaut! Add a white space helmet with a reflective visor, and a white spacesuit with patches and tubes. ${KEEP_SAME}` },
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

    const parts = [];
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="image"; filename="base.png"\r\n` +
      `Content-Type: image/png\r\n\r\n`
    );
    parts.push(imageData);
    parts.push('\r\n');
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="prompt"\r\n\r\n` +
      `${prompt}\r\n`
    );
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="model"\r\n\r\n` +
      `gpt-image-1\r\n`
    );
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="size"\r\n\r\n` +
      `1024x1024\r\n`
    );
    parts.push(`--${boundary}--\r\n`);

    const buffers = parts.map(p => typeof p === 'string' ? Buffer.from(p) : p);
    const body = Buffer.concat(buffers);

    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/images/edits',
      method: 'POST',
      timeout: 120000,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString();
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message));
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
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out after 120s')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function generateDalle3(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'dall-e-3',
      prompt,
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

async function saveResult(result, outPath) {
  if (result.type === 'base64') {
    fs.writeFileSync(outPath, Buffer.from(result.data, 'base64'));
  } else {
    await downloadImage(result.data, outPath);
  }
}

const DELAY = 2000; // ms between API calls

async function main() {
  if (!API_KEY) {
    console.error('Set OPENAI_API_KEY environment variable');
    process.exit(1);
  }

  const mode = process.argv[2] || 'all'; // all, shirts, combos, accessories, specials

  // Step 1: Generate or reuse base beaver
  if (!fs.existsSync(BASE_PATH)) {
    console.log('Step 1: Generating base beaver...');
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

  // Step 2: Generate shirt base sprites (no hat, just shirt variant)
  if (mode === 'all' || mode === 'shirts') {
    console.log(`\nStep 2: Generating ${SHIRTS.length} shirt variants...\n`);
    for (const shirt of SHIRTS) {
      const outPath = path.join(OUT_DIR, `shirt-base-${shirt.id}.png`);
      if (fs.existsSync(outPath)) {
        console.log(`Skip ${shirt.id} base — already exists`);
        continue;
      }
      console.log(`Editing: ${shirt.id} base...`);
      try {
        const result = await editImage(BASE_PATH, shirt.prompt);
        await saveResult(result, outPath);
        console.log(`Done: ${shirt.id} base`);
      } catch (e) {
        console.error(`FAIL: ${shirt.id} base — ${e.message}`);
      }
      await new Promise(r => setTimeout(r, DELAY));
    }
  }

  // Step 3: Generate hat × shirt combos
  if (mode === 'all' || mode === 'combos') {
    const total = HATS.length * SHIRTS.length;
    let count = 0;
    console.log(`\nStep 3: Generating ${total} hat×shirt combo sprites...\n`);

    for (const shirt of SHIRTS) {
      const shirtBase = path.join(OUT_DIR, `shirt-base-${shirt.id}.png`);
      if (!fs.existsSync(shirtBase)) {
        console.log(`Skip combos for ${shirt.id} — shirt base not found`);
        count += HATS.length;
        continue;
      }

      for (const hat of HATS) {
        count++;
        const comboName = `combo-${hat.id}-${shirt.id}`;
        const outPath = path.join(OUT_DIR, `${comboName}.png`);
        if (fs.existsSync(outPath)) {
          console.log(`[${count}/${total}] Skip ${comboName} — exists`);
          continue;
        }
        console.log(`[${count}/${total}] ${comboName}...`);
        try {
          const result = await editImage(shirtBase, hat.prompt);
          await saveResult(result, outPath);
          console.log(`[${count}/${total}] Done: ${comboName}`);
        } catch (e) {
          console.error(`[${count}/${total}] FAIL: ${comboName} — ${e.message}`);
        }
        await new Promise(r => setTimeout(r, DELAY));
      }
    }
  }

  // Step 4: Generate accessory overlay icons
  if (mode === 'all' || mode === 'accessories') {
    console.log(`\nStep 4: Generating ${ACCESSORIES.length} accessory icons...\n`);
    for (const acc of ACCESSORIES) {
      const outPath = path.join(OUT_DIR, `${acc.id}.png`);
      if (fs.existsSync(outPath)) {
        console.log(`Skip ${acc.id} — already exists`);
        continue;
      }
      console.log(`Generating: ${acc.id}...`);
      try {
        const url = await generateDalle3(acc.prompt);
        await downloadImage(url, outPath);
        console.log(`Done: ${acc.id}`);
      } catch (e) {
        console.error(`FAIL: ${acc.id} — ${e.message}`);
      }
      await new Promise(r => setTimeout(r, DELAY));
    }
  }

  // Step 5: Generate special full-body sprites
  if (mode === 'all' || mode === 'specials') {
    console.log(`\nStep 5: Generating ${SPECIALS.length} special sprites...\n`);
    for (const spec of SPECIALS) {
      const outPath = path.join(OUT_DIR, `${spec.id}.png`);
      if (fs.existsSync(outPath)) {
        console.log(`Skip ${spec.id} — already exists`);
        continue;
      }
      console.log(`Editing: ${spec.id}...`);
      try {
        const result = await editImage(BASE_PATH, spec.prompt);
        await saveResult(result, outPath);
        console.log(`Done: ${spec.id}`);
      } catch (e) {
        console.error(`FAIL: ${spec.id} — ${e.message}`);
      }
      await new Promise(r => setTimeout(r, DELAY));
    }
  }

  console.log('\nAll done! Sprites saved to public/images/cosmetics/');
}

main();
