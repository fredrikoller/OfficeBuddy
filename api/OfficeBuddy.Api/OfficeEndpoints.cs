using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Identity.Web;
using OfficeBuddy.Api.Data;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace OfficeBuddy.Api;

public record OfficeDto(int Id, string Name);

public record SaveOfficeRequest(string Name);

// Who has registered what at an office on a date. People are display names only (never email),
// sorted by name. MyLocation is the caller's own entry for the date, at any office.
public record PresenceDto(
    DateOnly Date,
    Location? MyLocation,
    IReadOnlyList<string> Office,
    IReadOnlyList<string> Home,
    IReadOnlyList<string> Customer);

public static class OfficeEndpoints
{
    // "Today" is decided by the offices' time zone, not the server's (Azure runs on UTC).
    private const string TimeZoneId = "Europe/Stockholm";

    // Expects the authorized /api group from Program.cs.
    public static IEndpointRouteBuilder MapOfficeEndpoints(this IEndpointRouteBuilder api)
    {
        var offices = api.MapGroup("/offices").WithTags("Offices");

        offices.MapGet("/", async (OfficeBuddyDbContext db) =>
            await db.Offices
                .OrderBy(o => o.Name)
                .Select(o => new OfficeDto(o.Id, o.Name))
                .ToListAsync())
            .WithName("GetOffices");

        // date is optional (yyyy-MM-dd); omitted = today.
        offices.MapGet("/{id:int}/presence", async Task<Results<Ok<PresenceDto>, NotFound>> (
            int id, DateOnly? date, ClaimsPrincipal user, OfficeBuddyDbContext db, TimeProvider time) =>
        {
            if (!await db.Offices.AnyAsync(o => o.Id == id))
            {
                return TypedResults.NotFound();
            }

            var day = date ?? DateOnly.FromDateTime(
                TimeZoneInfo.ConvertTimeBySystemTimeZoneId(time.GetUtcNow(), TimeZoneId).DateTime);

            var entries = await db.WorkplaceEntries
                .Where(w => w.OfficeId == id && w.Date == day)
                .OrderBy(w => w.Person.DisplayName)
                .Select(w => new { w.Location, w.Person.DisplayName })
                .ToListAsync();

            var oid = Guid.Parse(user.GetObjectId()!);
            var myLocation = await db.WorkplaceEntries
                .Where(w => w.PersonOid == oid && w.Date == day)
                .Select(w => (Location?)w.Location)
                .FirstOrDefaultAsync();

            List<string> At(Location location) =>
                entries.Where(e => e.Location == location).Select(e => e.DisplayName).ToList();

            return TypedResults.Ok(new PresenceDto(
                day, myLocation, At(Location.Office), At(Location.Home), At(Location.Customer)));
        })
            .WithName("GetOfficePresence");

        offices.MapPost("/", async Task<Results<Created<OfficeDto>, Conflict, ValidationProblem>> (
            SaveOfficeRequest request, OfficeBuddyDbContext db) =>
        {
            if (ValidateName(request.Name) is { } problem)
            {
                return problem;
            }

            var name = request.Name.Trim();
            if (await db.Offices.AnyAsync(o => o.Name == name))
            {
                return TypedResults.Conflict();
            }

            var office = new Office { Name = name };
            db.Offices.Add(office);
            await db.SaveChangesAsync();

            return TypedResults.Created($"/api/offices/{office.Id}", new OfficeDto(office.Id, office.Name));
        })
            .RequireAuthorization(Policies.Admin)
            .WithName("CreateOffice");

        // Renames the office.
        offices.MapPut("/{id:int}", async Task<Results<Ok<OfficeDto>, NotFound, Conflict, ValidationProblem>> (
            int id, SaveOfficeRequest request, OfficeBuddyDbContext db) =>
        {
            if (ValidateName(request.Name) is { } problem)
            {
                return problem;
            }

            var office = await db.Offices.FindAsync(id);
            if (office is null)
            {
                return TypedResults.NotFound();
            }

            var name = request.Name.Trim();
            if (await db.Offices.AnyAsync(o => o.Id != id && o.Name == name))
            {
                return TypedResults.Conflict();
            }

            office.Name = name;
            await db.SaveChangesAsync();

            return TypedResults.Ok(new OfficeDto(office.Id, office.Name));
        })
            .RequireAuthorization(Policies.Admin)
            .WithName("RenameOffice");

        // 409 when the office is in use: mapped to a channel or has workplace entries (history is
        // never deleted implicitly – the foreign keys are Restrict).
        offices.MapDelete("/{id:int}", async Task<Results<NoContent, NotFound, Conflict>> (
            int id, OfficeBuddyDbContext db) =>
        {
            var office = await db.Offices.FindAsync(id);
            if (office is null)
            {
                return TypedResults.NotFound();
            }

            if (await db.ChannelOffices.AnyAsync(c => c.OfficeId == id)
                || await db.WorkplaceEntries.AnyAsync(w => w.OfficeId == id))
            {
                return TypedResults.Conflict();
            }

            // Being someone's home office does not block deletion; those people just lose it.
            await db.People
                .Where(p => p.HomeOfficeId == id)
                .ExecuteUpdateAsync(set => set.SetProperty(p => p.HomeOfficeId, (int?)null));

            db.Offices.Remove(office);
            try
            {
                await db.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // Came into use between the check and the delete.
                return TypedResults.Conflict();
            }

            return TypedResults.NoContent();
        })
            .RequireAuthorization(Policies.Admin)
            .WithName("DeleteOffice");

        return api;
    }

    private static ValidationProblem? ValidateName(string? name)
    {
        var length = name?.Trim().Length ?? 0;
        return length is > 0 and <= Office.NameMaxLength
            ? null
            : TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["name"] = [$"Must be 1–{Office.NameMaxLength} characters."],
            });
    }
}
