using System.Globalization;

namespace OfficeBuddy.Api.Common;

public static class IsoWeek
{
    public static bool IsValid(int year, int week) =>
        year is >= 2000 and <= 2100 && week >= 1 && week <= ISOWeek.GetWeeksInYear(year);
}
