import type { Catalog } from '../domain/domain.types';

const text = (id: string, en: string) => ({ id, en });

export function createCatalog(contentBaseUrl: string): Catalog {
  const exercises = [
    {
      id: '10000000-0000-4000-8000-000000000001',
      exerciseKey: 'body_squat',
      version: 1,
      scoringVersion: '1.0.0',
      poseModelVersion: 'mediapipe-pose-landmarker-1',
      name: text('Squat tubuh', 'Body squat'),
      category: 'strength' as const,
      mode: 'repetition' as const,
      cameraView: 'side' as const,
      contentUrl: `${contentBaseUrl}/v1/exercises/body-squat/preview.mp4`,
    },
    {
      id: '10000000-0000-4000-8000-000000000002',
      exerciseKey: 'incline_push_up',
      version: 1,
      scoringVersion: '1.0.0',
      poseModelVersion: 'mediapipe-pose-landmarker-1',
      name: text('Push-up miring', 'Incline push-up'),
      category: 'strength' as const,
      mode: 'repetition' as const,
      cameraView: 'side' as const,
      contentUrl: `${contentBaseUrl}/v1/exercises/incline-push-up/preview.mp4`,
    },
    {
      id: '10000000-0000-4000-8000-000000000003',
      exerciseKey: 'warrior_two',
      version: 1,
      scoringVersion: '1.0.0',
      poseModelVersion: 'mediapipe-pose-landmarker-1',
      name: text('Warrior II', 'Warrior II'),
      category: 'yoga' as const,
      mode: 'hold' as const,
      cameraView: 'front' as const,
      contentUrl: `${contentBaseUrl}/v1/exercises/warrior-two/preview.mp4`,
    },
    {
      id: '10000000-0000-4000-8000-000000000004',
      exerciseKey: 'tree_pose',
      version: 1,
      scoringVersion: '1.0.0',
      poseModelVersion: 'mediapipe-pose-landmarker-1',
      name: text('Pose pohon', 'Tree pose'),
      category: 'yoga' as const,
      mode: 'hold' as const,
      cameraView: 'front' as const,
      contentUrl: `${contentBaseUrl}/v1/exercises/tree-pose/preview.mp4`,
    },
  ];

  const lessons = {
    squat: {
      id: '40000000-0000-4000-8000-000000000001',
      unitId: '30000000-0000-4000-8000-000000000001',
      exerciseDefinitionId: exercises[0]!.id,
      title: text('Fondasi squat', 'Squat foundations'),
      summary: text('Bangun kontrol tubuh bagian bawah.', 'Build lower-body control.'),
      order: 1,
      target: { type: 'reps' as const, value: 8 },
      xpReward: 60,
      requirements: { minimumLevel: 1, prerequisiteLessonIds: [], requiredMasteryKeys: [], requiredEquipment: [] },
    },
    squatControl: {
      id: '40000000-0000-4000-8000-000000000002',
      unitId: '30000000-0000-4000-8000-000000000001',
      exerciseDefinitionId: exercises[0]!.id,
      title: text('Kontrol squat', 'Squat control'),
      summary: text('Bergerak stabil melalui rentang penuh.', 'Move steadily through full range.'),
      order: 2,
      target: { type: 'reps' as const, value: 12 },
      xpReward: 80,
      requirements: { minimumLevel: 2, prerequisiteLessonIds: ['40000000-0000-4000-8000-000000000001'], requiredMasteryKeys: ['body_squat'], requiredEquipment: [] },
    },
    pushup: {
      id: '40000000-0000-4000-8000-000000000003',
      unitId: '30000000-0000-4000-8000-000000000002',
      exerciseDefinitionId: exercises[1]!.id,
      title: text('Dorong dengan kuat', 'Push with purpose'),
      summary: text('Pelajari garis tubuh yang aman.', 'Learn a strong, safe body line.'),
      order: 1,
      target: { type: 'reps' as const, value: 6 },
      xpReward: 60,
      requirements: { minimumLevel: 1, prerequisiteLessonIds: [], requiredMasteryKeys: [], requiredEquipment: ['bench_or_wall'] },
    },
    warrior: {
      id: '40000000-0000-4000-8000-000000000004',
      unitId: '30000000-0000-4000-8000-000000000003',
      exerciseDefinitionId: exercises[2]!.id,
      title: text('Warrior yang stabil', 'Steady warrior'),
      summary: text('Buka pinggul dan jaga lengan sejajar.', 'Open the hips and align the arms.'),
      order: 1,
      target: { type: 'seconds' as const, value: 20 },
      xpReward: 60,
      requirements: { minimumLevel: 1, prerequisiteLessonIds: [], requiredMasteryKeys: [], requiredEquipment: [] },
    },
    tree: {
      id: '40000000-0000-4000-8000-000000000005',
      unitId: '30000000-0000-4000-8000-000000000003',
      exerciseDefinitionId: exercises[3]!.id,
      title: text('Fokus seperti pohon', 'Root into focus'),
      summary: text('Latih keseimbangan satu kaki.', 'Train single-leg balance.'),
      order: 2,
      target: { type: 'seconds' as const, value: 20 },
      xpReward: 80,
      requirements: { minimumLevel: 2, prerequisiteLessonIds: ['40000000-0000-4000-8000-000000000004'], requiredMasteryKeys: ['warrior_two'], requiredEquipment: [] },
    },
    mobility: {
      id: '40000000-0000-4000-8000-000000000006',
      unitId: '30000000-0000-4000-8000-000000000004',
      exerciseDefinitionId: exercises[2]!.id,
      title: text('Aliran pemulihan', 'Recovery flow'),
      summary: text('Gerakkan sendi dengan tenang.', 'Restore calm, controlled movement.'),
      order: 1,
      target: { type: 'seconds' as const, value: 30 },
      xpReward: 50,
      requirements: { minimumLevel: 1, prerequisiteLessonIds: [], requiredMasteryKeys: [], requiredEquipment: [] },
    },
  };

  return {
    version: 1,
    publishedAt: '2026-07-16T00:00:00.000Z',
    contentBaseUrl,
    exercises,
    tracks: [
      {
        id: '20000000-0000-4000-8000-000000000001', slug: 'strength', order: 1,
        title: text('Kekuatan', 'Strength'), description: text('Kuasai pola gerak utama.', 'Master essential movement patterns.'),
        courses: [{
          id: '21000000-0000-4000-8000-000000000001', trackId: '20000000-0000-4000-8000-000000000001', slug: 'strength-foundations', order: 1, accent: '#ff5368',
          title: text('Fondasi kuat', 'Strong foundations'), description: text('Squat dan dorong dengan bentuk yang baik.', 'Squat and push with confident form.'),
          units: [
            { id: '30000000-0000-4000-8000-000000000001', courseId: '21000000-0000-4000-8000-000000000001', title: text('Kaki stabil', 'Steady legs'), order: 1, lessons: [lessons.squat, lessons.squatControl] },
            { id: '30000000-0000-4000-8000-000000000002', courseId: '21000000-0000-4000-8000-000000000001', title: text('Tubuh atas', 'Upper body'), order: 2, lessons: [lessons.pushup] },
          ],
        }],
      },
      {
        id: '20000000-0000-4000-8000-000000000002', slug: 'yoga', order: 2,
        title: text('Yoga', 'Yoga'), description: text('Bangun keseimbangan dan fokus.', 'Build balance and focus.'),
        courses: [{
          id: '21000000-0000-4000-8000-000000000002', trackId: '20000000-0000-4000-8000-000000000002', slug: 'yoga-foundations', order: 1, accent: '#a987ff',
          title: text('Aliran dasar', 'Flow foundations'), description: text('Tahan pose dengan kontrol.', 'Hold foundational poses with control.'),
          units: [{ id: '30000000-0000-4000-8000-000000000003', courseId: '21000000-0000-4000-8000-000000000002', title: text('Keseimbangan', 'Balance'), order: 1, lessons: [lessons.warrior, lessons.tree] }],
        }],
      },
      {
        id: '20000000-0000-4000-8000-000000000003', slug: 'mobility', order: 3,
        title: text('Mobilitas', 'Mobility'), description: text('Pulihkan rentang gerak.', 'Restore range and control.'),
        courses: [{
          id: '21000000-0000-4000-8000-000000000003', trackId: '20000000-0000-4000-8000-000000000003', slug: 'mobility-reset', order: 1, accent: '#68dcb5',
          title: text('Reset harian', 'Daily reset'), description: text('Sesi singkat untuk hari pemulihan.', 'Short sessions for recovery days.'),
          units: [{ id: '30000000-0000-4000-8000-000000000004', courseId: '21000000-0000-4000-8000-000000000003', title: text('Mulai bergerak', 'Move again'), order: 1, lessons: [lessons.mobility] }],
        }],
      },
    ],
  };
}
