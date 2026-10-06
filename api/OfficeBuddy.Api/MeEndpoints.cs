using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Identity.Web;
using OfficeBuddy.Api.Data;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace OfficeBuddy.Api;

public record MeDto(string? DisplayName, OfficeDto? HomeOffice, bool IsAdmin);

// Location is null for a day without an entry (and, when saving, to clear the day).
public record DayDto(DateOnly Date, Location? Location);

// Days are always Monday–Friday of the ISO week.
public record WeekDto(int Year, int Week, IReadOnlyList<DayDto> Days);

// OfficeId is the office the user fills in from (the channel's office).
public record SaveWeekRequest(int OfficeId, IReadOnlyList<DayDto> Days);

public static class MeEndpoints
{
    // Expects the authorized /api group from Program.cs.
    public static IEndpointRouteBuilder MapMeEndpoints(this IEndpointRouteBuilder api)
    {
        var me = api.MapGroup("/me").WithTags("Me");

        // Lets the UI hide admin features; the API still enforces the role on admin endpoints.
        me.MapGet("/", async (ClaimsPrincipal user, OfficeBuddyDbContext db) =>
        {
            var oid = GetOid(user);
            var homeOffice = await db.People
                .Where(p => p.Oid == oid && p.HomeOffice != null)
                .Select(p => new OfficeDto(p.HomeOffice!.Id, p.HomeOffice.Name))
                .FirstOrDefaultAsync();

            return new MeDto(user.FindFirstValue("name"), homeOffice, user.IsInRole(Policies.AdminRole));
        })
            .WithName("GetMe");

        me.MapGet("/week/{year:int}/{week:int}", async Task<Results<Ok<WeekDto>, ValidationProblem>> (
            int year, int week, ClaimsPrincipal user, OfficeBuddyDbContext db) =>
        {
            if (!IsValidIsoWeek(year, week))
            {
                return Invalid("week", "Not a valid ISO week.");
            }

            return TypedResults.Ok(await LoadWeekAsync(db, GetOid(user), year, week));
        })
            .WithName("GetMyWeek");

        // Saves the given days: a location creates or updates the entry, null removes it.
        // Days that are not included are left untouched.
        me.MapPut("/week", async Task<Results<Ok<WeekDto>, NotFound, ValidationProblem>> (
            SaveWeekRequest request, ClaimsPrincipal user, OfficeBuddyDbContext db) =>
        {
            var dates = request.Days.Select(d => d.Date).ToList();
            if (dates.Count == 0 || dates.Distinct().Count() != dates.Count)
            {
                return Invalid("days", "Provide at least one day, and each date only once.");
            }
            if (dates.Any(d => d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday))
            {
                return Invalid("days", "Only Monday–Friday can be saved.");
            }

            var first = dates[0].ToDateTime(TimeOnly.MinValue);
            var (year, week) = (ISOWeek.GetYear(first), ISOWeek.GetWeekOfYear(first));
            if (dates.Any(d => ISOWeek.GetYear(d.ToDateTime(TimeOnly.MinValue)) != year
                || ISOWeek.GetWeekOfYear(d.ToDateTime(TimeOnly.MinValue)) != week))
            {
                return Invalid("days", "All days must be in the same ISO week.");
            }

            if (!await db.Offices.AnyAsync(o => o.Id == request.OfficeId))
            {
                return TypedResults.NotFound();
            }

            var oid = GetOid(user);
            var displayName = user.FindFirstValue("name");
            var person = await db.People.FindAsync(oid);
            if (person is null)
            {
                // The first office a person fills in from becomes their home office.
                db.People.Add(new Person
                {
                    Oid = oid,
                    DisplayName = displayName ?? "Okänd",
                    HomeOfficeId = request.OfficeId,
                });
            }
            else if (displayName is not null)
            {
                person.DisplayName = displayName;
            }

            var existing = await db.WorkplaceEntries
                .Where(w => w.PersonOid == oid && dates.Contains(w.Date))
                .ToDictionaryAsync(w => w.Date);

            foreach (var day in request.Days)
            {
                existing.TryGetValue(day.Date, out var entry);
                if (day.Location is not { } location)
                {
                    if (entry is not null)
                    {
                        db.WorkplaceEntries.Remove(entry);
                    }
                }
                else if (entry is null)
                {
                    db.WorkplaceEntries.Add(new WorkplaceEntry
                    {
                        PersonOid = oid,
                        Date = day.Date,
                        Location = location,
                        OfficeId = request.OfficeId,
                    });
                }
                else
                {
                    entry.Location = location;
                    entry.OfficeId = request.OfficeId;
                }
            }
            await db.SaveChangesAsync();

            return TypedResults.Ok(await LoadWeekAsync(db, oid, year, week));
        })
            .WithName("SaveMyWeek");

        me.MapDelete("/days/{date}", async (DateOnly date, ClaimsPrincipal user, OfficeBuddyDbContext db) =>
        {
            var oid = GetOid(user);
            await db.WorkplaceEntries.Where(w => w.PersonOid == oid && w.Date == date).ExecuteDeleteAsync();

            return TypedResults.NoContent();
        })
            .WithName("DeleteMyDay");

        return api;
    }

    private static Guid GetOid(ClaimsPrincipal user) =>
        Guid.Parse(user.GetObjectId() ?? throw new InvalidOperationException("The token has no oid claim."));

    private static bool IsValidIsoWeek(int year, int week) =>
        year is >= 2000 and <= 2100 && week >= 1 && week <= ISOWeek.GetWeeksInYear(year);

    private static ValidationProblem Invalid(string field, string message) =>
        TypedResults.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

    private static async Task<WeekDto> LoadWeekAsync(OfficeBuddyDbContext db, Guid oid, int year, int week)
    {
        var monday = DateOnly.FromDateTime(ISOWeek.ToDateTime(year, week, DayOfWeek.Monday));
        var friday = monday.AddDays(4);

        var entries = await db.WorkplaceEntries
            .Where(w => w.PersonOid == oid && w.Date >= monday && w.Date <= friday)
            .ToDictionaryAsync(w => w.Date, w => w.Location);

        var days = Enumerable.Range(0, 5)
            .Select(i => monday.AddDays(i))
            .Select(date => new DayDto(date, entries.TryGetValue(date, out var location) ? location : null))
            .ToList();

        return new WeekDto(year, week, days);
    }
}
