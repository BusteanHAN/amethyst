import { Queue } from "@/logic/queue";
import { Track } from "@/logic/track";
import { useLocalStorage } from "@vueuse/core";
import { ref } from "vue";
import { AmethystAudioNodeManager } from "./audioManager";
import { EventEmitter } from "./eventEmitter";
import { secondsToColinHuman, secondsToHuman } from "@shared/formating";

export enum LoopMode {
	None,
	All,
	One,
}

export class Player extends EventEmitter<{
  play: Track;
  pause: Track;
  volume: number;
  shuffle: void;
  stop: void;
}> {
  private currentTrack = ref<Track>();
  private currentTrackIndex = ref(0);

  public isPlaying = ref(false);
  public isStopped = ref(true);
  public isPaused = ref(false);
  public loopMode = ref(LoopMode.None);
  public currentTime = ref(0);
  public volume = useLocalStorage<number>("volume", 1);
  public queue = new Queue();

  public input = new Audio();
  protected context = new window.AudioContext();
  public source = this.context.createMediaElementSource(this.input);

  public nodeManager = new AmethystAudioNodeManager(this.source, this.context);

  public constructor(){
    super();

    this.input.addEventListener("timeupdate", () => this.currentTime.value = this.input.currentTime);
    this.input.onended = () => this.next();

    // Set the volume on first load
    this.nodeManager.master.audioNode.gain.value = this.volume.value;
  }

  private setPlayingTrack(track: Track) {
    this.input.src = track.path;
    this.currentTrack.value = track;
    this.currentTrackIndex.value = this.queue.getList().indexOf(track);
    this.input.play();
    if (!track.isLoaded) {
      track.fetchAsyncData();
    }
  }

  /**
   * Changes the currenlty playing tune to the given input and plays it
   * @param target the index or instace of a Track
   */
  public play(target?: number | Track) {
    if (target) {
      const track = target instanceof Track ? target : this.queue.getTrack(target);
      if (track.hasErrored) return;
      this.setPlayingTrack(track);
    }
    // Play the first track by default
    if (!this.currentTrack.value) {
      // Find the first non-errored track
      const track = this.queue.getList().find(track => !track.hasErrored);
      track && this.setPlayingTrack(track);
    } 
    this.input.play();
    this.isPlaying.value = true;
    this.isPaused.value = false;
    this.isStopped.value = false;
    this.emit("play", this.getCurrentTrack()!);
  }

  public pause() {
		this.input.pause();
    this.isPlaying.value = false;
    this.isPaused.value = true;
    this.isStopped.value = false;
    this.emit("pause", this.getCurrentTrack()!);
  }

  public stop(){
		this.input.pause();
    this.isPlaying.value = false;
    this.isPaused.value = false;
    this.isStopped.value = true;
    this.currentTrack.value = undefined;
    this.currentTrackIndex.value = 0;
    this.emit("stop");
  }

  public shuffle() {
    this.queue.shuffle();
    this.emit("shuffle");
  }

  public next(){
    this.currentTrackIndex.value++;
    this.play(this.currentTrackIndex.value);
  }

  public previous(){
    this.currentTrackIndex.value--;
    this.play(this.currentTrackIndex.value);
  }

  public seekTo(time: number) {
		this.input.currentTime = time;
	}

	public seekForward(step = 5) {
		this.seekTo(this.currentTime.value + step);
	}

	public seekBackward(step = 5) {
		this.seekTo(this.currentTime.value - step);
	}

  public loopNone() {
		this.loopMode.value = LoopMode.None;
	};

	public loopOne() {
		this.loopMode.value = LoopMode.One;
	};

	public loopAll() {
		this.loopMode.value = LoopMode.All;
	};

  public setVolume(volume: number) {
		this.volume.value = Math.max(0, Math.min(1, volume));
    this.nodeManager.master.audioNode.gain.value = this.volume.value;
    this.emit("volume", this.volume.value);
	}

	public volumeUp(amount = 0.1) {
		this.setVolume(this.volume.value + amount);
	}

	public volumeDown(amount = 0.1) {
		this.setVolume(this.volume.value - amount);
	}

  public getCurrentTrack(): Track | undefined {
    return this.currentTrack.value;
  }

  public currentTimeFormatted(colinNotation?: boolean) {
		return colinNotation ? secondsToColinHuman(this.currentTime.value) : secondsToHuman(this.currentTime.value);
	}
}

export const player = new Player();