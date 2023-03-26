import Phaser from 'phaser'
import { Client, Room } from 'colyseus.js'

export default class GameScene extends Phaser.Scene
{
	constructor()
	{
		super('game-scene')
	}

    client = new Client("ws://localhost:2567")
    room: Room | undefined
    playerEntities: {[ sessionId: string ]: any} = {}
    inputPayload = {
        left: false,
        right: false,
        up: false,
        down: false,
    }
    cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys | undefined
    currentPlayer: Phaser.Types.Physics.Arcade.ImageWithDynamicBody | undefined
    remoteRef: Phaser.GameObjects.Rectangle | undefined // used for debugging
    elapsedTime = 0
    fixedTimeStep = 1000 / 60
    roomId: string = ""

	preload()
    {
        this.load.setBaseURL('http://labs.phaser.io')

        this.load.image('sky', 'assets/skies/space3.png')
        this.load.image('logo', 'assets/sprites/phaser3-logo.png')
        this.load.image('red', 'assets/particles/red.png')
        this.load.image('ball', 'assets/sprites/blue_ball.png')

        this.cursorKeys = this.input.keyboard.createCursorKeys()
    }

    init(data) {
        if (data.roomId) {
            this.roomId = data.roomId
        }
    }

    async create()
    {
        console.log("Joining room...")

        try {
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
            const entity = this.physics.add.image(player.x, player.y, 'ball')
            this.playerEntities[sessionId] = entity

            if (sessionId === this.room.sessionId) {
                // current player
                this.currentPlayer = entity

                this.remoteRef = this.add.rectangle(0, 0, entity.width, entity.height)
                this.remoteRef.setStrokeStyle(1, 0xff0000)

                player.onChange = () => {
                    this.remoteRef.x = player.x
                    this.remoteRef.y = player.y
                }
            } else {
                // remote players
                player.onChange = () => {
                    entity.setData('serverX', player.x)
                    entity.setData('serverY', player.y)
                }
            }
        }

        this.room.state.players.onRemove = (player, sessionId) => {
            const entity = this.playerEntities[sessionId]
            if (entity) {
                entity.destroy()
            }
            delete this.playerEntities[sessionId]
        }

        // this.createHelloWorldVisuals()
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

    fixedTick(time: number, delta: number) {
        if (!this.room) {
            return
        }

        const velocity = 2;
        this.inputPayload.left = this.cursorKeys.left.isDown
        this.inputPayload.right = this.cursorKeys.right.isDown
        this.inputPayload.up = this.cursorKeys.up.isDown
        this.inputPayload.down = this.cursorKeys.down.isDown
        this.room.send(0, this.inputPayload)

        if (this.inputPayload.left) {
            this.currentPlayer.x -= velocity;
        } else if (this.inputPayload.right) {
            this.currentPlayer.x += velocity;
        }

        if (this.inputPayload.up) {
            this.currentPlayer.y -= velocity;
        } else if (this.inputPayload.down) {
            this.currentPlayer.y += velocity;
        }

        for (let sessionId in this.playerEntities) {
            if (sessionId === this.room.sessionId) {
                continue
            }

            const entity = this.playerEntities[sessionId]

            if (!entity.data) {
                continue
            }

            const { serverX, serverY } = entity.data.values

            entity.x = Phaser.Math.Linear(entity.x, serverX, 0.15)
            entity.y = Phaser.Math.Linear(entity.y, serverY, 0.15)
        }

    }

    createHelloWorldVisuals() {
        this.add.image(400, 300, 'sky')

        const particles = this.add.particles('red')

        const emitter = particles.createEmitter({
            speed: 100,
            scale: { start: 1, end: 0 },
            blendMode: 'ADD'
        })

        const logo = this.physics.add.image(400, 100, 'logo')

        logo.setVelocity(100, 200)
        logo.setBounce(1, 1)
        logo.setCollideWorldBounds(true)

        emitter.startFollow(logo)
    }
}
