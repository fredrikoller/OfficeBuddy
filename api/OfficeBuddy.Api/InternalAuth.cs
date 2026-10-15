using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace OfficeBuddy.Api;

// Guards /internal endpoints called by the bot process. There is no Teams SSO token for
// server-to-server calls, so a shared secret in a custom header stands in for authentication.
public static class InternalAuth
{
    private const string HeaderName = "X-Internal-Api-Key";

    public static async ValueTask<object?> RequireApiKey(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        var config = context.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var expected = config["Bot:InternalApiKey"];
        var provided = context.HttpContext.Request.Headers[HeaderName].FirstOrDefault();

        if (string.IsNullOrEmpty(expected) || !string.Equals(expected, provided, StringComparison.Ordinal))
        {
            return TypedResults.Unauthorized();
        }

        return await next(context);
    }
}
