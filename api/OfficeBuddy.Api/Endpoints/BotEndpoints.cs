using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using OfficeBuddy.Api.Data;
using OfficeBuddy.Api.Data.Entities;
using System;
using System.Threading.Tasks;

namespace OfficeBuddy.Api;

// Called by the bot process (server-to-server, no Teams SSO token – see InternalAuth).
public record SaveBotInstallationRequest(string TenantId, string ServiceUrl);

public static class BotEndpoints
{
    public static IEndpointRouteBuilder MapBotEndpoints(this IEndpointRouteBuilder app)
    {
        var internalApi = app.MapGroup("/internal").AddEndpointFilter(InternalAuth.RequireApiKey);

        // Upserted every time the bot is added to a team. The app is single-tenant, so at most
        // one row exists; it is what GET /offices/{id}/send-reminder needs to reach the bot.
        internalApi.MapPut("/bot-installation", async (
            SaveBotInstallationRequest request, OfficeBuddyDbContext db, TimeProvider time) =>
        {
            var row = await db.BotInstallations.FindAsync(request.TenantId);
            if (row is null)
            {
                db.BotInstallations.Add(new BotInstallation
                {
                    TenantId = request.TenantId,
                    ServiceUrl = request.ServiceUrl,
                    UpdatedAt = time.GetUtcNow(),
                });
            }
            else
            {
                row.ServiceUrl = request.ServiceUrl;
                row.UpdatedAt = time.GetUtcNow();
            }
            await db.SaveChangesAsync();

            return TypedResults.NoContent();
        })
            .WithName("SaveBotInstallation");

        return app;
    }
}
