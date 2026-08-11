const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const OFFICIAL_MAPS = [
  ['Dead Center', 'Hotel', 'c1m1_hotel'],
  ['Dead Center', 'Streets', 'c1m2_streets'],
  ['Dead Center', 'Mall', 'c1m3_mall'],
  ['Dead Center', 'Atrium', 'c1m4_atrium'],
  ['Dark Carnival', 'Highway', 'c2m1_highway'],
  ['Dark Carnival', 'Fairgrounds', 'c2m2_fairgrounds'],
  ['Dark Carnival', 'Coaster', 'c2m3_coaster'],
  ['Dark Carnival', 'Barns', 'c2m4_barns'],
  ['Dark Carnival', 'Concert', 'c2m5_concert'],
  ['Swamp Fever', 'Plank Country', 'c3m1_plankcountry'],
  ['Swamp Fever', 'Swamp', 'c3m2_swamp'],
  ['Swamp Fever', 'Shantytown', 'c3m3_shantytown'],
  ['Swamp Fever', 'Plantation', 'c3m4_plantation'],
  ['Hard Rain', 'Milltown', 'c4m1_milltown_a'],
  ['Hard Rain', 'Sugar Mill', 'c4m2_sugarmill_a'],
  ['Hard Rain', 'Return to Sugar Mill', 'c4m3_sugarmill_b'],
  ['Hard Rain', 'Return to Milltown', 'c4m4_milltown_b'],
  ['Hard Rain', 'Escape', 'c4m5_milltown_escape'],
  ['The Parish', 'Waterfront', 'c5m1_waterfront'],
  ['The Parish', 'Park', 'c5m2_park'],
  ['The Parish', 'Cemetery', 'c5m3_cemetery'],
  ['The Parish', 'Quarter', 'c5m4_quarter'],
  ['The Parish', 'Bridge', 'c5m5_bridge'],
  ['The Passing', 'Riverbank', 'c6m1_riverbank'],
  ['The Passing', 'Underground', 'c6m2_bedlam'],
  ['The Passing', 'Port', 'c6m3_port'],
  ['The Sacrifice', 'Docks', 'c7m1_docks'],
  ['The Sacrifice', 'Barge', 'c7m2_barge'],
  ['The Sacrifice', 'Port', 'c7m3_port'],
  ['No Mercy', 'Apartments', 'c8m1_apartment'],
  ['No Mercy', 'Subway', 'c8m2_subway'],
  ['No Mercy', 'Sewers', 'c8m3_sewers'],
  ['No Mercy', 'Hospital', 'c8m4_interior'],
  ['No Mercy', 'Rooftop', 'c8m5_rooftop'],
  ['Crash Course', 'Alleys', 'c9m1_alleys'],
  ['Crash Course', 'Truck Depot', 'c9m2_lots'],
  ['Death Toll', 'Turnpike', 'c10m1_caves'],
  ['Death Toll', 'Drains', 'c10m2_drainage'],
  ['Death Toll', 'Church', 'c10m3_ranchhouse'],
  ['Death Toll', 'Town', 'c10m4_mainstreet'],
  ['Death Toll', 'Boathouse', 'c10m5_houseboat'],
  ['Dead Air', 'Greenhouse', 'c11m1_greenhouse'],
  ['Dead Air', 'Crane', 'c11m2_offices'],
  ['Dead Air', 'Construction Site', 'c11m3_garage'],
  ['Dead Air', 'Terminal', 'c11m4_terminal'],
  ['Dead Air', 'Runway', 'c11m5_runway'],
  ['Blood Harvest', 'Woods', 'c12m1_hilltop'],
  ['Blood Harvest', 'Tunnel', 'c12m2_traintunnel'],
  ['Blood Harvest', 'Bridge', 'c12m3_bridge'],
  ['Blood Harvest', 'Train Station', 'c12m4_barn'],
  ['Blood Harvest', 'Farmhouse', 'c12m5_cornfield'],
  ['Cold Stream', 'Alpine Creek', 'c13m1_alpinecreek'],
  ['Cold Stream', 'South Pine Stream', 'c13m2_southpinestream'],
  ['Cold Stream', 'Memorial Bridge', 'c13m3_memorialbridge'],
  ['Cold Stream', 'Cut-throat Creek', 'c13m4_cutthroatcreek'],
  ['The Last Stand', 'Junkyard', 'c14m1_junkyard'],
  ['The Last Stand', 'Lighthouse', 'c14m2_lighthouse']
];

