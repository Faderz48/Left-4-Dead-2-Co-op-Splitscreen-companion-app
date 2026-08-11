if (!window.launcher && location.protocol.startsWith('http')) {
  const defaultBindings = { jump:'A_BUTTON',reload:'B_BUTTON',use:'X_BUTTON',swap:'Y_BUTTON',fire:'R_TRIGGER',melee:'L_TRIGGER',quickTurn:'R_SHOULDER',crouch:'L_SHOULDER',vocalize:'STICK1',zoom:'STICK2',scores:'BACK',pause:'START',flashlight:'UP',grenade:'LEFT',health:'RIGHT',pills:'DOWN' };
  const demoSettings = { gamePath:'/home/player/.local/share/Steam/steamapps/common/Left 4 Dead 2',mapId:'c1m1_hotel',mode:'campaign',split:'horizontal',player2Name:'Player 2',movementSensitivity:1,bigPictureMode:false,players:[0,1].map(()=>({invertY:false,invertX:false,lookSensitivity:1,vibration:true,stickLayout:'standard',bindings:{...defaultBindings}})) };
  const demoMaps = [
    ['Dead Center','Hotel','c1m1_hotel'],['Dead Center','Streets','c1m2_streets'],['Dead Center','Mall','c1m3_mall'],['Dead Center','Atrium','c1m4_atrium'],
    ['Dark Carnival','Highway','c2m1_highway'],['Dark Carnival','Fairgrounds','c2m2_fairgrounds'],['Swamp Fever','Plank Country','c3m1_plankcountry'],
    ['Hard Rain','Milltown','c4m1_milltown_a'],['The Parish','Waterfront','c5m1_waterfront'],['The Passing','Riverbank','c6m1_riverbank'],
    ['The Sacrifice','Docks','c7m1_docks'],['No Mercy','Apartments','c8m1_apartment'],['Crash Course','Alleys','c9m1_alleys'],
    ['Death Toll','Turnpike','c10m1_caves'],['Dead Air','Greenhouse','c11m1_greenhouse'],['Blood Harvest','Woods','c12m1_hilltop'],
    ['Cold Stream','Alpine Creek','c13m1_alpinecreek'],['The Last Stand','Junkyard','c14m1_junkyard'],['The Last Stand','Lighthouse','c14m2_lighthouse']
  ];
  const demoButtons = [['A_BUTTON','A'],['B_BUTTON','B'],['X_BUTTON','X'],['Y_BUTTON','Y'],['R_TRIGGER','Right trigger'],['L_TRIGGER','Left trigger'],['R_SHOULDER','Right bumper'],['L_SHOULDER','Left bumper'],['STICK1','Left stick click'],['STICK2','Right stick click'],['BACK','View / Back'],['START','Menu / Start'],['UP','D-pad up'],['DOWN','D-pad down'],['LEFT','D-pad left'],['RIGHT','D-pad right']];
  window.launcher = { initialState:async()=>({settings:demoSettings,platform:'linux',maps:demoMaps,buttons:demoButtons,actions:Object.keys(defaultBindings)}),rendererReady:()=>{},chooseGame:async()=>'',scanMaps:async()=>['workshop_campaign_01','workshop_campaign_02'],saveSettings:async(s)=>s,setFullscreen:async(enabled)=>enabled,quitApp:()=>{ document.documentElement.dataset.demoQuitCalled = 'true'; },launchSession:async()=>({ok:true}) };
}

const actionLabels = {
  jump:'Jump / accept',reload:'Reload',use:'Use / interact',swap:'Swap weapon',fire:'Fire',melee:'Melee / shove',quickTurn:'Quick turn',crouch:'Crouch',
  vocalize:'Smart vocalize',zoom:'Scope / zoom',scores:'Scoreboard',pause:'Pause menu',flashlight:'Flashlight',grenade:'Grenade slot',health:'Health slot',pills:'Pills slot'
};

