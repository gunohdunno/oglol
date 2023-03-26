import Phaser from 'phaser'
import { Client, Room } from 'colyseus.js'
import { Projectile, ProjectileGroup } from '../components/Projectile'
import { Player } from '../components/Player'

export default class GameScene extends Phaser.Scene
{
	constructor()
	{
		super('game-scene')
	}

    client = new Client("ws://localhost:2567")
    room: Room | undefined
    playerEntities: {[ sessionId: string ]: Player } = {}
    inputPayload = {
        left: false,
        right: false,
        up: false,
        down: false,
    }
    cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys | undefined
    elapsedTime = 0
    fixedTimeStep = 1000 / 60
    roomId: string = ""
    projectileGroup: ProjectileGroup | undefined

	preload()
    {
        this.load.setBaseURL('http://labs.phaser.io')

        this.load.image('ball', 'assets/sprites/blue_ball.png')
        this.load.image('projectile', 'assets/sprites/green_ball.png')

        this.cursorKeys = this.input.keyboard.createCursorKeys()
    }

    init(data) {
        if (data.roomId) {
            this.roomId = data.roomId
        }
    }

    async create()
    {
        try {
            console.log("Joining room...")
            if (this.roomId) {
                this.room = await this.client.joinById(this.roomId)
            } else {
                this.room = await this.client.create("my_room")
            }
            console.log("Joined room successfully!")
        } catch (e) {
            console.error(e)
            return
        }

        this.roomId = this.room.id
        const codeSpan = document.getElementById("room-code")
        if (codeSpan) {
            codeSpan.textContent = this.roomId
        }

        this.room.state.players.onAdd = (player, sessionId) => {
            const playerEntity = this.physics.add.image(player.position.x, player.position.y, 'ball')
            const projectileGroup = new ProjectileGroup(this)
            this.playerEntities[sessionId] = new Player(playerEntity, projectileGroup)

            if (sessionId !== this.room?.sessionId) {
                // remote players
                player.position.onChange = () => {
                    // Need to further explore what the setData here is for.
                    // I guess it's just a place to store arbitrary data?
                    playerEntity.setData('serverX', player.position.x)
                    playerEntity.setData('serverY', player.position.y)
                }
            }
        }

        this.room.state.players.onRemove = (player, sessionId) => {
            const playerEntity = this.playerEntities[sessionId]
            if (playerEntity.entity) {
                playerEntity.entity.destroy()
            }
            delete this.playerEntities[sessionId]
        }

        this.input.on('pointerdown', (pointer) => {
            this.currentPlayer().projectileGroup.fireProjectile(this.currentPlayer().entity.x, this.currentPlayer().entity.y, pointer.x, pointer.y)
            this.room?.send('playerInput', {shoot: {x: pointer.x, y: pointer.y}})
        })

        this.room.onMessage('shoot', (message) => {
            const projectileGroup = this.playerEntities[message.playerId].projectileGroup
            projectileGroup.fireProjectile(
                message.position.x,
                message.position.y,
                message.velocity.x,
                message.velocity.y)
        })
    }

    update(time: number, delta: number): void {
        if (!this.currentPlayer) {
            return
        }

        this.elapsedTime += delta
        while (this.elapsedTime >= this.fixedTimeStep) {
            this.elapsedTime -= this.fixedTimeStep
            this.fixedTick(time, this.fixedTimeStep)
        }
    }

    fixedTick(_time: number, _delta: number) {
        if (!this.room) {
            return
        }

        const velocity = 6;
        this.inputPayload.left = this.cursorKeys.left.isDown
        this.inputPayload.right = this.cursorKeys.right.isDown
        this.inputPayload.up = this.cursorKeys.up.isDown
        this.inputPayload.down = this.cursorKeys.down.isDown
        this.room.send('playerInput', this.inputPayload)

        if (this.inputPayload.left) {
            this.currentPlayer().entity.x -= velocity;
        } else if (this.inputPayload.right) {
            this.currentPlayer().entity.x += velocity;
        }

        if (this.inputPayload.up) {
            this.currentPlayer().entity.y -= velocity;
        } else if (this.inputPayload.down) {
            this.currentPlayer().entity.y += velocity;
        }

        for (let sessionId in this.playerEntities) {
            if (sessionId === this.room.sessionId) {
                continue
            }

            const entity = this.playerEntities[sessionId].entity

            if (!entity.data) {
                continue
            }

            const { serverX, serverY } = entity.data.values

            entity.x = Phaser.Math.Linear(entity.x, serverX, 0.15)
            entity.y = Phaser.Math.Linear(entity.y, serverY, 0.15)
        }

    }

    currentPlayer(): Player | undefined {
        if (this.room) {
            return this.playerEntities[this.room?.sessionId]
        }
    }
}
