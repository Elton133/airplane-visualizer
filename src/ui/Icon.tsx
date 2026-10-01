"use client";

import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

/** Single icon wrapper so stroke weight stays consistent everywhere. */
export function Icon({ icon, size = 16 }: { icon: IconSvgElement; size?: number }) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.5} color="currentColor" />;
}
