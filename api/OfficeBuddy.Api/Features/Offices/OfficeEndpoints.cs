using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.Identity.Web;
using OfficeBuddy.Api.Cqrs;
using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;

namespace OfficeBuddy.Api.Features.Offices;

public record SaveOfficeRequest(string Name);

public static class OfficeEndpoints
{
    // Expects the authorized /api group from Program.cs.
    public static IEndpointRouteBuilder MapOfficeEndpoints(this IEndpointRouteBuilder api)
    {
        var offices = api.MapGroup("/offices").WithTags("Offices");

        offices.MapGet("/", async (IDispatcher dispatcher) =>
            await dispatcher.SendAsync(new GetOfficesQuery()))
            .WithName("GetOffices");

        // date is optional (yyyy-MM-dd); omitted = today.
        offices.MapGet("/{id:int}/presence", async Task<Results<Ok<PresenceDto>, NotFound>> (
            int id, DateOnly? date, ClaimsPrincipal user, IDispatcher dispatcher) =>
        {
            var oid = Guid.Parse(user.GetObjectId()!);
            var presence = await dispatcher.SendAsync(new GetOfficePresenceQuery(id, date, oid));
            return presence is null ? TypedResults.NotFound() : TypedResults.Ok(presence);
        })
            .WithName("GetOfficePresence");

        offices.MapGet("/{id:int}/missing/{year:int}/{week:int}", async Task<Results<Ok<MissingDto>, NotFound, ValidationProblem>> (
            int id, int year, int week, IDispatcher dispatcher) =>
        {
            var result = await dispatcher.SendAsync(new GetMissingQuery(id, year, week));
            return result switch
            {
                GetMissingResult.Success s => TypedResults.Ok(s.Missing),
                GetMissingResult.OfficeNotFound => TypedResults.NotFound(),
                GetMissingResult.InvalidWeek => Invalid("week", "Not a valid ISO week."),
            };
        })
            .RequireAuthorization(Policies.Admin)
            .WithName("GetMissing");

        // Posts a reminder to every channel mapped to this office, listing who is missing days
        // this ISO week (or the given week). 404 if the office or the bot's own team-install row
        // is missing; 409 if the office has no mapped channel, or the bot could not be reached.
        offices.MapPost("/{id:int}/send-reminder", async Task<Results<Ok<SendReminderDto>, NotFound, Conflict, ValidationProblem>> (
            int id, int? year, int? week, IDispatcher dispatcher) =>
        {
            var result = await dispatcher.SendAsync(new SendReminderCommand(id, year, week));
            return result switch
            {
                SendReminderResult.Success s => TypedResults.Ok(s.Result),
                SendReminderResult.OfficeNotFound => TypedResults.NotFound(),
                SendReminderResult.BotNotInstalled => TypedResults.NotFound(),
                SendReminderResult.InvalidWeek => Invalid("week", "Not a valid ISO week."),
                SendReminderResult.NoChannelsMapped => TypedResults.Conflict(),
                SendReminderResult.AllSendsFailed => TypedResults.Conflict(),
            };
        })
            .RequireAuthorization(Policies.Admin)
            .WithName("SendReminder");

        offices.MapPost("/", async Task<Results<Created<OfficeDto>, Conflict, ValidationProblem>> (
            SaveOfficeRequest request, IDispatcher dispatcher) =>
        {
            var result = await dispatcher.SendAsync(new CreateOfficeCommand(request.Name));
            return result switch
            {
                CreateOfficeResult.Success s => TypedResults.Created($"/api/offices/{s.Office.Id}", s.Office),
                CreateOfficeResult.NameTaken => TypedResults.Conflict(),
                CreateOfficeResult.Invalid i => Invalid("name", i.Message),
            };
        })
            .RequireAuthorization(Policies.Admin)
            .WithName("CreateOffice");

        // Renames the office.
        offices.MapPut("/{id:int}", async Task<Results<Ok<OfficeDto>, NotFound, Conflict, ValidationProblem>> (
            int id,
            SaveOfficeRequest request,
            IDispatcher dispatcher) =>
        {
            var result = await dispatcher.SendAsync(new RenameOfficeCommand(id, request.Name));
            return result switch
            {
                RenameOfficeResult.Success s => TypedResults.Ok(s.Office),
                RenameOfficeResult.NotFound => TypedResults.NotFound(),
                RenameOfficeResult.NameTaken => TypedResults.Conflict(),
                RenameOfficeResult.Invalid i => Invalid("name", i.Message)
            };
        })
            .RequireAuthorization(Policies.Admin)
            .WithName("RenameOffice");

        // 409 when the office is in use: mapped to a channel or has workplace entries (history is
        // never deleted implicitly – the foreign keys are Restrict).
        offices.MapDelete("/{id:int}", async Task<Results<NoContent, NotFound, Conflict>> (
            int id, IDispatcher dispatcher) =>
        {
            var result = await dispatcher.SendAsync(new DeleteOfficeCommand(id));
            return result switch
            {
                DeleteOfficeResult.Success => TypedResults.NoContent(),
                DeleteOfficeResult.NotFound => TypedResults.NotFound(),
                DeleteOfficeResult.InUse => TypedResults.Conflict(),
            };
        })
            .RequireAuthorization(Policies.Admin)
            .WithName("DeleteOffice");

        return api;
    }

    private static ValidationProblem Invalid(string field, string message) =>
        TypedResults.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });
}
