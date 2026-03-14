import { Ionicons } from '@expo/vector-icons';

export type IoniconName = keyof typeof Ionicons.glyphMap;

export const isValidIoniconName = (name?: string | null): name is IoniconName =>
  typeof name === 'string' && Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, name);

export const resolveIoniconName = (
  name?: string | null,
  fallback: IoniconName = 'ellipse'
): IoniconName => {
  if (isValidIoniconName(name)) {
    return name;
  }

  if (typeof name === 'string' && name.trim().length > 0) {
    if (name.endsWith('-outline')) {
      const filled = name.slice(0, -8);
      if (isValidIoniconName(filled)) {
        return filled;
      }
    } else {
      const outlinedCandidate = `${name}-outline`;
      if (isValidIoniconName(outlinedCandidate)) {
        return outlinedCandidate;
      }
    }
  }

  return fallback;
};

export const toOutlineIoniconName = (
  name?: string | null,
  fallback: IoniconName = 'ellipse-outline'
): IoniconName => {
  const fallbackBase = fallback.endsWith('-outline')
    ? (fallback.slice(0, -8) as IoniconName)
    : fallback;

  const resolved = resolveIoniconName(name, fallbackBase);
  if (resolved.endsWith('-outline')) {
    return resolved;
  }

  const outlinedCandidate = `${resolved}-outline`;
  if (isValidIoniconName(outlinedCandidate)) {
    return outlinedCandidate;
  }

  return resolved;
};
