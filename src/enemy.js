import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { softCircle } from './textures.js'

const skinMats = [
  new THREE.MeshStandardMaterial({ color: 0x8a6247, roughness: 0.82 }),
  new THREE.MeshStandardMaterial({ color: 0x6d4a33, roughness: 0.84 }),
  new THREE.MeshStandardMaterial({ color: 0xa07854, roughness: 0.8 })
]
const uniformMats = [
  new THREE.MeshStandardMaterial({ color: 0x3d4639, roughness: 0.88 }),
  new THREE.MeshStandardMaterial({ color: 0x444a50, roughness: 0.84 }),
  new THREE.MeshStandardMaterial({ color: 0x4d4638, roughness: 0.86 })
]
const vestMat = new THREE.MeshStandardMaterial({ color: 0x262a29, roughness: 0.76, metalness: 0.15 })
const bootMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.65 })
const gunMat = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.4, metalness: 0.85 })
const helmetMat = new THREE.MeshStandardMaterial({ color: 0x30353a, roughness: 0.66, metalness: 0.22 })
const eliteMat = new THREE.MeshStandardMaterial({ color: 0x4a2a22, roughness: 0.8 })
const visorMat = new THREE.MeshBasicMaterial({ color: 0xff2f28, toneMapped: false })
const visorMatElite = new THREE.MeshBasicMaterial({ color: 0xff8a20, toneMapped: false })

const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _losFrom = new THREE.Vector3()
const _losTo = new THREE.Vector3()
const _losDir = new THREE.Vector3()
const _ray = new THREE.Raycaster()

function rounded(w, h, d, r = 0.02) {
  return new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) * 0.45))
}

function part(parent, geo, material, x, y, z) {
  const m = new THREE.Mesh(geo, material)
  m.position.set(x, y, z)
  m.castShadow = false
  m.receiveShadow = true
  parent.add(m)
  return m
}

