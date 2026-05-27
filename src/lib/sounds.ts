// Sonidos sintetizados con Web Audio API (sin archivos externos)
// Solo reproducen tras interacción del usuario (política iOS)

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

export function playComplete() {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.setValueAtTime(523, ctx.currentTime)     // C5
  osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1) // E5
  osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2) // G5
  gain.gain.setValueAtTime(0.3, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.4)
}

export function playLevelUp() {
  const ctx = getCtx()
  const notes = [523, 659, 784, 1047] // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15)
    gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.3)
    osc.start(ctx.currentTime + i * 0.15)
    osc.stop(ctx.currentTime + i * 0.15 + 0.3)
  })
}

export function playAchievement() {
  const ctx = getCtx()
  const notes = [440, 554, 659, 880, 880]
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12)
    gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.12)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.12 + 0.25)
    osc.start(ctx.currentTime + i * 0.12)
    osc.stop(ctx.currentTime + i * 0.12 + 0.25)
  })
}
