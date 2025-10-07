import { create } from 'zustand';

const defaultThemes = {
  aurora: {
    skinTone: '#f5d6c6',
    accent: '#6c63ff',
    accessory: '#f72585',
    keyLight: 1.2,
    fillLight: 0.6,
    rimLight: 1.1,
    environment: { preset: 'sunset', background: '#1f1b2c' },
  },
  lagoon: {
    skinTone: '#f2efe9',
    accent: '#0ead69',
    accessory: '#3a86ff',
    keyLight: 1.1,
    fillLight: 0.8,
    rimLight: 0.9,
    environment: { preset: 'night', background: '#062925' },
  },
  bloom: {
    skinTone: '#ffd6a5',
    accent: '#ffadad',
    accessory: '#ffd166',
    keyLight: 1.0,
    fillLight: 0.7,
    rimLight: 1.4,
    environment: { preset: 'studio', background: '#2a1a33' },
  },
};

export const useAvatarStore = create((set) => ({
  ...defaultThemes.aurora,
  environment: defaultThemes.aurora.environment,
  theme: 'aurora',
  defaultThemes,
  updateColor: (key, value) => set({ [key]: value }),
  updateLight: (key, value) => set({ [key]: value }),
  setEnvironment: (preset) =>
    set((state) => ({
      environment: {
        ...state.environment,
        preset,
      },
    })),
  setBackground: (background) =>
    set((state) => ({
      environment: {
        ...state.environment,
        background,
      },
    })),
  applyTheme: (themeName) =>
    set(() => ({
      ...defaultThemes[themeName],
      environment: defaultThemes[themeName].environment,
      theme: themeName,
    })),
}));
