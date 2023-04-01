import { ProjectileGroup } from "./Projectile";

export class Player {
  entity: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
  projectileGroup: ProjectileGroup;
  alive: boolean;
  health: number;
  maxHealth = 100;
  sessionId = "";

  constructor(entity, projectileGroup) {
    this.entity = entity;
    this.projectileGroup = projectileGroup;
    this.alive = true;
    this.health = this.maxHealth;
  }

  damage(delta: number): void {
    this.health -= delta;
    this.checkAlive()
  }

  setHealth(health: number): void {
    this.health = health
    this.checkAlive()
  }

  checkAlive(): void {
    if (this.health <= 0) {
      this.unalive()
    }
  }

  unalive(): void {
    this.alive = false;
    this.entity.disableBody(true, true)
  }

  respawn(x: number, y: number): void {
    this.alive = true
    this.entity.enableBody(true, x, y, true, true);
  }
}
