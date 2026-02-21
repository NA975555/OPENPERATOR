const PRESETS = [
  {
    name: "Quiet Tension",
    seed: 120314,
    params: {
      palette: "slate",
      gridCols: 10,
      gridRows: 14,
      heroBias: 0.18,
      tempo: 0.42,
      amplitude: 0.7,
      quality: "high"
    }
  },
  {
    name: "Copper Drift",
    seed: 777031,
    params: {
      palette: "copper",
      gridCols: 9,
      gridRows: 13,
      heroBias: 0.25,
      tempo: 0.32,
      amplitude: 0.58,
      quality: "high"
    }
  },
  {
    name: "Night Signal",
    seed: 424242,
    params: {
      palette: "night",
      gridCols: 12,
      gridRows: 15,
      heroBias: 0.2,
      tempo: 0.52,
      amplitude: 0.75,
      quality: "low"
    }
  }
];

const Palette = {
  sets: {
    slate: {
      bg: "#f2efe8",
      ink: "#1e2024",
      soft: "#8f9aa3",
      accent: "#cc5f43",
      paper: "#efe7d6"
    },
    copper: {
      bg: "#f5f1ea",
      ink: "#232018",
      soft: "#9e7e64",
      accent: "#b3472f",
      paper: "#ece0cf"
    },
    night: {
      bg: "#0e1218",
      ink: "#d9d6cd",
      soft: "#68717d",
      accent: "#7a9dd6",
      paper: "#101722"
    }
  },
  get(name) {
    return this.sets[name] || this.sets.slate;
  }
};

const State = {
  activePreset: 0,
  seed: PRESETS[0].seed,
  params: { ...PRESETS[0].params },
  phase: 0,
  ui: null,
  rng: null,
  cachedGeometry: null,
  grainLayer: null,
  qualityScale: 1,
  infoText: ""
};

function setup() {
  createCanvas(min(windowWidth, 1100), min(windowHeight, 800));
  pixelDensity(1);
  frameRate(60);
  textFont("monospace");
  setupUI();
  applyPreset(0);
}

function draw() {
  const colors = Palette.get(State.params.palette);
  background(colors.bg);

  updateMotion();
  Render.drawComposition(colors);
  Render.drawTexture(colors);
  Render.drawOverlay(colors);
}

function keyPressed() {
  if (key === "P") {
    applyPreset((State.activePreset + 1) % PRESETS.length);
  }
  if (key === "Q") {
    State.params.quality = State.params.quality === "high" ? "low" : "high";
    rebuildFromState();
  }
}

function windowResized() {
  resizeCanvas(min(windowWidth, 1100), min(windowHeight, 800));
  rebuildFromState();
}

function applyPreset(i) {
  const preset = PRESETS[i % PRESETS.length];
  State.activePreset = i % PRESETS.length;
  State.seed = preset.seed;
  State.params = { ...preset.params };
  State.phase = 0;
  rebuildFromState();
}

function rebuildFromState() {
  State.rng = Geometry.makeRng(State.seed);
  State.qualityScale = State.params.quality === "high" ? 1 : 0.62;
  State.cachedGeometry = Geometry.buildGrid(State.params, State.rng);
  State.grainLayer = Geometry.buildGrain(State.params, State.rng);
  State.infoText = `${PRESETS[State.activePreset].name} · seed ${State.seed} · ${State.params.quality}`;
}

function updateMotion() {
  State.phase += 0.01 * State.params.tempo;
}

function setupUI() {
  State.ui = createDiv("P: next preset · Q: quality");
  State.ui.style("position", "fixed");
  State.ui.style("left", "12px");
  State.ui.style("bottom", "10px");
  State.ui.style("padding", "8px 10px");
  State.ui.style("font-size", "12px");
  State.ui.style("letter-spacing", "0.08em");
  State.ui.style("background", "rgba(0,0,0,0.3)");
  State.ui.style("color", "#f2f2f2");
  State.ui.style("border", "1px solid rgba(255,255,255,0.2)");
}

