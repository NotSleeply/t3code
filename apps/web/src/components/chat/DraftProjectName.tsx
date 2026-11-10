import { t } from "~/i18n";
export function DraftProjectName({
  value,
  singleLine = false,
}: {
  value: string;
  singleLine?: boolean;
}) {
  return (
    <span
      aria-label={value}
      className={`min-w-0 ${singleLine ? "block truncate text-left" : t("line-clamp-2 whitespace-normal [overflow-wrap:anywhere]")}`}
    >
      {value}
    </span>
  );
}
