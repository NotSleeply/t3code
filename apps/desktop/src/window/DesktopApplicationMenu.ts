import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import * as Electron from "electron";

import { makeComponentLogger } from "../app/DesktopObservability.ts";
import * as ElectronApp from "../electron/ElectronApp.ts";
import * as ElectronDialog from "../electron/ElectronDialog.ts";
import * as ElectronMenu from "../electron/ElectronMenu.ts";
import * as DesktopEnvironment from "../app/DesktopEnvironment.ts";
import * as DesktopUpdates from "../updates/DesktopUpdates.ts";
import * as DesktopWindow from "./DesktopWindow.ts";
import { menuLabel, menuLocaleFor, type MenuLocale } from "./DesktopMenuLabels.ts";

export class DesktopApplicationMenuActionError extends Schema.TaggedError<DesktopApplicationMenuActionError>()(
  "DesktopApplicationMenuActionError",
  {
    action: Schema.String,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Desktop menu action "${this.action}" failed.`;
  }
}

export class DesktopApplicationMenu extends Context.Service<
  DesktopApplicationMenu,
  {
    readonly configure: Effect.Effect<void>;
  }
>()("@t3tools/desktop/window/DesktopApplicationMenu") {}

type DesktopApplicationMenuRuntimeServices =
  | DesktopUpdates.DesktopUpdates
  | DesktopWindow.DesktopWindow
  | ElectronDialog.ElectronDialog;

const { logInfo: logUpdaterInfo } = makeComponentLogger("desktop-updater");

const { logError: logMenuError } = makeComponentLogger("desktop-menu");

const dispatchMenuAction = Effect.fn("desktop.menu.dispatchMenuAction")(function* (
  action: string,
): Effect.fn.Return<void, DesktopWindow.DesktopWindowError, DesktopWindow.DesktopWindow> {
  const desktopWindow = yield* DesktopWindow.DesktopWindow;
  yield* desktopWindow.dispatchMenuAction(action, {
    reveal: action !== "paste-as-text",
  });
});

const zoomMainWindow = Effect.fn("desktop.menu.zoomMainWindow")(function* (
  direction: DesktopWindow.MainWindowZoomDirection,
): Effect.fn.Return<void, never, DesktopWindow.DesktopWindow> {
  const desktopWindow = yield* DesktopWindow.DesktopWindow;
  yield* desktopWindow.zoomMain(direction);
});

const runMainContentsCommand = Effect.fn("desktop.menu.runMainContentsCommand")(function* (
  command: DesktopWindow.MainWindowContentsCommand,
): Effect.fn.Return<void, never, DesktopWindow.DesktopWindow> {
  const desktopWindow = yield* DesktopWindow.DesktopWindow;
  yield* desktopWindow.runMainContentsCommand(command);
});

const checkForUpdatesFromMenu = Effect.fn("desktop.menu.checkForUpdates")(function* (
  locale: MenuLocale,
) {
  const updates = yield* DesktopUpdates.DesktopUpdates;
  const electronDialog = yield* ElectronDialog.ElectronDialog;
  const m = (template: string, ...values: string[]) => menuLabel(locale, template, values);
  const result = yield* updates.check("menu");
  const updateState = result.state;

  if (updateState.status === "up-to-date") {
    yield* electronDialog.showMessageBox({
      type: "info",
      title: m("You're up to date!"),
      message: m(
        "T3 Code {0} is currently the newest version available.",
        updateState.currentVersion,
      ),
      buttons: [m("OK")],
    });
  } else if (updateState.status === "error") {
    yield* electronDialog.showMessageBox({
      type: "warning",
      title: m("Update check failed"),
      message: m("Could not check for updates."),
      detail: updateState.message ?? m("An unknown error occurred. Please try again later."),
      buttons: [m("OK")],
    });
  }
});

const handleCheckForUpdatesMenuClick = Effect.fn("desktop.menu.handleCheckForUpdatesClick")(
  function* (locale: MenuLocale) {
    const updates = yield* DesktopUpdates.DesktopUpdates;
    const electronDialog = yield* ElectronDialog.ElectronDialog;
    const m = (template: string, ...values: string[]) => menuLabel(locale, template, values);
    const disabledReason = yield* updates.disabledReason;
    if (Option.isSome(disabledReason)) {
      yield* logUpdaterInfo("manual update check requested, but updates are disabled", {
        disabledReason: disabledReason.value,
      });
      yield* electronDialog.showMessageBox({
        type: "info",
        title: m("Updates unavailable"),
        message: m("Automatic updates are not available right now."),
        detail: disabledReason.value,
        buttons: [m("OK")],
      });
      return;
    }

    // Opening a window before backend confirmation can strand it on failed auth bootstrap.
    const desktopWindow = yield* DesktopWindow.DesktopWindow;
    yield* desktopWindow.activate;
    yield* checkForUpdatesFromMenu(locale);
  },
);

/** @public */
export const make = Effect.gen(function* () {
  const electronMenu = yield* ElectronMenu.ElectronMenu;
  const environment = yield* DesktopEnvironment.DesktopEnvironment;
  const electronApp = yield* ElectronApp.ElectronApp;
  const menuLocale = menuLocaleFor(yield* electronApp.systemLocale);
  const context = yield* Effect.context<DesktopApplicationMenuRuntimeServices>();
  const runPromise = Effect.runPromiseWith(context);

  const runMenuEffect = <E>(
    action: string,
    effect: Effect.Effect<void, E, DesktopApplicationMenuRuntimeServices>,
  ) => {
    void runPromise(
      effect.pipe(
        Effect.annotateLogs({ action }),
        Effect.withSpan("desktop.menu.action"),
        Effect.catchCause((cause) => {
          const error = new DesktopApplicationMenuActionError({ action, cause });
          return logMenuError(error.message, { error });
        }),
      ),
    );
  };

  const configure = Effect.gen(function* () {
    const checkForUpdatesClick = () => {
      runMenuEffect("check-for-updates", handleCheckForUpdatesMenuClick(menuLocale));
    };
    const settingsClick = () => {
      runMenuEffect("open-settings", dispatchMenuAction("open-settings"));
    };
    // Chromium and the renderer already handle this chord; injecting another paste duplicates text.
    const pasteAsTextClick = (
      _item: Electron.MenuItem,
      _window: Electron.BaseWindow | undefined,
      event: Electron.KeyboardEvent,
    ) => {
      if (event.triggeredByAccelerator === true) return;
      runMenuEffect("paste-as-text", dispatchMenuAction("paste-as-text"));
    };
    const zoomClick = (direction: DesktopWindow.MainWindowZoomDirection) => () => {
      runMenuEffect(`zoom-${direction}`, zoomMainWindow(direction));
    };
    const mainContentsClick = (command: DesktopWindow.MainWindowContentsCommand) => () => {
      runMenuEffect(command, runMainContentsCommand(command));
    };
    const m = (template: string, ...values: string[]) => menuLabel(menuLocale, template, values);
    const template: Electron.MenuItemConstructorOptions[] = [];

    if (environment.platform === "darwin") {
      template.push({
        label: environment.displayName,
        submenu: [
          { role: "about", label: m("About {0}", environment.displayName) },
          {
            label: m("Check for Updates..."),
            click: checkForUpdatesClick,
          },
          { type: "separator" },
          {
            label: m("Settings..."),
            accelerator: "CmdOrCtrl+,",
            click: settingsClick,
          },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide", label: m("Hide {0}", environment.displayName) },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit", label: m("Quit {0}", environment.displayName) },
        ],
      });
    }

    template.push(
      {
        label: m("File"),
        submenu: [
          ...(environment.platform === "darwin"
            ? []
            : [
                {
                  label: m("Settings..."),
                  accelerator: "CmdOrCtrl+,",
                  click: settingsClick,
                },
                { type: "separator" as const },
              ]),
          {
            label: m("Close Developer Tools"),
            accelerator: "CmdOrCtrl+W",
            visible: false,
            click: () => {
              Electron.webContents
                .getAllWebContents()
                .find((contents) => !contents.isDestroyed() && contents.isDevToolsFocused())
                ?.closeDevTools();
            },
          },
          // Cmd/Ctrl+W belongs to the renderer's tab close; it must never close the window.
          environment.platform === "darwin"
            ? { label: m("Close Window"), click: (_item, window) => window?.close() }
            : { role: "quit" },
        ],
      },
      {
        label: m("Edit"),
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          {
            label: m("Paste as Text"),
            accelerator: "CmdOrCtrl+Shift+V",
            click: pasteAsTextClick,
          },
          { role: "delete" },
          { type: "separator" },
          { role: "selectAll" },
          ...(environment.platform === "darwin"
            ? [
                { type: "separator" as const },
                {
                  label: m("Speech"),
                  submenu: [{ role: "startSpeaking" as const }, { role: "stopSpeaking" as const }],
                },
              ]
            : []),
        ],
      },
      {
        label: m("View"),
        submenu: [
          /* Native reload/DevTools/zoom roles target focused guests; these commands must target the app. */
          { label: m("Reload"), accelerator: "CmdOrCtrl+R", click: mainContentsClick("reload") },
          {
            label: m("Force Reload"),
            accelerator: "Shift+CmdOrCtrl+R",
            click: mainContentsClick("forceReload"),
          },
          {
            label: m("Toggle Developer Tools"),
            accelerator: environment.platform === "darwin" ? "Alt+Command+I" : "Ctrl+Shift+I",
            click: mainContentsClick("toggleDevTools"),
          },
          { type: "separator" },
          { label: m("Actual Size"), accelerator: "CmdOrCtrl+0", click: zoomClick("reset") },
          { label: m("Zoom In"), accelerator: "CmdOrCtrl+=", click: zoomClick("in") },
          {
            label: m("Zoom In"),
            accelerator: "CmdOrCtrl+Plus",
            visible: false,
            click: zoomClick("in"),
          },
          ...(environment.platform === "darwin"
            ? [
                {
                  label: m("Zoom In"),
                  accelerator: "CmdOrCtrl+Shift+=",
                  visible: false,
                  click: zoomClick("in"),
                },
              ]
            : []),
          { label: m("Zoom Out"), accelerator: "CmdOrCtrl+-", click: zoomClick("out") },
          // Keypad codes do not match number-row accelerators.
          {
            label: m("Actual Size"),
            accelerator: "CmdOrCtrl+num0",
            visible: false,
            click: zoomClick("reset"),
          },
          {
            label: m("Zoom In"),
            accelerator: "CmdOrCtrl+numadd",
            visible: false,
            click: zoomClick("in"),
          },
          {
            label: m("Zoom Out"),
            accelerator: "CmdOrCtrl+numsub",
            visible: false,
            click: zoomClick("out"),
          },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
      {
        // Electron's default Window submenu adds a Ctrl+W close role off macOS.
        role: "windowMenu",
        submenu: [
          { role: "minimize" },
          { role: "zoom" },
          ...(environment.platform === "darwin"
            ? [{ type: "separator" as const }, { role: "front" as const }]
            : []),
        ],
      },
      {
        role: "help",
        submenu: [
          {
            label: m("Check for Updates..."),
            click: checkForUpdatesClick,
          },
        ],
      },
    );

    yield* electronMenu.setApplicationMenu(template);
  }).pipe(Effect.withSpan("desktop.menu.configure"));

  return DesktopApplicationMenu.of({
    configure,
  });
});

export const layer = Layer.effect(DesktopApplicationMenu, make);
