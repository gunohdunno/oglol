import Phaser, { Input } from "phaser";
import { Client, Room } from "colyseus.js";
import { Projectile, ProjectileGroup } from "../components/Projectile";
import { Player } from "../components/Player";

interface DirectionKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
}

interface PositionInput {
  x: number;
  y: number;
}

interface ShootInput {
  x: number;
  y: number;
  active: boolean;
}

interface InputPayload {
  position: PositionInput;
  shoot: ShootInput;
  spriteFrameKey: String;
}

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("game-scene");
  }

  client: Client | undefined;
  room: Room | undefined;
  players: { [sessionId: string]: Player } = {};
  inputPayload: InputPayload = {
    position: {
      x: 0,
      y: 0,
    },
    shoot: {
      x: 0,
      y: 0,
      active: false,
    },
    spriteFrameKey: "adam_front.png",
  };
  directionKeys: DirectionKeys | undefined;
  elapsedTime = 0;
  fixedTimeStep = 1000 / 60;
  roomId: string = "";
  projectileGroup: ProjectileGroup | undefined;
  shootInput: ShootInput = {
    x: 0,
    y: 0,
    active: false,
  };
  playerGroup: Phaser.Physics.Arcade.Group | undefined;
  healthText: Phaser.GameObjects.Text | undefined;
  playerSpeed = 400;
  projectileDamage = 8;

  preload() {
    if (process.env.PRODUCTION === "true") {
      this.client = new Client("https://oglol-backend.onrender.com");
    } else {
      this.client = new Client("ws://localhost:2567");
    }
    // load map tiles
    this.load.image("tiles", "assets/tilemaps/map_tileset.png");
    this.load.tilemapTiledJSON("map", "assets/tilemaps/map02.json");
    this.load.atlas(
      "adam",
      "assets/spritesheets/adam/spritesheet.png",
      "assets/spritesheets/adam/info.json"
    );
    this.load.atlas(
      "projectile",
      "assets/images/bullet_spritesheet.png",
      "assets/images/bullet.json"
    );

    this.directionKeys = {
      up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  init(data) {
    if (data.roomId) {
      this.roomId = data.roomId;
    }
  }

  async create() {
    try {
      console.log("Joining room...");
      if (this.roomId) {
        this.room = await this.client.joinById(this.roomId);
      } else {
        this.room = await this.client.create("my_room");
      }
      console.log("Joined room successfully!");
    } catch (e) {
      console.error(e);
      return;
    }

    // create map
    const map = this.make.tilemap({ key: "map" });
    const tileset = map.addTilesetImage("map_tileset", "tiles");
    const belowLayer = map.createLayer("below_layer", tileset, 0, 0);
    const aboveLayer = map.createLayer("above_layer", tileset, 0, 0);

    aboveLayer.setCollisionByProperty({ collides: true });

    // create room
    this.roomId = this.room.id;
    const codeSpan = document.getElementById("room-code");
    if (codeSpan) {
      codeSpan.textContent = this.roomId;
    }
    console.log(`Our ID is ${this.room.sessionId}`);

    this.playerGroup = new Phaser.Physics.Arcade.Group(
      this.physics.world,
      this
    );
    this.room.state.players.onAdd = (playerState, sessionId) => {
      const playerEntity = this.physics.add
        .sprite(
          playerState.position.x,
          playerState.position.y,
          "adam",
          "adam_front.png"
        )
        .setScale(2);
      playerEntity.body.setSize(16, 16);

      this.physics.add.collider(playerEntity, aboveLayer);
      const projectileGroup = new ProjectileGroup(this);
      this.physics.add.collider(
        aboveLayer,
        projectileGroup,
        (projectile: Phaser.Types.Physics.Arcade.GameObjectWithBody) => {
          (projectile as Projectile).disable();
        }
      );
      this.players[sessionId] = new Player(playerEntity, projectileGroup);
      this.players[sessionId].sessionId = sessionId;

      if (!this.playerGroup) {
        return;
      }
      this.playerGroup?.add(playerEntity);
      this.physics.add.overlap(
        projectileGroup,
        this.playerGroup,
        (
          projectile: Phaser.Types.Physics.Arcade.GameObjectWithBody,
          playerBody: Phaser.Types.Physics.Arcade.GameObjectWithBody
        ) => {
          if (playerBody !== playerEntity) {
            (projectile as Projectile).disable();
            const player = this.findPlayerByEntity(playerBody);
            const shooter = this.findShooter(projectile as Projectile);
            if (shooter) {
              const shooterId = shooter.sessionId;
              const victimId = player.sessionId;
              this.room?.send("hit", { shooterId, victimId });
            }
          }
        },
        undefined,
        this
      );

      // TODO: remove listener in onRemove()
      playerState.listen("health", () => {
        this.updateHealth(this.players[sessionId], playerState.health);
      });

      if (sessionId !== this.room?.sessionId) {
        // remote players
        playerState.position.onChange = () => {
          // Need to further explore what the setData here is for.
          // I guess it's just a place to store arbitrary data?
          playerEntity.setData("serverX", playerState.position.x);
          playerEntity.setData("serverY", playerState.position.y);
          playerEntity.setData("spriteFrameKey", playerState.spriteFrameKey);
        };
      } else {
        this.cameras.main.startFollow(playerEntity, false, 0.1, 0.1);
        this.healthText = this.add.text(
          this.cameras.main.scrollX,
          this.cameras.main.scrollY,
          this.currentPlayer().health.toString(),
          { fontSize: "6em " }
        );
      }
    };

    this.room.state.players.onRemove = (_playerState, sessionId) => {
      const player = this.players[sessionId];
      if (player.entity) {
        player.entity.destroy();
      }
      delete this.players[sessionId];
    };

    this.input.on("pointerdown", (pointer) => {
      if (!this.shootInput.active) {
        const x = pointer.x - this.sys.game.canvas.width / 2;
        const y = pointer.y - this.sys.game.canvas.height / 2;
        this.shootInput = {
          x,
          y,
          active: true,
        };
      }
    });

    this.room.onMessage("shoot", (message) => {
      const projectileGroup = this.players[message.playerId].projectileGroup;
      projectileGroup.fireProjectile(
        message.position.x,
        message.position.y,
        message.velocity.x,
        message.velocity.y
      );
    });

    this.room.onMessage("respawn", ({ id, x, y }) => {
      this.players[id].respawn(x, y);
    });
  }

  update(time: number, delta: number): void {
    if (!this.room || !this.currentPlayer()) {
      return;
    }

    this.elapsedTime += delta;
    while (this.elapsedTime >= this.fixedTimeStep) {
      this.elapsedTime -= this.fixedTimeStep;
      this.fixedTick(time, this.fixedTimeStep);
    }

    if (this.healthText) {
      this.healthText.setPosition(
        this.cameras.main.scrollX,
        this.cameras.main.scrollY
      );
    }
  }

  fixedTick(_time: number, _delta: number) {
    this.updatePlayerPhysics();
    this.sendInputToServer();
  }

  currentPlayer(): Player {
    if (this.room) {
      return this.players[this.room?.sessionId];
    }
    throw "Room not initialized";
  }

  findPlayerByEntity(entity: any): Player {
    for (let sessionId in this.players) {
      const player = this.players[sessionId];
      if (player.entity === entity) {
        return player;
      }
    }
    throw "No player exists with that entity";
  }

  findShooter(projectile: Projectile): Player | null {
    for (let sessionId in this.players) {
      const player = this.players[sessionId];
      if (player.projectileGroup.children.contains(projectile)) {
        return player;
      }
    }
    return null;
  }

  updateHealth(player: Player, health: number): void {
    player.setHealth(health);
    if (player === this.currentPlayer()) {
      this.healthText?.setText(player.health.toString());
    }
  }

  updatePlayerPhysics(): void {
    if (!this.room || !this.directionKeys) {
      return;
    }

    const currentPlayer = this.currentPlayer();

    if (currentPlayer.alive) {
      const left = this.directionKeys.left.isDown;
      const right = this.directionKeys.right.isDown;
      const up = this.directionKeys.up.isDown;
      const down = this.directionKeys.down.isDown;

      currentPlayer.entity.setVelocityX(0);
      currentPlayer.entity.setVelocityY(0);

      const velocityVector = new Phaser.Math.Vector2(0, 0);

      if (left) {
        currentPlayer.entity.setFrame("adam_left.png");
        velocityVector.x = -1;
      } else if (right) {
        currentPlayer.entity.setFrame("adam_right.png");
        velocityVector.x = 1;
      }

      if (up) {
        currentPlayer.entity.setFrame("adam_back.png");
        velocityVector.y = -1;
      } else if (down) {
        currentPlayer.entity.setFrame("adam_front.png");
        velocityVector.y = 1;
      }

      velocityVector.normalize().scale(this.playerSpeed);

      currentPlayer.entity.setVelocityX(velocityVector.x);
      currentPlayer.entity.setVelocityY(velocityVector.y);
    }

    for (let sessionId in this.players) {
      if (sessionId === this.room.sessionId) {
        continue;
      }

      const entity = this.players[sessionId].entity;

      if (!entity.data) {
        continue;
      }

      const { serverX, serverY, spriteFrameKey } = entity.data.values;

      entity.x = Phaser.Math.Linear(entity.x, serverX, 0.15);
      entity.y = Phaser.Math.Linear(entity.y, serverY, 0.15);
      entity.setFrame(spriteFrameKey);
    }
  }

  sendInputToServer(): void {
    if (!this.room) {
      return;
    }

    const currentPlayer = this.currentPlayer();

    if (this.shootInput.active) {
      this.inputPayload.shoot = {
        x: this.shootInput.x,
        y: this.shootInput.y,
        active: true,
      };
      this.shootInput.active = false;
      currentPlayer.projectileGroup.fireProjectile(
        currentPlayer.entity.x,
        currentPlayer.entity.y,
        this.shootInput.x,
        this.shootInput.y
      );
    } else {
      this.inputPayload.shoot.active = false;
    }

    this.inputPayload.position.x = currentPlayer.entity.x;
    this.inputPayload.position.y = currentPlayer.entity.y;
    this.inputPayload.spriteFrameKey = currentPlayer.entity.frame.name;

    this.room.send("playerInput", this.inputPayload);
  }
}
