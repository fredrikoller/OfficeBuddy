import { Text, Title3, makeStyles, tokens } from "@fluentui/react-components";
import { BuildingRegular } from "@fluentui/react-icons";

const useStyles = makeStyles({
  header: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalS,
  },
  logo: {
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  office: {
    display: "inline-flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
  },
});

interface AppHeaderProps {
  // The channel's office. Left out where there is none to show yet (the config page).
  officeName?: string;
}

// Logo, app name and – when known – the channel's office, shared by the tab and its config page.
export default function AppHeader({ officeName }: AppHeaderProps) {
  const styles = useStyles();

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.logo} aria-hidden>
          <BuildingRegular />
        </span>
        <Title3 as="h1">OfficeBuddy</Title3>
      </div>
      {/* The office is set per channel on the config page, so this is a label, not a switch. */}
      {officeName && (
        <Text className={styles.office}>
          <BuildingRegular aria-hidden />
          Kontor: <Text weight="semibold">{officeName}</Text>
        </Text>
      )}
    </header>
  );
}