const campaignTaglines = {
  'Dead Center':'Prices are not the only things getting slashed.','Dark Carnival':'You must be this tall to die.','Swamp Fever':'The only cure is dying.',
  'Hard Rain':'Come hell and high water.','The Parish':'This time it all goes south.','The Passing':'Nobody survives forever.',
  'The Sacrifice':'It is your funeral.','No Mercy':'Curing the infection, one bullet at a time.','Crash Course':'Crashing will be the easy part.',
  'Death Toll':'Hell came to earth. These four are going to send it back.','Dead Air':'Their flight just got delayed permanently.',
  'Blood Harvest':'No hope. No cure. No problem.','Cold Stream':'The fields have eyes. The trees have ears.','The Last Stand':'It does not end well.'
};

let state;
let currentPlayer = 0;
let saveTimer;
let activeCampaign = '';
let customMaps = [];
let selectEditing = false;
const gamepadHeld = {};
const $ = (selector) => document.querySelector(selector);

function toast(message, error = false) {
  const element = $('#toast');
  element.textContent = message;
  element.className = error ? 'show error' : 'show';
  clearTimeout(element.timer);
  element.timer = setTimeout(() => { element.className = ''; }, 3600);
}

function campaignSlug(name) { return name.toLowerCase().replaceAll(' ', '_'); }

function officialCampaigns() {
  const grouped = new Map();
  for (const [campaign, chapter, id] of state.maps) {
    if (!grouped.has(campaign)) grouped.set(campaign, []);
    grouped.get(campaign).push([chapter, id]);
  }
  return [...grouped].map(([name, chapters]) => ({ name, chapters, official:true }));
}

function allCampaigns() {
  const campaigns = officialCampaigns();
  if (customMaps.length) campaigns.push({ name:'Installed Add-ons',chapters:customMaps.map((id)=>[id.replaceAll('_',' '),id]),official:false,addon:true });
  campaigns.push({ name:'Custom Map',chapters:[],official:false,custom:true });
  return campaigns;
}

function currentCampaign() { return allCampaigns().find((campaign) => campaign.name === activeCampaign) || allCampaigns()[0]; }

function collect() {
  state.settings.gamePath = $('#gamePath').value;
  if (activeCampaign === 'Custom Map') state.settings.mapId = $('#customMapId').value.trim() || 'custom_map';
  state.settings.player2Name = $('#player2Name').value;
  state.settings.movementSensitivity = Number($('#movementSensitivity').value);
  state.settings.bigPictureMode = $('#bigPictureMode').checked;
  const player = state.settings.players[currentPlayer];
  player.invertY = $('#invertY').checked;
  player.invertX = $('#invertX').checked;
  player.vibration = $('#vibration').checked;
  player.stickLayout = $('#stickLayout').value;
  player.lookSensitivity = Number($('#lookSensitivity').value);
  document.querySelectorAll('[data-action]').forEach((select) => { player.bindings[select.dataset.action] = select.value; });
  return state.settings;
}

function scheduleSave() {
  collect();
  $('#saveStatus').textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { state.settings = await window.launcher.saveSettings(state.settings); $('#saveStatus').textContent = 'Settings saved'; }
    catch { $('#saveStatus').textContent = 'Could not save settings'; }
  }, 350);
}

function renderCampaignGrid() {
  const root = $('#campaignGrid');
  root.textContent = '';
  allCampaigns().forEach((campaign, index) => {
    const button = document.createElement('button');
    button.className = `campaign-card${campaign.name === activeCampaign ? ' active' : ''}${campaign.official ? '' : ' custom-card'}`;
    button.dataset.campaign = campaign.name;
    button.setAttribute('aria-pressed', String(campaign.name === activeCampaign));
    if (campaign.official) {
      const source = `../../assets/posters/${campaignSlug(campaign.name)}.webp`;
      const image = document.createElement('img'); image.src = source; image.alt = '';
      button.appendChild(image);
    } else {
      const mark = document.createElement('div'); mark.className = 'custom-art'; mark.textContent = campaign.addon ? 'ADD-ONS' : '+'; button.appendChild(mark);
    }
    const copy = document.createElement('span');
    copy.innerHTML = `<b>${campaign.name}</b><small>${campaign.chapters.length || 'Any'} ${campaign.chapters.length === 1 ? 'chapter' : 'chapters'}</small>`;
    button.appendChild(copy);
    button.addEventListener('click', () => selectCampaign(campaign.name, true));
    button.addEventListener('focus', () => { if (activeCampaign !== campaign.name) selectCampaign(campaign.name, true); });
    root.appendChild(button);
    if (index === 0) button.dataset.firstCampaign = 'true';
  });
}