export class Enemy {
  constructor(scene, opts = {}) {
    this.scene = scene
    this.elite = !!opts.elite
    this.maxHealth = this.elite ? 220 : 120
    this.health = this.maxHealth
    this.speed = this.elite ? 2.05 : 1.65
    this.damage = this.elite ? 10 : 6
    this.radius = 0.42
    this.dead = false
    this.deathTime = 0
    this.remove = false
    this.state = 'advance'
    this.fireCooldown = 0.8 + Math.random() * 1.2
    this.burst = 0
    this.strafeDir = Math.random() > 0.5 ? 1 : -1
    this.strafeTimer = 1.5 + Math.random() * 2
    this.walkPhase = Math.random() * Math.PI * 2
    this.losTimer = 0
    this.hasLOS = false
    this.stagger = 0
    this.hitFlash = 0
    this.lastDamageTime = -10
    this.moving = false
    this.stuckTimer = 0
    this.unstickTime = 0
    this.lastCheckPos = new THREE.Vector3()

    this.group = new THREE.Group()
    this.group.position.copy(opts.position || new THREE.Vector3())
    scene.add(this.group)
    this.lastCheckPos.copy(this.group.position)

    this.blob = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 1.15),
      new THREE.MeshBasicMaterial({
        map: softCircle(0.02), color: 0x000000, transparent: true,
        opacity: 0.48, depthWrite: false, toneMapped: false
      })
    )
    this.blob.rotation.x = -Math.PI / 2
    this.blob.position.set(this.group.position.x, 0.02, this.group.position.z)
    this.blob.renderOrder = 2
    scene.add(this.blob)

    this.body = new THREE.Group()
    this.group.add(this.body)

    const skin = skinMats[Math.floor(Math.random() * skinMats.length)]
    const uniform = (this.elite ? eliteMat : uniformMats[Math.floor(Math.random() * uniformMats.length)]).clone()
    this.uniform = uniform

    this.hitMeshes = []
    const tag = (mesh, partName, mult = 1) => {
      mesh.userData.enemy = this
      mesh.userData.part = partName
      mesh.userData.mult = mult
      this.hitMeshes.push(mesh)
      return mesh
    }

    // legs
    const legGeo = new THREE.CapsuleGeometry(0.088, 0.62, 4, 8)
    const shinGeo = new THREE.CapsuleGeometry(0.072, 0.56, 4, 8)
    this.legL = new THREE.Group()
    this.legL.position.set(-0.15, 0.9, 0)
    this.body.add(this.legL)
    tag(part(this.legL, legGeo, uniform, 0, -0.4, 0), 'limb', 0.8)
    tag(part(this.legL, shinGeo, uniform, 0, -0.86, 0.01), 'limb', 0.8)
    part(this.legL, new THREE.BoxGeometry(0.2, 0.16, 0.3), bootMat, 0, -1.24, 0.05)
    part(this.legL, rounded(0.17, 0.13, 0.08, 0.04), vestMat, 0, -0.68, 0.1)

    this.legR = new THREE.Group()
    this.legR.position.set(0.15, 0.9, 0)
    this.body.add(this.legR)
    tag(part(this.legR, legGeo, uniform, 0, -0.4, 0), 'limb', 0.8)
    tag(part(this.legR, shinGeo, uniform, 0, -0.86, 0.01), 'limb', 0.8)
    part(this.legR, new THREE.BoxGeometry(0.2, 0.16, 0.3), bootMat, 0, -1.24, 0.05)
    part(this.legR, rounded(0.17, 0.13, 0.08, 0.04), vestMat, 0, -0.68, 0.1)

    // torso
    this.torso = new THREE.Group()
    this.torso.position.set(0, 1.02, 0)
    this.body.add(this.torso)
    tag(part(this.torso, rounded(0.5, 0.6, 0.29, 0.07), uniform, 0, 0.3, 0), 'body', 1)
    // vest
    tag(part(this.torso, rounded(0.54, 0.44, 0.35, 0.06), vestMat, 0, 0.3, 0), 'body', 1)
    // pouches
    for (let i = -1; i <= 1; i++) {
      part(this.torso, new THREE.BoxGeometry(0.13, 0.16, 0.08), vestMat, i * 0.16, 0.15, 0.2)
    }
    part(this.torso, new THREE.BoxGeometry(0.4, 0.05, 0.44), vestMat, 0, 0.55, 0)
    // shoulder pads
    part(this.torso, new THREE.SphereGeometry(0.105, 10, 8), vestMat, -0.31, 0.5, 0)
    part(this.torso, new THREE.SphereGeometry(0.105, 10, 8), vestMat, 0.31, 0.5, 0)
    // red armband
    const bandMat = this.elite ? visorMatElite : visorMat
    part(this.torso, new THREE.BoxGeometry(0.08, 0.1, 0.24), bandMat, -0.31, 0.38, 0)
    // backpack
    part(this.torso, rounded(0.35, 0.4, 0.18, 0.05), vestMat, 0, 0.32, -0.24)
    part(this.torso, new THREE.BoxGeometry(0.12, 0.12, 0.06), gunMat, 0.12, 0.42, -0.35)
    // chest light
    const chestLight = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), bandMat)
    chestLight.position.set(0.16, 0.4, 0.19)
    this.torso.add(chestLight)

    // head
    this.head = new THREE.Group()
    this.head.position.set(0, 0.72, 0)
    this.torso.add(this.head)
    const headMesh = part(this.head, rounded(0.22, 0.26, 0.23, 0.08), skin, 0, 0.14, 0.01)
    tag(headMesh, 'head', 2.6)
    // balaclava
    part(this.head, rounded(0.225, 0.15, 0.235, 0.06), vestMat, 0, 0.06, 0.01)
    // helmet
    part(this.head, new THREE.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), helmetMat, 0, 0.28, 0)
    part(this.head, new THREE.BoxGeometry(0.28, 0.06, 0.06), helmetMat, 0, 0.24, 0.16)
    // goggles
    part(this.head, new THREE.BoxGeometry(0.2, 0.028, 0.03), bandMat, 0, 0.17, 0.128)
    // headset
    part(this.head, new THREE.BoxGeometry(0.04, 0.1, 0.12), gunMat, -0.13, 0.17, 0)
    // antenna
    part(this.head, new THREE.CylinderGeometry(0.005, 0.005, 0.3, 4), gunMat, 0.13, 0.38, -0.03)

    // arms
    this.armL = new THREE.Group()
    this.armL.position.set(-0.3, 0.52, 0)
    this.torso.add(this.armL)
    tag(part(this.armL, new THREE.CapsuleGeometry(0.062, 0.32, 4, 8), uniform, 0, -0.2, 0), 'limb', 0.8)
    tag(part(this.armL, new THREE.CapsuleGeometry(0.054, 0.3, 4, 8), uniform, 0, -0.56, 0.02), 'limb', 0.8)
    part(this.armL, new THREE.BoxGeometry(0.12, 0.12, 0.14), bootMat, 0, -0.76, 0.03)

    this.armR = new THREE.Group()
    this.armR.position.set(0.3, 0.52, 0)
    this.torso.add(this.armR)
    tag(part(this.armR, new THREE.CapsuleGeometry(0.062, 0.32, 4, 8), uniform, 0, -0.2, 0), 'limb', 0.8)
    tag(part(this.armR, new THREE.CapsuleGeometry(0.054, 0.3, 4, 8), uniform, 0, -0.56, 0.02), 'limb', 0.8)
    part(this.armR, new THREE.BoxGeometry(0.12, 0.12, 0.14), bootMat, 0, -0.76, 0.03)

    // rifle
    this.rifle = new THREE.Group()
    this.rifle.position.set(0.16, 0.16, 0.3)
    this.torso.add(this.rifle)
    part(this.rifle, new THREE.BoxGeometry(0.07, 0.1, 0.5), gunMat, 0, 0, 0)
    part(this.rifle, new THREE.BoxGeometry(0.05, 0.05, 0.34), gunMat, 0, 0.005, 0.4)
    part(this.rifle, new THREE.CylinderGeometry(0.014, 0.014, 0.24, 6), gunMat, 0, 0.02, 0.62).rotation.x = Math.PI / 2
    part(this.rifle, new THREE.BoxGeometry(0.05, 0.15, 0.08), gunMat, 0, -0.1, 0.06)
    part(this.rifle, new THREE.BoxGeometry(0.05, 0.08, 0.2), gunMat, 0, -0.01, -0.3)
    part(this.rifle, new THREE.BoxGeometry(0.04, 0.05, 0.1), gunMat, 0, 0.09, 0.05)

    this.muzzle = new THREE.Object3D()
    this.muzzle.position.set(0, 0.02, 0.76)
    this.rifle.add(this.muzzle)

    this.muzzleFlash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softCircle(0.04), color: 0xffb060, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }))
    this.muzzleFlash.scale.setScalar(0.5)
    this.muzzle.add(this.muzzleFlash)
    this.flashTime = 0

    // health bar
    this.bar = new THREE.Group()
    this.bar.position.set(0, 2.18, 0)
    this.group.add(this.bar)
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 0.07),
      new THREE.MeshBasicMaterial({ color: 0x05070a, transparent: true, opacity: 0.65, depthWrite: false, depthTest: false })
    )
    bg.renderOrder = 20
    this.bar.add(bg)
    this.barFill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.045),
      new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false, toneMapped: false })
    )
    this.barFill.position.z = 0.001
    this.barFill.renderOrder = 21
    this.barFill.geometry.translate(0.35, 0, 0)
    this.barFill.position.x = -0.35
    this.bar.add(this.barFill)
    this.bar.visible = false

    this.group.rotation.y = Math.random() * Math.PI * 2
    if (this.elite) this.group.scale.setScalar(1.08)
  }

  get position() { return this.group.position }

  takeDamage(amount, point, isHead = false) {
    if (this.dead) return false
    this.health -= amount
    this.hitFlash = 0.07
    this.lastDamageTime = performance.now() / 1000
    this.bar.visible = true
    if (this.health <= 0) {
      this.die(isHead)
      return true
    }
    return false
  }

  die(isHead = false) {
    if (this.dead) return
    this.dead = true
    this.deathTime = 0
    this.state = 'dead'
    this.bar.visible = false
    this.fallDir = isHead ? -1 : (Math.random() > 0.5 ? 1 : -1)
    this.fallAxis = Math.random() > 0.5 ? 'x' : 'z'
    this.body.rotation.order = 'XYZ'
  }

  muzzleWorld(target) {
    this.muzzle.getWorldPosition(target)
    return target
  }

  hasLineOfSight(playerPos, world) {
    this.muzzleWorld(_losFrom)
    _losTo.copy(playerPos)
    _losTo.y += 1.2
    _losDir.copy(_losFrom).sub(_losTo)
    const dist = _losDir.length()
    _losDir.normalize()
    _ray.set(_losTo, _losDir)
    _ray.far = Math.max(0.1, dist - 0.35)
    const hits = _ray.intersectObjects(world.hitMeshes, false)
    return hits.length === 0
  }

  update(dt, t, player, world, callbacks) {
    if (this.dead) {
      this.deathTime += dt
      const k = Math.min(1, this.deathTime / 0.7)
      const ease = 1 - Math.pow(1 - k, 3)
      if (this.fallAxis === 'x') this.body.rotation.x = this.fallDir * ease * Math.PI * 0.52
      else this.body.rotation.z = this.fallDir * ease * Math.PI * 0.52
      this.body.position.y = -ease * 0.15
      this.blob.material.opacity = Math.max(0, 0.48 - this.deathTime * 0.12)
      if (this.deathTime > 3.2) {
        this.group.position.y -= dt * 0.6
        this.group.visible = this.group.position.y > -2
        if (this.group.position.y <= -2) this.remove = true
      }
      return
    }

    if (this.hitFlash > 0) {
      this.hitFlash -= dt
      this.uniform.emissive.setHex(this.hitFlash > 0 ? 0x330000 : 0x000000)
      this.uniform.emissiveIntensity = this.hitFlash > 0 ? 1.4 : 0
    } else if (this.uniform.emissive.getHex() !== 0) {
      this.uniform.emissive.setHex(0x000000)
    }

    this.stagger = Math.max(0, this.stagger - dt)
    const toPlayer = _v1.copy(player.position).sub(this.group.position)
    toPlayer.y = 0
    const dist = toPlayer.length()
    toPlayer.normalize()

    this.losTimer -= dt
    if (this.losTimer <= 0) {
      this.losTimer = 0.28 + Math.random() * 0.18
      this.hasLOS = this.hasLineOfSight(player.position, world)
    }

    // face player smoothly
    const targetAngle = Math.atan2(toPlayer.x, toPlayer.z)
    let diff = targetAngle - this.group.rotation.y
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    this.group.rotation.y += diff * Math.min(1, dt * 7)

    // movement
    this.strafeTimer -= dt
    if (this.strafeTimer <= 0) {
      this.strafeTimer = 1.6 + Math.random() * 2.2
      this.strafeDir *= -1
    }

    let moveX = 0
    let moveZ = 0
    const preferred = this.elite ? 7 : 9
    if (this.stagger <= 0) {
      if (!this.hasLOS || dist > preferred + 3) {
        moveX = toPlayer.x
        moveZ = toPlayer.z
        if (this.hasLOS && dist < preferred + 6) {
          moveX += -toPlayer.z * this.strafeDir * 0.55
          moveZ += toPlayer.x * this.strafeDir * 0.55
        }
      } else if (dist < preferred - 2) {
        moveX = -toPlayer.x
        moveZ = -toPlayer.z
      } else {
        moveX = -toPlayer.z * this.strafeDir
        moveZ = toPlayer.x * this.strafeDir
        moveX *= 0.75
        moveZ *= 0.75
      }
    }

    if (this.unstickTime > 0) {
      this.unstickTime -= dt
      moveX = -toPlayer.z * this.strafeDir
      moveZ = toPlayer.x * this.strafeDir
    }

    const mlen = Math.hypot(moveX, moveZ)
    this.moving = mlen > 0.1
    if (this.moving) {
      moveX /= mlen
      moveZ /= mlen
      const spd = this.speed * (this.hasLOS ? 1 : 1.25) * (this.stagger > 0 ? 0.2 : 1)
      this.group.position.x += moveX * spd * dt
      this.group.position.z += moveZ * spd * dt
      this.resolveCollisions(world.colliders)
      this.group.position.x = THREE.MathUtils.clamp(this.group.position.x, -37, 37)
      this.group.position.z = THREE.MathUtils.clamp(this.group.position.z, -37, 37)
      this.walkPhase += dt * spd * 4.4
    } else {
      this.walkPhase += dt * 1.2
    }

    if (this.moving) {
      this.stuckTimer += dt
      if (this.stuckTimer > 0.9) {
        if (this.group.position.distanceToSquared(this.lastCheckPos) < 0.08) {
          this.unstickTime = 1.1
          this.strafeDir *= -1
        }
        this.lastCheckPos.copy(this.group.position)
        this.stuckTimer = 0
      }
    }

    // walk animation
    const swing = Math.sin(this.walkPhase) * (this.moving ? 0.6 : 0.06)
    this.legL.rotation.x = swing
    this.legR.rotation.x = -swing
    this.armL.rotation.x = -swing * 0.4 - 0.15
    this.armR.rotation.x = swing * 0.15 - 0.2
    this.torso.position.y = 1.02 + Math.abs(Math.sin(this.walkPhase)) * (this.moving ? 0.035 : 0.008)

    // firing
    this.fireCooldown -= dt
    if (this.hasLOS && dist < 34 && this.stagger <= 0 && this.fireCooldown <= 0) {
      this.burst = this.elite ? 4 : 3
      this.fireCooldown = this.elite ? 1.9 + Math.random() * 1.0 : 2.4 + Math.random() * 1.5
      callbacks.onBurstStart?.(this)
    }
    if (this.burst > 0) {
      this.burstTimer = (this.burstTimer ?? 0) - dt
      if (this.burstTimer <= 0) {
        this.burstTimer = 0.11
        this.burst--
        this.flashTime = 0.055
        this.fireCooldown = Math.max(this.fireCooldown, 0.35)
        const origin = this.muzzleWorld(new THREE.Vector3())
        const aim = new THREE.Vector3(player.position.x, player.position.y + (player.crouching ? 0.95 : 1.3), player.position.z)
        const spread = 0.024 + dist * 0.0011
        aim.x += (Math.random() - 0.5) * spread * dist
        aim.y += (Math.random() - 0.5) * spread * dist
        aim.z += (Math.random() - 0.5) * spread * dist
        const dir = aim.sub(origin).normalize()
        callbacks.onShoot?.(this, origin, dir, dist)
      }
    }

    if (this.flashTime > 0) {
      this.flashTime -= dt
      this.muzzleFlash.material.opacity = Math.max(0, this.flashTime / 0.055) * 0.95
      this.muzzleFlash.scale.setScalar(0.4 + Math.random() * 0.3)
    } else {
      this.muzzleFlash.material.opacity = 0
    }

    this.blob.position.set(this.group.position.x, 0.02, this.group.position.z)

    // health bar orientation
    if (this.bar.visible) {
      const ratio = Math.max(0, this.health / this.maxHealth)
      this.barFill.scale.x = ratio
      this.barFill.material.color.setHex(ratio > 0.55 ? 0xff4a3a : ratio > 0.25 ? 0xff8a2a : 0xff2020)
      this.bar.quaternion.copy(this.group.quaternion).invert().multiply(player.camera.quaternion)
    }
  }

  resolveCollisions(colliders) {
    const p = this.group.position
    const r = this.radius
    for (const box of colliders) {
      if (box.max.y < 0.3 || box.min.y > 1.8) continue
      if (p.x > box.min.x - r && p.x < box.max.x + r && p.z > box.min.z - r && p.z < box.max.z + r) {
        const dl = p.x - (box.min.x - r)
        const dr = (box.max.x + r) - p.x
        const df = p.z - (box.min.z - r)
        const db = (box.max.z + r) - p.z
        const m = Math.min(dl, dr, df, db)
        if (m === dl) p.x = box.min.x - r
        else if (m === dr) p.x = box.max.x + r
        else if (m === df) p.z = box.min.z - r
        else p.z = box.max.z + r
      }
    }
  }

  dispose() {
    this.scene.remove(this.group)
    this.group.traverse((o) => {
      if (o.isMesh) o.geometry.dispose()
    })
    this.uniform.dispose()
    this.scene.remove(this.blob)
    this.blob.geometry.dispose()
    this.blob.material.dispose()
  }
}
