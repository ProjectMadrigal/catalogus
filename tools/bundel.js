/**
 * bundel.js
 * Voegt alle bestanden uit apps-script/ samen tot één bestand: madrigal-script.gs.
 * Zo plak je in Apps Script één bestand in plaats van vijftien.
 *
 * Apps Script toont de functies in de keuzelijst naast "Uitvoeren" in de volgorde
 * van het bestand. Daarom zet dit script alle functies alfabetisch: eerst de
 * vaste waarden (var), dan de functies van A tot Z, elk met hun uitleg erboven.
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

/**
 * Knipt een bestand in stukken: elk stuk is één functie of één var, met de
 * uitleg die er rechtstreeks boven staat. De uitleg bovenaan het bestand
 * (gevolgd door een lege regel) hoort bij geen enkel stuk.
 */
function knip(code, bestand) {
  const regels = code.replace(/\r\n/g, '\n').split('\n');
  const begin = [];
  regels.forEach((r, i) => { if (/^(function |var )/.test(r)) begin.push(i); });
  const stukken = [];
  begin.forEach((start, n) => {
    // Uitleg erboven: een commentaarblok of //-regels zonder lege regel ertussen.
    let van = start;
    if (van > 0 && /\*\/\s*$/.test(regels[van - 1])) {
      while (van > 0 && !/^\/\*/.test(regels[van - 1])) van--;
      van--;
    }
    while (van > 0 && /^\/\//.test(regels[van - 1])) van--;
    const tot = n + 1 < begin.length ? begin[n + 1] : regels.length;
    // Tot het begin van de uitleg van het volgende stuk.
    let einde = tot;
    if (n + 1 < begin.length) {
      let v = tot;
      if (v > 0 && /\*\/\s*$/.test(regels[v - 1])) {
        while (v > 0 && !/^\/\*/.test(regels[v - 1])) v--;
        v--;
      }
      while (v > 0 && /^\/\//.test(regels[v - 1])) v--;
      einde = v;
    }
    const tekst = regels.slice(van, einde).join('\n').trimEnd();
    const naam = regels[start].match(/^(?:function|var) ([A-Za-z0-9_$]+)/)[1];
    stukken.push({ soort: regels[start].indexOf('var ') === 0 ? 'var' : 'function', naam, tekst, bestand });
  });
  return stukken;
}

function maakBundel() {
  const bestanden = fs.readdirSync(MAP).filter((f) => f.endsWith('.js')).sort();
  let stukken = [];
  bestanden.forEach((f) => { stukken = stukken.concat(knip(fs.readFileSync(path.join(MAP, f), 'utf8'), f)); });
  const vars = stukken.filter((s) => s.soort === 'var');
  const functies = stukken.filter((s) => s.soort === 'function')
    .sort((a, b) => a.naam.toLowerCase().localeCompare(b.naam.toLowerCase()));
  const delen = [
    '/**',
    ' * madrigal-script.gs',
    ' * Alle code van de catalogus van Project Madrigal in één bestand.',
    ' * Plak dit volledige bestand in Apps Script (Extensies > Apps Script).',
    ' * De functies staan alfabetisch, zodat je ze makkelijk vindt naast "Uitvoeren".',
    ' *',
    ' * PAS DIT BESTAND NIET MET DE HAND AAN. Het wordt gemaakt uit de map',
    ' * apps-script/ met: node tools/bundel.js',
    ' * De uitleg per onderdeel staat bovenaan de bestanden in apps-script/.',
    ' */',
    '',
    '/* ==================== Vaste waarden ==================== */',
    ''
  ];
  vars.forEach((s) => delen.push(s.tekst, ''));
  delen.push('/* ==================== Functies, van A tot Z ==================== */', '');
  functies.forEach((s) => delen.push(s.tekst, ''));
  return delen.join('\n');
}

if (require.main === module) {
  fs.writeFileSync(UIT, maakBundel());
  console.log('madrigal-script.gs bijgewerkt.');
}

module.exports = { maakBundel, knip, UIT, MAP };
