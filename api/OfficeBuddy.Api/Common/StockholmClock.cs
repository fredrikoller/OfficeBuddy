using System;

namespace OfficeBuddy.Api.Common;

// "Today" is decided by this time zone, not the server's (Azure runs on UTC).
public static class StockholmClock
{
    private const string TimeZoneId = "Europe/Stockholm";

    public static DateOnly Today(TimeProvider time) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeBySystemTimeZoneId(time.GetUtcNow(), TimeZoneId).DateTime);
}
