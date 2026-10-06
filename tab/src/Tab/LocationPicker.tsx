import { ToggleButton, makeStyles, tokens } from "@fluentui/react-components";
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
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
  },
});

interface LocationPickerProps {
  // Accessible name of the group, e.g. the day it belongs to.
  label: string;
  value: Location | null;
  onChange: (value: Location | null) => void;
  disabled?: boolean;
}

// Three-way choice. Clicking the selected option again clears it.
export default function LocationPicker({
  label,
  value,
  onChange,
  disabled,
}: LocationPickerProps) {
  const styles = useStyles();

  return (
    <div role="group" aria-label={label} className={styles.root}>
      {options.map(({ value: option, label: text, Icon }) => {
        const checked = value === option;
        return (
          <ToggleButton
            key={option}
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
