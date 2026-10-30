export const DEFAULT_LOGICAL_WIDTH = 1600;
export const DEFAULT_LOGICAL_HEIGHT = 900;

export function createCoordinateSystem(options = {}) {
  const logicalWidth = options.logicalWidth ?? DEFAULT_LOGICAL_WIDTH;
  const logicalHeight = options.logicalHeight ?? DEFAULT_LOGICAL_HEIGHT;
  const viewportWidth = options.viewportWidth ?? window.innerWidth;
  const viewportHeight = options.viewportHeight ?? window.innerHeight;
  const scale = Math.min(viewportWidth / logicalWidth, viewportHeight / logicalHeight);
  const scaleX = scale;
  const scaleY = scale;
  const offsetX = (viewportWidth - logicalWidth * scale) / 2;
  const offsetY = (viewportHeight - logicalHeight * scale) / 2;

  return {
    logicalWidth,
    logicalHeight,
    viewportWidth,
    viewportHeight,
    scaleX,
    scaleY,
    offsetX,
    offsetY,
    toScreenX(x) {
      return offsetX + x * scaleX;
    },
    toScreenY(y) {
      return offsetY + y * scaleY;
    },
    toScreenPoint(point) {
      return {
        x: this.toScreenX(point.x),
        y: this.toScreenY(point.y),
      };
    },
    toLogicalX(x) {
      return (x - offsetX) / scaleX;
    },
    toLogicalY(y) {
      return (y - offsetY) / scaleY;
    },
    toLogicalPoint(point) {
      return {
        x: this.toLogicalX(point.x),
        y: this.toLogicalY(point.y),
      };
    },
  };
}
