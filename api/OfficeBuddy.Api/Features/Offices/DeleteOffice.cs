using Microsoft.EntityFrameworkCore;
using OfficeBuddy.Api.Cqrs;
using OfficeBuddy.Api.Data;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace OfficeBuddy.Api.Features.Offices;

public record DeleteOfficeCommand(int OfficeId) : ICommand<DeleteOfficeResult>;

// Office -> WorkplaceEntries/ChannelOffices is Restrict, so an office in use cannot be deleted
// (InUse). Being someone's home office does not block deletion; those people just lose it.
public abstract record DeleteOfficeResult
{
    private DeleteOfficeResult()
    {
    }

    public sealed record Success : DeleteOfficeResult;
    public sealed record NotFound : DeleteOfficeResult;
    public sealed record InUse : DeleteOfficeResult;
}

public class DeleteOfficeHandler(OfficeBuddyDbContext db) : IRequestHandler<DeleteOfficeCommand, DeleteOfficeResult>
{
    public async Task<DeleteOfficeResult> HandleAsync(DeleteOfficeCommand request, CancellationToken ct = default)
    {
        var office = await db.Offices.FindAsync(new object[] { request.OfficeId }, ct);
        if (office is null)
        {
            return new DeleteOfficeResult.NotFound();
        }

        if (await db.ChannelOffices.AnyAsync(c => c.OfficeId == request.OfficeId, ct)
            || await db.WorkplaceEntries.AnyAsync(w => w.OfficeId == request.OfficeId, ct))
        {
            return new DeleteOfficeResult.InUse();
        }

        await db.People
            .Where(p => p.HomeOfficeId == request.OfficeId)
            .ExecuteUpdateAsync(set => set.SetProperty(p => p.HomeOfficeId, (int?)null), ct);

        db.Offices.Remove(office);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Came into use between the check and the delete.
            return new DeleteOfficeResult.InUse();
        }

        return new DeleteOfficeResult.Success();
    }
}
