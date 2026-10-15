using Microsoft.EntityFrameworkCore;
using OfficeBuddy.Api.Cqrs;
using OfficeBuddy.Api.Data;
using OfficeBuddy.Api.Data.Entities;
using System.Threading;
using System.Threading.Tasks;

namespace OfficeBuddy.Api.Features.Offices;

public record RenameOfficeCommand(int OfficeId, string Name) : ICommand<RenameOfficeResult>;

public abstract record RenameOfficeResult
{
    private RenameOfficeResult()
    {
    }

    public sealed record Success(OfficeDto Office) : RenameOfficeResult;
    public sealed record NotFound : RenameOfficeResult;
    public sealed record NameTaken : RenameOfficeResult;
    public sealed record Invalid(string Message) : RenameOfficeResult;
}

public class RenameOfficeHandler(OfficeBuddyDbContext db) : IRequestHandler<RenameOfficeCommand, RenameOfficeResult>
{
    public async Task<RenameOfficeResult> HandleAsync(RenameOfficeCommand request, CancellationToken ct = default)
    {
        var name = request.Name.Trim();
        if (name.Length is 0 or > Office.NameMaxLength)
        {
            return new RenameOfficeResult.Invalid($"Must be 1–{Office.NameMaxLength} characters.");
        }

        var office = await db.Offices.FindAsync(new object[] { request.OfficeId }, ct);
        if (office is null)
        {
            return new RenameOfficeResult.NotFound();
        }

        if (await db.Offices.AnyAsync(o => o.Id != request.OfficeId && o.Name == name, ct))
        {
            return new RenameOfficeResult.NameTaken();
        }

        office.Name = name;
        await db.SaveChangesAsync(ct);

        return new RenameOfficeResult.Success(new OfficeDto(office.Id, office.Name));
    }
}
