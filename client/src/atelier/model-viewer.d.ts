import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        alt?: string;
        "auto-rotate"?: boolean;
        "auto-rotate-delay"?: string;
        "camera-controls"?: boolean;
        "environment-image"?: string;
        exposure?: string;
        "interaction-prompt"?: string;
        "rotation-per-orbit"?: string;
        "shadow-intensity"?: string;
        src?: string;
      };
    }
  }
}
