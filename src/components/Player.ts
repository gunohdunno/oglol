import { ProjectileGroup } from "./Projectile"

export class Player {
    entity: Phaser.Types.Physics.Arcade.ImageWithDynamicBody
    projectileGroup: ProjectileGroup
    alive: boolean

    constructor(entity, projectileGroup) {
        this.entity = entity
        this.projectileGroup = projectileGroup
        this.alive = true
    }

    unalive() {
        this.alive = false
        this.entity.destroy()
    }
}