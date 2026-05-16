"use client";

import { toast, type ExternalToast } from "sonner";
import { VeeVeeLogo } from "@/components/ui/novee-logo";

/**
 * Fire a toast in VeeVee's voice — always paired with the spinning conic
 * logo. Same call signature as `toast()`; merges in an icon if the caller
 * didn't already supply one.
 */
export function veeveeToast(text: string, opts?: ExternalToast) {
  return toast(text, {
    icon: <VeeVeeLogo size={24} animate />,
    ...opts,
  });
}
