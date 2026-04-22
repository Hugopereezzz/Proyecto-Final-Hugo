import { Injectable } from '@angular/core';
import {
  Building, City, Missile, Explosion, Particle, Star,
  GameState, GamePhase, WorldEvent, WorldEventType,
  Weather, WeatherType, EmojiPing
} from './models/game.models';
import { User } from './auth.service';


@Injectable({ providedIn: 'root' })
export class GameService {
  private nextMissileId = 0;
  private canvasWidth = 0;
  private canvasHeight = 0;

  // Continent passive bonuses definitions
  readonly continentPassives = [
    { name: 'NORAD', icon: '🛡️', desc: '+20% éxito de intercepción', colorHex: '#00e5ff' },
    { name: 'Escudo de Hierro', icon: '⚔️', desc: '+25% salud inicial', colorHex: '#ff4081' },
    { name: 'Selva Densa', icon: '🌲', desc: 'Misiles viajan en modo sigilo automático', colorHex: '#76ff03' },
    { name: 'Recursos Estratégicos', icon: '💰', desc: '+50% créditos por edificio destruido', colorHex: '#ffab40' },
    { name: 'Isla Bastión', icon: '🏝️', desc: '+15 munición inicial', colorHex: '#aa00ff' },
    { name: 'Base de Hielo', icon: '❄️', desc: '+30% salud máxima', colorHex: '#eceff1' },
  ];

  // World event pool
  private readonly worldEvents: WorldEvent[] = [
    { type: 'solar-storm',    title: '☀️ TORMENTA SOLAR',         description: 'Radar offline — las barras de vida enemigas son invisibles durante 2 turnos.', icon: '☀️', turnsActive: 2 },
    { type: 'arms-treaty',    title: '🕊️ TRATADO DE NO PROLIFERACIÓN', description: 'Misiles nucleares bloqueados esta ronda.', icon: '🕊️', turnsActive: 1 },
    { type: 'spy-satellite',  title: '🛰️ SATÉLITE ESPÍA',          description: 'La trayectoria del próximo misil enemigo es visible para todos.', icon: '🛰️', turnsActive: 1 },
    { type: 'resource-crisis',title: '⚡ CRISIS DE RECURSOS',      description: 'Todos los jugadores pierden 5 de munición. ¡Actúa rápido!', icon: '⚡', turnsActive: 1 },
    { type: 'radio-jamming',  title: '📡 INTERFERENCIA DE RADIO', description: 'El sistema de puntería está fallando. El radar tiembla.', icon: '📡', turnsActive: 1 },
    { type: 'meteor-shower',  title: '☄️ LLUVIA DE METEORITOS', description: 'Impactos aleatorios en todo el mapa. ¡Cúbrete!', icon: '☄️', turnsActive: 1 },
  ];

  private readonly weatherPool: Weather[] = [
    { type: 'clear', title: '☀️ DESPEJADO', description: 'Condiciones óptimas.', icon: '☀️', windX: 0, windY: 0 },
    { type: 'windy', title: '🍃 VIENTO FUERTE', description: 'Vientos laterales afectan la trayectoria.', icon: '🍃', windX: 0.15, windY: 0 },
    { type: 'storm', title: '⛈️ TORMENTA', description: 'Turbulencia severa.', icon: '⛈️', windX: 0, windY: 0.1 },
    { type: 'fog',   title: '🌫️ NIEBLA', description: 'Visibilidad reducida.', icon: '🌫️', windX: 0, windY: 0 },
  ];

  readonly countryLocations = [
    { name: 'Norteamérica', x: 260, y: 190, color: '#00e5ff', accent: '#00b8d4' },
    { name: 'Eurasia', x: 860, y: 180, color: '#ff4081', accent: '#f50057' },
    { name: 'Sudamérica', x: 380, y: 500, color: '#76ff03', accent: '#64dd17' },
    { name: 'África', x: 650, y: 420, color: '#ffab40', accent: '#ff9100' },
    { name: 'Oceanía', x: 1000, y: 550, color: '#aa00ff', accent: '#d500f9' },
    { name: 'Antártida', x: 740, y: 520, color: '#eceff1', accent: '#cfd8dc' }
  ];

