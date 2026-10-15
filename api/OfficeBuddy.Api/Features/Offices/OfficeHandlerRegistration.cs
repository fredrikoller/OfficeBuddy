using Microsoft.Extensions.DependencyInjection;
using OfficeBuddy.Api.Cqrs;
using System.Collections.Generic;

namespace OfficeBuddy.Api.Features.Offices;

public static class OfficeHandlerRegistration
{
    public static IServiceCollection AddOfficeHandlers(this IServiceCollection services) => services
        .AddScoped<IRequestHandler<GetOfficesQuery, IReadOnlyList<OfficeDto>>, GetOfficesHandler>()
        .AddScoped<IRequestHandler<GetOfficePresenceQuery, PresenceDto?>, GetOfficePresenceHandler>()
        .AddScoped<IRequestHandler<GetMissingQuery, GetMissingResult>, GetMissingHandler>()
        .AddScoped<IRequestHandler<CreateOfficeCommand, CreateOfficeResult>, CreateOfficeHandler>()
        .AddScoped<IRequestHandler<RenameOfficeCommand, RenameOfficeResult>, RenameOfficeHandler>()
        .AddScoped<IRequestHandler<DeleteOfficeCommand, DeleteOfficeResult>, DeleteOfficeHandler>()
        .AddScoped<IRequestHandler<SendReminderCommand, SendReminderResult>, SendReminderHandler>();
}