function selectCampaign(name, save = true) {
  activeCampaign = name;
  const campaign = currentCampaign();
  if (campaign.custom) {
    const known = state.maps.some(([, , id]) => id === state.settings.mapId) || customMaps.includes(state.settings.mapId);
    if (known) state.settings.mapId = $('#customMapId').value.trim() || 'custom_map';
    else $('#customMapId').value = state.settings.mapId;
  } else if (!campaign.chapters.some(([, id]) => id === state.settings.mapId)) {
    state.settings.mapId = campaign.chapters[0][1];
  }
  document.querySelectorAll('.campaign-card').forEach((card) => {
    const active = card.dataset.campaign === activeCampaign;
    card.classList.toggle('active', active); card.setAttribute('aria-pressed', String(active));
  });
  renderSelection();
  if (save) scheduleSave();
}

function renderSelection() {
  const campaign = currentCampaign();
  const chapterIndex = campaign.chapters.findIndex(([, id]) => id === state.settings.mapId);
  const chapter = chapterIndex >= 0 ? campaign.chapters[chapterIndex] : null;
  const image = $('#posterImage');
  const art = campaign.official ? `../../assets/posters/${campaignSlug(campaign.name)}.webp` : '';
  image.src = art; image.alt = art ? `${campaign.name} official campaign poster` : '';
  $('.selection-art').classList.toggle('custom', !campaign.official);
  $('#posterKicker').textContent = campaign.official ? 'OFFICIAL CAMPAIGN' : campaign.addon ? 'INSTALLED ADD-ONS' : 'CUSTOM CONTENT';
  $('#posterTitle').textContent = campaign.name;
  $('#posterTagline').textContent = campaignTaglines[campaign.name] || (campaign.addon ? 'Campaign maps discovered in your add-ons folder.' : 'Enter any valid map ID and start a local session.');
  $('#posterChapter').textContent = chapter ? `CHAPTER ${chapterIndex + 1} OF ${campaign.chapters.length}` : 'MANUAL MAP';
  $('#chapterName').textContent = chapter?.[0] || 'Custom map ID';
  $('#posterMapId').textContent = chapter?.[1] || ($('#customMapId').value.trim() || 'custom_map');
  $('#customMapWrap').classList.toggle('hidden', !campaign.custom);
  $('#previousChapter').disabled = campaign.chapters.length < 2;
  $('#nextChapter').disabled = campaign.chapters.length < 2;
  document.querySelectorAll('[data-mode]').forEach((button) => button.classList.toggle('active', button.dataset.mode === state.settings.mode));
  document.querySelectorAll('[data-split]').forEach((button) => button.classList.toggle('active', button.dataset.split === state.settings.split));
}

function stepChapter(direction) {
  const campaign = currentCampaign();
  if (campaign.chapters.length < 2) return;
  let index = campaign.chapters.findIndex(([, id]) => id === state.settings.mapId);
  index = (index + direction + campaign.chapters.length) % campaign.chapters.length;
  state.settings.mapId = campaign.chapters[index][1];
  renderSelection(); scheduleSave();
}

function renderBindings() {
  const root = $('#bindings'); root.textContent = '';
  const player = state.settings.players[currentPlayer];
  for (const action of state.actions) {
    const row = document.createElement('div'); row.className = 'binding';
    const label = document.createElement('label'); label.textContent = actionLabels[action] || action;
    const select = document.createElement('select'); select.dataset.action = action;
    for (const [token, name] of state.buttons) {
      const option = document.createElement('option'); option.value = token; option.textContent = name; option.selected = player.bindings[action] === token; select.appendChild(option);
    }
    select.addEventListener('change', () => { checkDuplicates(); scheduleSave(); });
    row.append(label, select); root.appendChild(row);
  }
  checkDuplicates();
}

function checkDuplicates() {
  const values = [...document.querySelectorAll('[data-action]')].map((select) => select.value);
  $('#duplicateWarning').textContent = values.some((value, index) => values.indexOf(value) !== index) ? 'Duplicate button: the later action wins' : '';
}

