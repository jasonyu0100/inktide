#!/usr/bin/env node
/**
 * Generate character portraits and location establishing shots for all seed narratives
 * using Replicate's Seedream 5.0 Lite model.
 *
 * Usage:
 *   node scripts/generate-seed-assets.mjs                  # generate all
 *   node scripts/generate-seed-assets.mjs --seed hp        # one seed only
 *   node scripts/generate-seed-assets.mjs --type characters # characters only
 *   node scripts/generate-seed-assets.mjs --dry-run         # preview prompts
 *   node scripts/generate-seed-assets.mjs --patch           # patch seed TS files with imageUrl paths
 *
 * Generates in batches of 8 with up to 3 retries per image.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "seed-assets");

const MODEL = "bytedance/seedream-4.5";
const API_BASE = `https://api.replicate.com/v1/models/${MODEL}/predictions`;
const POLL_INTERVAL = 2000;
const BATCH_SIZE = 4;
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;
const NO_TEXT_SUFFIX = ", no text, no letters, no words, no watermarks";

// ── Style per seed ───────────────────────────────────────────────────────────

const STYLES = {
  hp: "Whimsical storybook illustration, warm golden candlelight, rich jewel tones, soft painterly textures, magical realism with a cozy British boarding-school atmosphere,",
  sw: "Cinematic sci-fi concept art, bold chiaroscuro lighting, industrial metallic surfaces, deep space blues and Imperial greys, 1970s retro-futurism meets Ralph McQuarrie production paintings,",
  got: "Dark medieval fantasy, gritty photorealism, muted earth tones and firelight, rain-slicked stone and forged steel, HBO-inspired cinematic drama with desaturated palette,",
  lotr: "Epic high fantasy oil painting, luminous golden-hour light, sweeping landscapes, Pre-Raphaelite detail, Alan Lee and John Howe inspired, mythic grandeur with earthy natural tones,",
  ri: "Dark Chinese xianxia ink-wash painting with digital colour, sharp angular compositions, crimson and black accents, venomous insects and jade-green Gu energy, cold ruthless atmosphere,",
};

// ── Characters ───────────────────────────────────────────────────────────────

const CHARACTERS = {
  hp: [
    { id: "C-HP-01", prompt: "Fantasy character with untidy jet-black hair, bright green eyes behind round wire-rimmed glasses, and a lightning-bolt scar on the forehead. Wearing an oversized hand-me-down jumper, looking small but alert, standing in a candlelit stone corridor." },
    { id: "C-HP-02", prompt: "Fantasy scholar character with bushy brown hair, bright brown eyes, and slightly large front teeth, carrying an armful of heavy leather-bound books. Wearing crisp wizard academy robes with a crimson and gold striped tie, expression earnest and determined." },
    { id: "C-HP-03", prompt: "Fantasy character with flaming red hair, freckles across a long nose, tall and lanky build. Wearing slightly shabby second-hand wizard robes, with a warm lopsided grin, standing in a medieval castle hallway." },
    { id: "C-HP-04", prompt: "A tall, thin, very old wizard with a long silver beard and half-moon spectacles perched on a crooked nose. He wears sweeping purple robes embroidered with silver stars, his blue eyes twinkling with quiet amusement." },
    { id: "C-HP-05", prompt: "A thin man with sallow skin, a large hooked nose, and greasy shoulder-length black hair that frames his gaunt face. He wears billowing black robes and regards the world with cold, glittering dark eyes." },
    { id: "C-HP-06", prompt: "An enormous man nearly twice the height of a normal person, with a wild tangle of bushy black hair and a thick, matted beard that hides most of his face. He wears a massive moleskin overcoat with countless pockets, his beetle-black eyes crinkling warmly." },
    { id: "C-HP-07", prompt: "Fantasy aristocrat character with sleek white-blond hair combed neatly back, pale pointed features, and cold grey eyes. Wearing immaculate expensive-looking wizard academy robes with a silver serpent crest, carrying themselves with a haughty sneer." },
    { id: "C-HP-08", prompt: "A pale, nervous professor with a large purple turban wound around his head and a twitchy, stammering manner. His face is pinched and anxious, wearing dark wizard robes that smell faintly of garlic." },
  ],
  sw: [
    { id: "C-SW-01", prompt: "Young adult man with shaggy sandy-blond hair, bright blue eyes, and a sun-weathered face; wearing a loose white tunic and utility belt, standing in harsh desert light with twin suns low on the horizon." },
    { id: "C-SW-02", prompt: "Regal young woman with dark brown hair styled in twin buns on either side of her head, large expressive brown eyes, and a commanding bearing; wearing a flowing white senatorial gown with a silver belt and hood draped at her shoulders." },
    { id: "C-SW-03", prompt: "Ruggedly handsome man in his early thirties with tousled brown hair, a crooked grin, and sharp hazel eyes; wearing a white shirt open at the collar, a black vest, low-slung holster on his hip, and weathered smuggler boots." },
    { id: "C-SW-04", prompt: "Towering armored figure in all-black with a sweeping cape, a glossy black helmet with angular cheekplates and a skull-like respirator mask; chest panel of blinking lights and controls, mechanical breathing echoing in dim corridor light." },
    { id: "C-SW-05", prompt: "Weathered older man with a neatly trimmed grey-white beard, kind blue-grey eyes lined with decades of exile, and deep sun creases; wearing sand-colored Jedi robes with a rough-woven hooded cloak, standing in golden desert light." },
    { id: "C-SW-06", prompt: "Squat cylindrical astromech droid with a domed silver-and-blue head, a single glowing red photoreceptor eye, white-and-blue paneled body, and stubby tripod legs; scuffed and sand-dusted from desert travel." },
    { id: "C-SW-07", prompt: "Gaunt, sharp-featured man with hollow cheeks, piercing cold grey eyes, and slicked-back grey hair; wearing a crisp olive-green Imperial officer uniform with rank insignia cylinders on the chest, standing in the sterile light of a command bridge." },
    { id: "C-SW-08", prompt: "Massive seven-foot-tall Wookiee covered in shaggy brown fur with streaks of auburn; deep-set dark eyes beneath a heavy brow, a leather bandolier slung across his chest, and powerful long arms at his sides." },
  ],
  got: [
    { id: "C-GOT-01", prompt: "Stern-faced man in his late thirties with long dark brown hair and solemn grey eyes, short beard, wearing fur-lined leather armor and a heavy grey wool cloak, northern medieval lord with a greatsword at his back" },
    { id: "C-GOT-02", prompt: "Strikingly beautiful woman with golden blonde hair worn in elaborate braids, sharp green eyes and high cheekbones, crimson and gold silk gown with lion embroidery, regal and calculating expression, medieval queen" },
    { id: "C-GOT-03", prompt: "Dwarfed man with a large head, mismatched green and black eyes, and a mane of pale blonde hair, sharp sardonic features, dressed in rich crimson doublet with gold trim, intelligent and world-weary expression" },
    { id: "C-GOT-04", prompt: "Regal young woman with silver-white hair and striking violet eyes, delicate features and pale skin, wearing flowing pale blue and cream silks in an eastern style, vulnerable yet commanding bearing, exiled fantasy princess" },
    { id: "C-GOT-05", prompt: "Lean young man with dark curly hair and brooding dark grey eyes, clean-shaven with a long solemn face, wearing black leather and fur armor of a northern watch garrison, a white direwolf at his side" },
    { id: "C-GOT-06", prompt: "Slight, sharp-featured man with a pointed chin and dark hair greying at the temples, a thin mocking smile, wearing a fine dark grey doublet with a silver mockingbird pin, cunning eyes that miss nothing" },
    { id: "C-GOT-07", prompt: "Massive, barrel-chested man gone to fat with a thick black beard and blue eyes, flushed ruddy face, wearing a gold crown and black and gold doublet straining at the seams, a once-great warrior in decline" },
    { id: "C-GOT-08", prompt: "Scrappy, fierce-looking fantasy character with a long face, grey eyes, and tangled dark brown hair, wearing a dirt-smudged tunic and breeches, defiant expression, a thin rapier-like sword at the hip, wild and untamed energy" },
  ],
  lotr: [
    { id: "C-LOTR-01", prompt: "A small hobbit fantasy creature with pale skin, large expressive blue eyes, and dark curly hair. Slight build with pointed ears, wearing a mithril shirt beneath a weathered green cloak, a glowing ring on a chain around the neck." },
    { id: "C-LOTR-02", prompt: "A tall, elderly wizard with a long grey beard, bushy eyebrows, and keen eyes beneath a wide-brimmed pointed grey hat. He wears flowing grey robes and carries a gnarled wooden staff, pipe smoke curling around him." },
    { id: "C-LOTR-03", prompt: "A tall, weather-beaten Ranger with shoulder-length dark hair, grey eyes, and a short beard. He wears a worn leather jerkin over travel-stained clothing, a broken ancient sword at his side, his expression stern and watchful." },
    { id: "C-LOTR-04", prompt: "A stout, sturdy hobbit creature with a round honest face, sandy-brown curly hair, pointed ears, and warm brown eyes. Wearing simple gardener's clothes — a brown waistcoat and rolled sleeves — with a heavy pack and a coil of Elvish rope." },
    { id: "C-LOTR-05", prompt: "A tall, broad-shouldered warrior with proud features, a strong jaw, and reddish-brown hair. He wears the plate and leather armor of Gondor, a cloven silver horn at his belt, and carries a great round shield." },
    { id: "C-LOTR-06", prompt: "A tall, slender Elf with long straight golden hair, bright blue eyes, and ageless, fair features. He wears forest-green and brown woodland garb, a longbow slung across his back, moving with preternatural grace." },
    { id: "C-LOTR-07", prompt: "A stocky, powerfully built Dwarf with a thick red beard braided with iron clasps, fierce dark eyes beneath a heavy brow, and a gleaming steel helm. He wears chainmail and carries a broad-bladed battle axe." },
    { id: "C-LOTR-08", prompt: "A tall, imposing wizard with a long white beard, a high forehead, and dark calculating eyes. He wears robes that shimmer with many colors beneath the white, and carries a black iron staff topped with a sharp spike." },
  ],
  ri: [
    { id: "C-01", prompt: "A lean figure with sharp angular features and flat black eyes that betray no emotion — thin lips, high cheekbones, coarse dark hair tied loosely back, wearing a faded grey Gu Yue clan robe with frayed hems, posture deliberately unremarkable." },
    { id: "C-02", prompt: "A round-faced figure with warm brown eyes and short-cropped black hair — softer features, wearing a clean Gu Yue clan robe with neat creases, expression open and trusting, standing in a misty mountain village." },
    { id: "C-03", prompt: "An aged clan patriarch with a weathered, deeply lined face, thin white beard reaching his chest, and sharp narrow eyes under heavy brows — wearing layered ceremonial robes of dark green silk with silver clan insignia, his bearing upright despite his years." },
    { id: "C-04", prompt: "A strikingly beautiful figure with ice-white skin, pale silver-blue hair falling straight past the shoulders, and cold crystalline eyes that shimmer faintly — features almost too perfect, wearing pristine white robes with frost-blue trim, an aura of frigid detachment." },
    { id: "C-05", prompt: "A composed middle-aged woman with kind but perceptive eyes, hair pulled into a neat bun secured with a wooden pin, wearing a modest dark-blue instructor robe — her hands calloused from years of Gu cultivation demonstrations, expression patient and watchful." },
    { id: "C-06", prompt: "A stocky, thick-necked elder with a broad jaw, calculating small eyes, and a neatly trimmed black beard flecked with grey — wearing dark olive robes of fine material that suggest wealth beyond his station, his smile wide but never reaching his eyes." },
    { id: "C-07", prompt: "A wiry, sun-darkened wandering Gu Master with tangled hair, a jagged scar across one cheek, and restless hungry eyes — wearing patched leather traveling clothes and a belt hung with pouches and crude Gu containers, the look of someone who has lived rough for years." },
    { id: "C-08", prompt: "A stern young woman with a square jaw, fierce dark eyes, and black hair bound tightly under a bronze hairpiece — wearing polished righteous-path sect armor over layered robes, her posture rigid and alert, a dao sword strapped across her back." },
  ],
};

// ── Locations ────────────────────────────────────────────────────────────────

const LOCATIONS = {
  hp: [
    { id: "L-HP-01", prompt: "A misty, rain-swept British landscape with hidden magical enclaves tucked behind ordinary facades — cobblestone lanes, enchanted shopfronts, and owls gliding through grey skies over rolling green countryside." },
    { id: "L-HP-02", prompt: "A vast medieval castle with soaring towers, turrets, and battlements perched on a cliff above a dark lake, its hundreds of windows glowing warmly against a starlit Scottish Highland sky." },
    { id: "L-HP-03", prompt: "A painfully ordinary 1980s suburban semi-detached house on a manicured cul-de-sac — identical hedges, a polished car in the driveway, net curtains, and an oppressive air of enforced normality under flat grey skies." },
    { id: "L-HP-04", prompt: "A narrow, winding cobblestone street bursting with colour — crooked shopfronts stacked with cauldrons, broomsticks, and spell books, owls perched on awnings, and witches and wizards bustling past in vivid robes under a strip of bright sky." },
    { id: "L-HP-05", prompt: "A cavernous hall lit by thousands of floating candles, four long wooden tables stretching toward a raised staff dais, with an enchanted ceiling showing a swirl of stars and drifting clouds above." },
    { id: "L-HP-06", prompt: "A dark, dusty stone corridor lit by guttering torches, with a heavy locked door at the far end. The air is thick with dread, and deep growling reverberates from behind the door." },
    { id: "L-HP-07", prompt: "An ancient, dense forest of towering gnarled trees with a thick canopy that blocks out moonlight. Silver mist curls between the roots, and the darkness between the trunks feels alive and watchful." },
    { id: "L-HP-08", prompt: "A towering white marble building that leans slightly over Diagon Alley, with burnished bronze doors flanked by goblin guards in scarlet-and-gold uniforms. Inside, a vast hall of polished counters stretches into shadow." },
  ],
  sw: [
    { id: "L-SW-01", prompt: "Vast spiral galaxy seen from deep space, billions of stars swirling in luminous arms of blue and white against the infinite black void, scattered nebulae glowing in violet and gold." },
    { id: "L-SW-02", prompt: "Endless desert landscape under twin suns blazing white and amber in a pale sky; rolling dunes of fine sand stretch to the horizon, broken by eroded rock mesas and shimmering heat haze." },
    { id: "L-SW-03", prompt: "Moon-sized spherical battle station hanging in the blackness of space, its surface covered in grey metallic panels and trenches; a massive concave superlaser dish dominates the upper hemisphere, glowing faintly green." },
    { id: "L-SW-04", prompt: "Sprawling desert spaceport of low domed adobe buildings and dusty streets crowded with alien species; landed freighters dot the outskirts, heat rises from sun-baked stone, and a cantina glows with dim neon light." },
    { id: "L-SW-05", prompt: "A lush blue-green planet with swirling white clouds and snow-capped mountain ranges visible from orbit; elegant spired cities nestled in verdant valleys, bathed in warm golden sunlight." },
    { id: "L-SW-06", prompt: "Dense tropical jungle moon with towering stone Massassi temples rising above the canopy; vines drape ancient pyramids, mist clings to the undergrowth, and X-wing fighters are parked on a vine-cracked landing pad." },
    { id: "L-SW-07", prompt: "Interior of a sleek white Corellian corvette with curved corridors, smooth white walls, and recessed lighting; blaster scoring marks the bulkheads, smoke drifts through the passageways, and red emergency lights pulse." },
    { id: "L-SW-08", prompt: "Sunken adobe moisture farm with a domed igloo entrance half-buried in desert sand; a courtyard cut into the earth below ground level, vaporator towers dotting the surrounding dunes under a burnt-orange sky." },
  ],
  got: [
    { id: "L-GOT-01", prompt: "Vast medieval continent seen from above, rolling green hills and dark forests giving way to snow-capped mountains in the north, a patchwork of kingdoms under an overcast sky, epic fantasy landscape" },
    { id: "L-GOT-02", prompt: "Sprawling medieval city built on hills above a wide river, crowded timber and stone buildings climbing toward a massive red fortress on the highest hill, hazy golden light and smoke rising from a thousand chimneys" },
    { id: "L-GOT-03", prompt: "Imposing castle fortress with walls of dark red stone and tall battlemented towers, iron-spiked gates and narrow windows, a great hall with a throne of fused swords visible through an arched entrance, ominous and powerful" },
    { id: "L-GOT-04", prompt: "Ancient northern castle of dark grey granite with thick walls and round towers, steam rising from hot springs within the courtyard, snow dusting the battlements under a pale winter sky, vast and weathered and enduring" },
    { id: "L-GOT-05", prompt: "Colossal wall of solid ice stretching from horizon to horizon, seven hundred feet tall and gleaming blue-white, a tiny wooden fortress at its base, frozen wilderness beyond, overwhelming scale under a dark arctic sky" },
    { id: "L-GOT-06", prompt: "Wide expanse of deep blue-grey ocean between two continents, choppy waves under a vast sky, merchant galleys and warships dotting the water, moody atmospheric seascape with distant coastlines" },
    { id: "L-GOT-07", prompt: "Opulent coastal city with white-washed villas and domed towers in an eastern Mediterranean style, palm trees and terraced gardens overlooking a sun-drenched harbor, warm golden light and exotic luxury" },
    { id: "L-GOT-08", prompt: "Long muddy road cutting through rolling countryside and dark forests, stone mile markers and a distant watchtower, overcast sky with shafts of pale light, a sense of vast lonely distance stretching north to south" },
  ],
  lotr: [
    { id: "L-LOTR-01", prompt: "A vast panoramic landscape stretching from green rolling hills to snow-capped mountains and dark volcanic plains, golden sunlight breaking through dramatic clouds over ancient forests and winding rivers." },
    { id: "L-LOTR-02", prompt: "Lush green rolling hills dotted with round hobbit doors set into grassy mounds, smoke rising from chimneys, a winding lane bordered by hedgerows and wildflowers under a warm golden afternoon sky." },
    { id: "L-LOTR-03", prompt: "An elegant Elven valley with graceful stone bridges arching over waterfalls, slender towers with pointed arches nestled among ancient pines, soft golden light filtering through autumn leaves into a hidden mountain gorge." },
    { id: "L-LOTR-04", prompt: "A colossal underground Dwarven hall with towering stone columns carved into the living rock, stretching into darkness. Faint torchlight reveals intricate geometric carvings and vast echoing emptiness, dust motes drifting in shafts of pale light from cracks above." },
    { id: "L-LOTR-05", prompt: "An enchanted forest of impossibly tall silver-barked mallorn trees with golden leaves, soft ethereal light glowing from Elven lanterns among the high branches, wooden platforms and stairways spiraling up into the luminous canopy." },
    { id: "L-LOTR-06", prompt: "A forested hilltop above a great river with thundering waterfalls, a crumbling stone seat of ancient Numenorean craft overlooking the misty falls of Rauros, dappled light through old-growth trees with a brooding overcast sky." },
    { id: "L-LOTR-07", prompt: "A black stone tower of Orthanc rising from a ring-wall of dark rock, surrounded by pits of fire and industrial smoke where ancient trees have been felled, iron machinery and forges glowing red beneath a haze-choked sky." },
    { id: "L-LOTR-08", prompt: "A desolate, wind-swept hilltop crowned with the crumbling ruins of an ancient stone watchtower, jagged walls silhouetted against a stormy twilight sky, the surrounding wilderness stretching dark and empty in every direction." },
  ],
  ri: [
    { id: "L-01", prompt: "A towering ancient mountain shrouded in mist and dense bamboo forest, its jagged peaks piercing low clouds — lush green slopes cut by narrow winding paths, faint luminous Gu worms drifting between the trees at dusk, the air heavy with primeval essence." },
    { id: "L-02", prompt: "A modest mountain village of weathered wooden stilted houses with thatched roofs, nestled on a plateau among bamboo groves — packed-earth roads, cooking smoke curling upward, surrounded by a low bamboo perimeter fence with the mountain looming behind." },
    { id: "L-03", prompt: "A wide open-air training hall with a slate lecture board, wooden benches arranged in rows, and a raised stone platform for cultivation demonstrations — sunlight filtering through slatted windows, the walls hung with charts of Gu worm classifications." },
    { id: "L-04", prompt: "A grand timber hall with heavy carved pillars and a high vaulted ceiling, copper lanterns casting warm amber light across a long stone table where the clan elders convene — ancestral tablets lining the back wall, the air thick with incense and political tension." },
    { id: "L-05", prompt: "Narrow underground passages carved from raw stone, dripping with mineral water, lit only by faint bioluminescent moss — collapsed archways, low ceilings, and hidden alcoves containing dusty caches of primeval stones, the air cold and metallic." },
    { id: "L-06", prompt: "A fortress-village of white stone buildings on a frost-covered mountainside, ice crystals glinting on every surface — cold blue light emanating from cultivation chambers, sharp-peaked rooftops dusted with snow, the architecture imposing and austere." },
    { id: "L-07", prompt: "Untamed mountain slopes thick with ancient trees, tangled undergrowth, and jagged rock outcroppings — wild beast tracks scoring the mud, cliff faces bearing faded carved markings, shafts of light breaking through the dense canopy, an atmosphere of danger and hidden secrets." },
    { id: "L-08", prompt: "A vast underground cavern of crumbling ornate architecture — carved stone columns wound with dead vines, collapsed bridges over dark chasms, glowing formation arrays etched into the floor, poisoned dart mechanisms visible in the walls, the remnants of a Rank 4 Gu Immortal's sealed legacy." },
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function startPrediction(apiToken, prompt, aspectRatio = "1:1") {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: aspectRatio,
        num_outputs: 1,
        output_format: "jpeg",
        output_quality: 85,
      },
    }),
  });
  const data = await res.json();
  if (!data.id) {
    throw new Error(`Failed to start prediction: ${JSON.stringify(data)}`);
  }
  return data;
}

async function pollPrediction(apiToken, predictionId) {
  while (true) {
    const res = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      { headers: { Authorization: `Bearer ${apiToken}` } }
    );
    const data = await res.json();

    if (data.status === "succeeded") {
      if (data.output && data.output.length > 0) return data.output[0];
      throw new Error("Prediction succeeded but no output URL");
    } else if (data.status === "failed") {
      throw new Error(`Prediction failed: ${data.error}`);
    } else if (data.status === "canceled") {
      throw new Error("Prediction was canceled");
    }

    await sleep(POLL_INTERVAL);
  }
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buffer);
}

/**
 * Patch seed TS files: insert imageUrl pointing to public asset path
 * after each matching imagePrompt line.
 */
