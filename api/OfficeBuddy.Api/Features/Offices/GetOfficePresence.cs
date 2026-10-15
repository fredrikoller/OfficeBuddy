using Microsoft.EntityFrameworkCore;
using OfficeBuddy.Api.Common;
using OfficeBuddy.Api.Cqrs;
using OfficeBuddy.Api.Data;
using OfficeBuddy.Api.Data.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace OfficeBuddy.Api.Features.Offices;

// Who has registered what at an office on a date. People are display names only (never email),
// sorted by name. MyLocation is the caller's own entry for the date, at any office.
public record PresenceDto(
    DateOnly Date,
    Location? MyLocation,
    IReadOnlyList<string> Office,
    IReadOnlyList<string> Home,
    IReadOnlyList<string> Customer);

// Null result means the office does not exist.
public record GetOfficePresenceQuery(int OfficeId, DateOnly? Date, Guid CallerOid) : IQuery<PresenceDto?>;

public class GetOfficePresenceHandler(OfficeBuddyDbContext db, TimeProvider time)
    : IRequestHandler<GetOfficePresenceQuery, PresenceDto?>
{
    public async Task<PresenceDto?> HandleAsync(GetOfficePresenceQuery request, CancellationToken ct = default)
    {
        if (!await db.Offices.AnyAsync(o => o.Id == request.OfficeId, ct))
        {
            return null;
        }

        var day = request.Date ?? StockholmClock.Today(time);

        var entries = await db.WorkplaceEntries
            .Where(w => w.OfficeId == request.OfficeId && w.Date == day)
            .OrderBy(w => w.Person.DisplayName)
            .Select(w => new { w.Location, w.Person.DisplayName })
            .ToListAsync(ct);

        var myLocation = await db.WorkplaceEntries
            .Where(w => w.PersonOid == request.CallerOid && w.Date == day)
            .Select(w => (Location?)w.Location)
            .FirstOrDefaultAsync(ct);

        List<string> At(Location location) =>
            entries.Where(e => e.Location == location).Select(e => e.DisplayName).ToList();

        return new PresenceDto(day, myLocation, At(Location.Office), At(Location.Home), At(Location.Customer));
    }
}
