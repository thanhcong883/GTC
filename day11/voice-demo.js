/**
 * voice-demo.js — ElevenLabs TTS API demo
 * 
 * Demonstrates the first step of the Video Generation pipeline:
 * Text-to-Speech with Word-Level Timestamps (the "Master Clock").
 *
 * This script does NOT run automatically. It requires:
 *   1. An ElevenLabs API key (set as ELEVENLABS_API_KEY env var)
 *   2. Node.js 18+
 *
 * Usage:
 *   set ELEVENLABS_API_KEY=your_key_here
 *   node voice-demo.js
 *
 * What it does:
 *   - Sends one scene's dialogue_vi to ElevenLabs TTS API
 *   - Receives audio + word-level timestamps
 *   - Saves audio as .mp3
 *   - Prints timestamps (the Master Clock that drives Avatar + Subtitles)
 *
 * Cost: ~$0.005 for 120 characters (Vietnamese, Flash v2.5 model)
 */

const VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // ElevenLabs "Rachel" default voice
const MODEL_ID = "eleven_flash_v2_5";      // Flash v2.5: lowest latency, $0.05/1k chars

// One scene from the VéXe example Cut (sc-01)
const DIALOGUE = "Tết năm ngoái, cứ mười người về quê thì gần bốn người không mua nổi tấm vé.";

async function main() {
  const API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!API_KEY) {
    console.error("❌  Set ELEVENLABS_API_KEY environment variable first.");
    console.error("    Example: set ELEVENLABS_API_KEY=sk_...");
    process.exit(1);
  }

  console.log("🔊  Voice Demo — ElevenLabs TTS with Word-Level Timestamps");
  console.log("─".repeat(60));
  console.log(`   Text:  "${DIALOGUE}"`);
  console.log(`   Model: ${MODEL_ID}`);
  console.log(`   Voice: ${VOICE_ID}`);
  console.log("─".repeat(60));

  // ── Step 1: Call TTS API with timestamps ──────────────────────
  console.log("\n⏳  Calling ElevenLabs API...");
  const startTime = Date.now();

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": API_KEY,
      },
      body: JSON.stringify({
        text: DIALOGUE,
        model_id: MODEL_ID,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  const latencyMs = Date.now() - startTime;

  if (!response.ok) {
    const err = await response.text();
    console.error(`❌  API error ${response.status}: ${err}`);
    process.exit(1);
  }

  const data = await response.json();

  // ── Step 2: Save audio ────────────────────────────────────────
  const fs = require("fs");
  const audioBuffer = Buffer.from(data.audio_base64, "base64");
  const audioPath = "sc-01-voice.mp3";
  fs.writeFileSync(audioPath, audioBuffer);

  // ── Step 3: Print Word-Level Timestamps (the Master Clock) ───
  console.log(`✅  Done in ${latencyMs}ms`);
  console.log(`📁  Audio saved: ${audioPath} (${audioBuffer.length} bytes)`);
  console.log(`\n🕐  Word-Level Timestamps (Master Clock):`);
  console.log("─".repeat(60));
  console.log("   Start    End      Word");
  console.log("─".repeat(60));

  if (data.alignment && data.alignment.characters) {
    // ElevenLabs returns character-level alignment; 
    // we aggregate into word boundaries
    const chars = data.alignment.characters;
    const starts = data.alignment.character_start_times_seconds;
    const ends = data.alignment.character_end_times_seconds;

    let wordStart = starts[0];
    let currentWord = "";
    const words = [];

    for (let i = 0; i < chars.length; i++) {
      if (chars[i] === " " || i === chars.length - 1) {
        if (i === chars.length - 1 && chars[i] !== " ") {
          currentWord += chars[i];
        }
        if (currentWord.trim()) {
          words.push({
            word: currentWord.trim(),
            start: wordStart,
            end: ends[i === chars.length - 1 ? i : i - 1],
          });
        }
        currentWord = "";
        wordStart = i + 1 < starts.length ? starts[i + 1] : 0;
      } else {
        currentWord += chars[i];
      }
    }

    words.forEach((w) => {
      console.log(
        `   ${w.start.toFixed(3).padStart(6)}s  ${w.end.toFixed(3).padStart(6)}s  ${w.word}`
      );
    });

    // Save timestamps as JSON for downstream use
    const tsPath = "sc-01-timestamps.json";
    fs.writeFileSync(tsPath, JSON.stringify(words, null, 2));
    console.log(`\n📁  Timestamps saved: ${tsPath}`);
  } else {
    console.log("   (Timestamps format may vary — check API response)");
    const tsPath = "sc-01-api-response.json";
    fs.writeFileSync(tsPath, JSON.stringify(data, null, 2));
    console.log(`📁  Full API response saved: ${tsPath}`);
  }

  // ── Step 4: Summary ───────────────────────────────────────────
  console.log("\n" + "─".repeat(60));
  console.log("📊  Summary:");
  console.log(`    Latency:    ${latencyMs}ms (API round-trip)`);
  console.log(`    Characters: ${DIALOGUE.length}`);
  console.log(`    Est. cost:  $${(DIALOGUE.length / 1000 * 0.05).toFixed(4)}`);
  console.log("─".repeat(60));
  console.log("\n💡  Next steps in the pipeline:");
  console.log("    1. Send sc-01-voice.mp3 to HeyGen → get avatar video");
  console.log("    2. Use sc-01-timestamps.json → generate .ass subtitle file");
  console.log("    3. FFmpeg: merge audio + avatar + subtitles → sc-01.mp4");
}

main().catch(console.error);