function renderPlayer() {
  const player = state.settings.players[currentPlayer];
  $('#invertY').checked = player.invertY; $('#invertX').checked = player.invertX; $('#vibration').checked = player.vibration;
  $('#stickLayout').value = player.stickLayout; $('#lookSensitivity').value = player.lookSensitivity;
  $('#lookValue').textContent = `${Number(player.lookSensitivity).toFixed(2)}×`; renderBindings();
}

function updateControllerStatus() {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  [...document.querySelectorAll('#controllerDots i')].forEach((dot, index) => dot.classList.toggle('on', Boolean(pads[index])));
  $('#controllerStatus').textContent = pads.length >= 2 ? `${pads.length} gamepads ready` : pads.length === 1 ? '1 gamepad · connect one more' : 'Connect two gamepads';
}

function setView(view) {
  document.querySelectorAll('.nav,.view').forEach((element) => element.classList.remove('active'));
  const nav = document.querySelector(`.nav[data-view="${view}"]`); nav.classList.add('active'); $(`#view-${view}`).classList.add('active');
  selectEditing = false;
}

function visibleFocusables() {
  return [...document.querySelectorAll('button:not(:disabled),input:not([type="hidden"]),select,[tabindex="0"]')].filter((element) => {
    const rect = element.getBoundingClientRect(); const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  });
}

function moveFocus(direction) {
  const active = document.activeElement;
  if (active instanceof HTMLSelectElement && selectEditing) {
    const delta = direction === 'left' || direction === 'up' ? -1 : 1;
    active.selectedIndex = Math.max(0, Math.min(active.options.length - 1, active.selectedIndex + delta));
    active.dispatchEvent(new Event('change', { bubbles:true })); return;
  }
  if (active instanceof HTMLInputElement && active.type === 'range' && (direction === 'left' || direction === 'right')) {
    const delta = Number(active.step || 1) * (direction === 'left' ? -1 : 1);
    active.value = String(Math.max(Number(active.min), Math.min(Number(active.max), Number(active.value) + delta)));
    active.dispatchEvent(new Event('input', { bubbles:true })); return;
  }
  const elements = visibleFocusables();
  const origin = elements.includes(active) ? active : document.querySelector('.campaign-card.active') || elements[0];
  if (!origin) return;
  const from = origin.getBoundingClientRect(); const fx = from.left + from.width / 2; const fy = from.top + from.height / 2;
  let best; let bestScore = Infinity;
  for (const candidate of elements) {
    if (candidate === origin) continue;
    const rect = candidate.getBoundingClientRect(); const cx = rect.left + rect.width / 2; const cy = rect.top + rect.height / 2;
    const dx = cx - fx; const dy = cy - fy;
    const valid = direction === 'left' ? dx < -8 : direction === 'right' ? dx > 8 : direction === 'up' ? dy < -8 : dy > 8;
    if (!valid) continue;
    const primary = direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy);
    const cross = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = primary + cross * 2.4;
    if (score < bestScore) { best = candidate; bestScore = score; }
  }
  if (best) {
    if (best.classList.contains('campaign-card') && activeCampaign !== best.dataset.campaign) selectCampaign(best.dataset.campaign, true);
    best.focus({ preventScroll:true }); best.scrollIntoView({ block:'nearest',inline:'nearest' });
  }
}

function activateFocused() {
  const active = document.activeElement;
  if (active instanceof HTMLSelectElement) { selectEditing = !selectEditing; active.classList.toggle('gamepad-editing', selectEditing); return; }
  if (active instanceof HTMLButtonElement || active.matches('[tabindex="0"]')) active.click();
}

function backAction() {
  if (selectEditing) { selectEditing = false; document.activeElement.classList.remove('gamepad-editing'); return; }
  if (!$('#view-setup').classList.contains('active')) { setView('setup'); document.querySelector('.campaign-card.active')?.focus(); }
  else document.querySelector('.campaign-card.active')?.focus();
}

function cycleView(delta) {
  const navs = [...document.querySelectorAll('.nav')]; const index = navs.findIndex((nav) => nav.classList.contains('active'));
  const next = navs[(index + delta + navs.length) % navs.length]; setView(next.dataset.view); next.focus();
}

function gamepadAction(name, pressed, action) {
  const now = Date.now(); const held = gamepadHeld[name];
  if (pressed && (!held || now >= held)) { action(); gamepadHeld[name] = now + (held ? 125 : 320); }
  if (!pressed) delete gamepadHeld[name];
}