const ACTIONS = {
  jump: '+jump;+menuAccept', reload: '+reload', use: '+use', swap: 'lastinv',
  fire: '+attack', melee: '+attack2', quickTurn: '+lookspin', crouch: 'toggle_duck',
  vocalize: 'vocalize smartlook', zoom: '+zoom', scores: 'togglescores',
  pause: 'gameui_activate', flashlight: 'impulse 100', grenade: 'slot3',
  health: 'slot4', pills: 'slot5'
};

const DEFAULT_BINDINGS = {
  jump: 'A_BUTTON', reload: 'B_BUTTON', use: 'X_BUTTON', swap: 'Y_BUTTON',
  fire: 'R_TRIGGER', melee: 'L_TRIGGER', quickTurn: 'R_SHOULDER', crouch: 'L_SHOULDER',
  vocalize: 'STICK1', zoom: 'STICK2', scores: 'BACK', pause: 'START',
  flashlight: 'UP', grenade: 'LEFT', health: 'RIGHT', pills: 'DOWN'
};

const BUTTONS = [
  ['A_BUTTON', 'A'], ['B_BUTTON', 'B'], ['X_BUTTON', 'X'], ['Y_BUTTON', 'Y'],
  ['R_TRIGGER', 'Right trigger'], ['L_TRIGGER', 'Left trigger'],
  ['R_SHOULDER', 'Right bumper'], ['L_SHOULDER', 'Left bumper'],
  ['STICK1', 'Left stick click'], ['STICK2', 'Right stick click'],
  ['BACK', 'View / Back'], ['START', 'Menu / Start'], ['UP', 'D-pad up'],
  ['DOWN', 'D-pad down'], ['LEFT', 'D-pad left'], ['RIGHT', 'D-pad right']
];

function defaultPlayer() {
  return { invertY: false, invertX: false, lookSensitivity: 1, vibration: true, stickLayout: 'standard', bindings: { ...DEFAULT_BINDINGS } };
}

