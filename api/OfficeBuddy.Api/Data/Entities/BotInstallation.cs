using System;

namespace OfficeBuddy.Api.Data.Entities;

// Captured from the bot's "added to team" event, so the API knows how to reach the Bot Connector
// service for proactive channel messages. The app is single-tenant, so at most one row exists.
public class BotInstallation
{
    public const int TenantIdMaxLength = 100;
    public const int ServiceUrlMaxLength = 500;

    public required string TenantId { get; set; }
    public required string ServiceUrl { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
