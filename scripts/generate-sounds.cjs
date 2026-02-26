#!/usr/bin/env node
// Generate retro/cartoon sound effects using jsfxr-style synthesis
// Outputs small WAV files to public/sounds/

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'sounds');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// jsfxr-style parameters
// Shapes: 0=square, 1=sawtooth, 2=sine, 3=noise
function generateSound(params) {
  const sampleRate = params.sampleRate || 22050; // Lower sample rate for smaller files
  const {
    waveType = 0,
    attackTime = 0,
    sustainTime = 0.1,
    sustainPunch = 0,
    decayTime = 0.1,
    startFrequency = 440,
    minFrequency = 0,
    slide = 0,
    deltaSlide = 0,
    vibratoDepth = 0,
    vibratoSpeed = 0,
    changeAmount = 0,
    changeSpeed = 0,
    squareDuty = 0.5,
    dutySweep = 0,
    repeatSpeed = 0,
    phaserOffset = 0,
    phaserSweep = 0,
    lpFilterCutoff = 1,
    lpFilterCutoffSweep = 0,
    lpFilterResonance = 0,
    hpFilterCutoff = 0,
    hpFilterCutoffSweep = 0,
    masterVolume = 0.5,
  } = params;

  const totalTime = attackTime + sustainTime + decayTime;
  const numSamples = Math.floor(totalTime * sampleRate);
  const samples = new Float32Array(numSamples);

  let phase = 0;
  let frequency = startFrequency;
  let slideSpeed = slide;
  let vibratoPhase = 0;
  let envelopeTime = 0;
  let period = sampleRate / frequency;
  let duty = squareDuty;
  let phaserPos = 0;
  let phaserDelta = phaserSweep;
  let lpFilterPos = 0;
  let lpFilterDeltaPos = 0;
  let lpFilterCutoffVal = lpFilterCutoff;
  let hpFilterPos = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Envelope
    let envelope;
    if (t < attackTime) {
      envelope = t / attackTime;
    } else if (t < attackTime + sustainTime) {
      envelope = 1 + sustainPunch * (1 - (t - attackTime) / sustainTime);
    } else {
      envelope = 1 - (t - attackTime - sustainTime) / decayTime;
    }
    envelope = Math.max(0, Math.min(1, envelope));

    // Frequency slide
    slideSpeed += deltaSlide;
    frequency = Math.max(minFrequency, frequency * (1 + slideSpeed));

    // Vibrato
    const vibrato = 1 + vibratoDepth * Math.sin(vibratoPhase);
    vibratoPhase += vibratoSpeed;

    period = sampleRate / (frequency * vibrato);

    // Duty cycle sweep
    duty = Math.max(0, Math.min(0.5, duty + dutySweep));

    // Generate waveform
    let sample;
    const pos = phase / period;

    switch (waveType) {
      case 0: // Square
        sample = pos < duty ? 0.5 : -0.5;
        break;
      case 1: // Sawtooth
        sample = 1 - 2 * pos;
        break;
      case 2: // Sine
        sample = Math.sin(2 * Math.PI * pos);
        break;
      case 3: // Noise
        sample = Math.random() * 2 - 1;
        break;
      default:
        sample = 0;
    }

    phase++;
    if (phase >= period) {
      phase -= period;
    }

    // Low-pass filter
    lpFilterCutoffVal = Math.max(0, Math.min(1, lpFilterCutoffVal + lpFilterCutoffSweep));
    const lpf = lpFilterCutoffVal * lpFilterCutoffVal;
    lpFilterDeltaPos += (sample - lpFilterPos) * lpf;
    lpFilterDeltaPos *= 1 - Math.sqrt(lpFilterResonance) * 0.1;
    lpFilterPos += lpFilterDeltaPos;

    // High-pass filter
    hpFilterPos += lpFilterPos - hpFilterPos;
    sample = lpFilterPos - hpFilterPos;

    // Apply envelope and master volume
    samples[i] = sample * envelope * masterVolume;
  }

  return { samples, sampleRate };
}

// Create WAV file from samples
function createWav(samples, sampleRate) {
  const numSamples = samples.length;
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * bytesPerSample;
  const bufferSize = 44 + dataSize;

  const buffer = Buffer.alloc(bufferSize);
  let offset = 0;

  // RIFF header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(bufferSize - 8, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;

  // fmt chunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;  // chunk size
  buffer.writeUInt16LE(1, offset); offset += 2;   // PCM format
  buffer.writeUInt16LE(1, offset); offset += 2;   // mono
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bytesPerSample * 8, offset); offset += 2;

  // data chunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  // Write samples
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = Math.floor(s * 32767);
    buffer.writeInt16LE(val, offset);
    offset += 2;
  }

  return buffer;
}

