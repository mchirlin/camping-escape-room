// ============================================================
// Onboarding Overlay — welcome / tutorial shown on first load
// ============================================================
// Blocks the map until the player picks an avatar, (optionally) enters a
// name, and reads a short how-to. Whether a player has seen this is tracked
// persistently in Firestore (players/{id}.onboardedAt) and can be reset by
// an admin. localStorage is used only as a fast local cache.
// ============================================================

import { MARKER_TAGS, type MarkerTag } from './markers';

const SKINS = ['alex', 'steve', 'ari', 'efe', 'kai', 'makena', 'noor', 'sunny', 'zuri'];
const SKIN_LABELS: Record<string, string> = {
  alex: 'Alex', steve: 'Steve', ari: 'Ari', efe: 'Efe',
  kai: 'Kai', makena: 'Makena', noor: 'Noor', sunny: 'Sunny', zuri: 'Zuri',
};

export interface OnboardingOptions {
  atlas: HTMLImageElement;
  manifest: Record<string, { x: number; y: number; w: number; h: number }>;
  initialAvatar: string;
  initialName: string;
  /** Called when the player taps "Start Exploring". */
  onComplete: (avatar: string, name: string) => void;
}

/** Build 16x16 data URLs for each skin face from the atlas. */
function buildFaceUrls(
  atlas: HTMLImageElement,
  manifest: Record<string, { x: number; y: number; w: number; h: number }>
): Record<string, string> {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  const urls: Record<string, string> = {};
  for (const skin of SKINS) {
    const entry = manifest[`player_${skin}`];
    if (!entry) continue;
    ctx.clearRect(0, 0, 16, 16);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(atlas, entry.x, entry.y, entry.w, entry.h, 0, 0, 16, 16);
    urls[skin] = canvas.toDataURL();
  }
  return urls;
}

/** HTML for a small example item marker (gray inventory slot). */
function itemExampleHtml(tag: MarkerTag): string {
  const info = MARKER_TAGS.find((t) => t.tag === tag);
  const tex = info?.texture ?? '';
  return `<div style="width:34px;height:34px;flex:none;background:#8b8b8b;border:2px solid;border-color:#555 #fff #fff #555;display:flex;align-items:center;justify-content:center;">
    <img src="${tex}" style="width:26px;height:26px;object-fit:contain;image-rendering:pixelated;">
  </div>`;
}

/** HTML for a small example location marker (colored pin). */
function locationExampleHtml(tag: MarkerTag): string {
  const info = MARKER_TAGS.find((t) => t.tag === tag);
  const tex = info?.texture ?? '';
  const color = info?.color ?? '#FFAA00';
  return `<div style="position:relative;width:38px;height:46px;flex:none;">
    <div style="width:38px;height:38px;background:${color};border:3px solid #fff;box-sizing:border-box;display:flex;align-items:center;justify-content:center;">
      <div style="width:28px;height:28px;background:#2a2a2a;display:flex;align-items:center;justify-content:center;">
        <img src="${tex}" style="width:24px;height:24px;object-fit:contain;image-rendering:pixelated;">
      </div>
    </div>
    <div style="position:absolute;left:50%;top:36px;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:9px solid ${color};"></div>
  </div>`;
}

/**
 * Show the onboarding overlay. Returns a function that removes it early
 * (e.g. if the admin resets while it's open — not typically needed).
 */
