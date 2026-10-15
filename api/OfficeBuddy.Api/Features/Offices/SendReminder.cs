using Microsoft.EntityFrameworkCore;
using OfficeBuddy.Api.Common;
using OfficeBuddy.Api.Cqrs;
using OfficeBuddy.Api.Data;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;

namespace OfficeBuddy.Api.Features.Offices;

// Posts a reminder to every channel mapped to the office, listing who is missing days. Year/Week
// default to the current ISO week (Europe/Stockholm) when omitted.
public record SendReminderCommand(int OfficeId, int? Year, int? Week) : ICommand<SendReminderResult>;

public record SendReminderDto(MissingDto Missing, IReadOnlyList<string> SentToChannelIds);

public abstract record SendReminderResult
{
    private SendReminderResult()
    {
    }

    public sealed record Success(SendReminderDto Result) : SendReminderResult;
    public sealed record OfficeNotFound : SendReminderResult;
    public sealed record InvalidWeek : SendReminderResult;
    public sealed record NoChannelsMapped : SendReminderResult;
    public sealed record BotNotInstalled : SendReminderResult;
    public sealed record AllSendsFailed : SendReminderResult;
}

public class SendReminderHandler(
    IDispatcher dispatcher,
    OfficeBuddyDbContext db,
    IHttpClientFactory httpFactory,
    TimeProvider time) : IRequestHandler<SendReminderCommand, SendReminderResult>
{
    public async Task<SendReminderResult> HandleAsync(SendReminderCommand request, CancellationToken ct = default)
    {
        int year, week;
        if (request.Year is { } y && request.Week is { } w)
        {
            (year, week) = (y, w);
        }
        else
        {
            var today = StockholmClock.Today(time).ToDateTime(TimeOnly.MinValue);
            (year, week) = (ISOWeek.GetYear(today), ISOWeek.GetWeekOfYear(today));
        }

        MissingDto missing;
        var missingResult = await dispatcher.SendAsync(new GetMissingQuery(request.OfficeId, year, week), ct);
        switch (missingResult)
        {
            case GetMissingResult.InvalidWeek:
                return new SendReminderResult.InvalidWeek();
            case GetMissingResult.OfficeNotFound:
                return new SendReminderResult.OfficeNotFound();
            case GetMissingResult.Success success:
                missing = success.Missing;
                break;
            default:
                throw new UnreachableException();
        }

        var channelIds = await db.ChannelOffices
            .Where(c => c.OfficeId == request.OfficeId)
            .Select(c => c.ChannelId)
            .ToListAsync(ct);
        if (channelIds.Count == 0)
        {
            return new SendReminderResult.NoChannelsMapped();
        }

        var installation = await db.BotInstallations.SingleOrDefaultAsync(ct);
        if (installation is null)
        {
            return new SendReminderResult.BotNotInstalled();
        }

        var text = missing.People.Count == 0
            ? $"Alla har fyllt i vecka {week}. Bra jobbat!"
            : $"Dessa personer har inte fyllt i hela vecka {week}: " +
              string.Join(", ", missing.People.Select(p => $"{p.DisplayName} ({p.MissingDays.Count} dag(ar))"));

        var client = httpFactory.CreateClient("Bot");
        var sent = new List<string>();
        foreach (var channelId in channelIds)
        {
            var response = await client.PostAsJsonAsync("/internal/messages", new
            {
                serviceUrl = installation.ServiceUrl,
                tenantId = installation.TenantId,
                channelId,
                text,
            }, ct);
            if (response.IsSuccessStatusCode)
            {
                sent.Add(channelId);
            }
        }
        if (sent.Count == 0)
        {
            return new SendReminderResult.AllSendsFailed();
        }

        return new SendReminderResult.Success(new SendReminderDto(missing, sent));
    }
}