function defaultSettings() {
  return {
    gamePath: '', mapId: 'c1m1_hotel', mode: 'campaign', split: 'horizontal',
    player2Name: 'Player 2', movementSensitivity: 1, bigPictureMode: false,
    players: [defaultPlayer(), defaultPlayer()]
  };
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function normalizeSettings(input = {}) {
  const defaults = defaultSettings();
  const players = [0, 1].map((index) => {
    const source = input.players?.[index] || {};
    const bindings = {};
    for (const action of Object.keys(ACTIONS)) {
      const candidate = source.bindings?.[action];
      bindings[action] = BUTTONS.some(([token]) => token === candidate) ? candidate : DEFAULT_BINDINGS[action];
    }
    return {
      invertY: Boolean(source.invertY),
      invertX: Boolean(source.invertX),
      lookSensitivity: clamp(source.lookSensitivity, 0.4, 3, 1),
      vibration: source.vibration !== false,
      stickLayout: source.stickLayout === 'southpaw' ? 'southpaw' : 'standard',
      bindings
    };
  });
  return {
    gamePath: String(input.gamePath || ''),
    mapId: /^[A-Za-z0-9_-]+$/.test(input.mapId || '') ? input.mapId : defaults.mapId,
    mode: ['campaign', 'realism', 'survival', 'versus', 'scavenge'].includes(input.mode) ? input.mode : defaults.mode,
    split: input.split === 'vertical' ? 'vertical' : 'horizontal',
    player2Name: String(input.player2Name || defaults.player2Name).replace(/[";\r\n]/g, '').slice(0, 40) || defaults.player2Name,
    movementSensitivity: clamp(input.movementSensitivity, 0.5, 1.5, 1),
    bigPictureMode: input.bigPictureMode === true,
    players
  };
}

function playerConfig(player, index) {
  const command = `cmd${index + 1}`;
  const suffix = index === 0 ? '' : '2';
  const pitch = player.lookSensitivity.toFixed(2);
  const yaw = (-1.5 * player.lookSensitivity).toFixed(2);
  const lines = [
    `joy_inverty${suffix} "${player.invertY ? 1 : 0}"`,
    `joy_invertx${suffix} "${player.invertX ? 1 : 0}"`,
    `joy_pitchsensitivity${suffix} "${pitch}"`,
    `joy_yawsensitivity${suffix} "${yaw}"`,
    `joy_vibration${suffix} "${player.vibration ? 1 : 0}"`,
    `joy_movement_stick${suffix} "${player.stickLayout === 'southpaw' ? 1 : 0}"`,
    `${command} +jlook`
  ];
  for (const [action, engineCommand] of Object.entries(ACTIONS)) {
    lines.push(`${command} bind "${player.bindings[action]}" "${engineCommand}"`);
  }
  lines.push(`${command} bind "S1_UP" "+menuUp"`, `${command} bind "S1_DOWN" "+menuDown"`);
  return lines.join('\n');
}

function generateControllerConfig(rawSettings) {
  const settings = normalizeSettings(rawSettings);
  const movement = settings.movementSensitivity.toFixed(2);
  return `// Generated by L4D2 Native Split Screen. Safe to replace.\n` +
`joystick "1"
joy_advanced "1"
joy_name "Xbox Controller"
joy_advaxisx "3"
joy_advaxisy "1"
joy_advaxisz "0"
joy_advaxisr "2"
joy_advaxisu "4"
joy_advaxisv "0"
joy_forwardsensitivity "-${movement}"
joy_sidesensitivity "${movement}"
joy_forwardthreshold "0.15"
joy_sidethreshold "0.15"
joy_pitchthreshold "0.15"
joy_yawthreshold "0.15"
joy_response_move "5"
joy_response_look "1"
joy_variable_frametime "1"
joy_remap_player_for_controller1 "1"
joy_remap_player_for_controller2 "2"
joyadvancedupdate

// Player 1
${playerConfig(settings.players[0], 0)}

// Player 2
${playerConfig(settings.players[1], 1)}

alias "mss_reconnect" "connect_splitscreen localhost 2; wait 120; cmd2 +jlook"
`;
}

function generateSessionConfig(rawSettings) {
  const settings = normalizeSettings(rawSettings);
  const splitMode = settings.split === 'horizontal' ? 1 : 2;
  return `// Generated by L4D2 Native Split Screen. Safe to replace.\n` +
`con_enable "1"
joystick "1"
ss_enable "1"
ss_splitmode "${splitMode}"
name2 "${settings.player2Name}"
exec modern_ss_controllers.cfg
ss_map "${settings.mapId}" "${settings.mode}"; wait 300; connect_splitscreen localhost 2; wait 120; cmd2 +jlook
`;
}

function parseLibraryFolders(text) {
  return [...text.matchAll(/^\s*"path"\s*"(.+)"/gm)].map((match) => match[1].replace(/\\\\/g, '\\'));
}

function validGamePath(gamePath, platform = process.platform) {
  if (!gamePath || !fs.existsSync(path.join(gamePath, 'left4dead2'))) return false;
  const names = platform === 'win32' ? ['left4dead2.exe'] : ['left4dead2', 'left4dead2_linux', 'left4dead2.sh'];
  return names.some((name) => fs.existsSync(path.join(gamePath, name)));
}

function walkVpks(root, results = []) {
  if (!fs.existsSync(root)) return results;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) walkVpks(full, results);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.vpk')) results.push(full);
  }
  return results;
}

function scanAddonMaps(gamePath, platform = process.platform) {
  const found = new Set();
  const looseMaps = path.join(gamePath, 'left4dead2', 'maps');
  if (fs.existsSync(looseMaps)) {
    for (const name of fs.readdirSync(looseMaps)) if (name.toLowerCase().endsWith('.bsp')) found.add(path.parse(name).name);
  }
  const tools = platform === 'win32'
    ? [path.join(gamePath, 'bin', 'vpk.exe')]
    : [path.join(gamePath, 'bin', 'vpk_linux64'), path.join(gamePath, 'bin', 'vpk_linux32'), path.join(gamePath, 'bin', 'vpk')];
  const tool = tools.find(fs.existsSync);
  if (tool) {
    for (const vpk of walkVpks(path.join(gamePath, 'left4dead2', 'addons'))) {
      try {
        const listing = execFileSync(tool, ['l', vpk], { encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024 });
        for (const match of listing.matchAll(/(?:^|[\\/])maps[\\/]([^\\/]+)\.bsp$/gim)) found.add(match[1]);
      } catch { /* One broken add-on must not stop the scan. */ }
    }
  }
  const official = new Set(OFFICIAL_MAPS.map(([, , id]) => id));
  return [...found].filter((id) => !official.has(id)).sort((a, b) => a.localeCompare(b));
}

module.exports = {
  ACTIONS, BUTTONS, DEFAULT_BINDINGS, OFFICIAL_MAPS, defaultSettings, normalizeSettings,
  generateControllerConfig, generateSessionConfig, parseLibraryFolders, validGamePath, scanAddonMaps
};
