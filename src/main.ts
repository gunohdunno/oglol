import Phaser from 'phaser'

import GameScene from './scenes/GameScene'
import MainMenuScene from './scenes/MainMenuScene'

const config: Phaser.Types.Core.GameConfig = {
	type: Phaser.AUTO,
	width: 800,
	height: 600,
	physics: {
		default: 'arcade',
		arcade: {
			gravity: { y: 0 }
		}
	},
	scene: [MainMenuScene, GameScene]
}

export default new Phaser.Game(config)
