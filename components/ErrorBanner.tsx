"use client";

interface ErrorBannerProps {
  error: string | null;
}

export default function ErrorBanner({ error }: ErrorBannerProps) {
  if (!error) return null;

  return (
    <div className="dark:bg-black px-4 py-2">
      <p className="text-white text-sm">{error}</p>
    </div>
  );
}
