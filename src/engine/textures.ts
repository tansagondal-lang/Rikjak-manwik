import * as THREE from 'three';

const textureCache = new Map<string, THREE.CanvasTexture>();

function createCanvasTexture(
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeatX = 1,
  repeatY = 1,
  isColor = true,
): THREE.CanvasTexture {
  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, width, height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.magFilter = THREE.NearestFilter; // Crisp blocky pixel-voxel feel + low memory
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;

  textureCache.set(key, tex);
  return tex;
}

export function getAsphaltTexture(roadColor: string): THREE.CanvasTexture {
  return createCanvasTexture(`asphalt_${roadColor}`, 64, 64, (ctx, w, h) => {
    ctx.fillStyle = roadColor;
    ctx.fillRect(0, 0, w, h);

    // Subtle blocky asphalt noise (8x8 blocks)
    for (let y = 0; y < h; y += 8) {
      for (let x = 0; x < w; x += 8) {
        const shade = ((x * 7 + y * 13) % 16) - 8;
        ctx.fillStyle = shade > 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)';
        ctx.fillRect(x, y, 8, 8);
      }
    }

    // Crisp shoulder white lines
    ctx.fillStyle = 'rgba(248, 250, 252, 0.72)';
    ctx.fillRect(2, 0, 3, h);
    ctx.fillRect(w - 5, 0, 3, h);

    // Center dashed line
    ctx.fillStyle = 'rgba(250, 204, 21, 0.82)';
    ctx.fillRect(w / 2 - 2, 4, 4, 24);
  });
}

export function getCurbTexture(colorA: string, colorB: string): THREE.CanvasTexture {
  return createCanvasTexture(`curb_${colorA}_${colorB}`, 32, 64, (ctx, w, h) => {
    ctx.fillStyle = colorA;
    ctx.fillRect(0, 0, w, h / 2);
    ctx.fillStyle = colorB;
    ctx.fillRect(0, h / 2, w, h / 2);
  });
}

export function getCheckerTexture(): THREE.CanvasTexture {
  return createCanvasTexture('checker_start', 64, 32, (ctx, w, h) => {
    const size = 8;
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        const even = ((x / size) + (y / size)) % 2 === 0;
        ctx.fillStyle = even ? '#f8fafc' : '#0f172a';
        ctx.fillRect(x, y, size, size);
      }
    }
  });
}

export function getGroundTexture(baseColor: string): THREE.CanvasTexture {
  return createCanvasTexture(
    `ground_${baseColor}`,
    64,
    64,
    (ctx, w, h) => {
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) {
        for (let x = 0; x < w; x += 16) {
          const v = ((x * 3 + y * 5) % 9) - 4;
          ctx.fillStyle = v > 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
          ctx.fillRect(x, y, 16, 16);
        }
      }
    },
    48,
    48,
  );
}

export function getContactShadowTexture(): THREE.CanvasTexture {
  return createCanvasTexture(
    'contact_shadow',
    64,
    64,
    (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.58)');
      grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.25)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    },
    1,
    1,
    false,
  );
}

export function disposeCachedTextures(): void {
  textureCache.forEach((tex) => tex.dispose());
  textureCache.clear();
}
