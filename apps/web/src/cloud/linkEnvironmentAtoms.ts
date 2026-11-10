import {
  createAtomCommandScheduler,
  createRuntimeCommand,
} from "@t3tools/client-runtime/state/runtime";

import { connectionAtomRuntime } from "../connection/runtime";
import {
  checkCloudReachability,
  linkEnvironmentToCloud,
  readCloudLinkState,
  type CloudLinkMode,
  type CloudLinkTarget,
  unlinkEnvironmentFromCloud,
  updateCloudPreferences,
} from "./linkEnvironment";
import { t } from "~/i18n";

const cloudLinkScheduler = createAtomCommandScheduler();
const cloudLinkConcurrency = {
  mode: "serial" as const,
  key: (input: { readonly target: CloudLinkTarget }) => input.target.environmentId,
};

export const linkEnvironment = createRuntimeCommand(connectionAtomRuntime, {
  label: t("web:cloud:link-environment"),
  scheduler: cloudLinkScheduler,
  concurrency: cloudLinkConcurrency,
  execute: (input: {
    readonly target: CloudLinkTarget;
    readonly clerkToken: string;
    readonly mode?: CloudLinkMode;
  }) => linkEnvironmentToCloud(input),
});

export const unlinkEnvironment = createRuntimeCommand(connectionAtomRuntime, {
  label: t("web:cloud:unlink-environment"),
  scheduler: cloudLinkScheduler,
  concurrency: cloudLinkConcurrency,
  execute: (input: { readonly target: CloudLinkTarget; readonly clerkToken: string | null }) =>
    unlinkEnvironmentFromCloud(input),
});

export const updateEnvironmentPreferences = createRuntimeCommand(connectionAtomRuntime, {
  label: t("web:cloud:update-environment-preferences"),
  scheduler: cloudLinkScheduler,
  concurrency: cloudLinkConcurrency,
  execute: (input: {
    readonly target: CloudLinkTarget;
    readonly publishAgentActivity: boolean;
    readonly holdWebhooksWhileOffline?: boolean;
  }) => updateCloudPreferences(input),
});

export const checkReachability = createRuntimeCommand(connectionAtomRuntime, {
  label: t("web:cloud:check-reachability"),
  execute: (input: { readonly target: CloudLinkTarget }) => checkCloudReachability(input),
});

export const readLinkState = createRuntimeCommand(connectionAtomRuntime, {
  label: t("web:cloud:read-link-state"),
  execute: (input: { readonly target: CloudLinkTarget }) => readCloudLinkState(input),
});
