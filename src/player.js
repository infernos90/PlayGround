import * as THREE from 'three'
import { audio } from './audio.js'

const _forward = new THREE.Vector3()
const _right = new THREE.Vector3()
const _origin = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

export class Player {
  constructor(camera, view, opts = {}) {
    this.camera = camera
    this.view = view
    this.position = new THREE.Vector3(0, 0, 18)
    this.velocity = new THREE.Vector3()
    this.yaw = Math.PI
    this.pitch = 0
    this.height = 1.72
    this.crouchHeight = 1.12
    this.radius = 0.34
    this.eye = 1.62
    this.onGround = true
    this.crouching = false
    this.sprinting = false
    this.walking = false
    this.stamina = 100
    this.maxStamina = 100
    this.health = 100
    this.maxHealth = 100
    this.armor = 50
    this.maxArmor = 50
    this.dead = false
    this.lastDamage = -100
    this.walkPhase = 0
    this.stepPhase = 0
    this.bob = 0
    this.ads = false
    this.adsHeld = false
    this.adsAmount = 0
    this.flashlight = false
    this.recoilPitch = 0
    this.recoilYaw = 0
    this.weaponKick = 0
    this.weaponRoll = 0
    this.mag = 30
    this.magSize = 30
    this.reserve = 210
    this.reloading = false
    this.reloadTime = 0
    this.reloadDuration = 2.15
    this.fireCooldown = 0
    this.fireHeld = false
    this.triggerDown = false
    this.shots = 0
    this.hits = 0
    this.grenades = 3
    this.spread = 0.004
    this.sensitivity = 0.0022
    this.mouseDX = 0
    this.mouseDY = 0
    this.shake = 0
    this.flashTime = 0
    this.callbacks = opts
    this.colliders = opts.colliders || []
    this.spawnPoint = opts.spawn || new THREE.Vector3(0, 0, 18)
    this.spawnYaw = opts.spawnYaw ?? Math.PI
    this.weapon = opts.weapon
    this.weaponBase = new THREE.Vector3(0.28, -0.26, -0.62)
    this.weaponADS = new THREE.Vector3(0, -0.132, -0.4)
    this.weaponOffset = new THREE.Vector3(0, 0, 0)
    this.swayX = 0
    this.swayY = 0
    this.temp = new THREE.Vector3()

    if (this.weapon) {
      this.weapon.group.position.copy(this.weaponBase)
      this.view.scene.add(this.weapon.group)
    }

    this.flashLight = new THREE.SpotLight(0xfff2d8, 0, 42, Math.PI / 7, 0.42, 1.4)
    this.flashLight.position.set(0.1, -0.05, 0)
    this.flashTarget = new THREE.Object3D()
    this.flashTarget.position.set(0.02, -0.02, -1)
    this.camera.add(this.flashLight)
    this.camera.add(this.flashTarget)
    this.flashLight.target = this.flashTarget

    this.applySpawn()
  }

  applySpawn() {
    this.position.copy(this.spawnPoint)
    this.position.y = 0
    this.yaw = this.spawnYaw
    this.pitch = 0
    this.velocity.set(0, 0, 0)
    this.health = this.maxHealth
    this.armor = this.maxArmor
    this.stamina = this.maxStamina
    this.dead = false
    this.mag = this.magSize
    this.reserve = 210
    this.reloading = false
    this.reloadTime = 0
    this.triggerDown = false
    this.fireCooldown = 0
    this.shots = 0
    this.hits = 0
    this.grenades = 3
    this.recoilPitch = 0
    this.recoilYaw = 0
    this.ads = false
    this.adsHeld = false
    this.adsAmount = 0
    this.lastDamage = -100
    this.syncCamera(0)
  }

  get eyeHeight() { return this.crouching ? this.crouchHeight : this.eye }

  onKey(code, down) {
    if (code === 'KeyR' && down && !this.dead) this.startReload()
    if (code === 'KeyF' && down && !this.dead) {
      this.flashlight = !this.flashlight
    }
    if (code === 'KeyG' && down && !this.dead) {
      this.callbacks.onGrenade?.()
    }
    if (code === 'Space' && down && this.onGround && !this.dead && !this.crouching) {
      this.velocity.y = 7.2
      this.onGround = false
      audio.jump()
    }
  }

