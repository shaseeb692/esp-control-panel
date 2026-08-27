export function navigateWithTransition(
  navigate: () => void
) {
  if (
    typeof document !== "undefined" &&
    "startViewTransition" in document
  ) {
    (
      document as Document & {
        startViewTransition: (
          callback: () => void
        ) => void;
      }
    ).startViewTransition(() => {
      navigate();
    });
  } else {
    navigate();
  }
}