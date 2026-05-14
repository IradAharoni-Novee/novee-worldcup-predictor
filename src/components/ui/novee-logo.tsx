import type { SVGProps } from "react";
import { cn } from "@/lib/cn";

export function NoveeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 26.5 26.5"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17.6729 6.01465C17.4033 6.0147 17.1545 6.10645 16.9541 6.25977C16.8493 6.33497 16.7544 6.42756 16.6758 6.53613L13.2441 11.252L9.8457 6.55469C9.76852 6.44827 9.67557 6.35788 9.57324 6.2832C9.36824 6.11565 9.10816 6.01485 8.8252 6.01465C8.5355 6.01469 8.2689 6.11931 8.06152 6.29395C7.86867 6.44648 7.73965 6.64981 7.67969 6.87012C7.64361 6.98666 7.62503 7.11154 7.625 7.24023V19.252C7.62529 19.9283 8.16275 20.4765 8.8252 20.4766C9.15597 20.4763 9.45593 20.3394 9.67285 20.1182C9.7348 20.062 9.79237 19.9984 9.84277 19.9287L13.2383 15.2598L16.6406 19.9629C17.025 20.4927 17.7789 20.6396 18.3271 20.291C18.5689 20.1366 18.7307 19.9107 18.8027 19.6611C18.8472 19.5332 18.873 19.3954 18.873 19.252V7.24023C18.873 7.23647 18.8721 7.23226 18.8721 7.22852C18.9025 6.83819 18.7255 6.44849 18.3652 6.21582C18.2287 6.12724 18.0787 6.06913 17.9248 6.04102L17.915 6.03906C17.837 6.02272 17.7556 6.01468 17.6729 6.01465ZM16.4727 15.7139L14.6943 13.2568L16.4727 10.8135V15.7139ZM11.7881 13.2549L10.0244 15.6807V10.8164L11.7881 13.2549Z"
        fill="currentColor"
      />
    </svg>
  );
}

const VEEVEE_GRADIENT =
  "conic-gradient(from 90deg, #8E5BFE 0deg, #FFAB72 81.83deg, #25FFAC 169.76deg, #4BADFF 262.43deg, #8E5AFF 360deg)";

export function VeeVeeLogo({
  size = 24,
  className,
  animate,
}: {
  size?: number;
  className?: string;
  animate?: boolean;
}) {
  return (
    <div
      className={cn("group relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <div
        className={cn(
          "absolute inset-0 rounded-full transition-all duration-300 group-hover:animate-[spin_4s_linear_infinite]",
          animate && "animate-[spin_4s_linear_infinite]"
        )}
        style={{ background: VEEVEE_GRADIENT }}
      />
      <div className="absolute inset-0.5 rounded-full flex items-center justify-center bg-white/60 backdrop-blur-sm">
        <NoveeIcon className="text-white" style={{ width: size * 0.72, height: size * 0.72 }} />
      </div>
    </div>
  );
}
