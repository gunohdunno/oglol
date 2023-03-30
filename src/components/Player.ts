import { ProjectileGroup } from "./Projectile"

export class Player {
    entity: Phaser.Types.Physics.Arcade.ImageWithDynamicBody
    projectileGroup: ProjectileGroup
    alive: boolean
    health: number
    maxHealth = 100

    constructor(entity, projectileGroup) {
        this.entity = entity
        this.projectileGroup = projectileGroup
        this.alive = true
        this.health = this.maxHealth
    }

    damage(delta: number): void {
        this.health -= delta
        if (this.health < 0) {
            this.unalive()
        }
    }

    unalive(): void {
        this.alive = false
        this.entity.destroy()
    }
}