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

interface ShootInput {
  x: number;
  y: number;
  active: boolean;
}

interface InputPayload {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  shoot: ShootInput;
}

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("game-scene");
  }

  client = new Client("ws://localhost:2567");
  room: Room | undefined;
  players: { [sessionId: string]: Player } = {};
  inputPayload: InputPayload = {
    left: false,
    right: false,
    up: false,
    down: false,
    shoot: {
      x: 0,
      y: 0,
      active: false,
    },
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

  preload() {
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
          "Adam_idle_16x16-3.png"
        )
        .setScale(2);
      playerEntity.body.setSize(16, 16);

      this.physics.add.collider(playerEntity, aboveLayer);
      const projectileGroup = new ProjectileGroup(this);
      this.players[sessionId] = new Player(playerEntity, projectileGroup);

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
            this.damagePlayer(player, 8);
          }
        },
        undefined,
        this
      );

      if (sessionId !== this.room?.sessionId) {
        // remote players
        playerState.position.onChange = () => {
          // Need to further explore what the setData here is for.
          // I guess it's just a place to store arbitrary data?
          playerEntity.setData("serverX", playerState.position.x);
          playerEntity.setData("serverY", playerState.position.y);
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
    if (!this.room) {
      return;
    }

    const velocity = 250;
    const currentPlayer = this.currentPlayer();
    currentPlayer.entity.setVelocityX(0);
    currentPlayer.entity.setVelocityY(0);
    this.inputPayload.left = this.directionKeys.left.isDown;
    this.inputPayload.right = this.directionKeys.right.isDown;
    this.inputPayload.up = this.directionKeys.up.isDown;
    this.inputPayload.down = this.directionKeys.down.isDown;

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

    this.room.send("playerInput", this.inputPayload);

    if (this.inputPayload.left) {
      currentPlayer.entity.setVelocityX(-velocity);
    } else if (this.inputPayload.right) {
      currentPlayer.entity.setVelocityX(velocity);
    }

    if (this.inputPayload.up) {
      currentPlayer.entity.setVelocityY(-velocity);
    } else if (this.inputPayload.down) {
      currentPlayer.entity.setVelocityY(velocity);
    }

    for (let sessionId in this.players) {
      if (sessionId === this.room.sessionId) {
        continue;
      }

      const entity = this.players[sessionId].entity;

      if (!entity.data) {
        continue;
      }

      const { serverX, serverY } = entity.data.values;

      entity.x = Phaser.Math.Linear(entity.x, serverX, 0.15);
      entity.y = Phaser.Math.Linear(entity.y, serverY, 0.15);
    }
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

  damagePlayer(player: Player, dmg: number): void {
    player.damage(dmg);
    if (player === this.currentPlayer()) {
      this.healthText?.setText(player.health.toString());
    }
  }
}
