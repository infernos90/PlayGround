import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

import { buildWorld } from './world.js'
import { buildRifle } from './weapons.js'
import { Player } from './player.js'
import { Enemy } from './enemy.js'
import { Effects } from './fx.js'
import { softCircle } from './textures.js'
import { audio } from './audio.js'

const $ = (id) => document.getElementById(id)
const clamp = THREE.MathUtils.clamp

// ---------------------------------------------------------------------------
// renderer / scenes
// ---------------------------------------------------------------------------
const canvas = $('viewport')
const isCoarse = window.matchMedia('(pointer: coarse)').matches
const maxDpr = isCoarse ? 1.15 : 1.5
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.06
renderer.outputColorSpace = THREE.SRGBColorSpace

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 220)
scene.add(camera)

const weaponScene = new THREE.Scene()
const weaponCamera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.01, 20)

const pmrem = new THREE.PMREMGenerator(renderer)
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
scene.environment = envMap
scene.environmentIntensity = 0.58
weaponScene.environment = envMap
weaponScene.environmentIntensity = 0.85

weaponScene.add(new THREE.AmbientLight(0xa8c0d8, 0.7))
const weaponKey = new THREE.DirectionalLight(0xfff0d8, 1.9)
weaponKey.position.set(-2.4, 3, 2.4)
weaponScene.add(weaponKey)
const weaponRim = new THREE.DirectionalLight(0x6fa8d8, 0.95)
weaponRim.position.set(2.4, -1, -3)
weaponScene.add(weaponRim)
const weaponCamFill = new THREE.DirectionalLight(0xdfe8f0, 1.15)
weaponCamFill.position.set(0.4, 0.5, 2)
weaponScene.add(weaponCamFill)
const weaponEdge = new THREE.DirectionalLight(0x9fc4e8, 1.1)
weaponEdge.position.set(-2.5, 1.5, -2)
weaponScene.add(weaponEdge)
const weaponNear = new THREE.PointLight(0xffe4c4, 2.4, 3, 2)
weaponNear.position.set(0.35, 0.2, 0.2)
weaponScene.add(weaponNear)
const weaponTop = new THREE.DirectionalLight(0xffffff, 1.4)
weaponTop.position.set(0.5, 4, -3)
weaponScene.add(weaponTop)
const weaponFill = new THREE.PointLight(0xff7a2a, 1.2, 4, 2)
weaponFill.position.set(1, -1, -1)
weaponScene.add(weaponFill)

// ---------------------------------------------------------------------------
// world / player / fx
// ---------------------------------------------------------------------------
const world = buildWorld(scene, renderer)
world.onLightning(() => audio.thunder?.())
const effects = new Effects(scene)
const rifle = buildRifle()

const player = new Player(camera, { scene: weaponScene, camera: weaponCamera }, {
  colliders: world.colliders,
  weapon: rifle,
  spawn: world.playerSpawn,
  spawnYaw: world.playerYaw,
  onShoot: handlePlayerShot,
  onShell: (p, d) => effects.shellEject(p, d),
  onDeath: onPlayerDeath,
  onDamage: () => showDamage(),
  onGrenade: () => throwGrenade()
})
player.position.copy(world.playerSpawn)
player.position.y = 0
player.yaw = world.playerYaw
player.syncCamera(0)

