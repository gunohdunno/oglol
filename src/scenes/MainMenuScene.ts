import Phaser from "phaser";
import { Client, Room } from "colyseus.js";
import { Button } from "../components/Button";

export default class MainMenuScene extends Phaser.Scene {
  inputElId = "code-input";

  create() {
    const buttonStyle = { fill: "#fff ", fontSize: "6em" };

    const createButton = new Button(
      this,
      380,
      250,
      "Create Room",
      buttonStyle,
      () => this.onRoomCreatePress()
    );
    this.add.existing(createButton);

    const joinButton = new Button(
      this,
      250,
      450,
      "Join Existing Room",
      buttonStyle,
      () => this.onRoomJoinPress()
    );
    this.add.existing(joinButton);
  }

  onRoomCreatePress() {
    this.scene.start("game-scene");
  }

  onRoomJoinPress() {
    const formElement = <HTMLInputElement>(
      document.getElementById(this.inputElId)
    );
    this.scene.start("game-scene", { roomId: formElement?.value });
  }
}