function pollGamepad() {
  const pad = navigator.getGamepads?.()[0];
  if (pad) {
    gamepadAction('left',pad.buttons[14]?.pressed || pad.axes[0] < -.55,()=>moveFocus('left'));
    gamepadAction('right',pad.buttons[15]?.pressed || pad.axes[0] > .55,()=>moveFocus('right'));
    gamepadAction('up',pad.buttons[12]?.pressed || pad.axes[1] < -.55,()=>moveFocus('up'));
    gamepadAction('down',pad.buttons[13]?.pressed || pad.axes[1] > .55,()=>moveFocus('down'));
    gamepadAction('accept',pad.buttons[0]?.pressed,activateFocused);
    gamepadAction('back',pad.buttons[1]?.pressed,backAction);
    gamepadAction('lb',pad.buttons[4]?.pressed,()=>cycleView(-1));
    gamepadAction('rb',pad.buttons[5]?.pressed,()=>cycleView(1));
    gamepadAction('start',pad.buttons[9]?.pressed,()=>$('#launch').click());
    gamepadAction('exitfocus',pad.buttons[8]?.pressed,()=>$('#exitApp').focus());
  }
  requestAnimationFrame(pollGamepad);
}

async function initialize() {
  try {
    state = await window.launcher.initialState(); const s = state.settings;
    $('#platformBadge').textContent = state.platform === 'win32' ? 'WINDOWS · X64' : 'LINUX · X64';
    $('#gamePath').value = s.gamePath; $('#player2Name').value = s.player2Name; $('#movementSensitivity').value = s.movementSensitivity; $('#bigPictureMode').checked = s.bigPictureMode;
    $('#movementValue').textContent = `${Number(s.movementSensitivity).toFixed(2)}×`;
    const install = $('#installState'); install.className = s.gamePath ? 'install-state ok' : 'install-state bad';
    install.innerHTML = s.gamePath ? '<b>Installation ready</b><span>Native game files detected</span>' : '<b>Installation not found</b><span>Select the main L4D2 folder</span>';
    const match = state.maps.find(([, , id]) => id === s.mapId); activeCampaign = match?.[0] || 'Custom Map';
    if (!match) $('#customMapId').value = s.mapId;
    renderCampaignGrid(); renderSelection(); renderPlayer(); updateControllerStatus();
    document.querySelectorAll('.toggle-row').forEach((label) => { label.tabIndex = 0; label.setAttribute('role','switch'); });
    setInterval(updateControllerStatus, 1000); requestAnimationFrame(pollGamepad);
  } catch (error) { toast(error.message || String(error), true); }
  finally { window.launcher.rendererReady(); }
}

document.querySelectorAll('.nav').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
$('#exitApp').addEventListener('click', () => window.launcher.quitApp());
$('#campaignGrid').addEventListener('focusin', (event) => {
  const card = event.target.closest('.campaign-card');
  if (card && activeCampaign !== card.dataset.campaign) selectCampaign(card.dataset.campaign, true);
});
document.querySelectorAll('.mode-chip').forEach((button) => button.addEventListener('click', () => { state.settings.mode = button.dataset.mode; renderSelection(); scheduleSave(); }));
document.querySelectorAll('[data-split]').forEach((button) => button.addEventListener('click', () => { state.settings.split = button.dataset.split; renderSelection(); scheduleSave(); }));
$('#previousChapter').addEventListener('click', () => stepChapter(-1)); $('#nextChapter').addEventListener('click', () => stepChapter(1));

document.querySelectorAll('.player-tab').forEach((button) => button.addEventListener('click', () => {
  collect(); currentPlayer = Number(button.dataset.player); document.querySelectorAll('.player-tab').forEach((tab) => tab.classList.toggle('active', tab === button)); renderPlayer();
}));

$('#browseGame').addEventListener('click', async () => {
  try { const selected = await window.launcher.chooseGame(); if (selected) { $('#gamePath').value = selected; state.settings.gamePath = selected; $('#installState').className = 'install-state ok'; $('#installState').innerHTML = '<b>Installation ready</b><span>Native game files detected</span>'; scheduleSave(); } }
  catch (error) { toast(error.message, true); }
});

