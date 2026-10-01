"use client";

import { BulbIcon, Moon02Icon, RulerIcon, UserIcon, VolumeHighIcon, VolumeOffIcon } from "@hugeicons/core-free-icons";
import { toggleAircraftLights, toggleDarkHangar, toggleHuman, toggleMeasure, toggleSound } from "@/state/controller";
import { useHangar } from "@/state/store";
import { Icon } from "./Icon";

/** Scale aids and environment toggles. */
export function ViewTools() {
  const measure = useHangar((s) => s.measure);
  const human = useHangar((s) => s.human);
  const dark = useHangar((s) => s.lighting === "dark");
  const lights = useHangar((s) => s.aircraftLights);
  const sound = useHangar((s) => s.sound);
  const tools = [
    { label: "MEASURE", key: "M", on: measure, icon: RulerIcon, act: toggleMeasure },
    { label: "HUMAN SCALE", key: "H", on: human, icon: UserIcon, act: toggleHuman },
    { label: "DARK HANGAR", key: "N", on: dark, icon: Moon02Icon, act: toggleDarkHangar },
    { label: "AIRCRAFT LIGHTS", key: "", on: lights, icon: BulbIcon, act: toggleAircraftLights },
    { label: "SOUND · SYNTHESIZED", key: "", on: sound, icon: sound ? VolumeHighIcon : VolumeOffIcon, act: toggleSound },
  ];
  return (
    <div className="view-tools" role="toolbar" aria-label="View tools">
      {tools.map((t) => (
        <button
          key={t.label}
          className="icon-btn tool"
          aria-pressed={t.on}
          aria-label={t.label}
          onClick={t.act}
          data-tip={t.key ? `${t.label} · ${t.key}` : t.label}
        >
          <Icon icon={t.icon} size={15} />
        </button>
      ))}
    </div>
  );
}