function patchSeedFiles() {
  const seedFiles = { hp: "seed-hp.ts", sw: "seed-sw.ts", got: "seed-got.ts", lotr: "seed-lotr.ts", ri: "seed-ri.ts" };
  let totalPatched = 0;

  for (const [seed, filename] of Object.entries(seedFiles)) {
    const filePath = path.join(ROOT, "src", "data", filename);
    let content = fs.readFileSync(filePath, "utf-8");
    const chars = CHARACTERS[seed] || [];
    const locs = LOCATIONS[seed] || [];
    let patchCount = 0;

    for (const char of chars) {
      const ext = "jpg";
      const assetPath = `/seed-assets/${seed}/characters/${char.id}.${ext}`;
      const imgFile = path.join(OUT_DIR, seed, "characters", `${char.id}.${ext}`);
      if (!fs.existsSync(imgFile)) continue;

      // Check if already patched
      if (content.includes(`imageUrl: '${assetPath}'`)) continue;

      // Insert imageUrl after the imagePrompt line for this character
      const idPattern = `id: '${char.id}'`;
      const idIdx = content.indexOf(idPattern);
      if (idIdx === -1) continue;

      // Find the imagePrompt line after this id
      const promptIdx = content.indexOf("imagePrompt:", idIdx);
      if (promptIdx === -1) continue;

      // Find the end of the imagePrompt line (next newline after the closing quote)
      const lineEnd = content.indexOf("\n", promptIdx);
      if (lineEnd === -1) continue;

      // Insert imageUrl line after imagePrompt
      const indent = "    ";
      content = content.slice(0, lineEnd + 1) + `${indent}imageUrl: '${assetPath}',\n` + content.slice(lineEnd + 1);
      patchCount++;
    }

    for (const loc of locs) {
      const ext = "jpg";
      const assetPath = `/seed-assets/${seed}/locations/${loc.id}.${ext}`;
      const imgFile = path.join(OUT_DIR, seed, "locations", `${loc.id}.${ext}`);
      if (!fs.existsSync(imgFile)) continue;

      if (content.includes(`imageUrl: '${assetPath}'`)) continue;

      const idPattern = `id: '${loc.id}'`;
      const idIdx = content.indexOf(idPattern);
      if (idIdx === -1) continue;

      const promptIdx = content.indexOf("imagePrompt:", idIdx);
      if (promptIdx === -1) continue;

      const lineEnd = content.indexOf("\n", promptIdx);
      if (lineEnd === -1) continue;

      const indent = "    ";
      content = content.slice(0, lineEnd + 1) + `${indent}imageUrl: '${assetPath}',\n` + content.slice(lineEnd + 1);
      patchCount++;
    }

    if (patchCount > 0) {
      fs.writeFileSync(filePath, content);
      console.log(`  Patched ${filename}: ${patchCount} imageUrl entries added`);
      totalPatched += patchCount;
    } else {
      console.log(`  ${filename}: nothing to patch`);
    }
  }

  console.log(`\n  Total: ${totalPatched} imageUrl entries patched`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const seedFilter = args.includes("--seed") ? args[args.indexOf("--seed") + 1] : null;
  const typeFilter = args.includes("--type") ? args[args.indexOf("--type") + 1] : null;
  const dryRun = args.includes("--dry-run");
  const patchOnly = args.includes("--patch");

  if (patchOnly) {
    console.log("\nPatching seed TS files with imageUrl paths...\n");
    patchSeedFiles();
    return;
  }

  // Load API token
  if (!dryRun && !process.env.REPLICATE_API_TOKEN) {
    const envPath = path.join(ROOT, ".env.local");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      for (const line of envContent.split("\n")) {
        const match = line.match(/^(\w+)=(.+)$/);
        if (match) process.env[match[1]] = match[2].trim();
      }
    }
    if (!process.env.REPLICATE_API_TOKEN) {
      console.error("Error: REPLICATE_API_TOKEN not set.");
      process.exit(1);
    }
  }

  const apiToken = process.env.REPLICATE_API_TOKEN;

  // Build task list
  const tasks = [];
  const seeds = Object.keys(CHARACTERS);

  for (const seed of seeds) {
    if (seedFilter && seed !== seedFilter) continue;
    const style = STYLES[seed];

    if (!typeFilter || typeFilter === "characters") {
      for (const char of CHARACTERS[seed]) {
        const dir = path.join(OUT_DIR, seed, "characters");
        tasks.push({
          seed,
          type: "character",
          id: char.id,
          prompt: `${style} portrait of ${char.prompt}${NO_TEXT_SUFFIX}`,
          aspectRatio: "3:4",
          outputPath: path.join(dir, `${char.id}.jpg`),
          dir,
        });
      }
    }

    if (!typeFilter || typeFilter === "locations") {
      for (const loc of LOCATIONS[seed]) {
        const dir = path.join(OUT_DIR, seed, "locations");
        tasks.push({
          seed,
          type: "location",
          id: loc.id,
          prompt: `${style} wide establishing shot of ${loc.prompt}${NO_TEXT_SUFFIX}`,
          aspectRatio: "16:9",
          outputPath: path.join(dir, `${loc.id}.jpg`),
          dir,
        });
      }
    }
  }

  console.log(`\nSeed Asset Generator`);
  console.log(`  Model: ${MODEL}`);
  console.log(`  Tasks: ${tasks.length} images`);
  console.log(`  Batch size: ${BATCH_SIZE}, Retries: ${MAX_RETRIES}`);
  if (seedFilter) console.log(`  Seed filter: ${seedFilter}`);
  if (typeFilter) console.log(`  Type filter: ${typeFilter}`);
  if (dryRun) console.log(`  Mode: DRY RUN`);
  console.log("");

  // Create directories
  const dirs = new Set(tasks.map((t) => t.dir));
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (dryRun) {
    for (const task of tasks) {
      console.log(`[${task.seed}] ${task.type}: ${task.id}`);
      console.log(`  Prompt: ${task.prompt}`);
      console.log(`  Output: ${task.outputPath}\n`);
    }
    console.log(`Dry run complete. ${tasks.length} images would be generated.`);
    return;
  }

  // Skip already-existing files
  const pending = tasks.filter((task) => {
    if (fs.existsSync(task.outputPath)) {
      console.log(`  Skip (exists): ${path.relative(OUT_DIR, task.outputPath)}`);
      return false;
    }
    return true;
  });

  if (pending.length === 0) {
    console.log("\nAll images already exist. Run with --patch to update seed files.");
    return;
  }

  console.log(`  ${tasks.length - pending.length} skipped (exist), ${pending.length} to generate\n`);

  let completed = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(pending.length / BATCH_SIZE);

    console.log(`--- Batch ${batchNum}/${totalBatches} (${batch.length} images) ---\n`);

    const jobs = batch.map(async (task) => {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const label = `${task.seed}/${task.type}/${task.id}`;
          if (attempt > 1) {
            console.log(`  Retry ${attempt}/${MAX_RETRIES}: ${label}`);
          } else {
            console.log(`  Starting: ${label}`);
          }

          const prediction = await startPrediction(apiToken, task.prompt, task.aspectRatio);
          console.log(`  Pending: ${task.id} -> ${prediction.id}`);

          const imageUrl = await pollPrediction(apiToken, prediction.id);
          await downloadFile(imageUrl, task.outputPath);

          const size = fs.statSync(task.outputPath).size;
          if (size === 0) {
            fs.unlinkSync(task.outputPath);
            throw new Error("Downloaded file is empty");
          }

          console.log(`  Done: ${task.id} (${(size / 1024).toFixed(0)} KB)`);
          completed++;
          return;
        } catch (err) {
          if (attempt < MAX_RETRIES) {
            console.warn(`  Warn: ${task.id} attempt ${attempt} failed: ${err.message}`);
            await sleep(RETRY_DELAY * attempt);
          } else {
            failed++;
            errors.push({ task, error: err.message });
            console.error(`  FAIL: ${task.id} -- ${err.message}`);
          }
        }
      }
    });

    await Promise.all(jobs);

    if (i + BATCH_SIZE < pending.length) {
      console.log(`\n  Pausing 3s before next batch...\n`);
      await sleep(3000);
    }
  }

  console.log(`\n---`);
  console.log(`  Done! ${completed} generated, ${failed} failed`);
  if (errors.length > 0) {
    console.log(`\n  Failures:`);
    for (const { task, error } of errors) {
      console.log(`    - ${task.seed}/${task.id}: ${error}`);
    }
  }

  if (completed > 0) {
    console.log(`\n  Run with --patch to add imageUrl paths to seed TS files.`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
