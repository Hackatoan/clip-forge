// Shared preset/enum definitions used by both PropertiesPanel (manual editing)
// and the AI editor (prompt-driven edits) so the two stay in sync by
// construction instead of by convention.

export const TRANSITIONS = ['none', 'fade', 'fade-black', 'fade-white', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'zoom-in', 'zoom-out'];
export const BLENDS = ['normal', 'multiply', 'screen', 'overlay', 'lighten', 'darken', 'add'];

export const FILTER_PRESETS = {
  None:    { brightness: 1, contrast: 1, saturate: 1, blur: 0, grayscale: 0, sepia: 0, hue: 0 },
  'B&W':   { brightness: 1, contrast: 1.05, saturate: 1, blur: 0, grayscale: 1, sepia: 0, hue: 0 },
  Vintage: { brightness: 1.05, contrast: 1.1, saturate: 0.8, blur: 0, grayscale: 0, sepia: 0.4, hue: 0 },
  Warm:    { brightness: 1.05, contrast: 1, saturate: 1.2, blur: 0, grayscale: 0, sepia: 0.15, hue: 0 },
  Cool:    { brightness: 0.98, contrast: 1.05, saturate: 1.1, blur: 0, grayscale: 0, sepia: 0, hue: 200 },
  Vivid:   { brightness: 1.02, contrast: 1.15, saturate: 1.5, blur: 0, grayscale: 0, sepia: 0, hue: 0 },
};

// Cinematic colour-grade presets (temperature/tint + supporting filter tweaks).
export const GRADE_PRESETS = {
  None:            { temp: 0, tint: 0 },
  'Teal & Orange': { temp: 35, tint: -12, contrast: 1.12, saturate: 1.15 },
  Cinematic:       { temp: 12, tint: -8, contrast: 1.15, saturate: 0.95 },
  'Warm film':     { temp: 45, tint: 6, contrast: 1.05, saturate: 1.1 },
  Cold:            { temp: -40, tint: -6, contrast: 1.08, saturate: 0.9 },
  Moody:           { temp: -15, tint: 8, contrast: 1.2, saturate: 0.8, brightness: 0.95 },
};
