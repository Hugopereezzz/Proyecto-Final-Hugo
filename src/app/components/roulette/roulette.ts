import { Component, input } from '@angular/core';

@Component({
  selector: 'app-roulette',
  imports: [],
  templateUrl: './roulette.html',
  styleUrl: './roulette.css'
})
export class RouletteComponent {
  player          = input.required<string>();
  displaySkill    = input.required<string>();
  skillDescription = input.required<string>();
}