  onMouseDown(button) {
    if (this.dead) return
    if (button === 0) this.triggerDown = true
    if (button === 2) { this.adsHeld = true; this.ads = true }
  }

  onMouseUp(button) {
    if (button === 0) this.triggerDown = false
    if (button === 2) { this.adsHeld = false; this.ads = false }
  }

  onMouseMove(dx, dy) {
    this.mouseDX += dx
    this.mouseDY += dy
  }

  startReload() {
    if (this.reloading || this.mag >= this.magSize || this.reserve <= 0) return
    this.reloading = true
    this.reloadTime = 0
    audio.reload()
  }

  addRecoil(amount) {
    this.recoilPitch += amount
    this.recoilYaw += (Math.random() - 0.5) * amount * 0.7
    this.weaponKick += amount * 2.4
    this.weaponRoll += (Math.random() - 0.5) * amount * 1.1
    this.shake = Math.min(0.5, this.shake + amount * 0.85)
  }

  takeDamage(amount) {
    if (this.dead) return
    let dmg = amount
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, dmg * 0.55)
      this.armor -= absorbed
      dmg -= absorbed
    }
    this.health -= dmg
    this.lastDamage = performance.now() / 1000
    this.shake = Math.min(1.2, this.shake + 0.5)
    audio.damages()
    this.callbacks.onDamage?.(dmg)
    if (this.health <= 0) {
      this.health = 0
      this.dead = true
      this.triggerDown = false
      this.ads = false
      this.adsHeld = false
      this.callbacks.onDeath?.()
    }
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount)
  }

  syncCamera(dt) {
    const eye = this.eyeHeight
    this.camera.position.set(this.position.x, this.position.y + eye + this.bob, this.position.z)
    this.camera.rotation.order = 'YXZ'
    let sx = 0, sy = 0
    if (this.shake > 0.001) {
      sx = (Math.random() - 0.5) * this.shake * 0.045
      sy = (Math.random() - 0.5) * this.shake * 0.045
    }
    this.camera.rotation.y = this.yaw + this.recoilYaw + sy
    this.camera.rotation.x = this.pitch + this.recoilPitch + sx
    this.camera.rotation.z = this.shake * (Math.random() - 0.5) * 0.03
    this.shake = Math.max(0, this.shake - dt * 4.2)
    const targetFov = 73 - this.adsAmount * 20
    if (Math.abs(this.camera.fov - targetFov) > 0.02) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 18)
      this.camera.updateProjectionMatrix()
      this.view.camera.fov = this.camera.fov
      this.view.camera.updateProjectionMatrix()
    }
    this.camera.updateMatrixWorld(true)
    this.flashLight.intensity = this.flashlight ? 90 : 0
  }

  updateWeapon(dt, t) {
    if (!this.weapon) return
    const w = this.weapon

    // smooth ADS
    const target = this.adsHeld && !this.reloading && !this.sprinting ? 1 : 0
    this.adsAmount += (target - this.adsAmount) * Math.min(1, dt * 12)
    const adsK = this.adsAmount

    // look sway
    this.swayX += (-this.mouseDX * 0.0011 - this.swayX) * Math.min(1, dt * 9)
    this.swayY += (this.mouseDY * 0.0011 - this.swayY) * Math.min(1, dt * 9)
    this.mouseDX = 0
    this.mouseDY = 0

    // bob
    const bobAmt = this.walking ? (this.sprinting ? 0.026 : 0.017) : 0.003
    const phase = this.walkPhase
    const bobX = Math.sin(phase) * bobAmt * (1 - adsK * 0.8)
    const bobY = Math.abs(Math.cos(phase)) * bobAmt * (1 - adsK * 0.8)

    // recoil recovery
    this.recoilPitch *= Math.pow(0.001, dt)
    this.recoilYaw *= Math.pow(0.001, dt)
    this.weaponKick *= Math.pow(0.0008, dt)
    this.weaponRoll *= Math.pow(0.002, dt)

    const baseX = THREE.MathUtils.lerp(this.weaponBase.x, this.weaponADS.x, adsK)
    const baseY = THREE.MathUtils.lerp(this.weaponBase.y, this.weaponADS.y, adsK)
    const baseZ = THREE.MathUtils.lerp(this.weaponBase.z, this.weaponADS.z, adsK)

    let reloadDip = 0
    let reloadRoll = 0
    let reloadPitch = 0
    if (this.reloading) {
      const k = Math.min(1, this.reloadTime / this.reloadDuration)
      const dip = Math.sin(k * Math.PI)
      reloadDip = dip * 0.13
      reloadRoll = dip * 0.42
      reloadPitch = dip * 0.34
      const magK = k > 0.22 && k < 0.55 ? Math.sin(((k - 0.22) / 0.33) * Math.PI) : 0
      w.magazine.position.y = -0.075 - magK * 0.18
      w.magazine.rotation.x = magK * 0.4
    } else {
      w.magazine.position.y += (-0.075 - w.magazine.position.y) * Math.min(1, dt * 12)
      w.magazine.rotation.x += (0 - w.magazine.rotation.x) * Math.min(1, dt * 12)
    }

    const sprintK = this.sprinting && !this.ads ? 1 : 0
    this.sprintOffset = THREE.MathUtils.lerp(this.sprintOffset || 0, sprintK, Math.min(1, dt * 8))
    const sprint = this.sprintOffset

    w.group.position.set(
      baseX + bobX + this.swayX * (1 - adsK * 0.6) + sprint * 0.03,
      baseY + bobY + this.swayY * (1 - adsK * 0.6) - reloadDip - sprint * 0.07,
      baseZ + this.weaponKick * 0.09 + adsK * 0.01
    )
    w.group.rotation.set(
      0.015 + this.weaponKick * 0.8 + reloadPitch + sprint * -0.25,
      0.16 * (1 - adsK) + this.swayX * 0.8 + sprint * 0.5,
      0.01 + this.weaponRoll + reloadRoll + sprint * 0.35
    )
    if (w.stock) w.stock.visible = adsK < 0.55
    w.reticle.material.opacity = 0.16 + Math.max(0, adsK - 0.18) * 1.0
    w.update(dt)

    if (this.reloading) {
      this.reloadTime += dt
      if (this.reloadTime >= this.reloadDuration) {
        const need = this.magSize - this.mag
        const take = Math.min(need, this.reserve)
        this.mag += take
        this.reserve -= take
        this.reloading = false
        this.reloadTime = 0
        audio.reload()
      }
    }
  }

  tryShoot() {
    if (this.dead || this.reloading || !this.triggerDown) return
    if (this.fireCooldown > 0) return
    if (this.sprinting) return
    if (this.mag <= 0) {
      if (this.fireCooldown <= 0) {
        audio.empty()
        this.fireCooldown = 0.25
      }
      return
    }
    this.mag--
    this.shots++
    this.fireCooldown = 0.088
    this.weapon.fireFlash()
    audio.shot()
    if (this.weapon.shellPort) {
      this.weapon.shellPort.getWorldPosition(this.temp)
      this.temp.applyMatrix4(this.camera.matrixWorld)
      const dir = new THREE.Vector3(0.5, 0.25, 0.1).applyQuaternion(this.camera.quaternion)
      this.callbacks.onShell?.(this.temp.clone(), dir)
    }

    const spread = this.ads ? 0.0016 : 0.0075 + Math.min(0.02, this.shake * 0.02)
    _origin.copy(this.camera.position)
    this.camera.getWorldDirection(_dir)
    _origin.addScaledVector(_dir, 0.55)
    _origin.x += (Math.random() - 0.5) * 0.03
    _origin.y -= 0.06
    _dir.x += (Math.random() - 0.5) * spread * 2
    _dir.y += (Math.random() - 0.5) * spread * 2
    _dir.z += (Math.random() - 0.5) * spread * 2
    _dir.normalize()

    this.addRecoil(this.ads ? 0.006 : 0.0095)
    this.callbacks.onShoot?.(_origin.clone(), _dir.clone(), spread, this)
    if (this.mag === 0) this.startReload()
  }

  update(dt, t, input) {
    if (this.dead) {
      this.syncCamera(dt)
      this.updateWeapon(dt, t)
      return
    }

    // look
    const sens = this.sensitivity * (this.ads ? 0.62 : 1)
    this.yaw -= this.mouseDX * sens
    this.pitch -= this.mouseDY * sens
    this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2 + 0.03, Math.PI / 2 - 0.03)

    const forward = _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw))
    const right = _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw))

    const keys = input.keys
    let f = 0
    let s = 0
    if (keys.has('KeyW')) f += 1
    if (keys.has('KeyS')) f -= 1
    if (keys.has('KeyD')) s += 1
    if (keys.has('KeyA')) s -= 1

    const wantCrouch = keys.has('ControlLeft') || keys.has('KeyC')
    this.crouching = wantCrouch
    const canSprint = keys.has('ShiftLeft') && f > 0 && !this.ads && !this.crouching && this.stamina > 5
    this.sprinting = canSprint
    this.ads = this.adsHeld && !this.reloading && !this.sprinting
    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - dt * 22)
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + dt * 16)
    }

    const baseSpeed = this.crouching ? 2.1 : this.sprinting ? 7.6 : 4.35
    const targetVX = (forward.x * f + right.x * s)
    const targetVZ = (forward.z * f + right.z * s)
    const len = Math.hypot(targetVX, targetVZ)
    this.walking = len > 0.01

    const accel = this.onGround ? 42 : 9
    const wishX = len > 0 ? (targetVX / len) * baseSpeed : 0
    const wishZ = len > 0 ? (targetVZ / len) * baseSpeed : 0
    this.velocity.x += (wishX - this.velocity.x) * Math.min(1, accel * dt)
    this.velocity.z += (wishZ - this.velocity.z) * Math.min(1, accel * dt)

    // gravity
    this.velocity.y -= 24 * dt
    if (this.position.y <= 0 && this.velocity.y < 0) {
      if (!this.onGround && this.velocity.y < -6) audio.land()
      this.position.y = 0
      this.velocity.y = 0
      this.onGround = true
    } else if (this.position.y > 0) {
      this.onGround = false
    }

    // horizontal collision
    const oldX = this.position.x
    this.position.x += this.velocity.x * dt
    this.resolveAxis('x', oldX)
    const oldZ = this.position.z
    this.position.z += this.velocity.z * dt
    this.resolveAxis('z', oldZ)

    this.position.y += this.velocity.y * dt
    if (this.position.y < 0) this.position.y = 0

    this.position.x = THREE.MathUtils.clamp(this.position.x, -40.5, 40.5)
    this.position.z = THREE.MathUtils.clamp(this.position.z, -40.5, 40.5)

    // bob + footsteps
    const speed2d = Math.hypot(this.velocity.x, this.velocity.z)
    if (this.onGround && speed2d > 0.4) {
      const prev = this.stepPhase
      this.walkPhase += dt * speed2d * (this.sprinting ? 1.25 : 1.55)
      this.stepPhase = Math.floor(this.walkPhase / Math.PI)
      if (this.stepPhase !== prev) audio.footstep()
      this.bob = Math.sin(this.walkPhase * 2) * (this.sprinting ? 0.045 : 0.028)
    } else {
      this.bob *= Math.pow(0.02, dt)
      this.walkPhase += dt * 0.8
    }

    // health regen
    const now = performance.now() / 1000
    if (!this.dead && now - this.lastDamage > 6 && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + dt * 14)
    }
    if (!this.dead && now - this.lastDamage > 8 && this.armor < this.maxArmor) {
      this.armor = Math.min(this.maxArmor, this.armor + dt * 5)
    }

    // weapon
    this.fireCooldown = Math.max(0, this.fireCooldown - dt)
    this.updateWeapon(dt, t)
    this.syncCamera(dt)
    this.tryShoot()
  }

  resolveAxis(axis, oldValue) {
    const p = this.position
    const r = this.radius
    const h = this.crouching ? this.crouchHeight : this.height
    for (const box of this.colliders) {
      if (box.max.y < 0.35) continue
      if (box.min.y > p.y + h) continue
      if (p.x + r <= box.min.x || p.x - r >= box.max.x || p.z + r <= box.min.z || p.z - r >= box.max.z) continue
      if (axis === 'x') {
        if (oldValue <= box.min.x - r) p.x = box.min.x - r
        else if (oldValue >= box.max.x + r) p.x = box.max.x + r
        else p.x = oldValue
        this.velocity.x = 0
      } else {
        if (oldValue <= box.min.z - r) p.z = box.min.z - r
        else if (oldValue >= box.max.z + r) p.z = box.max.z + r
        else p.z = oldValue
        this.velocity.z = 0
      }
    }
  }
}
