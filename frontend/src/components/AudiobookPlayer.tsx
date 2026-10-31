import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, 
  X, Loader2 
} from 'lucide-react';
import { savePlaybackPosition, getPlaybackPosition } from '../utils/offlineVault';

export interface AudiobookTrack {
  assetId: number;
  title: string;
  authorName?: string;
  coverImage?: string;
  licenseKey?: string;
  audioUrl?: string;
  audioBlob?: Blob;
  durationSeconds?: number;
}

interface AudiobookPlayerProps {
  track: AudiobookTrack;
  onClose: () => void;
}

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

export const AudiobookPlayer: React.FC<AudiobookPlayerProps> = ({ track, onClose }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(track.durationSeconds || 0);
  const [speedIndex, setSpeedIndex] = useState<number>(1); // default 1.0x
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Set up blob url if offline blob is provided
  useEffect(() => {
    if (track.audioBlob) {
      const url = URL.createObjectURL(track.audioBlob);
      setBlobUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setBlobUrl(null);
    }
  }, [track.audioBlob]);

  // Restore playback position
  useEffect(() => {
    let mounted = true;
    getPlaybackPosition(track.assetId).then((pos) => {
      if (mounted && pos > 0 && audioRef.current) {
        audioRef.current.currentTime = pos;
        setCurrentTime(pos);
      }
    });
    return () => {
      mounted = false;
    };
  }, [track.assetId]);

  // Periodically save position
  useEffect(() => {
    const interval = setInterval(() => {
      if (audioRef.current && !audioRef.current.paused) {
        savePlaybackPosition(track.assetId, audioRef.current.currentTime);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [track.assetId]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => console.warn('Audio play prevented:', e));
    }
  };

  const handleSkip = (seconds: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    savePlaybackPosition(track.assetId, newTime);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      savePlaybackPosition(track.assetId, newTime);
    }
  };

  const cycleSpeed = () => {
    const nextIdx = (speedIndex + 1) % SPEED_OPTIONS.length;
    setSpeedIndex(nextIdx);
    const speed = SPEED_OPTIONS[nextIdx];
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const sourceUrl = blobUrl || track.audioUrl;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface dark:bg-[#141414] border-0 shadow-2xl p-3 sm:p-4 text-gray-900 dark:text-white animate-slide-up">
      {sourceUrl && (
        <audio
          ref={audioRef}
          src={sourceUrl}
          preload="metadata"
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration || track.durationSeconds || 0);
              setIsLoading(false);
            }
          }}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            savePlaybackPosition(track.assetId, 0);
          }}
          onError={() => setIsLoading(false)}
        />
      )}

      <div className="max-w-5xl mx-auto flex flex-col gap-2">
        {/* Progress Bar & Timers */}
        <div className="flex items-center gap-2 text-3xs font-mono text-gray-500 dark:text-gray-400">
          <span className="w-10 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white"
          />
          <span className="w-10">{formatTime(duration)}</span>
        </div>

        {/* Player Controls & Track Info */}
        <div className="flex items-center justify-between gap-3">
          {/* Track Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {track.coverImage ? (
              <img
                src={track.coverImage}
                alt={track.title}
                className="w-10 h-10 object-cover shrink-0 !rounded-none"
              />
            ) : (
              <div className="w-10 h-10 bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center shrink-0 !rounded-none text-3xs font-bold">
                AUDIO
              </div>
            )}
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold truncate" title={track.title}>
                {track.title}
              </h4>
              <p className="text-3xs text-gray-500 dark:text-gray-400 truncate">
                {track.authorName || 'SokoniMax Audiobook'}
              </p>
            </div>
          </div>

          {/* Central Controls */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <button
              type="button"
              onClick={() => handleSkip(-15)}
              className="p-1.5 sm:p-2 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white transition cursor-pointer"
              title="Skip back 15s"
            >
              <RotateCcw size={16} />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              disabled={isLoading}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center hover:opacity-90 transition cursor-pointer disabled:opacity-50"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : isPlaying ? (
                <Pause size={18} />
              ) : (
                <Play size={18} className="translate-x-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSkip(15)}
              className="p-1.5 sm:p-2 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white transition cursor-pointer"
              title="Skip forward 15s"
            >
              <RotateCw size={16} />
            </button>

            {/* Playback Speed Pill */}
            <button
              type="button"
              onClick={cycleSpeed}
              className="px-2 py-1 text-3xs font-bold rounded-lg bg-surface-muted dark:bg-[#1e1e24] text-gray-700 dark:text-gray-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition cursor-pointer"
              title="Change Playback Speed"
            >
              {SPEED_OPTIONS[speedIndex]}x
            </button>
          </div>

          {/* Volume & Close */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.muted = !isMuted;
                  setIsMuted(!isMuted);
                }
              }}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition cursor-pointer hidden sm:inline-flex"
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            <button
              type="button"
              onClick={() => {
                if (audioRef.current) {
                  savePlaybackPosition(track.assetId, audioRef.current.currentTime);
                  audioRef.current.pause();
                }
                onClose();
              }}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition cursor-pointer"
              title="Close player"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
