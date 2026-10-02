import * as Haptics from 'expo-haptics';

/** A light tick on every key (S2-07). Fire and forget: a phone without a motor just skips it. */
export function keyTap(): void {
  Haptics.selectionAsync().catch(() => undefined);
}

/** A thump when the rival hits you. */
export function hitFeedback(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

/** The battle is over: success on a win, a warning buzz otherwise. */
export function endFeedback(won: boolean): void {
  Haptics.notificationAsync(
    won ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
  ).catch(() => undefined);
}
