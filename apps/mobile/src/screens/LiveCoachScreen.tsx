import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { resolveCopy, courseCopy } from '../course/localization';
import { colors, radius, spacing, type } from '../design/tokens';
import {
  isNativePoseCameraAvailable,
  PoseCameraView,
} from '../native/PoseCameraView';
import { PoseEngineEvent } from '../native/poseEngine';
import { requestCameraPermission } from '../native/requestCameraPermission';
import {
  createLiveCoachSessionSummary,
  isPostureScoringSupported,
  LiveCoachFeedback,
  LiveCoachPainState,
  LiveCoachSessionSummary,
  LiveCoachTargetType,
  MINIMUM_SCORING_CONFIDENCE,
} from '../native/sessionSummary';

export type {
  LiveCoachPainState,
  LiveCoachSessionSummary,
  LiveCoachTargetType,
} from '../native/sessionSummary';
export { applyPainAssessment } from '../native/sessionSummary';

export type LiveCoachScreenProps = Readonly<{
  sessionId: string;
  exerciseKey: string;
  targetType: LiveCoachTargetType;
  /** Repetition count for `repetitions`, milliseconds for `duration_ms`. */
  targetValue: number;
  painState?: LiveCoachPainState;
  onComplete: (summary: LiveCoachSessionSummary) => void;
  onStop: (summary: LiveCoachSessionSummary) => void;
}>;

