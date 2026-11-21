export const withAlpha = (color: string, alpha: number) => `color-mix(in srgb, ${color} ${alpha * 100}%, transparent)`