$('#scanMaps').addEventListener('click', async () => {
  const button = $('#scanMaps'); button.disabled = true; button.textContent = 'Scanning…';
  try { collect(); customMaps = await window.launcher.scanMaps($('#gamePath').value); renderCampaignGrid(); if (customMaps.length) selectCampaign('Installed Add-ons', true); toast(`Found ${customMaps.length} add-on map${customMaps.length === 1 ? '' : 's'}.`); }
  catch (error) { toast(error.message, true); }
  finally { button.disabled = false; button.textContent = 'Scan add-ons'; }
});

$('#copyProfile').addEventListener('click', () => { collect(); state.settings.players[1] = JSON.parse(JSON.stringify(state.settings.players[0])); if (currentPlayer === 1) renderPlayer(); scheduleSave(); toast('Player 1 controls copied to Player 2.'); });
$('#resetControls').addEventListener('click', () => {
  state.settings.players = state.settings.players.map(() => ({ invertY:false,invertX:false,lookSensitivity:1,vibration:true,stickLayout:'standard',bindings:{ jump:'A_BUTTON',reload:'B_BUTTON',use:'X_BUTTON',swap:'Y_BUTTON',fire:'R_TRIGGER',melee:'L_TRIGGER',quickTurn:'R_SHOULDER',crouch:'L_SHOULDER',vocalize:'STICK1',zoom:'STICK2',scores:'BACK',pause:'START',flashlight:'UP',grenade:'LEFT',health:'RIGHT',pills:'DOWN' } }));
  renderPlayer(); scheduleSave(); toast('Controller profiles reset.');
});

$('#lookSensitivity').addEventListener('input', () => { $('#lookValue').textContent = `${Number($('#lookSensitivity').value).toFixed(2)}×`; scheduleSave(); });
$('#movementSensitivity').addEventListener('input', () => { $('#movementValue').textContent = `${Number($('#movementSensitivity').value).toFixed(2)}×`; scheduleSave(); });
$('#bigPictureMode').addEventListener('change', async () => {
  state.settings.bigPictureMode = $('#bigPictureMode').checked;
  try { await window.launcher.setFullscreen(state.settings.bigPictureMode); scheduleSave(); }
  catch (error) { toast(error.message || 'Could not change display mode.', true); }
});
$('#customMapId').addEventListener('input', () => { if (activeCampaign === 'Custom Map') { state.settings.mapId = $('#customMapId').value.trim() || 'custom_map'; renderSelection(); scheduleSave(); } });
document.querySelectorAll('input:not([type=range]),select').forEach((element) => element.addEventListener('change', scheduleSave));
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === 'q') { event.preventDefault(); window.launcher.quitApp(); return; }
  if (event.key === 'F11') { event.preventDefault(); $('#bigPictureMode').checked = !$('#bigPictureMode').checked; $('#bigPictureMode').dispatchEvent(new Event('change', { bubbles:true })); return; }
  if (event.key === 'Escape') { event.preventDefault(); backAction(); return; }
  if ((event.key === 'Enter' || event.key === ' ') && (document.activeElement instanceof HTMLButtonElement || document.activeElement?.classList.contains('toggle-row'))) {
    event.preventDefault(); document.activeElement.click(); return;
  }
  if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
  if (document.activeElement instanceof HTMLInputElement && document.activeElement.type !== 'range') return;
  if (document.activeElement instanceof HTMLSelectElement) return;
  event.preventDefault(); moveFocus(event.key.replace('Arrow','').toLowerCase());
});

$('#launch').addEventListener('click', async () => {
  const button = $('#launch'); button.disabled = true; $('#saveStatus').textContent = 'Preparing native session…';
  try { await window.launcher.launchSession(collect()); toast('L4D2 is starting. Both controllers should already be connected.'); $('#saveStatus').textContent = 'Game launched'; }
  catch (error) { toast(error.message || String(error), true); $('#saveStatus').textContent = 'Could not start the game'; }
  finally { setTimeout(() => { button.disabled = false; }, 1500); }
});

window.addEventListener('gamepadconnected', () => { updateControllerStatus(); document.querySelector('.campaign-card.active')?.focus(); });
window.addEventListener('gamepaddisconnected', updateControllerStatus);
initialize();