const Geometry = {
  makeRng(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  },

  buildGrid(params, rng) {
    const cells = [];
    const margin = min(width, height) * 0.1;
    const gw = width - margin * 2;
    const gh = height - margin * 2;
    const cw = gw / params.gridCols;
    const ch = gh / params.gridRows;

    for (let y = 0; y < params.gridRows; y++) {
      for (let x = 0; x < params.gridCols; x++) {
        const nx = x / (params.gridCols - 1);
        const ny = y / (params.gridRows - 1);
        const toCenter = abs(nx - 0.5) + abs(ny - 0.45);
        const heroChance = max(0, 0.42 - toCenter) + params.heroBias;
        const hero = rng() < heroChance * 0.65;
        cells.push({
          x: margin + x * cw + cw * 0.5,
          y: margin + y * ch + ch * 0.5,
          w: cw,
          h: ch,
          hero,
          phase: rng() * TAU,
          dir: rng() > 0.5 ? 1 : -1,
          weight: hero ? 1.5 : 0.8,
          cut: rng()
        });
      }
    }
    return { cells, margin, gw, gh, cw, ch };
  },

  buildGrain(params, rng) {
    const count = floor(700 * State.qualityScale);
    const points = [];
    for (let i = 0; i < count; i++) {
      points.push({
        x: rng() * width,
        y: rng() * height,
        a: 0.02 + rng() * 0.05,
        s: rng() > 0.9 ? 2 : 1
      });
    }
    return points;
  }
};

const Render = {
  drawComposition(colors) {
    noFill();
    const { cells, margin, gw, gh } = State.cachedGeometry;

    stroke(colors.soft);
    strokeWeight(1);
    rect(margin, margin, gw, gh);

    for (const c of cells) {
      const pulse = Motion.pulse(State.phase + c.phase, State.params.amplitude);
      const scaleX = 0.35 + pulse * 0.55;
      const scaleY = 0.2 + pulse * 0.28;
      const w = c.w * scaleX;
      const h = c.h * scaleY;

      stroke(c.hero ? colors.ink : colors.soft);
      strokeWeight(c.weight);

      if (c.hero) {
        fillColorAlpha(colors.accent, 0.18);
      } else {
        noFill();
      }

      push();
      translate(c.x, c.y);
      const angle = Motion.smoothSwing(State.phase + c.phase, c.dir) * 0.35;
      rotate(angle);

      if (c.cut < 0.34) {
        rectMode(CENTER);
        rect(0, 0, w, h);
      } else if (c.cut < 0.67) {
        line(-w * 0.5, 0, w * 0.5, 0);
      } else {
        arc(0, 0, w, h * 1.8, PI * 0.1, PI * 0.9);
      }
      pop();
    }
    noFill();
  },

  drawTexture(colors) {
    noStroke();
    fillColorAlpha(colors.paper, 0.08);
    rect(0, 0, width, height);

    for (const g of State.grainLayer) {
      fill(0, 0, 0, g.a * 255);
      rect(g.x, g.y, g.s, g.s);
    }
  },

  drawOverlay(colors) {
    noStroke();
    fill(colors.ink);
    textSize(11);
    textAlign(LEFT, TOP);
    text(State.infoText, 12, 12);
  }
};

const Motion = {
  pulse(t, amount) {
    const slow = (sin(t * 1.3) + 1) * 0.5;
    const med = (sin(t * 2.1 + 1.2) + 1) * 0.5;
    return lerp(slow, med, 0.32) * amount + (1 - amount) * 0.5;
  },

  smoothSwing(t, dir) {
    const s = sin(t * 0.85 * dir);
    return s * s * (3 - 2 * abs(s)) * dir;
  }
};

function fillColorAlpha(hex, alpha) {
  const c = color(hex);
  fill(red(c), green(c), blue(c), alpha * 255);
}