  initGame(canvasWidth: number, canvasHeight: number, players: any[], currentUserStats: User | null): GameState {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.nextMissileId = 0;

    const cities = this.createCities(players, currentUserStats);
    const stars = this.createStars(canvasWidth, canvasHeight);

    return {
      cities,
      missiles: [],
      explosions: [],
      stars,
      floatingRewards: [],
      lootEarned: 0,
      currentPlayerIndex: 0,
      phase: 'aiming',
      winner: null,
      turnNumber: 1,
      globalEvent: null,
      weather: { ...this.weatherPool[0] },
      screenShake: 0,
      activeEmojis: [],
      revengeUsed: {}
    };
  }

  private createCities(players: any[], currentUserStats: User | null): City[] {
    const cities: City[] = [];

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const isMe = currentUserStats && p.name === currentUserStats.username;
      
      const continentIdx = (p.continentIndex != null && p.continentIndex >= 0) 
                           ? p.continentIndex 
                           : (i % this.countryLocations.length);
                           
      const loc = this.countryLocations[continentIdx];
      const buildings = this.createBuildings(loc.x, loc.y, i * 1000);
      
      let baseHealth = buildings.reduce((sum, b) => sum + (b.healthValue || 0), 0);
      let baseAmmo = 50;

      // Apply upgrade bonuses for the local player
      if (isMe && currentUserStats) {
        baseHealth *= (1 + (currentUserStats.healthLevel * 0.1));
        baseAmmo += (currentUserStats.ammoLevel * 5);
      }

      // ─── Continent Passive Bonuses ─────────────────────────────────────
      // Eurasia/Antártida: health bonus
      if (continentIdx === 1) baseHealth *= 1.25;
      if (continentIdx === 5) baseHealth *= 1.30;
      // Oceanía: ammo bonus
      if (continentIdx === 4) baseAmmo += 15;
      // Sudamérica/Africa: handled in damage/launch

      cities.push({
        id: (p.cityId !== undefined && p.cityId !== null) ? p.cityId : i,
        name: loc.name,
        x: loc.x,
        y: loc.y,
        health: Math.round(baseHealth),
        maxHealth: Math.round(baseHealth),
        color: loc.color,
        accentColor: loc.accent,
        buildings,
        isAlive: true,
        ammo: baseAmmo,
        continentIndex: continentIdx,
        statusEffects: [],
        activeSkills: [],
        missileSkin: p.missileSkin || 'default',
        xp: p.xp || 0
      });
    }
    return cities;
  }

  private pseudoRand(seed: number): number {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  private createBuildings(centerX: number, centerY: number, seedBase: number): Building[] {
    const buildings: Building[] = [];
    const buildingCount = 20;

    for (let i = 0; i < buildingCount; i++) {
      let sd = seedBase + i * 10;
      const radius = 25 + this.pseudoRand(sd) * 60;
      const angle = this.pseudoRand(sd + 1) * Math.PI * 2;
      
      const bx = centerX + Math.cos(angle) * radius;
      const by = centerY + Math.sin(angle) * radius;

      const hue = 200 + Math.floor(this.pseudoRand(sd + 3) * 60);
      const color = `hsl(${hue}, 80%, 60%)`;

      buildings.push({
        x: bx,
        y: by,
        width: 8,
        height: 8,
        depth: 0,
        color,
        sideColor: color,
        topColor: color,
        healthValue: 25,
        windows: [],
        destroyed: false,
        type: 'base'
      });
    }
    return buildings;
  }

  private createStars(w: number, h: number): Star[] {
    const stars: Star[] = [];
    for (let i = 0; i < 150; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * (h * 0.7),
          radius: Math.random() * 1.5 + 0.5,
          alpha: Math.random(),
          twinkleSpeed: 0.005 + Math.random() * 0.02
        });
    }
    return stars;
  }

  launchMissile(state: GameState, fromCityId: number, targetX: number, targetY: number, elapsedMs: number = 0): Missile | null {
    const city = state.cities.find(c => c.id === fromCityId);
    if (!city || city.ammo <= 0) return null;
    
    // Block nuclear under arms treaty
    if (state.globalEvent?.type === 'arms-treaty' && city.activeSkills.includes('double-damage')) {
      return null;
    }

    city.ammo -= 1;
    
    const hasHyper   = city.activeSkills.includes('hyper-speed');
    const hasStealth = city.activeSkills.includes('stealth') || city.continentIndex === 2; // Sudamérica passive
    const hasNuclear = city.activeSkills.includes('double-damage');
    const hasCluster = city.activeSkills.includes('cluster-missile');

    let baseSpeed = 0.0083; 
    if (hasHyper) baseSpeed = 0.03;
    
    const startProgress = Math.min(0.9, elapsedMs * baseSpeed);

    const missile: Missile = {
      id: this.nextMissileId++,
      fromCityId,
      targetX,
      targetY,
      currentX: city.x,
      currentY: city.y - 40,
      startX: city.x,
      startY: city.y - 40,
      progress: startProgress,
      speed: baseSpeed, 
      color: city.color,
      trail: [],
      isDefensive: false,
      active: true,
      hitSuccess: true,
      isStealth: hasStealth,
      isNuclear: hasNuclear,
      isCluster: hasCluster,
      isSplit: false,
      skin: city.missileSkin || 'default'
    };

    state.missiles.push(missile);

    if (city.activeSkills.includes('double-shot')) {
      city.statusEffects = city.statusEffects.filter(e => e.type !== 'double-shot');
      city.activeSkills = city.statusEffects.map(e => e.type);
      this.launchMissile(state, fromCityId, targetX + 40, targetY, elapsedMs);
    }

    if (city.activeSkills.includes('cluster-missile')) {
      city.statusEffects = city.statusEffects.filter(e => e.type !== 'cluster-missile');
      city.activeSkills = city.statusEffects.map(e => e.type);
    }

    return missile;
  }

  launchAlliedMissile(state: GameState, targetX: number, targetY: number): Missile {
    const startX = Math.random() < 0.5 ? 0 : this.canvasWidth;
    const startY = 100;
    
    const missile: Missile = {
      id: this.nextMissileId++,
      fromCityId: -1,
      targetX,
      targetY,
      currentX: startX,
      currentY: startY,
      startX: startX,
      startY: startY,
      progress: 0,
      speed: 0.012,
      color: '#FFD700',
      trail: [],
      isDefensive: false,
      active: true,
      hitSuccess: true,
      isNuclear: true
    };

    state.missiles.push(missile);
    return missile;
  }

  launchDefensiveMissile(state: GameState, fromCityId: number, targetMissileId: number, hitSuccess: boolean = true, elapsedMs: number = 0): Missile | null {
    const city = state.cities.find(c => c.id === fromCityId);
    if (!city || city.ammo < 1) return null;

    city.ammo -= 1;

    const targetMissile = state.missiles.find(m => m.id === targetMissileId);
    
    const missile: Missile = {
      id: this.nextMissileId++,
      fromCityId,
      targetX: 0,
      targetY: 0,
      currentX: city.x,
      currentY: city.y - 40,
      startX: city.x,
      startY: city.y - 40,
      progress: 0,
      speed: 10, 
      color: '#ffffff',
      trail: [],
      isDefensive: true,
      targetMissileId: targetMissileId,
      hitSuccess: hitSuccess,
      active: true
    };

    if (elapsedMs > 0 && targetMissile) {
      const step = 10 * (elapsedMs / 16.6);
      const dx = targetMissile.currentX - missile.currentX;
      const dy = targetMissile.currentY - missile.currentY;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        missile.currentX += (dx / dist) * Math.min(dist, step);
        missile.currentY += (dy / dist) * Math.min(dist, step);
      }
    }

    state.missiles.push(missile);
    return missile;
  }

  updateMissiles(state: GameState, deltaTime: number): void {
    const dtFactor = deltaTime / 16.6; 

    for (const city of state.cities) {
      if (city.isAlive && city.activeSkills.includes('auto-defense') && !city.activeSkills.includes('no-defense')) {
        // Norteamérica passive: +20% intercept chance
        const interceptBonus = city.continentIndex === 0 ? 0.2 : 0;
        const incoming = state.missiles.find(m => 
          m.active && !m.isDefensive && !m.isStealth &&
          Math.hypot(m.currentX - city.x, m.currentY - city.y) < 300 &&
          !state.missiles.some(dm => dm.isDefensive && dm.targetMissileId === m.id)
        );
        if (incoming) {
          // Use intercept bonus for auto-defense from Norteamérica
          const hitChance = Math.random() + interceptBonus;
          this.launchDefensiveMissile(state, city.id, incoming.id, hitChance > 0.5, 0);
        }
      }
    }

    for (const missile of state.missiles) {
      if (!missile.active) continue;

      // Apply weather effects (wind)
      if (!missile.isDefensive) {
        missile.targetX += state.weather.windX * dtFactor;
        missile.targetY += state.weather.windY * dtFactor;
      }

      missile.trail.forEach(t => t.alpha *= 0.95);
      missile.trail = missile.trail.filter(t => t.alpha > 0.1);
      
      if (missile.isDefensive && missile.targetMissileId != null) {
        const target = state.missiles.find(m => m.id === missile.targetMissileId);
        if (target && target.active) {
          const dx = target.currentX - missile.currentX;
          const dy = target.currentY - missile.currentY;
          const dist = Math.hypot(dx, dy);

          if (dist < 30) {
            missile.active = false;
            if (missile.hitSuccess) {
              target.active = false;
              this.createExplosion(state, target.currentX, target.currentY, '#ffffff', true);
            } else {
              this.createExplosion(state, missile.currentX, missile.currentY, '#aaaaaa', true);
            }
          } else {
            const step = 25 * dtFactor;
            missile.currentX += (dx / dist) * step;
            missile.currentY += (dy / dist) * step;
            missile.trail.push({ x: missile.currentX, y: missile.currentY, alpha: 1 });
          }
        } else {
          missile.active = false;
          this.createExplosion(state, missile.currentX, missile.currentY, '#ffffff', true);
          const exp = state.explosions.find(e => e.missileId === missile.targetMissileId);
          if (exp) exp.wasIntercepted = true;
        }
        continue;
      }

      missile.progress += missile.speed * dtFactor;
      
      const t = missile.progress;
      const dx = missile.targetX - missile.startX;
      const dy = missile.targetY - missile.startY;

      missile.currentX = missile.startX + dx * t;
      missile.currentY = missile.startY + dy * t;
      
      // Cluster Missile Split Logic
      if (missile.isCluster && !missile.isSplit && t >= 0.5) {
        missile.active = false;
        // Create 3 sub-missiles
        for (let i = -1; i <= 1; i++) {
          const subMissile: Missile = {
            ...missile,
            id: this.nextMissileId++,
            isSplit: true,
            isCluster: false,
            startX: missile.currentX,
            startY: missile.currentY,
            targetX: missile.targetX + i * 40,
            targetY: missile.targetY,
            progress: 0,
            speed: missile.speed * 1.5,
            trail: []
          };
          state.missiles.push(subMissile);
        }
      }

      missile.trail.push({ x: missile.currentX, y: missile.currentY, alpha: 1 });

      if (missile.progress >= 1) {
        missile.active = false;
        this.createExplosion(state, missile.targetX, missile.targetY, missile.color, false, missile.id);
      }
    }
    state.missiles = state.missiles.filter(m => m.active || m.trail.length > 0);
  }

  addEmojiPing(state: GameState, cityId: number, emoji: string): void {
    state.activeEmojis.push({
      id: Date.now(),
      cityId,
      emoji,
      startTime: Date.now(),
      duration: 3000
    });
  }

  private createExplosion(state: GameState, x: number, y: number, color: string, isSmall: boolean, missileId?: number): void {
    const particles: Particle[] = [];
    const count = isSmall ? 15 : 30;
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const speed = 1 + Math.random() * 3;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1,
          radius: 1 + Math.random() * 3,
          alpha: 1,
          color
        });
    }

    const missileData = state.missiles.find(m => m.id === missileId);
    const isNuclear = missileData?.isNuclear;

    state.explosions.push({
      x, y,
      radius: 0,
      maxRadius: isSmall ? 30 : (isNuclear ? 150 : 60),
      alpha: 1,
      color,
      particles,
      active: true,
      missileId,
      isCityImpact: !isSmall,
      wasIntercepted: false,
      damageApplied: false
    });

    if (!isSmall) {
      state.screenShake = isNuclear ? 15 : 6;
    }
  }

  updateExplosions(state: GameState, deltaTime: number): void {
    const dtFactor = deltaTime / 16.6;

    if (state.screenShake > 0) {
      state.screenShake -= 0.5 * dtFactor;
      if (state.screenShake < 0) state.screenShake = 0;
    }

    state.activeEmojis = state.activeEmojis.filter(e => Date.now() - e.startTime < e.duration);

    // Hazard: Meteor Shower (Only while missiles are flying)
    if (state.globalEvent?.type === 'meteor-shower' && state.phase === 'defending' && Math.random() < 0.04 * dtFactor) {
      const mx = Math.random() * this.canvasWidth;
      const my = (Math.random() * 0.4 + 0.5) * this.canvasHeight; 
      this.createExplosion(state, mx, my, '#ff5500', true);
    }

    for (const exp of state.explosions) {
      if (!exp.active) continue;
      exp.radius += 3 * dtFactor;
      exp.alpha -= 0.025 * dtFactor;

      if (exp.isCityImpact && !exp.wasIntercepted && !exp.damageApplied && exp.alpha <= 0.6) {
        exp.damageApplied = true;
        this.applyDamage(state, exp.x, exp.y);
      }

      for (const p of exp.particles) {
        p.x += p.vx * dtFactor;
        p.y += p.vy * dtFactor;
        p.vy += 0.08 * dtFactor;
        p.alpha -= 0.02 * dtFactor;
      }
      exp.particles = exp.particles.filter(p => p.alpha > 0);

      if (exp.alpha <= 0 && exp.particles.length === 0) {
        exp.active = false;
      }
    }
    state.explosions = state.explosions.filter(e => e.active);

    for (const reward of state.floatingRewards) {
      if (!reward.active) continue;
      reward.yOffset += 1 * dtFactor;
      reward.alpha -= 0.015 * dtFactor;
      if (reward.alpha <= 0) reward.active = false;
    }
    state.floatingRewards = state.floatingRewards.filter(r => r.alpha > 0);
  }

  private applyDamage(state: GameState, hitX: number, hitY: number): void {
    const explosionRadius = 25;

    for (const city of state.cities) {
      if (!city.isAlive) continue;

      let damage = 0;
      for (const b of city.buildings) {
        if (b.destroyed) continue;

        const dist = Math.hypot(hitX - b.x, hitY - b.y);
        if (dist < explosionRadius + 10) {
          b.destroyed = true;
          damage += b.healthValue || 25;
          
          // África passive: +50% loot
          const lootMult = city.continentIndex === 3 ? 0 : 1; // Africa doesn't generate loot FOR attackers
          // Actually: the ATTACKER city needs to benefit — but we don't know the attacker here.
          // Instead Africa gets +50% credits at end via a separate path.
          state.lootEarned += 1;
          state.floatingRewards.push({
            id: Date.now() + Math.random(),
            x: b.x,
            y: b.y,
            value: '+1 CC',
            alpha: 1,
            active: true,
            yOffset: 0
          });
        }
      }

      if (damage === 0) {
        const dist = Math.abs(hitX - city.x);
        if (dist < 30) damage = 10;
      }

      if (damage > 0) {
        const prevHealth = city.health;
        city.health = Math.max(0, city.health - damage);
        if (city.health <= 0) {
          city.isAlive = false;
          this.destroyCityBuildings(city);
        } else if (prevHealth > city.maxHealth * 0.25 && city.health <= city.maxHealth * 0.25) {
          // Trigger revenge alert — handled by app.ts listener
          (state as any).__revengeAvailable = city.id;
        }
      }
    }
  }

  private destroyCityBuildings(city: City): void {
    for (const b of city.buildings) {
      b.destroyed = true;
    }
  }

  checkWinCondition(state: GameState): City | null {
    const alive = state.cities.filter(c => c.isAlive);
    if (alive.length === 1) return alive[0];
    if (alive.length === 0) return null;
    
    const totalAmmo = alive.reduce((acc, c) => acc + c.ammo, 0);
    if (totalAmmo === 0) {
      let best = alive[0];
      for (const c of alive) {
        if (c.health > best.health) best = c;
      }
      return best;
    }
    return null;
  }

  advanceTurn(state: GameState, nextIndex?: number, nextCityId?: number, weather?: any, globalEvent?: any): void {
    let next: number;

    if (nextCityId !== undefined && nextCityId !== null) {
      const idx = state.cities.findIndex(c => c.id === nextCityId);
      if (idx !== -1) {
        next = idx;
      } else {
        next = nextIndex ?? ((state.currentPlayerIndex + 1) % state.cities.length);
      }
    } else if (nextIndex !== undefined) {
      next = nextIndex;
    } else {
      next = (state.currentPlayerIndex + 1) % state.cities.length;
      let attempts = 0;
      while (attempts < state.cities.length) {
        const city = state.cities[next];
        if (city.isAlive && city.ammo > 0) break;
        next = (next + 1) % state.cities.length;
        attempts++;
      }
    }
    
    state.currentPlayerIndex = next;
    state.turnNumber++;

    // ─── Synchronized World Events (from server) ──────────────────────────
    if (globalEvent) {
      state.globalEvent = { ...globalEvent };
      // Immediate effects
      if (globalEvent.type === 'resource-crisis') {
        state.cities.forEach(c => { if (c.isAlive) c.ammo = Math.max(0, c.ammo - 5); });
      }
    } else if (globalEvent === null) {
      state.globalEvent = null;
    }

    // Status effects cooldown
    for (const city of state.cities) {
      city.statusEffects.forEach(effect => effect.turns--);
      city.statusEffects = city.statusEffects.filter(e => e.turns > 0);
      city.activeSkills = city.statusEffects.map(e => e.type);
    }

    // ─── Synchronized Weather (from server) ────────────────────────────────
    if (weather) {
        state.weather = { ...weather };
    }

    state.phase = 'aiming';
  }

  applySkill(state: GameState, cityId: number, skillIndex: number): void {
    const city = state.cities.find(c => c.id === cityId);
    if (!city) return;

    switch (skillIndex) {
      case 0: // Skill 0 (Extra Life / Suministros)
        city.health = Math.min(city.maxHealth, city.health + 250);
        city.ammo += 15;
        if (city.health > 0) city.isAlive = true;
        this.repairCityBuildings(city, 4);
        break;
      case 1: city.statusEffects.push({ type: 'auto-defense', turns: 3 }); break;
      case 2: city.statusEffects.push({ type: 'double-damage', turns: 2 }); break;
      case 3: city.statusEffects.push({ type: 'stealth', turns: 2 }); break;
      case 4: state.cities.forEach(c => { if (c.id !== cityId) c.statusEffects.push({ type: 'no-defense', turns: 2 }); }); break;
      case 5: state.cities.forEach(c => { if (c.id !== cityId) { const theft = Math.min(c.ammo, 10); c.ammo -= theft; city.ammo += theft; } }); break;
      case 6: city.statusEffects.push({ type: 'hyper-speed', turns: 2 }); break;
      case 7: city.statusEffects.push({ type: 'double-shot', turns: 2 }); break;
      case 8: // Repair
        this.repairCityBuildings(city, 8);
        break;
      case 9: city.statusEffects.push({ type: 'cluster-missile', turns: 1 }); break;
    }
    city.activeSkills = city.statusEffects.map(e => e.type);
  }

  private repairCityBuildings(city: City, amount: number): void {
    const destroyed = city.buildings.filter(b => b.destroyed);
    for (let i = 0; i < Math.min(destroyed.length, amount); i++) {
        destroyed[i].destroyed = false;
        city.health += destroyed[i].healthValue || 25;
    }
    city.health = Math.min(city.health, city.maxHealth);
  }

  getTargetableCities(state: GameState): City[] {
    return state.cities.filter(c => c.isAlive && c.id !== state.cities[state.currentPlayerIndex].id);
  }

  getIncomingMissiles(state: GameState, cityId: number): Missile[] {
    const city = state.cities.find(c => c.id === cityId);
    if (!city) return [];
    return state.missiles.filter(m => {
      if (!m.active || m.isDefensive) return false;
      const dist = Math.abs(m.targetX - city.x);
      return dist < 100;
    });
  }

  simulateBotMove(state: GameState, botCityId: number): { x: number, y: number } | null {
    const aliveEnemies = state.cities.filter(c => c.isAlive && c.id !== botCityId);
    if (aliveEnemies.length === 0) return null;

    // Pick random enemy
    const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];

    // Introduce random dispersion so they don't perfectly hit the pixel (approx 50px radius)
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 50;
    let x = target.x + Math.cos(angle) * distance;
    let y = target.y + Math.sin(angle) * distance;

    return { x, y };
  }

  /** Grants a free revenge super-missile when the city falls below 25% health for the first time. */
  triggerRevengeMissile(state: GameState, cityId: number, targetX: number, targetY: number): Missile | null {
    if (state.revengeUsed[cityId]) return null;
    const city = state.cities.find(c => c.id === cityId);
    if (!city || !city.isAlive) return null;

    state.revengeUsed[cityId] = true;
    city.ammo += 1; // temporarily grant ammo
    const prev = city.activeSkills.slice();
    city.activeSkills.push('double-damage'); // revenge shot is always nuclear
    const m = this.launchMissile(state, cityId, targetX, targetY);
    // Restore skills
    city.activeSkills = prev;
    return m;
  }

  /** Returns rank label based on XP */
  getRank(xp: number): { label: string; icon: string; color: string; level: number; nextXP: number; progress: number } {
    const thresholds = [
      { xp: 5000, label: 'General de 5 Estrellas', icon: '⭐⭐⭐⭐⭐', color: '#FFD700', level: 6 },
      { xp: 2500, label: 'Comandante Supremo',    icon: '⭐⭐⭐⭐',   color: '#C0C0C0', level: 5 },
      { xp: 1000, label: 'Comandante',            icon: '⭐⭐⭐',     color: '#CD7F32', level: 4 },
      { xp: 500,  label: 'Capitán',               icon: '⭐⭐',       color: '#76ff03', level: 3 },
      { xp: 200,  label: 'Sargento',              icon: '⭐',         color: '#00e5ff', level: 2 },
      { xp: 0,    label: 'Recluta',               icon: '🔰',         color: '#9ca3af', level: 1 }
    ];

    const current = thresholds.find(t => xp >= t.xp) || thresholds[thresholds.length-1];
    const nextIdx = thresholds.indexOf(current) - 1;
    const next = nextIdx >= 0 ? thresholds[nextIdx] : null;

    let progress = 0;
    if (next) {
      const range = next.xp - current.xp;
      const gained = xp - current.xp;
      progress = Math.min(100, (gained / range) * 100);
    } else {
      progress = 100;
    }

    return { 
      label: current.label, 
      icon: current.icon, 
      color: current.color, 
      level: current.level,
      nextXP: next ? next.xp : xp,
      progress
    };
  }

  /** Returns the Africa credit multiplier for a given city */
  getAfricaCreditMultiplier(city: any): number {
    return city?.continentIndex === 3 ? 1.5 : 1.0;
  }
}
