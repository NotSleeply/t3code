import type { ChangeRequestTerminology } from "@t3tools/client-runtime/source-control-clients";
import { t } from "~/i18n";

export function offHeadPullRequestCheckoutToast(terminology: ChangeRequestTerminology) {
  return {
    type: "warning",
    title: t("Checked out, but not confirmed on the latest commit"),
    description: `This checkout could not be confirmed at the ${terminology.singular}'s latest commit, so its code may differ. Local commits or uncommitted work keep a checkout where it is.`,
  } as const;
}
