// Minimal brand marks for AI model players on the leaderboard.

export function AnthropicMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Anthropic"
    >
      <rect width="32" height="32" rx="7" fill="#D97757" />
      {/* Stylised "A": outer triangle + inner triangle cutout */}
      <path
        d="M16 6 L7 26 H10.6 L12.4 21.7 H19.6 L21.4 26 H25 L16 6 Z M13.6 18.6 L16 13 L18.4 18.6 H13.6 Z"
        fill="#FFFDF7"
      />
    </svg>
  );
}

export function OpenAIMark({ size = 28 }: { size?: number }) {
  // Public-domain OpenAI "blossom" path, simplified
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="OpenAI"
    >
      <rect width="32" height="32" rx="7" fill="#000000" />
      <g transform="translate(2 0)">
        <path
          d="M22.27 13.84a4.92 4.92 0 0 0-.42-4.04 4.97 4.97 0 0 0-5.37-2.39 4.97 4.97 0 0 0-3.75-1.69 4.97 4.97 0 0 0-4.74 3.45 4.92 4.92 0 0 0-3.3 2.39 4.97 4.97 0 0 0 .61 5.83 4.92 4.92 0 0 0 .42 4.04 4.97 4.97 0 0 0 5.37 2.39 4.97 4.97 0 0 0 3.75 1.69 4.97 4.97 0 0 0 4.74-3.45 4.92 4.92 0 0 0 3.3-2.39 4.97 4.97 0 0 0-.61-5.83Zm-7.4 10.34a3.69 3.69 0 0 1-2.37-.85l.12-.07 3.94-2.27a.64.64 0 0 0 .32-.56v-5.55l1.66.96.02.04v4.6a3.7 3.7 0 0 1-3.69 3.7Zm-7.94-3.39a3.68 3.68 0 0 1-.44-2.48l.12.07 3.94 2.27c.2.12.44.12.64 0l4.81-2.77v1.92a.05.05 0 0 1-.02.04l-3.98 2.3a3.7 3.7 0 0 1-5.07-1.35Zm-1.03-8.56a3.69 3.69 0 0 1 1.92-1.62v4.69c0 .23.12.44.32.55l4.79 2.76-1.66.96a.05.05 0 0 1-.05 0l-3.98-2.3a3.7 3.7 0 0 1-1.34-5.04Zm13.69 3.19-4.79-2.78 1.66-.96a.05.05 0 0 1 .05 0l3.98 2.3a3.69 3.69 0 0 1-.57 6.65v-4.69a.65.65 0 0 0-.33-.52Zm1.65-2.5-.12-.07-3.94-2.27a.64.64 0 0 0-.64 0L11.63 13.4v-1.92a.05.05 0 0 1 .02-.04l3.98-2.3a3.69 3.69 0 0 1 5.62 3.83Zm-10.41 3.43-1.66-.96a.05.05 0 0 1-.02-.04v-4.6a3.69 3.69 0 0 1 6.05-2.84l-.12.07-3.94 2.27a.64.64 0 0 0-.32.56l-.01 5.54Zm.9-1.94 2.14-1.24 2.14 1.24v2.47l-2.14 1.24-2.14-1.24v-2.47Z"
          fill="#FFFFFF"
        />
      </g>
    </svg>
  );
}
