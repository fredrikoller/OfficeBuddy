using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using System.Security.Claims;

namespace OfficeBuddy.Api;

// HomeOffice is added together with the Person handling in the "My week" step.
public record MeDto(string? DisplayName, bool IsAdmin);

public static class MeEndpoints
{
    // Expects the authorized /api group from Program.cs.
    public static IEndpointRouteBuilder MapMeEndpoints(this IEndpointRouteBuilder api)
    {
        var me = api.MapGroup("/me").WithTags("Me");

        // Lets the UI hide admin features; the API still enforces the role on admin endpoints.
        me.MapGet("/", (ClaimsPrincipal user) =>
            new MeDto(user.FindFirstValue("name"), user.IsInRole(Policies.AdminRole)))
            .WithName("GetMe");

        return api;
    }
}
