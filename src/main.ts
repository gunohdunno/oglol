import Phaser from "phaser";

import GameScene from "./scenes/GameScene";
import MainMenuScene from "./scenes/MainMenuScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1200,
  height: 800,
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
      gravity: { y: 0 },
    },
  },
  pixelArt: true,
  scene: [MainMenuScene, GameScene],
};

export default new Phaser.Game(config);
