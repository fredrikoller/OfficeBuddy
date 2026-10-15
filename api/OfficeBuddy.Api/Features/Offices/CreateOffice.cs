using Microsoft.EntityFrameworkCore;
using OfficeBuddy.Api.Cqrs;
using OfficeBuddy.Api.Data;
using OfficeBuddy.Api.Data.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace OfficeBuddy.Api.Features.Offices;

public record CreateOfficeCommand(string Name) : ICommand<CreateOfficeResult>;

public abstract record CreateOfficeResult
{
    private CreateOfficeResult()
    {
    }

    public sealed record Success(OfficeDto Office) : CreateOfficeResult;
    public sealed record NameTaken : CreateOfficeResult;
    public sealed record Invalid(string Message) : CreateOfficeResult;
}

public class CreateOfficeHandler(OfficeBuddyDbContext db) : IRequestHandler<CreateOfficeCommand, CreateOfficeResult>
{
    public async Task<CreateOfficeResult> HandleAsync(CreateOfficeCommand request, CancellationToken ct = default)
    {
        var name = request.Name.Trim();
        if (name.Length is 0 or > Office.NameMaxLength)
        {
            return new CreateOfficeResult.Invalid($"Must be 1–{Office.NameMaxLength} characters.");
        }

        if (await db.Offices.AnyAsync(o => o.Name == name, ct))
        {
            return new CreateOfficeResult.NameTaken();
        }

        var office = new Office { Name = name };
        db.Offices.Add(office);
        await db.SaveChangesAsync(ct);

        return new CreateOfficeResult.Success(new OfficeDto(office.Id, office.Name));
    }
}
