import { Component, inject, output } from '@angular/core';
import { AuthService } from '../../auth.service';

@Component({
  selector: 'app-arsenal',
  imports: [],
  templateUrl: './arsenal.html',
  styleUrl: './arsenal.css'
})
export class ArsenalComponent {
  public authService = inject(AuthService);
  purchaseDone = output<void>();

  availableSkins = [
    { id: 'default', name: 'Estándar',    price: 0,    desc: 'Misil de acero balístico básico', color: '#00e5ff' },
    { id: 'fire',    name: 'Infierno',    price: 500,  desc: 'Rastro de fuego abrasador',   color: '#ff3d00' },
    { id: 'neon',    name: 'Ciberpunk',   price: 750,  desc: 'Estilo neón retro-futurista', color: '#ff00ff' },
    { id: 'toxic',   name: 'Radioactivo', price: 1000, desc: 'Brillo químico letal',         color: '#ccff00' },
    { id: 'ghost',   name: 'Espectro',    price: 1500, desc: 'Rastro fantasmal etéreo',     color: '#cfd8dc' }
  ];

  async buyUpgrade(stat: string) {
    const user = this.authService.currentUser();
    if (!user) return;
    const res = await this.authService.upgradeStat(user, stat);
    if (!res.success) alert(res.message);
  }

  async buyAlliedSupport() {
    const user = this.authService.currentUser();
    if (!user) return;
    const res = await this.authService.buyAlliedSupport(user);
    if (!res.success) alert(res.message);
  }

  async buySkin(skinId: string) {
    const user = this.authService.currentUser();
    if (!user) return;
    const res = await this.authService.buySkin(user, skinId);
    if (!res.success) alert(res.message);
  }

  isSkinOwned(skinId: string): boolean {
    if (skinId === 'default') return true;
    const owned = this.authService.currentUserStats()?.ownedSkins || '';
    return owned.split(',').includes(skinId);
  }

  isSelectedSkin(skinId: string): boolean {
    return this.authService.currentUserStats()?.missileSkin === skinId;
  }

  async selectSkin(skinId: string) {
    const stats = this.authService.currentUserStats();
    if (!stats) return;
    const res = await this.authService.updateProfile(stats.username, stats.displayName || stats.username, stats.avatarBase64, skinId);
    if (!res.success) alert(res.message);
  }

  upgradeCost(level: number): number {
    return (level + 1) * 200;
  }
}
