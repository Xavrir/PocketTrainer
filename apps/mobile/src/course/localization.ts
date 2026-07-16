export type CourseLocale = 'id' | 'en';

export type LocalizedResource = Readonly<{
  id: string;
  en: string;
}>;

export const courseCopy = {
  trackLabels: {
    strength: { id: 'Kekuatan', en: 'Strength' },
    yoga: { id: 'Yoga', en: 'Yoga' },
    mobility: { id: 'Mobilitas', en: 'Mobility' },
  },
  stateLabels: {
    completed: { id: 'SELESAI', en: 'COMPLETED' },
    available: { id: 'TERSEDIA', en: 'AVAILABLE' },
    gated: { id: 'BUTUH SYARAT', en: 'REQUIREMENTS' },
    locked: { id: 'TERKUNCI', en: 'LOCKED' },
  },
  gates: {
    contentNotPublished: {
      id: 'Konten belum diterbitkan.',
      en: 'This content is not published yet.',
    },
    accountLevelRequired: {
      id: 'Level akun belum cukup.',
      en: 'Your account level is not high enough.',
    },
    prerequisiteRequired: {
      id: 'Selesaikan pelajaran prasyarat.',
      en: 'Complete the prerequisite lesson first.',
    },
    masteryRequired: {
      id: 'Penguasaan gerak belum cukup.',
      en: 'Movement mastery is not high enough yet.',
    },
    equipmentRequired: {
      id: 'Peralatan yang dibutuhkan belum tersedia.',
      en: 'The required equipment is not available.',
    },
    capabilityRequired: {
      id: 'Butuh hasil asesmen yang memenuhi syarat.',
      en: 'A qualifying assessment result is required.',
    },
    activeRestriction: {
      id: 'Dikunci oleh batasan gerak aktif.',
      en: 'Blocked by an active movement restriction.',
    },
    unavailable: {
      id: 'Pelajaran belum dapat dibuka.',
      en: 'This lesson is not available yet.',
    },
  },
  target: {
    repetitions: { id: 'repetisi', en: 'repetitions' },
    seconds: { id: 'detik', en: 'seconds' },
    unknown: { id: 'Target belum dicantumkan', en: 'Target not provided' },
    noEquipment: { id: 'Tanpa alat', en: 'No equipment' },
  },
  coaching: {
    guidedRepetition: {
      id: 'Latihan repetisi terpandu',
      en: 'Guided repetition practice',
    },
    guidedHold: {
      id: 'Latihan tahan terpandu',
      en: 'Guided hold practice',
    },
    holdTarget: { id: 'Target tahan terpenuhi', en: 'Hold target met' },
  },
} as const;

export function resolveCopy(
  resource: LocalizedResource,
  locale: CourseLocale = 'id',
): string {
  return resource[locale] || resource.id || resource.en;
}

export function normalizeLocale(value: unknown): CourseLocale {
  return value === 'en' || value === 'en-US' ? 'en' : 'id';
}
