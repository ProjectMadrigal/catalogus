/**
 * laad.js
 * Laadt de Apps Script-bestanden en de zoek- en filterbestanden van de website
 * in een afgesloten omgeving, zodat de tests ze kunnen gebruiken zonder Google.
 * Alle gegevens in de tests zijn verzonnen.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

/** Bestanden met logica die geen Google-diensten nodig heeft bij het laden. */
const SCRIPTS = [
  'apps-script/Hulp.js',
  'apps-script/Datums.js',
  'apps-script/Instellingen.js',
  'apps-script/Opslag.js',
  'apps-script/Catalogus.js',
  'apps-script/Goodreads.js',
  'apps-script/OpenLibrary.js',
  'apps-script/Grenzen.js',
  'apps-script/Uitlenen.js',
  'apps-script/Publiek.js',
  'apps-script/Bestuur.js',
  'apps-script/Privacy.js',
  'apps-script/Overzetten.js',
  'apps-script/Api.js',
  'apps-script/Menu.js',
  'zoeken.js',
  'filters.js'
];

function laad() {
  const context = vm.createContext({ console });
  context.globalThis = context;
  for (const bestand of SCRIPTS) {
    const code = fs.readFileSync(path.join(ROOT, bestand), 'utf8');
    vm.runInContext(code, context, { filename: bestand });
  }
  return context;
}

module.exports = { laad };
