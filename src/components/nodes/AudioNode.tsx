import type { NodeProps } from "@xyflow/react";
import { memo, useRef, useState, type MouseEvent } from "react";
import { useResolvedImageSrc } from "../../hooks/useResolvedImageSrc";
import { sanitizeAudioSrc } from "../../lib/storage";
import { NOTE_COLORS } from "../../lib/theme";
import type { AudioNodeModel } from "../../types";
import { Icon } from "../ui/Icon";
import { NodeEmptyState } from "./NodeEmptyState";
import { NodeFrame } from "./NodeFrame";
import { nodePropsEqual } from "./nodePropsEqual";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

type AudioPlayerProps = {
  src: string;
  title: string;
  duration: number;
  disabled: boolean;
};

/** 音频控件单独成组件，用 key={src} 重建，切换结果时状态自然归零。 */
function AudioPlayer({ src, title, duration, disabled }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(duration || 0);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
      return;
    }
    audio.pause();
    setPlaying(false);
  };

  const seek = (event: MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const length = total || audio.duration;
    if (!Number.isFinite(length) || length <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = length * ratio;
    setCurrent(length * ratio);
  };

  const percent = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;

  return (
    <div className="node-audio">
      <button
        type="button"
        className="node-audio-toggle"
        aria-label={playing ? "暂停" : "播放"}
        disabled={disabled}
        onClick={toggle}
      >
        <Icon name={playing ? "pause" : "play"} size={16} />
      </button>
      <div className="node-audio-info">
        <div className="node-audio-title" title={title}>
          {title}
        </div>
        <div className="node-audio-track" role="presentation" onClick={seek} title="点击定位">
          <span className="node-audio-progress" style={{ width: `${percent}%` }} />
        </div>
        <div className="node-audio-time">
          {formatTime(current)} / {formatTime(total)}
        </div>
      </div>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          if (Number.isFinite(value) && value > 0) setTotal(value);
        }}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
    </div>
  );
}

function AudioNodeImpl({ id, data, selected }: NodeProps<AudioNodeModel>) {
  const src = useResolvedImageSrc(sanitizeAudioSrc(data.src));
  const generation = data.generation;
  const running = generation?.status === "running" || generation?.status === "queued";

  return (
    <NodeFrame
      id={id}
      title={data.title}
      defaultTitle="音频"
      accent={NOTE_COLORS.violet}
      kind="audio"
      selected={selected}
      running={running}
      loadingLabel={generation?.status === "queued" ? "排队中…" : "配音中"}
      progress={generation?.status === "running" ? generation.progress : undefined}
      error={generation?.error?.message}
    >
      {src ? (
        <AudioPlayer
          key={src}
          src={src}
          title={data.alt || "语音"}
          duration={data.duration}
          disabled={running}
        />
      ) : (
        <NodeEmptyState />
      )}
    </NodeFrame>
  );
}

export const AudioNode = memo(AudioNodeImpl, nodePropsEqual);
