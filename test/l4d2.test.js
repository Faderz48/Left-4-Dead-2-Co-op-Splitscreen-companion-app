const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { OFFICIAL_MAPS, defaultSettings, normalizeSettings, generateControllerConfig, generateSessionConfig, parseLibraryFolders } = require('../src/l4d2');

test('includes every official campaign chapter', () => {
  assert.equal(OFFICIAL_MAPS.length, 57);
  assert.ok(OFFICIAL_MAPS.some(([campaign, chapter, id]) => campaign === 'The Last Stand' && chapter === 'Lighthouse' && id === 'c14m2_lighthouse'));
});

test('includes official artwork for every campaign', () => {
  const campaigns = [...new Set(OFFICIAL_MAPS.map(([campaign]) => campaign))];
  assert.equal(campaigns.length, 14);
  for (const campaign of campaigns) {
    const filename = `${campaign.toLowerCase().replaceAll(' ', '_')}.webp`;
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'posters', filename)), `missing ${filename}`);
  }
});

test('keeps clean campaign artwork proportions in cards and previews', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf8');
  assert.match(css, /\.campaign-card img\{[^}]*object-fit:contain/);
  assert.match(css, /\.selection-art img\{[^}]*object-fit:contain/);
  assert.doesNotMatch(css, /blur\(/);
});

test('normalizes unsafe and out-of-range settings', () => {
  const settings = normalizeSettings({ mapId: '../bad;map', mode: 'invalid', player2Name: 'P2";quit', movementSensitivity: 9, players: [{ lookSensitivity: -4 }] });
  assert.equal(settings.mapId, 'c1m1_hotel');
  assert.equal(settings.mode, 'campaign');
  assert.equal(settings.player2Name, 'P2quit');
  assert.equal(settings.movementSensitivity, 1.5);
  assert.equal(settings.bigPictureMode, false);
  assert.equal(settings.players[0].lookSensitivity, 0.4);
});

test('normalizes and remembers big-picture mode', () => {
  assert.equal(defaultSettings().bigPictureMode, false);
  assert.equal(normalizeSettings({ bigPictureMode:true }).bigPictureMode, true);
  assert.equal(normalizeSettings({ bigPictureMode:'true' }).bigPictureMode, false);
});

test('generates independent controller camera and vibration options', () => {
  const settings = defaultSettings();
  settings.players[0].invertY = true;
  settings.players[1].invertX = true;
  settings.players[0].lookSensitivity = 1.2;
  settings.players[1].vibration = false;
  settings.players[1].stickLayout = 'southpaw';
  settings.players[1].bindings.jump = 'R_SHOULDER';
  const cfg = generateControllerConfig(settings);
  assert.match(cfg, /joy_inverty "1"/);
  assert.match(cfg, /joy_invertx2 "1"/);
  assert.match(cfg, /joy_pitchsensitivity "1\.20"/);
  assert.match(cfg, /joy_vibration2 "0"/);
  assert.match(cfg, /joy_movement_stick2 "1"/);
  assert.match(cfg, /cmd2 bind "R_SHOULDER" "\+jump;\+menuAccept"/);
  assert.match(cfg, /joy_remap_player_for_controller2 "2"/);
});

test('generates a safe native split-screen session', () => {
  const settings = defaultSettings();
  settings.mapId = 'c14m1_junkyard'; settings.mode = 'realism'; settings.split = 'vertical'; settings.player2Name = 'Coach Two';
  const cfg = generateSessionConfig(settings);
  assert.match(cfg, /ss_splitmode "2"/);
  assert.match(cfg, /name2 "Coach Two"/);
  assert.match(cfg, /ss_map "c14m1_junkyard" "realism"/);
  assert.match(cfg, /connect_splitscreen localhost 2/);
});

test('parses Windows and Linux Steam library paths', () => {
  const vdf = '"path"  "D:\\\\Games"\n"path" "/mnt/steam"';
  assert.deepEqual(parseLibraryFolders(vdf), ['D:\\Games', '/mnt/steam']);
});
