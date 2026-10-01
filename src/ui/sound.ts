"use client";

import { useEffect } from "react";
import { runtime } from "@/scene/runtime";
import { useHangar } from "@/state/store";

/**
 * Optional, synthesized sound — off by default and only started by an
 * explicit click (browsers require a user gesture anyway).
 *  - fan / turbine: filtered noise plus a soft whine, following fan speed
 *  - actuators: a low hydraulic hum while surfaces or mechanisms move
 * Representative, not recordings of the aircraft.
 */
class HangarSound {
  ctx: AudioContext;
  master: GainNode;
  fanGain: GainNode;
  whine: OscillatorNode;
  whineGain: GainNode;
  humGain: GainNode;
  hum: OscillatorNode;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    const noise = this.ctx.createBufferSource();
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      // Brown-ish noise: smoother, rumbling.
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    noise.buffer = buf;
    noise.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    this.fanGain = this.ctx.createGain();
    this.fanGain.gain.value = 0;
    noise.connect(lp).connect(this.fanGain).connect(this.master);
    noise.start();

    this.whine = this.ctx.createOscillator();
    this.whine.type = "sine";
    this.whine.frequency.value = 1800;
    this.whineGain = this.ctx.createGain();
    this.whineGain.gain.value = 0;
    this.whine.connect(this.whineGain).connect(this.master);
    this.whine.start();

    this.hum = this.ctx.createOscillator();
    this.hum.type = "sawtooth";
    this.hum.frequency.value = 110;
    const humLp = this.ctx.createBiquadFilter();
    humLp.type = "lowpass";
    humLp.frequency.value = 380;
    this.humGain = this.ctx.createGain();
    this.humGain.gain.value = 0;
    this.hum.connect(humLp).connect(this.humGain).connect(this.master);
    this.hum.start();
  }

  update(fan: number, motion: number) {
    const t = this.ctx.currentTime;
    this.fanGain.gain.setTargetAtTime(0.35 * fan, t, 0.3);
    this.whineGain.gain.setTargetAtTime(0.02 * fan, t, 0.3);
    this.whine.frequency.setTargetAtTime(1200 + 900 * fan, t, 0.4);
    this.humGain.gain.setTargetAtTime(0.06 * Math.min(1, motion), t, 0.08);
    this.hum.frequency.setTargetAtTime(95 + 40 * Math.min(1, motion), t, 0.1);
  }

  close() {
    void this.ctx.close();
  }
}

export function useHangarSound() {
  const enabled = useHangar((s) => s.sound);
  useEffect(() => {
    if (!enabled) return;
    const snd = new HangarSound();
    let raf = 0;
    const prev = { roll: 0, pitch: 0, yaw: 0, flap: 0, slat: 0, toggles: 0 };
    const tick = () => {
      const s = runtime.surfaces;
      const tog = Object.values(runtime.toggles).reduce((a, b) => a + b, 0);
      const motion =
        (Math.abs(s.roll - prev.roll) + Math.abs(s.pitch - prev.pitch) + Math.abs(s.yaw - prev.yaw)) * 25 +
        (Math.abs(s.flap - prev.flap) + Math.abs(s.slat - prev.slat) + Math.abs(tog - prev.toggles)) * 220;
      Object.assign(prev, { roll: s.roll, pitch: s.pitch, yaw: s.yaw, flap: s.flap, slat: s.slat, toggles: tog });
      snd.update(Math.min(1, runtime.fanSpeed / 7.5), motion);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      snd.close();
    };
  }, [enabled]);
}
