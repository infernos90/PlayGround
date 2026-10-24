import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { softCircle } from './textures.js'

const gunmetal = new THREE.MeshStandardMaterial({ color: 0x2b2f35, roughness: 0.32, metalness: 0.9 })
const gunmetalDark = new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.4, metalness: 0.82 })
const polymer = new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.76, metalness: 0.14 })
const tan = new THREE.MeshStandardMaterial({ color: 0x4a3b28, roughness: 0.82, metalness: 0.06 })
const wood = new THREE.MeshStandardMaterial({ color: 0x4a2814, roughness: 0.62, metalness: 0.1 })
const glove = new THREE.MeshStandardMaterial({ color: 0x1e201f, roughness: 0.9, metalness: 0.04 })
const accent = new THREE.MeshStandardMaterial({ color: 0x8a4a20, roughness: 0.55, metalness: 0.35 })

function box(w, h, d, material, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}

function rbox(w, h, d, r, material, x, y, z, parent) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) * 0.45)), material)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  return m
}

function cyl(r1, r2, h, material, x, y, z, parent, seg = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), material)
  m.position.set(x, y, z)
  m.rotation.x = Math.PI / 2
  m.castShadow = true
  parent.add(m)
  return m
}

export function buildRifle() {
  const group = new THREE.Group()
  group.position.set(0.275, -0.252, -0.6)
  group.rotation.set(0.015, 0.155, 0.01)
  group.scale.setScalar(0.55)

  const model = new THREE.Group()
  group.add(model)

  // receiver
  rbox(0.088, 0.12, 0.44, 0.012, gunmetal, 0, 0.02, 0, model)
  rbox(0.094, 0.035, 0.46, 0.01, gunmetalDark, 0, 0.093, -0.01, model)
  // rail teeth
  for (let i = 0; i < 9; i++) {
    box(0.062, 0.007, 0.014, gunmetalDark, 0, 0.113, -0.24 + i * 0.045, model)
  }
  // handguard
  const hg = rbox(0.082, 0.095, 0.36, 0.022, wood, 0, 0.012, -0.42, model)
  for (let i = 0; i < 5; i++) {
    box(0.086, 0.012, 0.02, gunmetalDark, 0, 0.062, -0.56 + i * 0.065, model)
  }
  // barrel
  cyl(0.016, 0.016, 0.34, gunmetalDark, 0, 0.02, -0.79, model)
  cyl(0.03, 0.026, 0.09, gunmetal, 0, 0.02, -0.96, model)
  // suppressor
  cyl(0.036, 0.036, 0.3, gunmetalDark, 0, 0.02, -1.13, model, 20)
  cyl(0.038, 0.038, 0.025, gunmetal, 0, 0.02, -1.28, model)
  for (let i = 0; i < 5; i++) {
    box(0.072, 0.008, 0.02, gunmetal, 0, 0.02, -1.05 - i * 0.045, model)
  }
  // gas block
  box(0.05, 0.05, 0.06, gunmetal, 0, 0.055, -0.66, model)
  cyl(0.009, 0.009, 0.28, gunmetalDark, 0, 0.07, -0.7, model)

  // stock
  const stock = new THREE.Group()
  model.add(stock)
  rbox(0.07, 0.1, 0.24, 0.018, wood, 0, 0.01, 0.31, stock)
  const butt = rbox(0.075, 0.19, 0.06, 0.018, wood, 0, -0.01, 0.44, stock)
  butt.rotation.x = -0.08
  box(0.05, 0.07, 0.12, gunmetalDark, 0, 0.06, 0.24, stock)
  // cheek riser
  box(0.055, 0.03, 0.14, tan, 0, 0.1, 0.3, stock)

  // pistol grip
  const grip = rbox(0.055, 0.15, 0.075, 0.014, polymer, 0, -0.09, 0.13, model)
  grip.rotation.x = 0.32
  // trigger guard
  box(0.06, 0.012, 0.11, gunmetalDark, 0, -0.06, 0.03, model)
  box(0.012, 0.06, 0.012, gunmetalDark, 0, -0.075, -0.02, model)
  const trigger = box(0.012, 0.035, 0.012, gunmetal, 0, -0.045, 0.035, model)
  trigger.rotation.x = 0.2

  // magazine
  const magazine = new THREE.Group()
  magazine.position.set(0, -0.075, -0.1)
  model.add(magazine)
  const mag1 = rbox(0.055, 0.16, 0.085, 0.01, gunmetalDark, 0, -0.06, 0.01, magazine)
  mag1.rotation.x = -0.14
  const mag2 = rbox(0.05, 0.1, 0.075, 0.01, gunmetalDark, 0, -0.16, 0.05, magazine)
  mag2.rotation.x = -0.42
  box(0.056, 0.02, 0.09, accent, 0, -0.225, 0.09, magazine)

  // vertical foregrip
  const fg = rbox(0.04, 0.14, 0.05, 0.014, polymer, 0, -0.075, -0.52, model)
  fg.rotation.x = -0.08

  // optic base + holo sight
  const optic = new THREE.Group()
  optic.position.set(0, 0.135, -0.04)
  model.add(optic)
  box(0.06, 0.022, 0.13, gunmetal, 0, 0, 0, optic)
  box(0.026, 0.018, 0.1, gunmetal, 0, 0.02, 0, optic)
  const hood = new THREE.Group()
  hood.position.set(0, 0.075, -0.01)
  optic.add(hood)
  box(0.046, 0.008, 0.09, gunmetal, 0, 0.062, 0, hood)
  box(0.008, 0.066, 0.09, gunmetal, -0.026, 0.028, 0, hood)
  box(0.008, 0.066, 0.09, gunmetal, 0.026, 0.028, 0, hood)
  box(0.052, 0.01, 0.01, gunmetal, 0, -0.005, 0.046, hood)

  // reticle plane
  const reticleCanvas = document.createElement('canvas')
  reticleCanvas.width = reticleCanvas.height = 128
  const rctx = reticleCanvas.getContext('2d')
  rctx.clearRect(0, 0, 128, 128)
  rctx.strokeStyle = 'rgba(255,60,40,0.95)'
  rctx.lineWidth = 3
  rctx.beginPath()
  rctx.arc(64, 64, 34, 0, Math.PI * 2)
  rctx.stroke()
  rctx.fillStyle = 'rgba(255,50,30,1)'
  rctx.shadowColor = 'rgba(255,60,30,0.9)'
  rctx.shadowBlur = 10
  rctx.beginPath()
  rctx.arc(64, 64, 3.6, 0, Math.PI * 2)
  rctx.fill()
  rctx.shadowBlur = 0
  rctx.fillStyle = 'rgba(255,50,30,0.85)'
  rctx.fillRect(62, 6, 4, 20)
  rctx.fillRect(62, 102, 4, 20)
  rctx.fillRect(6, 62, 20, 4)
  rctx.fillRect(102, 62, 20, 4)
  const reticleTex = new THREE.CanvasTexture(reticleCanvas)
  reticleTex.colorSpace = THREE.SRGBColorSpace
  const reticle = new THREE.Mesh(
    new THREE.PlaneGeometry(0.042, 0.042),
    new THREE.MeshBasicMaterial({
      map: reticleTex, transparent: true, opacity: 0.75, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false
    })
  )
  reticle.position.set(0, 0.03, 0.038)
  hood.add(reticle)

  // tactical light
  cyl(0.028, 0.028, 0.1, gunmetal, 0.072, 0.01, -0.5, model, 12)
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.024, 12), new THREE.MeshBasicMaterial({ color: 0xfff4d8, toneMapped: false }))
  lens.position.set(0.072, 0.01, -0.552)
  model.add(lens)
  // rear iron sight
  box(0.05, 0.03, 0.02, gunmetalDark, 0, 0.125, 0.13, model)
  // front sight
  box(0.04, 0.055, 0.02, gunmetalDark, 0, 0.12, -0.6, model)
  // receiver accent line
  box(0.002, 0.012, 0.3, accent, 0.046, 0.045, -0.02, model)
  // charging handle
  box(0.012, 0.02, 0.09, gunmetal, 0.055, 0.06, 0.06, model)
  // ejection port
  box(0.004, 0.04, 0.09, new THREE.MeshBasicMaterial({ color: 0x050505 }), 0.046, 0.035, 0.03, model)
  // sling loop
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 5, 12), gunmetalDark)
  loop.position.set(0.05, -0.02, 0.2)
  loop.rotation.y = Math.PI / 2
  model.add(loop)

  // hands
  const rightHand = new THREE.Group()
  rightHand.position.set(0.018, -0.105, 0.115)
  model.add(rightHand)
  const palm = rbox(0.062, 0.08, 0.09, 0.018, glove, 0, 0, 0, rightHand)
  palm.rotation.x = 0.28
  for (let i = 0; i < 4; i++) {
    const finger = box(0.013, 0.048, 0.02, glove, -0.021 + i * 0.014, 0.018, -0.035, rightHand)
    finger.rotation.x = 0.9
  }
  box(0.016, 0.05, 0.03, glove, 0.036, 0.01, -0.01, rightHand).rotation.z = -0.5
  // wrist/sleeve
  const sleeveR = box(0.085, 0.1, 0.16, new THREE.MeshStandardMaterial({ color: 0x23251f, roughness: 0.95 }), 0.01, -0.055, 0.17, rightHand)
  sleeveR.rotation.x = 0.5

  const leftHand = new THREE.Group()
  leftHand.position.set(0, -0.09, -0.5)
  model.add(leftHand)
  const lpalm = rbox(0.065, 0.085, 0.08, 0.018, glove, 0, 0, -0.05, leftHand)
  lpalm.rotation.x = -0.2
  for (let i = 0; i < 4; i++) {
    box(0.014, 0.05, 0.02, glove, -0.022 + i * 0.015, 0.012, -0.09, leftHand).rotation.x = -0.6
  }
  box(0.055, 0.075, 0.05, glove, 0, -0.04, -0.1, leftHand).rotation.x = -0.35
  const sleeveL = box(0.09, 0.11, 0.2, new THREE.MeshStandardMaterial({ color: 0x23251f, roughness: 0.95 }), -0.01, -0.06, 0.09, leftHand)
  sleeveL.rotation.x = -0.5

  // muzzle flash
  const flashTex = softCircle(0.02)
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flashTex, color: 0xffc06a, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  }))
  flash.position.set(0, 0.02, -1.29)
  flash.scale.setScalar(0.38)
  model.add(flash)

  const flashStar = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.3),
    new THREE.MeshBasicMaterial({
      map: flashTex, color: 0xffd9a0, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide
    })
  )
  flashStar.position.set(0, 0.02, -1.3)
  model.add(flashStar)

  const muzzleLight = new THREE.PointLight(0xffb060, 0, 8, 2)
  muzzleLight.position.set(0, 0.02, -1.29)
  model.add(muzzleLight)

  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, 0.02, -1.3)
  model.add(muzzle)

  const shellPort = new THREE.Object3D()
  shellPort.position.set(0.07, 0.04, 0.02)
  model.add(shellPort)

  let flashTime = 0
  const update = (dt) => {
    if (flashTime > 0) {
      flashTime -= dt
      const k = Math.max(0, flashTime / 0.045)
      flash.material.opacity = k * 0.95
      flashStar.material.opacity = k * 0.75
      flashStar.rotation.z += dt * 24
      flash.scale.setScalar(0.22 + Math.random() * 0.16 + k * 0.14)
      flashStar.scale.setScalar(0.5 + Math.random() * 0.3 + k * 0.35)
      muzzleLight.intensity = k * 12
    } else {
      flash.material.opacity = 0
      flashStar.material.opacity = 0
      muzzleLight.intensity = 0
    }
  }

  const fireFlash = () => {
    flashTime = 0.045
    flash.rotation.z = Math.random() * Math.PI
    flashStar.rotation.z = Math.random() * Math.PI
    flash.material.opacity = 0.95
    flashStar.material.opacity = 0.78
    muzzleLight.intensity = 11
  }

  return { group, model, muzzle, shellPort, magazine, reticle, optic, stock, update, fireFlash, flash, muzzleLight }
}
