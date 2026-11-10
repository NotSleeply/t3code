import type { PullRequestInvolvement, PullRequestListState } from "@t3tools/contracts";
import {
  CalendarArrowDownIcon,
  CalendarArrowUpIcon,
  ClockIcon,
  EyeIcon,
  LayersIcon,
  ListChecksIcon,
  Maximize2Icon,
  Minimize2Icon,
  PenLineIcon,
  UserLockIcon,
} from "lucide-react";

import type { PullRequestFilterOption } from "./PullRequestListFilters";
import type { PullRequestListSort } from "./pullRequestListPreferences";
import { PullRequestGlyph } from "./pullRequestIcons";
import { t } from "~/i18n";

export const INVOLVEMENT_TABS = [
  { value: "all", label: t("All"), Icon: LayersIcon },
  { value: "reviewing", label: t("Reviewing"), Icon: EyeIcon },
  { value: "authored", label: t("Authored"), Icon: PenLineIcon },
] as const satisfies ReadonlyArray<PullRequestFilterOption<PullRequestInvolvement>>;

export const STATE_TABS = [
  { value: "all", label: t("All"), Icon: LayersIcon },
  { value: "open", label: t("Open"), Icon: PullRequestGlyph.pullRequest },
  { value: "closed", label: t("Closed"), Icon: PullRequestGlyph.closed },
  { value: "merged", label: t("Merged"), Icon: PullRequestGlyph.merged },
] as const satisfies ReadonlyArray<PullRequestFilterOption<PullRequestListState>>;

export const SORT_OPTIONS = [
  { value: "ready", label: t("Merge readiness"), Icon: ListChecksIcon },
  { value: "blocked", label: t("Blocked on me"), Icon: UserLockIcon },
  { value: "updated", label: t("Recently updated"), Icon: ClockIcon },
  { value: "newest", label: t("Newest shown"), Icon: CalendarArrowDownIcon },
  { value: "oldest", label: t("Oldest shown"), Icon: CalendarArrowUpIcon },
  { value: "largest", label: t("Largest shown"), Icon: Maximize2Icon },
  { value: "smallest", label: t("Smallest shown"), Icon: Minimize2Icon },
] as const satisfies ReadonlyArray<PullRequestFilterOption<PullRequestListSort>>;
