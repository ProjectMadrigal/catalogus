/**
 * bundel.js
 * Voegt alle bestanden uit apps-script/ samen tot één bestand: madrigal-script.gs.
 * Zo plak je in Apps Script één bestand in plaats van vijftien.
 *
 * Na een wijziging in apps-script/ voer je uit:   node tools/bundel.js
 * De tests controleren of madrigal-script.gs nog klopt met de losse bestanden.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MAP = path.join(ROOT, 'apps-script');
const UIT = path.join(ROOT, 'madrigal-script.gs');

function maakBundel() {
  const bestanden = fs.readdirSync(MAP).filter((f) => f.endsWith('.js')).sort();
  const delen = [
    '/**',
    ' * madrigal-script.gs',
    ' * Alle code van de catalogus van Project Madrigal in één bestand.',
    ' * Plak dit volledige bestand in Apps Script (Extensies > Apps Script).',
    ' *',
    ' * PAS DIT BESTAND NIET MET DE HAND AAN. Het wordt gemaakt uit de map',
    ' * apps-script/ met: node tools/bundel.js',
    ' */',
    ''
  ];
  bestanden.forEach((f) => {
    delen.push('/* ==================== ' + f + ' ==================== */', '');
    delen.push(fs.readFileSync(path.join(MAP, f), 'utf8').trimEnd(), '', '');
  });
  return delen.join('\n');
}

if (require.main === module) {
  fs.writeFileSync(UIT, maakBundel());
  console.log('madrigal-script.gs bijgewerkt.');
}

module.exports = { maakBundel, UIT };
