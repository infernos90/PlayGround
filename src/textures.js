import * as THREE from 'three'

const cache = new Map()

function canvas(size) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return c
}

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function concrete(seed = 7, tint = [116, 120, 124]) {
  const key = `concrete-${seed}-${tint.join()}`
  if (cache.has(key)) return cache.get(key)
  const size = 512
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const r = rng(seed)
  ctx.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 26000; i++) {
    const v = (r() - 0.5) * 58
    const a = 0.05 + r() * 0.1
    ctx.fillStyle = `rgba(${tint[0] + v},${tint[1] + v},${tint[2] + v},${a})`
    const s = r() * 3 + 0.5
    ctx.fillRect(r() * size, r() * size, s, s)
  }
  for (let i = 0; i < 90; i++) {
    const x = r() * size
    const y = r() * size
    const w = 20 + r() * 120
    const h = 6 + r() * 40
    ctx.fillStyle = `rgba(0,0,0,${0.02 + r() * 0.05})`
    ctx.fillRect(x, y, w, h)
  }
  ctx.strokeStyle = 'rgba(20,22,24,0.5)'
  for (let i = 0; i < 14; i++) {
    ctx.lineWidth = 0.6 + r() * 1.4
    ctx.beginPath()
    let x = r() * size
    let y = r() * size
    ctx.moveTo(x, y)
    for (let j = 0; j < 9; j++) {
      x += (r() - 0.5) * 60
      y += r() * 34
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(255,255,255,${r() * 0.04})`
    ctx.beginPath()
    ctx.arc(r() * size, r() * size, r() * 2.2, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  cache.set(key, tex)
  return tex
}

export function metal(seed = 11, tint = [62, 68, 74], panel = 128) {
  const key = `metal-${seed}-${tint.join()}-${panel}`
  if (cache.has(key)) return cache.get(key)
  const size = 512
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const r = rng(seed)
  ctx.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 9000; i++) {
    const v = (r() - 0.5) * 40
    ctx.fillStyle = `rgba(${tint[0] + v},${tint[1] + v},${tint[2] + v},${0.06 + r() * 0.08})`
    ctx.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2)
  }
  ctx.strokeStyle = 'rgba(12,14,16,0.75)'
  ctx.lineWidth = 2
  for (let x = 0; x <= size; x += panel) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke()
  }
  for (let y = 0; y <= size; y += panel) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke()
  }
  for (let x = 0; x <= size; x += panel) {
    for (let y = 0; y <= size; y += panel) {
      for (const [ox, oy] of [[8, 8], [panel - 8, 8], [8, panel - 8], [panel - 8, panel - 8]]) {
        ctx.fillStyle = 'rgba(150,158,166,0.5)'
        ctx.beginPath(); ctx.arc(x + ox, y + oy, 2.2, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.beginPath(); ctx.arc(x + ox + 0.7, y + oy + 0.9, 2.2, 0, Math.PI * 2); ctx.fill()
      }
    }
  }
  for (let i = 0; i < 26; i++) {
    const x = r() * size, y = r() * size
    const g = ctx.createLinearGradient(x, y, x + 30, y + 90)
    g.addColorStop(0, 'rgba(84,44,18,0.18)')
    g.addColorStop(1, 'rgba(84,44,18,0)')
    ctx.fillStyle = g
    ctx.fillRect(x, y, 30, 90)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  cache.set(key, tex)
  return tex
}

export function hazard() {
  if (cache.has('hazard')) return cache.get('hazard')
  const size = 256
  const c = canvas(size)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = '#e8a227'
  ctx.lineWidth = 30
  for (let i = -size; i < size * 2; i += 64) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + size, size)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  for (let i = 0; i < 120; i++) ctx.fillRect(Math.random() * size, Math.random() * size, 3, 2)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  cache.set('hazard', tex)
  return tex
}

export function grating() {
  if (cache.has('grating')) return cache.get('grating')
  const size = 256
  const c = canvas(size)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#0b0d10'
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = '#5a6268'
  ctx.lineWidth = 5
  for (let i = 0; i <= size; i += 22) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke()
  }
  ctx.strokeStyle = '#2c3136'
  ctx.lineWidth = 3
  for (let i = 0; i <= size; i += 44) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  cache.set('grating', tex)
  return tex
}

export function stripeEmissive(color = '#9fd8ff', vertical = false) {
  const key = `stripe-${color}-${vertical}`
  if (cache.has(key)) return cache.get(key)
  const w = vertical ? 32 : 256
  const h = vertical ? 256 : 32
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = color
  if (vertical) {
    ctx.fillRect(w * 0.3, 0, w * 0.4, h)
    ctx.fillStyle = '#fff'
    ctx.globalAlpha = 0.55
    ctx.fillRect(w * 0.44, 0, w * 0.06, h)
  } else {
    ctx.fillRect(0, h * 0.3, w, h * 0.4)
    ctx.fillStyle = '#fff'
    ctx.globalAlpha = 0.5
    ctx.fillRect(0, h * 0.46, w, h * 0.05)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  cache.set(key, tex)
  return tex
}

export function windowGrid(color = '#ffd79a', cols = 4, rows = 6) {
  const key = `window-${color}-${cols}-${rows}`
  if (cache.has(key)) return cache.get(key)
  const w = 128, h = 192
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#05070a'
  ctx.fillRect(0, 0, w, h)
  const pad = 8
  const cw = (w - pad * (cols + 1)) / cols
  const ch = (h - pad * (rows + 1)) / rows
  const r = rng(cols * 31 + rows)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = r() > 0.55
      if (lit) {
        const a = 0.35 + r() * 0.65
        ctx.fillStyle = color
        ctx.globalAlpha = a
        ctx.fillRect(pad + x * (cw + pad), pad + y * (ch + pad), cw, ch)
        ctx.globalAlpha = 1
      } else {
        ctx.fillStyle = '#0a1017'
        ctx.fillRect(pad + x * (cw + pad), pad + y * (ch + pad), cw, ch)
      }
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  cache.set(key, tex)
  return tex
}

export function softCircle(hard = 0.2) {
  const key = `soft-${hard}`
  if (cache.has(key)) return cache.get(key)
  const size = 128
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(hard, 'rgba(255,255,255,0.85)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  cache.set(key, tex)
  return tex
}

export function smokeSprite() {
  if (cache.has('smoke')) return cache.get('smoke')
  const size = 128
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(210,214,220,0.5)')
  g.addColorStop(0.45, 'rgba(150,156,164,0.28)')
  g.addColorStop(1, 'rgba(120,126,134,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  cache.set('smoke', tex)
  return tex
}

export function bulletHole() {
  if (cache.has('hole')) return cache.get('hole')
  const size = 64
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(0,0,0,0.95)')
  g.addColorStop(0.28, 'rgba(6,6,6,0.9)')
  g.addColorStop(0.5, 'rgba(30,30,30,0.5)')
  g.addColorStop(1, 'rgba(40,40,40,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  cache.set('hole', tex)
  return tex
}

export function grassPatch(seed = 3) {
  const key = `grass-${seed}`
  if (cache.has(key)) return cache.get(key)
  const size = 256
  const c = canvas(size)
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, size, size)
  const r = rng(seed)
  for (let i = 0; i < 2600; i++) {
    const x = r() * size
    const y = r() * size
    const h = 3 + r() * 9
    ctx.strokeStyle = `rgba(${50 + r() * 30},${70 + r() * 45},${38 + r() * 22},${0.3 + r() * 0.5})`
    ctx.lineWidth = 0.7
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + (r() - 0.5) * 4, y - h)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  cache.set(key, tex)
  return tex
}
