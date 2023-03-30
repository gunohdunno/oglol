export class Projectile extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
		super(scene, x, y, 'projectile');
    }

    fire(fromX: number, fromY: number, toX: number, toY: number) {
        this.enableBody(true, fromX, fromY, true, true)

        const vector = new Phaser.Math.Vector2(toX, toY).normalize().scale(1000)
        this.setVelocity(vector.x, vector.y)
    }

    disable() {
        this.disableBody(true, true)
    }

    protected preUpdate(time: number, delta: number): void {
        super.preUpdate(time, delta)
        if ((this.y <= 0 || this.y >= 1500) || (this.x <= 0 || this.x >= 1500)) {
            this.disable()
        }
    }
}

export class ProjectileGroup extends Phaser.Physics.Arcade.Group {
    constructor(scene: Phaser.Scene) {
        super(scene.physics.world, scene)
        this.createMultiple({
            classType: Projectile,
            active: false,
            frameQuantity: 10,
            visible: false,
            key: 'projectile'
        })
    }

    fireProjectile(fromX: number, fromY: number, toX: number, toY: number) {
        const projectile = this.getFirstDead(false)
        if (projectile) {
            projectile.fire(fromX, fromY, toX, toY)
        } else {
            console.log("No projectile...")
        }
    }
}
