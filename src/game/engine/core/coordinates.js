export const DEFAULT_LOGICAL_WIDTH = 1600;
export const DEFAULT_LOGICAL_HEIGHT = 900;

export function createCoordinateSystem(options = {}) {
  const logicalWidth = options.logicalWidth ?? DEFAULT_LOGICAL_WIDTH;
  const logicalHeight = options.logicalHeight ?? DEFAULT_LOGICAL_HEIGHT;
  const viewportWidth = options.viewportWidth ?? window.innerWidth;
  const viewportHeight = options.viewportHeight ?? window.innerHeight;

  const scaleX = viewportWidth / logicalWidth;
  const scaleY = viewportHeight / logicalHeight;

  return {
    logicalWidth,
    logicalHeight,
    viewportWidth,
    viewportHeight,
    scaleX,
    scaleY,
    toScreenX(x) {
      return x * scaleX;
    },
    toScreenY(y) {
      return y * scaleY;
    },
    toScreenPoint(point) {
      return {
        x: this.toScreenX(point.x),
        y: this.toScreenY(point.y),
      };
    },
    toLogicalX(x) {
      return x / scaleX;
    },
    toLogicalY(y) {
      return y / scaleY;
    },
    toLogicalPoint(point) {
      return {
        x: this.toLogicalX(point.x),
        y: this.toLogicalY(point.y),
      };
    },
  };
}
