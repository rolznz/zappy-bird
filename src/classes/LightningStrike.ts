import * as seedrandom from "seedrandom";

export default class LightningStrike {
  private _x: number;
  private _y: number;
  private _ctx: CanvasRenderingContext2D;
  opacity: number;
  alive: boolean;

  constructor({
    ctx,
    width,
    height,
    groundHeight,
  }: {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    groundHeight: number;
  }) {
    this._ctx = ctx;

    this._x = Math.random() * width;
    this._y = height - groundHeight;
    this.opacity = 1;

    this.alive = true;
  }

  draw() {
    if (!this.alive) {
      return;
    }

    // this._ctx.strokeStyle = `rgba(142, 48, 235, ${Math.pow(
    //   this.opacity,
    //   0.125
    // )})`;
    // this._ctx.lineWidth = 2;
    // this._ctx.beginPath();
    // this._ctx.moveTo(this._x, 0);
    // this._ctx.lineTo(this._x, this._y);
    // this._ctx.stroke();

    const rng = seedrandom.alea(this._x.toString());
    this._drawBranch(rng, this._x, 0, this._x, this._y, this.opacity, 1);

    // Update position and variables
    this.opacity -= 0.015;

    // Reset animation when zap disappears
    if (this.opacity <= 0) {
      this.alive = false;
    }
  }

  private _drawBranch(
    rng: seedrandom.PRNG,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    opacity: number,
    iteration: number
  ) {
    const MAX_ITERATIONS = 4;
    if (iteration > 4) {
      return;
    }
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);

    const numSegments = 1; // + Math.floor(rng.quick() * iteration);

    for (let i = 0; i < numSegments; i++) {
      const branchOpacity = opacity;

      this._ctx.strokeStyle = `rgba(233, 211, 255, ${branchOpacity})`;
      this._ctx.lineWidth = 5; //Math.max(1, rng.quick() * 3);
      this._ctx.beginPath();
      this._ctx.moveTo(x1, y1);

      // Add random deviation
      const branchAngle =
        angle +
        (rng.quick() - 0.5) * Math.pow(MAX_ITERATIONS - iteration, 3) * 0.01;

      const branchLength = this._y / MAX_ITERATIONS;

      const branchX = x1 + branchLength * Math.cos(branchAngle);
      const branchY = y1 + branchLength * Math.sin(branchAngle);

      this._ctx.lineTo(branchX, branchY);
      this._ctx.stroke();

      // Recursively draw smaller branches
      this._drawBranch(
        rng,
        branchX,
        branchY,
        x2,
        y2,
        branchOpacity,
        iteration + 1
      );
    }
  }
}
