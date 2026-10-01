"use client";

import { Home01Icon } from "@hugeicons/core-free-icons";
import { resetView } from "@/state/controller";
import { useHangar } from "@/state/store";
import { Icon } from "./Icon";
import { ViewTools } from "./ViewTools";

const MODE_LABEL = { explore: "EXPLORE MODE", systems: "SYSTEMS MODE", compare: "COMPARE MODE", quiz: "QUIZ MODE" } as const;

export function BottomBar() {
  const mode = useHangar((s) => s.mode);
  const view = useHangar((s) => s.view);
  const cam = useHangar((s) => s.cameraMode);
  const isolated = useHangar((s) => s.isolatedComponent);
  return (
    <footer className="bottombar">
      <div className="status">
        <span className="mode">{isolated ? "ISOLATION" : MODE_LABEL[mode]}</span>
        <span className="meta meta-extra">VIEW / {view}</span>
        <span className="meta meta-extra">CAM / {cam === "auto" ? "AUTO" : "FREE"}</span>
        <span className="meta meta-extra">SCALE / 1:1</span>
      </div>
      <div className="status">
        <div className="hints meta">
          <span>DRAG · ROTATE</span>
          <span>SCROLL · ZOOM</span>
          <span>CLICK · SELECT</span>
        </div>
        <ViewTools />
        <button className="reset" onClick={resetView} aria-label="Reset view (R)">
          <Icon icon={Home01Icon} size={14} />
          RESET VIEW
        </button>
      </div>
    </footer>
  );
}
