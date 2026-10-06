using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Identity.Web;
using OfficeBuddy.Api;
using OfficeBuddy.Api.Data;
using System.Linq;
using System.Text.Json.Serialization;

const string TabCorsPolicy = "Tab";

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();

// Enums (e.g. Location) are sent and received as their names, not numbers.
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

// Validates the Teams SSO token (issuer/tenant, audience, signature) using the AzureAd section.
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAd"));

// Every endpoint that requires authorization also requires the access_as_user scope.
builder.Services.AddAuthorizationBuilder()
    .SetDefaultPolicy(new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .RequireScope("access_as_user")
        .Build())
    // Applied on top of the default policy by the endpoints that need it.
    .AddPolicy(Policies.Admin, policy => policy.RequireRole(Policies.AdminRole));

// The tab calls the API from the browser, so its origin must be allowed explicitly.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddPolicy(TabCorsPolicy, policy => policy
    .WithOrigins(allowedOrigins)
    .WithHeaders("Authorization", "Content-Type")
    .WithMethods("GET", "POST", "PUT", "DELETE")));

builder.Services.AddDbContext<OfficeBuddyDbContext>(options => options
    .UseSqlServer(builder.Configuration.GetConnectionString("OfficeBuddy"))
    .UseSeeding((context, _) =>
    {
        var db = (OfficeBuddyDbContext)context;
        if (!db.Offices.Any())
        {
            db.Offices.Add(new Office { Name = "Trollhättan" });
            db.SaveChanges();
        }
    }));

var app = builder.Build();

// Errors (unhandled exceptions and empty 4xx/5xx responses) are returned as ProblemDetails.
app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();

    // Apply pending migrations (and run UseSeeding) on startup in dev only.
    using var scope = app.Services.CreateScope();
    scope.ServiceProvider.GetRequiredService<OfficeBuddyDbContext>().Database.Migrate();
}

app.UseHttpsRedirection();

app.UseCors(TabCorsPolicy);
app.UseAuthentication();
app.UseAuthorization();

// Everything under /api requires a valid SSO token.
var api = app.MapGroup("/api").RequireAuthorization();
api.MapOfficeEndpoints();
api.MapChannelEndpoints();
api.MapMeEndpoints();

app.Run();
