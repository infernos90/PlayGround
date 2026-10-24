import * as THREE from 'three'
import {
  concrete, metal, hazard, grating, stripeEmissive, windowGrid,
  softCircle, grassPatch
} from './textures.js'

const V = new THREE.Vector3()

function mat(map, opts = {}) {
  return new THREE.MeshStandardMaterial({
    map,
    roughness: opts.roughness ?? 0.9,
    metalness: opts.metalness ?? 0.05,
    color: opts.color ?? 0xffffff,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    envMapIntensity: opts.envMapIntensity ?? 0.55,
    ...opts.extra
  })
}

function tiled(tex, x, y) {
  const t = tex.clone()
  t.needsUpdate = true
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(x, y)
  return t
}

export function buildWorld(scene, renderer) {
  const colliders = []
  const hitMeshes = []
  const dynamic = []
  const lamps = []
  const smokeStacks = []
  let lightningHandler = null

  const root = new THREE.Group()
  scene.add(root)

  const addCollider = (mesh, pad = 0) => {
    mesh.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(mesh)
    if (pad) box.expandByScalar(pad)
    colliders.push(box)
    return box
  }

  const addMesh = (geo, material, x, y, z, opts = {}) => {
    const m = new THREE.Mesh(geo, material)
    m.position.set(x, y, z)
    if (opts.rotY) m.rotation.y = opts.rotY
    if (opts.rotX) m.rotation.x = opts.rotX
    if (opts.rotZ) m.rotation.z = opts.rotZ
    m.castShadow = opts.castShadow ?? true
    m.receiveShadow = opts.receiveShadow ?? true
    root.add(m)
    if (opts.collide) addCollider(m)
    if (opts.hit !== false) hitMeshes.push(m)
    return m
  }

  // ---------- sky ----------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x02040a) },
      mid: { value: new THREE.Color(0x0a1622) },
      horizon: { value: new THREE.Color(0x1b2a38) },
      glow: { value: new THREE.Color(0x55260c) }
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 glow;
      varying vec3 vPos;
      void main() {
        vec3 d = normalize(vPos);
        float h = clamp(d.y, -1.0, 1.0);
        vec3 col = mix(horizon, mid, smoothstep(-0.02, 0.28, h));
        col = mix(col, top, smoothstep(0.2, 0.85, h));
        float g = pow(max(0.0, 1.0 - abs(h) * 2.2), 4.0);
        float side = smoothstep(-0.7, 0.9, d.x);
        col += glow * g * (0.25 + side * 0.75);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 24), skyMat)
  sky.frustumCulled = false
  scene.add(sky)

  const starGeo = new THREE.BufferGeometry()
  const starCount = 900
  const starPos = new Float32Array(starCount * 3)
  const starCol = new Float32Array(starCount * 3)
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(Math.random() * 0.92)
    const r = 120
    const x = r * Math.sin(phi) * Math.cos(theta)
    const y = r * Math.cos(phi) + 4
    const z = r * Math.sin(phi) * Math.sin(theta)
    starPos[i * 3] = x
    starPos[i * 3 + 1] = y
    starPos[i * 3 + 2] = z
    const c = new THREE.Color().setHSL(0.55 + Math.random() * 0.1, 0.25, 0.65 + Math.random() * 0.3)
    starCol[i * 3] = c.r
    starCol[i * 3 + 1] = c.g
    starCol[i * 3 + 2] = c.b
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3))
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    size: 0.85, vertexColors: true, transparent: true, opacity: 0.7,
    sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending
  }))
  scene.add(stars)

  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(4.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xdbe7ff, fog: false })
  )
  moon.position.set(-48, 46, -92)
  moon.lookAt(0, 0, 0)
  scene.add(moon)
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softCircle(0.05), color: 0x88aaff, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  }))
  moonGlow.position.copy(moon.position)
  moonGlow.scale.setScalar(26)
  scene.add(moonGlow)

  // ---------- fog / global lights ----------
  scene.fog = new THREE.FogExp2(0x0a121b, 0.0082)
  const hemi = new THREE.HemisphereLight(0x9cc2e4, 0x24211c, 0.46)
  scene.add(hemi)
  scene.add(new THREE.AmbientLight(0x46586b, 0.24))

  const moonLight = new THREE.DirectionalLight(0xcddfff, 3.25)
  moonLight.position.set(-32, 44, -26)
  moonLight.castShadow = true
  moonLight.shadow.mapSize.set(2048, 2048)
  moonLight.shadow.camera.left = -46
  moonLight.shadow.camera.right = 46
  moonLight.shadow.camera.top = 46
  moonLight.shadow.camera.bottom = -46
  moonLight.shadow.camera.near = 1
  moonLight.shadow.camera.far = 130
  moonLight.shadow.bias = -0.0006
  moonLight.shadow.normalBias = 0.035
  scene.add(moonLight)
  scene.add(moonLight.target)

  const fill = new THREE.DirectionalLight(0xff7a2a, 0.3)
  fill.position.set(30, 10, 20)
  scene.add(fill)
