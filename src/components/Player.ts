import { ProjectileGroup } from "./Projectile"

export class Player {
    entity: Phaser.Types.Physics.Arcade.ImageWithDynamicBody
    projectileGroup: ProjectileGroup

    constructor(entity, projectileGroup) {
        this.entity = entity
        this.projectileGroup = projectileGroup
    }
}