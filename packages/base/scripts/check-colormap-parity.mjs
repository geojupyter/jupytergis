/**
 * Cross-language colour-ramp parity check — no committed fixture.
 *
 * Samples every colour ramp two independent ways and asserts the bytes are
 * identical, so the colours a user sees on the map are exactly the colours the
 * Python QGIS exporter bakes:
 *   - the map view: the `colormap` npm package + cmocean.json + d3-scale-chromatic,
 *     sampled exactly as `getColorMapList` does in colorRampUtils.ts;
 *   - the exporter: `jupytergis_core.color_ramps.sample_colors`.
 *
 * Both references are generated live and diffed in memory — nothing is written
 * to disk, so there is no large fixture to commit or lint. Exits non-zero on any
 * mismatch. Run via `jlpm check:colormaps`.
 *
 * Requirements:
 *   - this repo's node_modules (colormap, d3-scale-chromatic);
 *   - a Python with `jupytergis_core` importable. Override the interpreter with
 *     the PYTHON env var (defaults to `python`).
 *
 * Keep COLOR_RAMP_NAMES / D3 in sync with colorRampUtils.ts.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import colormap from 'colormap';
import colorScale from 'colormap/colorScale.js';
import * as d3 from 'd3-scale-chromatic';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CMOCEAN_PATH = path.resolve(
  HERE,
  '../src/features/layers/symbology/components/color_ramp/cmocean.json',
);

// Number of shades the frontend samples continuous ramps at (getColorMapList).
// High resolution matters: rounding drift between the two samplers only surfaces
// at large shade counts (it is invisible at the ~9 the exporter usually bakes).
const NSHADES = 255;

// Mirror of COLOR_RAMP_NAMES in colorRampUtils.ts.
const COLOR_RAMP_NAMES = [
  'jet', 'hsv', 'hot', 'cool', 'spring', 'summer', 'autumn', 'winter', 'bone',
  'copper', 'greys', 'YiGnBu', 'greens', 'YiOrRd', 'bluered', 'RdBu', 'picnic',
  'rainbow', 'portland', 'blackbody', 'earth', 'electric', 'viridis', 'inferno',
  'magma', 'plasma', 'warm', 'rainbow-soft', 'bathymetry', 'cdom', 'chlorophyll',
  'density', 'freesurface-blue', 'freesurface-red', 'oxygen', 'par', 'phase',
  'salinity', 'temperature', 'turbidity', 'velocity-blue', 'velocity-green',
  'cubehelix', 'ice', 'oxy', 'matter', 'amp', 'tempo', 'rain', 'topo', 'balance',
  'delta', 'curl', 'diff', 'tarn',
];

// Mirror of D3_CATEGORICAL_SCHEMES in colorRampUtils.ts.
const D3 = {
  schemeCategory10: d3.schemeCategory10,
  schemeAccent: d3.schemeAccent,
  schemeDark2: d3.schemeDark2,
  schemeObservable10: d3.schemeObservable10,
  schemePaired: d3.schemePaired,
  schemePastel1: d3.schemePastel1,
  schemePastel2: d3.schemePastel2,
  schemeSet1: d3.schemeSet1,
  schemeSet2: d3.schemeSet2,
  schemeSet3: d3.schemeSet3,
  schemeTableau10: d3.schemeTableau10,
};

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** name -> [[r,g,b], ...], keyed exactly the way the Python side looks ramps up. */
function jsReference() {
  // Merge cmocean ramps into colorScale exactly as colorRampUtils.ts does.
  const { __license__, ...cmocean } = JSON.parse(
    fs.readFileSync(CMOCEAN_PATH, 'utf8'),
  );
  Object.assign(colorScale, cmocean);

  const ref = {};
  for (const name of COLOR_RAMP_NAMES) {
    const ramp = colormap({ colormap: name, nshades: NSHADES, format: 'rgba' });
    // Lowercased name is the lookup key on the Python side.
    ref[name.toLowerCase()] = ramp.map(c => [c[0], c[1], c[2]]);
  }
  for (const [name, colors] of Object.entries(D3)) {
    ref[name] = colors.map(hexToRgb);
  }
  return ref;
}

/** Ask Python for sample_colors(name, n) for every (name -> n) in `counts`. */
function pythonReference(counts) {
  const PY = [
    'import sys, json',
    'from jupytergis_core.color_ramps import sample_colors',
    'req = json.load(sys.stdin)',
    'out = {k: [list(c[:3]) for c in sample_colors(k, n)] for k, n in req.items()}',
    'json.dump(out, sys.stdout)',
  ].join('\n');
  const python = process.env.PYTHON || 'python';
  const stdout = execFileSync(python, ['-c', PY], {
    input: JSON.stringify(counts),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

const js = jsReference();
const counts = Object.fromEntries(
  Object.entries(js).map(([name, colors]) => [name, colors.length]),
);
const py = pythonReference(counts);

const mismatches = [];
for (const [name, jsColors] of Object.entries(js)) {
  const pyColors = py[name];
  if (JSON.stringify(jsColors) === JSON.stringify(pyColors)) {
    continue;
  }
  if (!pyColors) {
    mismatches.push(`${name}: missing on the Python side`);
    continue;
  }
  const i = jsColors.findIndex(
    (c, idx) => JSON.stringify(c) !== JSON.stringify(pyColors[idx]),
  );
  mismatches.push(
    `${name}: idx ${i} js=${JSON.stringify(jsColors[i])} python=${JSON.stringify(pyColors[i])}`,
  );
}

if (mismatches.length) {
  console.error(
    'colour-ramp parity FAILED — the map view and the Python exporter disagree:\n' +
      mismatches.map(m => `  ${m}`).join('\n'),
  );
  process.exit(1);
}

console.log(`colour-ramp parity OK: ${Object.keys(js).length} ramps match exactly.`);