export function showOnboarding(opts: OnboardingOptions): () => void {
  const faceUrls = buildFaceUrls(opts.atlas, opts.manifest);
  let selectedSkin = opts.initialAvatar || 'alex';

  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;
    background:rgba(20,16,10,0.92);padding:16px;overflow:auto;
  `;

  const panel = document.createElement('div');
  panel.style.cssText = `
    background:#c6a264;border:4px solid #5a3d20;border-radius:6px;
    max-width:420px;width:100%;max-height:100%;overflow:auto;
    padding:18px;box-sizing:border-box;color:#2a2a2a;
    font-family:var(--mc-font),'Press Start 2P',monospace;
    image-rendering:pixelated;
  `;

  // Face options grid
  const faceGrid = SKINS.map((skin) => {
    const url = faceUrls[skin] ?? '';
    const sel = skin === selectedSkin;
    return `<button class="ob-skin" data-skin="${skin}" title="${SKIN_LABELS[skin]}" aria-label="${SKIN_LABELS[skin]}"
      style="width:44px;height:44px;padding:3px;cursor:pointer;image-rendering:pixelated;
      background:#1a1a1a;border:3px solid ${sel ? '#5b8731' : 'transparent'};border-radius:3px;">
      <img src="${url}" style="width:100%;height:100%;image-rendering:pixelated;">
    </button>`;
  }).join('');

  panel.innerHTML = `
    <div style="font-size:13px;line-height:1.6;margin-bottom:12px;text-align:center;color:#3a2812;">
      Welcome, Explorer!
    </div>

    <div style="font-size:7px;color:#5a3d20;margin-bottom:4px;">CHOOSE YOUR CHARACTER</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:5px;justify-items:center;margin-bottom:12px;">
      ${faceGrid}
    </div>

    <div style="font-size:7px;color:#5a3d20;margin-bottom:4px;">YOUR NAME</div>
    <input id="ob-name" type="text" maxlength="16" placeholder="Enter name" value="${opts.initialName.replace(/"/g, '&quot;')}"
      style="width:100%;box-sizing:border-box;font-family:inherit;font-size:9px;padding:8px;margin-bottom:14px;
      background:#efe4c8;color:#2a2a2a;border:2px solid #5a3d20;border-radius:3px;">

    <div style="font-size:7px;color:#5a3d20;margin-bottom:6px;">HOW THE MAP WORKS</div>
    <div style="display:flex;flex-direction:column;gap:12px;background:#efe4c8;border:2px solid #5a3d20;border-radius:4px;padding:12px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:44px;flex:none;display:flex;align-items:center;justify-content:center;font-size:20px;">🚶</div>
        <div style="font-size:8px;line-height:1.6;">The map uncovers as you walk. Work together with your friends to reveal the whole map!</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:44px;flex:none;display:flex;align-items:center;justify-content:center;">${itemExampleHtml('diamond')}</div>
        <div style="font-size:8px;line-height:1.6;">Collectible items look like this — a gray slot with the item inside.</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:44px;flex:none;display:flex;align-items:center;justify-content:center;font-size:20px;">👆</div>
        <div style="font-size:8px;line-height:1.6;">Tap an item when you're close to collect it.</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:44px;flex:none;display:flex;align-items:center;justify-content:center;">${locationExampleHtml('crafting')}</div>
        <div style="font-size:8px;line-height:1.6;">Locations look like this — a colored pin with a label.</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:44px;flex:none;display:flex;align-items:center;justify-content:center;font-size:20px;">🗺️</div>
        <div style="font-size:8px;line-height:1.6;">Visit locations to move forward on your quest!</div>
      </div>
    </div>

    <button id="ob-start"
      style="width:100%;font-family:inherit;font-size:11px;padding:12px;cursor:pointer;
      background:#5b8731;color:#fff;border:none;border-bottom:4px solid #3c5a1f;border-radius:3px;">
      Start Exploring
    </button>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Wire skin selection
  const nameInput = panel.querySelector('#ob-name') as HTMLInputElement;
  panel.querySelectorAll<HTMLButtonElement>('.ob-skin').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedSkin = btn.dataset.skin!;
      panel.querySelectorAll<HTMLButtonElement>('.ob-skin').forEach((b) => {
        b.style.borderColor = 'transparent';
      });
      btn.style.borderColor = '#5b8731';
    });
  });

  const finish = () => {
    const name = nameInput.value.trim();
    overlay.remove();
    opts.onComplete(selectedSkin, name);
  };

  panel.querySelector('#ob-start')!.addEventListener('click', finish);

  return () => overlay.remove();
}
