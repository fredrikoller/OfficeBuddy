using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Identity.Web;
using OfficeBuddy.Api;
using OfficeBuddy.Api.Cqrs;
using OfficeBuddy.Api.Data;
using OfficeBuddy.Api.Data.Entities;
using OfficeBuddy.Api.Endpoints;
using OfficeBuddy.Api.Features.Offices;
using System;
using System.Linq;
using System.Text.Json.Serialization;

const string TabCorsPolicy = "Tab";

var builder = WebApplication.CreateBuilder(args);

// Catches a handler accidentally registered AddSingleton instead of AddScoped/AddTransient –
// such a handler would capture a DbContext forever. Unconditional, not just in Development.
builder.Host.UseDefaultServiceProvider(o => o.ValidateScopes = true);

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddSingleton(TimeProvider.System);

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

// Calls the bot process to post channel reminders (see BotEndpoints.cs for the reverse direction).
builder.Services.AddHttpClient("Bot", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["Bot:BaseUrl"]!);
    client.DefaultRequestHeaders.Add("X-Internal-Api-Key", builder.Configuration["Bot:InternalApiKey"]);
});

// Hand-rolled CQRS dispatcher – AddScoped, never Singleton, see Cqrs/Dispatcher.cs.
builder.Services.AddScoped<IDispatcher, Dispatcher>();
builder.Services.AddOfficeHandlers();

builder.Services.AddDbContext<OfficeBuddyDbContext>(options => options
    // Retries transient failures, e.g. while the serverless Azure SQL database resumes from pause.
    .UseSqlServer(builder.Configuration.GetConnectionString("OfficeBuddy"), sql => sql.EnableRetryOnFailure())
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
}

// Apply pending migrations (and run UseSeeding) on startup. The API runs as a single instance, and
// in Azure its managed identity is the SQL server's administrator, so no separate migration step
// is needed.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<OfficeBuddyDbContext>();
    db.Database.Migrate();

    if (app.Environment.IsDevelopment())
    {
        // Fictitious colleagues around today's date, so the views have data to show.
        DevSeed.Run(db, DateOnly.FromDateTime(DateTime.Now));
    }

    // Fails fast at startup if a command/query has no registered handler, instead of a 500 the
    // first time someone hits that route.
    var requestKinds = typeof(Program).Assembly.GetTypes()
        .Where(t => !t.IsAbstract && !t.IsInterface)
        .SelectMany(t => t.GetInterfaces()
            .Where(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IRequest<>))
            .Select(i => (RequestType: t, ResultType: i.GetGenericArguments()[0])));

    foreach (var (requestType, resultType) in requestKinds)
    {
        scope.ServiceProvider.GetRequiredService(typeof(IRequestHandler<,>).MakeGenericType(requestType, resultType));
    }
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

// Server-to-server calls from the bot process – no Teams SSO token, guarded by a shared secret.
app.MapBotEndpoints();

app.Run();