const fillCool = new THREE.DirectionalLight(0x86b4e0, 0.38)
fillCool.position.set(18, 14, 30)
scene.add(fillCool)

  // ---------- ground ----------
  const groundTex = tiled(concrete(7, [92, 96, 100]), 26, 26)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 150),
    new THREE.MeshStandardMaterial({
      map: groundTex, bumpMap: tiled(concrete(7, [128, 128, 128]), 26, 26), bumpScale: 0.05,
      roughness: 0.74, metalness: 0.07, color: 0xa4a8ac, envMapIntensity: 0.9
    })
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  root.add(ground)
  hitMeshes.push(ground)

  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(64, 16),
    new THREE.MeshStandardMaterial({ map: tiled(concrete(19, [44, 46, 50]), 18, 5), roughness: 0.82, metalness: 0.08, color: 0x9aa0a8 })
  )
  asphalt.rotation.x = -Math.PI / 2
  asphalt.position.set(0, 0.012, 10)
  asphalt.receiveShadow = true
  root.add(asphalt)
  hitMeshes.push(asphalt)

  const lineMat = new THREE.MeshBasicMaterial({ color: 0xb8a878, transparent: true, opacity: 0.35 })
  for (let i = -6; i <= 6; i++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.22), lineMat)
    line.rotation.x = -Math.PI / 2
    line.position.set(i * 5, 0.03, 10)
    root.add(line)
  }

  // puddles
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x0d1218, roughness: 0.08, metalness: 0.95, transparent: true, opacity: 0.72
  })
  const puddleSpots = [[-6, 4, 2.6], [5, 2, 1.8], [11, 12, 3.4], [-13, -2, 2.2], [17, 4, 1.6], [-2, 21, 1.9]]
  for (const [x, z, r] of puddleSpots) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(r, 26), puddleMat)
    p.rotation.x = -Math.PI / 2
    p.position.set(x, 0.018, z)
    p.scale.set(1, 0.55 + Math.random() * 0.5, 1)
    p.rotation.z = Math.random() * Math.PI
    root.add(p)
  }

  // grass tufts in corners
  const grassMat = new THREE.MeshBasicMaterial({
    map: grassPatch(3), transparent: true, alphaTest: 0.15, side: THREE.DoubleSide, depthWrite: false
  })
  for (let i = 0; i < 26; i++) {
    const ang = Math.random() * Math.PI * 2
    const rad = 20 + Math.random() * 16
    const g = new THREE.Mesh(new THREE.PlaneGeometry(2.4 + Math.random() * 2, 1.2 + Math.random()), grassMat)
    g.position.set(Math.cos(ang) * rad, 0.55, Math.sin(ang) * rad)
    g.rotation.y = Math.random() * Math.PI
    g.rotation.x = -0.12
    root.add(g)
  }

  // ---------- materials ----------
  const concreteMat = mat(tiled(concrete(22, [104, 106, 108]), 2, 2), { roughness: 0.94, extra: { bumpMap: tiled(concrete(22, [128, 128, 128]), 2, 2), bumpScale: 0.03 } })
  const concreteDark = mat(tiled(concrete(31, [64, 67, 71]), 2, 2), { roughness: 0.92, extra: { bumpMap: tiled(concrete(31, [128, 128, 128]), 2, 2), bumpScale: 0.03 } })
  const metalMat = mat(tiled(metal(11, [58, 64, 70]), 2, 2), { roughness: 0.52, metalness: 0.82, extra: { bumpMap: tiled(metal(11, [128,128,128]), 2, 2), bumpScale: 0.02 } })
  const metalDark = mat(tiled(metal(17, [34, 38, 43], 64), 2, 2), { roughness: 0.44, metalness: 0.9 })
  const rustMat = mat(tiled(metal(23, [92, 58, 38], 96), 2, 2), { roughness: 0.78, metalness: 0.55 })
  const hazardMat = mat(tiled(hazard(), 2, 1), { roughness: 0.8, metalness: 0.2 })
  const gratingMat = mat(tiled(grating(), 2, 2), { roughness: 0.55, metalness: 0.75, transparent: true, opacity: 0.98 })
  const woodMat = mat(tiled(concrete(41, [96, 72, 44]), 1, 1), { roughness: 0.95 })
  const sandMat = mat(tiled(concrete(53, [126, 114, 88]), 1, 1), { roughness: 1 })
  const darkGlass = new THREE.MeshStandardMaterial({
    color: 0x0a121a, roughness: 0.12, metalness: 0.85, emissive: 0x0a1a26, emissiveIntensity: 0.6
  })

  const glow = (color, intensity = 2) => new THREE.MeshBasicMaterial({ color, toneMapped: false })
  const stripMat = new THREE.MeshBasicMaterial({ map: stripeEmissive('#a8dcff'), transparent: true, toneMapped: false })
  const stripOrange = new THREE.MeshBasicMaterial({ map: stripeEmissive('#ff9a3c'), transparent: true, toneMapped: false })
  const redLightMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false })

  // ---------- perimeter ----------
  const wallSegments = [
    [0, -40, 84, 3.4, 1.2],
    [0, 40, 84, 3.4, 1.2],
    [-42, 0, 1.2, 3.4, 80],
    [42, 0, 1.2, 3.4, 80]
  ]
  for (const [x, z, w, h, d] of wallSegments) {
    const m = addMesh(new THREE.BoxGeometry(w, h, d), concreteDark, x, h / 2, z, { collide: true })
    m.material = concreteDark
    // top cap
    addMesh(new THREE.BoxGeometry(w + 0.2, 0.18, d + 0.2), metalDark, x, h + 0.09, z, { collide: false, hit: false })
  }
  // perimeter fence posts + wire suggestion
  const postMat = new THREE.MeshStandardMaterial({ color: 0x2a2f35, roughness: 0.5, metalness: 0.8 })
  for (let i = -8; i <= 8; i++) {
    for (const z of [-40.8, 40.8]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), postMat)
      post.position.set(i * 4.8, 4.6, z)
      root.add(post)
    }
  }

  const building = (x, z, w, d, h, opts = {}) => {
    const body = addMesh(new THREE.BoxGeometry(w, h, d), opts.material || concreteMat, x, h / 2, z, { collide: true })
    body.material = opts.material || concreteMat
    // roof lip
    addMesh(new THREE.BoxGeometry(w + 0.5, 0.5, d + 0.5), concreteDark, x, h + 0.2, z, { hit: false })
    // windows on front and sides
    const winMat = windowGrid(opts.winColor || '#ffd9a0', opts.cols || 4, opts.rows || 4)
    const makeWindows = (faceW, faceH, px, py, pz, rotY) => {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(faceW, faceH), new THREE.MeshBasicMaterial({
        map: winMat, transparent: true, opacity: 0.92, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false
      }))
      plane.position.set(px, py, pz)
      plane.rotation.y = rotY
      root.add(plane)
    }
    makeWindows(w * 0.52, h * 0.44, x, h * 0.58, z + d / 2 + 0.02, 0)
    makeWindows(w * 0.52, h * 0.44, x, h * 0.58, z - d / 2 - 0.02, Math.PI)
    makeWindows(d * 0.52, h * 0.44, x - w / 2 - 0.02, h * 0.58, z, -Math.PI / 2)
    makeWindows(d * 0.52, h * 0.44, x + w / 2 + 0.02, h * 0.58, z, Math.PI / 2)
    // rooftop clutter
    for (let i = 0; i < 4; i++) {
      const bx = x + (Math.random() - 0.5) * (w - 3)
      const bz = z + (Math.random() - 0.5) * (d - 3)
      const bh = 0.6 + Math.random() * 1.1
      addMesh(new THREE.BoxGeometry(1.2 + Math.random(), bh, 1.1 + Math.random()), metalDark, bx, h + 0.45 + bh / 2, bz, { hit: false })
    }
    return body
  }

  // main HQ building north
  building(0, -27, 20, 9, 8.5, { winColor: '#ffd9a8', cols: 5, rows: 5 })
  // entrance canopy
  addMesh(new THREE.BoxGeometry(9, 0.3, 3.4), metalDark, 0, 3.4, -21.8, { collide: false })
  addMesh(new THREE.BoxGeometry(0.24, 3.4, 0.24), metalDark, -4.2, 1.7, -20.4, { collide: true })
  addMesh(new THREE.BoxGeometry(0.24, 3.4, 0.24), metalDark, 4.2, 1.7, -20.4, { collide: true })
  // door glow
  const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.1), new THREE.MeshBasicMaterial({
    color: 0x4fc3ff, transparent: true, opacity: 0.28, toneMapped: false, blending: THREE.AdditiveBlending
  }))
  doorGlow.position.set(0, 1.62, -22.45)
  root.add(doorGlow)
  const doorLight = new THREE.PointLight(0x4fc3ff, 14, 12, 2)
  doorLight.position.set(0, 2.6, -20.8)
  scene.add(doorLight)

  // side buildings
  building(-24, -12, 11, 14, 5.6, { winColor: '#ffc98c', cols: 3, rows: 3, material: concreteDark })
  building(25, -9, 12, 12, 6.4, { winColor: '#cfe6ff', cols: 3, rows: 4, material: concreteMat })
  building(-27, 20, 9, 10, 4.2, { winColor: '#ffd9a8', cols: 2, rows: 2, material: concreteMat })

  // warehouse east-south
  building(30, 24, 16, 12, 7.2, { winColor: '#9fd8ff', cols: 4, rows: 3, material: concreteDark })

  // ---------- containers ----------
  const containerColors = [
    [0x7a2f22, 0xde6a3a], [0x1f4a5c, 0x4fa8c8], [0x4a4a2a, 0xb8b35a],
    [0x2f3d55, 0x6f9fd8], [0x5c2323, 0xd85c5c]
  ]
  const container = (x, z, rotY, colorIdx, stacked = false) => {
    const [base, accent] = containerColors[colorIdx % containerColors.length]
    const bodyMat = mat(tiled(metal(60 + colorIdx, [base >> 16 & 255, base >> 8 & 255, base & 255], 32), 2, 2), {
      roughness: 0.68, metalness: 0.5
    })
    const g = new THREE.Group()
    g.position.set(x, 1.32 + (stacked ? 2.6 : 0), z)
    g.rotation.y = rotY
    const body = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.45), bodyMat)
    body.castShadow = body.receiveShadow = true
    g.add(body)
    // ribs
    const ribMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.55, metalness: 0.6 })
    for (let i = -2; i <= 2; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.62, 2.5), ribMat)
      rib.position.x = i * 1.2
      rib.castShadow = true
      g.add(rib)
    }
    // door bars
    for (const side of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.4, 0.12), metalDark)
      bar.position.set(side * 1.4, 0, 1.26)
      g.add(bar)
    }
    root.add(g)
    const mesh = body
    mesh.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(g)
    colliders.push(box)
    hitMeshes.push(body)
    return g
  }
  container(-14, 7, 0.06, 0)
  container(-14, 10, 0.06, 1, true)
  container(-8.5, 14, Math.PI / 2, 2)
  container(14, 15, 0.02, 3)
  container(19, 15, 0.02, 4)
  container(20, 19.2, Math.PI / 2, 1)
  container(-22, 31, 0.1, 4)
  container(10, -16, Math.PI / 2, 2)
  container(-12, -15, Math.PI / 2, 3)
  container(33, 4, 0.0, 0, true)

  // ---------- crates / barriers ----------
  const crate = (x, z, s = 1.1, rot = 0, matOverride = null) => {
    const m = addMesh(new THREE.BoxGeometry(s * 1.5, s, s * 1.5), matOverride || (Math.random() > 0.5 ? woodMat : metalDark), x, s / 2, z, {
      rotY: rot, collide: true
    })
    // edge trim
    const trim = new THREE.Mesh(new THREE.BoxGeometry(s * 1.54, 0.07, s * 1.54), metalDark)
    trim.position.set(x, s * 0.94, z)
    trim.rotation.y = rot
    trim.castShadow = true
    root.add(trim)
    return m
  }
  const crateSpots = [
    [-18, 16, 1.3, 0.2], [-18, 18.4, 1.0, -0.1], [-3, 5, 1.1, 0.4], [6, 6, 1.4, -0.2],
    [7.3, 7.4, 0.9, 0.3], [26, 14, 1.2, 0.1], [26, 16.4, 1.0, 0.5], [-24, -4, 1.1, 0.7],
    [8, 20, 1.3, -0.3], [-4, 24, 1.0, 0.2], [3, 30, 1.2, 0.1], [23, -18, 1.1, 0.4]
  ]
  for (const [x, z, s, r] of crateSpots) crate(x, z, s, r)

  // jersey barriers
  const barrier = (x, z, rot = 0) => {
    const shape = new THREE.Shape()
    shape.moveTo(-1.8, 0); shape.lineTo(1.8, 0); shape.lineTo(1.5, 0.38)
    shape.lineTo(0.62, 0.98); shape.lineTo(-0.62, 0.98); shape.lineTo(-1.5, 0.38); shape.lineTo(-1.8, 0)
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 })
    geo.translate(0, 0, -0.35)
    const m = addMesh(geo, concreteDark, x, 0, z, { rotY: rot, collide: true })
    const strip = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.09, 0.73), hazardMat)
    strip.position.set(x, 0.74, z)
    strip.rotation.y = rot
    root.add(strip)
    return m
  }
  barrier(-5, 12, 0)
  barrier(5, 12, 0)
  barrier(2.6, 12.6, Math.PI / 2)
  barrier(-9, -4, 0.3)
  barrier(9, -4, -0.3)
  barrier(16, 8, Math.PI / 2)
  barrier(-16, 23, 0.1)

  // sandbag walls
  const sandbag = (x, z, len = 4, rot = 0) => {
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    g.rotation.y = rot
    for (let row = 0; row < 3; row++) {
      const count = Math.floor(len / 0.72)
      for (let i = 0; i < count; i++) {
        const bag = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 6), sandMat)
        bag.scale.set(1.15, 0.55, 0.72)
        bag.position.set(-len / 2 + 0.36 + i * 0.72 + (row % 2) * 0.18, 0.2 + row * 0.3, 0)
        bag.castShadow = bag.receiveShadow = true
        g.add(bag)
      }
    }
    root.add(g)
    g.updateMatrixWorld(true)
    colliders.push(new THREE.Box3().setFromObject(g))
    hitMeshes.push(g.children[0])
  }
  sandbag(-18, 4, 5, Math.PI / 2)
  sandbag(12, -18, 4.4, 0)
  sandbag(31, 16, 5, Math.PI / 2)
  sandbag(-30, -20, 4, 0)

  // ---------- lamp posts ----------
  const lamp = (x, z, color = 0xffa04a, intensity = 26) => {
    const pole = addMesh(new THREE.CylinderGeometry(0.12, 0.16, 6.4, 8), metalDark, x, 3.2, z, { collide: true })
    pole.material = metalDark
    const arm = addMesh(new THREE.BoxGeometry(1.7, 0.12, 0.12), metalDark, x + 0.8, 6.3, z, { hit: false })
    arm.rotation.z = -0.06
    const head = addMesh(new THREE.BoxGeometry(0.9, 0.18, 0.46), new THREE.MeshBasicMaterial({ color, toneMapped: false }), x + 1.62, 6.22, z, { hit: false, castShadow: false })
    const light = new THREE.PointLight(color, intensity, 22, 2)
    light.position.set(x + 1.62, 6.0, z)
    scene.add(light)
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(2.9, 6.5, 28, 1, true),
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
        toneMapped: false,
        vertexShader: `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            float a = pow(1.0 - vUv.y, 2.6) * 0.085;
            gl_FragColor = vec4(uColor * a, a);
          }
        `
      })
    )
    cone.position.set(x + 1.62, 2.95, z)
    cone.rotation.x = Math.PI
    scene.add(cone)
    lamps.push({ light, cone, base: intensity })
  }
  lamp(-10, 14)
  lamp(10, 14)
  lamp(-19, -8, 0x7fd4ff, 20)
  lamp(22, 8, 0xffa04a, 22)
  lamp(0, -18.5, 0x9fd8ff, 16)
  lamp(-32, 30, 0xff8a4a, 18)

  // ---------- watchtower ----------
  const tower = (x, z) => {
    for (const [ox, oz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
      addMesh(new THREE.CylinderGeometry(0.16, 0.2, 7, 8), metalDark, x + ox, 3.5, z + oz, { collide: true })
    }
    addMesh(new THREE.BoxGeometry(5, 0.25, 5), gratingMat, x, 7, z, { collide: true })
    // railings
    for (const [ox, oz, w, d] of [[0, -2.4, 5, 0.08], [0, 2.4, 5, 0.08], [-2.4, 0, 0.08, 5], [2.4, 0, 0.08, 5]]) {
      addMesh(new THREE.BoxGeometry(w, 0.08, d), metalDark, x + ox, 8.1, z + oz, { hit: false })
    }
    addMesh(new THREE.BoxGeometry(5.4, 0.3, 5.4), metalDark, x, 9.1, z, { hit: false })
    // roof supports
    for (const [ox, oz] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) {
      addMesh(new THREE.BoxGeometry(0.12, 2.1, 0.12), metalDark, x + ox, 8.05, z + oz, { hit: false })
    }
    const tl = new THREE.PointLight(0xffb060, 10, 12, 2)
    tl.position.set(x, 8.4, z)
    scene.add(tl)
  }
  tower(-33, -4)
  tower(34, 31)

  // ---------- sweeping searchlight ----------
  const slPos = new THREE.Vector3(-33, 9.4, -4)
  const slTarget = new THREE.Object3D()
  slTarget.position.set(0, 0, 4)
  scene.add(slTarget)
  const searchlight = new THREE.SpotLight(0xc2e4ff, 300, 90, 0.068, 0.42, 1.25)
  searchlight.position.copy(slPos)
  searchlight.target = slTarget
  scene.add(searchlight)
  const slHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.62, 0.9, 14),
    new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 0.4, metalness: 0.85 })
  )
  slHousing.position.copy(slPos)
  slHousing.rotation.z = 0.2
  scene.add(slHousing)
  const slGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softCircle(0.05), color: 0xcfe9ff, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }))
  slGlow.position.copy(slPos)
  slGlow.scale.setScalar(1.5)
  scene.add(slGlow)
  const beamGeo = new THREE.ConeGeometry(1, 1, 22, 1, true)
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0xc2e4ff) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, fog: false, toneMapped: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; varying vec2 vUv; void main(){ float a = pow(vUv.y, 2.2) * 0.05; gl_FragColor = vec4(uColor * a, a); }`
  })
  const beam = new THREE.Mesh(beamGeo, beamMat)
  scene.add(beam)

  // ---------- distant lightning ----------
  const flashLight = new THREE.DirectionalLight(0xdce9ff, 0)
  flashLight.position.set(-14, 62, -18)
  scene.add(flashLight)
  let boltTimer = 9 + Math.random() * 10
  let boltAge = -1

  dynamic.push((dt, t) => {
    slTarget.position.set(Math.sin(t * 0.17) * 25, 0, -4 + Math.cos(t * 0.21) * 16)
    const len = slPos.distanceTo(slTarget.position) + 1
    beam.scale.set(3.4, len, 3.4)
    beam.position.copy(slPos).add(slTarget.position).multiplyScalar(0.5)
    const up = new THREE.Vector3(0, 1, 0)
    const dir = slPos.clone().sub(slTarget.position).normalize()
    beam.quaternion.setFromUnitVectors(up, dir)
    slHousing.lookAt(slTarget.position)

    boltTimer -= dt
    if (boltTimer <= 0 && boltAge < 0) {
      boltAge = 0
      boltTimer = 14 + Math.random() * 18
      lightningHandler?.()
    }
    if (boltAge >= 0) {
      boltAge += dt
      let i = 0
      if (boltAge < 0.05) i = 1
      else if (boltAge < 0.11) i = 0.12
      else if (boltAge < 0.2) i = 0.85
      else if (boltAge < 0.55) i = (1 - (boltAge - 0.2) / 0.35) * 0.45
      flashLight.intensity = i * 5.5
      hemi.intensity = 0.72 + i * 1.5
      if (boltAge > 0.58) {
        boltAge = -1
        flashLight.intensity = 0
        hemi.intensity = 0.72
      }
    }
  })

  // ---------- pipes / props ----------
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.42, metalness: 0.9 })
  for (let i = 0; i < 3; i++) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 16, 8), pipeMat)
    pipe.rotation.z = Math.PI / 2
    pipe.position.set(-34, 1.2 + i * 0.45, -20)
    pipe.castShadow = true
    root.add(pipe)
  }
  for (let i = 0; i < 5; i++) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 12, 8), pipeMat)
    pipe.position.set(27.8, 3.5, -6 + i * 0.9)
    pipe.castShadow = true
    root.add(pipe)
  }

  // barrels
  const barrel = (x, z, color = 0x8a3b22) => {
    const b = addMesh(new THREE.CylinderGeometry(0.34, 0.34, 0.94, 14), new THREE.MeshStandardMaterial({
      color, roughness: 0.55, metalness: 0.62, map: tiled(metal(71, [color >> 16 & 255, color >> 8 & 255, color & 255], 64), 1, 1)
    }), x, 0.47, z, { collide: true })
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 6, 18), metalDark)
    ring1.rotation.x = Math.PI / 2
    ring1.position.set(x, 0.72, z)
    root.add(ring1)
    const ring2 = ring1.clone(); ring2.position.y = 0.24; root.add(ring2)
    return b
  }
  barrel(-21, 10, 0x7a2a1c)
  barrel(-20.4, 10.8, 0x2a4a5c)
  barrel(25, -3, 0x6a5a22)
  barrel(12.5, -14, 0x7a2a1c)
  barrel(-7, -20, 0x2a4a5c)

  // generator + antenna
  addMesh(new THREE.BoxGeometry(2.2, 1.4, 1.4), metalDark, 18, 0.7, -20, { collide: true })
  addMesh(new THREE.BoxGeometry(2.3, 0.14, 1.5), rustMat, 18, 1.47, -20, { hit: false })
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 1.1), metalMat)
    fin.position.set(17.2 + i * 0.35, 2.1, -20)
    root.add(fin)
  }
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, 12, 6), metalDark)
  antenna.position.set(34, 12, 28)
  antenna.castShadow = true
  root.add(antenna)
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), redLightMat)
  beacon.position.set(34, 18.1, 28)
  root.add(beacon)
  const beaconLight = new THREE.PointLight(0xff2222, 6, 10, 2)
  beaconLight.position.copy(beacon.position)
  scene.add(beaconLight)
  dynamic.push((t) => {
    const on = Math.sin(t * 2.4) > 0.2
    beacon.visible = on
    beaconLight.intensity = on ? 7 : 0
  })

  // extraction flare
  const flareGroup = new THREE.Group()
  flareGroup.position.set(-2, 0, 32)
  const flareBase = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.35, 12), metalDark)
  flareBase.position.y = 0.17
  flareBase.castShadow = true
  flareGroup.add(flareBase)
  const flareGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xff5a1a, toneMapped: false })
  )
  flareGlow.position.y = 0.55
  flareGroup.add(flareGlow)
  const flareLight = new THREE.PointLight(0xff5a1a, 22, 16, 2)
  flareLight.position.set(0, 0.8, 0)
  flareGroup.add(flareLight)
  root.add(flareGroup)
  dynamic.push((t) => {
    const f = 0.7 + Math.sin(t * 13) * 0.18 + Math.sin(t * 31) * 0.1
    flareLight.intensity = 18 * f
    flareGlow.scale.setScalar(0.9 + f * 0.35)
  })

  // orange guide lights around compound
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    const x = Math.cos(a) * 17
    const z = 8 + Math.sin(a) * 17
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), new THREE.MeshBasicMaterial({ color: 0xff8a3c, toneMapped: false }))
    l.position.set(x, 0.06, z)
    root.add(l)
  }

  // smoke stacks for atmosphere
  const makeSmokeStack = (x, z) => {
    const geo = new THREE.BufferGeometry()
    const count = 60
    const pos = new Float32Array(count * 3)
    const alpha = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 2
      pos[i * 3 + 1] = Math.random() * 18
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2
      alpha[i] = Math.random()
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1))
    const m = new THREE.PointsMaterial({
      size: 3.4, map: softCircle(0.05), transparent: true, opacity: 0.09,
      depthWrite: false, color: 0x8a8f96, blending: THREE.NormalBlending, sizeAttenuation: true
    })
    const p = new THREE.Points(geo, m)
    p.position.set(x, 0, z)
    scene.add(p)
    smokeStacks.push({ p, speed: 0.4 + Math.random() * 0.6 })
  }
  makeSmokeStack(-40, -40)
  makeSmokeStack(41, 40)

  // rain
  const rainCount = 1400
  const rainGeo = new THREE.BufferGeometry()
  const rainPos = new Float32Array(rainCount * 6)
  const rainSeed = new Float32Array(rainCount)
  for (let i = 0; i < rainCount; i++) {
    const x = (Math.random() - 0.5) * 90
    const y = Math.random() * 40
    const z = (Math.random() - 0.5) * 90
    rainPos[i * 6] = x
    rainPos[i * 6 + 1] = y
    rainPos[i * 6 + 2] = z
    rainPos[i * 6 + 3] = x - 0.18
    rainPos[i * 6 + 4] = y - 0.9
    rainPos[i * 6 + 5] = z + 0.08
    rainSeed[i] = 26 + Math.random() * 26
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3))
  const rainMat = new THREE.LineBasicMaterial({
    color: 0x9fc4e8, transparent: true, opacity: 0.085, blending: THREE.AdditiveBlending, depthWrite: false
  })
  const rain = new THREE.LineSegments(rainGeo, rainMat)
  scene.add(rain)
  dynamic.push((dt, t, camera) => {
    const arr = rainGeo.attributes.position.array
    for (let i = 0; i < rainCount; i++) {
      const fall = rainSeed[i] * dt
      arr[i * 6 + 1] -= fall
      arr[i * 6 + 4] -= fall
      if (arr[i * 6 + 1] < 0) {
        const x = camera.position.x + (Math.random() - 0.5) * 70
        const z = camera.position.z + (Math.random() - 0.5) * 70
        const y = 30 + Math.random() * 12
        arr[i * 6] = x; arr[i * 6 + 1] = y; arr[i * 6 + 2] = z
        arr[i * 6 + 3] = x - 0.18; arr[i * 6 + 4] = y - 0.9; arr[i * 6 + 5] = z + 0.08
      }
    }
    rainGeo.attributes.position.needsUpdate = true
  })

  // sparks/fireflies dust motes
  const dustCount = 260
  const dustGeo = new THREE.BufferGeometry()
  const dustPos = new Float32Array(dustCount * 3)
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 70
    dustPos[i * 3 + 1] = 0.4 + Math.random() * 9
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 70
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.05, color: 0x8fb4d8, transparent: true, opacity: 0.2,
    depthWrite: false, blending: THREE.AdditiveBlending, map: softCircle(0.5)
  }))
  scene.add(dust)
  dynamic.push((dt, t) => {
    const arr = dustGeo.attributes.position.array
    for (let i = 0; i < dustCount; i++) {
      arr[i * 3 + 1] += Math.sin(t * 0.6 + i) * dt * 0.08
      arr[i * 3] += Math.cos(t * 0.4 + i * 1.7) * dt * 0.05
    }
    dustGeo.attributes.position.needsUpdate = true
  })


  // ---------- distant skyline ----------
  const skylineDark = new THREE.MeshStandardMaterial({ color: 0x090e15, roughness: 0.98, metalness: 0.02 })
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + 0.13
    const r = 66 + Math.random() * 26
    const w = 4 + Math.random() * 8
    const h = 8 + Math.random() * 30
    const d = 4 + Math.random() * 8
    const winMat = new THREE.MeshStandardMaterial({
      color: 0x0b1219, roughness: 0.85, metalness: 0.1,
      map: tiled(windowGrid(9, 16), Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 7))),
      emissive: 0xff9a4a, emissiveIntensity: 0.35,
      emissiveMap: tiled(windowGrid(9, 16), Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 7)))
    })
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), Math.random() < 0.6 ? winMat : skylineDark)
    b.position.set(Math.cos(a) * r, h / 2 - 0.5, Math.sin(a) * r)
    b.rotation.y = -a
    scene.add(b)
  }

  // ---------- ground haze ----------
  const hazeTex = softCircle(0.12)
  for (let i = 0; i < 7; i++) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: hazeTex, color: 0x8ea4bc, transparent: true, opacity: 0.045,
      depthWrite: false, blending: THREE.NormalBlending, toneMapped: false
    }))
    spr.position.set((Math.random() - 0.5) * 62, 1.1 + Math.random() * 1.6, (Math.random() - 0.5) * 62)
    spr.scale.set(26 + Math.random() * 22, 7 + Math.random() * 5, 1)
    scene.add(spr)
    const speed = 0.15 + Math.random() * 0.2
    dynamic.push((dt, t) => {
      spr.position.x += Math.sin(t * 0.07 + i) * dt * speed
      spr.position.z += Math.cos(t * 0.05 + i * 1.7) * dt * speed
    })
  }

  // ---------- signage ----------
  const signCanvas = document.createElement('canvas')
  signCanvas.width = 512; signCanvas.height = 128
  const sctx = signCanvas.getContext('2d')
  sctx.fillStyle = 'rgba(6,9,13,0.92)'
  sctx.fillRect(0, 0, 512, 128)
  sctx.strokeStyle = 'rgba(255,122,26,0.8)'
  sctx.lineWidth = 4
  sctx.strokeRect(6, 6, 500, 116)
  sctx.fillStyle = '#ff8a2e'
  sctx.font = 'bold 58px Arial Narrow, Arial'
  sctx.letterSpacing = '10px'
  sctx.fillText('SECTOR 7', 42, 72)
  sctx.fillStyle = 'rgba(220,235,245,0.55)'
  sctx.font = '22px monospace'
  sctx.fillText('AUTHORIZED PERSONNEL ONLY', 44, 104)
  const signTex = new THREE.CanvasTexture(signCanvas)
  signTex.colorSpace = THREE.SRGBColorSpace
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 1.85), new THREE.MeshBasicMaterial({
    map: signTex, transparent: true, toneMapped: false, opacity: 0.95
  }))
  sign.position.set(0, 4.55, -22.44)
  root.add(sign)
  const signLight = new THREE.PointLight(0xff8a2e, 6, 9, 2)
  signLight.position.set(0, 4.2, -21.8)
  scene.add(signLight)

  const smallSignCanvas = document.createElement('canvas')
  smallSignCanvas.width = 256; smallSignCanvas.height = 256
  const ssctx = smallSignCanvas.getContext('2d')
  ssctx.fillStyle = 'rgba(12,10,7,0.9)'
  ssctx.fillRect(0, 0, 256, 256)
  ssctx.strokeStyle = 'rgba(255,170,40,0.9)'
  ssctx.lineWidth = 10
  ssctx.strokeRect(8, 8, 240, 240)
  ssctx.fillStyle = '#ffb03a'
  ssctx.font = 'bold 150px Arial'
  ssctx.textAlign = 'center'
  ssctx.fillText('!', 128, 150)
  ssctx.font = 'bold 26px monospace'
  ssctx.fillText('DANGER', 128, 200)
  ssctx.font = '18px monospace'
  ssctx.fillText('HIGH VOLTAGE', 128, 228)
  const warnTex = new THREE.CanvasTexture(smallSignCanvas)
  warnTex.colorSpace = THREE.SRGBColorSpace
  for (const [wx, wy, wz, ry] of [[-33.8, 2.4, -20, Math.PI / 2], [27.8, 2.7, -8, -Math.PI / 2], [-18, 2.2, 26.5, 0]]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({
      map: warnTex, transparent: true, toneMapped: false, opacity: 0.85
    }))
    pl.position.set(wx, wy, wz)
    pl.rotation.y = ry
    root.add(pl)
  }

  // ---------- overhead cables ----------
  const cableMat = new THREE.LineBasicMaterial({ color: 0x0a0d12, transparent: true, opacity: 0.9 })
  const cable = (ax, ay, az, bx, by, bz, sag = 1.2) => {
    const pts = []
    for (let i = 0; i <= 20; i++) {
      const k = i / 20
      const x = ax + (bx - ax) * k
      const z = az + (bz - az) * k
      const y = ay + (by - ay) * k - Math.sin(k * Math.PI) * sag
      pts.push(new THREE.Vector3(x, y, z))
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    root.add(new THREE.Line(geo, cableMat))
    return pts
  }
  cable(-20, 8.2, -22.6, -33, 6.4, -14, 1.6)
  cable(20, 8.2, -22.6, 31, 7.0, -14, 1.8)
  cable(-29, 5.6, 20, 25, 6.8, 22, 2.4)
  cable(-32, 7.2, -4, 34, 7.2, 31, 2.8)
  const wireBulbMat = new THREE.MeshBasicMaterial({ color: 0xffb060, toneMapped: false })
  for (const [bx, by, bz] of [[-24, 6.7, -19.4], [25, 7.1, -18.2], [0, 5.4, 21]]) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), wireBulbMat)
    bulb.position.set(bx, by, bz)
    root.add(bulb)
    const bl = new THREE.PointLight(0xffa050, 4, 6, 2)
    bl.position.set(bx, by - 0.1, bz)
    scene.add(bl)
  }

  // ---------- burning barrels ----------
  const makeFireBarrel = (x, z) => {
    barrel(x, z, 0x4a2418)
    const glowTex = softCircle(0.05)
    const fire = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xff7a20, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }))
    fire.position.set(x, 1.1, z)
    fire.scale.setScalar(1.3)
    root.add(fire)
    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffd27a, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }))
    core.position.set(x, 1.0, z)
    core.scale.setScalar(0.55)
    root.add(core)
    const fl = new THREE.PointLight(0xff7a2a, 22, 14, 2)
    fl.position.set(x, 1.25, z)
    scene.add(fl)
    dynamic.push((dt, t) => {
      const f = 0.72 + Math.sin(t * 11 + x) * 0.16 + Math.sin(t * 27 + z) * 0.12
      fl.intensity = 20 * f
      fire.scale.setScalar(1.15 * f + 0.25)
      core.scale.setScalar(0.45 * f + 0.18)
    })
  }
  makeFireBarrel(-5.4, 14.5)
  makeFireBarrel(10.8, 11.5)

  // ---------- rubble / debris ----------
  const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x5a5d60, roughness: 0.95 })
  for (let i = 0; i < 55; i++) {
    const ang = Math.random() * Math.PI * 2
    const rad = 5 + Math.random() * 26
    const x = Math.cos(ang) * rad
    const z = 8 + Math.sin(ang) * rad * 0.8
    const size = 0.06 + Math.random() * 0.28
    const chunk = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.6, size * 1.3), rubbleMat)
    chunk.position.set(x, size * 0.3, z)
    chunk.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
    chunk.castShadow = true
    chunk.receiveShadow = true
    root.add(chunk)
  }
  // pallet stacks
  for (const [px, pz, pr] of [[-8.5, 20, 0.3], [16, 20.5, -0.2], [6.5, -21, 0.5]]) {
    for (let i = 0; i < 3; i++) {
      const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1.2), woodMat)
      pallet.position.set(px, 0.08 + i * 0.13, pz)
      pallet.rotation.y = pr
      pallet.castShadow = pallet.receiveShadow = true
      root.add(pallet)
    }
  }

  // ---------- spawn / navigation ----------
  const spawnPoints = [
    new THREE.Vector3(-19, 0, -20),
    new THREE.Vector3(19, 0, -19),
    new THREE.Vector3(-33, 0, 6),
    new THREE.Vector3(33, 0, 12),
    new THREE.Vector3(-8, 0, -32),
    new THREE.Vector3(12, 0, 30),
    new THREE.Vector3(-30, 0, 30),
    new THREE.Vector3(30, 0, -26),
    new THREE.Vector3(0, 0, -32)
  ]
  const playerSpawn = new THREE.Vector3(0, 1.7, 18)
  const playerYaw = 0

  const update = (dt, t, camera) => {
    for (const fn of dynamic) fn(dt, t, camera)
    for (const stack of smokeStacks) {
      const arr = stack.p.geometry.attributes.position.array
      for (let i = 0; i < arr.length / 3; i++) {
        arr[i * 3 + 1] += dt * stack.speed
        arr[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.1
        if (arr[i * 3 + 1] > 20) arr[i * 3 + 1] = 0
      }
      stack.p.geometry.attributes.position.needsUpdate = true
    }
  }

  return {
    colliders,
    hitMeshes,
    spawnPoints,
    playerSpawn,
    playerYaw,
    update,
    moonLight,
    fog: scene.fog,
    beacon,
    flareGroup,
    onLightning: (fn) => { lightningHandler = fn },
    triggerLightning: () => {
      boltAge = 0
      boltTimer = 14 + Math.random() * 18
      lightningHandler?.()
    }
  }
}
