export function VideoPlayer({
  src,
  poster,
}: {
  src: string;
  poster?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-black">
      <video
        src={src}
        poster={poster}
        controls
        playsInline
        preload="metadata"
        className="w-full"
        style={{ aspectRatio: "16 / 9" }}
      />
    </div>
  );
}
