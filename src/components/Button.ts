export class Button extends Phaser.GameObjects.Text {
  restStyle = {};

  constructor(scene, x, y, text, style, callback) {
    super(scene, x, y, text, style);

    this.restStyle = style;
    this.setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.enterButtonHoverState())
      .on("pointerout", () => this.enterButtonRestState())
      .on("pointerdown", () => this.enterButtonActiveState())
      .on("pointerup", () => {
        this.enterButtonHoverState();
        callback();
      });
  }

  enterButtonHoverState() {
    this.setStyle({ fill: "#ff0 " });
  }

  enterButtonRestState() {
    this.setStyle(this.restStyle);
  }

  enterButtonActiveState() {
    this.setStyle({ fill: "#0ff" });
  }
}
