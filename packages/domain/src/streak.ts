import type { StreakDayStatus, StreakDayType } from "@pockettrainer/contracts";

export type StreakDayInput = Readonly<{
  dayType: StreakDayType;
  scheduled: boolean;
  qualifyingActivityCompleted: boolean;
}>;

export function evaluateStreakDay(input: StreakDayInput): StreakDayStatus {
  if (input.qualifyingActivityCompleted) {
    return "COMPLETED";
  }
  if (input.scheduled && input.dayType === "RECOVERY") {
    return "PROTECTED";
  }
  return "MISSED";
}
