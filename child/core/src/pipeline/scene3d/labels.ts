import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Vector3 } from 'three';
import { beforeNeutral } from './tone';

const SANS = "Inter, 'Segoe UI', system-ui, sans-serif";
const MONO = "ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace";
/** Font size on the canvas, in pixels. */
const PX = 96;

/**
 * Text lives on its own layer, which the main camera also renders. Other
 * cameras (the contact shadows) and the pointer raycaster leave it out.
 */
export const LABEL_LAYER = 1;

export interface TextStyle {
  /** Font size in diagram units, as in the 2D view. */
  size: number;
  color: string;
  weight?: number;
  mono?: boolean;
  /** Letter spacing in diagram units. */
  spacing?: number;
  anchor?: 'start' | 'middle';
}

/**
 * Text lying flat, reading from the south like the 2D drawing. `at` is where
 * the 2D view puts the text: its baseline, at the start or the middle.
 * rot is the 2D rotation in degrees (clockwise).
 */
export function flatText(text: string, at: Vector3, rot: number, style: TextStyle, anisotropy: number): Mesh<PlaneGeometry, MeshBasicMaterial> {
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d')!;
  const font = `${style.weight ?? 500} ${PX}px ${style.mono ? MONO : SANS}`;
  const k = style.size / PX; // diagram units per canvas pixel
  const spacing = (style.spacing ?? 0) / k;
  const chars = [...text];
  g.font = font;
  const widths = chars.map((ch) => g.measureText(ch).width);
  const pad = PX * 0.2;
  canvas.width = Math.ceil(widths.reduce((s, w) => s + w, 0) + spacing * (chars.length - 1) + pad * 2);
  canvas.height = Math.ceil(PX * 1.4);

  g.font = font;
  // So the tone curve leaves the text in its own colour.
  g.fillStyle = `#${beforeNeutral(style.color).getHexString()}`;
  g.textBaseline = 'middle';
  let x = pad;
  chars.forEach((ch, i) => {
    g.fillText(ch, x, canvas.height / 2);
    x += widths[i] + spacing;
  });

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = anisotropy;
  const w = canvas.width * k;
  const geo = new PlaneGeometry(w, canvas.height * k);
  geo.translate(style.anchor === 'start' ? w / 2 - pad * k : 0, style.size * 0.32, 0);
  const mesh = new Mesh(geo, new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  mesh.position.copy(at);
  mesh.rotation.set(-Math.PI / 2, (-rot * Math.PI) / 180, 0, 'YXZ');
  mesh.layers.set(LABEL_LAYER);
  return mesh;
}
