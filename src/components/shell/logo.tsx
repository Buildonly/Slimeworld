/** The little slime mark used in the header and favicon. */
export function SlimeMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M3 25c0-10 5.6-18 13-18s13 8 13 18c0 3-6 4-13 4S3 28 3 25z" fill="var(--accent)" />
      <ellipse cx="11.5" cy="18" rx="2.2" ry="2.8" fill="#2a1c1f" />
      <ellipse cx="20.5" cy="18" rx="2.2" ry="2.8" fill="#2a1c1f" />
      <circle cx="12.3" cy="17" r=".8" fill="#fff" />
      <circle cx="21.3" cy="17" r=".8" fill="#fff" />
      <ellipse cx="10" cy="11" rx="3" ry="1.6" fill="#fff" opacity=".45" transform="rotate(-25 10 11)" />
    </svg>
  );
}
