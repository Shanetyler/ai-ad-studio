import MuxPlayer from "@mux/mux-player-react";

export function VideoPlayer({
  playbackId,
  title,
  poster,
}: {
  playbackId: string;
  title?: string;
  poster?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-black">
      <MuxPlayer
        playbackId={playbackId}
        metadata={{ video_title: title ?? "EASY AD" }}
        poster={poster}
        accentColor="#e94560"
        style={{ aspectRatio: "16 / 9", width: "100%" }}
      />
    </div>
  );
}
