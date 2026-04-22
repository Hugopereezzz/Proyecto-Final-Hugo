export interface Building {
  x: number;
  y: number;
  width: number;
  height: number;
  depth?: number;
  color: string;
  sideColor?: string;
  topColor?: string;
  healthValue?: number;
  windows: { x: number; y: number; lit: boolean }[];
  destroyed: boolean;
  type: string;
}

export interface City {
  id: number;
  name: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  color: string;
  accentColor: string;
  buildings: Building[];
  isAlive: boolean;
  ammo: number;
  continentIndex?: number;
  statusEffects: { type: string; turns: number }[];
  activeSkills: string[];
  isBot?: boolean;
  afkCount?: number;
  missileSkin?: string;
  xp?: number;
}

export interface Missile {
  id: number;
  fromCityId: number;
  targetX: number;
  targetY: number;
  currentX: number;
  currentY: number;
  startX: number;
  startY: number;
  progress: number;
  speed: number;
  color: string;
  trail: { x: number; y: number; alpha: number }[];
  isDefensive: boolean;
  targetMissileId?: number;
  hitSuccess?: boolean;
  isStealth?: boolean;
  isNuclear?: boolean;
  isCluster?: boolean;
  isSplit?: boolean;
  active: boolean;
  skin?: string;
}

export interface Explosion {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
  particles: Particle[];
  active: boolean;
  missileId?: number;
  isCityImpact?: boolean;
  wasIntercepted?: boolean;
  damageApplied?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
}

export interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  twinkleSpeed: number;
}

export type GamePhase = 'auth' | 'setup' | 'aiming' | 'firing' | 'defending' | 'result' | 'gameover';

export type WorldEventType = 'solar-storm' | 'arms-treaty' | 'spy-satellite' | 'resource-crisis' | 'radio-jamming' | 'meteor-shower' | null;

export interface WorldEvent {
  type: WorldEventType;
  title: string;
  description: string;
  icon: string;
  turnsActive: number;
}

export type WeatherType = 'clear' | 'windy' | 'storm' | 'fog';

export interface Weather {
  type: WeatherType;
  title: string;
  description: string;
  icon: string;
  windX: number;
  windY: number;
}

export interface EmojiPing {
  id: number;
  cityId: number;
  emoji: string;
  startTime: number;
  duration: number;
}

export interface FloatingReward {
  id: number;
  x: number;
  y: number;
  value: string;
  alpha: number;
  active: boolean;
  yOffset: number;
}

export interface GameState {
  cities: City[];
  missiles: Missile[];
  explosions: Explosion[];
  stars: Star[];
  floatingRewards: FloatingReward[];
  lootEarned: number;
  currentPlayerIndex: number;
  phase: GamePhase;
  winner: City | null;
  turnNumber: number;
  globalEvent: WorldEvent | null;
  weather: Weather;
  screenShake: number; // intensity
  activeEmojis: EmojiPing[];
  revengeUsed: { [cityId: number]: boolean };
}
