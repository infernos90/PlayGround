import * as THREE from 'three'
import { softCircle, smokeSprite, bulletHole } from './textures.js'

const _v = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _up = new THREE.Vector3(0, 1, 0)

class Pool {
  constructor(scene, count, factory) {
    this.items = []
    this.index = 0
    for (let i = 0; i < count; i++) {
      const item = factory()
      item.obj.visible = false
      scene.add(item.obj)
      item.obj.renderOrder = 5
      this.items.push(item)
    }
  }
  next() {
    const item = this.items[this.index]
    this.index = (this.index + 1) % this.items.length
    return item
  }
}

export class Effects {
  constructor(scene) {
    this.scene = scene

    const sparkTex = softCircle(0.05)
    this.sparks = new Pool(scene, 140, () => {
      const mat = new THREE.SpriteMaterial({
        map: sparkTex, color: 0xffb060, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
      })
      return { obj: new THREE.Sprite(mat), vel: new THREE.Vector3(), life: 0, maxLife: 1, grav: 0, size: 0.05 }
    })

    this.blood = new Pool(scene, 90, () => {
      const mat = new THREE.SpriteMaterial({
        map: sparkTex, color: 0x8b0f16, transparent: true, opacity: 0,
        blending: THREE.NormalBlending, depthWrite: false
      })
      return { obj: new THREE.Sprite(mat), vel: new THREE.Vector3(), life: 0, maxLife: 1, grav: 0, size: 0.07 }
    })

    const smokeTex = smokeSprite()
    this.smoke = new Pool(scene, 80, () => {
      const mat = new THREE.SpriteMaterial({
        map: smokeTex, color: 0x9aa2aa, transparent: true, opacity: 0,
        depthWrite: false, toneMapped: false
      })
      return { obj: new THREE.Sprite(mat), vel: new THREE.Vector3(), life: 0, maxLife: 1, grav: 0, size: 0.4, grow: 1.2 }
    })

    this.debris = new Pool(scene, 70, () => {
      const mat = new THREE.MeshStandardMaterial({ color: 0x33363a, roughness: 0.85, metalness: 0.3 })
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), mat)
      return { obj: mesh, vel: new THREE.Vector3(), life: 0, maxLife: 1, grav: 16, size: 1, spin: new THREE.Vector3() }
    })

    this.tracers = new Pool(scene, 24, () => {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffd9a0, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
      })
      const g = new THREE.CylinderGeometry(0.012, 0.012, 1, 5, 1, true)
      g.translate(0, 0.5, 0)
      const mesh = new THREE.Mesh(g, mat)
      mesh.scale.setScalar(1)
      return { obj: mesh, life: 0, maxLife: 0.08 }
    })

    this.holes = new Pool(scene, 70, () => {
      const mat = new THREE.MeshBasicMaterial({
        map: bulletHole(), transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true,
        polygonOffsetFactor: -2, polygonOffsetUnits: -2
      })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), mat)
      return { obj: mesh, life: 0, maxLife: 18 }
    })

    this.shells = new Pool(scene, 22, () => {
      const mat = new THREE.MeshStandardMaterial({ color: 0xb08a3a, roughness: 0.35, metalness: 0.9 })
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.045, 7), mat)
      return { obj: mesh, vel: new THREE.Vector3(), life: 0, maxLife: 2.4, grav: 12, spin: new THREE.Vector3(), bounced: false }
    })
  }

  sparkBurst(point, normal, count = 9, color = 0xffb060) {
    for (let i = 0; i < count; i++) {
      const p = this.sparks.next()
      p.obj.visible = true
      p.obj.position.copy(point)
      p.obj.material.color.setHex(color)
      p.obj.material.opacity = 0.9
      const s = 0.03 + Math.random() * 0.055
      p.size = s
      p.obj.scale.setScalar(s)
      p.vel.copy(normal).multiplyScalar(1 + Math.random() * 3)
      p.vel.x += (Math.random() - 0.5) * 3.4
      p.vel.y += (Math.random() - 0.2) * 3.4
      p.vel.z += (Math.random() - 0.5) * 3.4
      p.life = p.maxLife = 0.18 + Math.random() * 0.32
      p.grav = 9
    }
  }

  bloodBurst(point, dir, count = 8) {
    for (let i = 0; i < count; i++) {
      const p = this.blood.next()
      p.obj.visible = true
      p.obj.position.copy(point)
      p.obj.material.opacity = 0.85
      const s = 0.025 + Math.random() * 0.05
      p.size = s
      p.obj.scale.setScalar(s)
      p.vel.copy(dir).multiplyScalar(1.5 + Math.random() * 3)
      p.vel.x += (Math.random() - 0.5) * 2.2
      p.vel.y += Math.random() * 2.2
      p.vel.z += (Math.random() - 0.5) * 2.2
      p.life = p.maxLife = 0.16 + Math.random() * 0.22
      p.grav = 7
    }
  }

  smokePuff(point, dir, count = 2, scale = 0.5, color = 0x9aa2aa) {
    for (let i = 0; i < count; i++) {
      const p = this.smoke.next()
      p.obj.visible = true
      p.obj.position.copy(point)
      p.obj.material.color.setHex(color)
      p.obj.material.opacity = 0.34
      p.size = scale * (0.7 + Math.random() * 0.7)
      p.grow = 0.9 + Math.random() * 1.4
      p.obj.scale.setScalar(p.size)
      p.vel.copy(dir).multiplyScalar(0.35 + Math.random() * 0.7)
      p.vel.x += (Math.random() - 0.5) * 0.6
      p.vel.y += 0.25 + Math.random() * 0.4
      p.vel.z += (Math.random() - 0.5) * 0.6
      p.life = p.maxLife = 0.9 + Math.random() * 1.1
      p.grav = -0.2
    }
  }

  debrisBurst(point, normal, count = 6) {
    for (let i = 0; i < count; i++) {
      const d = this.debris.next()
      d.obj.visible = true
      d.obj.position.copy(point)
      d.obj.scale.setScalar(0.5 + Math.random())
      d.obj.material.color.setHSL(0.08, 0.05, 0.18 + Math.random() * 0.2)
      d.vel.copy(normal).multiplyScalar(1.2 + Math.random() * 2)
      d.vel.x += (Math.random() - 0.5) * 3
      d.vel.y += Math.random() * 2.5
      d.vel.z += (Math.random() - 0.5) * 3
      d.spin.set(Math.random() * 8, Math.random() * 8, Math.random() * 8)
      d.life = d.maxLife = 0.5 + Math.random() * 0.7
      d.grav = 14
    }
  }

  tracer(from, to, color = 0xffd9a0) {
    const t = this.tracers.next()
    const dist = from.distanceTo(to)
    if (dist < 0.1) return
    t.obj.visible = true
    t.obj.position.copy(from)
    t.obj.scale.set(1, dist, 1)
    const dir = _v.copy(to).sub(from).normalize()
    _q.setFromUnitVectors(_up, dir)
    t.obj.quaternion.copy(_q)
    t.obj.material.color.setHex(color)
    t.obj.material.opacity = 0.85
    t.life = t.maxLife = 0.05 + Math.random() * 0.03
  }

  decal(point, normal) {
    const h = this.holes.next()
    h.obj.visible = true
    h.obj.position.copy(point).addScaledVector(normal, 0.012)
    h.obj.lookAt(_v.copy(point).add(normal))
    h.obj.rotation.z = Math.random() * Math.PI * 2
    const s = 0.7 + Math.random() * 0.6
    h.obj.scale.setScalar(s)
    h.obj.material.opacity = 0.95
    h.life = h.maxLife = 18
  }

  shellEject(position, dir) {
    const s = this.shells.next()
    s.obj.visible = true
    s.obj.position.copy(position)
    s.vel.copy(dir).multiplyScalar(1.6 + Math.random())
    s.vel.x += (Math.random() - 0.5) * 0.8
    s.vel.y += 1.4 + Math.random() * 0.6
    s.vel.z += (Math.random() - 0.5) * 0.8
    s.spin.set(Math.random() * 20, Math.random() * 20, Math.random() * 20)
    s.obj.rotation.set(Math.random(), Math.random(), Math.random())
    s.life = s.maxLife = 2.4
    s.bounced = false
  }

  explosion(point) {
    for (let i = 0; i < 42; i++) {
      const p = this.sparks.next()
      p.obj.visible = true
      p.obj.position.copy(point)
      p.obj.material.color.setHex(i % 3 === 0 ? 0xfff2c0 : 0xff9a3a)
      p.obj.material.opacity = 1
      const s = 0.08 + Math.random() * 0.22
      p.size = s
      p.obj.scale.setScalar(s)
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.05, Math.random() - 0.5).normalize()
      p.vel.copy(dir).multiplyScalar(5 + Math.random() * 12)
      p.life = p.maxLife = 0.35 + Math.random() * 0.7
      p.grav = 8
    }
    for (let i = 0; i < 16; i++) {
      const p = this.smoke.next()
      p.obj.visible = true
      p.obj.position.copy(point).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, Math.random() * 1.2, (Math.random() - 0.5) * 1.2))
      p.obj.material.color.setHex(0x4a4e54)
      p.obj.material.opacity = 0.5
      p.size = 1.2 + Math.random() * 1.8
      p.grow = 1.8 + Math.random() * 2.6
      p.obj.scale.setScalar(p.size)
      p.vel.set((Math.random() - 0.5) * 2.5, 0.6 + Math.random() * 2, (Math.random() - 0.5) * 2.5)
      p.life = p.maxLife = 1.4 + Math.random() * 1.8
      p.grav = -0.15
    }
    for (let i = 0; i < 10; i++) {
      const d = this.debris.next()
      d.obj.visible = true
      d.obj.position.copy(point)
      d.obj.scale.setScalar(0.8 + Math.random() * 1.8)
      d.vel.set((Math.random() - 0.5) * 13, 2 + Math.random() * 9, (Math.random() - 0.5) * 13)
      d.spin.set(Math.random() * 18, Math.random() * 18, Math.random() * 18)
      d.life = d.maxLife = 0.9 + Math.random() * 1.1
      d.grav = 16
    }
  }

  impact(point, normal, material = 'world') {
    this.sparkBurst(point, normal, material === 'flesh' ? 5 : 9, material === 'flesh' ? 0xbb2222 : 0xffb060)
    if (material === 'flesh') {
      this.bloodBurst(point, normal, 9)
    } else {
      this.smokePuff(point, normal, 2, 0.35)
      this.debrisBurst(point, normal, 4)
      this.decal(point, normal)
      this.sparkBurst(point, normal, 4, 0xffffff)
    }
  }

  update(dt) {
    for (const p of this.sparks.items) {
      if (p.life <= 0) continue
      p.life -= dt
      if (p.life <= 0) { p.obj.visible = false; continue }
      p.vel.y -= p.grav * dt
      p.obj.position.addScaledVector(p.vel, dt)
      const k = p.life / p.maxLife
      p.obj.material.opacity = k
      p.obj.scale.setScalar(p.size * (0.5 + k * 0.8))
    }
    for (const p of this.blood.items) {
      if (p.life <= 0) continue
      p.life -= dt
      if (p.life <= 0) { p.obj.visible = false; continue }
      p.vel.y -= p.grav * dt
      p.obj.position.addScaledVector(p.vel, dt)
      const k = p.life / p.maxLife
      p.obj.material.opacity = k * 0.9
      p.obj.scale.setScalar(p.size * (1 + (1 - k) * 0.6))
    }
    for (const p of this.smoke.items) {
      if (p.life <= 0) continue
      p.life -= dt
      if (p.life <= 0) { p.obj.visible = false; continue }
      p.vel.y += 0.2 * dt
      p.obj.position.addScaledVector(p.vel, dt)
      const k = p.life / p.maxLife
      p.size += p.grow * dt
      p.obj.scale.setScalar(p.size)
      p.obj.material.opacity = Math.min(0.35, k * 0.4)
    }
    for (const d of this.debris.items) {
      if (d.life <= 0) continue
      d.life -= dt
      if (d.life <= 0) { d.obj.visible = false; continue }
      d.vel.y -= d.grav * dt
      d.obj.position.addScaledVector(d.vel, dt)
      d.obj.rotation.x += d.spin.x * dt
      d.obj.rotation.y += d.spin.y * dt
      d.obj.rotation.z += d.spin.z * dt
      if (d.obj.position.y < 0.03) {
        d.obj.position.y = 0.03
        d.vel.y *= -0.35
        d.vel.x *= 0.7
        d.vel.z *= 0.7
      }
      d.obj.material.opacity = Math.min(1, d.life * 2)
      d.obj.material.transparent = d.life < 0.5
    }
    for (const t of this.tracers.items) {
      if (t.life <= 0) continue
      t.life -= dt
      if (t.life <= 0) { t.obj.visible = false; continue }
      t.obj.material.opacity = Math.max(0, t.life / t.maxLife) * 0.85
    }
    for (const h of this.holes.items) {
      if (h.life <= 0) continue
      h.life -= dt
      if (h.life <= 0) { h.obj.visible = false; continue }
      if (h.life < 2) h.obj.material.opacity = h.life / 2 * 0.95
    }
    for (const s of this.shells.items) {
      if (s.life <= 0) continue
      s.life -= dt
      if (s.life <= 0) { s.obj.visible = false; continue }
      s.vel.y -= s.grav * dt
      s.obj.position.addScaledVector(s.vel, dt)
      s.obj.rotation.x += s.spin.x * dt
      s.obj.rotation.z += s.spin.z * dt
      if (s.obj.position.y < 0.02) {
        s.obj.position.y = 0.02
        s.vel.y *= -0.35
        s.vel.x *= 0.65
        s.vel.z *= 0.65
        s.spin.multiplyScalar(0.6)
        if (!s.bounced) { s.bounced = true }
      }
      if (s.life < 0.6) s.obj.material.opacity = s.life / 0.6
    }
  }
}
