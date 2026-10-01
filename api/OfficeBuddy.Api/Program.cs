using Microsoft.EntityFrameworkCore;
using OfficeBuddy.Api;
using OfficeBuddy.Api.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

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

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();

    // Apply pending migrations (and run UseSeeding) on startup in dev only.
    using var scope = app.Services.CreateScope();
    scope.ServiceProvider.GetRequiredService<OfficeBuddyDbContext>().Database.Migrate();
}

app.UseHttpsRedirection();

app.MapOfficeEndpoints();

app.Run();
