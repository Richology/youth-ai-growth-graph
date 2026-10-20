import * as THREE from 'three';

// Detailed emission plates sit at separate depths; real star particles and
// graph nodes remain independent of the texture and respond to the camera.
const hash = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
function noise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  let u = x - ix, v = y - iy;
  u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u),
    THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u), v);
}
export function nebulaCloud(color: string, seed: number, map: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  for (let layer = 0; layer < 3; layer++) {
    const material = new THREE.SpriteMaterial({ map, color: new THREE.Color(layer === 2 ? '#6586bd' : color).lerp(new THREE.Color('#e0eaff'), layer === 0 ? .18 : 0),
      transparent: true, opacity: layer === 0 ? (seed === 2 ? .56 : .68) : layer === 1 ? .13 : .12,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      rotation: [0.35, -0.65, 2.4, 1.1][seed - 1] + layer * 1.3 });
    // Suppress the black plate's alpha as well as its RGB. Otherwise the
    // transparent WebGL canvas exposes rotated rectangular silhouettes.
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #include <map_fragment>
        float lightness = max(sampledDiffuseColor.r, max(sampledDiffuseColor.g, sampledDiffuseColor.b));
        float border = min(min(vMapUv.x, 1.0-vMapUv.x), min(vMapUv.y, 1.0-vMapUv.y));
        diffuseColor.a *= smoothstep(0.005, 0.18, lightness) * smoothstep(0.0, 0.12, border);
      `);
    };
    material.userData.baseOpacity = material.opacity;
    const plate = new THREE.Sprite(material);
    plate.position.set(layer * .28, layer * -.18, -1.8 - layer * 1.25);
    plate.scale.set((9.3 + layer * 1.7) * [1.12, .98, 1.06, 1][seed - 1], 8.3 + layer * 1.5, 1);
    group.add(plate);
  }
  const positions: number[] = [], colors: number[] = [], sizes: number[] = [];
  const tint = new THREE.Color(color);
  for (let i = 0; i < 4800; i++) {
    const angle = hash(i, seed) * Math.PI * 2;
    const radius = .5 + Math.sqrt(hash(i + 4000, seed)) * 4.1;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius * .86;
    if (noise(x * 1.6 + seed * 13, y * 1.6) < .38) continue;
    positions.push(x, y, -2.2 + hash(i, seed + 20) * 2.5);
    const luminosity = .18 + Math.pow(hash(i, seed + 40), 3) * .65;
    sizes.push(.7 + Math.pow(hash(i, seed + 70), 5) * 2.8);
    const c = tint.clone().lerp(new THREE.Color('#c8d8ed'), .5).multiplyScalar(luminosity);
    colors.push(c.r, c.g, c.b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('starSize', new THREE.Float32BufferAttribute(sizes, 1));
  group.add(new THREE.Points(geometry, new THREE.ShaderMaterial({
    uniforms: { focusOpacity: { value: 1 }, pixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: `
      attribute float starSize;
      attribute vec3 color;
      uniform float pixelRatio;
      varying vec3 starlight;
      void main() {
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        starlight = color;
        gl_Position = projectionMatrix * p;
        gl_PointSize = max(1.0, starSize * pixelRatio * clamp(20.0 / -p.z, 0.6, 1.8));
      }
    `,
    fragmentShader: `
      uniform float focusOpacity;
      varying vec3 starlight;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float light = exp(-r*r*3.8) * (1.0-smoothstep(0.7,1.0,r));
        gl_FragColor = vec4(starlight, light * .72 * focusOpacity);
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
  })));
  return group;
}
