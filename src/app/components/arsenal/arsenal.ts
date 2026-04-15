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

  upgradeCost(level: number): number {
    return (level + 1) * 200;
  }
}
