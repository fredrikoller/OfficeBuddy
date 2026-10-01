namespace OfficeBuddy.Api.Endpoints;

public static class OfficeEndpoints
{
    public static void MapOfficeEndpoints(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api").RequireAuthorization();

        api.MapGet("/offices", async (AppDbContext db) =>
            await db.Offices.OrderBy(o => o.Name).ToListAsync());

        api.MapGet("/offices/{id:int}", async (int id, AppDbContext db) =>
            await db.Offices.FindAsync(id) is { } office
                ? Results.Ok(office)
                : Results.NotFound());

        api.MapPost("/offices", async (Office office, AppDbContext db) =>
        {
            db.Offices.Add(office);
            await db.SaveChangesAsync();
            return Results.Created($"/api/offices/{office.Id}", office);
        }).RequireAuthorization("Admin");
    }
}