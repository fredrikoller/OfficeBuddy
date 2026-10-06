using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using OfficeBuddy.Api.Data;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace OfficeBuddy.Api;

public static class ChannelEndpoints
{
    // Expects the authorized /api group from Program.cs.
    public static IEndpointRouteBuilder MapChannelEndpoints(this IEndpointRouteBuilder api)
    {
        var channels = api.MapGroup("/channels").WithTags("Channels");

        channels.MapGet("/{channelId}/office", async Task<Results<Ok<OfficeDto>, NotFound>> (
            string channelId, OfficeBuddyDbContext db) =>
        {
            var office = await db.ChannelOffices
                .Where(c => c.ChannelId == channelId)
                .Select(c => new OfficeDto(c.Office.Id, c.Office.Name))
                .FirstOrDefaultAsync();

            return office is null ? TypedResults.NotFound() : TypedResults.Ok(office);
        })
            .WithName("GetChannelOffice");

        // Creates or replaces the channel's mapping.
        channels.MapPut("/{channelId}/office/{officeId:int}", async Task<Results<Ok<OfficeDto>, NotFound, ValidationProblem>> (
            string channelId, int officeId, OfficeBuddyDbContext db) =>
        {
            if (channelId.Length > ChannelOffice.ChannelIdMaxLength)
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["channelId"] = [$"Must be at most {ChannelOffice.ChannelIdMaxLength} characters."],
                });
            }

            var office = await db.Offices.FindAsync(officeId);
            if (office is null)
            {
                return TypedResults.NotFound();
            }

            var mapping = await db.ChannelOffices.FindAsync(channelId);
            if (mapping is null)
            {
                db.ChannelOffices.Add(new ChannelOffice { ChannelId = channelId, OfficeId = officeId });
            }
            else
            {
                mapping.OfficeId = officeId;
            }
            await db.SaveChangesAsync();

            return TypedResults.Ok(new OfficeDto(office.Id, office.Name));
        })
            .RequireAuthorization(Policies.Admin)
            .WithName("SetChannelOffice");

        return api;
    }
}
