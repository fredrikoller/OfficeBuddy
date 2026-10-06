using Microsoft.EntityFrameworkCore;
using OfficeBuddy.Api.Data;

namespace OfficeBuddy.Api;

public record OfficeDto(int Id, string Name);

public static class OfficeEndpoints
{
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

        return api;
    }
}