// Sound definitions - distinct cartoony sounds
const sounds = {
  // UI click - short snappy
  click: {
    waveType: 0,
    attackTime: 0,
    sustainTime: 0.02,
    decayTime: 0.05,
    startFrequency: 800,
    slide: -0.3,
    masterVolume: 0.4,
  },

  // Plunge - comedic suction "SPLOP" (tight)
  plunge: {
    waveType: 2,
    attackTime: 0,
    sustainTime: 0.05,
    decayTime: 0.09,
    startFrequency: 200,
    minFrequency: 40,
    slide: -0.65,
    masterVolume: 0.6,
  },

  // Scrub - spray/wipe sound (shorter)
  scrub: {
    waveType: 3,
    attackTime: 0.01,
    sustainTime: 0.06,
    decayTime: 0.06,
    startFrequency: 4000,
    lpFilterCutoff: 0.3,
    masterVolume: 0.35,
  },

  // Mop - squeaky rubber
  mop: {
    waveType: 2,
    attackTime: 0,
    sustainTime: 0.04,
    decayTime: 0.06,
    startFrequency: 900,
    slide: 0.4,
    vibratoDepth: 0.15,
    vibratoSpeed: 0.3,
    masterVolume: 0.4,
  },

  // Restock - paper rustle + thunk (shorter)
  restock: {
    waveType: 3,
    attackTime: 0,
    sustainTime: 0.04,
    decayTime: 0.08,
    startFrequency: 3000,
    lpFilterCutoff: 0.5,
    hpFilterCutoff: 0.1,
    masterVolume: 0.3,
  },

  // Flush - whooshing water (tight)
  flush: {
    waveType: 3,
    attackTime: 0.01,
    sustainTime: 0.08,
    decayTime: 0.08,
    startFrequency: 400,
    minFrequency: 100,
    slide: -0.35,
    lpFilterCutoff: 0.4,
    lpFilterCutoffSweep: -0.005,
    masterVolume: 0.5,
  },

  // Stall clean fanfare - triumphant ascending (tight)
  clean: {
    waveType: 2,
    attackTime: 0,
    sustainTime: 0.06,
    decayTime: 0.08,
    startFrequency: 523,
    slide: 0.3,
    masterVolume: 0.5,
  },

  // Task complete - quick positive (shorter)
  complete: {
    waveType: 2,
    attackTime: 0,
    sustainTime: 0.04,
    decayTime: 0.07,
    startFrequency: 700,
    slide: 0.3,
    masterVolume: 0.4,
  },

  // Combo milestone - powerful ascending (compact)
  combo: {
    waveType: 0,
    attackTime: 0,
    sustainTime: 0.05,
    decayTime: 0.1,
    startFrequency: 400,
    slide: 0.4,
    sustainPunch: 0.35,
    masterVolume: 0.5,
  },

  // Bad/error - low warning (compact)
  bad: {
    waveType: 1,
    attackTime: 0,
    sustainTime: 0.05,
    decayTime: 0.1,
    startFrequency: 200,
    slide: -0.18,
    masterVolume: 0.5,
  },

  // Urgent beep
  urgent: {
    waveType: 0,
    attackTime: 0,
    sustainTime: 0.04,
    decayTime: 0.04,
    startFrequency: 800,
    slide: -0.2,
    masterVolume: 0.35,
  },

  // Customer happy (tight)
  happy: {
    waveType: 2,
    attackTime: 0,
    sustainTime: 0.04,
    decayTime: 0.07,
    startFrequency: 600,
    slide: 0.28,
    masterVolume: 0.4,
  },

  // Customer disgusted (compact)
  disgusted: {
    waveType: 1,
    attackTime: 0,
    sustainTime: 0.06,
    decayTime: 0.08,
    startFrequency: 150,
    slide: -0.1,
    vibratoDepth: 0.15,
    vibratoSpeed: 0.2,
    masterVolume: 0.4,
  },

  // Inspector warning (compact)
  inspector: {
    waveType: 2,
    attackTime: 0.01,
    sustainTime: 0.05,
    decayTime: 0.08,
    startFrequency: 600,
    slide: 0.25,
    masterVolume: 0.45,
  },

  // VIP fanfare (compact)
  vip: {
    waveType: 0,
    attackTime: 0,
    sustainTime: 0.06,
    decayTime: 0.08,
    startFrequency: 784,
    slide: 0.18,
    sustainPunch: 0.3,
    masterVolume: 0.5,
  },

  // Coin earned
  coin: {
    waveType: 2,
    attackTime: 0,
    sustainTime: 0.03,
    decayTime: 0.08,
    startFrequency: 1200,
    slide: 0.1,
    masterVolume: 0.35,
  },

  // Powerup activate (shorter)
  powerup: {
    waveType: 0,
    attackTime: 0,
    sustainTime: 0.05,
    decayTime: 0.1,
    startFrequency: 300,
    slide: 0.6,
    sustainPunch: 0.25,
    masterVolume: 0.5,
  },

  // Door creak (shorter)
  door: {
    waveType: 2,
    attackTime: 0.01,
    sustainTime: 0.05,
    decayTime: 0.08,
    startFrequency: 180,
    slide: 0.35,
    vibratoDepth: 0.25,
    vibratoSpeed: 0.25,
    masterVolume: 0.3,
  },
};

// Generate all sounds
let totalSize = 0;
console.log('Generating sound effects...\n');

for (const [name, params] of Object.entries(sounds)) {
  const { samples, sampleRate } = generateSound(params);
  const wav = createWav(samples, sampleRate);
  const filename = path.join(OUTPUT_DIR, `${name}.wav`);
  fs.writeFileSync(filename, wav);
  totalSize += wav.length;
  console.log(`  ${name}.wav - ${(wav.length / 1024).toFixed(1)} KB`);
}

console.log(`\nTotal: ${(totalSize / 1024).toFixed(1)} KB (${Object.keys(sounds).length} sounds)`);
console.log('Done!');