// ---------------------------------------------------------------------------
// composer
// ---------------------------------------------------------------------------
const composer = new EffectComposer(renderer)
composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr))
composer.setSize(window.innerWidth, window.innerHeight)
composer.addPass(new RenderPass(scene, camera))
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.3, 0.5, 0.95)
composer.addPass(bloom)
const gradePass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float r2 = dot(d, d);
      float ca = r2 * 0.0032;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + d * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - d * ca).b;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      vec3 shadowTint = vec3(0.9, 1.0, 1.1);
      vec3 highTint = vec3(1.08, 1.015, 0.94);
      col *= mix(shadowTint, highTint, smoothstep(0.12, 0.82, l));
      col = (col - 0.5) * 1.07 + 0.5;
      col = max(col, 0.0);
      float vig = smoothstep(0.92, 0.22, r2 * 1.9);
      col *= mix(1.0, vig, 0.5);
      float grain = hash(uv * uRes + fract(uTime)) - 0.5;
      col += grain * 0.018;
      gl_FragColor = vec4(col, 1.0);
    }
  `
})
composer.addPass(gradePass)
composer.addPass(new OutputPass())

// ---------------------------------------------------------------------------
// game state
// ---------------------------------------------------------------------------
const MAX_WAVES = 5
const game = {
  state: 'menu',
  wave: 0,
  kills: 0,
  score: 0,
  spawnQueue: 0,
  spawnTimer: 0,
  intermission: 0,
  waveActive: false,
  enemies: [],
  pickups: [],
  effects,
  player,
  hadLock: false,
  pausedFrom: null,
  waveStartTime: 0,
  startDelay: 0,
  winDelay: 0,
  deathShown: false,
  deathDelay: 0,
  generation: 0,
  minimapTimer: 0
}

const keys = new Set()
const raycaster = new THREE.Raycaster()
raycaster.far = 160
const enemyMuzzleLight = new THREE.PointLight(0xffb060, 0, 12, 2)
scene.add(enemyMuzzleLight)
let enemyLightTime = 0

// ---------------------------------------------------------------------------
// HUD helpers
// ---------------------------------------------------------------------------
const hud = {
  healthFill: $('health-fill'), healthValue: $('health-value'), armorValue: $('armor-value'),
  staminaFill: $('stamina-fill'), ammoMag: $('ammo-mag'), ammoReserve: $('ammo-reserve'),
  waveValue: $('wave-value'), score: $('score-value'), kills: $('kills-value'), acc: $('acc-value'),
  crosshair: $('crosshair'), hitmarker: $('hitmarker'), killfeed: $('killfeed'),
  reloadHint: $('reload-hint'), reloadFill: $('rh-fill'), lowHealth: $('low-health'),
  damageFlash: $('damage-flash'), damageArcs: $('damage-arcs'), subtitle: $('subtitle-line'),
  waveBanner: $('wave-banner'), wbWave: $('wb-wave'), wbSub: $('wb-sub'), grenadeCount: $('grenade-count'),
  waveBannerTimer: 0, subtitleTimer: 0, damageTimer: 0, killId: 0
}

function showHit(kill = false, head = false) {
  const h = hud.hitmarker
  h.classList.remove('show', 'kill')
  void h.offsetWidth
  if (kill) h.classList.add('kill')
  h.classList.add('show')
  audio.hit(kill)
  if (head) audio.headshot()
}

function addKillFeed(name, head) {
  const el = document.createElement('div')
  el.className = 'kf-item'
  el.innerHTML = `YOU <b>›</b> ${name}${head ? ' <span class="hs">HEADSHOT</span>' : ''}`
  hud.killfeed.appendChild(el)
  const id = ++hud.killId
  el.dataset.id = id
  setTimeout(() => el.remove(), 4200)
  while (hud.killfeed.children.length > 5) hud.killfeed.firstChild.remove()
}

function showSubtitle(text, time = 2.6) {
  hud.subtitle.textContent = text
  hud.subtitle.classList.add('show')
  hud.subtitleTimer = time
}

function showBanner(wave, sub = 'ADVANCE AND SECURE', time = 3.2) {
  hud.wbWave.textContent = String(wave).padStart(2, '0')
  hud.wbSub.textContent = sub
  hud.waveBanner.classList.remove('hidden')
  hud.waveBanner.style.animation = 'none'
  void hud.waveBanner.offsetWidth
  hud.waveBanner.style.animation = ''
  hud.waveBannerTimer = time
}

function showDamage() {
  hud.damageFlash.style.opacity = '0.9'
  hud.damageArcs.style.opacity = '1'
  hud.damageTimer = 0.55
}

function updateHUD(dt) {
  const p = player
  const hpRatio = clamp(p.health / p.maxHealth, 0, 1)
  hud.healthFill.style.width = `${hpRatio * 100}%`
  hud.healthValue.textContent = Math.ceil(p.health)
  hud.armorValue.textContent = Math.ceil(p.armor)
  hud.staminaFill.style.width = `${(p.stamina / p.maxStamina) * 100}%`
  hud.ammoMag.textContent = p.mag
  hud.ammoReserve.textContent = p.reserve
  hud.ammoMag.classList.toggle('low', p.mag <= 7)
  hud.waveValue.textContent = String(Math.max(1, game.wave)).padStart(2, '0')
  hud.score.textContent = game.score.toLocaleString('en-US')
  hud.kills.textContent = game.kills
  hud.acc.textContent = p.shots ? `${Math.round((p.hits / p.shots) * 100)}%` : '0%'
  hud.grenadeCount.textContent = p.grenades

  const moving = Math.hypot(p.velocity.x, p.velocity.z) > 1
  hud.crosshair.classList.toggle('spread', moving || p.shake > 0.08 || p.sprinting)
  hud.crosshair.classList.toggle('ads', p.adsAmount > 0.55)

  if (p.reloading) {
    hud.reloadHint.classList.remove('hidden')
    hud.reloadFill.style.width = `${Math.min(100, (p.reloadTime / p.reloadDuration) * 100)}%`
  } else {
    hud.reloadHint.classList.add('hidden')
  }

  hud.lowHealth.style.opacity = p.health < 35 && !p.dead ? '1' : '0'

  if (hud.damageTimer > 0) {
    hud.damageTimer -= dt
    if (hud.damageTimer <= 0) {
      hud.damageFlash.style.opacity = '0'
      hud.damageArcs.style.opacity = '0'
    } else {
      hud.damageFlash.style.opacity = String(Math.max(0, hud.damageTimer / 0.55) * 0.85)
      hud.damageArcs.style.opacity = String(Math.max(0, hud.damageTimer / 0.55))
    }
  }
  if (hud.subtitleTimer > 0) {
    hud.subtitleTimer -= dt
    if (hud.subtitleTimer <= 0) hud.subtitle.classList.remove('show')
  }
  if (hud.waveBannerTimer > 0) {
    hud.waveBannerTimer -= dt
    if (hud.waveBannerTimer <= 0) hud.waveBanner.classList.add('hidden')
  }
  if (enemyLightTime > 0) {
    enemyLightTime -= dt
    enemyMuzzleLight.intensity = Math.max(0, enemyLightTime / 0.06) * 24
  }

  game.minimapTimer -= dt
  if (game.minimapTimer <= 0) {
    game.minimapTimer = 1 / 15
    drawMinimap()
  }
}

// ---------------------------------------------------------------------------
// minimap
// ---------------------------------------------------------------------------
const mm = $('minimap')
const mctx = mm.getContext('2d')
const MAP_RANGE = 42
const MM_SIZE = 160

function worldToMap(x, z) {
  return {
    x: ((x + MAP_RANGE) / (MAP_RANGE * 2)) * MM_SIZE,
    y: ((z + MAP_RANGE) / (MAP_RANGE * 2)) * MM_SIZE
  }
}

function drawMinimap() {
  const ctx = mctx
  ctx.clearRect(0, 0, MM_SIZE, MM_SIZE)
  const bg = ctx.createRadialGradient(MM_SIZE / 2, MM_SIZE / 2, 10, MM_SIZE / 2, MM_SIZE / 2, MM_SIZE)
  bg.addColorStop(0, 'rgba(10,24,32,0.9)')
  bg.addColorStop(1, 'rgba(4,8,12,0.92)')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, MM_SIZE, MM_SIZE)

  ctx.strokeStyle = 'rgba(90,150,180,0.12)'
  ctx.lineWidth = 1
  for (let i = 1; i < 6; i++) {
    const v = (i / 6) * MM_SIZE
    ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, MM_SIZE); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(MM_SIZE, v); ctx.stroke()
  }

  ctx.fillStyle = 'rgba(120,140,150,0.18)'
  ctx.strokeStyle = 'rgba(140,170,185,0.25)'
  for (const box of world.colliders) {
    if (box.max.y < 0.8) continue
    const a = worldToMap(box.min.x, box.min.z)
    const b = worldToMap(box.max.x, box.max.z)
    const w = b.x - a.x
    const h = b.y - a.y
    if (w < 1 || h < 1) continue
    ctx.fillRect(a.x, a.y, w, h)
    ctx.strokeRect(a.x, a.y, w, h)
  }

  // extraction
  const ex = worldToMap(-2, 32)
  ctx.fillStyle = 'rgba(255,122,26,0.9)'
  ctx.beginPath(); ctx.arc(ex.x, ex.y, 3, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(255,122,26,0.35)'
  ctx.beginPath(); ctx.arc(ex.x, ex.y, 7 + Math.sin(performance.now() / 300) * 2, 0, Math.PI * 2); ctx.stroke()

  // enemies
  for (const e of game.enemies) {
    if (e.dead) continue
    const pt = worldToMap(e.group.position.x, e.group.position.z)
    ctx.fillStyle = e.elite ? '#ff8a2a' : '#ff3344'
    ctx.beginPath(); ctx.arc(pt.x, pt.y, e.elite ? 3.2 : 2.4, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(255,50,60,0.35)'
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 5.5, 0, Math.PI * 2); ctx.stroke()
  }

  // pickups
  ctx.fillStyle = 'rgba(120,230,255,0.9)'
  for (const pk of game.pickups) {
    const pt = worldToMap(pk.group.position.x, pk.group.position.z)
    ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3)
  }

  // player
  const pp = worldToMap(player.position.x, player.position.z)
  ctx.save()
  ctx.translate(pp.x, pp.y)
  ctx.rotate(-player.yaw)
  ctx.fillStyle = '#eaf7ff'
  ctx.beginPath()
  ctx.moveTo(0, -6.5)
  ctx.lineTo(4.5, 5)
  ctx.lineTo(0, 2.4)
  ctx.lineTo(-4.5, 5)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // view cone
  ctx.save()
  ctx.translate(pp.x, pp.y)
  ctx.rotate(-player.yaw)
  const grad = ctx.createLinearGradient(0, 0, 0, -34)
  grad.addColorStop(0, 'rgba(160,220,255,0.22)')
  grad.addColorStop(1, 'rgba(160,220,255,0)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-15, -34)
  ctx.lineTo(15, -34)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = 'rgba(160,220,255,0.5)'
  ctx.font = '8px monospace'
  ctx.fillText('N', MM_SIZE / 2 - 3, 11)
}

// ---------------------------------------------------------------------------
// combat
// ---------------------------------------------------------------------------
function allEnemyMeshes() {
  const arr = []
  for (const e of game.enemies) {
    if (e.dead) continue
    for (const m of e.hitMeshes) arr.push(m)
  }
  return arr
}

function normalFromHit(hit) {
  const n = new THREE.Vector3(0, 1, 0)
  if (hit.face) {
    n.copy(hit.face.normal).transformDirection(hit.object.matrixWorld)
  }
  return n
}

function handlePlayerShot(origin, dir) {
  for (const e of game.enemies) e.group.updateMatrixWorld(true)
  const targets = allEnemyMeshes().concat(world.hitMeshes)
  raycaster.set(origin, dir)
  const hits = raycaster.intersectObjects(targets, false)
  const hit = hits[0]

  const muzzleSide = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
  const muzzle = camera.position.clone()
    .addScaledVector(dir, 0.85)
    .addScaledVector(muzzleSide, 0.12)
    .add(new THREE.Vector3(0, -0.1, 0))

  if (!hit) {
    effects.tracer(muzzle, origin.clone().addScaledVector(dir, 80))
    return
  }

  const point = hit.point
  if (hit.object.userData.enemy) {
    const enemy = hit.object.userData.enemy
    const part = hit.object.userData.part
    const isHead = part === 'head'
    const mult = hit.object.userData.mult || 1
    const dmg = (isHead ? 132 : part === 'limb' ? 22 : 44) * mult
    const killed = enemy.takeDamage(dmg, point, isHead)
    player.hits++
    game.score += isHead ? 35 : 12
    effects.bloodBurst(point, dir.clone().negate(), isHead ? 16 : 9)
    showHit(killed, isHead)
    effects.tracer(muzzle, point, killed ? 0xff8a3a : 0xffd9a0)
    if (killed) {
      game.kills++
      game.score += enemy.elite ? 300 : 120
      if (isHead) game.score += 60
      addKillFeed(enemy.elite ? 'HEAVY GUNNER' : 'HOSTILE', isHead)
      if (game.kills % 3 === 0) showSubtitle(isHead ? 'CLEAN HEADSHOT — HOSTILE DOWN' : 'HOSTILE DOWN', 1.6)
      spawnPickup(enemy.group.position.clone())
    }
  } else {
    const n = normalFromHit(hit)
    effects.impact(point, n)
    effects.tracer(muzzle, point)
    audio.impact()
  }
}

function enemyShoot(enemy, origin, dir, dist) {
  enemyLightTime = 0.06
  enemyMuzzleLight.position.copy(origin)
  enemyMuzzleLight.intensity = 24
  audio.enemyShot(dist, clamp((enemy.group.position.x - player.position.x) / 30, -1, 1))

  const chest = player.position.clone().add(new THREE.Vector3(0, player.crouching ? 0.9 : 1.25, 0))
  const toPlayer = chest.clone().sub(origin)
  const t = toPlayer.dot(dir)
  let hitPlayer = false
  let endPoint
  if (t > 0) {
    const closest = origin.clone().addScaledVector(dir, t)
    const miss = closest.distanceTo(chest)
    const movingPenalty = Math.hypot(player.velocity.x, player.velocity.z) > 2 ? 0.03 : 0
    if (miss < (player.crouching ? 0.34 : 0.44) + movingPenalty) hitPlayer = true
  }

  if (hitPlayer) {
    endPoint = chest.clone().addScaledVector(dir, -0.2)
    player.takeDamage(enemy.damage * (0.85 + Math.random() * 0.3))
    effects.bloodBurst(chest, dir.clone().negate(), 4)
  } else {
    raycaster.set(origin, dir)
    const hits = raycaster.intersectObjects(world.hitMeshes, false)
    endPoint = hits.length ? hits[0].point : origin.clone().addScaledVector(dir, 45)
    if (hits.length) {
      effects.impact(hits[0].point, normalFromHit(hits[0]), 'world')
    }
  }
  effects.tracer(origin, endPoint, 0xff6a3a)
}

// ---------------------------------------------------------------------------
// pickups
// ---------------------------------------------------------------------------
function spawnPickup(pos, forced) {
  const lowAmmo = player.reserve + player.mag < 45
  const type = forced || (lowAmmo || Math.random() < 0.62 ? 'ammo' : 'health')
  const group = new THREE.Group()
  group.position.set(pos.x, 0.35, pos.z)
  const cyan = type === 'ammo'
  const mat = new THREE.MeshStandardMaterial({
    color: cyan ? 0x2a3a44 : 0x243a2c,
    emissive: cyan ? 0x2aa8d8 : 0x35c46a,
    emissiveIntensity: 1.4, roughness: 0.4, metalness: 0.7
  })
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.24), mat)
  box.castShadow = false
  group.add(box)
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.06, 0.26),
    new THREE.MeshBasicMaterial({ color: cyan ? 0x7fe4ff : 0x8af0a8, toneMapped: false })
  )
  group.add(stripe)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softCircle(0.05),
    color: cyan ? 0x4fd0ff : 0x5ae48a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false
  }))
  glow.scale.setScalar(1.4)
  group.add(glow)
  scene.add(group)
  game.pickups.push({ group, life: 22, mat, type })
}

function updatePickups(dt, t) {
  for (let i = game.pickups.length - 1; i >= 0; i--) {
    const pk = game.pickups[i]
    pk.life -= dt
    pk.group.rotation.y += dt * 1.8
    pk.group.position.y = 0.35 + Math.sin(t * 2.4 + i) * 0.06
    const d = pk.group.position.distanceTo(player.position)
    if (d < 1.65 && !player.dead) {
      if (pk.type === 'health') {
        player.heal(35)
        player.armor = Math.min(player.maxArmor, player.armor + 20)
        showSubtitle('+35 HEALTH  +20 ARMOR', 1.2)
      } else {
        player.reserve = Math.min(300, player.reserve + 60)
        showSubtitle('+60 ROUNDS', 1.2)
      }
      game.score += 30
      audio.pickup?.()
      scene.remove(pk.group)
      pk.group.traverse((o) => {
        if (o.isMesh) { o.geometry.dispose(); if (o.material !== pk.mat) o.material.dispose() }
      })
      pk.mat.dispose()
      game.pickups.splice(i, 1)
      continue
    }
    if (pk.life <= 0) {
      scene.remove(pk.group)
      pk.group.traverse((o) => {
        if (o.isMesh) { o.geometry.dispose(); if (o.material !== pk.mat) o.material.dispose() }
      })
      pk.mat.dispose()
      game.pickups.splice(i, 1)
    }
  }
}


// ---------------------------------------------------------------------------
// grenades
// ---------------------------------------------------------------------------
const grenades = []
const blastLights = []
const blastSprites = []
const blastRings = []

const blastRay = new THREE.Raycaster()
function blastLineClear(from, to) {
  const dir = to.clone().sub(from)
  const dist = dir.length()
  if (dist < 0.2) return true
  dir.normalize()
  blastRay.set(from, dir)
  blastRay.far = dist - 0.25
  return blastRay.intersectObjects(world.hitMeshes, false).length === 0
}

class Grenade {
  constructor() {
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    this.pos = camera.position.clone().addScaledVector(dir, 0.65).addScaledVector(right, 0.16)
    this.pos.y -= 0.08
    this.vel = dir.clone().multiplyScalar(13.5).addScaledVector(right, 1.6)
    this.vel.y += 4.6
    this.vel.addScaledVector(player.velocity, 0.4)
    this.fuse = 2.15
    this.trailTimer = 0
    this.dead = false
    this.spin = new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8)

    this.group = new THREE.Group()
    this.group.position.copy(this.pos)
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x39442f, roughness: 0.62, metalness: 0.35 })
    )
    body.scale.set(1, 1.25, 1)
    body.castShadow = false
    this.group.add(body)
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.087, 0.087, 0.045, 12),
      new THREE.MeshStandardMaterial({ color: 0x1a1c18, roughness: 0.5, metalness: 0.5 })
    )
    this.group.add(band)
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.05, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a7a4a, roughness: 0.4, metalness: 0.7 })
    )
    cap.position.y = 0.12
    this.group.add(cap)
    this.led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3020, toneMapped: false }))
    this.led.position.set(0, 0.16, 0)
    this.group.add(this.led)
    this.light = new THREE.PointLight(0xff3020, 2, 3, 2)
    this.light.position.set(0, 0.2, 0)
    this.group.add(this.light)
    scene.add(this.group)
  }

  dispose() {
    if (this.group.parent) scene.remove(this.group)
    this.group.traverse((o) => {
      if (o.isMesh) { o.geometry.dispose(); o.material.dispose() }
    })
  }

  explode() {
    this.dead = true
    const p = this.pos.clone()
    this.dispose()
    effects.explosion(p)
    audio.explosion(p.distanceTo(player.position))

    const light = new THREE.PointLight(0xffa040, 210, 34, 2)
    light.position.copy(p).add(new THREE.Vector3(0, 1, 0))
    scene.add(light)
    blastLights.push({ light, life: 0.65, max: 0.65 })

    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softCircle(0.03), color: 0xffb060, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }))
    spr.position.copy(p).add(new THREE.Vector3(0, 0.8, 0))
    spr.scale.setScalar(2.2)
    scene.add(spr)
    blastSprites.push({ spr, life: 0.55, max: 0.55 })

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.62, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffb060, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
      })
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.copy(p)
    ring.position.y = 0.06
    scene.add(ring)
    blastRings.push({ ring, life: 0.42, max: 0.42 })

    const d = p.distanceTo(player.position)
    player.shake = Math.max(player.shake, Math.max(0, 1.4 - d / 14))
    if (d < 6.5 && !player.dead) {
      const chest = player.position.clone().add(new THREE.Vector3(0, 1.1, 0))
      if (blastLineClear(p, chest)) player.takeDamage(52 * (1 - d / 6.5))
    }

    for (const e of game.enemies) {
      if (e.dead) continue
      const dist = e.group.position.distanceTo(p)
      if (dist < 9) {
        const chest = e.group.position.clone().add(new THREE.Vector3(0, 1.1, 0))
        if (!blastLineClear(p, chest)) continue
        const dmg = 60 + 210 * (1 - dist / 9)
        const killed = e.takeDamage(dmg, chest, false)
        if (killed) {
          if (!player.dead) {
            game.kills++
            game.score += (e.elite ? 300 : 120) + 40
            addKillFeed(e.elite ? 'HEAVY GUNNER' : 'HOSTILE', false)
            spawnPickup(e.group.position.clone())
          }
        } else if (!player.dead) {
          game.score += 15
        }
      }
    }
  }

  update(dt) {
    if (this.dead) return
    this.fuse -= dt
    this.trailTimer -= dt
    if (this.trailTimer <= 0) {
      this.trailTimer = 0.05
      effects.smokePuff(this.pos, new THREE.Vector3(0, 0.5, 0), 1, 0.16, 0x6a6e72)
    }
    this.vel.y -= 19 * dt
    this.pos.addScaledVector(this.vel, dt)
    if (this.pos.y < 0.1) {
      this.pos.y = 0.1
      this.vel.y *= -0.4
      this.vel.x *= 0.7
      this.vel.z *= 0.7
    }
    for (const box of world.colliders) {
      if (box.max.y < 0.25) continue
      if (this.pos.x > box.min.x - 0.1 && this.pos.x < box.max.x + 0.1 &&
          this.pos.z > box.min.z - 0.1 && this.pos.z < box.max.z + 0.1 &&
          this.pos.y > box.min.y - 0.1 && this.pos.y < box.max.y + 0.1) {
        const dl = this.pos.x - (box.min.x - 0.1)
        const dr = (box.max.x + 0.1) - this.pos.x
        const df = this.pos.z - (box.min.z - 0.1)
        const db = (box.max.z + 0.1) - this.pos.z
        const m = Math.min(dl, dr, df, db)
        if (m === dl) { this.pos.x = box.min.x - 0.1; this.vel.x = -Math.abs(this.vel.x) * 0.4 }
        else if (m === dr) { this.pos.x = box.max.x + 0.1; this.vel.x = Math.abs(this.vel.x) * 0.4 }
        else if (m === df) { this.pos.z = box.min.z - 0.1; this.vel.z = -Math.abs(this.vel.z) * 0.4 }
        else { this.pos.z = box.max.z + 0.1; this.vel.z = Math.abs(this.vel.z) * 0.4 }
      }
    }
    this.group.position.copy(this.pos)
    this.group.rotation.x += this.spin.x * dt
    this.group.rotation.y += this.spin.y * dt
    this.group.rotation.z += this.spin.z * dt
    const blink = Math.sin(performance.now() / (this.fuse < 0.7 ? 45 : 140)) > 0
    this.led.material.color.setHex(blink ? 0xff3020 : 0x330805)
    this.light.intensity = blink ? 3 : 0
    if (this.fuse <= 0) this.explode()
  }
}

function throwGrenade() {
  if (player.dead || game.state !== 'playing') return
  if (player.grenades <= 0) { showSubtitle('NO FRAG GRENADES', 1.2); return }
  player.grenades--
  grenades.push(new Grenade())
  player.addRecoil(0.02)
}

function updateGrenades(dt) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    grenades[i].update(dt)
    if (grenades[i].dead) grenades.splice(i, 1)
  }
  for (let i = blastLights.length - 1; i >= 0; i--) {
    const b = blastLights[i]
    b.life -= dt
    if (b.life <= 0) { scene.remove(b.light); blastLights.splice(i, 1); continue }
    const k = b.life / b.max
    b.light.intensity = 210 * k * k
  }
  for (let i = blastSprites.length - 1; i >= 0; i--) {
    const b = blastSprites[i]
    b.life -= dt
    if (b.life <= 0) { scene.remove(b.spr); b.spr.material.dispose(); blastSprites.splice(i, 1); continue }
    const k = b.life / b.max
    b.spr.material.opacity = k * 0.75
    b.spr.scale.setScalar(2.2 + (1 - k) * 4.2)
  }
  for (let i = blastRings.length - 1; i >= 0; i--) {
    const b = blastRings[i]
    b.life -= dt
    if (b.life <= 0) { scene.remove(b.ring); b.ring.geometry.dispose(); b.ring.material.dispose(); blastRings.splice(i, 1); continue }
    const k = b.life / b.max
    b.ring.material.opacity = k * 0.8
    b.ring.scale.setScalar(1 + (1 - k) * 9)
  }
}

// ---------------------------------------------------------------------------
// waves
// ---------------------------------------------------------------------------
function spawnEnemy() {
  const candidates = world.spawnPoints.filter((p) => p.distanceTo(player.position) > 16)
  const pos = (candidates.length ? candidates : world.spawnPoints)[Math.floor(Math.random() * (candidates.length || world.spawnPoints.length))].clone()
  pos.x += (Math.random() - 0.5) * 3
  pos.z += (Math.random() - 0.5) * 3
  const elite = game.wave >= 3 && Math.random() < Math.min(0.28, 0.08 * (game.wave - 2))
  const enemy = new Enemy(scene, { position: pos, elite })
  enemy.group.rotation.y = Math.atan2(player.position.x - pos.x, player.position.z - pos.z)
  game.enemies.push(enemy)
  effects.smokePuff(pos.clone().add(new THREE.Vector3(0, 0.8, 0)), new THREE.Vector3(0, 0.4, 0), 4, 1.4, 0x5a6068)
  effects.sparkBurst(pos.clone().add(new THREE.Vector3(0, 0.4, 0)), new THREE.Vector3(0, 1, 0), 6, 0xff5a2a)
}

function startWave() {
  if (game.wave >= MAX_WAVES) {
    winGame()
    return
  }
  game.wave++
  game.waveActive = true
  game.spawnQueue = 3 + game.wave
  game.spawnTimer = 0.7
  game.waveStartTime = performance.now() / 1000
  showBanner(game.wave, game.wave === MAX_WAVES ? 'FINAL ASSAULT — HOLD THE LINE' : 'HOSTILES INBOUND')
  showSubtitle(game.wave === MAX_WAVES ? 'Final wave. Hold the compound.' : `Wave ${game.wave} inbound. Stay sharp.`, 3)
  audio.waveStart()
}

function clearWave() {
  game.waveActive = false
  game.intermission = 5.5
  showSubtitle('SECTOR CLEAR — REGROUP', 3)
  audio.waveClear()
  if (game.wave >= MAX_WAVES) game.winDelay = 1.2
}

function updateWaves(dt) {
  if (!game.waveActive) {
    if (game.intermission > 0) {
      game.intermission -= dt
      if (game.intermission <= 0 && game.state === 'playing' && game.wave < MAX_WAVES) startWave()
    }
    return
  }
  const alive = game.enemies.filter((e) => !e.dead).length
  const maxAlive = 3 + Math.min(4, game.wave)
  if (game.spawnQueue > 0) {
    game.spawnTimer -= dt
    if (game.spawnTimer <= 0 && alive < maxAlive) {
      spawnEnemy()
      game.spawnQueue--
      game.spawnTimer = 0.55 + Math.random() * 0.75
    }
  } else if (alive === 0) {
    clearWave()
  }
}

// ---------------------------------------------------------------------------
// game flow
// ---------------------------------------------------------------------------
function resetGame() {
  for (const e of game.enemies) e.dispose()
  game.enemies.length = 0
  for (const pk of game.pickups) {
    scene.remove(pk.group)
    pk.group.traverse((o) => {
      if (o.isMesh) { o.geometry.dispose(); if (o.material !== pk.mat) o.material.dispose() }
    })
    pk.mat.dispose()
  }
  game.pickups.length = 0
  for (const g of grenades) g.dispose()
  grenades.length = 0
  for (const b of blastLights) scene.remove(b.light)
  blastLights.length = 0
  for (const b of blastSprites) { scene.remove(b.spr); b.spr.material.dispose() }
  blastSprites.length = 0
  for (const b of blastRings) scene.remove(b.ring)
  blastRings.length = 0
  game.wave = 0
  game.kills = 0
  game.score = 0
  game.spawnQueue = 0
  game.spawnTimer = 0
  game.intermission = 0
  game.waveActive = false
  game.startDelay = 0
  game.winDelay = 0
  game.deathShown = false
  game.deathDelay = 0
  game.generation++
  player.applySpawn()
  player.position.copy(world.playerSpawn)
  player.position.y = 0
  player.yaw = world.playerYaw
  player.syncCamera(0)
  for (const el of hud.killfeed.children) el.remove()
  hud.waveBanner.classList.add('hidden')
  hud.damageFlash.style.opacity = '0'
  hud.damageArcs.style.opacity = '0'
  hud.lowHealth.style.opacity = '0'
  hud.reloadHint.classList.add('hidden')
}

function beginGame() {
  resetGame()
  game.state = 'playing'
  $('menu').classList.add('hidden')
  $('pause').classList.add('hidden')
  $('dead').classList.add('hidden')
  $('win').classList.add('hidden')
  $('hud').classList.remove('hidden')
  audio.resume()
  requestLock()
  game.startDelay = 0.9
}

function requestLock() {
  if (document.pointerLockElement) return
  try {
    const p = canvas.requestPointerLock({ unadjustedMovement: true })
    if (p && p.catch) p.catch(() => { try { canvas.requestPointerLock() } catch {} })
  } catch {
    try { canvas.requestPointerLock() } catch {}
  }
}

function pauseGame() {
  if (game.state !== 'playing') return
  game.state = 'paused'
  game.pausedFrom = 'playing'
  keys.clear()
  player.triggerDown = false
  player.adsHeld = false
  player.ads = false
  audio.suspend()
  $('pause').classList.remove('hidden')
  if (document.pointerLockElement) document.exitPointerLock()
}

function resumeGame() {
  if (game.state !== 'paused') return
  game.state = 'playing'
  $('pause').classList.add('hidden')
  audio.resume()
  requestLock()
}

function onPlayerDeath() {
  game.state = 'dead'
  game.deathShown = false
  game.deathDelay = 1.3
  keys.clear()
  player.triggerDown = false
  player.adsHeld = false
  showSubtitle('OPERATOR DOWN', 2)
}

function showDeathScreen() {
  if (game.deathShown) return
  game.deathShown = true
  $('dead-waves').textContent = Math.max(0, game.wave - (game.waveActive ? 1 : 0))
  $('dead-kills').textContent = game.kills
  $('dead-score').textContent = game.score.toLocaleString('en-US')
  $('dead').classList.remove('hidden')
  $('hud').classList.add('hidden')
  if (document.pointerLockElement) document.exitPointerLock()
}

function winGame() {
  if (game.state === 'won') return
  game.state = 'won'
  keys.clear()
  $('win-kills').textContent = game.kills
  $('win-score').textContent = game.score.toLocaleString('en-US')
  $('win').classList.remove('hidden')
  $('hud').classList.add('hidden')
  if (document.pointerLockElement) document.exitPointerLock()
  audio.waveClear()
}

// ---------------------------------------------------------------------------
// input
// ---------------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ControlLeft', 'ShiftLeft'].includes(e.code)) e.preventDefault()
  if (e.code === 'Escape') {
    if (game.state === 'playing') pauseGame()
    else if (game.state === 'paused') resumeGame()
    return
  }
  if (!keys.has(e.code)) player.onKey(e.code, true)
  keys.add(e.code)
})

window.addEventListener('keyup', (e) => {
  keys.delete(e.code)
  player.onKey(e.code, false)
})

window.addEventListener('blur', () => {
  keys.clear()
  player.triggerDown = false
  player.adsHeld = false
  player.ads = false
  if (game.state === 'playing') pauseGame()
})

canvas.addEventListener('mousedown', (e) => {
  if (game.state !== 'playing') return
  if (!document.pointerLockElement) requestLock()
  player.onMouseDown(e.button)
})

window.addEventListener('mouseup', (e) => {
  player.onMouseUp(e.button)
})

window.addEventListener('mousemove', (e) => {
  if (game.state !== 'playing') return
  if (!document.pointerLockElement && !location.search.includes('autostart')) return
  player.onMouseMove(e.movementX || 0, e.movementY || 0)
})

window.addEventListener('contextmenu', (e) => e.preventDefault())

document.addEventListener('pointerlockchange', () => {
  const locked = !!document.pointerLockElement
  if (locked) {
    game.hadLock = true
  } else if (game.hadLock && game.state === 'playing') {
    game.hadLock = false
    pauseGame()
  }
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') pauseGame()
})

// menus
$('deploy').addEventListener('click', beginGame)
$('howto').addEventListener('click', () => {
  document.body.classList.toggle('show-brief')
  const side = document.querySelector('.menu-side')
  if (side) side.classList.toggle('mobile-show')
})
$('resume').addEventListener('click', resumeGame)
$('restart').addEventListener('click', beginGame)
$('redeploy').addEventListener('click', beginGame)
$('again').addEventListener('click', beginGame)

window.addEventListener('resize', () => {
  const w = window.innerWidth
  const h = window.innerHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  weaponCamera.aspect = w / h
  weaponCamera.updateProjectionMatrix()
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
  renderer.setPixelRatio(dpr)
  composer.setPixelRatio(dpr)
  renderer.setSize(w, h)
  composer.setSize(w, h)
  bloom.setSize(w, h)
  gradePass.uniforms.uRes.value.set(w, h)
})

// ---------------------------------------------------------------------------
// loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock()
let elapsed = 0
let firstFrame = true

function simulate(dt) {
  if (game.state === 'playing') {
    if (game.startDelay > 0) {
      game.startDelay -= dt
      if (game.startDelay <= 0 && game.wave === 0) startWave()
    }
    if (game.winDelay > 0) {
      game.winDelay -= dt
      if (game.winDelay <= 0) winGame()
    }
    player.update(dt, elapsed, { keys })
    world.update(dt, elapsed, camera)
    effects.update(dt)
    updatePickups(dt, elapsed)
    updateGrenades(dt)
    updateWaves(dt)
    audio.ambientTick(dt)

    for (let i = game.enemies.length - 1; i >= 0; i--) {
      const e = game.enemies[i]
      e.update(dt, elapsed, player, world, {
        onShoot: enemyShoot,
        onBurstStart: (en) => {
          const d = en.group.position.distanceTo(player.position)
          audio.enemyShot(d, clamp((en.group.position.x - player.position.x) / 30, -1, 1))
        }
      })
      if (e.remove) {
        e.dispose()
        game.enemies.splice(i, 1)
      }
    }

    updateHUD(dt)
  } else if (game.state === 'paused' || game.state === 'menu') {
    player.syncCamera(dt)
    world.update(dt, elapsed, camera)
    effects.update(dt)
    updateHUD(dt)
  } else {
    if (game.state === 'dead' && !game.deathShown) {
      game.deathDelay -= dt
      if (game.deathDelay <= 0) showDeathScreen()
    }
    world.update(dt, elapsed, camera)
    effects.update(dt)
    updateHUD(dt)
  }
}

function animate() {
  const dt = Math.min(0.05, clock.getDelta())
  elapsed += dt
  simulate(dt)

  // subtle camera breathing on menu
  if (game.state === 'menu') {
    camera.position.set(5 + Math.sin(elapsed * 0.18) * 1.6, 4.6 + Math.sin(elapsed * 0.24) * 0.12, 28 - Math.cos(elapsed * 0.16) * 1.2)
    camera.lookAt(-1, 3.2, -8)
  }

  gradePass.uniforms.uTime.value = elapsed
  composer.render()

  if (game.state !== 'menu') {
    renderer.clearDepth()
    renderer.autoClear = false
    renderer.render(weaponScene, weaponCamera)
    renderer.autoClear = true
  }

  if (firstFrame) {
    firstFrame = false
    renderer.shadowMap.autoUpdate = false
    setTimeout(() => $('loading').classList.add('done'), 260)
  }
  requestAnimationFrame(animate)
}

window.__breach = {
  game, player, world, effects, scene, camera, weaponScene, rifle, spawnEnemy, beginGame, startWave, winGame, pauseGame, resumeGame, hud, grenades, throwGrenade, THREE,
  spawnEnemyAt(x, z, elite = false) {
    const e = new Enemy(scene, { position: new THREE.Vector3(x, 0, z), elite })
    game.enemies.push(e)
    return e
  },
  aimAt(x, y, z) {
    const dx = x - player.position.x
    const dz = z - player.position.z
    player.yaw = Math.atan2(-dx, -dz)
    const dist = Math.hypot(dx, dz)
    player.pitch = Math.atan2(y - (player.position.y + player.eyeHeight), Math.max(0.01, dist))
    player.syncCamera(0)
  },
  tick(n = 1, dt = 1 / 60) {
    for (let i = 0; i < n; i++) {
      elapsed += dt
      simulate(dt)
      scene.updateMatrixWorld(true)
    }
  },
  clearEnemies() {
    for (const e of game.enemies) e.dispose()
    game.enemies.length = 0
  }
}

// autostart for automated captures / demos
const params = new URLSearchParams(location.search)
if (params.has('autostart')) {
  beginGame()
} else {
  player.syncCamera(0)
}

animate()
