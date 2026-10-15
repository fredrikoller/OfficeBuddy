import {
  ToggleButton,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import {
  BriefcaseFilled,
  BriefcaseRegular,
  BuildingFilled,
  BuildingRegular,
  HomeFilled,
  HomeRegular,
  bundleIcon,
} from "@fluentui/react-icons";

import type { Location } from "./api";

const options = [
  { value: "Office", label: "Kontoret", Icon: bundleIcon(BuildingFilled, BuildingRegular) },
  { value: "Home", label: "Hemma", Icon: bundleIcon(HomeFilled, HomeRegular) },
  { value: "Customer", label: "Kund", Icon: bundleIcon(BriefcaseFilled, BriefcaseRegular) },
] as const;

const useStyles = makeStyles({
  root: {
    display: "grid",
    // Three equally wide buttons, also on a phone.
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: tokens.spacingHorizontalM,
  },
});

interface LocationPickerProps {
  // Accessible name of the group, e.g. the day it belongs to.
  label: string;
  value: Location | null;
  onChange: (value: Location | null) => void;
  disabled?: boolean;
  // Extra class for the group, e.g. to size it inside a flex row.
  className?: string;
}

// Three-way choice. Clicking the selected option again clears it.
export default function LocationPicker({
  label,
  value,
  onChange,
  disabled,
  className,
}: LocationPickerProps) {
  const styles = useStyles();

  return (
    <div
      role="group"
      aria-label={label}
      className={mergeClasses(styles.root, className)}
    >
      {options.map(({ value: option, label: text, Icon }) => {
        const checked = value === option;
        return (
          <ToggleButton
            key={option}
            size="large"
            // Selected = filled icon + primary style, so it does not rely on color alone.
            icon={<Icon filled={checked} />}
            appearance={checked ? "primary" : "secondary"}
            checked={checked}
            disabled={disabled}
            onClick={() => onChange(checked ? null : option)}
          >
            {text}
          </ToggleButton>
        );
      })}
    </div>
  );
}
