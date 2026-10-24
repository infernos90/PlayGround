export class AudioEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.muted = false
    this.ambienceStarted = false
    this._nextAmbient = 0
  }

  init() {
    if (this.ctx) return
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    this.ctx = new Ctx()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.55
    const comp = this.ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.knee.value = 18
    comp.ratio.value = 7
    comp.attack.value = 0.002
    comp.release.value = 0.22
    this.master.connect(comp).connect(this.ctx.destination)

    const len = this.ctx.sampleRate * 2
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = this.noiseBuffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1

    this.startAmbience()
  }

  resume() {
    this.init()
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume()
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend()
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0 }

  env(gain, peak, attack, decay) {
    const t = this.now
    gain.gain.cancelScheduledValues(t)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  }

  noiseBurst({ peak = 0.5, attack = 0.002, decay = 0.12, filter = 1200, type = 'lowpass', q = 0.8, pan = 0, dest = null }) {
    if (!this.ctx) return
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.playbackRate.value = 0.85 + Math.random() * 0.3
    const f = this.ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = filter
    f.Q.value = q
    const g = this.ctx.createGain()
    this.env(g, peak, attack, decay)
    const p = this.ctx.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, pan))
    src.connect(f).connect(g).connect(p).connect(dest || this.master)
    src.start()
    src.stop(this.now + attack + decay + 0.05)
  }

  tone({ freq = 220, endFreq = null, peak = 0.2, attack = 0.002, decay = 0.15, type = 'sine', pan = 0, dest = null }) {
    if (!this.ctx) return
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, this.now)
    if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), this.now + attack + decay)
    const g = this.ctx.createGain()
    this.env(g, peak, attack, decay)
    const p = this.ctx.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, pan))
    o.connect(g).connect(p).connect(dest || this.master)
    o.start()
    o.stop(this.now + attack + decay + 0.05)
  }

  shot() {
    this.init()
    if (!this.ctx) return
    this.noiseBurst({ peak: 0.95, attack: 0.001, decay: 0.09, filter: 1700, type: 'lowpass' })
    this.noiseBurst({ peak: 0.4, attack: 0.001, decay: 0.035, filter: 5600, type: 'highpass' })
    this.tone({ freq: 150, endFreq: 42, peak: 0.7, attack: 0.001, decay: 0.16, type: 'triangle' })
    this.tone({ freq: 74, endFreq: 30, peak: 0.32, attack: 0.004, decay: 0.24, type: 'sine' })
  }

  enemyShot(distance = 10, pan = 0) {
    if (!this.ctx) return
    const att = Math.min(0.15, distance / 120)
    const gain = Math.max(0.04, 0.5 - distance / 160)
    this.noiseBurst({ peak: gain, attack: 0.002 + att, decay: 0.11, filter: 900 - Math.min(500, distance * 8), pan })
    this.tone({ freq: 120, endFreq: 45, peak: gain * 0.55, attack: 0.002, decay: 0.14, type: 'triangle', pan })
  }

  impact() {
    if (!this.ctx) return
    this.noiseBurst({ peak: 0.16, attack: 0.001, decay: 0.045, filter: 3400, type: 'bandpass', q: 2 })
  }

  hit(kill = false) {
    if (!this.ctx) return
    if (kill) {
      this.tone({ freq: 660, endFreq: 880, peak: 0.12, decay: 0.09, type: 'square' })
      this.tone({ freq: 990, peak: 0.06, decay: 0.06, type: 'sine' })
    } else {
      this.tone({ freq: 1350, peak: 0.09, decay: 0.045, type: 'square' })
    }
  }

  headshot() {
    if (!this.ctx) return
    this.tone({ freq: 1500, peak: 0.12, decay: 0.05, type: 'square' })
    this.tone({ freq: 2200, peak: 0.07, decay: 0.09, type: 'sine' })
  }

  reload() {
    if (!this.ctx) return
    this.noiseBurst({ peak: 0.22, attack: 0.001, decay: 0.04, filter: 2600, type: 'bandpass' })
    setTimeout(() => this.noiseBurst({ peak: 0.3, attack: 0.001, decay: 0.05, filter: 1800, type: 'bandpass' }), 420)
    setTimeout(() => this.tone({ freq: 380, peak: 0.1, decay: 0.05, type: 'square' }), 720)
    setTimeout(() => this.noiseBurst({ peak: 0.34, attack: 0.001, decay: 0.06, filter: 3200, type: 'bandpass' }), 1180)
  }

  empty() {
    if (!this.ctx) return
    this.noiseBurst({ peak: 0.14, attack: 0.001, decay: 0.03, filter: 4200, type: 'highpass' })
  }

  footstep() {
    if (!this.ctx) return
    this.noiseBurst({ peak: 0.11, attack: 0.002, decay: 0.065, filter: 420, type: 'lowpass' })
    this.noiseBurst({ peak: 0.035, attack: 0.001, decay: 0.04, filter: 2600, type: 'highpass' })
  }

  jump() {
    if (!this.ctx) return
    this.noiseBurst({ peak: 0.08, attack: 0.002, decay: 0.08, filter: 600 })
  }

  land() {
    if (!this.ctx) return
    this.noiseBurst({ peak: 0.2, attack: 0.001, decay: 0.1, filter: 300 })
    this.tone({ freq: 90, endFreq: 40, peak: 0.16, decay: 0.12, type: 'sine' })
  }

  damages() {
    if (!this.ctx) return
    this.tone({ freq: 90, endFreq: 45, peak: 0.32, decay: 0.2, type: 'sawtooth' })
    this.noiseBurst({ peak: 0.3, attack: 0.001, decay: 0.18, filter: 700 })
  }

  waveStart() {
    if (!this.ctx) return
    this.tone({ freq: 220, endFreq: 330, peak: 0.14, attack: 0.02, decay: 0.4, type: 'sawtooth' })
    setTimeout(() => this.tone({ freq: 330, endFreq: 440, peak: 0.12, attack: 0.02, decay: 0.5, type: 'sawtooth' }), 220)
    setTimeout(() => this.tone({ freq: 55, peak: 0.3, decay: 0.9, type: 'sine' }), 120)
  }

  waveClear() {
    if (!this.ctx) return
    ;[523, 659, 784, 1046].forEach((f, i) => setTimeout(() => {
      this.tone({ freq: f, peak: 0.1, decay: 0.35, type: 'triangle' })
    }, i * 130))
  }

  explosion(distance = 20) {
    if (!this.ctx) return
    const g = Math.max(0.15, 0.8 - distance / 50)
    this.noiseBurst({ peak: g, attack: 0.004, decay: 0.5, filter: 380 })
    this.tone({ freq: 70, endFreq: 24, peak: g * 0.9, attack: 0.004, decay: 0.8, type: 'sine' })
  }

  pickup() {
    if (!this.ctx) return
    this.tone({ freq: 660, endFreq: 990, peak: 0.12, decay: 0.12, type: 'triangle' })
    this.tone({ freq: 1320, peak: 0.06, decay: 0.18, type: 'sine' })
  }

  thunder() {
    if (!this.ctx) return
    this.noiseBurst({ peak: 0.34, attack: 0.02, decay: 2.2, filter: 220, type: 'lowpass' })
    this.tone({ freq: 52, endFreq: 26, peak: 0.28, attack: 0.03, decay: 2.6, type: 'sine' })
    this.noiseBurst({ peak: 0.16, attack: 0.4, decay: 1.6, filter: 900 })
  }

  startAmbience() {
    if (!this.ctx || this.ambienceStarted) return
    this.ambienceStarted = true
    const drone = this.ctx.createOscillator()
    drone.type = 'sine'
    drone.frequency.value = 44
    const dg = this.ctx.createGain()
    dg.gain.value = 0.028
    const lfo = this.ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.07
    const lfoGain = this.ctx.createGain()
    lfoGain.gain.value = 7
    lfo.connect(lfoGain).connect(drone.frequency)
    const drone2 = this.ctx.createOscillator()
    drone2.type = 'triangle'
    drone2.frequency.value = 66
    const dg2 = this.ctx.createGain()
    dg2.gain.value = 0.012
    drone.connect(dg).connect(this.master)
    drone2.connect(dg2).connect(this.master)
    drone.start(); drone2.start(); lfo.start()

    const wind = this.ctx.createBufferSource()
    wind.buffer = this.noiseBuffer
    wind.loop = true
    const wf = this.ctx.createBiquadFilter()
    wf.type = 'bandpass'
    wf.frequency.value = 500
    wf.Q.value = 0.6
    const wg = this.ctx.createGain()
    wg.gain.value = 0.014
    const wlfo = this.ctx.createOscillator()
    wlfo.frequency.value = 0.09
    const wlg = this.ctx.createGain()
    wlg.gain.value = 0.008
    wlfo.connect(wlg).connect(wg.gain)
    wind.connect(wf).connect(wg).connect(this.master)
    wind.start(); wlfo.start()
  }

  ambientTick(dt, distanceFactor = 0) {
    if (!this.ctx) return
    this._nextAmbient -= dt
    if (this._nextAmbient <= 0) {
      this._nextAmbient = 5 + Math.random() * 9
      if (Math.random() > 0.45) {
        const pan = (Math.random() - 0.5) * 2
        const dist = 30 + Math.random() * 40
        this.enemyShot(dist, pan)
      } else {
        this.noiseBurst({ peak: 0.05, attack: 0.2, decay: 1.2, filter: 700, type: 'lowpass', pan: (Math.random() - 0.5) })
      }
    }
  }

  setMuted(m) {
    this.muted = m
    if (this.master) this.master.gain.value = m ? 0 : 0.55
  }
}

export const audio = new AudioEngine()
