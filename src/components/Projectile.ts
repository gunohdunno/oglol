import { Vector } from "matter";
import { Physics } from "phaser";

export class Projectile extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
		super(scene, x, y, 'projectile');
    }

    fire(fromX: number, fromY: number, toX: number, toY: number) {
        this.body.reset(fromX, fromY)
        this.setActive(true)
        this.setVisible(true)

        const vector = new Phaser.Math.Vector2(toX - fromX, toY - fromY).normalize().scale(1000)
        this.setVelocity(vector.x, vector.y)
    }

    protected preUpdate(time: number, delta: number): void {
        super.preUpdate(time, delta)
        if ((this.y <= 0 || this.y >= 1500) || (this.x <= 0 || this.x >= 1500)) {
            this.setActive(false)
            this.setVisible(false)
        }
    }
}

export class ProjectileGroup extends Phaser.Physics.Arcade.Group {
    constructor(scene) {
        super(scene.physics.world, scene)
        this.createMultiple({
            classType: Projectile,
            active: false,
            frameQuantity: 30,
            visible: false,
            key: 'projectile'
        })
    }

    fireProjectile(fromX: number, fromY: number, toX: number, toY: number) {
        const projectile = this.getFirstDead(false)
        if (projectile) {
            projectile.fire(fromX, fromY, toX, toY)
        }
    }
}