export function LiveCoachScreen({
  sessionId,
  exerciseKey,
  targetType,
  targetValue,
  painState = 'not_assessed',
  onComplete,
  onStop,
}: LiveCoachScreenProps) {
  const postureScored =
    isNativePoseCameraAvailable && isPostureScoringSupported(exerciseKey);
  const holdTarget = targetType === 'duration_ms';
  const initialFeedback = postureScored
    ? 'Mundur perlahan hingga kepala, tangan, dan kedua kaki terlihat (jarak awal 2–3 m).'
    : isNativePoseCameraAvailable
    ? holdTarget
      ? 'Latihan tahan terpandu aktif. Jaga posisi selama target; skor form belum tersedia.'
      : 'Latihan repetisi terpandu aktif. Ikuti petunjuk dan konfirmasi progresmu sendiri; skor form belum tersedia.'
    : 'Pratinjau terpandu tanpa analisis kamera. Tidak ada skor form atau progres penguasaan.';
  const insets = useSafeAreaInsets();
  const [paused, setPaused] = useState(painState === 'reported');
  const [confidence, setConfidence] = useState<'good' | 'low' | 'unavailable'>(
    isNativePoseCameraAvailable ? 'low' : 'unavailable',
  );
  const [reps, setReps] = useState(0);
  const [phase, setPhase] = useState(
    postureScored
      ? 'MENUNGGU TRACKING'
      : holdTarget
      ? 'TAHAN POSISI SESUAI PETUNJUK'
      : 'LATIHAN REPETISI TERPANDU',
  );
  const [feedback, setFeedback] = useState(initialFeedback);
  const [elapsedTimeMs, setElapsedTimeMs] = useState(0);
  const [trackedDurationMs, setTrackedDurationMs] = useState(0);
  const [safetyStopped, setSafetyStopped] = useState(false);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(
    !isNativePoseCameraAvailable,
  );

  const startedAtMs = useRef(Date.now());
  const pausedRef = useRef(paused);
  const confidenceRef = useRef(confidence);
  const repsRef = useRef(0);
  const elapsedBeforeCurrentSegmentMs = useRef(0);
  const activeSegmentStartedAtMs = useRef<number | null>(
    paused ? null : Date.now(),
  );
  const trackedBeforeCurrentSegmentMs = useRef(0);
  const trackedSegmentStartedAtMs = useRef<number | null>(null);
  const nativeValidHoldDurationMs = useRef(0);
  const trackingStats = useRef({ total: 0, samples: 0, eligibleSamples: 0 });
  const eligibleFormScores = useRef<number[]>([]);
  const feedbackHistory = useRef<LiveCoachFeedback[]>([
    { message: initialFeedback, severity: 'info' },
  ]);

  const readElapsedTime = useCallback((now: number) => {
    const segmentStart = activeSegmentStartedAtMs.current;
    return (
      elapsedBeforeCurrentSegmentMs.current +
      (segmentStart === null ? 0 : now - segmentStart)
    );
  }, []);

  const readTrackedDuration = useCallback((now: number) => {
    const segmentStart = trackedSegmentStartedAtMs.current;
    return (
      trackedBeforeCurrentSegmentMs.current +
      (segmentStart === null ? 0 : now - segmentStart)
    );
  }, []);

  const closeActiveSegments = useCallback(
    (now: number) => {
      elapsedBeforeCurrentSegmentMs.current = readElapsedTime(now);
      activeSegmentStartedAtMs.current = null;
      trackedBeforeCurrentSegmentMs.current = readTrackedDuration(now);
      trackedSegmentStartedAtMs.current = null;
    },
    [readElapsedTime, readTrackedDuration],
  );

  const addFeedback = useCallback((entry: LiveCoachFeedback) => {
    setFeedback(entry.message);
    const entries = feedbackHistory.current;
    const previous = entries[entries.length - 1];
    if (
      previous?.message !== entry.message ||
      previous.severity !== entry.severity
    ) {
      feedbackHistory.current = [...entries, entry].slice(-12);
    }
  }, []);

  useEffect(() => {
    if (!isNativePoseCameraAvailable) return;

    let active = true;
    requestCameraPermission()
      .then(granted => {
        if (!active) return;
        setCameraPermissionGranted(granted);
        if (!granted) {
          confidenceRef.current = 'low';
          setConfidence('low');
          addFeedback({
            message:
              'Izin kamera belum diberikan. Izinkan kamera lalu buka kembali sesi coaching.',
            severity: 'caution',
          });
        }
      })
      .catch(() => {
        if (!active) return;
        setCameraPermissionGranted(false);
        addFeedback({
          message:
            'Izin kamera tidak dapat diminta. Periksa izin PocketTrainer di Pengaturan Android.',
          severity: 'caution',
        });
      });

    return () => {
      active = false;
    };
  }, [addFeedback]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setElapsedTimeMs(readElapsedTime(now));
      setTrackedDurationMs(readTrackedDuration(now));
    }, 250);
    return () => clearInterval(timer);
  }, [readElapsedTime, readTrackedDuration]);

  useEffect(() => {
    if (painState !== 'reported' || pausedRef.current) return;
    closeActiveSegments(Date.now());
    pausedRef.current = true;
    setPaused(true);
    addFeedback({
      message:
        'Sesi dihentikan karena nyeri dilaporkan. Progresi dinonaktifkan.',
      severity: 'stop',
    });
  }, [addFeedback, closeActiveSegments, painState]);

  const onPoseEvent = useCallback(
    (event: PoseEngineEvent) => {
      if (event.type === 'tracking_status') {
        trackingStats.current.total += event.confidence;
        trackingStats.current.samples += 1;
        const eligible =
          event.visible && event.confidence >= MINIMUM_SCORING_CONFIDENCE;
        if (eligible) trackingStats.current.eligibleSamples += 1;
        const nextConfidence = eligible ? 'good' : 'low';
        confidenceRef.current = nextConfidence;
        setConfidence(nextConfidence);

        const now = Date.now();
        if (eligible && !pausedRef.current) {
          if (trackedSegmentStartedAtMs.current === null) {
            trackedSegmentStartedAtMs.current = now;
          }
        } else if (trackedSegmentStartedAtMs.current !== null) {
          trackedBeforeCurrentSegmentMs.current = readTrackedDuration(now);
          trackedSegmentStartedAtMs.current = null;
        }
        return;
      }

      if (event.type === 'movement_update' && postureScored) {
        if (event.validRepCount !== undefined) {
          repsRef.current = Math.max(repsRef.current, event.validRepCount);
          setReps(repsRef.current);
        }
        if (event.validHoldDurationMs !== undefined) {
          nativeValidHoldDurationMs.current = Math.max(
            nativeValidHoldDurationMs.current,
            event.validHoldDurationMs,
          );
          setTrackedDurationMs(current =>
            Math.max(current, nativeValidHoldDurationMs.current),
          );
        }
        if (
          confidenceRef.current === 'good' &&
          event.formScore !== null &&
          event.formScore !== undefined
        ) {
          eligibleFormScores.current.push(event.formScore);
        }
        setPhase(
          event.phase === 'bottom'
            ? 'POSISI BAWAH'
            : event.phase === 'standing'
            ? 'BERDIRI STABIL'
            : 'BERGERAK TERKONTROL',
        );
        return;
      }

      if (
        event.type === 'rep_complete' &&
        postureScored &&
        event.confidence >= MINIMUM_SCORING_CONFIDENCE &&
        event.formScore !== null
      ) {
        repsRef.current = Math.max(repsRef.current, event.rep);
        setReps(repsRef.current);
        eligibleFormScores.current.push(event.formScore);
        return;
      }

      if (event.type === 'feedback_changed') {
        addFeedback({ message: event.message, severity: event.severity });
        if (event.severity === 'stop') {
          closeActiveSegments(Date.now());
          pausedRef.current = true;
          setPaused(true);
          setSafetyStopped(true);
        }
        return;
      }

      if (event.type === 'recoverable_error') {
        const now = Date.now();
        confidenceRef.current = 'low';
        setConfidence('low');
        trackedBeforeCurrentSegmentMs.current = readTrackedDuration(now);
        trackedSegmentStartedAtMs.current = null;
        addFeedback({ message: event.message, severity: 'caution' });
      }
    },
    [addFeedback, closeActiveSegments, postureScored, readTrackedDuration],
  );

  const durationProgressMs = isNativePoseCameraAvailable
    ? Math.max(trackedDurationMs, nativeValidHoldDurationMs.current)
    : elapsedTimeMs;
  const validTarget = Number.isFinite(targetValue) && targetValue > 0;
  const targetMet =
    validTarget &&
    (targetType === 'repetitions'
      ? reps >= targetValue
      : durationProgressMs >= targetValue);
  const completionDisabled =
    !targetMet ||
    paused ||
    safetyStopped ||
    painState === 'reported' ||
    (postureScored && confidence !== 'good');

  const togglePaused = useCallback(() => {
    const now = Date.now();
    if (pausedRef.current) {
      if (painState === 'reported' || safetyStopped) return;
      pausedRef.current = false;
      activeSegmentStartedAtMs.current = now;
      if (confidenceRef.current === 'good') {
        trackedSegmentStartedAtMs.current = now;
      }
      setPaused(false);
      return;
    }

    closeActiveSegments(now);
    pausedRef.current = true;
    setPaused(true);
  }, [closeActiveSegments, painState, safetyStopped]);

  const confirmGuidedRep = useCallback(() => {
    if (
      postureScored ||
      targetType !== 'repetitions' ||
      pausedRef.current ||
      safetyStopped ||
      painState === 'reported' ||
      (isNativePoseCameraAvailable && confidenceRef.current !== 'good')
    ) {
      return;
    }
    repsRef.current = Math.min(repsRef.current + 1, targetValue);
    setReps(repsRef.current);
  }, [painState, postureScored, safetyStopped, targetType, targetValue]);

  const buildSummary = useCallback(
    (requestedStopReason: 'completed' | 'user_stopped') => {
      const completedAtMs = Date.now();
      const activeDurationMs = isNativePoseCameraAvailable
        ? Math.max(
            readTrackedDuration(completedAtMs),
            nativeValidHoldDurationMs.current,
          )
        : readElapsedTime(completedAtMs);
      return createLiveCoachSessionSummary({
        sessionId,
        exerciseKey,
        startedAtMs: startedAtMs.current,
        completedAtMs,
        elapsedTimeMs: readElapsedTime(completedAtMs),
        targetType,
        targetValue,
        repetitionCount: repsRef.current,
        activeDurationMs,
        nativeCameraAvailable: isNativePoseCameraAvailable,
        trackingConfidenceTotal: trackingStats.current.total,
        trackingSampleCount: trackingStats.current.samples,
        eligibleTrackingSampleCount: trackingStats.current.eligibleSamples,
        eligibleFormScores: eligibleFormScores.current,
        painState,
        safetyStopped,
        requestedStopReason,
        feedback: feedbackHistory.current,
      });
    },
    [
      exerciseKey,
      painState,
      readElapsedTime,
      readTrackedDuration,
      safetyStopped,
      sessionId,
      targetType,
      targetValue,
    ],
  );

  const completeSession = useCallback(() => {
    if (!completionDisabled) onComplete(buildSummary('completed'));
  }, [buildSummary, completionDisabled, onComplete]);

  const stopSession = useCallback(() => {
    onStop(buildSummary('user_stopped'));
  }, [buildSummary, onStop]);

  const progressValue =
    targetType === 'repetitions'
      ? String(reps).padStart(2, '0')
      : formatClock(durationProgressMs);
  const progressTarget =
    targetType === 'repetitions'
      ? String(targetValue).padStart(2, '0')
      : formatClock(targetValue);
  const guidedRepDisabled =
    paused ||
    targetMet ||
    safetyStopped ||
    painState === 'reported' ||
    (isNativePoseCameraAvailable && confidence !== 'good');

  return (
    <View style={styles.screen}>
      <View style={styles.camera}>
        {isNativePoseCameraAvailable && cameraPermissionGranted ? (
          <PoseCameraView
            exerciseKey={exerciseKey}
            onPoseEvent={onPoseEvent}
            paused={paused || safetyStopped || painState === 'reported'}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={styles.topBar}>
          <View
            style={[
              styles.confidence,
              confidence !== 'good' && styles.confidenceLow,
            ]}
          >
            <View
              style={[
                styles.confidenceDot,
                confidence !== 'good' && styles.dotLow,
              ]}
            />
            <View>
              <Text style={styles.confidenceTitle}>
                {paused
                  ? 'SESI DIJEDA'
                  : confidence === 'good'
                  ? 'TRACKING STABIL'
                  : confidence === 'unavailable'
                  ? 'PRATINJAU TERPANDU'
                  : 'BELUM BISA MENILAI'}
              </Text>
              <Text style={styles.confidenceSub}>
                {paused
                  ? 'Pemrosesan kamera berhenti'
                  : confidence === 'good'
                  ? 'Seluruh tubuh terlihat'
                  : confidence === 'unavailable'
                  ? 'Tanpa analisis atau skor form'
                  : 'Skor dijeda · mundur sedikit'}
              </Text>
              {Platform.OS === 'web' ? (
                <Text style={styles.mockLabel}>PRATINJAU WEB</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.timer}>
            <Icon color={colors.secondary} name="clock" size={17} />
            <Text style={styles.timerText}>{formatClock(elapsedTimeMs)}</Text>
          </View>
        </View>
        {!postureScored ? (
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>
              {resolveCopy(
                holdTarget
                  ? courseCopy.coaching.guidedHold
                  : courseCopy.coaching.guidedRepetition,
              ).toUpperCase()}{' '}
              · TANPA SKOR FORM
            </Text>
          </View>
        ) : null}
        {!isNativePoseCameraAvailable ? (
          <PreviewSkeleton confidence={confidence} />
        ) : null}
        {paused ? (
          <View style={styles.pauseOverlay}>
            <View style={styles.pauseCircle}>
              <Icon color={colors.canvas} name="pause" size={28} />
            </View>
            <Text style={styles.pauseTitle}>Sesi dijeda</Text>
            <Text style={styles.pauseBody}>Ambil napas. Progresmu aman.</Text>
          </View>
        ) : null}
        <View style={styles.feedback}>
          <View style={styles.feedbackIcon}>
            <Icon
              color={
                safetyStopped || painState === 'reported'
                  ? colors.danger
                  : confidence === 'good'
                  ? colors.mint
                  : colors.amber
              }
              name={postureScored && confidence === 'good' ? 'spark' : 'camera'}
              size={22}
            />
          </View>
          <View style={styles.feedbackCopy}>
            <Text style={styles.feedbackLabel}>
              {safetyStopped || painState === 'reported'
                ? 'SESI DIHENTIKAN AMAN'
                : !postureScored
                ? 'LATIHAN TERPANDU'
                : confidence === 'good'
                ? 'SATU KOREKSI'
                : 'TRACKING DIJEDA'}
            </Text>
            <Text style={styles.feedbackText}>
              {postureScored &&
              confidence === 'good' &&
              feedback ===
                'Mundur perlahan hingga kepala, tangan, dan kedua kaki terlihat (jarak awal 2–3 m).'
                ? 'Tubuh terdeteksi. Mulai saat siap.'
                : feedback}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.repPanel}>
        <View>
          <Text style={styles.repLabel}>
            {targetType === 'duration_ms'
              ? 'DURASI TAHAN AKTIF'
              : postureScored
              ? 'REPETISI TERDETEKSI'
              : 'REPETISI DIKONFIRMASI'}
          </Text>
          <Text style={styles.repValue}>
            {progressValue}{' '}
            <Text style={styles.repTotal}>/ {progressTarget}</Text>
          </Text>
        </View>
        <View style={styles.phase}>
          <View
            style={[
              styles.phaseDot,
              (confidence !== 'good' || paused) && styles.phaseDotLow,
            ]}
          />
          <Text style={styles.phaseText}>
            {paused
              ? 'PEMROSESAN DIJEDA'
              : postureScored
              ? confidence === 'good'
                ? phase
                : 'MENUNGGU TRACKING'
              : targetMet
              ? holdTarget
                ? resolveCopy(courseCopy.coaching.holdTarget).toUpperCase()
                : 'TARGET TERPENUHI'
              : holdTarget
              ? 'TAHAN POSISI SESUAI PETUNJUK'
              : 'NILAI PROGRESMU SENDIRI'}
          </Text>
        </View>
      </View>
      {!postureScored && targetType === 'repetitions' ? (
        <Pressable
          accessibilityLabel="Konfirmasi satu repetisi terpandu"
          accessibilityState={{ disabled: guidedRepDisabled }}
          disabled={guidedRepDisabled}
          onPress={confirmGuidedRep}
          style={[
            styles.guidedRepControl,
            guidedRepDisabled && styles.guidedRepControlDisabled,
          ]}
        >
          <Icon
            color={guidedRepDisabled ? colors.muted : colors.text}
            name="check"
            size={18}
          />
          <Text
            style={[
              styles.guidedRepText,
              guidedRepDisabled && styles.guidedRepTextDisabled,
            ]}
          >
            {targetMet ? 'Target terpenuhi' : 'Konfirmasi 1 repetisi selesai'}
          </Text>
        </Pressable>
      ) : null}
      <View
        style={[
          styles.controls,
          { paddingBottom: Math.max(insets.bottom, spacing.sm) },
        ]}
      >
        <Pressable
          accessibilityLabel={paused ? 'Lanjutkan' : 'Jeda'}
          accessibilityState={{
            disabled: painState === 'reported' || safetyStopped,
          }}
          disabled={painState === 'reported' || safetyStopped}
          onPress={togglePaused}
          style={styles.control}
        >
          <Icon name={paused ? 'play' : 'pause'} />
          <Text style={styles.controlText}>{paused ? 'Lanjut' : 'Jeda'}</Text>
        </Pressable>
        <View style={styles.mainAction}>
          <Pressable
            accessibilityLabel="Selesaikan set"
            accessibilityState={{ disabled: completionDisabled }}
            disabled={completionDisabled}
            onPress={completeSession}
            style={[
              styles.mainControl,
              completionDisabled && styles.mainControlDisabled,
            ]}
          >
            <Icon
              color={completionDisabled ? colors.muted : colors.canvas}
              name="check"
              size={25}
            />
          </Pressable>
          <Text
            style={[
              styles.mainControlLabel,
              completionDisabled && styles.mainControlLabelDisabled,
            ]}
          >
            {targetMet ? 'Selesaikan set' : 'Penuhi target'}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Hentikan sesi"
          onPress={stopSession}
          style={styles.stopControl}
        >
          <Icon color={colors.danger} name="stop" />
          <Text style={styles.stopText}>Stop</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PreviewSkeleton({
  confidence,
}: {
  confidence: 'good' | 'low' | 'unavailable';
}) {
  const primaryColor = confidence === 'good' ? colors.coral : colors.amber;
  const secondaryColor = confidence === 'good' ? colors.mint : colors.muted;
  return (
    <View style={styles.skeletonWrap}>
      <Svg height="100%" viewBox="0 0 240 400" width="100%">
        <Circle
          cx="120"
          cy="52"
          fill="none"
          r="25"
          stroke={primaryColor}
          strokeWidth="5"
        />
        <Line
          x1="120"
          y1="77"
          x2="118"
          y2="190"
          stroke={primaryColor}
          strokeWidth="5"
        />
        <Line
          x1="118"
          y1="105"
          x2="62"
          y2="150"
          stroke={primaryColor}
          strokeWidth="5"
        />
        <Line
          x1="118"
          y1="105"
          x2="176"
          y2="142"
          stroke={primaryColor}
          strokeWidth="5"
        />
        <Line
          x1="118"
          y1="190"
          x2="75"
          y2="270"
          stroke={secondaryColor}
          strokeWidth="5"
        />
        <Line
          x1="75"
          y1="270"
          x2="48"
          y2="360"
          stroke={secondaryColor}
          strokeWidth="5"
        />
        <Line
          x1="118"
          y1="190"
          x2="170"
          y2="272"
          stroke={secondaryColor}
          strokeWidth="5"
        />
        <Line
          x1="170"
          y1="272"
          x2="196"
          y2="360"
          stroke={secondaryColor}
          strokeWidth="5"
        />
        {[
          [120, 77],
          [118, 105],
          [62, 150],
          [176, 142],
          [118, 190],
          [75, 270],
          [48, 360],
          [170, 272],
          [196, 360],
        ].map(([x, y], index) => (
          <Circle cx={x} cy={y} fill={colors.text} key={index} r="7" />
        ))}
      </Svg>
    </View>
  );
}

function formatClock(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}`;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.canvas, flex: 1 },
  camera: { backgroundColor: '#171414', flex: 1, overflow: 'hidden' },
  topBar: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 3,
  },
  confidence: {
    alignItems: 'center',
    backgroundColor: 'rgba(13,11,11,.82)',
    borderColor: 'rgba(102,221,177,.4)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  confidenceLow: { borderColor: 'rgba(255,180,84,.55)' },
  confidenceDot: {
    backgroundColor: colors.mint,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  dotLow: { backgroundColor: colors.amber },
  confidenceTitle: {
    ...type.micro,
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  confidenceSub: {
    ...type.micro,
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 16,
  },
  mockLabel: {
    ...type.micro,
    color: colors.amber,
    fontSize: 10,
    lineHeight: 13,
  },
  timer: {
    alignItems: 'center',
    backgroundColor: 'rgba(13,11,11,.82)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
  },
  timerText: {
    ...type.micro,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    fontSize: 12,
  },
  modeBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(13,11,11,.88)',
    borderColor: 'rgba(255,180,84,.55)',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    position: 'absolute',
    top: 86,
    zIndex: 1,
  },
  modeBadgeText: {
    ...type.micro,
    color: colors.amber,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  skeletonWrap: {
    alignSelf: 'center',
    height: '74%',
    marginTop: 65,
    width: '70%',
  },
  feedback: {
    alignItems: 'center',
    backgroundColor: 'rgba(13,11,11,.88)',
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    bottom: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    left: spacing.md,
    padding: spacing.sm,
    position: 'absolute',
    right: spacing.md,
  },
  feedbackIcon: {
    alignItems: 'center',
    backgroundColor: colors.raised,
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  feedbackCopy: { flex: 1 },
  feedbackLabel: {
    ...type.micro,
    color: colors.coral,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.7,
  },
  feedbackText: {
    ...type.support,
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    marginTop: 2,
  },
  pauseOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(13,11,11,.8)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  pauseCircle: {
    alignItems: 'center',
    backgroundColor: colors.text,
    borderRadius: 30,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  pauseTitle: { ...type.section, color: colors.text, marginTop: spacing.md },
  pauseBody: {
    ...type.support,
    color: colors.secondary,
    marginTop: spacing.xs,
  },
  repPanel: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  repLabel: { ...type.micro, color: colors.secondary, letterSpacing: 0.8 },
  repValue: {
    fontFamily: type.display.fontFamily,
    fontSize: 34,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  repTotal: { fontSize: 18, color: colors.muted },
  phase: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  phaseDot: {
    backgroundColor: colors.mint,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  phaseDotLow: { backgroundColor: colors.amber },
  phaseText: {
    ...type.micro,
    color: colors.secondary,
    fontSize: 12,
    lineHeight: 16,
    maxWidth: 170,
    textAlign: 'right',
  },
  guidedRepControl: {
    alignItems: 'center',
    backgroundColor: colors.raised,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  guidedRepControlDisabled: { opacity: 0.55 },
  guidedRepText: { ...type.support, color: colors.text },
  guidedRepTextDisabled: { color: colors.muted },
  controls: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  control: { alignItems: 'center', gap: 2, minHeight: 52, minWidth: 72 },
  controlText: { ...type.micro, color: colors.secondary },
  mainControl: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 72,
  },
  mainAction: { alignItems: 'center', gap: 3, minWidth: 104 },
  mainControlDisabled: { backgroundColor: colors.raised },
  mainControlLabel: {
    ...type.micro,
    color: colors.text,
    fontSize: 11,
    lineHeight: 14,
  },
  mainControlLabelDisabled: { color: colors.muted },
  stopControl: {
    alignItems: 'center',
    borderColor: 'rgba(255,91,82,.45)',
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
    minHeight: 52,
    minWidth: 72,
    paddingTop: 5,
  },
  stopText: { ...type.micro, color: colors.danger },
});
