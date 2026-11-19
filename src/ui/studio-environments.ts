export const STUDIO_ENVIRONMENTS = [
  { id: 'pure', label: 'Pure Studio', description: 'Balanced light, clean product surfaces', appearance: 'light' },
  { id: 'atelier', label: 'Atelier', description: 'Warm ivory and editorial neutrals', appearance: 'light' },
  { id: 'summer', label: 'Summer Edit', description: 'Sunlit sand and warm daylight', appearance: 'light' },
  { id: 'winter', label: 'Winter Capsule', description: 'Cool frost and soft blue light', appearance: 'light' },
  { id: 'college', label: 'Campus Classic', description: 'Varsity tones and collegiate texture', appearance: 'light' },
  { id: 'graphite', label: 'Graphite Studio', description: 'Quiet dark workspace in graphite', appearance: 'dark' },
  { id: 'club', label: 'After Hours', description: 'Midnight colour and party lights', appearance: 'dark' },
  { id: 'festive', label: 'Festive Atelier', description: 'Burgundy, candlelight and gold', appearance: 'dark' },
  { id: 'streetwear', label: 'Concrete Studio', description: 'Urban graphite and industrial texture', appearance: 'dark' },
  { id: 'runway', label: 'Runway Noir', description: 'Focused spotlight and deep shadows', appearance: 'dark' },
] as const;

export type StudioEnvironment = (typeof STUDIO_ENVIRONMENTS)[number]['id'];
export type StudioAppearance = (typeof STUDIO_ENVIRONMENTS)[number]['appearance'];

export function isStudioEnvironment(value: string | null): value is StudioEnvironment {
  return STUDIO_ENVIRONMENTS.some((environment) => environment.id === value);
}

export function getStudioAppearance(value: StudioEnvironment): StudioAppearance {
  return STUDIO_ENVIRONMENTS.find((environment) => environment.id === value)?.appearance ?? 'light';
}
