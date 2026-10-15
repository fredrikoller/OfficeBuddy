using Microsoft.EntityFrameworkCore;
using OfficeBuddy.Api.Common;
using OfficeBuddy.Api.Cqrs;
using OfficeBuddy.Api.Data;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace OfficeBuddy.Api.Features.Offices;

// Which of a person's home-office weekdays this ISO week have no WorkplaceEntry at all.
public record MissingPersonDto(string DisplayName, IReadOnlyList<DateOnly> MissingDays);
public record MissingDto(int Year, int Week, IReadOnlyList<MissingPersonDto> People);

public record GetMissingQuery(int OfficeId, int Year, int Week) : IQuery<GetMissingResult>;

public abstract record GetMissingResult
{
    private GetMissingResult()
    {
    }

    public sealed record Success(MissingDto Missing) : GetMissingResult;
    public sealed record OfficeNotFound : GetMissingResult;
    public sealed record InvalidWeek : GetMissingResult;
}

public class GetMissingHandler(OfficeBuddyDbContext db) : IRequestHandler<GetMissingQuery, GetMissingResult>
{
    public async Task<GetMissingResult> HandleAsync(GetMissingQuery request, CancellationToken ct = default)
    {
        if (!IsoWeek.IsValid(request.Year, request.Week))
        {
            return new GetMissingResult.InvalidWeek();
        }
        if (!await db.Offices.AnyAsync(o => o.Id == request.OfficeId, ct))
        {
            return new GetMissingResult.OfficeNotFound();
        }

        var monday = DateOnly.FromDateTime(ISOWeek.ToDateTime(request.Year, request.Week, DayOfWeek.Monday));
        var weekdays = Enumerable.Range(0, 5).Select(i => monday.AddDays(i)).ToList();

        var people = await db.People.Where(p => p.HomeOfficeId == request.OfficeId).ToListAsync(ct);
        var oids = people.Select(p => p.Oid).ToList();

        // Any entry counts, regardless of which office it was filed under (entries are tagged by
        // the office the person filled in from, not necessarily their home office).
        var entries = await db.WorkplaceEntries
            .Where(w => weekdays.Contains(w.Date) && oids.Contains(w.PersonOid))
            .Select(w => new { w.PersonOid, w.Date })
            .ToListAsync(ct);
        var hasEntry = entries.Select(e => (e.PersonOid, e.Date)).ToHashSet();

        var missing = people
            .Select(p => new MissingPersonDto(
                p.DisplayName,
                weekdays.Where(d => !hasEntry.Contains((p.Oid, d))).ToList()))
            .Where(m => m.MissingDays.Count > 0)
            .OrderBy(m => m.DisplayName)
            .ToList();

        return new GetMissingResult.Success(new MissingDto(request.Year, request.Week, missing));
    }
}
